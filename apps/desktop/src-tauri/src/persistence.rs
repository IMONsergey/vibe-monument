use rusqlite::{params, Connection};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

pub(crate) fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app.path().app_data_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory.join("monument.sqlite"))
}

pub(crate) fn connection(app: &AppHandle) -> Result<Connection, String> {
    let conn = Connection::open(database_path(app)?).map_err(|error| error.to_string())?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS app_state (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );",
    )
    .map_err(|error| error.to_string())?;
    Ok(conn)
}

#[tauri::command]
pub fn state_get(app: AppHandle, key: String) -> Result<Option<Value>, String> {
    let conn = connection(&app)?;
    let mut statement = conn
        .prepare("SELECT value FROM app_state WHERE key = ?1")
        .map_err(|error| error.to_string())?;
    let mut rows = statement.query(params![key]).map_err(|error| error.to_string())?;
    let Some(row) = rows.next().map_err(|error| error.to_string())? else { return Ok(None); };
    let value: String = row.get(0).map_err(|error| error.to_string())?;
    serde_json::from_str(&value).map(Some).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn state_set(app: AppHandle, key: String, value: Value) -> Result<(), String> {
    let conn = connection(&app)?;
    let encoded = serde_json::to_string(&value).map_err(|error| error.to_string())?;
    conn.execute(
        "INSERT INTO app_state(key, value, updated_at) VALUES (?1, ?2, unixepoch())
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()",
        params![&key, encoded],
    )
    .map_err(|error| error.to_string())?;
    let _ = app.emit("monument://state-changed", key);
    Ok(())
}