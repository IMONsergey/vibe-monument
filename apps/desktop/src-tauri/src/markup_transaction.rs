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
struct ResolvedMarkupPlan {
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
enum StyleOwnership {
    None,
    Literal {
        semantic_before: String,
        replacement_start: usize,
        replacement_end: usize,
        source_before: String,
    },
    Dynamic(String),
}

fn should_skip_dir(name: &str) -> bool {
    matches!(
        name,
        ".git"
            | "node_modules"
            | "target"
            | "dist"
            | "build"
            | ".next"
            | ".nuxt"
            | ".output"
            | "coverage"
            | ".cache"
            | ".turbo"
            | ".vite"
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
    let Ok(entries) = fs::read_dir(directory) else {
        return;
    };
    let mut entries: Vec<_> = entries.filter_map(Result::ok).collect();
    entries.sort_by_key(|entry| entry.path());
    for entry in entries {
        if files.len() >= MAX_MARKUP_FILES || *total_bytes >= MAX_TOTAL_BYTES {
            *truncated = true;
            break;
        }
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            if !should_skip_dir(&name) && !name.starts_with(".env") {
                collect_markup_sources(&path, files, total_bytes, truncated);
            }
            continue;
        }
        let extension = path.extension().and_then(|value| value.to_str());
        if !matches!(extension, Some("tsx") | Some("jsx")) {
            continue;
        }
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        let size = metadata.len();
        if size > MAX_FILE_BYTES || total_bytes.saturating_add(size) > MAX_TOTAL_BYTES {
            *truncated = true;
            continue;
        }
        *total_bytes += size;
        files.push(path);
    }
}

fn project_root(project_path: String) -> Result<PathBuf, String> {
    let root = PathBuf::from(project_path.trim())
        .canonicalize()
        .map_err(|error| format!("Cannot inspect markup source: {error}"))?;
    if !root.is_dir() {
        return Err("Markup transaction root is not a directory".into());
    }
    Ok(root)
}

fn relative_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn file_fingerprint(content: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    content.as_bytes().hash(&mut hasher);
    hasher.finish()
}

fn line_number(content: &str, offset: usize) -> usize {
    content.as_bytes()[..offset.min(content.len())]
        .iter()
        .filter(|byte| **byte == b'\n')
        .count()
        + 1
}

fn safe_id(value: Option<&str>) -> Option<String> {
    let value = value?.trim();
    if value.is_empty() || value.len() > MAX_ID_BYTES {
        return None;
    }
    value
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b':' | b'.'))
        .then(|| value.to_string())
}

fn literal_attribute(tag: &JsxOpeningTag, name: &str) -> Option<(String, usize, usize)> {
    let attribute = tag.attribute(name)?;
    match &attribute.value {
        JsxAttributeValue::Literal {
            value,
            value_start,
            value_end,
            ..
        } => Some((value.clone(), *value_start, *value_end)),
        _ => None,
    }
}

fn direct_dom_tag(tag: &str) -> bool {
    let mut chars = tag.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    first.is_ascii_lowercase()
        && chars.all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-')
}

fn find_source_element(
    root: &Path,
    selection: &MarkupEditSelection,
) -> Result<Result<SourceElement, String>, String> {
    let Some(id) = safe_id(selection.id.as_deref()) else {
        return Ok(Err(
            "Tailwind/JSX direct editing currently requires a bounded literal DOM id.".into(),
        ));
    };
    if !selection.id_unique {
        return Ok(Err(
            "Tailwind/JSX direct editing requires the selected live DOM id to be unique.".into(),
        ));
    }
    let tag_name = selection.tag.trim().to_ascii_lowercase();
    if !direct_dom_tag(&tag_name) {
        return Ok(Err(
            "M2.3 direct markup editing is limited to real DOM elements, not custom components.".into(),
        ));
    }

    let mut files = Vec::new();
    let mut total_bytes = 0u64;
    let mut truncated = false;
    collect_markup_sources(root, &mut files, &mut total_bytes, &mut truncated);
    if truncated {
        return Ok(Err(
            "JSX/TSX source scan hit its bounded project limit; direct ownership is unproven.".into(),
        ));
    }
    if files.is_empty() {
        return Ok(Err(
            "No bounded JSX/TSX sources were found; keep this edit on Codex.".into(),
        ));
    }

    let mut matches = Vec::new();
    for path in files {
        let content = fs::read_to_string(&path)
            .map_err(|error| format!("Cannot read markup source {}: {error}", path.display()))?;
        for tag in opening_tags(&content) {
            let Some((source_id, _, _)) = literal_attribute(&tag, "id") else {
                continue;
            };
            if source_id != id || tag.tag.to_ascii_lowercase() != tag_name {
                continue;
            }
            matches.push(SourceElement {
                path: relative_path(root, &path),
                content: content.clone(),
                tag,
            });
            if matches.len() > 1 {
                break;
            }
        }
        if matches.len() > 1 {
            break;
        }
    }

    if matches.len() != 1 {
        return Ok(Err(if matches.is_empty() {
            "No unique literal JSX/TSX DOM owner matched the selected live id and tag.".into()
        } else {
            "Multiple JSX/TSX elements use the selected literal id; direct ownership is ambiguous.".into()
        }));
    }
    let element = matches.remove(0);
    if element.tag.has_spread {
        return Ok(Err(
            "The owning JSX element contains a spread attribute; id/class/style ownership may be overridden dynamically.".into(),
        ));
    }
    let duplicates = element.tag.duplicate_attribute_names();
    if duplicates.iter().any(|name| matches!(name.as_str(), "id" | "className" | "class" | "style")) {
        return Ok(Err(
            "The owning JSX element contains duplicate id/class/style attributes; direct ownership is ambiguous.".into(),
        ));
    }
    Ok(Ok(element))
}

fn canonical_value(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_ascii_lowercase()
}

