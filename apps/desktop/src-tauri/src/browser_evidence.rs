use serde::{Deserialize, Serialize};

pub const BROWSER_EVIDENCE_PREFIX: &str = "__MONUMENT_BROWSER_EVIDENCE__:";
pub const MAX_CONSOLE_EVENTS: usize = 60;
pub const MAX_RUNTIME_EVENTS: usize = 40;
pub const MAX_NETWORK_EVENTS: usize = 80;
pub const MAX_EVENT_TEXT: usize = 600;
pub const MAX_PAYLOAD_BYTES: usize = 48 * 1024;
pub const SLOW_REQUEST_MS: u64 = 2_000;

pub const BROWSER_EVIDENCE_SCRIPT: &str = r#"
(() => {
  const allowed = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '::1';
  if (!allowed || window.__MONUMENT_BROWSER_EVIDENCE__) return;

  const LIMITS = { console: 60, runtime: 40, network: 80, text: 600, slowMs: 2000 };
  const state = {
    installedAt: Date.now(),
    console: [],
    runtime: [],
    network: [],
  };

  const trimText = (value, max = LIMITS.text) => {
    let text = '';
    try {
      if (typeof value === 'string') text = value;
      else if (value instanceof Error) text = `${value.name}: ${value.message}`;
      else text = JSON.stringify(value);
    } catch (_) {
      try { text = String(value); } catch (_) { text = '[unprintable]'; }
    }
    text = String(text || '').replace(/\s+/g, ' ').trim();
    text = text
      .replace(/\bBearer\s+[A-Za-z0-9._~+\/=-]{8,}/gi, 'Bearer [redacted]')
      .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|ghp_[A-Za-z0-9]{12,}|github_pat_[A-Za-z0-9_]{12,}|xox[baprs]-[A-Za-z0-9-]{12,})\b/g, '[redacted-token]')
      .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[redacted-jwt]')
      .replace(/([?&][^\s=&#]{1,40}=)[^\s&#]+/g, '$1[redacted]');
    return text.length <= max ? text : `${text.slice(0, max)}…`;
  };

  const safeUrl = (raw) => {
    try {
      const url = new URL(String(raw), location.href);
      const path = url.pathname.length <= 260 ? url.pathname : `${url.pathname.slice(0, 260)}…`;
      return `${url.protocol}//${url.host}${path}`;
    } catch (_) {
      return '[invalid-url]';
    }
  };

  const push = (key, event) => {
    const list = state[key];
    list.push(event);
    const limit = LIMITS[key];
    if (list.length > limit) list.splice(0, list.length - limit);
  };

  for (const level of ['warn', 'error']) {
    const original = console[level]?.bind(console);
    if (!original) continue;
    console[level] = (...args) => {
      try {
        push('console', { at: Date.now(), level, message: trimText(args.map(trimText).join(' ')) });
      } catch (_) {}
      return original(...args);
    };
  }

  addEventListener('error', (event) => {
    push('runtime', {
      at: Date.now(),
      kind: 'error',
      message: trimText(event.message || event.error),
      source: safeUrl(event.filename || location.href),
      line: Number.isFinite(event.lineno) ? event.lineno : null,
      column: Number.isFinite(event.colno) ? event.colno : null,
    });
  }, true);

  addEventListener('unhandledrejection', (event) => {
    push('runtime', { at: Date.now(), kind: 'unhandledrejection', message: trimText(event.reason) });
  }, true);

  const nativeFetch = window.fetch?.bind(window);
  if (nativeFetch) {
    window.fetch = async (input, init = {}) => {
      const method = String(init?.method || (input && input.method) || 'GET').toUpperCase().slice(0, 12);
      const url = safeUrl(input && input.url ? input.url : input);
      const started = performance.now();
      try {
        const response = await nativeFetch(input, init);
        const durationMs = Math.max(0, Math.round(performance.now() - started));
        if (!response.ok || durationMs >= LIMITS.slowMs) {
          push('network', { at: Date.now(), transport: 'fetch', method, url, status: response.status, durationMs, failed: !response.ok });
        }
        return response;
      } catch (error) {
        const durationMs = Math.max(0, Math.round(performance.now() - started));
        push('network', { at: Date.now(), transport: 'fetch', method, url, status: null, durationMs, failed: true, error: trimText(error) });
        throw error;
      }
    };
  }

  const NativeXHR = window.XMLHttpRequest;
  if (NativeXHR) {
    const nativeOpen = NativeXHR.prototype.open;
    const nativeSend = NativeXHR.prototype.send;
    NativeXHR.prototype.open = function(method, url, ...rest) {
      this.__monumentEvidence = { method: String(method || 'GET').toUpperCase().slice(0, 12), url: safeUrl(url) };
      return nativeOpen.call(this, method, url, ...rest);
    };
    NativeXHR.prototype.send = function(body) {
      const meta = this.__monumentEvidence || { method: 'GET', url: '[unknown]' };
      const started = performance.now();
      const finish = () => {
        try {
          const durationMs = Math.max(0, Math.round(performance.now() - started));
          const failed = this.status === 0 || this.status >= 400;
          if (failed || durationMs >= LIMITS.slowMs) {
            push('network', { at: Date.now(), transport: 'xhr', method: meta.method, url: meta.url, status: this.status || null, durationMs, failed });
          }
        } catch (_) {}
      };
      this.addEventListener('loadend', finish, { once: true });
      return nativeSend.call(this, body);
    };
  }

  window.__MONUMENT_BROWSER_EVIDENCE__ = {
    snapshot(requestId) {
      return {
        requestId,
        capturedAt: Date.now(),
        page: {
          url: safeUrl(location.href),
          title: trimText(document.title, 240),
          readyState: document.readyState,
          viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
        },
        console: state.console.slice(-20),
        runtime: state.runtime.slice(-15),
        network: state.network.slice(-30),
      };
    },
    clear() {
      state.console.splice(0);
      state.runtime.splice(0);
      state.network.splice(0);
      state.installedAt = Date.now();
    },
  };
})();
"#;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserConsoleEvent {
    pub at: u64,
    pub level: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserRuntimeEvent {
    pub at: u64,
    pub kind: String,
    pub message: String,
    pub source: Option<String>,
    pub line: Option<u64>,
    pub column: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserNetworkEvent {
    pub at: u64,
    pub transport: String,
    pub method: String,
    pub url: String,
    pub status: Option<u16>,
    pub duration_ms: u64,
    pub failed: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserEvidenceSnapshot {
    pub request_id: String,
    pub captured_at: u64,
    pub page: serde_json::Value,
    pub console: Vec<BrowserConsoleEvent>,
    pub runtime: Vec<BrowserRuntimeEvent>,
    pub network: Vec<BrowserNetworkEvent>,
}

pub fn collect_script(request_id: &str) -> Result<String, String> {
    let encoded = serde_json::to_string(request_id).map_err(|error| error.to_string())?;
    Ok(format!(
        "(() => {{ const bridge = window.__MONUMENT_BROWSER_EVIDENCE__; if (!bridge) return; const previous = document.title; try {{ document.title = '{}'+JSON.stringify(bridge.snapshot({})); setTimeout(() => {{ document.title = previous; }}, 40); }} catch (_) {{ document.title = previous; }} }})();",
        BROWSER_EVIDENCE_PREFIX,
        encoded
    ))
}

pub fn parse_title_payload(title: &str) -> Result<Option<BrowserEvidenceSnapshot>, String> {
    let Some(json) = title.strip_prefix(BROWSER_EVIDENCE_PREFIX) else { return Ok(None); };
    if json.len() > MAX_PAYLOAD_BYTES {
        return Err("Browser evidence payload exceeded Monument byte bound".into());
    }
    let snapshot = serde_json::from_str::<BrowserEvidenceSnapshot>(json).map_err(|error| format!("Invalid browser evidence payload: {error}"))?;
    if snapshot.console.len() > MAX_CONSOLE_EVENTS || snapshot.runtime.len() > MAX_RUNTIME_EVENTS || snapshot.network.len() > MAX_NETWORK_EVENTS {
        return Err("Browser evidence payload exceeded Monument event bounds".into());
    }
    Ok(Some(snapshot))
}

#[cfg(test)]
mod tests {
    use super::{collect_script, parse_title_payload, BROWSER_EVIDENCE_SCRIPT, MAX_CONSOLE_EVENTS, MAX_NETWORK_EVENTS, MAX_PAYLOAD_BYTES, MAX_RUNTIME_EVENTS, SLOW_REQUEST_MS};

    #[test]
    fn instrumentation_is_bounded_and_omits_sensitive_request_material() {
        assert!(BROWSER_EVIDENCE_SCRIPT.contains("['warn', 'error']"));
        assert!(BROWSER_EVIDENCE_SCRIPT.contains("unhandledrejection"));
        assert!(BROWSER_EVIDENCE_SCRIPT.contains("window.fetch"));
        assert!(BROWSER_EVIDENCE_SCRIPT.contains("XMLHttpRequest"));
        assert!(!BROWSER_EVIDENCE_SCRIPT.contains("request.headers"));
        assert!(!BROWSER_EVIDENCE_SCRIPT.contains("response.text"));
        assert!(!BROWSER_EVIDENCE_SCRIPT.contains("response.json"));
        assert!(BROWSER_EVIDENCE_SCRIPT.contains("url.pathname"));
        assert!(BROWSER_EVIDENCE_SCRIPT.contains("Bearer [redacted]"));
        assert!(BROWSER_EVIDENCE_SCRIPT.contains("[redacted-token]"));
        assert!(BROWSER_EVIDENCE_SCRIPT.contains("[redacted-jwt]"));
        assert!(!BROWSER_EVIDENCE_SCRIPT.contains("url.search"));
        assert!(!BROWSER_EVIDENCE_SCRIPT.contains("url.hash"));
        assert!(MAX_CONSOLE_EVENTS <= 60);
        assert!(MAX_RUNTIME_EVENTS <= 40);
        assert!(MAX_NETWORK_EVENTS <= 80);
        assert!(SLOW_REQUEST_MS >= 1_500);
        assert!(MAX_PAYLOAD_BYTES <= 48 * 1024);
    }

    #[test]
    fn collection_request_id_is_json_encoded() {
        let script = collect_script("request-\"unsafe").unwrap();
        assert!(script.contains("request-\\\"unsafe"));
    }

    #[test]
    fn unrelated_titles_are_ignored() {
        assert!(parse_title_payload("Normal project title").unwrap().is_none());
    }
}
