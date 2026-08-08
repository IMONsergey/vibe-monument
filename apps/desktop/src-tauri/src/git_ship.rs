use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;

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

fn git(root: &Path, args: &[&str]) -> Result<String, String> {
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
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn safe_status_path(value: &str) -> Option<String> {
    let normalized = value.replace('\\', "/");
    if normalized.is_empty() || normalized.starts_with('/') || normalized.split('/').any(|part| part == "..") {
        return None;
    }
    Some(normalized)
}

fn porcelain_paths(root: &Path, cached: bool) -> Result<Vec<String>, String> {
    let args = if cached {
        vec!["diff", "--cached", "--name-only", "--diff-filter=ACMR"]
    } else {
        vec!["status", "--porcelain=v1", "--untracked-files=all"]
    };
    let output = git(root, &args)?;
    let mut paths = Vec::new();
    if cached {
        for line in output.lines() {
            if let Some(path) = safe_status_path(line.trim()) {
                paths.push(path);
            }
        }
    } else {
        for line in output.lines() {
            if line.len() < 4 { continue; }
            let raw = line[3..].trim();
            let raw = raw.rsplit(" -> ").next().unwrap_or(raw);
            if let Some(path) = safe_status_path(raw.trim_matches('"')) {
                paths.push(path);
            }
        }
    }
    paths.sort();
    paths.dedup();
    paths.truncate(MAX_SHIP_FILES);
    Ok(paths)
}

fn plan(root: &Path) -> Result<GitShipPlan, String> {
    let branch = git(root, &["branch", "--show-current"])?;
    let remote = git(root, &["remote", "get-url", "origin"]).ok().filter(|value| !value.is_empty());
    let changed_files = porcelain_paths(root, false)?;
    let staged_files = porcelain_paths(root, true)?;
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

    // The index must be clean by plan() precondition. Stage exactly the paths that
    // were shown to the user; never stage ignored files or arbitrary repository paths.
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

    // Respect repository commit hooks. Ship is not allowed to bypass a project's
    // own commit policy just because the Monument evidence gate is green.
    let commit = Command::new("git")
        .args(["commit", "-m", &message])
        .current_dir(&root)
        .env("GIT_TERMINAL_PROMPT", "0")
        .output()
        .map_err(|error| format!("Could not create Ship commit: {error}"))?;
    if !commit.status.success() {
        // plan() guaranteed a clean index before staging, so this restores that
        // exact pre-Ship index state while leaving working-tree changes intact.
        let _ = Command::new("git").args(["reset", "--mixed", "HEAD"]).current_dir(&root).output();
        return Err(format!("Ship commit failed: {}", String::from_utf8_lossy(&commit.stderr).trim()));
    }

    let commit_sha = git(&root, &["rev-parse", "HEAD"])?;
    Ok(GitShipCommitResult {
        commit_sha,
        branch: before.branch,
        changed_files: before.changed_files.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::{safe_status_path, MAX_COMMIT_MESSAGE, MAX_SHIP_FILES};

    #[test]
    fn ship_paths_cannot_escape_repository() {
        assert_eq!(safe_status_path("src/App.tsx"), Some("src/App.tsx".into()));
        assert_eq!(safe_status_path("../outside"), None);
        assert_eq!(safe_status_path("/tmp/outside"), None);
    }

    #[test]
    fn ship_limits_are_bounded() {
        assert_eq!(MAX_SHIP_FILES, 400);
        assert_eq!(MAX_COMMIT_MESSAGE, 180);
    }
}