fn values_equivalent(source: &str, runtime: &str) -> bool {
    let source = canonical_value(source);
    let runtime = canonical_value(runtime);
    if source == runtime {
        return true;
    }
    let zero_units = ["0px", "0rem", "0em", "0%", "0vh", "0vw", "0vmin", "0vmax"];
    (source == "0" && zero_units.contains(&runtime.as_str()))
        || (runtime == "0" && zero_units.contains(&source.as_str()))
}

fn family_for_property(property: &str) -> Option<UtilityFamily> {
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
    let bytes = token.as_bytes();
    let mut bracket_depth = 0i32;
    let mut escaped = false;
    let mut last_colon = None;
    for (index, byte) in bytes.iter().copied().enumerate() {
        if escaped {
            escaped = false;
            continue;
        }
        if byte == b'\\' {
            escaped = true;
            continue;
        }
        match byte {
            b'[' => bracket_depth += 1,
            b']' => bracket_depth = (bracket_depth - 1).max(0),
            b':' if bracket_depth == 0 => last_colon = Some(index),
            _ => {}
        }
    }
    match last_colon {
        Some(index) => (true, &token[index + 1..]),
        None => (false, token),
    }
}

fn arbitrary_value<'a>(base: &'a str, prefix: &str) -> Option<&'a str> {
    let start = base.strip_prefix(prefix)?.strip_prefix('[')?;
    start.strip_suffix(']')
}

fn is_px_value(value: &str, allow_negative: bool) -> bool {
    let value = value.trim().to_ascii_lowercase();
    if value == "0" || value == "0px" {
        return true;
    }
    let raw = value.strip_suffix("px").unwrap_or("");
    if raw.is_empty() {
        return false;
    }
    let raw = if let Some(rest) = raw.strip_prefix('-') {
        if !allow_negative {
            return false;
        }
        rest
    } else {
        raw
    };
    let mut dot = false;
    let mut digit = false;
    for byte in raw.bytes() {
        if byte == b'.' && !dot {
            dot = true;
        } else if byte.is_ascii_digit() {
            digit = true;
        } else {
            return false;
        }
    }
    digit
}

fn is_number(value: &str) -> bool {
    let value = value.trim();
    if value.is_empty() {
        return false;
    }
    let raw = value.strip_prefix('-').unwrap_or(value);
    let mut dot = false;
    let mut digit = false;
    for byte in raw.bytes() {
        if byte == b'.' && !dot {
            dot = true;
        } else if byte.is_ascii_digit() {
            digit = true;
        } else {
            return false;
        }
    }
    digit
}

fn is_integer(value: &str) -> bool {
    let value = value.trim();
    let raw = value.strip_prefix('-').unwrap_or(value);
    !raw.is_empty() && raw.bytes().all(|byte| byte.is_ascii_digit())
}

fn source_utility_value(family: UtilityFamily, base: &str) -> Option<String> {
    let keyword = match family {
        UtilityFamily::Display => match base {
            "block" => Some("block"),
            "inline-block" => Some("inline-block"),
            "inline" => Some("inline"),
            "flex" => Some("flex"),
            "inline-flex" => Some("inline-flex"),
            "grid" => Some("grid"),
            "inline-grid" => Some("inline-grid"),
            "hidden" => Some("none"),
            "contents" => Some("contents"),
            "flow-root" => Some("flow-root"),
            _ => None,
        },
        UtilityFamily::Position => match base {
            "static" | "relative" | "absolute" | "fixed" | "sticky" => Some(base),
            _ => None,
        },
        UtilityFamily::FlexDirection => match base {
            "flex-row" => Some("row"),
            "flex-row-reverse" => Some("row-reverse"),
            "flex-col" => Some("column"),
            "flex-col-reverse" => Some("column-reverse"),
            _ => None,
        },
        UtilityFamily::FlexWrap => match base {
            "flex-wrap" => Some("wrap"),
            "flex-wrap-reverse" => Some("wrap-reverse"),
            "flex-nowrap" => Some("nowrap"),
            _ => None,
        },
        UtilityFamily::AlignItems => match base {
            "items-start" => Some("flex-start"),
            "items-end" => Some("flex-end"),
            "items-center" => Some("center"),
            "items-baseline" => Some("baseline"),
            "items-stretch" => Some("stretch"),
            _ => None,
        },
        UtilityFamily::JustifyContent => match base {
            "justify-start" => Some("flex-start"),
            "justify-end" => Some("flex-end"),
            "justify-center" => Some("center"),
            "justify-between" => Some("space-between"),
            "justify-around" => Some("space-around"),
            "justify-evenly" => Some("space-evenly"),
            "justify-stretch" => Some("stretch"),
            _ => None,
        },
        UtilityFamily::TextAlign => match base {
            "text-left" => Some("left"),
            "text-right" => Some("right"),
            "text-center" => Some("center"),
            "text-justify" => Some("justify"),
            "text-start" => Some("start"),
            "text-end" => Some("end"),
            _ => None,
        },
        UtilityFamily::Overflow => match base {
            "overflow-auto" => Some("auto"),
            "overflow-hidden" => Some("hidden"),
            "overflow-clip" => Some("clip"),
            "overflow-visible" => Some("visible"),
            "overflow-scroll" => Some("scroll"),
            _ => None,
        },
        UtilityFamily::FontWeight => match base {
            "font-thin" => Some("100"),
            "font-extralight" => Some("200"),
            "font-light" => Some("300"),
            "font-normal" => Some("400"),
            "font-medium" => Some("500"),
            "font-semibold" => Some("600"),
            "font-bold" => Some("700"),
            "font-extrabold" => Some("800"),
            "font-black" => Some("900"),
            _ => None,
        },
        _ => None,
    };
    if let Some(value) = keyword {
        return Some(value.to_string());
    }

    let (prefix, negative_allowed) = match family {
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
        _ => ("", false),
    };
    if !prefix.is_empty() {
        let (negative, normalized) = if negative_allowed {
            base.strip_prefix('-').map(|rest| (true, rest)).unwrap_or((false, base))
        } else {
            (false, base)
        };
        if let Some(value) = arbitrary_value(normalized, prefix) {
            if is_px_value(value, false) {
                return Some(if negative { format!("-{value}") } else { value.to_string() });
            }
        }
    }
    match family {
        UtilityFamily::BorderRadius if base == "rounded" => None,
        UtilityFamily::Opacity => arbitrary_value(base, "opacity-")
            .filter(|value| is_number(value))
            .map(ToString::to_string),
        UtilityFamily::ZIndex => arbitrary_value(base, "z-")
            .filter(|value| is_integer(value))
            .map(ToString::to_string),
        UtilityFamily::FontWeight => arbitrary_value(base, "font-")
            .filter(|value| is_integer(value))
            .map(ToString::to_string),
        _ => None,
    }
}

