use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};
use wait_timeout::ChildExt;

const REVIEW_TIMEOUT: Duration = Duration::from_secs(240);
const MAX_REVIEW_PROMPT_BYTES: usize = 640 * 1024;
const MAX_REVIEW_STDERR_BYTES: usize = 48 * 1024;
const MAX_REVIEW_OUTPUT_BYTES: u64 = 256 * 1024;
static REVIEW_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewRunInput {
    project_path: String,
    prompt: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewFindingPayload {
    severity: String,
    category: String,
    title: String,
    description: String,
    path: Option<String>,
    line: Option<u64>,
    evidence: String,
    suggested_fix: String,
    confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewModelOutput {
    verdict: String,
    summary: String,
    findings: Vec<ReviewFindingPayload>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewRunOutput {
    result: ReviewModelOutput,
    duration_ms: u128,
    stderr: String,
}

fn canonical_project(project_path: &str) -> Result<PathBuf, String> {
    let root = PathBuf::from(project_path)
        .canonicalize()
        .map_err(|error| format!("Cannot bind Fresh Review to project: {error}"))?;
    if !root.is_dir() {
        return Err("Fresh Review project root is not a directory".into());
    }
    Ok(root)
}

fn resolve_codex_command() -> Result<PathBuf, String> {
    let mut candidates = Vec::new();
    if let Some(path) = std::env::var_os("PATH") {
        candidates.extend(std::env::split_paths(&path).map(|directory| directory.join("codex")));
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
    candidates
        .into_iter()
        .find(|path| path.is_file())
        .ok_or_else(|| "Codex CLI was not found for Fresh Review".to_string())
}

fn review_schema() -> serde_json::Value {
    json!({
        "type": "object",
        "properties": {
            "verdict": { "type": "string", "enum": ["clean", "issues"] },
            "summary": { "type": "string", "maxLength": 2400 },
            "findings": {
                "type": "array",
                "maxItems": 24,
                "items": {
                    "type": "object",
                    "properties": {
                        "severity": { "type": "string", "enum": ["blocker", "high", "medium", "low"] },
                        "category": { "type": "string", "enum": ["correctness", "regression", "security", "data", "ux", "accessibility", "performance", "maintainability", "testing", "other"] },
                        "title": { "type": "string", "maxLength": 220 },
                        "description": { "type": "string", "maxLength": 2200 },
                        "path": { "type": ["string", "null"], "maxLength": 600 },
                        "line": { "type": ["integer", "null"], "minimum": 1 },
                        "evidence": { "type": "string", "maxLength": 2200 },
                        "suggestedFix": { "type": "string", "maxLength": 2200 },
                        "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
                    },
                    "required": ["severity", "category", "title", "description", "path", "line", "evidence", "suggestedFix", "confidence"],
                    "additionalProperties": false
                }
            }
        },
        "required": ["verdict", "summary", "findings"],
        "additionalProperties": false
    })
}

fn drain_bounded<R: Read + Send + 'static>(mut reader: R, limit: usize) -> std::thread::JoinHandle<Vec<u8>> {
    std::thread::spawn(move || {
        let mut kept = Vec::new();
        let mut buffer = [0_u8; 8192];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(read) => {
                    if kept.len() < limit {
                        let remaining = limit - kept.len();
                        kept.extend_from_slice(&buffer[..read.min(remaining)]);
                    }
                }
                Err(_) => break,
            }
        }
        kept
    })
}

fn terminate_process_group(child: &mut std::process::Child) {
    #[cfg(unix)]
    unsafe {
        libc::killpg(child.id() as i32, libc::SIGTERM);
    }
    let _ = child.kill();
    let _ = child.wait();
}

fn output_file(path: &Path) -> Result<ReviewModelOutput, String> {
    let metadata = fs::metadata(path).map_err(|error| format!("Fresh Review produced no final output: {error}"))?;
    if metadata.len() > MAX_REVIEW_OUTPUT_BYTES {
        return Err("Fresh Review output exceeded the 256 KiB structured-output limit".into());
    }
    let text = fs::read_to_string(path).map_err(|error| format!("Cannot read Fresh Review output: {error}"))?;
    serde_json::from_str::<ReviewModelOutput>(&text)
        .map_err(|error| format!("Fresh Review returned invalid structured output: {error}"))
}

fn scratch_paths(app: &AppHandle, id: u64) -> Result<(PathBuf, PathBuf, PathBuf), String> {
    let root = app
        .path()
        .app_cache_dir()
        .map_err(|error| error.to_string())?
        .join("fresh-review")
        .join(format!("{}-{id}", std::process::id()));
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    Ok((root.clone(), root.join("schema.json"), root.join("output.json")))
}

fn run_review(app: AppHandle, input: ReviewRunInput) -> Result<ReviewRunOutput, String> {
    if input.prompt.as_bytes().len() > MAX_REVIEW_PROMPT_BYTES {
        return Err("Fresh Review packet exceeded the 640 KiB input boundary".into());
    }
    // Canonicalize only to bind this request to a real local project. The reviewer itself never
    // receives this directory as cwd, so repository instructions/config cannot influence review.
    let _project_root = canonical_project(&input.project_path)?;
    let codex = resolve_codex_command()?;
    let id = REVIEW_COUNTER.fetch_add(1, Ordering::Relaxed);
    let (scratch, schema_path, output_path) = scratch_paths(&app, id)?;
    fs::write(
        &schema_path,
        serde_json::to_vec_pretty(&review_schema()).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;

    let mut command = Command::new(&codex);
    command
        .args(["exec", "--ephemeral", "--sandbox", "read-only", "--ignore-user-config", "--output-schema"])
        .arg(&schema_path)
        .arg("--output-last-message")
        .arg(&output_path)
        .arg("-")
        .current_dir(&scratch)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .env("NO_COLOR", "1");
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }

    let started = Instant::now();
    let mut child = command
        .spawn()
        .map_err(|error| format!("Could not start Fresh Review with {}: {error}", codex.display()))?;
    let stderr = child.stderr.take().ok_or_else(|| "Fresh Review stderr is unavailable".to_string())?;
    let stderr_reader = drain_bounded(stderr, MAX_REVIEW_STDERR_BYTES);
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(input.prompt.as_bytes())
            .map_err(|error| format!("Could not send Fresh Review packet to Codex: {error}"))?;
        stdin.flush().map_err(|error| error.to_string())?;
    }

    let status = child
        .wait_timeout(REVIEW_TIMEOUT)
        .map_err(|error| format!("Fresh Review wait failed: {error}"))?;
    let status = match status {
        Some(status) => status,
        None => {
            terminate_process_group(&mut child);
            let _ = stderr_reader.join();
            let _ = fs::remove_dir_all(&scratch);
            return Err("Fresh Review timed out after 4 minutes".into());
        }
    };
    let stderr = stderr_reader.join().unwrap_or_default();
    let stderr_text = String::from_utf8_lossy(&stderr).to_string();
    if !status.success() {
        let _ = fs::remove_dir_all(&scratch);
        return Err(if stderr_text.trim().is_empty() {
            format!("Fresh Review exited with {status}")
        } else {
            format!("Fresh Review failed: {}", stderr_text.trim())
        });
    }

    let result = output_file(&output_path)?;
    let _ = fs::remove_dir_all(&scratch);
    Ok(ReviewRunOutput {
        result,
        duration_ms: started.elapsed().as_millis(),
        stderr: stderr_text,
    })
}

#[tauri::command]
pub async fn review_run(app: AppHandle, input: ReviewRunInput) -> Result<ReviewRunOutput, String> {
    tauri::async_runtime::spawn_blocking(move || run_review(app, input))
        .await
        .map_err(|error| format!("Fresh Review worker failed: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::{review_schema, MAX_REVIEW_PROMPT_BYTES, REVIEW_TIMEOUT};

    #[test]
    fn fresh_review_is_bounded_and_structured() {
        assert_eq!(MAX_REVIEW_PROMPT_BYTES, 640 * 1024);
        assert_eq!(REVIEW_TIMEOUT.as_secs(), 240);
        let schema = review_schema();
        assert_eq!(schema["properties"]["findings"]["maxItems"], 24);
        assert_eq!(schema["additionalProperties"], false);
    }
}
