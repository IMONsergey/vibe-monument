use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

const MAX_SHIP_FILES: usize = 400;
const MAX_COMMIT_MESSAGE: usize = 180;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitShipPlan {
    branch: String,
    remote: Option<String>,
    changed_files: Vec<String>,
    staged_files: Vec<String>,
    can_commit: bool,
    reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitShipCommitResult {
    commit_sha: String,
    branch: String,
    changed_files: usize,
    remaining_files: Vec<String>,
}

fn canonical_project(project_path: &str) -> Result<PathBuf, String> {
    let root = PathBuf::from(project_path)
        .canonicalize()
        .map_err(|error| format!("Cannot open Git project: {error}"))?;
    if !root.is_dir() || !root.join(".git").exists() {
        return Err("Ship commit requires a local Git repository".into());
    }
    Ok(root)
}

fn git_output(root: &Path, args: &[&str]) -> Result<Output, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(root)
        .env("GIT_TERMINAL_PROMPT", "0")
        .output()
        .map_err(|error| format!("Could not start git {}: {error}", args.join(" ")))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            format!("git {} failed with {}", args.join(" "), output.status)
        } else {
            format!("git {} failed: {stderr}", args.join(" "))
        });
    }
    Ok(output)
}

fn git(root: &Path, args: &[&str]) -> Result<String, String> {
    Ok(String::from_utf8_lossy(&git_output(root, args)?.stdout).trim().to_string())
}

fn safe_status_path(value: &str) -> Option<String> {
    let normalized = value.replace('\\', "/");
    if normalized.is_empty() || normalized.starts_with('/') || normalized.split('/').any(|part| part == "..") {
        return None;
    }
    Some(normalized)
}

fn nul_paths(bytes: &[u8]) -> Vec<String> {
    bytes
        .split(|byte| *byte == 0)
        .filter(|chunk| !chunk.is_empty())
        .filter_map(|chunk| safe_status_path(&String::from_utf8_lossy(chunk)))
        .collect()
}

fn staged_paths(root: &Path) -> Result<Vec<String>, String> {
    let output = git_output(root, &["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR", "--"])?;
    let mut paths = nul_paths(&output.stdout);
    paths.sort();
    paths.dedup();
    paths.truncate(MAX_SHIP_FILES);
    Ok(paths)
}

fn changed_paths(root: &Path) -> Result<Vec<String>, String> {
    let tracked = git_output(root, &["diff", "HEAD", "--name-only", "-z", "--"])?;
    let untracked = git_output(root, &["ls-files", "--others", "--exclude-standard", "-z", "--"])?;
    let mut paths = nul_paths(&tracked.stdout);
    paths.extend(nul_paths(&untracked.stdout));
    paths.sort();
    paths.dedup();
    paths.truncate(MAX_SHIP_FILES);
    Ok(paths)
}

fn plan(root: &Path) -> Result<GitShipPlan, String> {
    let branch = git(root, &["branch", "--show-current"])?;
    let remote = git(root, &["remote", "get-url", "origin"]).ok().filter(|value| !value.is_empty());
    let changed_files = changed_paths(root)?;
    let staged_files = staged_paths(root)?;
    let reason = if branch.is_empty() {
        Some("Detached HEAD cannot be committed through Monument Ship yet.".to_string())
    } else if !staged_files.is_empty() {
        Some("Your Git index already contains staged changes. Monument refuses to mix them into a Ship commit; commit or unstage them first.".to_string())
    } else if changed_files.is_empty() {
        Some("There are no local Git changes to commit.".to_string())
    } else if changed_files.len() >= MAX_SHIP_FILES {
        Some(format!("Ship is limited to fewer than {MAX_SHIP_FILES} changed files in one commit."))
    } else {
        None
    };
    Ok(GitShipPlan {
        branch,
        remote,
        changed_files,
        staged_files,
        can_commit: reason.is_none(),
        reason,
    })
}

#[tauri::command]
pub fn git_ship_plan(project_path: String) -> Result<GitShipPlan, String> {
    let root = canonical_project(&project_path)?;
    plan(&root)
}

#[tauri::command]
pub fn git_ship_commit(project_path: String, message: String) -> Result<GitShipCommitResult, String> {
    let root = canonical_project(&project_path)?;
    let before = plan(&root)?;
    if !before.can_commit {
        return Err(before.reason.unwrap_or_else(|| "Ship commit is not available".into()));
    }
    let message = message.split_whitespace().collect::<Vec<_>>().join(" ");
    if message.len() < 3 {
        return Err("Add a short commit message before shipping.".into());
    }
    let message: String = message.chars().take(MAX_COMMIT_MESSAGE).collect();

    let mut add = Command::new("git");
    add.arg("add").arg("--");
    for path in &before.changed_files {
        add.arg(path);
    }
    let output = add
        .current_dir(&root)
        .env("GIT_TERMINAL_PROMPT", "0")
        .output()
        .map_err(|error| format!("Could not stage Ship files: {error}"))?;
    if !output.status.success() {
        return Err(format!("Could not stage Ship files: {}", String::from_utf8_lossy(&output.stderr).trim()));
    }

    let commit = Command::new("git")
        .args(["commit", "-m", &message])
        .current_dir(&root)
        .env("GIT_TERMINAL_PROMPT", "0")
        .output()
        .map_err(|error| format!("Could not create Ship commit: {error}"))?;
    if !commit.status.success() {
        let _ = Command::new("git").args(["reset", "--mixed", "HEAD"]).current_dir(&root).output();
        return Err(format!("Ship commit failed: {}", String::from_utf8_lossy(&commit.stderr).trim()));
    }

    let commit_sha = git(&root, &["rev-parse", "HEAD"])?;
    let remaining_files = changed_paths(&root).unwrap_or_default();
    Ok(GitShipCommitResult {
        commit_sha,
        branch: before.branch,
        changed_files: before.changed_files.len(),
        remaining_files,
    })
}

#[cfg(test)]
mod tests {
    use super::{nul_paths, safe_status_path, MAX_COMMIT_MESSAGE, MAX_SHIP_FILES};

    #[test]
    fn ship_paths_cannot_escape_repository() {
        assert_eq!(safe_status_path("src/App.tsx"), Some("src/App.tsx".into()));
        assert_eq!(safe_status_path("../outside"), None);
        assert_eq!(safe_status_path("/tmp/outside"), None);
    }

    #[test]
    fn nul_paths_support_spaces_and_unicode() {
        let paths = nul_paths("src/a file.ts\0src/Привет.tsx\0".as_bytes());
        assert_eq!(paths, vec!["src/a file.ts", "src/Привет.tsx"]);
    }

    #[test]
    fn ship_limits_are_bounded() {
        assert_eq!(MAX_SHIP_FILES, 400);
        assert_eq!(MAX_COMMIT_MESSAGE, 180);
    }
}
