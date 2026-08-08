use crate::jsx_source::{opening_tags, JsxAttributeValue, JsxOpeningTag};
use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::fs::{self, OpenOptions};
use std::hash::{Hash, Hasher};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_FILES: usize = 1_200;
const MAX_FILE_BYTES: u64 = 1_500_000;
const MAX_TOTAL_BYTES: u64 = 24_000_000;
const MAX_ID_BYTES: usize = 96;
const MAX_VALUE_BYTES: usize = 300;
const MAX_CLASS_TOKENS: usize = 256;
const MAX_CLASS_TOKEN_BYTES: usize = 220;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColorEditSelection {
    id: Option<String>,
    #[serde(default)]
    id_unique: bool,
    #[serde(default)]
    classes: Vec<String>,
    tag: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColorEditChange {
    property: String,
    before: String,
    after: String,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ColorEditMode {
    Deterministic,
    Codex,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ColorLane {
    Tailwind,
    JsxStyle,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ColorOperation {
    lane: ColorLane,
    path: String,
    line: usize,
    tag: String,
    attribute: String,
    property: String,
    source_before: String,
    source_after: String,
    owner_kind: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ColorEditProbe {
    mode: ColorEditMode,
    reason: String,
    operation: Option<ColorOperation>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ColorTransactionPlan {
    safe: bool,
    reason: String,
    operation: Option<ColorOperation>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ColorTransactionCommit {
    path: String,
    applied_count: usize,
    bytes_written: usize,
    lane: ColorLane,
    owner_kind: String,
}

#[derive(Debug, Clone)]
struct SourceElement {
    path: String,
    content: String,
    tag: JsxOpeningTag,
}

#[derive(Debug, Clone)]
struct ResolvedColorPlan {
    public: ColorEditProbe,
    replacement_start: Option<usize>,
    replacement_end: Option<usize>,
    fingerprint: Option<u64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct ColorValue {
    r: u8,
    g: u8,
    b: u8,
    a: u8,
}

#[derive(Debug)]
enum StyleColorOwner {
    None,
    Literal {
        color: ColorValue,
        source_before: String,
        start: usize,
        end: usize,
    },
    Dynamic(String),
}

fn skip_dir(name: &str) -> bool {
    matches!(
        name,
        ".git" | "node_modules" | "target" | "dist" | "build" | ".next" | ".nuxt"
            | ".output" | "coverage" | ".cache" | ".turbo" | ".vite"
    )
}

fn collect_sources(directory: &Path, files: &mut Vec<PathBuf>, total: &mut u64, truncated: &mut bool) {
    if files.len() >= MAX_FILES || *total >= MAX_TOTAL_BYTES {
        *truncated = true;
        return;
    }
    let Ok(entries) = fs::read_dir(directory) else { return; };
    let mut entries: Vec<_> = entries.filter_map(Result::ok).collect();
    entries.sort_by_key(|entry| entry.path());
    for entry in entries {
        if files.len() >= MAX_FILES || *total >= MAX_TOTAL_BYTES {
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

fn canonical_root(path: String) -> Result<PathBuf, String> {
    let root = PathBuf::from(path.trim())
        .canonicalize()
        .map_err(|error| format!("Cannot inspect markup color source: {error}"))?;
    if !root.is_dir() { return Err("Markup color transaction root is not a directory".into()); }
    Ok(root)
}

fn relative_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root).unwrap_or(path).to_string_lossy().replace('\\', "/")
}

fn fingerprint(content: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    content.as_bytes().hash(&mut hasher);
    hasher.finish()
}

fn line_number(content: &str, offset: usize) -> usize {
    content.as_bytes()[..offset.min(content.len())].iter().filter(|byte| **byte == b'\n').count() + 1
}

fn bounded_id(value: Option<&str>) -> Option<String> {
    let value = value?.trim();
    (!value.is_empty()
        && value.len() <= MAX_ID_BYTES
        && value.bytes().all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b':' | b'.')))
        .then(|| value.to_string())
}

fn real_dom_tag(tag: &str) -> bool {
    let mut chars = tag.chars();
    chars.next().is_some_and(|first| first.is_ascii_lowercase())
        && chars.all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-')
}

fn literal_attribute<'a>(tag: &'a JsxOpeningTag, name: &str) -> Option<&'a str> {
    match &tag.attribute(name)?.value {
        JsxAttributeValue::Literal { value, .. } => Some(value.as_str()),
        _ => None,
    }
}

fn find_source_element(root: &Path, selection: &ColorEditSelection) -> Result<Result<SourceElement, String>, String> {
    let Some(id) = bounded_id(selection.id.as_deref()) else {
        return Ok(Err("Direct color ownership requires a bounded literal DOM id.".into()));
    };
    if !selection.id_unique {
        return Ok(Err("Direct color ownership requires the selected live DOM id to be unique.".into()));
    }
    let tag_name = selection.tag.trim().to_ascii_lowercase();
    if !real_dom_tag(&tag_name) {
        return Ok(Err("Direct color editing is limited to real DOM elements; custom components stay on Codex.".into()));
    }
    let mut files = Vec::new();
    let mut total = 0u64;
    let mut truncated = false;
    collect_sources(root, &mut files, &mut total, &mut truncated);
    if truncated {
        return Ok(Err("JSX/TSX color source scan hit its bounded project limit; use Codex.".into()));
    }
    let mut matches = Vec::new();
    for path in files {
        let content = fs::read_to_string(&path)
            .map_err(|error| format!("Cannot read markup color source {}: {error}", path.display()))?;
        for tag in opening_tags(&content) {
            if tag.tag.to_ascii_lowercase() != tag_name || literal_attribute(&tag, "id") != Some(id.as_str()) {
                continue;
            }
            matches.push(SourceElement { path: relative_path(root, &path), content: content.clone(), tag });
            if matches.len() > 1 { break; }
        }
        if matches.len() > 1 { break; }
    }
    if matches.len() != 1 {
        return Ok(Err(if matches.is_empty() {
            "No unique literal JSX/TSX color owner matched the selected live id and DOM tag.".into()
        } else {
            "Multiple JSX/TSX elements use the selected literal id; color ownership is ambiguous.".into()
        }));
    }
    let element = matches.remove(0);
    if element.tag.has_spread {
        return Ok(Err("Owning JSX element contains an attribute spread; color ownership may be overridden dynamically.".into()));
    }
    if element.tag.duplicate_attribute_names().iter().any(|name| matches!(name.as_str(), "id" | "className" | "class" | "style")) {
        return Ok(Err("Owning JSX element contains duplicate id/class/style attributes; color ownership is ambiguous.".into()));
    }
    Ok(Ok(element))
}

fn parse_hex_digit(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

fn pair(a: u8, b: u8) -> Option<u8> {
    Some(parse_hex_digit(a)? * 16 + parse_hex_digit(b)?)
}

fn parse_hex(value: &str) -> Option<ColorValue> {
    let bytes = value.trim().as_bytes();
    if bytes.first() != Some(&b'#') { return None; }
    match bytes.len() {
        4 => {
            let r = parse_hex_digit(bytes[1])? * 17;
            let g = parse_hex_digit(bytes[2])? * 17;
            let b = parse_hex_digit(bytes[3])? * 17;
            Some(ColorValue { r, g, b, a: 255 })
        }
        5 => {
            let r = parse_hex_digit(bytes[1])? * 17;
            let g = parse_hex_digit(bytes[2])? * 17;
            let b = parse_hex_digit(bytes[3])? * 17;
            let a = parse_hex_digit(bytes[4])? * 17;
            Some(ColorValue { r, g, b, a })
        }
        7 => Some(ColorValue { r: pair(bytes[1], bytes[2])?, g: pair(bytes[3], bytes[4])?, b: pair(bytes[5], bytes[6])?, a: 255 }),
        9 => Some(ColorValue { r: pair(bytes[1], bytes[2])?, g: pair(bytes[3], bytes[4])?, b: pair(bytes[5], bytes[6])?, a: pair(bytes[7], bytes[8])? }),
        _ => None,
    }
}

fn parse_rgb_component(value: &str) -> Option<u8> {
    let value = value.trim();
    if let Some(percent) = value.strip_suffix('%') {
        let parsed: f64 = percent.trim().parse().ok()?;
        if !(0.0..=100.0).contains(&parsed) { return None; }
        return Some((parsed * 2.55).round().clamp(0.0, 255.0) as u8);
    }
    let parsed: f64 = value.parse().ok()?;
    if !(0.0..=255.0).contains(&parsed) { return None; }
    Some(parsed.round().clamp(0.0, 255.0) as u8)
}

fn parse_alpha(value: &str) -> Option<u8> {
    let value = value.trim();
    if let Some(percent) = value.strip_suffix('%') {
        let parsed: f64 = percent.trim().parse().ok()?;
        if !(0.0..=100.0).contains(&parsed) { return None; }
        return Some((parsed * 2.55).round().clamp(0.0, 255.0) as u8);
    }
    let parsed: f64 = value.parse().ok()?;
    if !(0.0..=1.0).contains(&parsed) { return None; }
    Some((parsed * 255.0).round().clamp(0.0, 255.0) as u8)
}

fn parse_rgb_function(value: &str) -> Option<ColorValue> {
    let value = value.trim();
    let lower = value.to_ascii_lowercase();
    let (prefix_len, valid) = if lower.starts_with("rgb(") { (4, true) }
        else if lower.starts_with("rgba(") { (5, true) }
        else { (0, false) };
    if !valid || !value.ends_with(')') { return None; }
    let inner = &value[prefix_len..value.len() - 1];
    let normalized = inner.replace(',', " ").replace('/', " / ");
    let parts: Vec<_> = normalized.split_ascii_whitespace().collect();
    let slash = parts.iter().position(|part| *part == "/");
    let (rgb, alpha) = if let Some(index) = slash {
        if index != 3 || parts.len() != 5 { return None; }
        (&parts[..3], Some(parts[4]))
    } else if parts.len() == 4 {
        (&parts[..3], Some(parts[3]))
    } else if parts.len() == 3 {
        (&parts[..], None)
    } else {
        return None;
    };
    Some(ColorValue {
        r: parse_rgb_component(rgb[0])?,
        g: parse_rgb_component(rgb[1])?,
        b: parse_rgb_component(rgb[2])?,
        a: alpha.map(parse_alpha).transpose()??.unwrap_or(255),
    })
}

trait OptionTranspose<T> {
    fn transpose(self) -> Option<Option<T>>;
}

impl<T> OptionTranspose<T> for Option<Option<T>> {
    fn transpose(self) -> Option<Option<T>> { Some(self?) }
}

fn parse_color(value: &str) -> Option<ColorValue> {
    let value = value.trim();
    if value.eq_ignore_ascii_case("transparent") {
        return Some(ColorValue { r: 0, g: 0, b: 0, a: 0 });
    }
    parse_hex(value).or_else(|| parse_rgb_function(value))
}

fn color_hex(color: ColorValue) -> String {
    if color.a == 255 {
        format!("#{:02x}{:02x}{:02x}", color.r, color.g, color.b)
    } else {
        format!("#{:02x}{:02x}{:02x}{:02x}", color.r, color.g, color.b, color.a)
    }
}

fn trim(content: &str, mut start: usize, mut end: usize) -> (usize, usize) {
    let bytes = content.as_bytes();
    while start < end && bytes[start].is_ascii_whitespace() { start += 1; }
    while end > start && bytes[end - 1].is_ascii_whitespace() { end -= 1; }
    (start, end)
}

fn style_segments(content: &str, start: usize, end: usize) -> Result<Vec<(usize, usize)>, String> {
    let bytes = content.as_bytes();
    let mut segments = Vec::new();
    let mut segment = start;
    let mut cursor = start;
    let mut quote: Option<u8> = None;
    let mut escaped = false;
    while cursor < end {
        let byte = bytes[cursor];
        if let Some(active) = quote {
            if escaped { escaped = false; }
            else if byte == b'\\' { escaped = true; }
            else if byte == active { quote = None; }
            cursor += 1;
            continue;
        }
        if matches!(byte, b'\'' | b'"') { quote = Some(byte); cursor += 1; continue; }
        if matches!(byte, b'{' | b'}' | b'[' | b']' | b'(' | b')' | b'`' | b'/') {
            return Err("Inline color style contains nested/computed/dynamic syntax; use Codex.".into());
        }
        if byte == b',' { segments.push((segment, cursor)); segment = cursor + 1; }
        cursor += 1;
    }
    if quote.is_some() { return Err("Inline color style contains an unterminated string.".into()); }
    segments.push((segment, end));
    Ok(segments)
}

fn style_key(value: &str) -> bool {
    let value = value.trim();
    !value.is_empty() && value.len() <= 80 && value.bytes().enumerate().all(|(index, byte)| byte.is_ascii_alphabetic() || byte == b'_' || (index > 0 && byte.is_ascii_digit()))
}

fn string_literal(content: &str, start: usize, end: usize) -> Option<String> {
    if end <= start + 1 { return None; }
    let bytes = content.as_bytes();
    let quote = bytes[start];
    if !matches!(quote, b'\'' | b'"') || bytes[end - 1] != quote { return None; }
    let inner = &content[start + 1..end - 1];
    (!inner.contains('\\')).then(|| inner.to_string())
}

fn inline_style_color(element: &SourceElement, property: &str) -> Result<StyleColorOwner, String> {
    let Some(attribute) = element.tag.attribute("style") else { return Ok(StyleColorOwner::None); };
    let (inner_start, inner_end) = match &attribute.value {
        JsxAttributeValue::Expression { inner_start, inner_end } => (*inner_start, *inner_end),
        _ => return Ok(StyleColorOwner::Dynamic("JSX color style attribute is not a literal object expression.".into())),
    };
    let (outer_start, outer_end) = trim(&element.content, inner_start, inner_end);
    let bytes = element.content.as_bytes();
    if outer_end <= outer_start + 1 || bytes[outer_start] != b'{' || bytes[outer_end - 1] != b'}' {
        return Ok(StyleColorOwner::Dynamic("JSX color style expression is dynamic rather than `style={{...}}`.".into()));
    }
    let mut target = None;
    for (segment_start, segment_end) in style_segments(&element.content, outer_start + 1, outer_end - 1)? {
        let (segment_start, segment_end) = trim(&element.content, segment_start, segment_end);
        if segment_start >= segment_end { continue; }
        let segment = &element.content[segment_start..segment_end];
        if segment.trim_start().starts_with("...") {
            return Ok(StyleColorOwner::Dynamic("Inline color style object contains a spread.".into()));
        }
        let Some(relative_colon) = segment.find(':') else {
            return Ok(StyleColorOwner::Dynamic("Inline color style contains shorthand/computed syntax.".into()));
        };
        let colon = segment_start + relative_colon;
        let (key_start, key_end) = trim(&element.content, segment_start, colon);
        let key = &element.content[key_start..key_end];
        if !style_key(key) { return Ok(StyleColorOwner::Dynamic("Inline color style contains a computed/non-literal key.".into())); }
        if key != property { continue; }
        if target.is_some() { return Ok(StyleColorOwner::Dynamic("Inline color style defines the requested property more than once.".into())); }
        let (value_start, value_end) = trim(&element.content, colon + 1, segment_end);
        let Some(literal) = string_literal(&element.content, value_start, value_end) else {
            return Ok(StyleColorOwner::Dynamic("Inline color property is not a bounded string literal.".into()));
        };
        let Some(color) = parse_color(&literal) else {
            return Ok(StyleColorOwner::Dynamic("Inline color literal is outside the deterministic hex/rgb/rgba grammar.".into()));
        };
        target = Some(StyleColorOwner::Literal { color, source_before: element.content[value_start..value_end].to_string(), start: value_start, end: value_end });
    }
    Ok(target.unwrap_or(StyleColorOwner::None))
}

fn class_tokens(value: &str) -> Result<Vec<(String, usize, usize)>, String> {
    let mut result = Vec::new();
    let bytes = value.as_bytes();
    let mut cursor = 0usize;
    while cursor < bytes.len() {
        while cursor < bytes.len() && bytes[cursor].is_ascii_whitespace() { cursor += 1; }
        let start = cursor;
        while cursor < bytes.len() && !bytes[cursor].is_ascii_whitespace() { cursor += 1; }
        if cursor == start { continue; }
        if cursor - start > MAX_CLASS_TOKEN_BYTES { return Err("Color class token exceeds the bounded token length.".into()); }
        if result.len() >= MAX_CLASS_TOKENS { return Err("Static color class list exceeds the bounded token count; use Codex.".into()); }
        result.push((value[start..cursor].to_string(), start, cursor));
    }
    Ok(result)
}

fn variant_base(token: &str) -> (bool, &str) {
    let mut bracket = 0i32;
    let mut escaped = false;
    let mut last = None;
    for (index, byte) in token.bytes().enumerate() {
        if escaped { escaped = false; continue; }
        if byte == b'\\' { escaped = true; continue; }
        match byte {
            b'[' => bracket += 1,
            b']' => bracket = (bracket - 1).max(0),
            b':' if bracket == 0 => last = Some(index),
            _ => {}
        }
    }
    last.map(|index| (true, &token[index + 1..])).unwrap_or((false, token))
}

fn decode_arbitrary(value: &str) -> String { value.replace('_', " ") }

fn bracket_value<'a>(base: &'a str, prefix: &str) -> Option<&'a str> {
    base.strip_prefix(prefix)?.strip_prefix('[')?.strip_suffix(']')
}

fn looks_text_non_color(base: &str) -> bool {
    matches!(
        base,
        "text-left" | "text-right" | "text-center" | "text-justify" | "text-start" | "text-end"
            | "text-ellipsis" | "text-clip" | "text-wrap" | "text-nowrap" | "text-balance" | "text-pretty"
            | "text-xs" | "text-sm" | "text-base" | "text-lg" | "text-xl" | "text-2xl" | "text-3xl"
            | "text-4xl" | "text-5xl" | "text-6xl" | "text-7xl" | "text-8xl" | "text-9xl"
    ) || bracket_value(base, "text-").is_some_and(|value| {
        let value = decode_arbitrary(value);
        value.ends_with("px") || value.ends_with("rem") || value.ends_with("em") || value.ends_with('%')
    })
}

fn looks_bg_non_color(base: &str) -> bool {
    matches!(
        base,
        "bg-fixed" | "bg-local" | "bg-scroll" | "bg-bottom" | "bg-center" | "bg-left" | "bg-left-bottom"
            | "bg-left-top" | "bg-right" | "bg-right-bottom" | "bg-right-top" | "bg-top" | "bg-repeat"
            | "bg-no-repeat" | "bg-repeat-x" | "bg-repeat-y" | "bg-round" | "bg-space" | "bg-auto" | "bg-cover" | "bg-contain"
    ) || base.starts_with("bg-gradient-") || base.starts_with("bg-linear-") || base.starts_with("bg-radial") || base.starts_with("bg-conic")
}

fn tailwind_color_owner(
    element: &SourceElement,
    selection: &ColorEditSelection,
    property: &str,
) -> Result<Result<Option<(ColorValue, ColorOperation, usize, usize)>, String>, String> {
    let class_name = element.tag.attribute("className");
    let class_attr = element.tag.attribute("class");
    if class_name.is_some() && class_attr.is_some() {
        return Ok(Err("Both className and class are present; color class ownership is ambiguous.".into()));
    }
    let (attribute_name, value, absolute_start) = match class_name.or(class_attr) {
        Some(attribute) => match &attribute.value {
            JsxAttributeValue::Literal { value, value_start, .. } => (if class_name.is_some() { "className" } else { "class" }, value.as_str(), *value_start),
            _ => return Ok(Err("Tailwind color direct editing requires a static literal className/class.".into())),
        },
        None => return Ok(Ok(None)),
    };
    let prefix = if property == "color" { "text-" } else { "bg-" };
    let live: Vec<&str> = selection.classes.iter().map(String::as_str).collect();
    let mut possible = Vec::new();
    let mut deterministic = Vec::new();
    for (token, relative_start, relative_end) in class_tokens(value)? {
        let (variant, base) = variant_base(&token);
        let important = base.starts_with('!') || token.starts_with('!');
        let base = base.strip_prefix('!').unwrap_or(base);
        if !base.starts_with(prefix) { continue; }
        let known_non_color = if property == "color" { looks_text_non_color(base) } else { looks_bg_non_color(base) };
        if known_non_color { continue; }
        possible.push((token.clone(), variant, important));
        let color = if base == format!("{prefix}transparent") {
            Some(ColorValue { r: 0, g: 0, b: 0, a: 0 })
        } else {
            bracket_value(base, prefix).and_then(|raw| parse_color(&decode_arbitrary(raw)))
        };
        if let Some(color) = color {
            deterministic.push((token, color, absolute_start + relative_start, absolute_start + relative_end, variant, important));
        }
    }
    if possible.is_empty() { return Ok(Ok(None)); }
    if possible.iter().any(|candidate| candidate.1) {
        return Ok(Err("Responsive/state Tailwind color ownership is present; direct color editing stays on Codex.".into()));
    }
    if possible.iter().any(|candidate| candidate.2) {
        return Ok(Err("Important-modifier Tailwind color ownership is not deterministic.".into()));
    }
    if possible.len() != 1 || deterministic.len() != 1 {
        return Ok(Err("Tailwind color source contains theme-dependent or multiple possible color owners; direct mutation is refused.".into()));
    }
    let (source_token, color, start, end, _, _) = deterministic.remove(0);
    if !live.iter().any(|value| *value == source_token.as_str()) {
        return Ok(Err("Source Tailwind color utility is absent from the selected live element.".into()));
    }
    Ok(Ok(Some((color, ColorOperation {
        lane: ColorLane::Tailwind,
        path: element.path.clone(),
        line: line_number(&element.content, start),
        tag: element.tag.tag.clone(),
        attribute: attribute_name.into(),
        property: property.into(),
        source_before: source_token,
        source_after: String::new(),
        owner_kind: "tailwind-arbitrary-color".into(),
    }, start, end))))
}

fn codex(reason: impl Into<String>) -> ResolvedColorPlan {
    ResolvedColorPlan { public: ColorEditProbe { mode: ColorEditMode::Codex, reason: reason.into(), operation: None }, replacement_start: None, replacement_end: None, fingerprint: None }
}

fn deterministic(element: &SourceElement, operation: ColorOperation, start: usize, end: usize, reason: impl Into<String>) -> ResolvedColorPlan {
    ResolvedColorPlan { public: ColorEditProbe { mode: ColorEditMode::Deterministic, reason: reason.into(), operation: Some(operation) }, replacement_start: Some(start), replacement_end: Some(end), fingerprint: Some(fingerprint(&element.content)) }
}

fn resolve(root: &Path, selection: &ColorEditSelection, change: &ColorEditChange) -> Result<ResolvedColorPlan, String> {
    let property = change.property.trim();
    if !matches!(property, "color" | "backgroundColor") {
        return Ok(codex("Markup color lane supports color and backgroundColor only."));
    }
    if change.before.len() > MAX_VALUE_BYTES || change.after.len() > MAX_VALUE_BYTES {
        return Ok(codex("Color value exceeds the bounded color grammar."));
    }
    let Some(before) = parse_color(&change.before) else {
        return Ok(codex("Observed runtime color is outside the deterministic hex/rgb/rgba grammar."));
    };
    let Some(after) = parse_color(&change.after) else {
        return Ok(codex("Requested color is outside the deterministic hex/rgb/rgba grammar."));
    };
    if before == after { return Ok(codex("Requested color edit does not change the computed color.")); }
    let element = match find_source_element(root, selection)? { Ok(element) => element, Err(reason) => return Ok(codex(reason)) };

    match inline_style_color(&element, property)? {
        StyleColorOwner::Dynamic(reason) => return Ok(codex(reason)),
        StyleColorOwner::Literal { color, source_before, start, end } => {
            if color != before {
                return Ok(codex("JSX inline color literal does not match the observed computed color."));
            }
            let source_after = serde_json::to_string(&color_hex(after)).map_err(|error| error.to_string())?;
            return Ok(deterministic(&element, ColorOperation {
                lane: ColorLane::JsxStyle,
                path: element.path.clone(),
                line: line_number(&element.content, start),
                tag: element.tag.tag.clone(),
                attribute: "style".into(),
                property: property.into(),
                source_before,
                source_after,
                owner_kind: "jsx-inline-color-literal".into(),
            }, start, end, "Unique JSX inline color literal matches the observed computed color."));
        }
        StyleColorOwner::None => {}
    }

    match tailwind_color_owner(&element, selection, property)? {
        Err(reason) => Ok(codex(reason)),
        Ok(None) => Ok(codex("No deterministic JSX inline color or Tailwind arbitrary color owner was proven.")),
        Ok(Some((source_color, mut operation, start, end))) => {
            if source_color != before {
                return Ok(codex("Tailwind arbitrary color does not match the observed computed color."));
            }
            let prefix = if property == "color" { "text-" } else { "bg-" };
            operation.source_after = format!("{prefix}[{}]", color_hex(after));
            Ok(deterministic(&element, operation, start, end, "Unique static Tailwind arbitrary color matches the observed computed color."))
        }
    }
}

fn write_atomic(path: &Path, content: &str) -> Result<(), String> {
    let parent = path.parent().ok_or_else(|| "Color source file has no parent directory".to_string())?;
    let file_name = path.file_name().and_then(|value| value.to_str()).unwrap_or("source.tsx");
    let permissions = fs::metadata(path).map_err(|error| format!("Cannot read color source permissions: {error}"))?.permissions();
    let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
    let temp = parent.join(format!(".{file_name}.monument-color-{}-{nonce}.tmp", std::process::id()));
    let mut file = OpenOptions::new().write(true).create_new(true).open(&temp)
        .map_err(|error| format!("Cannot create atomic color transaction file: {error}"))?;
    let result = (|| -> Result<(), String> {
        file.write_all(content.as_bytes()).map_err(|error| format!("Cannot write atomic color transaction: {error}"))?;
        file.flush().map_err(|error| format!("Cannot flush atomic color transaction: {error}"))?;
        file.sync_all().map_err(|error| format!("Cannot sync atomic color transaction: {error}"))?;
        fs::set_permissions(&temp, permissions).map_err(|error| format!("Cannot preserve color source permissions: {error}"))?;
        fs::rename(&temp, path).map_err(|error| format!("Cannot atomically replace color source file: {error}"))?;
        Ok(())
    })();
    if result.is_err() { let _ = fs::remove_file(&temp); }
    result
}

#[tauri::command]
pub fn project_markup_color_edit_probe(project_path: String, selection: ColorEditSelection, change: ColorEditChange) -> Result<ColorEditProbe, String> {
    let root = canonical_root(project_path)?;
    Ok(resolve(&root, &selection, &change)?.public)
}

#[tauri::command]
pub fn project_markup_color_transaction_preview(project_path: String, selection: ColorEditSelection, change: ColorEditChange) -> Result<ColorTransactionPlan, String> {
    let root = canonical_root(project_path)?;
    let resolved = resolve(&root, &selection, &change)?;
    Ok(ColorTransactionPlan { safe: resolved.public.mode == ColorEditMode::Deterministic && resolved.public.operation.is_some(), reason: resolved.public.reason, operation: resolved.public.operation })
}

#[tauri::command]
pub fn project_markup_color_transaction_commit(project_path: String, selection: ColorEditSelection, change: ColorEditChange) -> Result<ColorTransactionCommit, String> {
    let root = canonical_root(project_path)?;
    let resolved = resolve(&root, &selection, &change)?;
    if resolved.public.mode != ColorEditMode::Deterministic {
        return Err(format!("Markup color transaction is not deterministic: {}", resolved.public.reason));
    }
    let operation = resolved.public.operation.ok_or_else(|| "Color operation disappeared during commit resolution".to_string())?;
    let start = resolved.replacement_start.ok_or_else(|| "Color replacement range missing".to_string())?;
    let end = resolved.replacement_end.ok_or_else(|| "Color replacement range missing".to_string())?;
    let expected = resolved.fingerprint.ok_or_else(|| "Color source fingerprint missing".to_string())?;
    let path = root.join(&operation.path);
    let metadata = fs::symlink_metadata(&path).map_err(|error| format!("Cannot inspect color transaction target: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() { return Err("Markup color transaction refuses symlink or non-file targets".into()); }
    let canonical = path.canonicalize().map_err(|error| format!("Cannot canonicalize color transaction target: {error}"))?;
    if !canonical.starts_with(&root) { return Err("Markup color transaction target escapes project root".into()); }
    let mut content = fs::read_to_string(&canonical).map_err(|error| format!("Cannot read color transaction target: {error}"))?;
    if fingerprint(&content) != expected { return Err("Source changed after markup color resolution; re-apply against current source".into()); }
    let actual = content.get(start..end).ok_or_else(|| "Color source range changed after resolution".to_string())?;
    if actual != operation.source_before { return Err("Color source value changed after resolution; re-apply against current source".into()); }
    content.replace_range(start..end, &operation.source_after);
    let target_id = selection.id.clone().unwrap_or_default();
    if !opening_tags(&content).iter().any(|tag| literal_attribute(tag, "id") == Some(target_id.as_str()) && tag.tag.to_ascii_lowercase() == selection.tag.trim().to_ascii_lowercase()) {
        return Err("Updated JSX/TSX failed bounded color owner structural validation".into());
    }
    write_atomic(&canonical, &content)?;
    Ok(ColorTransactionCommit { path: operation.path, applied_count: 1, bytes_written: content.len(), lane: operation.lane, owner_kind: operation.owner_kind })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture(name: &str, source: &str, classes: &[&str]) -> (PathBuf, ColorEditSelection) {
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
        let root = std::env::temp_dir().join(format!("monument-color-{name}-{nonce}"));
        fs::create_dir_all(root.join("src")).unwrap();
        fs::write(root.join("src/App.tsx"), source).unwrap();
        (root, ColorEditSelection { id: Some("hero".into()), id_unique: true, classes: classes.iter().map(|value| value.to_string()).collect(), tag: "div".into() })
    }

    fn change(property: &str, before: &str, after: &str) -> ColorEditChange {
        ColorEditChange { property: property.into(), before: before.into(), after: after.into() }
    }

    #[test]
    fn canonicalizes_hex_rgb_and_alpha() {
        assert_eq!(parse_color("#fff"), parse_color("rgb(255, 255, 255)"));
        assert_eq!(parse_color("#ff000080"), parse_color("rgba(255, 0, 0, 0.502)"));
        assert_eq!(parse_color("rgb(100% 0% 0% / 50%)"), parse_color("#ff000080"));
    }

    #[test]
    fn edits_tailwind_arbitrary_text_color() {
        let (root, selection) = fixture("text", r#"export const App=()=> <div id="hero" className="text-[#ff0000] text-center"/>;"#, &["text-[#ff0000]", "text-center"]);
        let edit = change("color", "rgb(255, 0, 0)", "#00ff00");
        let plan = resolve(&root, &selection, &edit).unwrap();
        assert_eq!(plan.public.mode, ColorEditMode::Deterministic);
        project_markup_color_transaction_commit(root.to_string_lossy().to_string(), selection, edit).unwrap();
        assert!(fs::read_to_string(root.join("src/App.tsx")).unwrap().contains("text-[#00ff00]"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn edits_tailwind_arbitrary_background_color() {
        let (root, selection) = fixture("background", r#"export const App=()=> <div id="hero" className="bg-[#112233] bg-cover"/>;"#, &["bg-[#112233]", "bg-cover"]);
        let edit = change("backgroundColor", "rgb(17, 34, 51)", "rgba(255, 0, 0, 0.5)");
        let plan = resolve(&root, &selection, &edit).unwrap();
        assert_eq!(plan.public.mode, ColorEditMode::Deterministic);
        project_markup_color_transaction_commit(root.to_string_lossy().to_string(), selection, edit).unwrap();
        assert!(fs::read_to_string(root.join("src/App.tsx")).unwrap().contains("bg-[#ff000080]"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn edits_jsx_inline_color_literal_and_preserves_cascade_priority() {
        let (root, selection) = fixture("inline", r#"export const App=()=> <div id="hero" style={{ color: '#ff0000' }} className="text-[#0000ff]"/>;"#, &["text-[#0000ff]"]);
        let edit = change("color", "rgb(255, 0, 0)", "#00ff00");
        let plan = resolve(&root, &selection, &edit).unwrap();
        assert_eq!(plan.public.operation.as_ref().unwrap().lane, ColorLane::JsxStyle);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn named_theme_colors_and_variants_stay_on_codex() {
        for (name, classes) in [
            ("named", "text-red-500"),
            ("variant", "text-[#ff0000] hover:text-[#00ff00]"),
            ("multiple", "text-[#ff0000] text-[#00ff00]"),
        ] {
            let live: Vec<_> = classes.split_ascii_whitespace().collect();
            let source = format!(r#"export const App=()=> <div id="hero" className="{classes}"/>;"#);
            let (root, selection) = fixture(name, &source, &live);
            let plan = resolve(&root, &selection, &change("color", "rgb(255, 0, 0)", "#0000ff")).unwrap();
            assert_eq!(plan.public.mode, ColorEditMode::Codex);
            let _ = fs::remove_dir_all(root);
        }
    }

    #[test]
    fn dynamic_inline_color_blocks_tailwind_fallback() {
        let (root, selection) = fixture("dynamic", r#"export const App=()=> <div id="hero" style={{ ...style }} className="text-[#ff0000]"/>;"#, &["text-[#ff0000]"]);
        let plan = resolve(&root, &selection, &change("color", "rgb(255, 0, 0)", "#00ff00")).unwrap();
        assert_eq!(plan.public.mode, ColorEditMode::Codex);
        assert!(plan.public.reason.contains("spread"));
        let _ = fs::remove_dir_all(root);
    }
}
