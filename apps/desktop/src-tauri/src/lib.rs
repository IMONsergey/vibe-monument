mod codex_runtime;
mod persistence;
mod process_runtime;
mod project_runtime;

use codex_runtime::{codex_protocol_probe, codex_send, codex_start, codex_status, codex_stop, CodexRuntime};
use persistence::{state_get, state_set};
use process_runtime::{runtime_start, runtime_status, runtime_stop, ProcessRuntime};
use project_runtime::{project_inspect, project_open};
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(CodexRuntime::default()))
        .manage(Mutex::new(ProcessRuntime::default()))
        .invoke_handler(tauri::generate_handler![
            codex_start,
            codex_send,
            codex_status,
            codex_stop,
            codex_protocol_probe,
            project_open,
            project_inspect,
            runtime_start,
            runtime_status,
            runtime_stop,
            state_get,
            state_set
        ])
        .run(tauri::generate_context!())
        .expect("error while running Monument");
}
