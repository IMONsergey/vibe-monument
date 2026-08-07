use serde::{Deserialize, Serialize};
use tauri::{Emitter, LogicalPosition, LogicalSize, Manager, WebviewUrl};

const PREVIEW_LABEL: &str = "monument-preview";
const SELECTION_PREFIX: &str = "__MONUMENT_SELECTION__:";

const PREVIEW_INSPECTOR_SCRIPT: &str = r#"
(() => {
  const allowed = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '::1';
  if (!allowed || window.__MONUMENT_INSPECTOR_INSTALLED__) return;
  window.__MONUMENT_INSPECTOR_INSTALLED__ = true;

  const PREFIX = '__MONUMENT_SELECTION__:';
  let enabled = false;
  let selected = null;
  let hover = null;

  function ensureOverlay() {
    if (hover && hover.isConnected && selected && selected.isConnected) return;
    hover = document.createElement('div');
    hover.setAttribute('data-monument-inspector', 'hover');
    selected = document.createElement('div');
    selected.setAttribute('data-monument-inspector', 'selected');
    for (const [node, color, width] of [[hover, '#70a7ff', '1px'], [selected, '#d9f56a', '2px']]) {
      Object.assign(node.style, {
        position: 'fixed',
        zIndex: '2147483647',
        pointerEvents: 'none',
        display: 'none',
        border: `${width} solid ${color}`,
        borderRadius: '3px',
        boxSizing: 'border-box',
        boxShadow: color === '#d9f56a' ? '0 0 0 1px rgba(0,0,0,.18)' : 'none',
      });
      document.documentElement.appendChild(node);
    }
  }

  function isInspectorNode(node) {
    return node instanceof Element && node.hasAttribute('data-monument-inspector');
  }

  function rectToStyle(node, element) {
    if (!node || !element) return;
    const rect = element.getBoundingClientRect();
    Object.assign(node.style, {
      display: rect.width > 0 && rect.height > 0 ? 'block' : 'none',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function selectorFor(element) {
    if (!(element instanceof Element)) return '';
    if (element.id) return `#${cssEscape(element.id)}`;
    const parts = [];
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 6) {
      let part = current.tagName.toLowerCase();
      const stableClasses = [...current.classList].filter((name) => name && name.length < 64 && !/^(css-|sc-|jsx-)/.test(name)).slice(0, 2);
      if (stableClasses.length) part += stableClasses.map((name) => `.${cssEscape(name)}`).join('');
      const parent = current.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter((child) => child.tagName === current.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }
      parts.unshift(part);
      current = parent;
      if (current && current.id) {
        parts.unshift(`#${cssEscape(current.id)}`);
        break;
      }
    }
    return parts.join(' > ');
  }

  function textOf(element) {
    const raw = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
    return raw.slice(0, 480);
  }

  function accessibleName(element) {
    return (
      element.getAttribute('aria-label') ||
      element.getAttribute('alt') ||
      element.getAttribute('title') ||
      (element instanceof HTMLInputElement ? element.placeholder : '') ||
      textOf(element).slice(0, 160)
    );
  }

  function payloadFor(element) {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const parent = element.parentElement;
    return {
      url: location.href,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      tag: element.tagName.toLowerCase(),
      id: element.id || null,
      classes: [...element.classList].slice(0, 12),
      role: element.getAttribute('role'),
      accessibleName: accessibleName(element),
      text: textOf(element),
      selector: selectorFor(element),
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      parent: parent ? { tag: parent.tagName.toLowerCase(), selector: selectorFor(parent) } : null,
      styles: {
        display: style.display,
        position: style.position,
        color: style.color,
        backgroundColor: style.backgroundColor,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        textAlign: style.textAlign,
        padding: style.padding,
        margin: style.margin,
        border: style.border,
        borderRadius: style.borderRadius,
        width: style.width,
        height: style.height,
        gap: style.gap,
        alignItems: style.alignItems,
        justifyContent: style.justifyContent,
      },
    };
  }

  function elementAtEvent(event) {
    const node = document.elementFromPoint(event.clientX, event.clientY);
    if (!(node instanceof Element) || isInspectorNode(node)) return null;
    return node;
  }

  function onMove(event) {
    if (!enabled) return;
    ensureOverlay();
    const element = elementAtEvent(event);
    if (element) rectToStyle(hover, element);
  }

  function onClick(event) {
    if (!enabled) return;
    const element = elementAtEvent(event);
    if (!element) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    ensureOverlay();
    rectToStyle(selected, element);
    if (hover) hover.style.display = 'none';
    const previous = document.title;
    try {
      document.title = PREFIX + JSON.stringify(payloadFor(element));
      setTimeout(() => { document.title = previous; }, 40);
    } catch (_) {
      document.title = previous;
    }
  }

  function setEnabled(next) {
    enabled = Boolean(next);
    ensureOverlay();
    document.documentElement.style.cursor = enabled ? 'crosshair' : '';
    if (!enabled) {
      if (hover) hover.style.display = 'none';
      if (selected) selected.style.display = 'none';
    }
    return enabled;
  }

  window.__MONUMENT_SET_INSPECT__ = setEnabled;
  document.addEventListener('pointermove', onMove, true);
  document.addEventListener('click', onClick, true);
})();
"#;

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewBounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewSelection {
    url: String,
    viewport: serde_json::Value,
    tag: String,
    id: Option<String>,
    classes: Vec<String>,
    role: Option<String>,
    accessible_name: Option<String>,
    text: String,
    selector: String,
    rect: serde_json::Value,
    parent: Option<serde_json::Value>,
    styles: serde_json::Value,
}

fn is_loopback_url(url: &tauri::Url) -> bool {
    matches!(url.scheme(), "http" | "https")
        && matches!(url.host_str(), Some("localhost") | Some("127.0.0.1") | Some("::1"))
}

fn same_origin(left: &tauri::Url, right: &tauri::Url) -> bool {
    left.scheme() == right.scheme()
        && left.host_str() == right.host_str()
        && left.port_or_known_default() == right.port_or_known_default()
}

fn valid_bounds(bounds: PreviewBounds) -> Result<PreviewBounds, String> {
    if !bounds.x.is_finite() || !bounds.y.is_finite() || !bounds.width.is_finite() || !bounds.height.is_finite() {
        return Err("Preview bounds must be finite".into());
    }
    if bounds.width < 120.0 || bounds.height < 120.0 || bounds.width > 10000.0 || bounds.height > 10000.0 {
        return Err("Preview bounds are outside the supported range".into());
    }
    Ok(bounds)
}

#[tauri::command]
pub async fn preview_open(app: tauri::AppHandle, url: String, bounds: PreviewBounds) -> Result<(), String> {
    let parsed = tauri::Url::parse(&url).map_err(|error| format!("Invalid preview URL: {error}"))?;
    if !is_loopback_url(&parsed) {
        return Err("Monument preview only accepts loopback HTTP(S) development URLs".into());
    }
    let bounds = valid_bounds(bounds)?;

    if let Some(existing) = app.get_webview(PREVIEW_LABEL) {
        existing.close().map_err(|error| error.to_string())?;
    }

    let window = app.get_window("main").ok_or_else(|| "Main Monument window is unavailable".to_string())?;
    let allowed_origin = parsed.clone();
    let event_app = app.clone();

    let builder = tauri::webview::WebviewBuilder::new(PREVIEW_LABEL, WebviewUrl::External(parsed))
        .initialization_script(PREVIEW_INSPECTOR_SCRIPT)
        .on_navigation(move |candidate| same_origin(&allowed_origin, candidate))
        .on_document_title_changed(move |_webview, title| {
            let Some(json) = title.strip_prefix(SELECTION_PREFIX) else { return; };
            match serde_json::from_str::<PreviewSelection>(json) {
                Ok(selection) => { let _ = event_app.emit("monument://preview-selection", selection); }
                Err(error) => { let _ = event_app.emit("monument://preview-error", format!("Invalid preview selection payload: {error}")); }
            }
        });

    window
        .add_child(
            builder,
            LogicalPosition::new(bounds.x, bounds.y),
            LogicalSize::new(bounds.width, bounds.height),
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn preview_set_bounds(app: tauri::AppHandle, bounds: PreviewBounds) -> Result<(), String> {
    let bounds = valid_bounds(bounds)?;
    let webview = app.get_webview(PREVIEW_LABEL).ok_or_else(|| "Preview webview is not open".to_string())?;
    webview.set_position(LogicalPosition::new(bounds.x, bounds.y)).map_err(|error| error.to_string())?;
    webview.set_size(LogicalSize::new(bounds.width, bounds.height)).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn preview_set_inspect(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let webview = app.get_webview(PREVIEW_LABEL).ok_or_else(|| "Preview webview is not open".to_string())?;
    webview
        .eval(format!("window.__MONUMENT_SET_INSPECT__ && window.__MONUMENT_SET_INSPECT__({enabled});"))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn preview_reload(app: tauri::AppHandle) -> Result<(), String> {
    let webview = app.get_webview(PREVIEW_LABEL).ok_or_else(|| "Preview webview is not open".to_string())?;
    webview.reload().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn preview_close(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(webview) = app.get_webview(PREVIEW_LABEL) {
        webview.close().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{is_loopback_url, same_origin, valid_bounds, PreviewBounds};

    #[test]
    fn preview_only_accepts_loopback_urls() {
        assert!(is_loopback_url(&tauri::Url::parse("http://localhost:5173").unwrap()));
        assert!(is_loopback_url(&tauri::Url::parse("https://127.0.0.1:3000/app").unwrap()));
        assert!(!is_loopback_url(&tauri::Url::parse("https://example.com").unwrap()));
        assert!(!is_loopback_url(&tauri::Url::parse("file:///tmp/index.html").unwrap()));
    }

    #[test]
    fn preview_navigation_stays_on_exact_origin() {
        let origin = tauri::Url::parse("http://localhost:5173/").unwrap();
        assert!(same_origin(&origin, &tauri::Url::parse("http://localhost:5173/pricing").unwrap()));
        assert!(!same_origin(&origin, &tauri::Url::parse("http://localhost:3000/").unwrap()));
        assert!(!same_origin(&origin, &tauri::Url::parse("https://localhost:5173/").unwrap()));
    }

    #[test]
    fn preview_bounds_are_bounded() {
        assert!(valid_bounds(PreviewBounds { x: 10.0, y: 20.0, width: 1200.0, height: 800.0 }).is_ok());
        assert!(valid_bounds(PreviewBounds { x: 0.0, y: 0.0, width: 20.0, height: 800.0 }).is_err());
    }
}