fn utility_belongs_to_family(family: UtilityFamily, base: &str) -> bool {
    match family {
        UtilityFamily::Display => matches!(
            base,
            "block" | "inline-block" | "inline" | "flex" | "inline-flex" | "grid" | "inline-grid" | "hidden" | "contents" | "flow-root"
        ),
        UtilityFamily::Position => matches!(base, "static" | "relative" | "absolute" | "fixed" | "sticky"),
        UtilityFamily::FlexDirection => matches!(base, "flex-row" | "flex-row-reverse" | "flex-col" | "flex-col-reverse"),
        UtilityFamily::FlexWrap => matches!(base, "flex-wrap" | "flex-wrap-reverse" | "flex-nowrap"),
        UtilityFamily::AlignItems => matches!(base, "items-start" | "items-end" | "items-center" | "items-baseline" | "items-stretch"),
        UtilityFamily::JustifyContent => matches!(
            base,
            "justify-start" | "justify-end" | "justify-center" | "justify-between" | "justify-around" | "justify-evenly" | "justify-stretch"
        ),
        UtilityFamily::TextAlign => matches!(base, "text-left" | "text-right" | "text-center" | "text-justify" | "text-start" | "text-end"),
        UtilityFamily::Overflow => base.starts_with("overflow-") && !base.starts_with("overflow-x-") && !base.starts_with("overflow-y-"),
        UtilityFamily::FontWeight => {
            matches!(
                base,
                "font-thin" | "font-extralight" | "font-light" | "font-normal" | "font-medium" | "font-semibold" | "font-bold" | "font-extrabold" | "font-black"
            ) || arbitrary_value(base, "font-").is_some_and(is_integer)
        }
        UtilityFamily::FontSize => {
            matches!(
                base,
                "text-xs" | "text-sm" | "text-base" | "text-lg" | "text-xl" | "text-2xl" | "text-3xl" | "text-4xl" | "text-5xl" | "text-6xl" | "text-7xl" | "text-8xl" | "text-9xl"
            ) || arbitrary_value(base, "text-").is_some_and(|value| is_px_value(value, false))
        }
        UtilityFamily::BorderRadius => base == "rounded" || base.starts_with("rounded-"),
        UtilityFamily::Opacity => base.starts_with("opacity-"),
        UtilityFamily::ZIndex => base.starts_with("z-"),
        UtilityFamily::Width => base.starts_with("w-"),
        UtilityFamily::Height => base.starts_with("h-"),
        UtilityFamily::MinWidth => base.starts_with("min-w-"),
        UtilityFamily::MaxWidth => base.starts_with("max-w-"),
        UtilityFamily::MinHeight => base.starts_with("min-h-"),
        UtilityFamily::MaxHeight => base.starts_with("max-h-"),
        UtilityFamily::Gap => base.starts_with("gap-") && !base.starts_with("gap-x-") && !base.starts_with("gap-y-"),
        UtilityFamily::PaddingTop => base.starts_with("pt-"),
        UtilityFamily::PaddingRight => base.starts_with("pr-"),
        UtilityFamily::PaddingBottom => base.starts_with("pb-"),
        UtilityFamily::PaddingLeft => base.starts_with("pl-"),
        UtilityFamily::MarginTop => base.starts_with("mt-") || base.starts_with("-mt-"),
        UtilityFamily::MarginRight => base.starts_with("mr-") || base.starts_with("-mr-"),
        UtilityFamily::MarginBottom => base.starts_with("mb-") || base.starts_with("-mb-"),
        UtilityFamily::MarginLeft => base.starts_with("ml-") || base.starts_with("-ml-"),
        UtilityFamily::LineHeight => base.starts_with("leading-"),
        UtilityFamily::LetterSpacing => base.starts_with("tracking-") || base.starts_with("-tracking-"),
    }
}

