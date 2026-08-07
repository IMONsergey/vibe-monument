mod browser_evidence;
mod codex_runtime;
mod persistence;
mod preview_runtime;
mod process_runtime;
mod project_runtime;
mod source_locator;
mod system_runtime;
mod verification_runtime;

use codex_runtime::{codex_protocol_probe, codex_send, codex_start, codex_status, codex_stop, CodexRuntime};
use persistence::{state_get, state_set};
use preview_runtime::{preview_clear_browser_evidence, preview_close, preview_collect_browser_evidence, preview_install_browser_evidence, preview_open, preview_reload, preview_set_bounds, preview_set_inspect};
use process_runtime::{runtime_start, runtime_status, runtime_stop, ProcessRuntime};
use project_runtime::{project_inspect, project_open};
use source_locator::project_source_hints;
use system_runtime::system_open_external;
use verification_runtime::{verification_plan, verification_run};
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
            project_source_hints,
            runtime_start,
            runtime_status,
            runtime_stop,
            preview_open,
            preview_set_bounds,
            preview_set_inspect,
            preview_install_browser_evidence,
            preview_collect_browser_evidence,
            preview_clear_browser_evidence,
            preview_reload,
            preview_close,
            verification_plan,
            verification_run,
            system_open_external,
            state_get,
            state_set
        ])
        .run(tauri::generate_context!())
        .expect("error while running Monument");
}
