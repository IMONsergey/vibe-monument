use crate::persistence;
use rusqlite::{params, OptionalExtension};
use serde::Serialize;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{AppHandle, Manager};

const MAX_REVIEW_PATCH_BYTES: u64 = 320 * 1024;
const MAX_REVIEW_FILES: usize = 240;
static REVIEW_DIFF_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone)]
struct ReviewCheckpoint {
    id: String,
    parent_id: Option<String>,
    commit_sha: String,
    title: String,
    prompt_excerpt: Option<String>,
    turn_serial: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewDiffFile {
    status: String,
    path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewDiffPacket {
    checkpoint_id: String,
    parent_checkpoint_id: String,
    turn_serial: Option<i64>,
    title: String,
    prompt_excerpt: Option<String>,
    files: Vec<ReviewDiffFile>,
    patch: String,
    patch_truncated: bool,
}

fn validate_project_id(value: &str) -> Result<(), String> {
    if value.is_empty()
        || value.len() > 128
        || !value.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
    {
        return Err("Invalid Monument timeline project id".into());
    }
    Ok(())
}

fn canonical_project(project_path: &str) -> Result<PathBuf, String> {
    let root = PathBuf::from(project_path)
        .canonicalize()
        .map_err(|error| format!("Cannot open review project: {error}"))?;
    if !root.is_dir() {
        return Err("Review project root is not a directory".into());
    }
    Ok(root)
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
        .ok_or_else(|| "Git is required for Monument review but was not found".to_string())
}

fn checkpoint(
    connection: &rusqlite::Connection,
    project_id: &str,
    checkpoint_id: &str,
) -> Result<ReviewCheckpoint, String> {
    connection
        .query_row(
            "SELECT id, parent_id, commit_sha, title, prompt_excerpt, turn_serial
             FROM timeline_checkpoints WHERE project_id = ?1 AND id = ?2",
            params![project_id, checkpoint_id],
            |row| {
                Ok(ReviewCheckpoint {
                    id: row.get(0)?,
                    parent_id: row.get(1)?,
                    commit_sha: row.get(2)?,
                    title: row.get(3)?,
                    prompt_excerpt: row.get(4)?,
                    turn_serial: row.get(5)?,
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "Timeline checkpoint was not found for review".to_string())
}

fn run_git(git: &Path, git_dir: &Path, args: &[&str]) -> Result<Vec<u8>, String> {
    let output = Command::new(git)
        .arg(format!("--git-dir={}", git_dir.to_string_lossy()))
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .output()
        .map_err(|error| format!("Review Git command failed to start: {error}"))?;
    if output.status.success() {
        return Ok(output.stdout);
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(if stderr.is_empty() {
        format!("Review Git command failed with {}", output.status)
    } else {
        format!("Review Git command failed: {stderr}")
    })
}

fn diff_files(git: &Path, git_dir: &Path, from: &str, to: &str) -> Result<Vec<ReviewDiffFile>, String> {
    let output = run_git(
        git,
        git_dir,
        &["diff", "--name-status", "--find-renames", "--no-ext-diff", from, to],
    )?;
    let text = String::from_utf8_lossy(&output);
    let mut files = Vec::new();
    for line in text.lines() {
        let mut parts = line.split('\t');
        let Some(status) = parts.next() else { continue; };
        let paths = parts.collect::<Vec<_>>();
        if paths.is_empty() {
            continue;
        }
        files.push(ReviewDiffFile {
            status: status.to_string(),
            path: paths.join(" → "),
        });
        if files.len() >= MAX_REVIEW_FILES {
            break;
        }
    }
    Ok(files)
}

fn bounded_patch(
    git: &Path,
    git_dir: &Path,
    from: &str,
    to: &str,
    temp_root: &Path,
) -> Result<(String, bool), String> {
    fs::create_dir_all(temp_root).map_err(|error| error.to_string())?;
    let id = REVIEW_DIFF_COUNTER.fetch_add(1, Ordering::Relaxed);
    let path = temp_root.join(format!("review-diff-{}-{id}.patch", std::process::id()));
    let patch_file = File::create(&path).map_err(|error| error.to_string())?;

    let output = Command::new(git)
        .arg(format!("--git-dir={}", git_dir.to_string_lossy()))
        .args([
            "diff",
            "--no-ext-diff",
            "--no-textconv",
            "--no-color",
            "--unified=3",
            "--find-renames",
            from,
            to,
        ])
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdout(Stdio::from(patch_file))
        .stderr(Stdio::piped())
        .output()
        .map_err(|error| format!("Create review patch failed to start: {error}"))?;

    if !output.status.success() {
        let _ = fs::remove_file(&path);
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            format!("Create review patch failed with {}", output.status)
        } else {
            format!("Create review patch failed: {stderr}")
        });
    }

    let mut bytes = Vec::new();
    File::open(&path)
        .map_err(|error| error.to_string())?
        .take(MAX_REVIEW_PATCH_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| error.to_string())?;
    let _ = fs::remove_file(&path);
    let truncated = bytes.len() as u64 > MAX_REVIEW_PATCH_BYTES;
    if truncated {
        bytes.truncate(MAX_REVIEW_PATCH_BYTES as usize);
    }
    let mut patch = String::from_utf8_lossy(&bytes).to_string();
    if truncated {
        patch.push_str("\n\n…[Monument truncated the unified diff after 320 KiB]\n");
    }
    Ok((patch, truncated))
}

#[tauri::command]
pub fn timeline_review_packet(
    app: AppHandle,
    project_path: String,
    project_id: String,
) -> Result<ReviewDiffPacket, String> {
    validate_project_id(&project_id)?;
    let project_root = canonical_project(&project_path)?;
    let connection = persistence::connection(&app)?;
    let stored_path: Option<String> = connection
        .query_row(
            "SELECT project_path FROM timeline_projects WHERE project_id = ?1",
            params![project_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    let stored_path = stored_path.ok_or_else(|| "Version Timeline is not initialized for this project".to_string())?;
    let stored_root = PathBuf::from(stored_path)
        .canonicalize()
        .map_err(|error| format!("Cannot validate Timeline project root: {error}"))?;
    if stored_root != project_root {
        return Err("Review project root does not match the Timeline project root".into());
    }

    let current_id: String = connection
        .query_row(
            "SELECT current_checkpoint_id FROM timeline_projects WHERE project_id = ?1",
            params![project_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    let current = checkpoint(&connection, &project_id, &current_id)?;
    let parent_id = current
        .parent_id
        .clone()
        .ok_or_else(|| "The Original baseline has no change to review".to_string())?;
    let parent = checkpoint(&connection, &project_id, &parent_id)?;

    let git_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("timelines")
        .join(&project_id)
        .join("repo.git");
    if !git_dir.join("HEAD").is_file() {
        return Err("Monument shadow history is unavailable for review".into());
    }
    let git = resolve_git()?;
    let files = diff_files(&git, &git_dir, &parent.commit_sha, &current.commit_sha)?;
    let cache = app
        .path()
        .app_cache_dir()
        .map_err(|error| error.to_string())?
        .join("fresh-review");
    let (patch, patch_truncated) = bounded_patch(
        &git,
        &git_dir,
        &parent.commit_sha,
        &current.commit_sha,
        &cache,
    )?;

    Ok(ReviewDiffPacket {
        checkpoint_id: current.id,
        parent_checkpoint_id: parent.id,
        turn_serial: current.turn_serial,
        title: current.title,
        prompt_excerpt: current.prompt_excerpt,
        files,
        patch,
        patch_truncated,
    })
}

#[cfg(test)]
mod tests {
    use super::{validate_project_id, MAX_REVIEW_PATCH_BYTES};

    #[test]
    fn review_project_id_is_bounded_and_path_safe() {
        assert!(validate_project_id("timeline-deadbeef_42").is_ok());
        assert!(validate_project_id("../escape").is_err());
        assert!(validate_project_id("").is_err());
    }

    #[test]
    fn unified_review_patch_has_a_hard_memory_boundary() {
        assert_eq!(MAX_REVIEW_PATCH_BYTES, 320 * 1024);
    }
}