fn arbitrary_replacement(family: UtilityFamily, after: &str) -> Option<String> {
    let after = after.trim().to_ascii_lowercase();
    let keyword = match family {
        UtilityFamily::Display => match after.as_str() {
            "block" => Some("block"),
            "inline-block" => Some("inline-block"),
            "inline" => Some("inline"),
            "flex" => Some("flex"),
            "inline-flex" => Some("inline-flex"),
            "grid" => Some("grid"),
            "inline-grid" => Some("inline-grid"),
            "none" => Some("hidden"),
            "contents" => Some("contents"),
            "flow-root" => Some("flow-root"),
            _ => None,
        },
        UtilityFamily::Position => match after.as_str() {
            "static" | "relative" | "absolute" | "fixed" | "sticky" => Some(after.as_str()),
            _ => None,
        },
        UtilityFamily::FlexDirection => match after.as_str() {
            "row" => Some("flex-row"),
            "row-reverse" => Some("flex-row-reverse"),
            "column" => Some("flex-col"),
            "column-reverse" => Some("flex-col-reverse"),
            _ => None,
        },
        UtilityFamily::FlexWrap => match after.as_str() {
            "wrap" => Some("flex-wrap"),
            "wrap-reverse" => Some("flex-wrap-reverse"),
            "nowrap" => Some("flex-nowrap"),
            _ => None,
        },
        UtilityFamily::AlignItems => match after.as_str() {
            "flex-start" => Some("items-start"),
            "flex-end" => Some("items-end"),
            "center" => Some("items-center"),
            "baseline" => Some("items-baseline"),
            "stretch" => Some("items-stretch"),
            _ => None,
        },
        UtilityFamily::JustifyContent => match after.as_str() {
            "flex-start" => Some("justify-start"),
            "flex-end" => Some("justify-end"),
            "center" => Some("justify-center"),
            "space-between" => Some("justify-between"),
            "space-around" => Some("justify-around"),
            "space-evenly" => Some("justify-evenly"),
            "stretch" => Some("justify-stretch"),
            _ => None,
        },
        UtilityFamily::TextAlign => match after.as_str() {
            "left" => Some("text-left"),
            "right" => Some("text-right"),
            "center" => Some("text-center"),
            "justify" => Some("text-justify"),
            "start" => Some("text-start"),
            "end" => Some("text-end"),
            _ => None,
        },
        UtilityFamily::Overflow => match after.as_str() {
            "auto" => Some("overflow-auto"),
            "hidden" => Some("overflow-hidden"),
            "clip" => Some("overflow-clip"),
            "visible" => Some("overflow-visible"),
            "scroll" => Some("overflow-scroll"),
            _ => None,
        },
        _ => None,
    };
    if let Some(value) = keyword {
        return Some(value.to_string());
    }

    if family == UtilityFamily::Opacity && is_number(&after) {
        return Some(format!("opacity-[{after}]"));
    }
    if family == UtilityFamily::ZIndex {
        if after == "auto" {
            return Some("z-auto".into());
        }
        if is_integer(&after) {
            return Some(format!("z-[{after}]"));
        }
        return None;
    }
    if family == UtilityFamily::FontWeight && is_integer(&after) {
        return Some(format!("font-[{after}]"));
    }

    let (prefix, allow_negative) = match family {
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
    };
    if !is_px_value(&after, allow_negative) {
        return None;
    }
    if let Some(value) = after.strip_prefix('-') {
        Some(format!("-{prefix}[{value}]"))
    } else {
        Some(format!("{prefix}[{after}]"))
    }
}

fn class_tokens(value: &str, absolute_start: usize) -> Vec<(String, usize, usize)> {
    let bytes = value.as_bytes();
    let mut result = Vec::new();
    let mut cursor = 0usize;
    while cursor < bytes.len() {
        while cursor < bytes.len() && bytes[cursor].is_ascii_whitespace() {
            cursor += 1;
        }
        let start = cursor;
        while cursor < bytes.len() && !bytes[cursor].is_ascii_whitespace() {
            cursor += 1;
        }
        if cursor > start && cursor - start <= MAX_CLASS_TOKEN_BYTES {
            result.push((
                value[start..cursor].to_string(),
                absolute_start + start,
                absolute_start + cursor,
            ));
        }
    }
    result
}

fn tailwind_operation(
    element: &SourceElement,
    selection: &MarkupEditSelection,
    change: &MarkupEditChange,
) -> Result<Option<(MarkupOperation, usize, usize)>, String> {
    let Some(family) = family_for_property(change.property.trim()) else {
        return Ok(None);
    };
    let class_name = element.tag.attribute("className");
    let class_attr = element.tag.attribute("class");
    if class_name.is_some() && class_attr.is_some() {
        return Err("Both className and class are present on the owning JSX element; class ownership is ambiguous.".into());
    }
    let Some(attribute) = class_name.or(class_attr) else {
        return Ok(None);
    };
    let attribute_name = if class_name.is_some() { "className" } else { "class" };
    let (value, value_start) = match &attribute.value {
        JsxAttributeValue::Literal {
            value, value_start, ..
        } => (value.as_str(), *value_start),
        _ => {
            return Err(
                "Tailwind direct editing requires one static literal className/class attribute; dynamic class composition stays on Codex."
                    .into(),
            )
        }
    };

    let tokens = class_tokens(value, value_start);
    let live_classes: Vec<&str> = selection.classes.iter().map(String::as_str).collect();
    let mut relevant = Vec::new();
    for (token, start, end) in tokens {
        let (variant, base) = variant_base(&token);
        let important = base.starts_with('!') || token.starts_with('!');
        let normalized = base.strip_prefix('!').unwrap_or(base);
        if utility_belongs_to_family(family, normalized) {
            relevant.push((token, start, end, variant, important, normalized.to_string()));
        }
    }
    if relevant.is_empty() {
        return Ok(None);
    }
    if relevant.iter().any(|candidate| candidate.3) {
        return Err(
            "A responsive/state Tailwind variant owns the requested property; M2.3 refuses to flatten it into a base utility."
                .into(),
        );
    }
    if relevant.iter().any(|candidate| candidate.4) {
        return Err("Important-modifier Tailwind ownership is not deterministic in M2.3.".into());
    }
    if relevant.len() != 1 {
        return Err(format!(
            "{} Tailwind utilities in the same property family are present; direct replacement would be ambiguous.",
            relevant.len()
        ));
    }
    let (source_token, start, end, _, _, base) = relevant.remove(0);
    if !live_classes.iter().any(|value| **value == source_token) {
        return Err(
            "The source Tailwind utility is not present on the selected live element; runtime/source ownership is stale or conditional."
                .into(),
        );
    }
    let Some(source_runtime) = source_utility_value(family, &base) else {
        return Err(
            "The Tailwind utility family is recognized, but its current value depends on theme/config/runtime semantics that are not statically proven."
                .into(),
        );
    };
    if !values_equivalent(&source_runtime, &change.before) {
        return Err(format!(
            "Tailwind utility {source_token} does not semantically match the observed runtime value {}; direct ownership is unproven.",
            change.before
        ));
    }
    let Some(replacement) = arbitrary_replacement(family, &change.after) else {
        return Err(
            "Requested value cannot be represented by the bounded deterministic Tailwind grammar; use Codex."
                .into(),
        );
    };
    if replacement == source_token {
        return Err("Requested Tailwind edit does not change source.".into());
    }
    Ok(Some((
        MarkupOperation {
            lane: MarkupLane::Tailwind,
            path: element.path.clone(),
            line: line_number(&element.content, start),
            tag: element.tag.tag.clone(),
            attribute: attribute_name.into(),
            property: change.property.clone(),
            source_before: source_token,
            source_after: replacement,
            owner_kind: "literal-tailwind-utility".into(),
        },
        start,
        end,
    )))
}

