mod browser_evidence;
mod codex_runtime;
mod git_ship;
mod persistence;
mod preview_runtime;
mod process_runtime;
mod project_runtime;
mod review_diff;
mod review_runtime_v2;
mod review_source;
mod source_locator;
mod system_runtime;
mod timeline_cursor;
mod timeline_runtime;
mod timeline_secure;
mod verification_runtime;

#[cfg(test)]
mod timeline_git_contract_tests;

use codex_runtime::{codex_protocol_probe, codex_send, codex_start, codex_status, codex_stop, CodexRuntime};
use git_ship::{git_ship_commit, git_ship_plan};
use persistence::{state_get, state_set};
use preview_runtime::{preview_clear_browser_evidence, preview_close, preview_collect_browser_evidence, preview_install_browser_evidence, preview_open, preview_reload, preview_set_bounds, preview_set_inspect};
use process_runtime::{runtime_start, runtime_status, runtime_stop, ProcessRuntime};
use project_runtime::{project_inspect, project_open};
use review_diff::timeline_review_packet;
use review_runtime_v2::review_run;
use review_source::timeline_review_source_context;
use source_locator::project_source_hints;
use system_runtime::system_open_external;
use timeline_cursor::timeline_set_active_path;
use timeline_runtime::{timeline_diff, timeline_init, timeline_list, timeline_snapshot, timeline_status, TimelineRuntime};
use timeline_secure::{timeline_back_safe, timeline_forward_safe, timeline_restore_safe};
use verification_runtime::{verification_plan, verification_run};
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(CodexRuntime::default()))
        .manage(Mutex::new(ProcessRuntime::default()))
        .manage(Mutex::new(TimelineRuntime::default()))
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
            timeline_init,
            timeline_snapshot,
            timeline_list,
            timeline_status,
            timeline_restore_safe,
            timeline_back_safe,
            timeline_forward_safe,
            timeline_diff,
            timeline_review_packet,
            timeline_review_source_context,
            timeline_set_active_path,
            review_run,
            git_ship_plan,
            git_ship_commit,
            system_open_external,
            state_get,
            state_set
        ])
        .run(tauri::generate_context!())
        .expect("error while running Monument");
}
