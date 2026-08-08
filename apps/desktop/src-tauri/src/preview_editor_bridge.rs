use crate::preview_runtime::{PreviewSelection, PREVIEW_LABEL};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State, Webview};

const EDITOR_EVENT: &str = "monument://preview-editor";
const MAX_TREE_BYTES: usize = 384 * 1024;
const MAX_SELECTION_BYTES: usize = 64 * 1024;
const MAX_CONTENT_BYTES: usize = 8 * 1024;
const MAX_HOVER_BYTES: usize = 4 * 1024;
const MAX_READY_BYTES: usize = 2 * 1024;
const MAX_MESSAGES_PER_SECOND: u32 = 180;
const MAX_DOM_ID_BYTES: usize = 180;

#[derive(Debug)]
pub struct PreviewEditorBridgeRuntime {
    window_started: Instant,
    messages: u32,
}

impl Default for PreviewEditorBridgeRuntime {
    fn default() -> Self {
        Self { window_started: Instant::now(), messages: 0 }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewEditorMessage {
    kind: String,
    payload: Value,
}

impl PreviewEditorMessage {
    fn byte_limit(&self) -> Result<usize, String> {
        match self.kind.as_str() {
            "tree" => Ok(MAX_TREE_BYTES),
            "selection" => Ok(MAX_SELECTION_BYTES),
            "content" => Ok(MAX_CONTENT_BYTES),
            "hover" => Ok(MAX_HOVER_BYTES),
            "ready" => Ok(MAX_READY_BYTES),
            other => Err(format!("Unsupported preview editor message kind: {other}")),
        }
    }

    fn validate(&self) -> Result<(), String> {
        let limit = self.byte_limit()?;
        let encoded = serde_json::to_vec(&self.payload).map_err(|error| error.to_string())?;
        if encoded.len() > limit {
            return Err(format!("Preview editor {} payload exceeded the {} byte boundary", self.kind, limit));
        }
        Ok(())
    }
}

fn allow_message(runtime: &mut PreviewEditorBridgeRuntime) -> Result<(), String> {
    let now = Instant::now();
    if now.duration_since(runtime.window_started) >= Duration::from_secs(1) {
        runtime.window_started = now;
        runtime.messages = 0;
    }
    if runtime.messages >= MAX_MESSAGES_PER_SECOND {
        return Err("Preview editor bridge rate limit exceeded".into());
    }
    runtime.messages += 1;
    Ok(())
}

fn valid_node_id(value: &str) -> bool {
    let Some(number) = value.strip_prefix("m-") else { return false; };
    !number.is_empty() && number.len() <= 12 && number.bytes().all(|byte| byte.is_ascii_digit())
}

fn valid_dom_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= MAX_DOM_ID_BYTES
        && !value.chars().any(|ch| ch.is_control())
}

fn editor_eval(app: &AppHandle, expression: String) -> Result<(), String> {
    let webview = app.get_webview(PREVIEW_LABEL).ok_or_else(|| "Preview webview is not open".to_string())?;
    webview.eval(expression).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn preview_editor_emit(
    webview: Webview,
    app: AppHandle,
    state: State<'_, Mutex<PreviewEditorBridgeRuntime>>,
    message: PreviewEditorMessage,
) -> Result<(), String> {
    if webview.label() != PREVIEW_LABEL {
        return Err("Preview editor bridge is restricted to the live preview webview".into());
    }
    message.validate()?;
    {
        let mut runtime = state.lock().map_err(|_| "Preview editor bridge lock poisoned".to_string())?;
        allow_message(&mut runtime)?;
    }

    if message.kind == "selection" {
        let selection = serde_json::from_value::<PreviewSelection>(message.payload.clone())
            .map_err(|error| format!("Invalid preview editor selection: {error}"))?;
        app.emit("monument://preview-selection", selection).map_err(|error| error.to_string())?;
    }

    app.emit(EDITOR_EVENT, message).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn preview_editor_set_active(app: AppHandle, enabled: bool) -> Result<(), String> {
    editor_eval(&app, format!("window.__MONUMENT_EDITOR__ && window.__MONUMENT_EDITOR__.setActive({enabled});"))
}

#[tauri::command]
pub fn preview_editor_request_tree(app: AppHandle) -> Result<(), String> {
    editor_eval(&app, "window.__MONUMENT_EDITOR__ && window.__MONUMENT_EDITOR__.requestTree();".into())
}

#[tauri::command]
pub fn preview_editor_request_content(app: AppHandle, dom_id: String) -> Result<(), String> {
    if !valid_dom_id(&dom_id) {
        return Err("Invalid preview content DOM id".into());
    }
    let encoded = serde_json::to_string(&dom_id).map_err(|error| error.to_string())?;
    let script = format!(r#"(() => {{
      const id = {encoded};
      const element = document.getElementById(id);
      if (!(element instanceof Element)) return;
      let unique = false;
      try {{ unique = document.querySelectorAll(`#${{CSS && CSS.escape ? CSS.escape(id) : id}}`).length === 1; }} catch (_) {{ unique = false; }}
      if (!unique) return;
      const clip = (value) => typeof value === 'string' ? value.slice(0, 800) : '';
      const attributes = {{
        ariaLabel: clip(element.getAttribute('aria-label') || ''),
        title: clip(element.getAttribute('title') || ''),
        alt: clip(element.getAttribute('alt') || ''),
        placeholder: clip(element.getAttribute('placeholder') || ''),
      }};
      const invoke = window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke;
      if (typeof invoke !== 'function') return;
      invoke('preview_editor_emit', {{ message: {{ kind: 'content', payload: {{ domId: id, attributes }} }} }}).catch(() => {{}});
    }})()"#);
    editor_eval(&app, script)
}

#[tauri::command]
pub fn preview_editor_select(app: AppHandle, node_id: String) -> Result<(), String> {
    if !valid_node_id(&node_id) {
        return Err("Invalid preview editor node id".into());
    }
    let encoded = serde_json::to_string(&node_id).map_err(|error| error.to_string())?;
    editor_eval(&app, format!("window.__MONUMENT_EDITOR__ && window.__MONUMENT_EDITOR__.select({encoded});"))
}

#[tauri::command]
pub fn preview_editor_hover(app: AppHandle, node_id: Option<String>) -> Result<(), String> {
    if let Some(value) = node_id.as_deref() {
        if !valid_node_id(value) {
            return Err("Invalid preview editor node id".into());
        }
    }
    let encoded = serde_json::to_string(&node_id).map_err(|error| error.to_string())?;
    editor_eval(&app, format!("window.__MONUMENT_EDITOR__ && window.__MONUMENT_EDITOR__.hover({encoded});"))
}

#[cfg(test)]
mod tests {
    use super::{valid_dom_id, valid_node_id, PreviewEditorMessage, MAX_CONTENT_BYTES, MAX_TREE_BYTES};
    use serde_json::json;

