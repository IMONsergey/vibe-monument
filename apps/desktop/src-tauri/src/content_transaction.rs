use crate::jsx_source::{opening_tags, JsxAttributeValue, JsxOpeningTag};
use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::fs::{self, OpenOptions};
use std::hash::{Hash, Hasher};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_CONTENT_FILES: usize = 1_200;
const MAX_FILE_BYTES: u64 = 1_500_000;
const MAX_TOTAL_BYTES: u64 = 24_000_000;
const MAX_ID_BYTES: usize = 96;
const MAX_TEXT_BYTES: usize = 4_800;
const MAX_ATTRIBUTE_BYTES: usize = 800;
const MAX_CHANGES: usize = 8;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentEditSelection {
    id: Option<String>,
    #[serde(default)]
    id_unique: bool,
    tag: String,
    direct_text: String,
    #[serde(default)]
    attributes: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentEditChange {
    property: String,
    before: String,
    after: String,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ContentEditKind {
    Text,
    Attribute,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentEditOperation {
    kind: ContentEditKind,
    path: String,
    line: usize,
    tag: String,
    property: String,
    source_before: String,
    source_after: String,
    owner_kind: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ContentEditMode {
    Deterministic,
    Codex,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentEditProbe {
    mode: ContentEditMode,
    reason: String,
    operations: Vec<ContentEditOperation>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentTransactionCommit {
    path: String,
    applied_count: usize,
    bytes_written: usize,
    kinds: Vec<ContentEditKind>,
}

#[derive(Debug, Clone)]
struct ResolvedEdit {
    public: ContentEditOperation,
    start: usize,
    end: usize,
}

#[derive(Debug, Clone)]
struct ResolvedPlan {
    public: ContentEditProbe,
    edits: Vec<ResolvedEdit>,
    fingerprint: Option<u64>,
}

#[derive(Debug, Clone)]
struct Owner {
    path: String,
    content: String,
    tag: JsxOpeningTag,
}

fn skip_dir(name: &str) -> bool {
    matches!(
        name,
        ".git" | "node_modules" | "target" | "dist" | "build" | ".next" | ".nuxt"
            | ".output" | "coverage" | ".cache" | ".turbo" | ".vite"
    )
}

fn collect_sources(directory: &Path, files: &mut Vec<PathBuf>, total: &mut u64, truncated: &mut bool) {
    if files.len() >= MAX_CONTENT_FILES || *total >= MAX_TOTAL_BYTES {
        *truncated = true;
        return;
    }
    let Ok(entries) = fs::read_dir(directory) else { return; };
    let mut entries: Vec<_> = entries.filter_map(Result::ok).collect();
    entries.sort_by_key(|entry| entry.path());
    for entry in entries {
        if files.len() >= MAX_CONTENT_FILES || *total >= MAX_TOTAL_BYTES {
            *truncated = true;
            break;
        }
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let Ok(kind) = entry.file_type() else { continue; };
        if kind.is_symlink() { continue; }
        if kind.is_dir() {
            if !skip_dir(&name) && !name.starts_with(".env") {
                collect_sources(&path, files, total, truncated);
            }
            continue;
        }
        if !matches!(path.extension().and_then(|value| value.to_str()), Some("tsx") | Some("jsx")) {
            continue;
        }
        let Ok(metadata) = entry.metadata() else { continue; };
        let size = metadata.len();
        if size > MAX_FILE_BYTES || total.saturating_add(size) > MAX_TOTAL_BYTES {
            *truncated = true;
            continue;
        }
        *total += size;
        files.push(path);
    }
}

fn project_root(project_path: String) -> Result<PathBuf, String> {
    let root = PathBuf::from(project_path.trim())
        .canonicalize()
        .map_err(|error| format!("Cannot inspect content source: {error}"))?;
    if !root.is_dir() {
        return Err("Content transaction root is not a directory".into());
    }
    Ok(root)
}

fn bounded_id(value: Option<&str>) -> Option<String> {
    let value = value?.trim();
    if value.is_empty() || value.len() > MAX_ID_BYTES {
        return None;
    }
    value
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b':' | b'.'))
        .then(|| value.to_string())
}

fn real_dom_tag(tag: &str) -> bool {
    let tag = tag.trim();
    !tag.is_empty()
        && tag.len() <= 48
        && tag.as_bytes()[0].is_ascii_lowercase()
        && tag.bytes().all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b':'))
}

fn literal_attr<'a>(tag: &'a JsxOpeningTag, name: &str) -> Option<(&'a str, usize, usize)> {
    let attribute = tag.attribute(name)?;
    match &attribute.value {
        JsxAttributeValue::Literal { value, value_start, value_end, .. } => {
            Some((value.as_str(), *value_start, *value_end))
        }
        _ => None,
    }
}

fn fingerprint(content: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    hasher.finish()
}

fn line_number(content: &str, offset: usize) -> usize {
    content.as_bytes()[..offset.min(content.len())]
        .iter()
        .filter(|byte| **byte == b'\n')
        .count()
        + 1
}

fn normalize_runtime_text(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn decode_entity(entity: &str) -> Option<char> {
    match entity {
        "amp" => Some('&'),
        "lt" => Some('<'),
        "gt" => Some('>'),
        "quot" => Some('"'),
        "apos" => Some('\''),
        "nbsp" => Some('\u{00a0}'),
        _ if entity.starts_with("#x") || entity.starts_with("#X") => {
            u32::from_str_radix(&entity[2..], 16).ok().and_then(char::from_u32)
        }
        _ if entity.starts_with('#') => entity[1..].parse::<u32>().ok().and_then(char::from_u32),
        _ => None,
    }
}

fn decode_jsx_entities(value: &str) -> Option<String> {
    let mut output = String::with_capacity(value.len());
    let mut cursor = 0usize;
    while cursor < value.len() {
        let rest = &value[cursor..];
        let Some(relative_amp) = rest.find('&') else {
            output.push_str(rest);
            break;
        };
        output.push_str(&rest[..relative_amp]);
        let amp = cursor + relative_amp;
        let tail = &value[amp + 1..];
        let Some(relative_semi) = tail.find(';') else { return None; };
        if relative_semi > 16 { return None; }
        let entity = &tail[..relative_semi];
        output.push(decode_entity(entity)?);
        cursor = amp + 1 + relative_semi + 1;
    }
    Some(output)
}

fn encode_jsx_text(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    for ch in value.chars() {
        match ch {
            '&' => output.push_str("&amp;"),
            '<' => output.push_str("&lt;"),
            '>' => output.push_str("&gt;"),
            '{' => output.push_str("&#123;"),
            '}' => output.push_str("&#125;"),
            _ => output.push(ch),
        }
    }
    output
}

fn encode_attr_value(value: &str, quote: u8) -> String {
    let mut output = String::with_capacity(value.len());
    for ch in value.chars() {
        match ch {
            '&' => output.push_str("&amp;"),
            '<' => output.push_str("&lt;"),
            '>' => output.push_str("&gt;"),
            '"' if quote == b'"' => output.push_str("&quot;"),
            '\'' if quote == b'\'' => output.push_str("&#39;"),
            '{' => output.push_str("&#123;"),
            '}' => output.push_str("&#125;"),
            _ => output.push(ch),
        }
    }
    output
}

fn simple_text_body(content: &str, tag: &JsxOpeningTag) -> Option<(usize, usize, String)> {
    let opening = content.get(tag.start..tag.end)?;
    if opening.trim_end().ends_with("/>") {
        return None;
    }
    let close_prefix = format!("</{}", tag.tag);
    let bytes = content.as_bytes();
    let mut cursor = tag.end;
    let hard_end = tag.end.saturating_add(MAX_TEXT_BYTES * 4).min(content.len());
    while cursor < hard_end {
        match bytes[cursor] {
            b'{' | b'}' => return None,
            b'<' => {
                if !content[cursor..].starts_with(&close_prefix) {
                    return None;
                }
                let mut end = cursor + close_prefix.len();
                while end < content.len() && bytes[end].is_ascii_whitespace() { end += 1; }
                if bytes.get(end) != Some(&b'>') { return None; }
                let raw = content[tag.end..cursor].to_string();
                return Some((tag.end, cursor, raw));
            }
            _ => cursor += 1,
        }
    }
    None
}

fn allowed_attribute(property: &str, tag: &str) -> Option<&'static str> {
    match property {
        "ariaLabel" => Some("aria-label"),
        "title" => Some("title"),
        "alt" if tag == "img" => Some("alt"),
        "placeholder" if matches!(tag, "input" | "textarea") => Some("placeholder"),
        _ => None,
    }
}

fn live_attribute(selection: &ContentEditSelection, property: &str) -> String {
    selection.attributes.get(property).cloned().unwrap_or_default()
}

fn owner(root: &Path, selection: &ContentEditSelection) -> Result<Result<Owner, String>, String> {
    let Some(id) = bounded_id(selection.id.as_deref()) else {
        return Ok(Err("Content direct editing requires a bounded literal DOM id.".into()));
    };
    if !selection.id_unique {
        return Ok(Err("Content direct editing requires a unique live DOM id.".into()));
    }
    let tag_name = selection.tag.trim().to_ascii_lowercase();
    if !real_dom_tag(&tag_name) {
        return Ok(Err("Content direct editing is limited to real DOM/custom-element source tags.".into()));
    }

    let mut files = Vec::new();
    let mut total = 0u64;
    let mut truncated = false;
    collect_sources(root, &mut files, &mut total, &mut truncated);
    if truncated {
        return Ok(Err("Content source scan was truncated; use Codex.".into()));
    }

    let mut owners = Vec::new();
    for path in files {
        let content = fs::read_to_string(&path)
            .map_err(|error| format!("Cannot read content source {}: {error}", path.display()))?;
        for tag in opening_tags(&content) {
            if tag.tag.to_ascii_lowercase() != tag_name { continue; }
            if literal_attr(&tag, "id").map(|(value, _, _)| value) != Some(id.as_str()) { continue; }
            if tag.has_spread {
                return Ok(Err("Owning JSX element contains an attribute spread; content ownership is dynamic.".into()));
            }
            if tag.duplicate_attribute_names().iter().any(|name| matches!(name.as_str(), "id" | "aria-label" | "title" | "alt" | "placeholder")) {
                return Ok(Err("Owning JSX element contains duplicate content/semantic attributes.".into()));
            }
            owners.push(Owner {
                path: path.strip_prefix(root).unwrap_or(&path).to_string_lossy().replace('\\', "/"),
                content: content.clone(),
                tag,
            });
        }
    }
    if owners.len() != 1 {
        return Ok(Err(if owners.is_empty() {
            "No unique literal JSX/TSX content owner was proven for the selected live id/tag.".into()
        } else {
            "Multiple JSX/TSX elements use the selected literal id; content ownership is ambiguous.".into()
        }));
    }
    Ok(Ok(owners.remove(0)))
}

fn codex(reason: impl Into<String>) -> ResolvedPlan {
    ResolvedPlan {
        public: ContentEditProbe { mode: ContentEditMode::Codex, reason: reason.into(), operations: Vec::new() },
        edits: Vec::new(),
        fingerprint: None,
    }
}

fn resolve(root: &Path, selection: &ContentEditSelection, changes: &[ContentEditChange]) -> Result<ResolvedPlan, String> {
    if changes.is_empty() || changes.len() > MAX_CHANGES {
        return Ok(codex("Content edit batch is empty or exceeds the bounded transaction size."));
    }
    let owner = match owner(root, selection)? {
        Ok(owner) => owner,
        Err(reason) => return Ok(codex(reason)),
    };
    let mut edits = Vec::new();

    for change in changes {
        let property = change.property.trim();
        if change.after.len() > if property == "textContent" { MAX_TEXT_BYTES } else { MAX_ATTRIBUTE_BYTES } {
            return Ok(codex(format!("{property} exceeds the bounded content-edit value size.")));
        }
        if change.after.chars().any(|ch| ch == '\0' || (ch.is_control() && !matches!(ch, '\n' | '\r' | '\t'))) {
            return Ok(codex(format!("{property} contains unsupported control characters.")));
        }

        if property == "textContent" {
            if selection.direct_text.is_empty() || selection.direct_text.len() > MAX_TEXT_BYTES {
                return Ok(codex("Complete live direct text is unavailable within the bounded editor limit."));
            }
            let Some((start, end, raw)) = simple_text_body(&owner.content, &owner.tag) else {
                return Ok(codex("Text owner is not one static direct JSX text body; nested/dynamic content requires Codex."));
            };
            let Some(decoded) = decode_jsx_entities(&raw) else {
                return Ok(codex("Text source contains unsupported JSX/HTML entities; use Codex."));
            };
            let source_runtime = normalize_runtime_text(&decoded);
            let live = normalize_runtime_text(&selection.direct_text);
            if source_runtime != live || normalize_runtime_text(&change.before) != live {
                return Ok(codex("Live text does not exactly match the static source text owner."));
            }
            let encoded = encode_jsx_text(&change.after);
            edits.push(ResolvedEdit {
                public: ContentEditOperation {
                    kind: ContentEditKind::Text,
                    path: owner.path.clone(),
                    line: line_number(&owner.content, start),
                    tag: owner.tag.tag.clone(),
                    property: property.into(),
                    source_before: raw.clone(),
                    source_after: encoded.clone(),
                    owner_kind: "jsx-static-direct-text".into(),
                },
                start,
                end,
            });
            continue;
        }

        let Some(attribute_name) = allowed_attribute(property, &owner.tag.tag.to_ascii_lowercase()) else {
            return Ok(codex(format!("{property} is outside the explicit semantic DOM content registry.")));
        };
        let live = live_attribute(selection, property);
        if change.before != live {
            return Ok(codex(format!("Live {property} value changed before source ownership resolution.")));
        }
        match owner.tag.attribute(attribute_name) {
            Some(attribute) => {
                let JsxAttributeValue::Literal { value, value_start, value_end, quote } = &attribute.value else {
                    return Ok(codex(format!("{attribute_name} is dynamic/non-literal in source; use Codex.")));
                };
                let Some(decoded) = decode_jsx_entities(value) else {
                    return Ok(codex(format!("{attribute_name} contains unsupported entities; use Codex.")));
                };
                if decoded != live {
                    return Ok(codex(format!("Live {attribute_name} does not match its literal source value.")));
                }
                let encoded = encode_attr_value(&change.after, *quote);
                edits.push(ResolvedEdit {
                    public: ContentEditOperation {
                        kind: ContentEditKind::Attribute,
                        path: owner.path.clone(),
                        line: line_number(&owner.content, *value_start),
                        tag: owner.tag.tag.clone(),
                        property: property.into(),
                        source_before: value.clone(),
                        source_after: encoded.clone(),
                        owner_kind: "jsx-static-semantic-attribute".into(),
                    },
                    start: *value_start,
                    end: *value_end,
                });
            }
            None => {
                if !live.is_empty() {
                    return Ok(codex(format!("Live {attribute_name} exists but no literal source attribute was found.")));
                }
                let insert_at = if owner.content[owner.tag.start..owner.tag.end].trim_end().ends_with("/>") {
                    owner.tag.end.saturating_sub(2)
                } else {
                    owner.tag.end.saturating_sub(1)
                };
                let encoded = encode_attr_value(&change.after, b'"');
                let insertion = format!(" {attribute_name}=\"{encoded}\"");
                edits.push(ResolvedEdit {
                    public: ContentEditOperation {
                        kind: ContentEditKind::Attribute,
                        path: owner.path.clone(),
                        line: line_number(&owner.content, insert_at),
                        tag: owner.tag.tag.clone(),
                        property: property.into(),
                        source_before: String::new(),
                        source_after: insertion.clone(),
                        owner_kind: "jsx-static-semantic-attribute-insert".into(),
                    },
                    start: insert_at,
                    end: insert_at,
                });
            }
        }
    }

    let mut ranges: Vec<_> = edits.iter().map(|edit| (edit.start, edit.end)).collect();
    ranges.sort_unstable();
    if ranges.windows(2).any(|pair| pair[0].1 > pair[1].0) {
        return Ok(codex("Content source edit ranges overlap; deterministic batch is refused."));
    }

    Ok(ResolvedPlan {
        public: ContentEditProbe {
            mode: ContentEditMode::Deterministic,
            reason: format!("{} static JSX content/semantic source change(s) proven in one owner.", edits.len()),
            operations: edits.iter().map(|edit| edit.public.clone()).collect(),
        },
        edits,
        fingerprint: Some(fingerprint(&owner.content)),
    })
}

fn write_atomic(path: &Path, content: &str) -> Result<(), String> {
    let parent = path.parent().ok_or_else(|| "Content source file has no parent directory".to_string())?;
    let file_name = path.file_name().and_then(|value| value.to_str()).unwrap_or("content.tsx");
    let permissions = fs::metadata(path).map_err(|error| format!("Cannot read content source permissions: {error}"))?.permissions();
    let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
    let temp = parent.join(format!(".{file_name}.monument-content-{}-{nonce}.tmp", std::process::id()));
    let mut file = OpenOptions::new().write(true).create_new(true).open(&temp)
        .map_err(|error| format!("Cannot create atomic content transaction file: {error}"))?;
    let result = (|| -> Result<(), String> {
        file.write_all(content.as_bytes()).map_err(|error| format!("Cannot write content transaction: {error}"))?;
        file.flush().map_err(|error| format!("Cannot flush content transaction: {error}"))?;
        file.sync_all().map_err(|error| format!("Cannot sync content transaction: {error}"))?;
        fs::set_permissions(&temp, permissions).map_err(|error| format!("Cannot preserve content source permissions: {error}"))?;
        fs::rename(&temp, path).map_err(|error| format!("Cannot atomically replace content source: {error}"))?;
        Ok(())
    })();
    if result.is_err() { let _ = fs::remove_file(&temp); }
    result
}

#[tauri::command]
pub fn project_content_edit_probe(
    project_path: String,
    selection: ContentEditSelection,
    changes: Vec<ContentEditChange>,
) -> Result<ContentEditProbe, String> {
    let root = project_root(project_path)?;
    Ok(resolve(&root, &selection, &changes)?.public)
}

#[tauri::command]
pub fn project_content_transaction_preview(
    project_path: String,
    selection: ContentEditSelection,
    changes: Vec<ContentEditChange>,
) -> Result<ContentEditProbe, String> {
    project_content_edit_probe(project_path, selection, changes)
}

#[tauri::command]
pub fn project_content_transaction_commit(
    project_path: String,
    selection: ContentEditSelection,
    changes: Vec<ContentEditChange>,
) -> Result<ContentTransactionCommit, String> {
    let root = project_root(project_path.clone())?;
    let resolved = resolve(&root, &selection, &changes)?;
    if resolved.public.mode != ContentEditMode::Deterministic || resolved.edits.is_empty() {
        return Err(format!("Content source transaction is not deterministic: {}", resolved.public.reason));
    }
    let path_string = resolved.edits[0].public.path.clone();
    if resolved.edits.iter().any(|edit| edit.public.path != path_string) {
        return Err("Content transaction unexpectedly spans multiple files".into());
    }
    let path = root.join(&path_string);
    let metadata = fs::symlink_metadata(&path).map_err(|error| format!("Cannot inspect content transaction target: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Content source transaction refuses symlink or non-file targets".into());
    }
    let canonical = path.canonicalize().map_err(|error| format!("Cannot canonicalize content transaction target: {error}"))?;
    if !canonical.starts_with(&root) {
        return Err("Content source transaction target escapes project root".into());
    }
    let mut content = fs::read_to_string(&canonical).map_err(|error| format!("Cannot read content transaction target: {error}"))?;
    if Some(fingerprint(&content)) != resolved.fingerprint {
        return Err("Source changed after content transaction resolution; re-apply against current source".into());
    }
    for edit in &resolved.edits {
        let actual = content.get(edit.start..edit.end).ok_or_else(|| "Content source range changed after resolution".to_string())?;
        if actual != edit.public.source_before {
            return Err("Content source value changed after resolution; re-apply against current source".into());
        }
    }
    let mut ordered = resolved.edits.clone();
    ordered.sort_by(|left, right| right.start.cmp(&left.start).then_with(|| right.end.cmp(&left.end)));
    for edit in &ordered {
        content.replace_range(edit.start..edit.end, &edit.public.source_after);
    }

    let target_id = selection.id.clone().unwrap_or_default();
    let target_tag = selection.tag.trim().to_ascii_lowercase();
    if !opening_tags(&content).iter().any(|tag| {
        literal_attr(tag, "id").map(|(value, _, _)| value) == Some(target_id.as_str())
            && tag.tag.to_ascii_lowercase() == target_tag
    }) {
        return Err("Updated JSX/TSX failed bounded content-owner structural validation".into());
    }
    write_atomic(&canonical, &content)?;
    let kinds = ordered.iter().map(|edit| edit.public.kind).collect();
    Ok(ContentTransactionCommit { path: path_string, applied_count: ordered.len(), bytes_written: content.len(), kinds })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture(name: &str, source: &str) -> PathBuf {
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
        let root = std::env::temp_dir().join(format!("monument-content-{name}-{nonce}"));
        fs::create_dir_all(root.join("src")).unwrap();
        fs::write(root.join("src/App.tsx"), source).unwrap();
        root
    }

    fn selection(tag: &str, text: &str, attributes: serde_json::Value) -> ContentEditSelection {
        serde_json::from_value(serde_json::json!({
            "id": "hero",
            "idUnique": true,
            "tag": tag,
            "directText": text,
            "attributes": attributes,
        })).unwrap()
    }

    fn change(property: &str, before: &str, after: &str) -> ContentEditChange {
        serde_json::from_value(serde_json::json!({ "property": property, "before": before, "after": after })).unwrap()
    }

    #[test]
    fn edits_static_direct_text_atomically() {
        let root = fixture("text", r#"export const App=()=> <button id="hero">Hello world</button>;"#);
        project_content_transaction_commit(
            root.to_string_lossy().to_string(),
            selection("button", "Hello world", serde_json::json!({})),
            vec![change("textContent", "Hello world", "New <copy> {safe}")],
        ).unwrap();
        let source = fs::read_to_string(root.join("src/App.tsx")).unwrap();
        assert!(source.contains("New &lt;copy&gt; &#123;safe&#125;"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn nested_or_dynamic_text_stays_on_codex() {
        let root = fixture("dynamic", r#"export const App=()=> <button id="hero">Hello <strong>world</strong></button>;"#);
        let probe = project_content_edit_probe(
            root.to_string_lossy().to_string(),
            selection("button", "Hello world", serde_json::json!({})),
            vec![change("textContent", "Hello world", "New text")],
        ).unwrap();
        assert_eq!(probe.mode, ContentEditMode::Codex);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn updates_and_inserts_semantic_attributes_in_one_batch() {
        let root = fixture("attrs", r#"export const App=()=> <img id="hero" alt="Old" />;"#);
        project_content_transaction_commit(
            root.to_string_lossy().to_string(),
            selection("img", "", serde_json::json!({ "alt": "Old", "title": "" })),
            vec![change("alt", "Old", "New & better"), change("title", "", "Hero image")],
        ).unwrap();
        let source = fs::read_to_string(root.join("src/App.tsx")).unwrap();
        assert!(source.contains("alt=\"New &amp; better\""));
        assert!(source.contains("title=\"Hero image\""));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn attribute_spread_refuses_content_authority() {
        let root = fixture("spread", r#"export const App=()=> <img {...props} id="hero" alt="Old" />;"#);
        let probe = project_content_edit_probe(
            root.to_string_lossy().to_string(),
            selection("img", "", serde_json::json!({ "alt": "Old" })),
            vec![change("alt", "Old", "New")],
        ).unwrap();
        assert_eq!(probe.mode, ContentEditMode::Codex);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn unsupported_component_prop_is_never_treated_as_semantic_content() {
        let root = fixture("prop", r#"export const App=()=> <div id="hero" data-mode="a" />;"#);
        let probe = project_content_edit_probe(
            root.to_string_lossy().to_string(),
            selection("div", "", serde_json::json!({ "dataMode": "a" })),
            vec![change("dataMode", "a", "b")],
        ).unwrap();
        assert_eq!(probe.mode, ContentEditMode::Codex);
        let _ = fs::remove_dir_all(root);
    }
}
