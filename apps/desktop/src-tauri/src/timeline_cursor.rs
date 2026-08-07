use crate::persistence;
use rusqlite::{params, OptionalExtension};
use tauri::AppHandle;

fn valid_identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 160
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

#[tauri::command]
pub fn timeline_set_active_path(
    app: AppHandle,
    project_id: String,
    path_id: String,
) -> Result<(), String> {
    if !valid_identifier(&project_id) || !valid_identifier(&path_id) {
        return Err("Invalid Monument timeline path identifier".into());
    }
    let connection = persistence::connection(&app)?;
    let exists: Option<i64> = connection
        .query_row(
            "SELECT 1 FROM timeline_checkpoints WHERE project_id = ?1 AND path_id = ?2 LIMIT 1",
            params![project_id, path_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    if exists.is_none() {
        return Err("Timeline history path was not found".into());
    }
    let changed = connection
        .execute(
            "UPDATE timeline_projects SET active_path_id = ?2, updated_at = unixepoch() WHERE project_id = ?1",
            params![project_id, path_id],
        )
        .map_err(|error| error.to_string())?;
    if changed == 0 {
        return Err("Timeline project was not initialized".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::valid_identifier;

    #[test]
    fn navigation_ids_remain_path_safe() {
        assert!(valid_identifier("project-abc123"));
        assert!(valid_identifier("path-123_456"));
        assert!(!valid_identifier("../escape"));
        assert!(!valid_identifier("path/child"));
    }
}