fn trim_range(content: &str, mut start: usize, mut end: usize) -> (usize, usize) {
    let bytes = content.as_bytes();
    while start < end && bytes[start].is_ascii_whitespace() {
        start += 1;
    }
    while end > start && bytes[end - 1].is_ascii_whitespace() {
        end -= 1;
    }
    (start, end)
}

fn split_object_segments(content: &str, start: usize, end: usize) -> Result<Vec<(usize, usize)>, String> {
    let bytes = content.as_bytes();
    let mut result = Vec::new();
    let mut cursor = start;
    let mut segment_start = start;
    let mut quote: Option<u8> = None;
    let mut escaped = false;
    let mut line_comment = false;
    let mut block_comment = false;
    let mut brace = 0i32;
    let mut bracket = 0i32;
    let mut paren = 0i32;
    while cursor < end {
        let byte = bytes[cursor];
        if line_comment {
            if byte == b'\n' {
                line_comment = false;
            }
            cursor += 1;
            continue;
        }
        if block_comment {
            if byte == b'*' && bytes.get(cursor + 1) == Some(&b'/') {
                block_comment = false;
                cursor += 2;
                continue;
            }
            cursor += 1;
            continue;
        }
        if let Some(active) = quote {
            if escaped {
                escaped = false;
            } else if byte == b'\\' {
                escaped = true;
            } else if byte == active {
                quote = None;
            }
            cursor += 1;
            continue;
        }
        if byte == b'/' && bytes.get(cursor + 1) == Some(&b'/') {
            line_comment = true;
            cursor += 2;
            continue;
        }
        if byte == b'/' && bytes.get(cursor + 1) == Some(&b'*') {
            block_comment = true;
            cursor += 2;
            continue;
        }
        if byte == b'/' {
            return Err("Inline style object contains unsupported slash syntax; use Codex.".into());
        }
        if matches!(byte, b'\'' | b'"' | b'`') {
            quote = Some(byte);
            cursor += 1;
            continue;
        }
        match byte {
            b'{' => brace += 1,
            b'}' => brace -= 1,
            b'[' => bracket += 1,
            b']' => bracket -= 1,
            b'(' => paren += 1,
            b')' => paren -= 1,
            b',' if brace == 0 && bracket == 0 && paren == 0 => {
                result.push((segment_start, cursor));
                segment_start = cursor + 1;
            }
            _ => {}
        }
        if brace < 0 || bracket < 0 || paren < 0 {
            return Err("Inline style object has unbalanced syntax.".into());
        }
        cursor += 1;
    }
    if quote.is_some() || line_comment || block_comment || brace != 0 || bracket != 0 || paren != 0 {
        return Err("Inline style object has unterminated or unbalanced syntax.".into());
    }
    if segment_start <= end {
        result.push((segment_start, end));
    }
    Ok(result)
}

fn top_level_colon(content: &str, start: usize, end: usize) -> Option<usize> {
    let bytes = content.as_bytes();
    let mut quote: Option<u8> = None;
    let mut escaped = false;
    let mut brace = 0i32;
    let mut bracket = 0i32;
    let mut paren = 0i32;
    let mut cursor = start;
    while cursor < end {
        let byte = bytes[cursor];
        if let Some(active) = quote {
            if escaped {
                escaped = false;
            } else if byte == b'\\' {
                escaped = true;
            } else if byte == active {
                quote = None;
            }
            cursor += 1;
            continue;
        }
        if matches!(byte, b'\'' | b'"' | b'`') {
            quote = Some(byte);
            cursor += 1;
            continue;
        }
        match byte {
            b'{' => brace += 1,
            b'}' => brace -= 1,
            b'[' => bracket += 1,
            b']' => bracket -= 1,
            b'(' => paren += 1,
            b')' => paren -= 1,
            b':' if brace == 0 && bracket == 0 && paren == 0 => return Some(cursor),
            _ => {}
        }
        cursor += 1;
    }
    None
}

fn safe_style_key(value: &str) -> bool {
    let value = value.trim();
    !value.is_empty()
        && value.len() <= 80
        && value
            .bytes()
            .enumerate()
            .all(|(index, byte)| byte.is_ascii_alphabetic() || byte == b'_' || (index > 0 && byte.is_ascii_digit()))
}

fn numeric_style_runtime(property: &str, value: &str) -> Option<String> {
    if !is_number(value) {
        return None;
    }
    match property {
        "opacity" | "zIndex" | "fontWeight" => Some(value.to_string()),
        "width"
        | "height"
        | "minWidth"
        | "maxWidth"
        | "minHeight"
        | "maxHeight"
        | "gap"
        | "paddingTop"
        | "paddingRight"
        | "paddingBottom"
        | "paddingLeft"
        | "marginTop"
        | "marginRight"
        | "marginBottom"
        | "marginLeft"
        | "fontSize"
        | "borderRadius"
        | "letterSpacing" => Some(if value == "0" { "0px".into() } else { format!("{value}px") }),
        _ => None,
    }
}

