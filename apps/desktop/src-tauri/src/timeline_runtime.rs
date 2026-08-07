use crate::persistence;
use ignore::WalkBuilder;
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::fs::{self, File};
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::process::{Command, Output};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};

static TIMELINE_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Default)]
pub struct TimelineRuntime;

#[derive(Debug, Clone)]
struct ShadowPaths {
    root: PathBuf,
    git_dir: PathBuf,
    index: PathBuf,
    pathspec: PathBuf,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineCheckpoint {
    id: String,
    project_id: String,
    parent_id: Option<String>,
    path_id: String,
    commit_sha: String,
    tree_sha: String,
    kind: String,
    sequence: i64,
    title: String,
    prompt_excerpt: Option<String>,
    created_at: i64,
    codex_thread_id: Option<String>,
    codex_turn_id: Option<String>,
    turn_serial: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineSnapshotMetadata {
    kind: String,
    title: Option<String>,
    prompt_excerpt: Option<String>,
    codex_thread_id: Option<String>,
    codex_turn_id: Option<String>,
    turn_serial: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineStatus {
    current_checkpoint_id: String,
    active_path_id: String,
    dirty: bool,
    current_tree_sha: String,
    checkpoint_tree_sha: String,
    can_back: bool,
    forward_checkpoint_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineState {
    current_checkpoint_id: String,
    active_path_id: String,
    dirty: bool,
    can_back: bool,
    forward_checkpoint_id: Option<String>,
    checkpoints: Vec<TimelineCheckpoint>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineRestoreResult {
    target: TimelineCheckpoint,
    safety_checkpoint: Option<TimelineCheckpoint>,
    state: TimelineState,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineDiffFile {
    status: String,
    path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineDiff {
    from_checkpoint_id: String,
    to_checkpoint_id: String,
    files: Vec<TimelineDiffFile>,
}

#[derive(Debug, Clone)]
struct ProjectCursor {
    current_checkpoint_id: Option<String>,
    active_path_id: Option<String>,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .min(i64::MAX as u128) as i64
}

fn unique_id(prefix: &str) -> String {
    let counter = TIMELINE_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{prefix}-{}-{}-{counter}", std::process::id(), now_ms())
}

fn validate_project_id(project_id: &str) -> Result<(), String> {
    if project_id.is_empty()
        || project_id.len() > 128
        || !project_id
            .bytes()
            .all(|value| value.is_ascii_alphanumeric() || value == b'-' || value == b'_')
    {
        return Err("Invalid Monument timeline project id".into());
    }
    Ok(())
}

fn canonical_project(project_path: &str) -> Result<PathBuf, String> {
    let root = PathBuf::from(project_path)
        .canonicalize()
        .map_err(|error| format!("Cannot open timeline project: {error}"))?;
    if !root.is_dir() {
        return Err("Timeline project root is not a directory".into());
    }
    Ok(root)
}

fn shadow_paths(app: &AppHandle, project_id: &str) -> Result<ShadowPaths, String> {
    validate_project_id(project_id)?;
    let base = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("timelines")
        .join(project_id);
    fs::create_dir_all(&base).map_err(|error| error.to_string())?;
    Ok(ShadowPaths {
        root: base.clone(),
        git_dir: base.join("repo.git"),
        index: base.join("index"),
        pathspec: base.join("pathspec.bin"),
    })
}

fn resolve_git() -> Result<PathBuf, String> {
    let mut candidates = Vec::new();
    if let Some(path) = std::env::var_os("PATH") {
        candidates.extend(std::env::split_paths(&path).map(|directory| directory.join("git")));
    }
    candidates.extend([
        PathBuf::from("/usr/bin/git"),
        PathBuf::from("/usr/local/bin/git"),
        PathBuf::from("/opt/homebrew/bin/git"),
    ]);
    candidates
        .into_iter()
        .find(|path| path.is_file())
        .ok_or_else(|| "Git is required for Monument version history but was not found".to_string())
}

fn checked_output(mut command: Command, label: &str) -> Result<Output, String> {
    let output = command
        .output()
        .map_err(|error| format!("{label} failed to start: {error}"))?;
    if output.status.success() {
        return Ok(output);
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(if stderr.is_empty() {
        format!("{label} failed with {}", output.status)
    } else {
        format!("{label} failed: {stderr}")
    })
}

fn shadow_command(git: &Path, shadow: &ShadowPaths, project_root: &Path) -> Command {
    let mut command = Command::new(git);
    command
        .env("GIT_DIR", &shadow.git_dir)
        .env("GIT_WORK_TREE", project_root)
        .env("GIT_INDEX_FILE", &shadow.index)
        .env("GIT_AUTHOR_NAME", "Monument Timeline")
        .env("GIT_AUTHOR_EMAIL", "timeline@monument.local")
        .env("GIT_COMMITTER_NAME", "Monument Timeline")
        .env("GIT_COMMITTER_EMAIL", "timeline@monument.local")
        .env("GIT_TERMINAL_PROMPT", "0");
    command
}

fn ensure_shadow_repository(git: &Path, shadow: &ShadowPaths) -> Result<(), String> {
    if shadow.git_dir.join("HEAD").is_file() {
        return Ok(());
    }
    fs::create_dir_all(&shadow.root).map_err(|error| error.to_string())?;
    let mut command = Command::new(git);
    command.args(["init", "--bare"]).arg(&shadow.git_dir);
    checked_output(command, "Initialize Monument shadow history")?;

    let mut config = Command::new(git);
    config
        .arg(format!("--git-dir={}", shadow.git_dir.to_string_lossy()))
        .args(["config", "gc.auto", "0"]);
    checked_output(config, "Configure Monument shadow history")?;
    Ok(())
}

fn ensure_schema(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS timeline_projects (
                project_id TEXT PRIMARY KEY NOT NULL,
                project_path TEXT NOT NULL,
                current_checkpoint_id TEXT,
                active_path_id TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS timeline_checkpoints (
                id TEXT PRIMARY KEY NOT NULL,
                project_id TEXT NOT NULL,
                parent_id TEXT,
                path_id TEXT NOT NULL,
                commit_sha TEXT NOT NULL,
                tree_sha TEXT NOT NULL,
                kind TEXT NOT NULL,
                sequence INTEGER NOT NULL,
                title TEXT NOT NULL,
                prompt_excerpt TEXT,
                created_at INTEGER NOT NULL,
                codex_thread_id TEXT,
                codex_turn_id TEXT,
                turn_serial INTEGER,
                FOREIGN KEY(project_id) REFERENCES timeline_projects(project_id)
            );
            CREATE INDEX IF NOT EXISTS timeline_checkpoints_project_sequence
                ON timeline_checkpoints(project_id, sequence);
            CREATE INDEX IF NOT EXISTS timeline_checkpoints_parent
                ON timeline_checkpoints(project_id, parent_id, path_id);",
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn ensure_project_record(
    connection: &Connection,
    project_id: &str,
    project_root: &Path,
) -> Result<ProjectCursor, String> {
    let timestamp = now_ms();
    connection
        .execute(
            "INSERT INTO timeline_projects(project_id, project_path, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?3)
             ON CONFLICT(project_id) DO UPDATE SET project_path = excluded.project_path, updated_at = excluded.updated_at",
            params![project_id, project_root.to_string_lossy(), timestamp],
        )
        .map_err(|error| error.to_string())?;
    connection
        .query_row(
            "SELECT current_checkpoint_id, active_path_id FROM timeline_projects WHERE project_id = ?1",
            params![project_id],
            |row| {
                Ok(ProjectCursor {
                    current_checkpoint_id: row.get(0)?,
                    active_path_id: row.get(1)?,
                })
            },
        )
        .map_err(|error| error.to_string())
}

fn checkpoint_from_row(row: &Row<'_>) -> rusqlite::Result<TimelineCheckpoint> {
    Ok(TimelineCheckpoint {
        id: row.get(0)?,
        project_id: row.get(1)?,
        parent_id: row.get(2)?,
        path_id: row.get(3)?,
        commit_sha: row.get(4)?,
        tree_sha: row.get(5)?,
        kind: row.get(6)?,
        sequence: row.get(7)?,
        title: row.get(8)?,
        prompt_excerpt: row.get(9)?,
        created_at: row.get(10)?,
        codex_thread_id: row.get(11)?,
        codex_turn_id: row.get(12)?,
        turn_serial: row.get(13)?,
    })
}

const CHECKPOINT_SELECT: &str =
    "SELECT id, project_id, parent_id, path_id, commit_sha, tree_sha, kind, sequence, title,
            prompt_excerpt, created_at, codex_thread_id, codex_turn_id, turn_serial
     FROM timeline_checkpoints";

fn checkpoint(
    connection: &Connection,
    project_id: &str,
    checkpoint_id: &str,
) -> Result<TimelineCheckpoint, String> {
    connection
        .query_row(
            &format!("{CHECKPOINT_SELECT} WHERE project_id = ?1 AND id = ?2"),
            params![project_id, checkpoint_id],
            checkpoint_from_row,
        )
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "Timeline checkpoint was not found".to_string())
}

fn list_checkpoints(connection: &Connection, project_id: &str) -> Result<Vec<TimelineCheckpoint>, String> {
    let mut statement = connection
        .prepare(&format!("{CHECKPOINT_SELECT} WHERE project_id = ?1 ORDER BY sequence ASC"))
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![project_id], checkpoint_from_row)
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

fn excluded_directory(name: &str) -> bool {
    matches!(
        name,
        ".git"
            | "node_modules"
            | "target"
            | "dist"
            | "build"
            | ".next"
            | ".nuxt"
            | ".output"
            | "coverage"
            | ".cache"
            | ".turbo"
    )
}

fn secret_environment_file(name: &str) -> bool {
    if matches!(name, ".env.example" | ".env.sample" | ".env.template") {
        return false;
    }
    name == ".env" || name.starts_with(".env.")
}

fn collect_snapshot_files(project_root: &Path) -> Result<Vec<String>, String> {
    let root_for_filter = project_root.to_path_buf();
    let mut builder = WalkBuilder::new(project_root);
    builder
        .hidden(false)
        .git_ignore(true)
        .git_global(false)
        .git_exclude(true)
        .parents(true)
        .require_git(false)
        .filter_entry(move |entry| {
            if entry.path() == root_for_filter {
                return true;
            }
            let name = entry.file_name().to_string_lossy();
            if entry.file_type().is_some_and(|kind| kind.is_dir()) && excluded_directory(&name) {
                return false;
            }
            if !entry.file_type().is_some_and(|kind| kind.is_dir()) && secret_environment_file(&name) {
                return false;
            }
            true
        });

    let mut files = Vec::new();
    for result in builder.build() {
        let entry = result.map_err(|error| format!("Cannot enumerate timeline source files: {error}"))?;
        let Some(file_type) = entry.file_type() else { continue; };
        if !file_type.is_file() && !file_type.is_symlink() {
            continue;
        }
        let relative = entry
            .path()
            .strip_prefix(project_root)
            .map_err(|error| error.to_string())?;
        let value = relative
            .to_str()
            .ok_or_else(|| "Version history does not yet support non-UTF-8 file names".to_string())?;
        if !value.is_empty() {
            files.push(value.replace('\\', "/"));
        }
    }
    files.sort();
    files.dedup();
    Ok(files)
}

fn write_pathspec(shadow: &ShadowPaths, files: &[String]) -> Result<(), String> {
    let mut file = File::create(&shadow.pathspec).map_err(|error| error.to_string())?;
    for path in files {
        file.write_all(path.as_bytes()).map_err(|error| error.to_string())?;
        file.write_all(&[0]).map_err(|error| error.to_string())?;
    }
    file.flush().map_err(|error| error.to_string())
}

fn working_tree_sha(
    git: &Path,
    shadow: &ShadowPaths,
    project_root: &Path,
) -> Result<String, String> {
    ensure_shadow_repository(git, shadow)?;
    let _ = fs::remove_file(&shadow.index);

    let mut empty = shadow_command(git, shadow, project_root);
    empty.args(["read-tree", "--empty"]);
    checked_output(empty, "Prepare Monument timeline index")?;

    let files = collect_snapshot_files(project_root)?;
    write_pathspec(shadow, &files)?;
    if !files.is_empty() {
        let mut add = shadow_command(git, shadow, project_root);
        add.arg("add")
            .arg("-f")
            .arg(format!("--pathspec-from-file={}", shadow.pathspec.to_string_lossy()))
            .arg("--pathspec-file-nul");
        let result = checked_output(add, "Capture Monument timeline source files");
        let _ = fs::remove_file(&shadow.pathspec);
        result?;
    } else {
        let _ = fs::remove_file(&shadow.pathspec);
    }

    let mut tree = shadow_command(git, shadow, project_root);
    tree.arg("write-tree");
    let output = checked_output(tree, "Write Monument timeline tree")?;
    let sha = String::from_utf8(output.stdout)
        .map_err(|_| "Git returned a non-UTF-8 tree id".to_string())?
        .trim()
        .to_string();
    if sha.is_empty() {
        return Err("Git did not return a timeline tree id".into());
    }
    Ok(sha)
}

fn create_shadow_commit(
    git: &Path,
    shadow: &ShadowPaths,
    project_root: &Path,
    checkpoint_id: &str,
    tree_sha: &str,
    parent_commit: Option<&str>,
    title: &str,
) -> Result<String, String> {
    let mut commit = shadow_command(git, shadow, project_root);
    commit.arg("commit-tree").arg(tree_sha);
    if let Some(parent) = parent_commit {
        commit.args(["-p", parent]);
    }
    commit.args(["-m", title]);
    let output = checked_output(commit, "Create Monument timeline checkpoint")?;
    let sha = String::from_utf8(output.stdout)
        .map_err(|_| "Git returned a non-UTF-8 commit id".to_string())?
        .trim()
        .to_string();
    if sha.is_empty() {
        return Err("Git did not return a timeline checkpoint id".into());
    }

    let mut reference = shadow_command(git, shadow, project_root);
    reference
        .args(["update-ref", &format!("refs/monument/checkpoints/{checkpoint_id}"), &sha]);
    checked_output(reference, "Protect Monument timeline checkpoint")?;
    Ok(sha)
}

fn next_sequence(connection: &Connection, project_id: &str) -> Result<i64, String> {
    connection
        .query_row(
            "SELECT COALESCE(MAX(sequence), -1) + 1 FROM timeline_checkpoints WHERE project_id = ?1",
            params![project_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())
}

fn tip_for_path(
    connection: &Connection,
    project_id: &str,
    path_id: &str,
) -> Result<Option<String>, String> {
    connection
        .query_row(
            "SELECT id FROM timeline_checkpoints
             WHERE project_id = ?1 AND path_id = ?2
             ORDER BY sequence DESC LIMIT 1",
            params![project_id, path_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| error.to_string())
}

fn default_title(kind: &str, sequence: i64) -> String {
    match kind {
        "baseline" => "Original".into(),
        "prompt" => format!("Version {sequence}"),
        "manual" => "Saved version".into(),
        "restore-safety" => "Before restore".into(),
        "external" => "External changes".into(),
        _ => format!("Version {sequence}"),
    }
}

fn validate_kind(kind: &str) -> Result<(), String> {
    if matches!(kind, "prompt" | "manual" | "restore-safety" | "external") {
        Ok(())
    } else {
        Err("Unsupported Monument timeline checkpoint kind".into())
    }
}

fn insert_checkpoint(
    connection: &Connection,
    checkpoint: &TimelineCheckpoint,
) -> Result<(), String> {
    connection
        .execute(
            "INSERT INTO timeline_checkpoints(
                id, project_id, parent_id, path_id, commit_sha, tree_sha, kind, sequence, title,
                prompt_excerpt, created_at, codex_thread_id, codex_turn_id, turn_serial
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            params![
                checkpoint.id,
                checkpoint.project_id,
                checkpoint.parent_id,
                checkpoint.path_id,
                checkpoint.commit_sha,
                checkpoint.tree_sha,
                checkpoint.kind,
                checkpoint.sequence,
                checkpoint.title,
                checkpoint.prompt_excerpt,
                checkpoint.created_at,
                checkpoint.codex_thread_id,
                checkpoint.codex_turn_id,
                checkpoint.turn_serial,
            ],
        )
        .map_err(|error| error.to_string())?;
    connection
        .execute(
            "UPDATE timeline_projects
             SET current_checkpoint_id = ?2, active_path_id = ?3, updated_at = ?4
             WHERE project_id = ?1",
            params![
                checkpoint.project_id,
                checkpoint.id,
                checkpoint.path_id,
                now_ms()
            ],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn create_baseline(
    connection: &Connection,
    git: &Path,
    shadow: &ShadowPaths,
    project_root: &Path,
    project_id: &str,
) -> Result<TimelineCheckpoint, String> {
    let tree_sha = working_tree_sha(git, shadow, project_root)?;
    let id = unique_id("checkpoint");
    let path_id = unique_id("path");
    let title = "Original".to_string();
    let commit_sha = create_shadow_commit(
        git,
        shadow,
        project_root,
        &id,
        &tree_sha,
        None,
        &title,
    )?;
    let checkpoint = TimelineCheckpoint {
        id,
        project_id: project_id.to_string(),
        parent_id: None,
        path_id,
        commit_sha,
        tree_sha,
        kind: "baseline".into(),
        sequence: 0,
        title,
        prompt_excerpt: None,
        created_at: now_ms(),
        codex_thread_id: None,
        codex_turn_id: None,
        turn_serial: Some(0),
    };
    insert_checkpoint(connection, &checkpoint)?;
    Ok(checkpoint)
}

fn snapshot_internal(
    connection: &Connection,
    git: &Path,
    shadow: &ShadowPaths,
    project_root: &Path,
    project_id: &str,
    metadata: TimelineSnapshotMetadata,
) -> Result<TimelineCheckpoint, String> {
    validate_kind(&metadata.kind)?;
    let cursor = ensure_project_record(connection, project_id, project_root)?;
    let current_id = cursor
        .current_checkpoint_id
        .ok_or_else(|| "Timeline baseline is missing".to_string())?;
    let current = checkpoint(connection, project_id, &current_id)?;
    let active_path = cursor.active_path_id.unwrap_or_else(|| current.path_id.clone());
    let tip = tip_for_path(connection, project_id, &active_path)?;
    let path_id = if tip.as_deref() == Some(current.id.as_str()) {
        active_path
    } else {
        unique_id("path")
    };
    let sequence = next_sequence(connection, project_id)?;
    let title = metadata
        .title
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| default_title(&metadata.kind, sequence));
    let tree_sha = working_tree_sha(git, shadow, project_root)?;
    let id = unique_id("checkpoint");
    let commit_sha = create_shadow_commit(
        git,
        shadow,
        project_root,
        &id,
        &tree_sha,
        Some(&current.commit_sha),
        &title,
    )?;
    let checkpoint = TimelineCheckpoint {
        id,
        project_id: project_id.to_string(),
        parent_id: Some(current.id),
        path_id,
        commit_sha,
        tree_sha,
        kind: metadata.kind,
        sequence,
        title,
        prompt_excerpt: metadata.prompt_excerpt.map(|value| value.chars().take(240).collect()),
        created_at: now_ms(),
        codex_thread_id: metadata.codex_thread_id,
        codex_turn_id: metadata.codex_turn_id,
        turn_serial: metadata.turn_serial,
    };
    insert_checkpoint(connection, &checkpoint)?;
    Ok(checkpoint)
}

fn tree_paths(
    git: &Path,
    shadow: &ShadowPaths,
    project_root: &Path,
    commit_sha: &str,
) -> Result<BTreeSet<String>, String> {
    let mut command = shadow_command(git, shadow, project_root);
    command.args(["ls-tree", "-r", "-z", "--name-only", commit_sha]);
    let output = checked_output(command, "Read Monument timeline tree")?;
    let mut paths = BTreeSet::new();
    for raw in output.stdout.split(|value| *value == 0).filter(|value| !value.is_empty()) {
        let value = String::from_utf8(raw.to_vec())
            .map_err(|_| "Timeline contains a non-UTF-8 file name".to_string())?;
        validate_relative_path(&value)?;
        paths.insert(value);
    }
    Ok(paths)
}

fn validate_relative_path(value: &str) -> Result<(), String> {
    let path = Path::new(value);
    if path.is_absolute()
        || path.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err("Unsafe file path in Monument timeline".into());
    }
    Ok(())
}

fn path_exists(path: &Path) -> bool {
    fs::symlink_metadata(path).is_ok()
}

fn prune_empty_parents(project_root: &Path, removed: &[String]) {
    let mut directories = BTreeSet::new();
    for relative in removed {
        let mut parent = Path::new(relative).parent();
        while let Some(value) = parent {
            if value.as_os_str().is_empty() {
                break;
            }
            directories.insert(project_root.join(value));
            parent = value.parent();
        }
    }
    let mut directories: Vec<_> = directories.into_iter().collect();
    directories.sort_by_key(|path| std::cmp::Reverse(path.components().count()));
    for directory in directories {
        let _ = fs::remove_dir(directory);
    }
}

fn restore_tree(
    git: &Path,
    shadow: &ShadowPaths,
    project_root: &Path,
    current_commit: &str,
    target_commit: &str,
) -> Result<(), String> {
    let current_paths = tree_paths(git, shadow, project_root, current_commit)?;
    let target_paths = tree_paths(git, shadow, project_root, target_commit)?;

    for relative in &target_paths {
        let absolute = project_root.join(relative);
        if path_exists(&absolute) && !current_paths.contains(relative) {
            return Err(format!(
                "Restore blocked because unmanaged file would be overwritten: {relative}"
            ));
        }
        let path = Path::new(relative);
        let mut ancestor = path.parent();
        while let Some(value) = ancestor {
            if value.as_os_str().is_empty() {
                break;
            }
            let absolute_ancestor = project_root.join(value);
            if path_exists(&absolute_ancestor) && absolute_ancestor.is_file() {
                let ancestor_value = value.to_string_lossy().replace('\\', "/");
                if !current_paths.contains(&ancestor_value) {
                    return Err(format!(
                        "Restore blocked because unmanaged path conflicts with target: {ancestor_value}"
                    ));
                }
            }
            ancestor = value.parent();
        }
    }

    let mut removed = Vec::new();
    for relative in current_paths.difference(&target_paths) {
        let absolute = project_root.join(relative);
        match fs::symlink_metadata(&absolute) {
            Ok(metadata) if metadata.file_type().is_file() || metadata.file_type().is_symlink() => {
                fs::remove_file(&absolute).map_err(|error| {
                    format!("Cannot remove timeline-managed file {relative}: {error}")
                })?;
                removed.push(relative.clone());
            }
            Ok(metadata) if metadata.file_type().is_dir() => {
                return Err(format!(
                    "Restore blocked because timeline-managed file became a directory: {relative}"
                ));
            }
            Ok(_) | Err(_) => {}
        }
    }
    prune_empty_parents(project_root, &removed);

    for relative in &target_paths {
        let absolute = project_root.join(relative);
        if absolute.is_dir() {
            if fs::read_dir(&absolute)
                .map_err(|error| error.to_string())?
                .next()
                .is_some()
            {
                return Err(format!(
                    "Restore blocked because a non-empty directory conflicts with target file: {relative}"
                ));
            }
            fs::remove_dir(&absolute).map_err(|error| error.to_string())?;
        }
    }

    let _ = fs::remove_file(&shadow.index);
    let mut read_tree = shadow_command(git, shadow, project_root);
    read_tree.args(["read-tree", target_commit]);
    checked_output(read_tree, "Prepare Monument restore tree")?;

    let mut checkout = shadow_command(git, shadow, project_root);
    checkout.args(["checkout-index", "-a", "-f"]);
    checked_output(checkout, "Restore Monument timeline checkpoint")?;
    Ok(())
}

fn forward_checkpoint_id(
    connection: &Connection,
    project_id: &str,
    current_id: &str,
    active_path_id: &str,
) -> Result<Option<String>, String> {
    connection
        .query_row(
            "SELECT id FROM timeline_checkpoints
             WHERE project_id = ?1 AND parent_id = ?2 AND path_id = ?3
             ORDER BY sequence ASC LIMIT 1",
            params![project_id, current_id, active_path_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| error.to_string())
}

fn status_internal(
    connection: &Connection,
    git: &Path,
    shadow: &ShadowPaths,
    project_root: &Path,
    project_id: &str,
) -> Result<TimelineStatus, String> {
    let cursor = ensure_project_record(connection, project_id, project_root)?;
    let current_id = cursor
        .current_checkpoint_id
        .ok_or_else(|| "Timeline baseline is missing".to_string())?;
    let current = checkpoint(connection, project_id, &current_id)?;
    let active_path_id = cursor.active_path_id.unwrap_or_else(|| current.path_id.clone());
    let tree_sha = working_tree_sha(git, shadow, project_root)?;
    let forward = forward_checkpoint_id(connection, project_id, &current.id, &active_path_id)?;
    Ok(TimelineStatus {
        current_checkpoint_id: current.id.clone(),
        active_path_id,
        dirty: tree_sha != current.tree_sha,
        current_tree_sha: tree_sha,
        checkpoint_tree_sha: current.tree_sha,
        can_back: current.parent_id.is_some(),
        forward_checkpoint_id: forward,
    })
}

fn state_internal(
    connection: &Connection,
    git: &Path,
    shadow: &ShadowPaths,
    project_root: &Path,
    project_id: &str,
) -> Result<TimelineState, String> {
    let status = status_internal(connection, git, shadow, project_root, project_id)?;
    Ok(TimelineState {
        current_checkpoint_id: status.current_checkpoint_id,
        active_path_id: status.active_path_id,
        dirty: status.dirty,
        can_back: status.can_back,
        forward_checkpoint_id: status.forward_checkpoint_id,
        checkpoints: list_checkpoints(connection, project_id)?,
    })
}

fn init_internal(
    app: &AppHandle,
    project_path: &str,
    project_id: &str,
) -> Result<TimelineState, String> {
    validate_project_id(project_id)?;
    let project_root = canonical_project(project_path)?;
    let shadow = shadow_paths(app, project_id)?;
    let git = resolve_git()?;
    ensure_shadow_repository(&git, &shadow)?;
    let connection = persistence::connection(app)?;
    ensure_schema(&connection)?;
    let cursor = ensure_project_record(&connection, project_id, &project_root)?;
    if cursor.current_checkpoint_id.is_none() {
        create_baseline(&connection, &git, &shadow, &project_root, project_id)?;
    }
    state_internal(&connection, &git, &shadow, &project_root, project_id)
}

fn restore_internal(
    app: &AppHandle,
    project_path: &str,
    project_id: &str,
    checkpoint_id: &str,
) -> Result<TimelineRestoreResult, String> {
    let project_root = canonical_project(project_path)?;
    let shadow = shadow_paths(app, project_id)?;
    let git = resolve_git()?;
    ensure_shadow_repository(&git, &shadow)?;
    let connection = persistence::connection(app)?;
    ensure_schema(&connection)?;
    ensure_project_record(&connection, project_id, &project_root)?;
    let target = checkpoint(&connection, project_id, checkpoint_id)?;
    let status = status_internal(&connection, &git, &shadow, &project_root, project_id)?;

    let safety_checkpoint = if status.dirty {
        Some(snapshot_internal(
            &connection,
            &git,
            &shadow,
            &project_root,
            project_id,
            TimelineSnapshotMetadata {
                kind: "restore-safety".into(),
                title: Some("Before restore".into()),
                prompt_excerpt: None,
                codex_thread_id: None,
                codex_turn_id: None,
                turn_serial: None,
            },
        )?)
    } else {
        None
    };

    let cursor = ensure_project_record(&connection, project_id, &project_root)?;
    let current_id = cursor
        .current_checkpoint_id
        .ok_or_else(|| "Timeline current checkpoint is missing".to_string())?;
    let current = checkpoint(&connection, project_id, &current_id)?;

    if current.id != target.id {
        restore_tree(
            &git,
            &shadow,
            &project_root,
            &current.commit_sha,
            &target.commit_sha,
        )?;
    }

    connection
        .execute(
            "UPDATE timeline_projects
             SET current_checkpoint_id = ?2, active_path_id = ?3, updated_at = ?4
             WHERE project_id = ?1",
            params![project_id, target.id, target.path_id, now_ms()],
        )
        .map_err(|error| error.to_string())?;

    Ok(TimelineRestoreResult {
        target: target.clone(),
        safety_checkpoint,
        state: state_internal(&connection, &git, &shadow, &project_root, project_id)?,
    })
}

fn with_runtime_lock<'a>(
    state: &'a State<'_, Mutex<TimelineRuntime>>,
) -> Result<std::sync::MutexGuard<'a, TimelineRuntime>, String> {
    state
        .lock()
        .map_err(|_| "Timeline runtime lock poisoned".to_string())
}

#[tauri::command]
pub fn timeline_init(
    app: AppHandle,
    state: State<'_, Mutex<TimelineRuntime>>,
    project_path: String,
    project_id: String,
) -> Result<TimelineState, String> {
    let _guard = with_runtime_lock(&state)?;
    init_internal(&app, &project_path, &project_id)
}

#[tauri::command]
pub fn timeline_snapshot(
    app: AppHandle,
    state: State<'_, Mutex<TimelineRuntime>>,
    project_path: String,
    project_id: String,
    metadata: TimelineSnapshotMetadata,
) -> Result<TimelineCheckpoint, String> {
    let _guard = with_runtime_lock(&state)?;
    init_internal(&app, &project_path, &project_id)?;
    let project_root = canonical_project(&project_path)?;
    let shadow = shadow_paths(&app, &project_id)?;
    let git = resolve_git()?;
    let connection = persistence::connection(&app)?;
    ensure_schema(&connection)?;
    snapshot_internal(
        &connection,
        &git,
        &shadow,
        &project_root,
        &project_id,
        metadata,
    )
}

#[tauri::command]
pub fn timeline_list(
    app: AppHandle,
    state: State<'_, Mutex<TimelineRuntime>>,
    project_id: String,
) -> Result<Vec<TimelineCheckpoint>, String> {
    let _guard = with_runtime_lock(&state)?;
    validate_project_id(&project_id)?;
    let connection = persistence::connection(&app)?;
    ensure_schema(&connection)?;
    list_checkpoints(&connection, &project_id)
}

#[tauri::command]
pub fn timeline_status(
    app: AppHandle,
    state: State<'_, Mutex<TimelineRuntime>>,
    project_path: String,
    project_id: String,
) -> Result<TimelineStatus, String> {
    let _guard = with_runtime_lock(&state)?;
    init_internal(&app, &project_path, &project_id)?;
    let project_root = canonical_project(&project_path)?;
    let shadow = shadow_paths(&app, &project_id)?;
    let git = resolve_git()?;
    let connection = persistence::connection(&app)?;
    status_internal(&connection, &git, &shadow, &project_root, &project_id)
}

#[tauri::command]
pub fn timeline_restore(
    app: AppHandle,
    state: State<'_, Mutex<TimelineRuntime>>,
    project_path: String,
    project_id: String,
    checkpoint_id: String,
) -> Result<TimelineRestoreResult, String> {
    let _guard = with_runtime_lock(&state)?;
    init_internal(&app, &project_path, &project_id)?;
    restore_internal(&app, &project_path, &project_id, &checkpoint_id)
}

#[tauri::command]
pub fn timeline_back(
    app: AppHandle,
    state: State<'_, Mutex<TimelineRuntime>>,
    project_path: String,
    project_id: String,
) -> Result<TimelineRestoreResult, String> {
    let _guard = with_runtime_lock(&state)?;
    init_internal(&app, &project_path, &project_id)?;
    let project_root = canonical_project(&project_path)?;
    let connection = persistence::connection(&app)?;
    ensure_schema(&connection)?;
    let cursor = ensure_project_record(&connection, &project_id, &project_root)?;
    let current_id = cursor
        .current_checkpoint_id
        .ok_or_else(|| "Timeline current checkpoint is missing".to_string())?;
    let current = checkpoint(&connection, &project_id, &current_id)?;
    let parent = current
        .parent_id
        .ok_or_else(|| "Already at the first Monument version".to_string())?;
    drop(connection);
    restore_internal(&app, &project_path, &project_id, &parent)
}

#[tauri::command]
pub fn timeline_forward(
    app: AppHandle,
    state: State<'_, Mutex<TimelineRuntime>>,
    project_path: String,
    project_id: String,
) -> Result<TimelineRestoreResult, String> {
    let _guard = with_runtime_lock(&state)?;
    init_internal(&app, &project_path, &project_id)?;
    let project_root = canonical_project(&project_path)?;
    let connection = persistence::connection(&app)?;
    ensure_schema(&connection)?;
    let cursor = ensure_project_record(&connection, &project_id, &project_root)?;
    let current_id = cursor
        .current_checkpoint_id
        .ok_or_else(|| "Timeline current checkpoint is missing".to_string())?;
    let current = checkpoint(&connection, &project_id, &current_id)?;
    let active_path = cursor.active_path_id.unwrap_or(current.path_id);
    let next = forward_checkpoint_id(&connection, &project_id, &current_id, &active_path)?
        .ok_or_else(|| "Already at the latest version on this history path".to_string())?;
    drop(connection);
    restore_internal(&app, &project_path, &project_id, &next)
}

#[tauri::command]
pub fn timeline_diff(
    app: AppHandle,
    state: State<'_, Mutex<TimelineRuntime>>,
    project_path: String,
    project_id: String,
    from_checkpoint_id: String,
    to_checkpoint_id: String,
) -> Result<TimelineDiff, String> {
    let _guard = with_runtime_lock(&state)?;
    init_internal(&app, &project_path, &project_id)?;
    let project_root = canonical_project(&project_path)?;
    let shadow = shadow_paths(&app, &project_id)?;
    let git = resolve_git()?;
    let connection = persistence::connection(&app)?;
    ensure_schema(&connection)?;
    let from = checkpoint(&connection, &project_id, &from_checkpoint_id)?;
    let to = checkpoint(&connection, &project_id, &to_checkpoint_id)?;
    let mut diff = shadow_command(&git, &shadow, &project_root);
    diff.args([
        "diff",
        "--name-status",
        "--find-renames",
        &from.commit_sha,
        &to.commit_sha,
    ]);
    let output = checked_output(diff, "Compare Monument timeline checkpoints")?;
    let text = String::from_utf8(output.stdout)
        .map_err(|_| "Git returned non-UTF-8 timeline diff output".to_string())?;
    let files = text
        .lines()
        .filter_map(|line| {
            let mut parts = line.split('\t');
            let status = parts.next()?.to_string();
            let rest = parts.collect::<Vec<_>>();
            if rest.is_empty() {
                None
            } else {
                Some(TimelineDiffFile {
                    status,
                    path: rest.join(" → "),
                })
            }
        })
        .collect();
    Ok(TimelineDiff {
        from_checkpoint_id,
        to_checkpoint_id,
        files,
    })
}

#[cfg(test)]
mod tests {
    use super::{
        collect_snapshot_files, ensure_shadow_repository, restore_tree, secret_environment_file,
        working_tree_sha,
    };
    use std::fs;
    use std::path::PathBuf;

    fn temporary_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "monument-timeline-{name}-{}-{}",
            std::process::id(),
            super::unique_id("test")
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        root
    }

    #[test]
    fn environment_templates_are_versioned_but_secrets_are_not() {
        assert!(secret_environment_file(".env"));
        assert!(secret_environment_file(".env.local"));
        assert!(!secret_environment_file(".env.example"));
        assert!(!secret_environment_file(".env.template"));
    }

    #[test]
    fn snapshot_walker_respects_ignored_heavy_and_secret_paths() {
        let root = temporary_root("walk");
        fs::write(root.join("app.ts"), "export const value = 1;\n").unwrap();
        fs::write(root.join(".env"), "SECRET=yes\n").unwrap();
        fs::write(root.join(".env.example"), "SECRET=\n").unwrap();
        fs::write(root.join(".gitignore"), "ignored.txt\n").unwrap();
        fs::write(root.join("ignored.txt"), "ignored\n").unwrap();
        fs::create_dir_all(root.join("node_modules/pkg")).unwrap();
        fs::write(root.join("node_modules/pkg/index.js"), "large\n").unwrap();
        let files = collect_snapshot_files(&root).unwrap();
        assert!(files.contains(&"app.ts".to_string()));
        assert!(files.contains(&".env.example".to_string()));
        assert!(!files.contains(&".env".to_string()));
        assert!(!files.contains(&"ignored.txt".to_string()));
        assert!(!files.iter().any(|value| value.starts_with("node_modules/")));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn shadow_snapshot_and_restore_preserve_excluded_secrets() {
        let Ok(git) = super::resolve_git() else { return; };
        let root = temporary_root("restore");
        let shadow_root = root.join("shadow");
        let project = root.join("project");
        fs::create_dir_all(&project).unwrap();
        fs::write(project.join("page.txt"), "version one\n").unwrap();
        fs::write(project.join(".env"), "SECRET=keep\n").unwrap();
        let shadow = super::shadow_paths_for_test(&shadow_root);
        ensure_shadow_repository(&git, &shadow).unwrap();
        let tree_one = working_tree_sha(&git, &shadow, &project).unwrap();
        let commit_one = super::create_shadow_commit(
            &git,
            &shadow,
            &project,
            "one",
            &tree_one,
            None,
            "one",
        )
        .unwrap();

        fs::write(project.join("page.txt"), "version two\n").unwrap();
        fs::write(project.join("new.txt"), "new\n").unwrap();
        let tree_two = working_tree_sha(&git, &shadow, &project).unwrap();
        let commit_two = super::create_shadow_commit(
            &git,
            &shadow,
            &project,
            "two",
            &tree_two,
            Some(&commit_one),
            "two",
        )
        .unwrap();

        restore_tree(&git, &shadow, &project, &commit_two, &commit_one).unwrap();
        assert_eq!(fs::read_to_string(project.join("page.txt")).unwrap(), "version one\n");
        assert!(!project.join("new.txt").exists());
        assert_eq!(fs::read_to_string(project.join(".env")).unwrap(), "SECRET=keep\n");
        let _ = fs::remove_dir_all(root);
    }
}

#[cfg(test)]
fn shadow_paths_for_test(root: &Path) -> ShadowPaths {
    let _ = fs::create_dir_all(root);
    ShadowPaths {
        root: root.to_path_buf(),
        git_dir: root.join("repo.git"),
        index: root.join("index"),
        pathspec: root.join("pathspec.bin"),
    }
}
