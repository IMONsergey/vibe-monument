use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

#[derive(Default)]
pub struct CodexRuntime {
    process: Option<ManagedCodex>,
}

struct ManagedCodex {
    child: Child,
    stdin: ChildStdin,
    command: String,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexStartOptions {
    codex_path: Option<String>,
    codex_home: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexRuntimeInfo {
    running: bool,
    command: String,
    pid: Option<u32>,
}

fn live_info(managed: &mut ManagedCodex) -> Result<CodexRuntimeInfo, String> {
    let running = managed.child.try_wait().map_err(|error| error.to_string())?.is_none();
    Ok(CodexRuntimeInfo {
        running,
        command: managed.command.clone(),
        pid: running.then_some(managed.child.id()),
    })
}

#[tauri::command]
pub fn codex_start(
    app: AppHandle,
    state: State<'_, Mutex<CodexRuntime>>,
    options: Option<CodexStartOptions>,
) -> Result<CodexRuntimeInfo, String> {
    let mut runtime = state.lock().map_err(|_| "Codex runtime lock poisoned".to_string())?;
    if let Some(managed) = runtime.process.as_mut() {
        let info = live_info(managed)?;
        if info.running {
            return Ok(info);
        }
        runtime.process = None;
    }

    let options = options.unwrap_or_default();
    let command_name = options
        .codex_path
        .or_else(|| std::env::var("MONUMENT_CODEX_PATH").ok())
        .unwrap_or_else(|| "codex".to_string());

    let mut command = Command::new(&command_name);
    command
        .args(["app-server", "--stdio"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(codex_home) = options.codex_home {
        command.env("CODEX_HOME", codex_home);
    }

    let mut child = command.spawn().map_err(|error| format!("Failed to start Codex: {error}"))?;
    let stdin = child.stdin.take().ok_or_else(|| "Codex stdin unavailable".to_string())?;
    let stdout = child.stdout.take().ok_or_else(|| "Codex stdout unavailable".to_string())?;
    let stderr = child.stderr.take().ok_or_else(|| "Codex stderr unavailable".to_string())?;

    let message_app = app.clone();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if line.trim().is_empty() {
                continue;
            }
            match serde_json::from_str::<Value>(&line) {
                Ok(message) => {
                    let _ = message_app.emit("monument://codex-message", message);
                }
                Err(error) => {
                    let _ = message_app.emit(
                        "monument://codex-stderr",
                        format!("Invalid JSON from Codex app-server: {error}"),
                    );
                }
            }
        }
    });

    let stderr_app = app;
    std::thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            let _ = stderr_app.emit("monument://codex-stderr", line);
        }
    });

    let pid = child.id();
    runtime.process = Some(ManagedCodex {
        child,
        stdin,
        command: command_name.clone(),
    });

    Ok(CodexRuntimeInfo {
        running: true,
        command: command_name,
        pid: Some(pid),
    })
}

#[tauri::command]
pub fn codex_send(
    state: State<'_, Mutex<CodexRuntime>>,
    message: Value,
) -> Result<(), String> {
    let mut runtime = state.lock().map_err(|_| "Codex runtime lock poisoned".to_string())?;
    let managed = runtime.process.as_mut().ok_or_else(|| "Codex is not running".to_string())?;
    let mut payload = serde_json::to_vec(&message).map_err(|error| error.to_string())?;
    payload.push(b'\n');
    managed.stdin.write_all(&payload).map_err(|error| error.to_string())?;
    managed.stdin.flush().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn codex_status(
    state: State<'_, Mutex<CodexRuntime>>,
) -> Result<CodexRuntimeInfo, String> {
    let mut runtime = state.lock().map_err(|_| "Codex runtime lock poisoned".to_string())?;
    match runtime.process.as_mut() {
        Some(managed) => live_info(managed),
        None => Ok(CodexRuntimeInfo {
            running: false,
            command: "codex".to_string(),
            pid: None,
        }),
    }
}

#[tauri::command]
pub fn codex_stop(state: State<'_, Mutex<CodexRuntime>>) -> Result<(), String> {
    let mut runtime = state.lock().map_err(|_| "Codex runtime lock poisoned".to_string())?;
    if let Some(mut managed) = runtime.process.take() {
        let _ = managed.child.kill();
        let _ = managed.child.wait();
    }
    Ok(())
}
