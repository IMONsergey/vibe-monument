use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Default)]
pub struct CodexRuntime {
    process: Option<ManagedCodex>,
}

struct ManagedCodex {
    child: Child,
    stdin: ChildStdin,
    command: String,
    version: Option<String>,
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
    version: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexProtocolProbe {
    command: String,
    version: Option<String>,
    schema_supported: bool,
    generated_files: usize,
    schema_directory: Option<String>,
    error: Option<String>,
}

fn live_info(managed: &mut ManagedCodex) -> Result<CodexRuntimeInfo, String> {
    let running = managed.child.try_wait().map_err(|error| error.to_string())?.is_none();
    Ok(CodexRuntimeInfo {
        running,
        command: managed.command.clone(),
        pid: running.then_some(managed.child.id()),
        version: managed.version.clone(),
    })
}

fn first_existing(paths: impl IntoIterator<Item = PathBuf>) -> Option<String> {
    paths
        .into_iter()
        .find(|path| path.is_file())
        .map(|path| path.to_string_lossy().to_string())
}

fn resolve_codex_command(explicit: Option<String>) -> Result<String, String> {
    if let Some(path) = explicit.filter(|value| !value.trim().is_empty()) {
        return Ok(path);
    }
    if let Ok(path) = std::env::var("MONUMENT_CODEX_PATH") {
        if !path.trim().is_empty() {
            return Ok(path);
        }
    }

    let mut candidates = Vec::new();
    if let Some(path) = std::env::var_os("PATH") {
        candidates.extend(std::env::split_paths(&path).map(|dir| dir.join("codex")));
    }

    candidates.extend([
        PathBuf::from("/usr/local/bin/codex"),
        PathBuf::from("/opt/homebrew/bin/codex"),
        PathBuf::from("/usr/bin/codex"),
    ]);

    if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
        candidates.extend([
            home.join(".local/bin/codex"),
            home.join(".cargo/bin/codex"),
            home.join(".volta/bin/codex"),
            home.join(".npm-global/bin/codex"),
            home.join(".bun/bin/codex"),
        ]);
    }

    first_existing(candidates).ok_or_else(|| {
        "Codex CLI was not found. Install Codex or set MONUMENT_CODEX_PATH. Monument checked the current PATH plus /usr/local/bin, /opt/homebrew/bin and common user-local install locations.".to_string()
    })
}

fn codex_version(command: &str) -> Option<String> {
    let output = Command::new(command).arg("--version").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    (!value.is_empty()).then_some(value)
}

fn count_files(path: &Path) -> usize {
    let Ok(entries) = fs::read_dir(path) else { return 0; };
    entries
        .filter_map(Result::ok)
        .map(|entry| {
            let path = entry.path();
            if path.is_dir() { count_files(&path) } else { 1 }
        })
        .sum()
}

#[tauri::command]
pub fn codex_protocol_probe(app: AppHandle) -> Result<CodexProtocolProbe, String> {
    let command = resolve_codex_command(None)?;
    let version = codex_version(&command);
    let cache = app.path().app_cache_dir().map_err(|error| error.to_string())?;
    let schema_directory = cache.join("codex-protocol").join("stable");
    if schema_directory.exists() {
        fs::remove_dir_all(&schema_directory).map_err(|error| error.to_string())?;
    }
    fs::create_dir_all(&schema_directory).map_err(|error| error.to_string())?;

    let output = Command::new(&command)
        .args(["app-server", "generate-json-schema", "--out"])
        .arg(&schema_directory)
        .output();

    match output {
        Ok(output) if output.status.success() => Ok(CodexProtocolProbe {
            command,
            version,
            schema_supported: true,
            generated_files: count_files(&schema_directory),
            schema_directory: Some(schema_directory.to_string_lossy().to_string()),
            error: None,
        }),
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            Ok(CodexProtocolProbe {
                command,
                version,
                schema_supported: false,
                generated_files: 0,
                schema_directory: None,
                error: Some(if stderr.is_empty() { "Codex schema generation failed".into() } else { stderr }),
            })
        }
        Err(error) => Ok(CodexProtocolProbe {
            command,
            version,
            schema_supported: false,
            generated_files: 0,
            schema_directory: None,
            error: Some(error.to_string()),
        }),
    }
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
    let command_name = resolve_codex_command(options.codex_path)?;
    let version = codex_version(&command_name);

    let mut command = Command::new(&command_name);
    command
        .args(["app-server", "--stdio"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(codex_home) = options.codex_home {
        command.env("CODEX_HOME", codex_home);
    }

    let mut child = command.spawn().map_err(|error| format!("Failed to start Codex at {command_name}: {error}"))?;
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
        version: version.clone(),
    });

    Ok(CodexRuntimeInfo {
        running: true,
        command: command_name,
        pid: Some(pid),
        version,
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
        None => {
            let command = resolve_codex_command(None).unwrap_or_else(|_| "codex".to_string());
            let version = codex_version(&command);
            Ok(CodexRuntimeInfo { running: false, command, pid: None, version })
        }
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

#[cfg(test)]
mod tests {
    use super::count_files;
    use std::fs;

    #[test]
    fn counts_generated_protocol_files_recursively() {
        let root = std::env::temp_dir().join(format!("monument-protocol-test-{}", std::process::id()));
        let nested = root.join("v2");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&nested).unwrap();
        fs::write(root.join("ClientRequest.json"), "{}").unwrap();
        fs::write(nested.join("ServerRequest.json"), "{}").unwrap();
        assert_eq!(count_files(&root), 2);
        let _ = fs::remove_dir_all(root);
    }
}
