use crate::persistence;
use rusqlite::{params, OptionalExtension};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Manager};

const MAX_SOURCE_CONTEXT_BYTES: usize = 180 * 1024;
const MAX_SOURCE_FILE_BYTES: usize = 32 * 1024;
const MAX_SOURCE_OBJECT_BYTES: u64 = 512 * 1024;
const MAX_SOURCE_FILES: usize = 80;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewSourceContext {
    pub(crate) content: String,
    pub(crate) files_included: usize,
    pub(crate) truncated: bool,
}

fn validate_project_id(value: &str) -> Result<(), String> {
    if value.is_empty()
        || value.len() > 128
        || !value.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
    {
        return Err("Invalid Monument review project id".into());
    }
    Ok(())
}

fn canonical_project(project_path: &str) -> Result<PathBuf, String> {
    let root = PathBuf::from(project_path)
        .canonicalize()
        .map_err(|error| format!("Cannot open Fresh Review project: {error}"))?;
    if !root.is_dir() {
        return Err("Fresh Review project root is not a directory".into());
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
        .ok_or_else(|| "Git is required for Fresh Review source context but was not found".to_string())
}

fn git_output(git: &Path, git_dir: &Path, args: &[String]) -> Result<Vec<u8>, String> {
    let output = Command::new(git)
        .arg(format!("--git-dir={}", git_dir.to_string_lossy()))
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .output()
        .map_err(|error| format!("Fresh Review Git command failed to start: {error}"))?;
    if output.status.success() {
        return Ok(output.stdout);
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(if stderr.is_empty() {
        format!("Fresh Review Git command failed with {}", output.status)
    } else {
        format!("Fresh Review Git command failed: {stderr}")
    })
}

fn secret_like_path(path: &str) -> bool {
    let normalized = path.replace('\\', "/").to_ascii_lowercase();
    let name = normalized.rsplit('/').next().unwrap_or(&normalized);
    if matches!(name, ".env.example" | ".env.sample" | ".env.template") {
        return false;
    }
    name == ".env"
        || name.starts_with(".env.")
        || name.ends_with(".pem")
        || name.ends_with(".key")
        || name.ends_with(".p12")
        || name.ends_with(".pfx")
        || name.contains("credentials")
        || name.contains("secrets")
}

fn changed_paths(
    git: &Path,
    git_dir: &Path,
    from_commit: &str,
    to_commit: &str,
) -> Result<Vec<String>, String> {
    let args = vec![
        "diff".to_string(),
        "--name-only".to_string(),
        "-z".to_string(),
        "--diff-filter=ACMRTUXB".to_string(),
        "--no-ext-diff".to_string(),
        from_commit.to_string(),
        to_commit.to_string(),
    ];
    let bytes = git_output(git, git_dir, &args)?;
    let mut paths = Vec::new();
    for raw in bytes.split(|byte| *byte == 0) {
        if raw.is_empty() {
            continue;
        }
        let Ok(path) = std::str::from_utf8(raw) else { continue; };
        let normalized = path.replace('\\', "/");
        if normalized.starts_with('/') || normalized.split('/').any(|part| part == "..") || secret_like_path(&normalized) {
            continue;
        }
        paths.push(normalized);
        if paths.len() >= MAX_SOURCE_FILES {
            break;
        }
    }
    Ok(paths)
}

fn object_size(git: &Path, git_dir: &Path, commit: &str, path: &str) -> Option<u64> {
    let spec = format!("{commit}:{path}");
    let args = vec!["cat-file".to_string(), "-s".to_string(), spec];
    let bytes = git_output(git, git_dir, &args).ok()?;
    String::from_utf8(bytes).ok()?.trim().parse().ok()
}

fn object_text(git: &Path, git_dir: &Path, commit: &str, path: &str) -> Option<String> {
    let size = object_size(git, git_dir, commit, path)?;
    if size > MAX_SOURCE_OBJECT_BYTES {
        return None;
    }
    let spec = format!("{commit}:{path}");
    let args = vec!["show".to_string(), "--no-textconv".to_string(), spec];
    let mut bytes = git_output(git, git_dir, &args).ok()?;
    if bytes.iter().take(8_192).any(|byte| *byte == 0) {
        return None;
    }
    if bytes.len() > MAX_SOURCE_FILE_BYTES {
        bytes.truncate(MAX_SOURCE_FILE_BYTES);
        let mut text = String::from_utf8(bytes).ok()?;
        text.push_str("\n…[Monument truncated this source file after 32 KiB]\n");
        return Some(text);
    }
    String::from_utf8(bytes).ok()
}

pub(crate) fn source_context_internal(
    app: &AppHandle,
    project_path: &str,
    project_id: &str,
    checkpoint_id: &str,
    parent_checkpoint_id: &str,
) -> Result<ReviewSourceContext, String> {
    validate_project_id(project_id)?;
    let project_root = canonical_project(project_path)?;
    let connection = persistence::connection(app)?;
    let stored: Option<(String, String)> = connection
        .query_row(
            "SELECT project_path, current_checkpoint_id FROM timeline_projects WHERE project_id = ?1",
            params![project_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    let (stored_path, current_checkpoint_id) = stored.ok_or_else(|| "Version Timeline is not initialized for Fresh Review".to_string())?;
    let stored_root = PathBuf::from(stored_path)
        .canonicalize()
        .map_err(|error| format!("Cannot validate Fresh Review Timeline root: {error}"))?;
    if stored_root != project_root {
        return Err("Fresh Review project root does not match Timeline root".into());
    }
    if current_checkpoint_id != checkpoint_id {
        return Err("Fresh Review source context became stale because the active Timeline version changed".into());
    }

    let (current_commit, stored_parent): (String, Option<String>) = connection
        .query_row(
            "SELECT commit_sha, parent_id FROM timeline_checkpoints WHERE project_id = ?1 AND id = ?2",
            params![project_id, checkpoint_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|error| error.to_string())?;
    if stored_parent.as_deref() != Some(parent_checkpoint_id) {
        return Err("Fresh Review parent checkpoint changed before source context was captured".into());
    }
    let parent_commit: String = connection
        .query_row(
            "SELECT commit_sha FROM timeline_checkpoints WHERE project_id = ?1 AND id = ?2",
            params![project_id, parent_checkpoint_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;

    let git_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("timelines")
        .join(project_id)
        .join("repo.git");
    if !git_dir.join("HEAD").is_file() {
        return Err("Monument shadow history is unavailable for Fresh Review source context".into());
    }
    let git = resolve_git()?;
    let paths = changed_paths(&git, &git_dir, &parent_commit, &current_commit)?;
    let mut content = String::new();
    let mut included = 0usize;
    let mut truncated = false;

    for path in paths {
        let Some(text) = object_text(&git, &git_dir, &current_commit, &path) else { continue; };
        let block = format!("\n--- BEGIN CURRENT FILE {path} ---\n{text}\n--- END CURRENT FILE {path} ---\n");
        if content.len().saturating_add(block.len()) > MAX_SOURCE_CONTEXT_BYTES {
            let remaining = MAX_SOURCE_CONTEXT_BYTES.saturating_sub(content.len());
            if remaining > 96 {
                content.push_str(&block[..block.floor_char_boundary(remaining)]);
            }
            truncated = true;
            break;
        }
        content.push_str(&block);
        included += 1;
    }

    if truncated {
        content.push_str("\n…[Monument truncated Fresh Review source context at 180 KiB]\n");
    }

    Ok(ReviewSourceContext {
        content,
        files_included: included,
        truncated,
    })
}

#[tauri::command]
pub fn timeline_review_source_context(
    app: AppHandle,
    project_path: String,
    project_id: String,
    checkpoint_id: String,
    parent_checkpoint_id: String,
) -> Result<ReviewSourceContext, String> {
    source_context_internal(
        &app,
        &project_path,
        &project_id,
        &checkpoint_id,
        &parent_checkpoint_id,
    )
}

#[cfg(test)]
mod tests {
    use super::{secret_like_path, MAX_SOURCE_CONTEXT_BYTES, MAX_SOURCE_FILE_BYTES, MAX_SOURCE_FILES};

    #[test]
    fn review_source_context_is_strictly_bounded() {
        assert_eq!(MAX_SOURCE_CONTEXT_BYTES, 180 * 1024);
        assert_eq!(MAX_SOURCE_FILE_BYTES, 32 * 1024);
        assert_eq!(MAX_SOURCE_FILES, 80);
    }

    #[test]
    fn obvious_secret_files_never_enter_review_source_context() {
        for path in [".env", ".env.local", "cert.pem", "prod.key", "config/credentials.json", "ops/secrets.yml"] {
            assert!(secret_like_path(path), "{path}");
        }
        assert!(!secret_like_path("src/App.tsx"));
        assert!(!secret_like_path(".env.example"));
    }
}