fn parse_simple_string(content: &str, start: usize, end: usize) -> Option<String> {
    if end <= start + 1 {
        return None;
    }
    let bytes = content.as_bytes();
    let quote = bytes[start];
    if !matches!(quote, b'\'' | b'"') || bytes[end - 1] != quote {
        return None;
    }
    let inner = &content[start + 1..end - 1];
    if inner.contains('\\') {
        return None;
    }
    Some(inner.to_string())
}

fn style_ownership(
    element: &SourceElement,
    property: &str,
) -> Result<StyleOwnership, String> {
    let Some(attribute) = element.tag.attribute("style") else {
        return Ok(StyleOwnership::None);
    };
    let (inner_start, inner_end) = match attribute.value {
        JsxAttributeValue::Expression {
            inner_start,
            inner_end,
        } => (inner_start, inner_end),
        _ => {
            return Ok(StyleOwnership::Dynamic(
                "The owning JSX style attribute is not a static object expression.".into(),
            ))
        }
    };
    let (outer_start, outer_end) = trim_range(&element.content, inner_start, inner_end);
    let bytes = element.content.as_bytes();
    if outer_end <= outer_start + 1 || bytes[outer_start] != b'{' || bytes[outer_end - 1] != b'}' {
        return Ok(StyleOwnership::Dynamic(
            "The owning JSX style expression is dynamic rather than a literal object.".into(),
        ));
    }
    let object_start = outer_start + 1;
    let object_end = outer_end - 1;
    let mut target: Option<StyleOwnership> = None;
    for (segment_start, segment_end) in split_object_segments(&element.content, object_start, object_end)? {
        let (segment_start, segment_end) = trim_range(&element.content, segment_start, segment_end);
        if segment_start >= segment_end {
            continue;
        }
        let segment = &element.content[segment_start..segment_end];
        if segment.trim_start().starts_with("...") {
            return Ok(StyleOwnership::Dynamic(
                "The inline style object contains a spread; the requested property may be overridden dynamically.".into(),
            ));
        }
        let Some(colon) = top_level_colon(&element.content, segment_start, segment_end) else {
            if segment.contains('[') || segment.contains(']') {
                return Ok(StyleOwnership::Dynamic(
                    "The inline style object contains an unknown computed key.".into(),
                ));
            }
            continue;
        };
        let (key_start, key_end) = trim_range(&element.content, segment_start, colon);
        let key = &element.content[key_start..key_end];
        if !safe_style_key(key) {
            return Ok(StyleOwnership::Dynamic(
                "The inline style object contains a computed/non-literal key.".into(),
            ));
        }
        if key != property {
            continue;
        }
        if target.is_some() {
            return Ok(StyleOwnership::Dynamic(
                "The inline style object defines the requested property more than once.".into(),
            ));
        }
        let (value_start, value_end) = trim_range(&element.content, colon + 1, segment_end);
        if value_start >= value_end {
            return Ok(StyleOwnership::Dynamic(
                "The inline style property has an empty value.".into(),
            ));
        }
        let source_before = element.content[value_start..value_end].to_string();
        let semantic_before = if let Some(value) = parse_simple_string(&element.content, value_start, value_end) {
            value
        } else if let Some(value) = numeric_style_runtime(property, &source_before) {
            value
        } else {
            return Ok(StyleOwnership::Dynamic(
                "The inline style property is not a bounded string/number literal.".into(),
            ));
        };
        target = Some(StyleOwnership::Literal {
            semantic_before,
            replacement_start: value_start,
            replacement_end: value_end,
            source_before,
        });
    }
    Ok(target.unwrap_or(StyleOwnership::None))
}

fn jsx_style_operation(
    element: &SourceElement,
    change: &MarkupEditChange,
) -> Result<Result<Option<(MarkupOperation, usize, usize)>, String>, String> {
    match style_ownership(element, change.property.trim())? {
        StyleOwnership::None => Ok(Ok(None)),
        StyleOwnership::Dynamic(reason) => Ok(Err(reason)),
        StyleOwnership::Literal {
            semantic_before,
            replacement_start,
            replacement_end,
            source_before,
        } => {
            if !values_equivalent(&semantic_before, &change.before) {
                return Ok(Err(format!(
                    "JSX inline style literal {semantic_before} does not match observed runtime value {}; direct ownership is unproven.",
                    change.before
                )));
            }
            if change.after.trim().is_empty() || change.after.len() > MAX_VALUE_BYTES {
                return Ok(Err("Requested JSX style value is outside the bounded edit grammar.".into()));
            }
            let replacement = serde_json::to_string(change.after.trim())
                .map_err(|error| format!("Cannot encode JSX style literal: {error}"))?;
            if replacement == source_before {
                return Ok(Err("Requested JSX style edit does not change source.".into()));
            }
            Ok(Ok(Some((
                MarkupOperation {
                    lane: MarkupLane::JsxStyle,
                    path: element.path.clone(),
                    line: line_number(&element.content, replacement_start),
                    tag: element.tag.tag.clone(),
                    attribute: "style".into(),
                    property: change.property.clone(),
                    source_before,
                    source_after: replacement,
                    owner_kind: "jsx-inline-style-literal".into(),
                },
                replacement_start,
                replacement_end,
            ))))
        }
    }
}

fn codex_plan(reason: impl Into<String>) -> ResolvedMarkupPlan {
    ResolvedMarkupPlan {
        public: MarkupEditProbe {
            mode: MarkupEditMode::Codex,
            reason: reason.into(),
            operation: None,
        },
        replacement_start: None,
        replacement_end: None,
        fingerprint: None,
    }
}

fn deterministic_plan(
    element: &SourceElement,
    operation: MarkupOperation,
    start: usize,
    end: usize,
    reason: impl Into<String>,
) -> ResolvedMarkupPlan {
    ResolvedMarkupPlan {
        public: MarkupEditProbe {
            mode: MarkupEditMode::Deterministic,
            reason: reason.into(),
            operation: Some(operation),
        },
        replacement_start: Some(start),
        replacement_end: Some(end),
        fingerprint: Some(file_fingerprint(&element.content)),
    }
}