    #[test]
    fn editor_node_ids_are_bounded() {
        assert!(valid_node_id("m-1"));
        assert!(valid_node_id("m-123456789012"));
        assert!(!valid_node_id("m-"));
        assert!(!valid_node_id("../m-1"));
        assert!(!valid_node_id("m-abc"));
    }

    #[test]
    fn content_dom_ids_are_data_only_and_bounded() {
        assert!(valid_dom_id("hero-card"));
        assert!(valid_dom_id("юникод-id"));
        assert!(!valid_dom_id(""));
        assert!(!valid_dom_id("bad\nvalue"));
        assert!(!valid_dom_id(&"x".repeat(181)));
    }

    #[test]
    fn editor_bridge_payloads_are_bounded() {
        let valid = PreviewEditorMessage { kind: "tree".into(), payload: json!({"nodes": []}) };
        assert!(valid.validate().is_ok());
        let content = PreviewEditorMessage { kind: "content".into(), payload: json!({"domId":"hero","attributes":{"title":"A"}}) };
        assert!(content.validate().is_ok());
        let oversized = PreviewEditorMessage {
            kind: "tree".into(), payload: json!({"blob": "x".repeat(MAX_TREE_BYTES + 1)}),
        };
        assert!(oversized.validate().is_err());
        let oversized_content = PreviewEditorMessage {
            kind: "content".into(), payload: json!({"blob": "x".repeat(MAX_CONTENT_BYTES + 1)}),
        };
        assert!(oversized_content.validate().is_err());
        let unsupported = PreviewEditorMessage { kind: "command".into(), payload: json!({}) };
        assert!(unsupported.validate().is_err());
    }
}
