use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use wait_timeout::ChildExt;

const ALLOWED_SCRIPTS: &[&str] = &["typecheck", "test", "build", "lint", "check"];
const AUTO_SCRIPTS: &[&str] = &["typecheck", "test", "build"];
const MAX_OUTPUT_BYTES: usize = 64 * 1024;
const CHECK_TIMEOUT: Duration = Duration::from_secs(300);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VerificationPlanItem {
    script: String,
    command: String,
    automatic: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VerificationResult {
    script: String,
    command: String,
    cwd: String,
    success: bool,
    exit_code: Option<i32>,
    timed_out: bool,
    duration_ms: u128,
    started_at_ms: u128,
    stdout: String,
    stderr: String,
}

fn read_package(root: &Path) -> Result<Value, String> {
    let content = fs::read_to_string(root.join("package.json")).map_err(|error| format!("Cannot read package.json: {error}"))?;
    serde_json::from_str(&content).map_err(|error| format!("Invalid package.json: {error}"))
}

fn script_exists(package: &Value, script: &str) -> bool {
    package
        .get("scripts")
        .and_then(Value::as_object)
        .is_some_and(|scripts| scripts.get(script).and_then(Value::as_str).is_some())
}

fn detect_package_manager(root: &Path) -> &'static str {
    if root.join("pnpm-lock.yaml").exists() { return "pnpm"; }
    if root.join("bun.lockb").exists() || root.join("bun.lock").exists() { return "bun"; }
    if root.join("yarn.lock").exists() { return "yarn"; }
    "npm"
}

fn executable_candidates(name: &str) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(path) = std::env::var_os("PATH") {
        candidates.extend(std::env::split_paths(&path).map(|directory| directory.join(name)));
    }
    for directory in ["/usr/local/bin", "/opt/homebrew/bin", "/usr/bin"] {
        candidates.push(PathBuf::from(directory).join(name));
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

fn command_for(root: &Path, script: &str) -> Result<(PathBuf, Vec<String>, String), String> {
    if !ALLOWED_SCRIPTS.contains(&script) {
        return Err(format!("Verification script {script} is not allowed"));
    }
    let package = read_package(root)?;
    if !script_exists(&package, script) {
        return Err(format!("package.json does not define the {script} script"));
    }
    let manager = detect_package_manager(root);
    let executable = resolve_executable(manager)?;
    let args = match manager {
        "npm" => vec!["run".to_string(), script.to_string()],
        "bun" => vec!["run".to_string(), script.to_string()],
        _ => vec![script.to_string()],
    };
    let label = format!("{} {}", executable.display(), args.join(" "));
    Ok((executable, args, label))
}

fn read_limited<R: Read>(mut reader: R) -> Vec<u8> {
    let mut kept = Vec::new();
    let mut buffer = [0u8; 8192];
    loop {
        let Ok(count) = reader.read(&mut buffer) else { break; };
        if count == 0 { break; }
        if kept.len() < MAX_OUTPUT_BYTES {
            let remaining = MAX_OUTPUT_BYTES - kept.len();
            kept.extend_from_slice(&buffer[..count.min(remaining)]);
        }
    }
    kept
}

fn kill_process_group(child: &mut std::process::Child) {
    #[cfg(unix)]
    unsafe {
        libc::killpg(child.id() as i32, libc::SIGTERM);
    }
    let _ = child.kill();
}

fn run_check(root: &Path, script: &str) -> Result<VerificationResult, String> {
    let (executable, args, label) = command_for(root, script)?;
    let started_at_ms = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
    let started = Instant::now();

    let mut command = Command::new(&executable);
    command
        .args(&args)
        .current_dir(root)
        .env("CI", "1")
        .env("NO_COLOR", "1")
        .env("FORCE_COLOR", "0")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }

    let mut child = command.spawn().map_err(|error| format!("Failed to start {label}: {error}"))?;
    let stdout = child.stdout.take().ok_or_else(|| "Verification stdout unavailable".to_string())?;
    let stderr = child.stderr.take().ok_or_else(|| "Verification stderr unavailable".to_string())?;
    let stdout_thread = std::thread::spawn(move || read_limited(stdout));
    let stderr_thread = std::thread::spawn(move || read_limited(stderr));

    let status = match child.wait_timeout(CHECK_TIMEOUT).map_err(|error| error.to_string())? {
        Some(status) => (Some(status), false),
        None => {
            kill_process_group(&mut child);
            let status = child.wait().ok();
            (status, true)
        }
    };

    let stdout = stdout_thread.join().unwrap_or_default();
    let stderr = stderr_thread.join().unwrap_or_default();
    let exit_code = status.0.and_then(|status| status.code());
    let success = !status.1 && status.0.is_some_and(|status| status.success());

    Ok(VerificationResult {
        script: script.to_string(),
        command: label,
        cwd: root.to_string_lossy().to_string(),
        success,
        exit_code,
        timed_out: status.1,
        duration_ms: started.elapsed().as_millis(),
        started_at_ms,
        stdout: String::from_utf8_lossy(&stdout).to_string(),
        stderr: String::from_utf8_lossy(&stderr).to_string(),
    })
}

#[tauri::command]
pub fn verification_plan(project_path: String) -> Result<Vec<VerificationPlanItem>, String> {
    let root = PathBuf::from(project_path).canonicalize().map_err(|error| format!("Cannot inspect verification scripts: {error}"))?;
    if !root.is_dir() { return Err("Verification root is not a directory".into()); }
    let package = read_package(&root)?;
    let manager = detect_package_manager(&root);
    let executable = resolve_executable(manager)?;
    let items = ALLOWED_SCRIPTS
        .iter()
        .filter(|script| script_exists(&package, script))
        .map(|script| {
            let args = match manager {
                "npm" | "bun" => format!("run {script}"),
                _ => script.to_string(),
            };
            VerificationPlanItem {
                script: script.to_string(),
                command: format!("{} {args}", executable.display()),
                automatic: AUTO_SCRIPTS.contains(script),
            }
        })
        .collect();
    Ok(items)
}

#[tauri::command]
pub async fn verification_run(project_path: String, script: String) -> Result<VerificationResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = PathBuf::from(project_path).canonicalize().map_err(|error| format!("Cannot run verification: {error}"))?;
        if !root.is_dir() { return Err("Verification root is not a directory".into()); }
        run_check(&root, &script)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::{ALLOWED_SCRIPTS, AUTO_SCRIPTS, CHECK_TIMEOUT, MAX_OUTPUT_BYTES};

    #[test]
    fn verification_surface_is_bounded() {
        assert!(ALLOWED_SCRIPTS.contains(&"build"));
        assert!(ALLOWED_SCRIPTS.contains(&"test"));
        assert!(!ALLOWED_SCRIPTS.contains(&"postinstall"));
        assert!(AUTO_SCRIPTS.contains(&"typecheck"));
        assert!(CHECK_TIMEOUT.as_secs() <= 300);
        assert!(MAX_OUTPUT_BYTES <= 64 * 1024);
    }
}
