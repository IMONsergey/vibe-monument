use serde::Serialize;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

#[derive(Default)]
pub struct ProcessRuntime {
    child: Option<ManagedProcess>,
}

struct ManagedProcess {
    child: Child,
    command: String,
    cwd: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessRuntimeInfo {
    running: bool,
    pid: Option<u32>,
    command: Option<String>,
    cwd: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RuntimeOutput {
    stream: String,
    line: String,
}

fn executable_candidates(name: &str) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(path) = std::env::var_os("PATH") {
        candidates.extend(std::env::split_paths(&path).map(|dir| dir.join(name)));
    }
    for base in ["/usr/local/bin", "/opt/homebrew/bin", "/usr/bin"] {
        candidates.push(PathBuf::from(base).join(name));
    }
    if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
        for relative in [".local/bin", ".volta/bin", ".bun/bin", ".npm-global/bin"] {
            candidates.push(home.join(relative).join(name));
        }
    }
    candidates
}

fn resolve_executable(name: &str) -> Result<PathBuf, String> {
    executable_candidates(name)
        .into_iter()
        .find(|path| path.is_file())
        .ok_or_else(|| format!("{name} was not found in Monument's executable search paths"))
}

fn detect_package_manager(root: &Path) -> &'static str {
    if root.join("pnpm-lock.yaml").exists() { return "pnpm"; }
    if root.join("bun.lockb").exists() || root.join("bun.lock").exists() { return "bun"; }
    if root.join("yarn.lock").exists() { return "yarn"; }
    "npm"
}

fn script_exists(root: &Path, script: &str) -> bool {
    let Ok(content) = fs::read_to_string(root.join("package.json")) else { return false; };
    let Ok(package) = serde_json::from_str::<serde_json::Value>(&content) else { return false; };
    package.get("scripts").and_then(|value| value.as_object()).is_some_and(|scripts| scripts.contains_key(script))
}

fn command_for(root: &Path, script: &str) -> Result<(PathBuf, Vec<String>, String), String> {
    if !matches!(script, "dev" | "start" | "preview") {
        return Err("Only dev, start, and preview scripts can be launched from the product preview".into());
    }
    if !script_exists(root, script) {
        return Err(format!("package.json does not define the {script} script"));
    }
    let manager = detect_package_manager(root);
    let executable = resolve_executable(manager)?;
    let args = match (manager, script) {
        ("npm", "start") => vec!["start".into()],
        ("npm", _) => vec!["run".into(), script.into()],
        ("bun", _) => vec!["run".into(), script.into()],
        (_, _) => vec![script.into()],
    };
    let label = format!("{} {}", executable.display(), args.join(" "));
    Ok((executable, args, label))
}

fn extract_url(line: &str) -> Option<String> {
    for marker in ["http://localhost:", "https://localhost:", "http://127.0.0.1:", "https://127.0.0.1:"] {
        if let Some(start) = line.find(marker) {
            let candidate = &line[start..];
            let end = candidate.find(|ch: char| ch.is_whitespace() || matches!(ch, ')' | ']' | '>' | '"' | '\'' | ',' | ';')).unwrap_or(candidate.len());
            return Some(candidate[..end].trim_end_matches('/').to_string());
        }
    }
    None
}

fn spawn_reader<R: std::io::Read + Send + 'static>(app: AppHandle, stream: &'static str, reader: R) {
    std::thread::spawn(move || {
        for line in BufReader::new(reader).lines().map_while(Result::ok) {
            let _ = app.emit("monument://runtime-output", RuntimeOutput { stream: stream.into(), line: line.clone() });
            if let Some(url) = extract_url(&line) {
                let _ = app.emit("monument://runtime-url", url);
            }
        }
    });
}

fn live_info(managed: &mut ManagedProcess) -> Result<ProcessRuntimeInfo, String> {
    let running = managed.child.try_wait().map_err(|error| error.to_string())?.is_none();
    Ok(ProcessRuntimeInfo {
        running,
        pid: running.then_some(managed.child.id()),
        command: Some(managed.command.clone()),
        cwd: Some(managed.cwd.clone()),
    })
}

#[tauri::command]
pub fn runtime_start(
    app: AppHandle,
    state: State<'_, Mutex<ProcessRuntime>>,
    project_path: String,
    script: String,
) -> Result<ProcessRuntimeInfo, String> {
    let root = PathBuf::from(&project_path).canonicalize().map_err(|error| error.to_string())?;
    if !root.is_dir() { return Err("Project runtime root is not a directory".into()); }

    let mut runtime = state.lock().map_err(|_| "Process runtime lock poisoned".to_string())?;
    if let Some(managed) = runtime.child.as_mut() {
        let info = live_info(managed)?;
        if info.running { return Ok(info); }
        runtime.child = None;
    }

    let (executable, args, label) = command_for(&root, &script)?;
    let mut command = Command::new(&executable);
    command.args(&args).current_dir(&root).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }

    let mut child = command.spawn().map_err(|error| format!("Failed to start {label}: {error}"))?;
    let stdout = child.stdout.take().ok_or_else(|| "Runtime stdout unavailable".to_string())?;
    let stderr = child.stderr.take().ok_or_else(|| "Runtime stderr unavailable".to_string())?;
    spawn_reader(app.clone(), "stdout", stdout);
    spawn_reader(app, "stderr", stderr);

    let info = ProcessRuntimeInfo {
        running: true,
        pid: Some(child.id()),
        command: Some(label.clone()),
        cwd: Some(root.to_string_lossy().to_string()),
    };
    runtime.child = Some(ManagedProcess { child, command: label, cwd: root.to_string_lossy().to_string() });
    Ok(info)
}

#[tauri::command]
pub fn runtime_status(state: State<'_, Mutex<ProcessRuntime>>) -> Result<ProcessRuntimeInfo, String> {
    let mut runtime = state.lock().map_err(|_| "Process runtime lock poisoned".to_string())?;
    match runtime.child.as_mut() {
        Some(managed) => live_info(managed),
        None => Ok(ProcessRuntimeInfo { running: false, pid: None, command: None, cwd: None }),
    }
}

#[tauri::command]
pub fn runtime_stop(state: State<'_, Mutex<ProcessRuntime>>) -> Result<(), String> {
    let mut runtime = state.lock().map_err(|_| "Process runtime lock poisoned".to_string())?;
    if let Some(mut managed) = runtime.child.take() {
        #[cfg(unix)]
        unsafe {
            libc::killpg(managed.child.id() as i32, libc::SIGTERM);
        }
        let _ = managed.child.kill();
        let _ = managed.child.wait();
    }
    Ok(())
}
