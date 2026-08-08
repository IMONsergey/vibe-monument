mod browser_evidence;
mod codex_runtime;
mod git_ship;
mod jsx_source;
mod markup_transaction_v2;
mod persistence;
mod preview_editor_bridge;
mod preview_editor_script;
mod preview_runtime;
mod process_runtime;
mod project_runtime;
mod review_diff;
mod review_runtime_v2;
mod review_source;
mod source_locator;
mod source_transaction;
mod system_runtime;
mod timeline_cursor;
mod timeline_runtime;
mod timeline_secure;
mod token_scope;
mod token_transaction;
mod verification_runtime;

#[cfg(test)]
mod timeline_git_contract_tests;

use codex_runtime::{codex_protocol_probe, codex_send, codex_start, codex_status, codex_stop, CodexRuntime};
use git_ship::{git_ship_commit, git_ship_plan};
use markup_transaction_v2::{project_markup_edit_probe, project_markup_transaction_commit, project_markup_transaction_preview};
use persistence::{state_get, state_set};
use preview_editor_bridge::{preview_editor_emit, preview_editor_hover, preview_editor_request_tree, preview_editor_select, preview_editor_set_active, PreviewEditorBridgeRuntime};
use preview_runtime::{preview_clear_browser_evidence, preview_close, preview_collect_browser_evidence, preview_install_browser_evidence, preview_open, preview_reload, preview_set_bounds, preview_set_inspect};
use process_runtime::{runtime_start, runtime_status, runtime_stop, ProcessRuntime};
use project_runtime::{project_inspect, project_open};
use review_diff::timeline_review_packet;
use review_runtime_v2::review_run;
use review_source::timeline_review_source_context;
use source_locator::project_source_hints;
use source_transaction::{project_source_transaction_commit, project_source_transaction_preview};
use system_runtime::system_open_external;
use timeline_cursor::timeline_set_active_path;
use timeline_runtime::{timeline_diff, timeline_init, timeline_list, timeline_snapshot, timeline_status, TimelineRuntime};
use timeline_secure::{timeline_back_safe, timeline_forward_safe, timeline_restore_safe};
use token_scope::project_token_scope_inspect;
use token_transaction::{project_token_edit_probe, project_token_transaction_commit, project_token_transaction_preview};
use verification_runtime::{verification_plan, verification_run};
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(CodexRuntime::default()))
        .manage(Mutex::new(ProcessRuntime::default()))
        .manage(Mutex::new(TimelineRuntime::default()))
        .manage(Mutex::new(PreviewEditorBridgeRuntime::default()))
        .invoke_handler(tauri::generate_handler![
            codex_start,
            codex_send,
            codex_status,
            codex_stop,
            codex_protocol_probe,
            project_open,
            project_inspect,
            project_source_hints,
            project_source_transaction_preview,
            project_source_transaction_commit,
            project_token_scope_inspect,
            project_token_edit_probe,
            project_token_transaction_preview,
            project_token_transaction_commit,
            project_markup_edit_probe,
            project_markup_transaction_preview,
            project_markup_transaction_commit,
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
            preview_editor_emit,
            preview_editor_set_active,
            preview_editor_request_tree,
            preview_editor_select,
            preview_editor_hover,
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