fn resolve(
    root: &Path,
    selection: &MarkupEditSelection,
    change: &MarkupEditChange,
) -> Result<ResolvedMarkupPlan, String> {
    let property = change.property.trim();
    let before = change.before.trim();
    let after = change.after.trim();
    if property.is_empty() || property.len() > 80 || before.len() > MAX_VALUE_BYTES || after.len() > MAX_VALUE_BYTES || after.is_empty() || before == after {
        return Ok(codex_plan(
            "Markup visual edit is empty or outside the bounded property/value grammar.",
        ));
    }
    let element = match find_source_element(root, selection)? {
        Ok(element) => element,
        Err(reason) => return Ok(codex_plan(reason)),
    };

    match jsx_style_operation(&element, change)? {
        Err(reason) => return Ok(codex_plan(reason)),
        Ok(Some((operation, start, end))) => {
            return Ok(deterministic_plan(
                &element,
                operation,
                start,
                end,
                "Unique live/source DOM owner and matching JSX inline style literal proven; exact atomic source replacement is available.",
            ));
        }
        Ok(None) => {}
    }

    match tailwind_operation(&element, selection, change) {
        Ok(Some((operation, start, end))) => Ok(deterministic_plan(
            &element,
            operation,
            start,
            end,
            "Unique live/source DOM owner and semantically matching static Tailwind utility proven; exact utility replacement is available.",
        )),
        Ok(None) => Ok(codex_plan(
            "No deterministic JSX inline-style or Tailwind utility owner was proven for this property.",
        )),
        Err(reason) => Ok(codex_plan(reason)),
    }
}

