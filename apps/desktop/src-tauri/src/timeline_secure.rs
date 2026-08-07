use crate::persistence;
use crate::timeline_runtime::{
    timeline_back, timeline_forward, timeline_restore, TimelineRestoreResult, TimelineRuntime,
};
use rusqlite::{params, OptionalExtension};
use std::collections::BTreeSet;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

fn valid_identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 160
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

fn canonical_project(project_path: &str) -> Result<PathBuf, String> {
    let root = PathBuf::from(project_path)
        .canonicalize()
        .map_err(|error| format!("Cannot open Timeline project: {error}"))?;
    if !root.is_dir() {
        return Err("Timeline project root is not a directory".into());
    }
    Ok(root)
}

fn shadow_git_dir(app: &AppHandle, project_id: &str) -> Result<PathBuf, String> {
    if !valid_identifier(project_id) {
        return Err("Invalid Monument Timeline project id".into());
    }
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("timelines")
        .join(project_id)
        .join("repo.git"))
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

fn validate_relative(value: &str) -> Result<(), String> {
    let path = Path::new(value);
    if path.is_absolute()
        || path.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err("Unsafe file path in Monument Timeline".into());
    }
    Ok(())
}

fn checkpoint_commit(
    app: &AppHandle,
    project_id: &str,
    checkpoint_id: &str,
) -> Result<String, String> {
    if !valid_identifier(project_id) || !valid_identifier(checkpoint_id) {
        return Err("Invalid Monument Timeline checkpoint id".into());
    }
    let connection = persistence::connection(app)?;
    connection
        .query_row(
            "SELECT commit_sha FROM timeline_checkpoints WHERE project_id = ?1 AND id = ?2",
            params![project_id, checkpoint_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "Timeline checkpoint was not found".to_string())
}

fn checkpoint_paths(
    app: &AppHandle,
    project_id: &str,
    checkpoint_id: &str,
) -> Result<Vec<String>, String> {
    let commit = checkpoint_commit(app, project_id, checkpoint_id)?;
    let git_dir = shadow_git_dir(app, project_id)?;
    let git = resolve_git()?;
    let output = Command::new(git)
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .arg(format!("--git-dir={}", git_dir.to_string_lossy()))
        .args(["ls-tree", "-r", "-z", "--name-only", &commit])
        .output()
        .map_err(|error| format!("Cannot inspect Timeline restore tree: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "Cannot inspect Timeline restore tree: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    output
        .stdout
        .split(|byte| *byte == 0)
        .filter(|value| !value.is_empty())
        .map(|raw| {
            let value = String::from_utf8(raw.to_vec())
                .map_err(|_| "Timeline contains a non-UTF-8 file name".to_string())?;
            validate_relative(&value)?;
            Ok(value)
        })
        .collect()
}

fn ensure_no_symlink_escape(project_root: &Path, relative: &str) -> Result<(), String> {
    validate_relative(relative)?;
    let components = Path::new(relative)
        .components()
        .map(|component| match component {
            Component::Normal(segment) => Ok(segment.to_os_string()),
            _ => Err("Unsafe Timeline restore path".to_string()),
        })
        .collect::<Result<Vec<_>, _>>()?;

    // The final component may itself be a managed symlink and can be safely unlinked/replaced.
    // Only ancestor symlinks can redirect a restore/delete operation outside the project root.
    let mut current = project_root.to_path_buf();
    for segment in components.iter().take(components.len().saturating_sub(1)) {
        current.push(segment);
        match fs::symlink_metadata(&current) {
            Ok(metadata) if metadata.file_type().is_symlink() => {
                return Err(format!(
                    "Restore blocked because a managed path crosses a symlink: {relative}"
                ));
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => {
                return Err(format!("Cannot inspect restore path {relative}: {error}"));
            }
        }
    }
    Ok(())
}

fn current_checkpoint(app: &AppHandle, project_id: &str) -> Result<String, String> {
    let connection = persistence::connection(app)?;
    connection
        .query_row(
            "SELECT current_checkpoint_id FROM timeline_projects WHERE project_id = ?1",
            params![project_id],
            |row| row.get::<_, Option<String>>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?
        .flatten()
        .ok_or_else(|| "Timeline project was not initialized".to_string())
}

fn preflight(
    app: &AppHandle,
    project_path: &str,
    project_id: &str,
    checkpoint_id: &str,
) -> Result<(), String> {
    let root = canonical_project(project_path)?;
    let current_id = current_checkpoint(app, project_id)?;
    let mut paths = BTreeSet::new();
    paths.extend(checkpoint_paths(app, project_id, &current_id)?);
    paths.extend(checkpoint_paths(app, project_id, checkpoint_id)?);
    for relative in paths {
        ensure_no_symlink_escape(&root, &relative)?;
    }
    Ok(())
}

fn parent_checkpoint(app: &AppHandle, project_id: &str) -> Result<String, String> {
    let current = current_checkpoint(app, project_id)?;
    let connection = persistence::connection(app)?;
    connection
        .query_row(
            "SELECT parent_id FROM timeline_checkpoints WHERE project_id = ?1 AND id = ?2",
            params![project_id, current],
            |row| row.get::<_, Option<String>>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?
        .flatten()
        .ok_or_else(|| "Already at the first Monument version".to_string())
}

fn forward_checkpoint(app: &AppHandle, project_id: &str) -> Result<String, String> {
    let connection = persistence::connection(app)?;
    let (current, path): (Option<String>, Option<String>) = connection
        .query_row(
            "SELECT current_checkpoint_id, active_path_id FROM timeline_projects WHERE project_id = ?1",
            params![project_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "Timeline project was not initialized".to_string())?;
    let current = current.ok_or_else(|| "Timeline current checkpoint is missing".to_string())?;
    let path = path.ok_or_else(|| "Timeline active history path is missing".to_string())?;
    connection
        .query_row(
            "SELECT id FROM timeline_checkpoints
             WHERE project_id = ?1 AND parent_id = ?2 AND path_id = ?3
             ORDER BY sequence ASC LIMIT 1",
            params![project_id, current, path],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "Already at the latest version on this history path".to_string())
}

#[tauri::command]
pub fn timeline_restore_safe(
    app: AppHandle,
    state: State<'_, Mutex<TimelineRuntime>>,
    project_path: String,
    project_id: String,
    checkpoint_id: String,
) -> Result<TimelineRestoreResult, String> {
    preflight(&app, &project_path, &project_id, &checkpoint_id)?;
    timeline_restore(app, state, project_path, project_id, checkpoint_id)
}

#[tauri::command]
pub fn timeline_back_safe(
    app: AppHandle,
    state: State<'_, Mutex<TimelineRuntime>>,
    project_path: String,
    project_id: String,
) -> Result<TimelineRestoreResult, String> {
    let target = parent_checkpoint(&app, &project_id)?;
    preflight(&app, &project_path, &project_id, &target)?;
    timeline_back(app, state, project_path, project_id)
}

#[tauri::command]
pub fn timeline_forward_safe(
    app: AppHandle,
    state: State<'_, Mutex<TimelineRuntime>>,
    project_path: String,
    project_id: String,
) -> Result<TimelineRestoreResult, String> {
    let target = forward_checkpoint(&app, &project_id)?;
    preflight(&app, &project_path, &project_id, &target)?;
    timeline_forward(app, state, project_path, project_id)
}

#[cfg(test)]
mod tests {
    use super::{ensure_no_symlink_escape, validate_relative};
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_root() -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("monument-timeline-symlink-{}-{stamp}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        root
    }

    #[test]
    fn relative_path_validation_rejects_escape() {
        assert!(validate_relative("src/app.tsx").is_ok());
        assert!(validate_relative("../outside").is_err());
        assert!(validate_relative("/absolute").is_err());
    }

    #[cfg(unix)]
    #[test]
    fn restore_preflight_rejects_symlink_ancestors_but_not_final_managed_symlink() {
        use std::os::unix::fs::symlink;
        let root = temp_root();
        let outside = root.join("outside");
        let project = root.join("project");
        fs::create_dir_all(&outside).unwrap();
        fs::create_dir_all(&project).unwrap();

        symlink(&outside, project.join("src")).unwrap();
        assert!(ensure_no_symlink_escape(&project, "src/app.tsx").is_err());
        assert!(!outside.join("app.tsx").exists());

        fs::remove_file(project.join("src")).unwrap();
        symlink(&outside, project.join("linked-source")).unwrap();
        assert!(ensure_no_symlink_escape(&project, "linked-source").is_ok());
        let _ = fs::remove_dir_all(root);
    }
}
