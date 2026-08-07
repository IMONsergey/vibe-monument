use std::process::{Command, Stdio};

fn allowed_external_url(url: &str) -> bool {
    url.starts_with("https://")
}

#[tauri::command]
pub fn system_open_external(url: String) -> Result<(), String> {
    if !allowed_external_url(&url) {
        return Err("Monument only opens HTTPS external URLs".into());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("/usr/bin/open")
            .arg(&url)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|error| format!("Could not open browser: {error}"))?;
        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = url;
        Err("External browser opening is implemented for the macOS Monument target".into())
    }
}

#[cfg(test)]
mod tests {
    use super::allowed_external_url;

    #[test]
    fn only_https_external_urls_are_allowed() {
        assert!(allowed_external_url("https://chatgpt.com/auth"));
        assert!(allowed_external_url("https://auth.openai.com/codex/device"));
        assert!(!allowed_external_url("http://example.com"));
        assert!(!allowed_external_url("file:///tmp/token"));
        assert!(!allowed_external_url("javascript:alert(1)"));
    }
}