fn write_atomic(path: &Path, content: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Markup source file has no parent directory".to_string())?;
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("source.tsx");
    let permissions = fs::metadata(path)
        .map_err(|error| format!("Cannot read markup source permissions: {error}"))?
        .permissions();
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let temp = parent.join(format!(
        ".{file_name}.monument-markup-{}-{nonce}.tmp",
        std::process::id()
    ));
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp)
        .map_err(|error| format!("Cannot create atomic markup transaction file: {error}"))?;
    let result = (|| -> Result<(), String> {
        file.write_all(content.as_bytes())
            .map_err(|error| format!("Cannot write atomic markup transaction: {error}"))?;
        file.flush()
            .map_err(|error| format!("Cannot flush atomic markup transaction: {error}"))?;
        file.sync_all()
            .map_err(|error| format!("Cannot sync atomic markup transaction: {error}"))?;
        fs::set_permissions(&temp, permissions)
            .map_err(|error| format!("Cannot preserve markup source permissions: {error}"))?;
        fs::rename(&temp, path)
            .map_err(|error| format!("Cannot atomically replace markup source file: {error}"))?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}

#[tauri::command]
pub fn project_markup_edit_probe(
    project_path: String,
    selection: MarkupEditSelection,
    change: MarkupEditChange,
) -> Result<MarkupEditProbe, String> {
    let root = project_root(project_path)?;
    Ok(resolve(&root, &selection, &change)?.public)
}

#[tauri::command]
pub fn project_markup_transaction_preview(
    project_path: String,
    selection: MarkupEditSelection,
    change: MarkupEditChange,
) -> Result<MarkupTransactionPlan, String> {
    let root = project_root(project_path)?;
    let resolved = resolve(&root, &selection, &change)?;
    Ok(MarkupTransactionPlan {
        safe: resolved.public.mode == MarkupEditMode::Deterministic
            && resolved.public.operation.is_some(),
        reason: resolved.public.reason,
        operation: resolved.public.operation,
    })
}

#[tauri::command]
pub fn project_markup_transaction_commit(
    project_path: String,
    selection: MarkupEditSelection,
    change: MarkupEditChange,
) -> Result<MarkupTransactionCommit, String> {
    let root = project_root(project_path)?;
    let resolved = resolve(&root, &selection, &change)?;
    if resolved.public.mode != MarkupEditMode::Deterministic {
        return Err(format!(
            "Markup source transaction is not deterministic: {}",
            resolved.public.reason
        ));
    }
    let operation = resolved
        .public
        .operation
        .ok_or_else(|| "Markup operation disappeared during commit resolution".to_string())?;
    let start = resolved
        .replacement_start
        .ok_or_else(|| "Markup replacement range missing".to_string())?;
    let end = resolved
        .replacement_end
        .ok_or_else(|| "Markup replacement range missing".to_string())?;
    let expected_fingerprint = resolved
        .fingerprint
        .ok_or_else(|| "Markup source fingerprint missing".to_string())?;
    let path = root.join(&operation.path);
    let metadata = fs::symlink_metadata(&path)
        .map_err(|error| format!("Cannot inspect markup transaction target: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Markup source transaction refuses symlink or non-file targets".into());
    }
    let canonical = path
        .canonicalize()
        .map_err(|error| format!("Cannot canonicalize markup transaction target: {error}"))?;
    if !canonical.starts_with(&root) {
        return Err("Markup source transaction target escapes project root".into());
    }
    let mut content = fs::read_to_string(&canonical)
        .map_err(|error| format!("Cannot read markup transaction target: {error}"))?;
    if file_fingerprint(&content) != expected_fingerprint {
        return Err(
            "Source changed after markup transaction resolution; re-apply against current source"
                .into(),
        );
    }
    let actual = content
        .get(start..end)
        .ok_or_else(|| "Markup source range changed after resolution".to_string())?;
    if actual != operation.source_before {
        return Err(
            "Markup source value changed after resolution; re-apply against current source".into(),
        );
    }
    content.replace_range(start..end, &operation.source_after);
    let reparsed = opening_tags(&content);
    if !reparsed.iter().any(|tag| {
        literal_attribute(tag, "id")
            .is_some_and(|(id, _, _)| id == selection.id.clone().unwrap_or_default())
            && tag.tag.to_ascii_lowercase() == selection.tag.trim().to_ascii_lowercase()
    }) {
        return Err("Updated JSX/TSX failed bounded opening-tag structural validation".into());
    }
    write_atomic(&canonical, &content)?;
    Ok(MarkupTransactionCommit {
        path: operation.path,
        applied_count: 1,
        bytes_written: content.len(),
        lane: operation.lane,
        owner_kind: operation.owner_kind,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture(name: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "monument-markup-transaction-{name}-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(root.join("src")).unwrap();
        root
    }

    fn selection(id: &str, classes: &[&str]) -> MarkupEditSelection {
        MarkupEditSelection {
            id: Some(id.into()),
            id_unique: true,
            classes: classes.iter().map(|value| value.to_string()).collect(),
            tag: "div".into(),
        }
    }

    fn change(property: &str, before: &str, after: &str) -> MarkupEditChange {
        MarkupEditChange {
            property: property.into(),
            before: before.into(),
            after: after.into(),
        }
    }

    #[test]
    fn replaces_proven_arbitrary_tailwind_utility() {
        let root = fixture("tailwind");
        let path = root.join("src/App.tsx");
        fs::write(
            &path,
            r#"export function App(){return <div id="hero" className="flex gap-[16px] rounded-[8px]"/>}"#,
        )
        .unwrap();
        let selected = selection("hero", &["flex", "gap-[16px]", "rounded-[8px]"]);
        let edit = change("gap", "16px", "24px");
        let probe = resolve(&root, &selected, &edit).unwrap();
        assert_eq!(probe.public.mode, MarkupEditMode::Deterministic);
        assert_eq!(probe.public.operation.as_ref().unwrap().lane, MarkupLane::Tailwind);
        project_markup_transaction_commit(
            root.to_string_lossy().to_string(),
            selected,
            edit,
        )
        .unwrap();
        let updated = fs::read_to_string(path).unwrap();
        assert!(updated.contains("gap-[24px]"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn named_theme_spacing_utility_is_not_blindly_replaced() {
        let root = fixture("theme-scale");
        fs::write(
            root.join("src/App.tsx"),
            r#"export function App(){return <div id="hero" className="gap-4"/>}"#,
        )
        .unwrap();
        let probe = resolve(
            &root,
            &selection("hero", &["gap-4"]),
            &change("gap", "16px", "24px"),
        )
        .unwrap();
        assert_eq!(probe.public.mode, MarkupEditMode::Codex);
        assert!(probe.public.reason.contains("theme/config/runtime semantics"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn responsive_tailwind_variant_is_refused() {
        let root = fixture("variant");
        fs::write(
            root.join("src/App.tsx"),
            r#"export function App(){return <div id="hero" className="gap-[16px] md:gap-[24px]"/>}"#,
        )
        .unwrap();
        let probe = resolve(
            &root,
            &selection("hero", &["gap-[16px]", "md:gap-[24px]"]),
            &change("gap", "16px", "20px"),
        )
        .unwrap();
        assert_eq!(probe.public.mode, MarkupEditMode::Codex);
        assert!(probe.public.reason.contains("responsive/state"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn replaces_matching_jsx_inline_style_literal() {
        let root = fixture("jsx-style");
        let path = root.join("src/App.tsx");
        fs::write(
            &path,
            r#"export function App(){return <div id="hero" style={{ gap: '16px', opacity: 1 }} className="gap-[99px]"/>}"#,
        )
        .unwrap();
        let selected = selection("hero", &["gap-[99px]"]);
        let edit = change("gap", "16px", "28px");
        let probe = resolve(&root, &selected, &edit).unwrap();
        assert_eq!(probe.public.mode, MarkupEditMode::Deterministic);
        assert_eq!(probe.public.operation.as_ref().unwrap().lane, MarkupLane::JsxStyle);
        project_markup_transaction_commit(
            root.to_string_lossy().to_string(),
            selected,
            edit,
        )
        .unwrap();
        let updated = fs::read_to_string(path).unwrap();
        assert!(updated.contains("gap: \"28px\""));
        assert!(updated.contains("gap-[99px]"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn style_spread_refuses_tailwind_fallback() {
        let root = fixture("style-spread");
        fs::write(
            root.join("src/App.tsx"),
            r#"export function App(){return <div id="hero" style={{ ...style }} className="gap-[16px]"/>}"#,
        )
        .unwrap();
        let probe = resolve(
            &root,
            &selection("hero", &["gap-[16px]"]),
            &change("gap", "16px", "24px"),
        )
        .unwrap();
        assert_eq!(probe.public.mode, MarkupEditMode::Codex);
        assert!(probe.public.reason.contains("spread"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn non_unique_live_id_has_no_markup_write_authority() {
        let root = fixture("duplicate-live-id");
        fs::write(
            root.join("src/App.tsx"),
            r#"export function App(){return <div id="hero" className="gap-[16px]"/>}"#,
        )
        .unwrap();
        let mut selected = selection("hero", &["gap-[16px]"]);
        selected.id_unique = false;
        let probe = resolve(&root, &selected, &change("gap", "16px", "24px")).unwrap();
        assert_eq!(probe.public.mode, MarkupEditMode::Codex);
        assert!(probe.public.reason.contains("unique"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn source_spread_has_no_direct_authority() {
        let root = fixture("spread");
        fs::write(
            root.join("src/App.tsx"),
            r#"export function App(){return <div id="hero" {...props} className="gap-[16px]"/>}"#,
        )
        .unwrap();
        let probe = resolve(
            &root,
            &selection("hero", &["gap-[16px]"]),
            &change("gap", "16px", "24px"),
        )
        .unwrap();
        assert_eq!(probe.public.mode, MarkupEditMode::Codex);
        assert!(probe.public.reason.contains("spread attribute"));
        let _ = fs::remove_dir_all(root);
    }
}
