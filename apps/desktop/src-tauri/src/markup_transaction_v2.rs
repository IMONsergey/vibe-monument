use crate::jsx_source::{opening_tags, JsxAttributeValue, JsxOpeningTag};
use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::fs::{self, OpenOptions};
use std::hash::{Hash, Hasher};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_MARKUP_FILES: usize = 1_200;
const MAX_FILE_BYTES: u64 = 1_500_000;
const MAX_TOTAL_BYTES: u64 = 24_000_000;
const MAX_VALUE_BYTES: usize = 300;
const MAX_ID_BYTES: usize = 96;
const MAX_CLASS_TOKEN_BYTES: usize = 220;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkupEditSelection {
    id: Option<String>,
    #[serde(default)]
    id_unique: bool,
    #[serde(default)]
    classes: Vec<String>,
    tag: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkupEditChange {
    property: String,
    before: String,
    after: String,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum MarkupEditMode {
    Deterministic,
    Codex,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum MarkupLane {
    Tailwind,
    JsxStyle,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkupOperation {
    lane: MarkupLane,
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
pub struct MarkupEditProbe {
    mode: MarkupEditMode,
    reason: String,
    operation: Option<MarkupOperation>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkupTransactionPlan {
    safe: bool,
    reason: String,
    operation: Option<MarkupOperation>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkupTransactionCommit {
    path: String,
    applied_count: usize,
    bytes_written: usize,
    lane: MarkupLane,
    owner_kind: String,
}

#[derive(Debug, Clone)]
struct SourceElement {
    path: String,
    content: String,
    tag: JsxOpeningTag,
}

#[derive(Debug, Clone)]
struct ResolvedPlan {
    public: MarkupEditProbe,
    replacement_start: Option<usize>,
    replacement_end: Option<usize>,
    fingerprint: Option<u64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum UtilityFamily {
    Width,
    Height,
    MinWidth,
    MaxWidth,
    MinHeight,
    MaxHeight,
    Gap,
    PaddingTop,
    PaddingRight,
    PaddingBottom,
    PaddingLeft,
    MarginTop,
    MarginRight,
    MarginBottom,
    MarginLeft,
    Display,
    Position,
    FlexDirection,
    FlexWrap,
    AlignItems,
    JustifyContent,
    FontSize,
    FontWeight,
    LineHeight,
    LetterSpacing,
    TextAlign,
    BorderRadius,
    Opacity,
    Overflow,
    ZIndex,
}

#[derive(Debug)]
enum InlineStyleOwner {
    None,
    Literal {
        semantic_before: String,
        source_before: String,
        start: usize,
        end: usize,
    },
    Dynamic(String),
}

fn should_skip_dir(name: &str) -> bool {
    matches!(
        name,
        ".git" | "node_modules" | "target" | "dist" | "build" | ".next" | ".nuxt"
            | ".output" | "coverage" | ".cache" | ".turbo" | ".vite"
    )
}

fn collect_markup_sources(
    directory: &Path,
    files: &mut Vec<PathBuf>,
    total_bytes: &mut u64,
    truncated: &mut bool,
) {
    if files.len() >= MAX_MARKUP_FILES || *total_bytes >= MAX_TOTAL_BYTES {
        *truncated = true;
        return;
    }
    let Ok(entries) = fs::read_dir(directory) else { return; };
    let mut entries: Vec<_> = entries.filter_map(Result::ok).collect();
    entries.sort_by_key(|entry| entry.path());
    for entry in entries {
        if files.len() >= MAX_MARKUP_FILES || *total_bytes >= MAX_TOTAL_BYTES {
            *truncated = true;
            break;
        }
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let Ok(kind) = entry.file_type() else { continue; };
        if kind.is_symlink() { continue; }
        if kind.is_dir() {
            if !should_skip_dir(&name) && !name.starts_with(".env") {
                collect_markup_sources(&path, files, total_bytes, truncated);
            }
            continue;
        }
        if !matches!(path.extension().and_then(|value| value.to_str()), Some("tsx") | Some("jsx")) {
            continue;
        }
        let Ok(metadata) = entry.metadata() else { continue; };
        let size = metadata.len();
        if size > MAX_FILE_BYTES || total_bytes.saturating_add(size) > MAX_TOTAL_BYTES {
            *truncated = true;
            continue;
        }
        *total_bytes += size;
        files.push(path);
    }
}

fn project_root(path: String) -> Result<PathBuf, String> {
    let root = PathBuf::from(path.trim())
        .canonicalize()
        .map_err(|error| format!("Cannot inspect markup source: {error}"))?;
    if !root.is_dir() { return Err("Markup transaction root is not a directory".into()); }
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

fn literal_attribute(tag: &JsxOpeningTag, name: &str) -> Option<(String, usize, usize)> {
    let attribute = tag.attribute(name)?;
    match &attribute.value {
        JsxAttributeValue::Literal { value, value_start, value_end, .. } => {
            Some((value.clone(), *value_start, *value_end))
        }
        _ => None,
    }
}

fn real_dom_tag(tag: &str) -> bool {
    let mut chars = tag.chars();
    chars.next().is_some_and(|first| first.is_ascii_lowercase())
        && chars.all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-')
}

fn find_source_element(root: &Path, selection: &MarkupEditSelection) -> Result<Result<SourceElement, String>, String> {
    let Some(id) = bounded_id(selection.id.as_deref()) else {
        return Ok(Err("Direct JSX/Tailwind ownership requires a bounded literal DOM id.".into()));
    };
    if !selection.id_unique {
        return Ok(Err("Direct JSX/Tailwind ownership requires the selected live DOM id to be unique.".into()));
    }
    let tag_name = selection.tag.trim().to_ascii_lowercase();
    if !real_dom_tag(&tag_name) {
        return Ok(Err("Direct markup editing is limited to real DOM elements; custom component ownership stays on Codex.".into()));
    }

    let mut files = Vec::new();
    let mut total = 0u64;
    let mut truncated = false;
    collect_markup_sources(root, &mut files, &mut total, &mut truncated);
    if truncated {
        return Ok(Err("JSX/TSX source scan hit its bounded limit; deterministic ownership is unavailable.".into()));
    }
    let mut matches = Vec::new();
    for path in files {
        let content = fs::read_to_string(&path)
            .map_err(|error| format!("Cannot read markup source {}: {error}", path.display()))?;
        for tag in opening_tags(&content) {
            let Some((source_id, _, _)) = literal_attribute(&tag, "id") else { continue; };
            if source_id == id && tag.tag.to_ascii_lowercase() == tag_name {
                matches.push(SourceElement { path: relative_path(root, &path), content: content.clone(), tag });
                if matches.len() > 1 { break; }
            }
        }
        if matches.len() > 1 { break; }
    }
    if matches.len() != 1 {
        return Ok(Err(if matches.is_empty() {
            "No unique literal JSX/TSX owner matched the selected live id and DOM tag.".into()
        } else {
            "Multiple JSX/TSX elements use the selected literal id; direct ownership is ambiguous.".into()
        }));
    }
    let element = matches.remove(0);
    if element.tag.has_spread {
        return Ok(Err("Owning JSX element contains an attribute spread; id/class/style ownership may be overridden dynamically.".into()));
    }
    if element.tag.duplicate_attribute_names().iter().any(|name| matches!(name.as_str(), "id" | "className" | "class" | "style")) {
        return Ok(Err("Owning JSX element contains duplicate id/class/style attributes; direct ownership is ambiguous.".into()));
    }
    Ok(Ok(element))
}

fn canonical(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ").trim().to_ascii_lowercase()
}

fn values_equivalent(source: &str, runtime: &str) -> bool {
    let source = canonical(source);
    let runtime = canonical(runtime);
    if source == runtime { return true; }
    let zeros = ["0px", "0rem", "0em", "0%", "0vh", "0vw", "0vmin", "0vmax"];
    (source == "0" && zeros.contains(&runtime.as_str())) || (runtime == "0" && zeros.contains(&source.as_str()))
}

fn family(property: &str) -> Option<UtilityFamily> {
    Some(match property {
        "width" => UtilityFamily::Width,
        "height" => UtilityFamily::Height,
        "minWidth" => UtilityFamily::MinWidth,
        "maxWidth" => UtilityFamily::MaxWidth,
        "minHeight" => UtilityFamily::MinHeight,
        "maxHeight" => UtilityFamily::MaxHeight,
        "gap" => UtilityFamily::Gap,
        "paddingTop" => UtilityFamily::PaddingTop,
        "paddingRight" => UtilityFamily::PaddingRight,
        "paddingBottom" => UtilityFamily::PaddingBottom,
        "paddingLeft" => UtilityFamily::PaddingLeft,
        "marginTop" => UtilityFamily::MarginTop,
        "marginRight" => UtilityFamily::MarginRight,
        "marginBottom" => UtilityFamily::MarginBottom,
        "marginLeft" => UtilityFamily::MarginLeft,
        "display" => UtilityFamily::Display,
        "position" => UtilityFamily::Position,
        "flexDirection" => UtilityFamily::FlexDirection,
        "flexWrap" => UtilityFamily::FlexWrap,
        "alignItems" => UtilityFamily::AlignItems,
        "justifyContent" => UtilityFamily::JustifyContent,
        "fontSize" => UtilityFamily::FontSize,
        "fontWeight" => UtilityFamily::FontWeight,
        "lineHeight" => UtilityFamily::LineHeight,
        "letterSpacing" => UtilityFamily::LetterSpacing,
        "textAlign" => UtilityFamily::TextAlign,
        "borderRadius" => UtilityFamily::BorderRadius,
        "opacity" => UtilityFamily::Opacity,
        "overflow" => UtilityFamily::Overflow,
        "zIndex" => UtilityFamily::ZIndex,
        _ => return None,
    })
}

fn variant_base(token: &str) -> (bool, &str) {
    let mut bracket = 0i32;
    let mut escaped = false;
    let mut last_colon = None;
    for (index, byte) in token.bytes().enumerate() {
        if escaped { escaped = false; continue; }
        if byte == b'\\' { escaped = true; continue; }
        match byte {
            b'[' => bracket += 1,
            b']' => bracket = (bracket - 1).max(0),
            b':' if bracket == 0 => last_colon = Some(index),
            _ => {}
        }
    }
    last_colon.map(|index| (true, &token[index + 1..])).unwrap_or((false, token))
}

fn arbitrary<'a>(base: &'a str, prefix: &str) -> Option<&'a str> {
    base.strip_prefix(prefix)?.strip_prefix('[')?.strip_suffix(']')
}

fn numeric(value: &str, negative: bool) -> bool {
    let value = value.trim().to_ascii_lowercase();
    let raw = value.strip_suffix("px").unwrap_or(&value);
    let raw = if let Some(rest) = raw.strip_prefix('-') { if !negative { return false; } rest } else { raw };
    if raw.is_empty() { return false; }
    let mut dot = false;
    let mut digit = false;
    for byte in raw.bytes() {
        if byte == b'.' && !dot { dot = true; }
        else if byte.is_ascii_digit() { digit = true; }
        else { return false; }
    }
    digit
}

fn integer(value: &str) -> bool {
    let raw = value.trim().strip_prefix('-').unwrap_or(value.trim());
    !raw.is_empty() && raw.bytes().all(|byte| byte.is_ascii_digit())
}

fn simple_number(value: &str) -> bool {
    let raw = value.trim().strip_prefix('-').unwrap_or(value.trim());
    if raw.is_empty() { return false; }
    let mut dot = false;
    let mut digit = false;
    for byte in raw.bytes() {
        if byte == b'.' && !dot { dot = true; }
        else if byte.is_ascii_digit() { digit = true; }
        else { return false; }
    }
    digit
}

fn padding_conflict(family: UtilityFamily, base: &str) -> bool {
    match family {
        UtilityFamily::PaddingTop => base.starts_with("p-") || base.starts_with("py-") || base.starts_with("pt-"),
        UtilityFamily::PaddingRight => base.starts_with("p-") || base.starts_with("px-") || base.starts_with("pr-"),
        UtilityFamily::PaddingBottom => base.starts_with("p-") || base.starts_with("py-") || base.starts_with("pb-"),
        UtilityFamily::PaddingLeft => base.starts_with("p-") || base.starts_with("px-") || base.starts_with("pl-"),
        _ => false,
    }
}

fn margin_prefix(base: &str) -> &str { base.strip_prefix('-').unwrap_or(base) }

fn margin_conflict(family: UtilityFamily, base: &str) -> bool {
    let base = margin_prefix(base);
    match family {
        UtilityFamily::MarginTop => base.starts_with("m-") || base.starts_with("my-") || base.starts_with("mt-"),
        UtilityFamily::MarginRight => base.starts_with("m-") || base.starts_with("mx-") || base.starts_with("mr-"),
        UtilityFamily::MarginBottom => base.starts_with("m-") || base.starts_with("my-") || base.starts_with("mb-"),
        UtilityFamily::MarginLeft => base.starts_with("m-") || base.starts_with("mx-") || base.starts_with("ml-"),
        _ => false,
    }
}

fn conflicts(family: UtilityFamily, base: &str) -> bool {
    if padding_conflict(family, base) || margin_conflict(family, base) { return true; }
    match family {
        UtilityFamily::Width => base.starts_with("w-"),
        UtilityFamily::Height => base.starts_with("h-"),
        UtilityFamily::MinWidth => base.starts_with("min-w-"),
        UtilityFamily::MaxWidth => base.starts_with("max-w-"),
        UtilityFamily::MinHeight => base.starts_with("min-h-"),
        UtilityFamily::MaxHeight => base.starts_with("max-h-"),
        UtilityFamily::Gap => base.starts_with("gap-") || base.starts_with("gap-x-") || base.starts_with("gap-y-"),
        UtilityFamily::Display => matches!(base, "block" | "inline-block" | "inline" | "flex" | "inline-flex" | "grid" | "inline-grid" | "hidden" | "contents" | "flow-root"),
        UtilityFamily::Position => matches!(base, "static" | "relative" | "absolute" | "fixed" | "sticky"),
        UtilityFamily::FlexDirection => matches!(base, "flex-row" | "flex-row-reverse" | "flex-col" | "flex-col-reverse"),
        UtilityFamily::FlexWrap => matches!(base, "flex-wrap" | "flex-wrap-reverse" | "flex-nowrap"),
        UtilityFamily::AlignItems => base.starts_with("items-"),
        UtilityFamily::JustifyContent => base.starts_with("justify-"),
        UtilityFamily::FontSize => matches!(base, "text-xs" | "text-sm" | "text-base" | "text-lg" | "text-xl" | "text-2xl" | "text-3xl" | "text-4xl" | "text-5xl" | "text-6xl" | "text-7xl" | "text-8xl" | "text-9xl") || arbitrary(base, "text-").is_some_and(|value| numeric(value, false)),
        UtilityFamily::FontWeight => base.starts_with("font-"),
        UtilityFamily::LineHeight => base.starts_with("leading-"),
        UtilityFamily::LetterSpacing => margin_prefix(base).starts_with("tracking-"),
        UtilityFamily::TextAlign => matches!(base, "text-left" | "text-right" | "text-center" | "text-justify" | "text-start" | "text-end"),
        UtilityFamily::BorderRadius => base == "rounded" || base.starts_with("rounded-"),
        UtilityFamily::Opacity => base.starts_with("opacity-"),
        UtilityFamily::Overflow => base.starts_with("overflow-"),
        UtilityFamily::ZIndex => base.starts_with("z-"),
        UtilityFamily::PaddingTop | UtilityFamily::PaddingRight | UtilityFamily::PaddingBottom | UtilityFamily::PaddingLeft
        | UtilityFamily::MarginTop | UtilityFamily::MarginRight | UtilityFamily::MarginBottom | UtilityFamily::MarginLeft => false,
    }
}

fn exact_editable_prefix(family: UtilityFamily) -> Option<(&'static str, bool)> {
    Some(match family {
        UtilityFamily::Width => ("w-", false),
        UtilityFamily::Height => ("h-", false),
        UtilityFamily::MinWidth => ("min-w-", false),
        UtilityFamily::MaxWidth => ("max-w-", false),
        UtilityFamily::MinHeight => ("min-h-", false),
        UtilityFamily::MaxHeight => ("max-h-", false),
        UtilityFamily::Gap => ("gap-", false),
        UtilityFamily::PaddingTop => ("pt-", false),
        UtilityFamily::PaddingRight => ("pr-", false),
        UtilityFamily::PaddingBottom => ("pb-", false),
        UtilityFamily::PaddingLeft => ("pl-", false),
        UtilityFamily::MarginTop => ("mt-", true),
        UtilityFamily::MarginRight => ("mr-", true),
        UtilityFamily::MarginBottom => ("mb-", true),
        UtilityFamily::MarginLeft => ("ml-", true),
        UtilityFamily::FontSize => ("text-", false),
        UtilityFamily::LineHeight => ("leading-", false),
        UtilityFamily::LetterSpacing => ("tracking-", true),
        UtilityFamily::BorderRadius => ("rounded-", false),
        _ => return None,
    })
}

fn source_semantic(family: UtilityFamily, base: &str) -> Option<String> {
    let keyword = match family {
        UtilityFamily::Display => match base { "block" => Some("block"), "inline-block" => Some("inline-block"), "inline" => Some("inline"), "flex" => Some("flex"), "inline-flex" => Some("inline-flex"), "grid" => Some("grid"), "inline-grid" => Some("inline-grid"), "hidden" => Some("none"), "contents" => Some("contents"), "flow-root" => Some("flow-root"), _ => None },
        UtilityFamily::Position => matches!(base, "static" | "relative" | "absolute" | "fixed" | "sticky").then_some(base),
        UtilityFamily::FlexDirection => match base { "flex-row" => Some("row"), "flex-row-reverse" => Some("row-reverse"), "flex-col" => Some("column"), "flex-col-reverse" => Some("column-reverse"), _ => None },
        UtilityFamily::FlexWrap => match base { "flex-wrap" => Some("wrap"), "flex-wrap-reverse" => Some("wrap-reverse"), "flex-nowrap" => Some("nowrap"), _ => None },
        UtilityFamily::AlignItems => match base { "items-start" => Some("flex-start"), "items-end" => Some("flex-end"), "items-center" => Some("center"), "items-baseline" => Some("baseline"), "items-stretch" => Some("stretch"), _ => None },
        UtilityFamily::JustifyContent => match base { "justify-start" => Some("flex-start"), "justify-end" => Some("flex-end"), "justify-center" => Some("center"), "justify-between" => Some("space-between"), "justify-around" => Some("space-around"), "justify-evenly" => Some("space-evenly"), "justify-stretch" => Some("stretch"), _ => None },
        UtilityFamily::TextAlign => match base { "text-left" => Some("left"), "text-right" => Some("right"), "text-center" => Some("center"), "text-justify" => Some("justify"), "text-start" => Some("start"), "text-end" => Some("end"), _ => None },
        UtilityFamily::Overflow => match base { "overflow-auto" => Some("auto"), "overflow-hidden" => Some("hidden"), "overflow-clip" => Some("clip"), "overflow-visible" => Some("visible"), "overflow-scroll" => Some("scroll"), _ => None },
        UtilityFamily::FontWeight => match base { "font-thin" => Some("100"), "font-extralight" => Some("200"), "font-light" => Some("300"), "font-normal" => Some("400"), "font-medium" => Some("500"), "font-semibold" => Some("600"), "font-bold" => Some("700"), "font-extrabold" => Some("800"), "font-black" => Some("900"), _ => None },
        _ => None,
    };
    if let Some(value) = keyword { return Some(value.to_string()); }

    if family == UtilityFamily::FontWeight {
        return arbitrary(base, "font-").filter(|value| integer(value)).map(ToString::to_string);
    }
    if family == UtilityFamily::Opacity {
        return arbitrary(base, "opacity-").filter(|value| simple_number(value)).map(ToString::to_string);
    }
    if family == UtilityFamily::ZIndex {
        if base == "z-auto" { return Some("auto".into()); }
        return arbitrary(base, "z-").filter(|value| integer(value)).map(ToString::to_string);
    }
    let (prefix, negative) = exact_editable_prefix(family)?;
    let (is_negative, normalized) = if negative { base.strip_prefix('-').map(|value| (true, value)).unwrap_or((false, base)) } else { (false, base) };
    let value = arbitrary(normalized, prefix)?;
    if !numeric(value, false) { return None; }
    Some(if is_negative { format!("-{value}") } else { value.to_string() })
}

fn replacement_utility(family: UtilityFamily, after: &str) -> Option<String> {
    let after = after.trim().to_ascii_lowercase();
    let keyword = match family {
        UtilityFamily::Display => match after.as_str() { "block" => Some("block"), "inline-block" => Some("inline-block"), "inline" => Some("inline"), "flex" => Some("flex"), "inline-flex" => Some("inline-flex"), "grid" => Some("grid"), "inline-grid" => Some("inline-grid"), "none" => Some("hidden"), "contents" => Some("contents"), "flow-root" => Some("flow-root"), _ => None },
        UtilityFamily::Position => matches!(after.as_str(), "static" | "relative" | "absolute" | "fixed" | "sticky").then_some(after.as_str()),
        UtilityFamily::FlexDirection => match after.as_str() { "row" => Some("flex-row"), "row-reverse" => Some("flex-row-reverse"), "column" => Some("flex-col"), "column-reverse" => Some("flex-col-reverse"), _ => None },
        UtilityFamily::FlexWrap => match after.as_str() { "wrap" => Some("flex-wrap"), "wrap-reverse" => Some("flex-wrap-reverse"), "nowrap" => Some("flex-nowrap"), _ => None },
        UtilityFamily::AlignItems => match after.as_str() { "flex-start" => Some("items-start"), "flex-end" => Some("items-end"), "center" => Some("items-center"), "baseline" => Some("items-baseline"), "stretch" => Some("items-stretch"), _ => None },
        UtilityFamily::JustifyContent => match after.as_str() { "flex-start" => Some("justify-start"), "flex-end" => Some("justify-end"), "center" => Some("justify-center"), "space-between" => Some("justify-between"), "space-around" => Some("justify-around"), "space-evenly" => Some("justify-evenly"), "stretch" => Some("justify-stretch"), _ => None },
        UtilityFamily::TextAlign => match after.as_str() { "left" => Some("text-left"), "right" => Some("text-right"), "center" => Some("text-center"), "justify" => Some("text-justify"), "start" => Some("text-start"), "end" => Some("text-end"), _ => None },
        UtilityFamily::Overflow => match after.as_str() { "auto" => Some("overflow-auto"), "hidden" => Some("overflow-hidden"), "clip" => Some("overflow-clip"), "visible" => Some("overflow-visible"), "scroll" => Some("overflow-scroll"), _ => None },
        _ => None,
    };
    if let Some(value) = keyword { return Some(value.to_string()); }
    if family == UtilityFamily::Opacity && simple_number(&after) { return Some(format!("opacity-[{after}]")); }
    if family == UtilityFamily::ZIndex {
        if after == "auto" { return Some("z-auto".into()); }
        return integer(&after).then(|| format!("z-[{after}]"));
    }
    if family == UtilityFamily::FontWeight && integer(&after) { return Some(format!("font-[{after}]")); }
    let (prefix, negative) = exact_editable_prefix(family)?;
    if !numeric(&after, negative) { return None; }
    after.strip_prefix('-').map(|value| format!("-{prefix}[{value}]")).or_else(|| Some(format!("{prefix}[{after}]")))
}

fn class_tokens(value: &str, absolute_start: usize) -> Vec<(String, usize, usize)> {
    let mut result = Vec::new();
    let bytes = value.as_bytes();
    let mut cursor = 0usize;
    while cursor < bytes.len() {
        while cursor < bytes.len() && bytes[cursor].is_ascii_whitespace() { cursor += 1; }
        let start = cursor;
        while cursor < bytes.len() && !bytes[cursor].is_ascii_whitespace() { cursor += 1; }
        if cursor > start && cursor - start <= MAX_CLASS_TOKEN_BYTES {
            result.push((value[start..cursor].to_string(), absolute_start + start, absolute_start + cursor));
        }
    }
    result
}

fn tailwind_owner(element: &SourceElement, selection: &MarkupEditSelection, change: &MarkupEditChange) -> Result<Option<(MarkupOperation, usize, usize)>, String> {
    let Some(family) = family(change.property.trim()) else { return Ok(None); };
    let class_name = element.tag.attribute("className");
    let class_attr = element.tag.attribute("class");
    if class_name.is_some() && class_attr.is_some() {
        return Err("Both className and class are present; Tailwind ownership is ambiguous.".into());
    }
    let (attribute_name, attribute) = if let Some(attribute) = class_name { ("className", attribute) }
        else if let Some(attribute) = class_attr { ("class", attribute) }
        else { return Ok(None); };
    let (literal, value_start) = match &attribute.value {
        JsxAttributeValue::Literal { value, value_start, .. } => (value.as_str(), *value_start),
        _ => return Err("Tailwind direct editing requires a static literal className/class; dynamic clsx/cn/template composition stays on Codex.".into()),
    };

    let live_classes: Vec<&str> = selection.classes.iter().map(String::as_str).collect();
    let mut candidates = Vec::new();
    for (token, start, end) in class_tokens(literal, value_start) {
        let (variant, base) = variant_base(&token);
        let important = base.starts_with('!') || token.starts_with('!');
        let normalized = base.strip_prefix('!').unwrap_or(base);
        if conflicts(family, normalized) {
            candidates.push((token, start, end, variant, important, normalized.to_string()));
        }
    }
    if candidates.is_empty() { return Ok(None); }
    if candidates.iter().any(|candidate| candidate.3) {
        return Err("Responsive/state Tailwind ownership exists for this property; M2.3 refuses to flatten it into a base utility.".into());
    }
    if candidates.iter().any(|candidate| candidate.4) {
        return Err("Important-modifier Tailwind ownership is not deterministic in M2.3.".into());
    }
    if candidates.len() != 1 {
        return Err(format!("{} Tailwind shorthands/axis/side utilities can affect this property; direct replacement is ambiguous.", candidates.len()));
    }
    let (source_token, start, end, _, _, base) = candidates.remove(0);
    if !live_classes.iter().any(|value| *value == source_token.as_str()) {
        return Err("Source Tailwind utility is absent from the selected live element; ownership is stale or conditional.".into());
    }
    let Some(source_runtime) = source_semantic(family, &base) else {
        return Err("Tailwind utility is recognized but its runtime semantics depend on theme/config or an unsupported shorthand; use Codex.".into());
    };
    if !values_equivalent(&source_runtime, &change.before) {
        return Err(format!("Tailwind utility {source_token} does not match observed runtime value {}; direct ownership is unproven.", change.before));
    }
    let Some(replacement) = replacement_utility(family, &change.after) else {
        return Err("Requested value is outside the bounded deterministic Tailwind grammar; use Codex.".into());
    };
    if replacement == source_token { return Err("Requested Tailwind edit does not change source.".into()); }
    Ok(Some((MarkupOperation {
        lane: MarkupLane::Tailwind,
        path: element.path.clone(),
        line: line_number(&element.content, start),
        tag: element.tag.tag.clone(),
        attribute: attribute_name.into(),
        property: change.property.clone(),
        source_before: source_token,
        source_after: replacement,
        owner_kind: "literal-tailwind-utility".into(),
    }, start, end)))
}

fn trim(content: &str, mut start: usize, mut end: usize) -> (usize, usize) {
    let bytes = content.as_bytes();
    while start < end && bytes[start].is_ascii_whitespace() { start += 1; }
    while end > start && bytes[end - 1].is_ascii_whitespace() { end -= 1; }
    (start, end)
}

fn split_style_segments(content: &str, start: usize, end: usize) -> Result<Vec<(usize, usize)>, String> {
    let bytes = content.as_bytes();
    let mut result = Vec::new();
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
            return Err("Inline style object contains nested/computed/dynamic syntax; use Codex.".into());
        }
        if byte == b',' { result.push((segment, cursor)); segment = cursor + 1; }
        cursor += 1;
    }
    if quote.is_some() { return Err("Inline style object contains an unterminated string.".into()); }
    result.push((segment, end));
    Ok(result)
}

fn simple_style_key(value: &str) -> bool {
    let value = value.trim();
    !value.is_empty() && value.len() <= 80 && value.bytes().enumerate().all(|(index, byte)| byte.is_ascii_alphabetic() || byte == b'_' || (index > 0 && byte.is_ascii_digit()))
}

fn numeric_style_runtime(property: &str, value: &str) -> Option<String> {
    if !simple_number(value) { return None; }
    match property {
        "opacity" | "zIndex" | "fontWeight" => Some(value.trim().to_string()),
        "width" | "height" | "minWidth" | "maxWidth" | "minHeight" | "maxHeight" | "gap"
        | "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft"
        | "marginTop" | "marginRight" | "marginBottom" | "marginLeft"
        | "fontSize" | "borderRadius" | "letterSpacing" => {
            Some(if value.trim() == "0" { "0px".into() } else { format!("{}px", value.trim()) })
        }
        _ => None,
    }
}

fn string_literal(content: &str, start: usize, end: usize) -> Option<String> {
    if end <= start + 1 { return None; }
    let bytes = content.as_bytes();
    let quote = bytes[start];
    if !matches!(quote, b'\'' | b'"') || bytes[end - 1] != quote { return None; }
    let inner = &content[start + 1..end - 1];
    (!inner.contains('\\')).then(|| inner.to_string())
}

fn inline_style_owner(element: &SourceElement, property: &str) -> Result<InlineStyleOwner, String> {
    let Some(attribute) = element.tag.attribute("style") else { return Ok(InlineStyleOwner::None); };
    let (inner_start, inner_end) = match &attribute.value {
        JsxAttributeValue::Expression { inner_start, inner_end } => (*inner_start, *inner_end),
        _ => return Ok(InlineStyleOwner::Dynamic("JSX style attribute is not a literal object expression.".into())),
    };
    let (outer_start, outer_end) = trim(&element.content, inner_start, inner_end);
    let bytes = element.content.as_bytes();
    if outer_end <= outer_start + 1 || bytes[outer_start] != b'{' || bytes[outer_end - 1] != b'}' {
        return Ok(InlineStyleOwner::Dynamic("JSX style expression is dynamic rather than `style={{...}}`.".into()));
    }
    let mut target = None;
    for (segment_start, segment_end) in split_style_segments(&element.content, outer_start + 1, outer_end - 1)? {
        let (segment_start, segment_end) = trim(&element.content, segment_start, segment_end);
        if segment_start >= segment_end { continue; }
        let segment = &element.content[segment_start..segment_end];
        if segment.trim_start().starts_with("...") {
            return Ok(InlineStyleOwner::Dynamic("Inline style object contains a spread; requested property may be overridden dynamically.".into()));
        }
        let Some(relative_colon) = segment.find(':') else {
            return Ok(InlineStyleOwner::Dynamic("Inline style object contains shorthand/computed syntax.".into()));
        };
        let colon = segment_start + relative_colon;
        let (key_start, key_end) = trim(&element.content, segment_start, colon);
        let key = &element.content[key_start..key_end];
        if !simple_style_key(key) {
            return Ok(InlineStyleOwner::Dynamic("Inline style object contains a computed/non-literal key.".into()));
        }
        let (value_start, value_end) = trim(&element.content, colon + 1, segment_end);
        if key != property { continue; }
        if target.is_some() {
            return Ok(InlineStyleOwner::Dynamic("Inline style object defines the requested property more than once.".into()));
        }
        let source_before = element.content[value_start..value_end].to_string();
        let semantic_before = string_literal(&element.content, value_start, value_end)
            .or_else(|| numeric_style_runtime(property, &source_before));
        let Some(semantic_before) = semantic_before else {
            return Ok(InlineStyleOwner::Dynamic("Requested inline style property is not a bounded string/number literal.".into()));
        };
        target = Some(InlineStyleOwner::Literal { semantic_before, source_before, start: value_start, end: value_end });
    }
    Ok(target.unwrap_or(InlineStyleOwner::None))
}

fn inline_style_operation(element: &SourceElement, change: &MarkupEditChange) -> Result<Result<Option<(MarkupOperation, usize, usize)>, String>, String> {
    match inline_style_owner(element, change.property.trim())? {
        InlineStyleOwner::None => Ok(Ok(None)),
        InlineStyleOwner::Dynamic(reason) => Ok(Err(reason)),
        InlineStyleOwner::Literal { semantic_before, source_before, start, end } => {
            if !values_equivalent(&semantic_before, &change.before) {
                return Ok(Err(format!("JSX inline style literal {semantic_before} does not match observed runtime value {}; ownership is unproven.", change.before)));
            }
            if change.after.trim().is_empty() || change.after.len() > MAX_VALUE_BYTES {
                return Ok(Err("Requested JSX style value is outside the bounded edit grammar.".into()));
            }
            let replacement = serde_json::to_string(change.after.trim()).map_err(|error| format!("Cannot encode JSX style literal: {error}"))?;
            if replacement == source_before { return Ok(Err("Requested JSX style edit does not change source.".into())); }
            Ok(Ok(Some((MarkupOperation {
                lane: MarkupLane::JsxStyle,
                path: element.path.clone(),
                line: line_number(&element.content, start),
                tag: element.tag.tag.clone(),
                attribute: "style".into(),
                property: change.property.clone(),
                source_before,
                source_after: replacement,
                owner_kind: "jsx-inline-style-literal".into(),
            }, start, end))))
        }
    }
}

fn codex(reason: impl Into<String>) -> ResolvedPlan {
    ResolvedPlan { public: MarkupEditProbe { mode: MarkupEditMode::Codex, reason: reason.into(), operation: None }, replacement_start: None, replacement_end: None, fingerprint: None }
}

fn deterministic(element: &SourceElement, operation: MarkupOperation, start: usize, end: usize, reason: impl Into<String>) -> ResolvedPlan {
    ResolvedPlan { public: MarkupEditProbe { mode: MarkupEditMode::Deterministic, reason: reason.into(), operation: Some(operation) }, replacement_start: Some(start), replacement_end: Some(end), fingerprint: Some(fingerprint(&element.content)) }
}

fn resolve(root: &Path, selection: &MarkupEditSelection, change: &MarkupEditChange) -> Result<ResolvedPlan, String> {
    let property = change.property.trim();
    let before = change.before.trim();
    let after = change.after.trim();
    if property.is_empty() || property.len() > 80 || before.len() > MAX_VALUE_BYTES || after.len() > MAX_VALUE_BYTES || after.is_empty() || before == after {
        return Ok(codex("Markup visual edit is empty or outside the bounded property/value grammar."));
    }
    let element = match find_source_element(root, selection)? { Ok(element) => element, Err(reason) => return Ok(codex(reason)) };
    match inline_style_operation(&element, change)? {
        Err(reason) => return Ok(codex(reason)),
        Ok(Some((operation, start, end))) => return Ok(deterministic(&element, operation, start, end, "Unique live/source DOM owner and matching JSX inline-style literal proven.")),
        Ok(None) => {}
    }
    match tailwind_owner(&element, selection, change) {
        Ok(Some((operation, start, end))) => Ok(deterministic(&element, operation, start, end, "Unique live/source DOM owner and statically matching Tailwind utility proven.")),
        Ok(None) => Ok(codex("No deterministic JSX inline-style or Tailwind utility owner was proven for this property.")),
        Err(reason) => Ok(codex(reason)),
    }
}

fn write_atomic(path: &Path, content: &str) -> Result<(), String> {
    let parent = path.parent().ok_or_else(|| "Markup source file has no parent directory".to_string())?;
    let file_name = path.file_name().and_then(|value| value.to_str()).unwrap_or("source.tsx");
    let permissions = fs::metadata(path).map_err(|error| format!("Cannot read markup source permissions: {error}"))?.permissions();
    let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
    let temp = parent.join(format!(".{file_name}.monument-markup-{}-{nonce}.tmp", std::process::id()));
    let mut file = OpenOptions::new().write(true).create_new(true).open(&temp)
        .map_err(|error| format!("Cannot create atomic markup transaction file: {error}"))?;
    let result = (|| -> Result<(), String> {
        file.write_all(content.as_bytes()).map_err(|error| format!("Cannot write atomic markup transaction: {error}"))?;
        file.flush().map_err(|error| format!("Cannot flush atomic markup transaction: {error}"))?;
        file.sync_all().map_err(|error| format!("Cannot sync atomic markup transaction: {error}"))?;
        fs::set_permissions(&temp, permissions).map_err(|error| format!("Cannot preserve markup source permissions: {error}"))?;
        fs::rename(&temp, path).map_err(|error| format!("Cannot atomically replace markup source file: {error}"))?;
        Ok(())
    })();
    if result.is_err() { let _ = fs::remove_file(&temp); }
    result
}

#[tauri::command]
pub fn project_markup_edit_probe(project_path: String, selection: MarkupEditSelection, change: MarkupEditChange) -> Result<MarkupEditProbe, String> {
    let root = project_root(project_path)?;
    Ok(resolve(&root, &selection, &change)?.public)
}

#[tauri::command]
pub fn project_markup_transaction_preview(project_path: String, selection: MarkupEditSelection, change: MarkupEditChange) -> Result<MarkupTransactionPlan, String> {
    let root = project_root(project_path)?;
    let resolved = resolve(&root, &selection, &change)?;
    Ok(MarkupTransactionPlan { safe: resolved.public.mode == MarkupEditMode::Deterministic && resolved.public.operation.is_some(), reason: resolved.public.reason, operation: resolved.public.operation })
}

#[tauri::command]
pub fn project_markup_transaction_commit(project_path: String, selection: MarkupEditSelection, change: MarkupEditChange) -> Result<MarkupTransactionCommit, String> {
    let root = project_root(project_path)?;
    let resolved = resolve(&root, &selection, &change)?;
    if resolved.public.mode != MarkupEditMode::Deterministic {
        return Err(format!("Markup source transaction is not deterministic: {}", resolved.public.reason));
    }
    let operation = resolved.public.operation.ok_or_else(|| "Markup operation disappeared during commit resolution".to_string())?;
    let start = resolved.replacement_start.ok_or_else(|| "Markup replacement range missing".to_string())?;
    let end = resolved.replacement_end.ok_or_else(|| "Markup replacement range missing".to_string())?;
    let expected_fingerprint = resolved.fingerprint.ok_or_else(|| "Markup source fingerprint missing".to_string())?;
    let path = root.join(&operation.path);
    let metadata = fs::symlink_metadata(&path).map_err(|error| format!("Cannot inspect markup transaction target: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() { return Err("Markup source transaction refuses symlink or non-file targets".into()); }
    let canonical = path.canonicalize().map_err(|error| format!("Cannot canonicalize markup transaction target: {error}"))?;
    if !canonical.starts_with(&root) { return Err("Markup source transaction target escapes project root".into()); }
    let mut content = fs::read_to_string(&canonical).map_err(|error| format!("Cannot read markup transaction target: {error}"))?;
    if fingerprint(&content) != expected_fingerprint { return Err("Source changed after markup transaction resolution; re-apply against current source".into()); }
    let actual = content.get(start..end).ok_or_else(|| "Markup source range changed after resolution".to_string())?;
    if actual != operation.source_before { return Err("Markup source value changed after resolution; re-apply against current source".into()); }
    content.replace_range(start..end, &operation.source_after);
    let target_id = selection.id.clone().unwrap_or_default();
    if !opening_tags(&content).iter().any(|tag| literal_attribute(tag, "id").is_some_and(|(id, _, _)| id == target_id) && tag.tag.to_ascii_lowercase() == selection.tag.trim().to_ascii_lowercase()) {
        return Err("Updated JSX/TSX failed bounded opening-tag structural validation".into());
    }
    write_atomic(&canonical, &content)?;
    Ok(MarkupTransactionCommit { path: operation.path, applied_count: 1, bytes_written: content.len(), lane: operation.lane, owner_kind: operation.owner_kind })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture(name: &str) -> PathBuf {
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
        let root = std::env::temp_dir().join(format!("monument-markup-v2-{name}-{}-{nonce}", std::process::id()));
        fs::create_dir_all(root.join("src")).unwrap();
        root
    }

    fn selection(id: &str, classes: &[&str]) -> MarkupEditSelection {
        MarkupEditSelection { id: Some(id.into()), id_unique: true, classes: classes.iter().map(|value| value.to_string()).collect(), tag: "div".into() }
    }

    fn change(property: &str, before: &str, after: &str) -> MarkupEditChange {
        MarkupEditChange { property: property.into(), before: before.into(), after: after.into() }
    }

    #[test]
    fn edits_proven_arbitrary_tailwind_utility() {
        let root = fixture("tailwind");
        let path = root.join("src/App.tsx");
        fs::write(&path, r#"export const App=()=> <div id="hero" className="flex gap-[16px] rounded-[8px]"/>;"#).unwrap();
        let selected = selection("hero", &["flex", "gap-[16px]", "rounded-[8px]"]);
        let edit = change("gap", "16px", "24px");
        assert_eq!(resolve(&root, &selected, &edit).unwrap().public.mode, MarkupEditMode::Deterministic);
        project_markup_transaction_commit(root.to_string_lossy().to_string(), selected, edit).unwrap();
        assert!(fs::read_to_string(path).unwrap().contains("gap-[24px]"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn theme_scale_utility_stays_on_codex() {
        let root = fixture("theme");
        fs::write(root.join("src/App.tsx"), r#"export const App=()=> <div id="hero" className="gap-4"/>;"#).unwrap();
        let probe = resolve(&root, &selection("hero", &["gap-4"]), &change("gap", "16px", "24px")).unwrap();
        assert_eq!(probe.public.mode, MarkupEditMode::Codex);
        assert!(probe.public.reason.contains("theme/config"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn responsive_variant_blocks_base_edit() {
        let root = fixture("responsive");
        fs::write(root.join("src/App.tsx"), r#"export const App=()=> <div id="hero" className="gap-[16px] md:gap-[24px]"/>;"#).unwrap();
        let probe = resolve(&root, &selection("hero", &["gap-[16px]", "md:gap-[24px]"]), &change("gap", "16px", "20px")).unwrap();
        assert_eq!(probe.public.mode, MarkupEditMode::Codex);
        assert!(probe.public.reason.contains("Responsive/state"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn shorthand_and_axis_utilities_block_side_or_gap_edit() {
        let cases = [
            ("paddingTop", "p-[16px] pt-[8px]", &["p-[16px]", "pt-[8px]"][..]),
            ("paddingLeft", "px-[16px] pl-[8px]", &["px-[16px]", "pl-[8px]"][..]),
            ("marginTop", "my-[16px] mt-[8px]", &["my-[16px]", "mt-[8px]"][..]),
            ("gap", "gap-x-[16px] gap-[8px]", &["gap-x-[16px]", "gap-[8px]"][..]),
            ("overflow", "overflow-x-auto overflow-hidden", &["overflow-x-auto", "overflow-hidden"][..]),
        ];
        for (index, (property, classes, live)) in cases.iter().enumerate() {
            let root = fixture(&format!("conflict-{index}"));
            fs::write(root.join("src/App.tsx"), format!(r#"export const App=()=> <div id="hero" className="{classes}"/>;"#)).unwrap();
            let probe = resolve(&root, &selection("hero", live), &change(property, "8px", "12px")).unwrap();
            assert_eq!(probe.public.mode, MarkupEditMode::Codex, "{property} should refuse shorthand/axis ambiguity");
            let _ = fs::remove_dir_all(root);
        }
    }

    #[test]
    fn edits_matching_inline_style_literal_before_tailwind() {
        let root = fixture("style");
        let path = root.join("src/App.tsx");
        fs::write(&path, r#"export const App=()=> <div id="hero" style={{ gap: '16px', opacity: 1 }} className="gap-[99px]"/>;"#).unwrap();
        let selected = selection("hero", &["gap-[99px]"]);
        let edit = change("gap", "16px", "28px");
        let probe = resolve(&root, &selected, &edit).unwrap();
        assert_eq!(probe.public.operation.as_ref().unwrap().lane, MarkupLane::JsxStyle);
        project_markup_transaction_commit(root.to_string_lossy().to_string(), selected, edit).unwrap();
        let updated = fs::read_to_string(path).unwrap();
        assert!(updated.contains("gap: \"28px\""));
        assert!(updated.contains("gap-[99px]"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn dynamic_style_or_class_spread_has_no_write_authority() {
        for (name, source, reason) in [
            ("style-spread", r#"export const App=()=> <div id="hero" style={{ ...style }} className="gap-[16px]"/>;"#, "spread"),
            ("attribute-spread", r#"export const App=()=> <div id="hero" {...props} className="gap-[16px]"/>;"#, "attribute spread"),
            ("dynamic-class", r#"export const App=()=> <div id="hero" className={cn('gap-[16px]', active && 'flex')}/>;"#, "static literal className"),
        ] {
            let root = fixture(name);
            fs::write(root.join("src/App.tsx"), source).unwrap();
            let probe = resolve(&root, &selection("hero", &["gap-[16px]"]), &change("gap", "16px", "24px")).unwrap();
            assert_eq!(probe.public.mode, MarkupEditMode::Codex);
            assert!(probe.public.reason.to_ascii_lowercase().contains(&reason.to_ascii_lowercase()));
            let _ = fs::remove_dir_all(root);
        }
    }

    #[test]
    fn non_unique_live_id_has_no_write_authority() {
        let root = fixture("duplicate-live");
        fs::write(root.join("src/App.tsx"), r#"export const App=()=> <div id="hero" className="gap-[16px]"/>;"#).unwrap();
        let mut selected = selection("hero", &["gap-[16px]"]);
        selected.id_unique = false;
        assert_eq!(resolve(&root, &selected, &change("gap", "16px", "24px")).unwrap().public.mode, MarkupEditMode::Codex);
        let _ = fs::remove_dir_all(root);
    }
}
