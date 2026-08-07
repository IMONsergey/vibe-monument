mod codex_runtime;
mod persistence;
mod project_runtime;

use codex_runtime::{codex_send, codex_start, codex_status, codex_stop, CodexRuntime};
use persistence::{state_get, state_set};
use project_runtime::{project_inspect, project_open};
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(CodexRuntime::default()))
        .invoke_handler(tauri::generate_handler![
            codex_start,
            codex_send,
            codex_status,
            codex_stop,
            project_open,
            project_inspect,
            state_get,
            state_set
        ])
        .run(tauri::generate_context!())
        .expect("error while running Monument");
}
