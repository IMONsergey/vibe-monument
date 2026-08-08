use crate::jsx_source::{opening_tags, JsxAttributeValue};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

const MAX_GUARD_FILES: usize = 1_200;
const MAX_FILE_BYTES: u64 = 1_500_000;
const MAX_TOTAL_BYTES: u64 = 24_000_000;
const MAX_ID_BYTES: usize = 96;
const MAX_TOKEN_BYTES: usize = 220;
const MAX_CONFLICTS: usize = 24;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkupGuardSelection {
    id: Option<String>,
    #[serde(default)]
    id_unique: bool,
    tag: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkupGuardChange {
    property: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkupConflictGuardResult {
    safe: bool,
    reason: String,
    conflicts: Vec<String>,
}

fn skip_dir(name: &str) -> bool {
    matches!(
        name,
        ".git" | "node_modules" | "target" | "dist" | "build" | ".next" | ".nuxt"
            | ".output" | "coverage" | ".cache" | ".turbo" | ".vite"
    )
}

fn collect_sources(
    directory: &Path,
    files: &mut Vec<PathBuf>,
    total: &mut u64,
    truncated: &mut bool,
) {
    if files.len() >= MAX_GUARD_FILES || *total >= MAX_TOTAL_BYTES {
        *truncated = true;
        return;
    }
    let Ok(entries) = fs::read_dir(directory) else { return; };
    let mut entries: Vec<_> = entries.filter_map(Result::ok).collect();
    entries.sort_by_key(|entry| entry.path());
    for entry in entries {
        if files.len() >= MAX_GUARD_FILES || *total >= MAX_TOTAL_BYTES {
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

fn canonical_root(project_path: String) -> Result<PathBuf, String> {
    let root = PathBuf::from(project_path.trim())
        .canonicalize()
        .map_err(|error| format!("Cannot inspect markup conflict scope: {error}"))?;
    if !root.is_dir() {
        return Err("Markup conflict guard root is not a directory".into());
    }
    Ok(root)
}

fn bounded_id(value: Option<&str>) -> Option<String> {
    let value = value?.trim();
    (!value.is_empty()
        && value.len() <= MAX_ID_BYTES
        && value.bytes().all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b':' | b'.')))
        .then(|| value.to_string())
}

fn literal_attr<'a>(tag: &'a crate::jsx_source::JsxOpeningTag, name: &str) -> Option<&'a str> {
    match &tag.attribute(name)?.value {
        JsxAttributeValue::Literal { value, .. } => Some(value.as_str()),
        _ => None,
    }
}

fn direct_dom_tag(tag: &str) -> bool {
    let mut chars = tag.chars();
    chars.next().is_some_and(|first| first.is_ascii_lowercase())
        && chars.all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-')
}

fn class_tokens(value: &str) -> Vec<String> {
    value
        .split_ascii_whitespace()
        .filter(|token| !token.is_empty() && token.len() <= MAX_TOKEN_BYTES)
        .take(256)
        .map(ToString::to_string)
        .collect()
}

fn variant_base(token: &str) -> &str {
    let bytes = token.as_bytes();
    let mut bracket = 0i32;
    let mut escaped = false;
    let mut last = None;
    for (index, byte) in bytes.iter().copied().enumerate() {
        if escaped { escaped = false; continue; }
        if byte == b'\\' { escaped = true; continue; }
        match byte {
            b'[' => bracket += 1,
            b']' => bracket = (bracket - 1).max(0),
            b':' if bracket == 0 => last = Some(index),
            _ => {}
        }
    }
    let base = last.map(|index| &token[index + 1..]).unwrap_or(token);
    base.strip_prefix('!').unwrap_or(base)
}

fn without_negative(base: &str) -> &str {
    base.strip_prefix('-').unwrap_or(base)
}

fn display_utility(base: &str) -> bool {
    matches!(
        base,
        "block" | "inline-block" | "inline" | "flex" | "inline-flex" | "grid" | "inline-grid"
            | "flow-root" | "contents" | "list-item" | "hidden" | "table" | "inline-table"
            | "table-caption" | "table-cell" | "table-column" | "table-column-group"
            | "table-footer-group" | "table-header-group" | "table-row-group" | "table-row"
    )
}

fn text_size_utility(base: &str) -> bool {
    matches!(
        base,
        "text-xs" | "text-sm" | "text-base" | "text-lg" | "text-xl" | "text-2xl"
            | "text-3xl" | "text-4xl" | "text-5xl" | "text-6xl" | "text-7xl" | "text-8xl" | "text-9xl"
    ) || base.starts_with("text-[")
}

fn multi_property_conflict(property: &str, base: &str) -> bool {
    let normalized = without_negative(base);
    let sr = matches!(normalized, "sr-only" | "not-sr-only");
    let line_clamp = normalized.starts_with("line-clamp-");
    match property {
        "width" => normalized.starts_with("w-") || normalized.starts_with("size-") || normalized == "container" || sr,
        "height" => normalized.starts_with("h-") || normalized.starts_with("size-") || sr,
        "minWidth" => normalized.starts_with("min-w-"),
        "maxWidth" => normalized.starts_with("max-w-") || normalized == "container",
        "minHeight" => normalized.starts_with("min-h-"),
        "maxHeight" => normalized.starts_with("max-h-"),
        "gap" => normalized.starts_with("gap-") || normalized.starts_with("gap-x-") || normalized.starts_with("gap-y-"),
        "paddingTop" => normalized.starts_with("p-") || normalized.starts_with("py-") || normalized.starts_with("pt-") || sr,
        "paddingRight" => normalized.starts_with("p-") || normalized.starts_with("px-") || normalized.starts_with("pr-") || sr,
        "paddingBottom" => normalized.starts_with("p-") || normalized.starts_with("py-") || normalized.starts_with("pb-") || sr,
        "paddingLeft" => normalized.starts_with("p-") || normalized.starts_with("px-") || normalized.starts_with("pl-") || sr,
        "marginTop" => normalized.starts_with("m-") || normalized.starts_with("my-") || normalized.starts_with("mt-") || sr,
        "marginRight" => normalized.starts_with("m-") || normalized.starts_with("mx-") || normalized.starts_with("mr-") || sr,
        "marginBottom" => normalized.starts_with("m-") || normalized.starts_with("my-") || normalized.starts_with("mb-") || sr,
        "marginLeft" => normalized.starts_with("m-") || normalized.starts_with("mx-") || normalized.starts_with("ml-") || sr,
        "display" => display_utility(normalized) || line_clamp,
        "position" => matches!(normalized, "static" | "relative" | "absolute" | "fixed" | "sticky") || sr,
        "flexDirection" => matches!(normalized, "flex-row" | "flex-row-reverse" | "flex-col" | "flex-col-reverse"),
        "flexWrap" => matches!(normalized, "flex-wrap" | "flex-wrap-reverse" | "flex-nowrap"),
        "alignItems" => normalized.starts_with("items-") || normalized.starts_with("place-items-"),
        "justifyContent" => normalized.starts_with("justify-") || normalized.starts_with("place-content-"),
        "fontSize" => text_size_utility(normalized),
        "fontWeight" => matches!(
            normalized,
            "font-thin" | "font-extralight" | "font-light" | "font-normal" | "font-medium"
                | "font-semibold" | "font-bold" | "font-extrabold" | "font-black"
        ) || normalized.starts_with("font-["),
        "lineHeight" => normalized.starts_with("leading-"),
        "letterSpacing" => normalized.starts_with("tracking-"),
        "textAlign" => matches!(normalized, "text-left" | "text-right" | "text-center" | "text-justify" | "text-start" | "text-end"),
        "borderRadius" => normalized == "rounded" || normalized.starts_with("rounded-"),
        "opacity" => normalized.starts_with("opacity-"),
        "overflow" => normalized.starts_with("overflow-") || normalized == "truncate" || line_clamp || sr,
        "zIndex" => normalized.starts_with("z-"),
        _ => false,
    }
}

fn owning_class_tokens(
    root: &Path,
    selection: &MarkupGuardSelection,
) -> Result<Result<Vec<String>, String>, String> {
    let Some(id) = bounded_id(selection.id.as_deref()) else {
        return Ok(Err("Tailwind conflict guard requires a bounded literal DOM id.".into()));
    };
    if !selection.id_unique {
        return Ok(Err("Tailwind conflict guard requires a unique live DOM id.".into()));
    }
    let tag = selection.tag.trim().to_ascii_lowercase();
    if !direct_dom_tag(&tag) {
        return Ok(Err("Tailwind conflict guard does not grant custom component authority.".into()));
    }

    let mut files = Vec::new();
    let mut total = 0u64;
    let mut truncated = false;
    collect_sources(root, &mut files, &mut total, &mut truncated);
    if truncated {
        return Ok(Err("Tailwind conflict guard source scan was truncated.".into()));
    }

    let mut owners: Vec<Vec<String>> = Vec::new();
    for path in files {
        let content = fs::read_to_string(&path)
            .map_err(|error| format!("Cannot read markup conflict source {}: {error}", path.display()))?;
        for opening in opening_tags(&content) {
            if opening.tag.to_ascii_lowercase() != tag || literal_attr(&opening, "id") != Some(id.as_str()) {
                continue;
            }
            if opening.has_spread {
                return Ok(Err("Owning JSX element contains a spread; conflict guard cannot prove static class ownership.".into()));
            }
            if opening.duplicate_attribute_names().iter().any(|name| matches!(name.as_str(), "id" | "class" | "className" | "style")) {
                return Ok(Err("Owning JSX element contains duplicate id/class/style attributes.".into()));
            }
            let class_name = opening.attribute("className");
            let class_attr = opening.attribute("class");
            if class_name.is_some() && class_attr.is_some() {
                return Ok(Err("Both className and class are present; class ownership is ambiguous.".into()));
            }
            let Some(attribute) = class_name.or(class_attr) else {
                owners.push(Vec::new());
                continue;
            };
            let classes = match &attribute.value {
                JsxAttributeValue::Literal { value, .. } => class_tokens(value),
                _ => return Ok(Err("Dynamic class composition cannot pass the Tailwind conflict guard.".into())),
            };
            owners.push(classes);
            if owners.len() > 1 { break; }
        }
        if owners.len() > 1 { break; }
    }

    if owners.len() != 1 {
        return Ok(Err(if owners.is_empty() {
            "Tailwind conflict guard could not prove one literal JSX owner.".into()
        } else {
            "Tailwind conflict guard found multiple literal JSX owners.".into()
        }));
    }
    Ok(Ok(owners.remove(0)))
}

fn guard(
    root: &Path,
    selection: &MarkupGuardSelection,
    change: &MarkupGuardChange,
) -> Result<MarkupConflictGuardResult, String> {
    let classes = match owning_class_tokens(root, selection)? {
        Ok(classes) => classes,
        Err(reason) => return Ok(MarkupConflictGuardResult { safe: false, reason, conflicts: Vec::new() }),
    };
    let property = change.property.trim();
    if property.is_empty() || property.len() > 80 {
        return Ok(MarkupConflictGuardResult {
            safe: false,
            reason: "Requested property is outside the bounded Tailwind conflict grammar.".into(),
            conflicts: Vec::new(),
        });
    }
    let mut conflicts = Vec::new();
    for token in classes {
        let base = variant_base(&token);
        if multi_property_conflict(property, base) {
            conflicts.push(token);
            if conflicts.len() >= MAX_CONFLICTS { break; }
        }
    }
    if conflicts.len() <= 1 {
        return Ok(MarkupConflictGuardResult {
            safe: true,
            reason: "No additional Tailwind shorthand/multi-property competitor was proven for this property.".into(),
            conflicts,
        });
    }
    Ok(MarkupConflictGuardResult {
        safe: false,
        reason: format!(
            "{} Tailwind utilities can affect {property}; direct replacement is blocked until one exact effective owner is proven.",
            conflicts.len()
        ),
        conflicts,
    })
}

#[tauri::command]
pub fn project_markup_conflict_guard(
    project_path: String,
    selection: MarkupGuardSelection,
    change: MarkupGuardChange,
) -> Result<MarkupConflictGuardResult, String> {
    let root = canonical_root(project_path)?;
    guard(&root, &selection, &change)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn fixture(name: &str, classes: &str) -> (PathBuf, MarkupGuardSelection) {
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
        let root = std::env::temp_dir().join(format!("monument-markup-guard-{name}-{nonce}"));
        fs::create_dir_all(root.join("src")).unwrap();
        fs::write(
            root.join("src/App.tsx"),
            format!(r#"export const App=()=> <div id="hero" className="{classes}"/>;"#),
        ).unwrap();
        (root, MarkupGuardSelection { id: Some("hero".into()), id_unique: true, tag: "div".into() })
    }

    fn assert_blocked(name: &str, property: &str, classes: &str) {
        let (root, selection) = fixture(name, classes);
        let result = guard(&root, &selection, &MarkupGuardChange { property: property.into() }).unwrap();
        assert!(!result.safe, "{property} should be blocked for {classes}");
        assert!(result.conflicts.len() > 1);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn size_utility_conflicts_with_width_and_height_owner() {
        assert_blocked("size-width", "width", "size-[16px] w-[16px]");
        assert_blocked("size-height", "height", "size-[16px] h-[16px]");
    }

    #[test]
    fn place_shorthands_conflict_with_alignment_owner() {
        assert_blocked("place-items", "alignItems", "place-items-center items-start");
        assert_blocked("place-content", "justifyContent", "place-content-center justify-start");
    }

    #[test]
    fn accessibility_and_text_helpers_conflict_with_multiple_properties() {
        assert_blocked("sr-position", "position", "sr-only relative");
        assert_blocked("sr-width", "width", "sr-only w-[20px]");
        assert_blocked("truncate-overflow", "overflow", "truncate overflow-auto");
        assert_blocked("clamp-display", "display", "line-clamp-2 block");
    }

    #[test]
    fn full_display_family_is_counted_as_competing_ownership() {
        assert_blocked("table-display", "display", "table flex");
        assert_blocked("list-display", "display", "list-item block");
    }
}
