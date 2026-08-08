use ignore::WalkBuilder;
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_CSS_FILES: usize = 500;
const MAX_CSS_FILE_BYTES: u64 = 1_500_000;
const MAX_CSS_TOTAL_BYTES: u64 = 12_000_000;
const MAX_VALUE_BYTES: usize = 300;
const MAX_SELECTOR_BYTES: usize = 600;
const MAX_CANDIDATES: usize = 8;
static TEMP_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VisualSourcePlanInput {
    project_path: String,
    element_id: Option<String>,
    property: String,
    before: String,
    after: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VisualSourceCandidate {
    source_path: String,
    selector: String,
    css_property: String,
    line: usize,
    source_value: String,
    score: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VisualSourcePlan {
    source_path: String,
    selector: String,
    requested_property: String,
    css_property: String,
    line: usize,
    value_start: usize,
    value_end: usize,
    before_source: String,
    after_source: String,
    file_fingerprint: String,
    preview_before: String,
    preview_after: String,
    confidence: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VisualSourcePlanResponse {
    status: String,
    reason: String,
    candidate_count: usize,
    plan: Option<VisualSourcePlan>,
    candidates: Vec<VisualSourceCandidate>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VisualSourceApplyInput {
    request: VisualSourcePlanInput,
    expected_source_path: String,
    expected_file_fingerprint: String,
    expected_value_start: usize,
    expected_value_end: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VisualSourceApplyResult {
    source_path: String,
    css_property: String,
    line: usize,
    previous_fingerprint: String,
    next_fingerprint: String,
    bytes_written: usize,
    plan: VisualSourcePlan,
}

#[derive(Debug, Clone)]
struct CssMatch {
    source_path: String,
    selector: String,
    css_property: String,
    line: usize,
    value_start: usize,
    value_end: usize,
    source_value: String,
    file_fingerprint: String,
    score: u32,
}

fn canonical_project(project_path: &str) -> Result<PathBuf, String> {
    let root = PathBuf::from(project_path)
        .canonicalize()
        .map_err(|error| format!("Cannot inspect visual source: {error}"))?;
    if !root.is_dir() {
        return Err("Visual source root is not a directory".into());
    }
    Ok(root)
}

fn safe_ident(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 160
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

fn css_property(value: &str) -> Option<&'static str> {
    Some(match value {
        "width" => "width",
        "height" => "height",
        "minWidth" => "min-width",
        "maxWidth" => "max-width",
        "minHeight" => "min-height",
        "maxHeight" => "max-height",
        "display" => "display",
        "position" => "position",
        "flexDirection" => "flex-direction",
        "flexWrap" => "flex-wrap",
        "alignItems" => "align-items",
        "justifyContent" => "justify-content",
        "gap" => "gap",
        "gridTemplateColumns" => "grid-template-columns",
        "paddingTop" => "padding-top",
        "paddingRight" => "padding-right",
        "paddingBottom" => "padding-bottom",
        "paddingLeft" => "padding-left",
        "marginTop" => "margin-top",
        "marginRight" => "margin-right",
        "marginBottom" => "margin-bottom",
        "marginLeft" => "margin-left",
        "fontFamily" => "font-family",
        "fontSize" => "font-size",
        "fontWeight" => "font-weight",
        "lineHeight" => "line-height",
        "letterSpacing" => "letter-spacing",
        "textAlign" => "text-align",
        "color" => "color",
        "backgroundColor" => "background-color",
        "backgroundImage" => "background-image",
        "border" => "border",
        "borderRadius" => "border-radius",
        "boxShadow" => "box-shadow",
        "opacity" => "opacity",
        "overflow" => "overflow",
        "zIndex" => "z-index",
        _ => return None,
    })
}

fn css_value_is_balanced(value: &str) -> bool {
    let mut quote: Option<char> = None;
    let mut escaped = false;
    let mut parens = 0usize;
    let mut brackets = 0usize;

    for ch in value.chars() {
        if ch.is_control() {
            return false;
        }
        if let Some(active_quote) = quote {
            if escaped {
                escaped = false;
                continue;
            }
            if ch == '\\' {
                escaped = true;
                continue;
            }
            if ch == active_quote {
                quote = None;
            }
            continue;
        }

        match ch {
            '\'' | '"' => quote = Some(ch),
            '(' => parens += 1,
            ')' => {
                if parens == 0 {
                    return false;
                }
                parens -= 1;
            }
            '[' => brackets += 1,
            ']' => {
                if brackets == 0 {
                    return false;
                }
                brackets -= 1;
            }
            '\\' => return false,
            _ => {}
        }
    }

    quote.is_none() && !escaped && parens == 0 && brackets == 0
}

fn clean_value(value: &str) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() || value.len() > MAX_VALUE_BYTES {
        return Err("Visual CSS value is empty or exceeds the deterministic edit boundary".into());
    }
    if value.contains(['\n', '\r', '{', '}', ';'])
        || value.contains("/*")
        || value.contains("*/")
        || !css_value_is_balanced(value)
    {
        return Err("Visual CSS value requires Codex because it cannot be represented as one safe literal declaration value".into());
    }
    Ok(value.to_string())
}

fn normalized_literal(value: &str) -> String {
    value.trim().to_string()
}

fn fingerprint(bytes: &[u8]) -> String {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("fnv1a64-{hash:016x}-{}", bytes.len())
}

fn css_file(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("css"))
}

fn collect_css(root: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    let mut total = 0u64;
    let walker = WalkBuilder::new(root)
        .hidden(false)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .parents(true)
        .build();
    for entry in walker.filter_map(Result::ok) {
        if files.len() >= MAX_CSS_FILES || total >= MAX_CSS_TOTAL_BYTES {
            break;
        }
        let path = entry.path();
        if !entry.file_type().is_some_and(|kind| kind.is_file()) || !css_file(path) {
            continue;
        }
        let Ok(metadata) = entry.metadata() else { continue; };
        let size = metadata.len();
        if size == 0 || size > MAX_CSS_FILE_BYTES || total.saturating_add(size) > MAX_CSS_TOTAL_BYTES {
            continue;
        }
        total += size;
        files.push(path.to_path_buf());
    }
    files.sort();
    files
}

fn trim_ascii_range(bytes: &[u8], mut start: usize, mut end: usize) -> (usize, usize) {
    while start < end && bytes[start].is_ascii_whitespace() {
        start += 1;
    }
    while end > start && bytes[end - 1].is_ascii_whitespace() {
        end -= 1;
    }
    (start, end)
}

fn skip_comment(bytes: &[u8], start: usize, end: usize) -> Option<usize> {
    if start + 1 >= end || bytes[start] != b'/' || bytes[start + 1] != b'*' {
        return None;
    }
    let mut index = start + 2;
    while index + 1 < end {
        if bytes[index] == b'*' && bytes[index + 1] == b'/' {
            return Some(index + 2);
        }
        index += 1;
    }
    Some(end)
}

fn skip_string(bytes: &[u8], start: usize, end: usize) -> Option<usize> {
    let quote = *bytes.get(start)?;
    if !matches!(quote, b'\'' | b'"') {
        return None;
    }
    let mut index = start + 1;
    while index < end {
        if bytes[index] == b'\\' {
            index = (index + 2).min(end);
            continue;
        }
        if bytes[index] == quote {
            return Some(index + 1);
        }
        index += 1;
    }
    Some(end)
}

fn matching_brace(bytes: &[u8], open: usize, end: usize) -> Option<usize> {
    let mut depth = 1usize;
    let mut index = open + 1;
    while index < end {
        if let Some(next) = skip_comment(bytes, index, end) {
            index = next;
            continue;
        }
        if let Some(next) = skip_string(bytes, index, end) {
            index = next;
            continue;
        }
        match bytes[index] {
            b'{' => depth += 1,
            b'}' => {
                depth = depth.saturating_sub(1);
                if depth == 0 {
                    return Some(index);
                }
            }
            _ => {}
        }
        index += 1;
    }
    None
}

fn token_contains_id(selector: &str, id: &str) -> bool {
    let needle = format!("#{id}");
    selector.match_indices(&needle).any(|(start, _)| {
        let end = start + needle.len();
        selector.as_bytes().get(end).is_none_or(|byte| {
            !byte.is_ascii_alphanumeric() && !matches!(*byte, b'-' | b'_')
        })
    })
}

fn selector_score(selector: &str, id: &str) -> u32 {
    let selector = selector.trim();
    if selector.is_empty()
        || selector.len() > MAX_SELECTOR_BYTES
        || selector.contains(',')
        || selector.contains(':')
        || selector.contains('[')
        || selector.contains(']')
        || selector.contains("::")
    {
        return 0;
    }
    let rightmost = selector
        .rsplit(|value: char| value.is_ascii_whitespace() || matches!(value, '>' | '+' | '~'))
        .find(|value| !value.trim().is_empty())
        .unwrap_or(selector)
        .trim();
    if token_contains_id(rightmost, id) {
        140
    } else {
        0
    }
}

fn declaration_colon(bytes: &[u8], start: usize, end: usize) -> Option<usize> {
    let mut index = start;
    let mut parens = 0usize;
    let mut brackets = 0usize;
    while index < end {
        if let Some(next) = skip_comment(bytes, index, end) {
            index = next;
            continue;
        }
        if let Some(next) = skip_string(bytes, index, end) {
            index = next;
            continue;
        }
        match bytes[index] {
            b'(' => parens += 1,
            b')' => parens = parens.saturating_sub(1),
            b'[' => brackets += 1,
            b']' => brackets = brackets.saturating_sub(1),
            b':' if parens == 0 && brackets == 0 => return Some(index),
            _ => {}
        }
        index += 1;
    }
    None
}

fn push_declaration(
    content: &str,
    relative: &str,
    selector: &str,
    score: u32,
    property: &str,
    observed_before: &str,
    fingerprint: &str,
    segment_start: usize,
    segment_end: usize,
    matches: &mut Vec<CssMatch>,
) {
    let bytes = content.as_bytes();
    let (start, end) = trim_ascii_range(bytes, segment_start, segment_end);
    if start >= end {
        return;
    }
    let Some(colon) = declaration_colon(bytes, start, end) else { return; };
    let (property_start, property_end) = trim_ascii_range(bytes, start, colon);
    if property_start >= property_end || !content[property_start..property_end].eq_ignore_ascii_case(property) {
        return;
    }
    let (value_start, value_end) = trim_ascii_range(bytes, colon + 1, end);
    if value_start >= value_end {
        return;
    }
    let value = &content[value_start..value_end];
    if value.to_ascii_lowercase().contains("var(") || normalized_literal(value) != normalized_literal(observed_before) {
        return;
    }
    let line = content.as_bytes()[..property_start].iter().filter(|byte| **byte == b'\n').count() + 1;
    matches.push(CssMatch {
        source_path: relative.to_string(),
        selector: selector.trim().chars().take(MAX_SELECTOR_BYTES).collect(),
        css_property: property.to_string(),
        line,
        value_start,
        value_end,
        source_value: value.to_string(),
        file_fingerprint: fingerprint.to_string(),
        score,
    });
}

fn scan_declarations(
    content: &str,
    relative: &str,
    selector: &str,
    score: u32,
    property: &str,
    observed_before: &str,
    fingerprint: &str,
    start: usize,
    end: usize,
    matches: &mut Vec<CssMatch>,
) {
    let bytes = content.as_bytes();
    let mut segment_start = start;
    let mut index = start;
    let mut parens = 0usize;
    let mut brackets = 0usize;
    while index < end {
        if let Some(next) = skip_comment(bytes, index, end) {
            index = next;
            continue;
        }
        if let Some(next) = skip_string(bytes, index, end) {
            index = next;
            continue;
        }
        match bytes[index] {
            b'(' => parens += 1,
            b')' => parens = parens.saturating_sub(1),
            b'[' => brackets += 1,
            b']' => brackets = brackets.saturating_sub(1),
            b'{' if parens == 0 && brackets == 0 => {
                let Some(close) = matching_brace(bytes, index, end) else { return; };
                segment_start = close + 1;
                index = close + 1;
                continue;
            }
            b';' if parens == 0 && brackets == 0 => {
                push_declaration(
                    content,
                    relative,
                    selector,
                    score,
                    property,
                    observed_before,
                    fingerprint,
                    segment_start,
                    index,
                    matches,
                );
                segment_start = index + 1;
            }
            _ => {}
        }
        index += 1;
    }
    push_declaration(
        content,
        relative,
        selector,
        score,
        property,
        observed_before,
        fingerprint,
        segment_start,
        end,
        matches,
    );
}

fn scan_rules(
    content: &str,
    relative: &str,
    id: &str,
    property: &str,
    observed_before: &str,
    fingerprint: &str,
    start: usize,
    end: usize,
    matches: &mut Vec<CssMatch>,
) {
    let bytes = content.as_bytes();
    let mut segment_start = start;
    let mut index = start;
    while index < end {
        if let Some(next) = skip_comment(bytes, index, end) {
            index = next;
            continue;
        }
        if let Some(next) = skip_string(bytes, index, end) {
            index = next;
            continue;
        }
        match bytes[index] {
            b';' => segment_start = index + 1,
            b'{' => {
                let Some(close) = matching_brace(bytes, index, end) else { return; };
                let (prelude_start, prelude_end) = trim_ascii_range(bytes, segment_start, index);
                if prelude_start < prelude_end {
                    let prelude = &content[prelude_start..prelude_end];
                    if prelude.trim_start().starts_with('@') {
                        scan_rules(
                            content,
                            relative,
                            id,
                            property,
                            observed_before,
                            fingerprint,
                            index + 1,
                            close,
                            matches,
                        );
                    } else {
                        let score = selector_score(prelude, id);
                        if score > 0 {
                            scan_declarations(
                                content,
                                relative,
                                prelude,
                                score,
                                property,
                                observed_before,
                                fingerprint,
                                index + 1,
                                close,
                                matches,
                            );
                        }
                    }
                }
                segment_start = close + 1;
                index = close;
            }
            _ => {}
        }
        index += 1;
    }
}

fn candidate(match_: &CssMatch) -> VisualSourceCandidate {
    VisualSourceCandidate {
        source_path: match_.source_path.clone(),
        selector: match_.selector.clone(),
        css_property: match_.css_property.clone(),
        line: match_.line,
        source_value: match_.source_value.clone(),
        score: match_.score,
    }
}

fn preview_lines(content: &str, start: usize, end: usize, after: &str) -> (String, String) {
    let line_start = content[..start].rfind('\n').map_or(0, |index| index + 1);
    let line_end = content[end..].find('\n').map_or(content.len(), |index| end + index);
    let before_line = content[line_start..line_end].trim_end().chars().take(700).collect::<String>();
    let mut changed = String::with_capacity(content.len().min(800));
    changed.push_str(&content[line_start..start]);
    changed.push_str(after);
    changed.push_str(&content[end..line_end]);
    (before_line, changed.trim_end().chars().take(700).collect())
}

fn plan_internal(input: &VisualSourcePlanInput) -> Result<VisualSourcePlanResponse, String> {
    let root = canonical_project(&input.project_path)?;
    let Some(id) = input.element_id.as_deref().map(str::trim).filter(|value| safe_ident(value)) else {
        return Ok(VisualSourcePlanResponse {
            status: "unsupported".into(),
            reason: "Deterministic CSS v1 requires a stable element id so Monument cannot silently turn an instance edit into a shared-class edit.".into(),
            candidate_count: 0,
            plan: None,
            candidates: Vec::new(),
        });
    };
    let Some(property) = css_property(input.property.trim()) else {
        return Ok(VisualSourcePlanResponse {
            status: "unsupported".into(),
            reason: "This property is not in the deterministic literal-CSS allowlist yet.".into(),
            candidate_count: 0,
            plan: None,
            candidates: Vec::new(),
        });
    };
    let before = clean_value(&input.before)?;
    let after = clean_value(&input.after)?;
    if normalized_literal(&before) == normalized_literal(&after) {
        return Err("Visual source plan has no effective value change".into());
    }

    let mut matches = Vec::new();
    for path in collect_css(&root) {
        if matches.len() > MAX_CANDIDATES * 4 {
            break;
        }
        let Ok(bytes) = fs::read(&path) else { continue; };
        let Ok(content) = std::str::from_utf8(&bytes) else { continue; };
        let relative = path
            .strip_prefix(&root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");
        let file_fingerprint = fingerprint(&bytes);
        scan_rules(
            content,
            &relative,
            id,
            property,
            &before,
            &file_fingerprint,
            0,
            content.len(),
            &mut matches,
        );
    }
    matches.sort_by(|left, right| {
        right
            .score
            .cmp(&left.score)
            .then_with(|| left.source_path.cmp(&right.source_path))
            .then_with(|| left.value_start.cmp(&right.value_start))
    });

    let public_candidates = matches.iter().take(MAX_CANDIDATES).map(candidate).collect::<Vec<_>>();
    if matches.is_empty() {
        return Ok(VisualSourcePlanResponse {
            status: "not-found".into(),
            reason: "No unique #id-owned literal CSS declaration matched the currently observed value. Monument will use the Codex source path instead.".into(),
            candidate_count: 0,
            plan: None,
            candidates: public_candidates,
        });
    }
    if matches.len() != 1 {
        return Ok(VisualSourcePlanResponse {
            status: "ambiguous".into(),
            reason: format!("{} literal CSS declarations match this element/property/value, so scope is ambiguous.", matches.len()),
            candidate_count: matches.len(),
            plan: None,
            candidates: public_candidates,
        });
    }

    let match_ = matches.remove(0);
    let path = root.join(&match_.source_path);
    let content = fs::read_to_string(&path).map_err(|error| format!("Cannot read planned CSS source: {error}"))?;
    let (preview_before, preview_after) = preview_lines(&content, match_.value_start, match_.value_end, &after);
    Ok(VisualSourcePlanResponse {
        status: "deterministic".into(),
        reason: "One stable #id-owned literal CSS declaration exactly matches the live computed value.".into(),
        candidate_count: 1,
        plan: Some(VisualSourcePlan {
            source_path: match_.source_path,
            selector: match_.selector,
            requested_property: input.property.clone(),
            css_property: match_.css_property,
            line: match_.line,
            value_start: match_.value_start,
            value_end: match_.value_end,
            before_source: match_.source_value,
            after_source: after,
            file_fingerprint: match_.file_fingerprint,
            preview_before,
            preview_after,
            confidence: 0.99,
        }),
        candidates: public_candidates,
    })
}

fn validate_relative_path(value: &str) -> Result<&Path, String> {
    let path = Path::new(value);
    if value.is_empty()
        || path.is_absolute()
        || path.components().any(|component| matches!(component, Component::ParentDir | Component::RootDir | Component::Prefix(_)))
    {
        return Err("Unsafe visual source path".into());
    }
    Ok(path)
}

fn ensure_no_symlink_path(root: &Path, relative: &Path) -> Result<PathBuf, String> {
    let mut cursor = root.to_path_buf();
    for component in relative.components() {
        let Component::Normal(part) = component else { return Err("Unsafe visual source path".into()); };
        cursor.push(part);
        let metadata = fs::symlink_metadata(&cursor).map_err(|error| format!("Cannot inspect visual source path: {error}"))?;
        if metadata.file_type().is_symlink() {
            return Err("Deterministic visual edits do not follow symlinks".into());
        }
    }
    let canonical = cursor.canonicalize().map_err(|error| format!("Cannot resolve visual source path: {error}"))?;
    if !canonical.starts_with(root) || !canonical.is_file() || !css_file(&canonical) {
        return Err("Deterministic visual edit target is outside the supported project CSS boundary".into());
    }
    Ok(canonical)
}

fn atomic_write(path: &Path, content: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or_else(|| "Visual source file has no parent directory".to_string())?;
    let name = path.file_name().and_then(|value| value.to_str()).unwrap_or("source.css");
    let counter = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
    let temp = parent.join(format!(".{name}.monument-{}-{now}-{counter}.tmp", std::process::id()));
    let permissions = fs::metadata(path).map_err(|error| error.to_string())?.permissions();
    let result = (|| {
        let mut file = OpenOptions::new().create_new(true).write(true).open(&temp).map_err(|error| error.to_string())?;
        file.write_all(content).map_err(|error| error.to_string())?;
        file.sync_all().map_err(|error| error.to_string())?;
        fs::set_permissions(&temp, permissions).map_err(|error| error.to_string())?;
        fs::rename(&temp, path).map_err(|error| error.to_string())?;
        Ok::<(), String>(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}

#[tauri::command]
pub fn visual_source_plan(input: VisualSourcePlanInput) -> Result<VisualSourcePlanResponse, String> {
    plan_internal(&input)
}

#[tauri::command]
pub fn visual_source_apply(input: VisualSourceApplyInput) -> Result<VisualSourceApplyResult, String> {
    let response = plan_internal(&input.request)?;
    let Some(plan) = response.plan else {
        return Err(format!("Deterministic visual source apply is unavailable: {}", response.reason));
    };
    if response.status != "deterministic"
        || plan.source_path != input.expected_source_path
        || plan.file_fingerprint != input.expected_file_fingerprint
        || plan.value_start != input.expected_value_start
        || plan.value_end != input.expected_value_end
    {
        return Err("Visual source changed after dry-run. Re-plan before applying.".into());
    }

    let root = canonical_project(&input.request.project_path)?;
    let relative = validate_relative_path(&plan.source_path)?;
    let path = ensure_no_symlink_path(&root, relative)?;
    let bytes = fs::read(&path).map_err(|error| format!("Cannot read visual source for apply: {error}"))?;
    if fingerprint(&bytes) != plan.file_fingerprint {
        return Err("Visual source changed after dry-run. Re-plan before applying.".into());
    }
    let content = std::str::from_utf8(&bytes).map_err(|_| "Deterministic CSS source must be UTF-8".to_string())?;
    if plan.value_start > plan.value_end || plan.value_end > content.len() || &content[plan.value_start..plan.value_end] != plan.before_source {
        return Err("Visual source declaration no longer matches the dry-run range".into());
    }

    let mut next = Vec::with_capacity(bytes.len() + plan.after_source.len());
    next.extend_from_slice(&bytes[..plan.value_start]);
    next.extend_from_slice(plan.after_source.as_bytes());
    next.extend_from_slice(&bytes[plan.value_end..]);
    atomic_write(&path, &next)?;
    let next_fingerprint = fingerprint(&next);

    Ok(VisualSourceApplyResult {
        source_path: plan.source_path.clone(),
        css_property: plan.css_property.clone(),
        line: plan.line,
        previous_fingerprint: plan.file_fingerprint.clone(),
        next_fingerprint,
        bytes_written: next.len(),
        plan,
    })
}

#[cfg(test)]
mod tests {
    use super::{clean_value, plan_internal, visual_source_apply, VisualSourceApplyInput, VisualSourcePlanInput};
    use std::fs;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEST_COUNTER: AtomicU64 = AtomicU64::new(1);

    fn fixture(css: &str) -> (PathBuf, VisualSourcePlanInput) {
        let id = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
        let root = std::env::temp_dir().join(format!("monument-visual-source-{}-{id}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("app.css"), css).unwrap();
        let input = VisualSourcePlanInput {
            project_path: root.to_string_lossy().to_string(),
            element_id: Some("hero".into()),
            property: "paddingTop".into(),
            before: "24px".into(),
            after: "32px".into(),
        };
        (root, input)
    }

    #[test]
    fn accepts_balanced_literal_css_values() {
        assert!(clean_value("32px").is_ok());
        assert!(clean_value("calc(100% - 24px)").is_ok());
        assert!(clean_value("linear-gradient(90deg, rgb(0 0 0 / .2), transparent)").is_ok());
        assert!(clean_value("'Open Sans', sans-serif").is_ok());
        assert!(clean_value("url(\"/hero image.webp\") center / cover").is_ok());
    }

    #[test]
    fn rejects_malformed_or_breakout_css_values() {
        assert!(clean_value("calc(100% - 24px").is_err());
        assert!(clean_value("url(\"/hero.png)").is_err());
        assert!(clean_value("32px; color: red").is_err());
        assert!(clean_value("32px} body { color: red").is_err());
        assert!(clean_value("32px\0color:red").is_err());
        assert!(clean_value("foo\\bar").is_err());
    }

    #[test]
    fn plans_one_exact_id_owned_literal_declaration() {
        let (root, input) = fixture("#hero { color: red; padding-top: 24px; }\n");
        let result = plan_internal(&input).unwrap();
        assert_eq!(result.status, "deterministic");
        assert_eq!(result.candidate_count, 1);
        let plan = result.plan.unwrap();
        assert_eq!(plan.source_path, "app.css");
        assert_eq!(plan.css_property, "padding-top");
        assert_eq!(plan.before_source, "24px");
        assert_eq!(plan.after_source, "32px");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn literal_matching_preserves_case_sensitive_semantics() {
        let (root, mut input) = fixture("#hero { background-image: url(\"/Hero.PNG\"); }\n");
        input.property = "backgroundImage".into();
        input.before = "url(\"/hero.png\")".into();
        input.after = "url(\"/next.png\")".into();
        assert_eq!(plan_internal(&input).unwrap().status, "not-found");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn refuses_token_backed_values_case_insensitively() {
        let (root, mut input) = fixture("#hero { padding-top: VAR(--space); }\n");
        input.before = "VAR(--space)".into();
        input.after = "32px".into();
        assert_eq!(plan_internal(&input).unwrap().status, "not-found");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn refuses_attribute_selector_id_lookalikes() {
        let (root, input) = fixture("a[href=\"#hero\"] { padding-top: 24px; }\n");
        assert_eq!(plan_internal(&input).unwrap().status, "not-found");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn refuses_shared_class_scope_and_ambiguous_id_rules() {
        let (class_root, mut class_input) = fixture(".hero { padding-top: 24px; }\n");
        class_input.element_id = None;
        assert_eq!(plan_internal(&class_input).unwrap().status, "unsupported");
        let _ = fs::remove_dir_all(class_root);

        let (root, input) = fixture("#hero { padding-top: 24px; }\n@media (max-width: 600px) { #hero { padding-top: 24px; } }\n");
        assert_eq!(plan_internal(&input).unwrap().status, "ambiguous");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn apply_replans_and_rejects_stale_dry_run() {
        let (root, input) = fixture("#hero { padding-top: 24px; }\n");
        let response = plan_internal(&input).unwrap();
        let plan = response.plan.unwrap();
        fs::write(root.join("app.css"), "#hero { padding-top: 25px; }\n").unwrap();
        let result = visual_source_apply(VisualSourceApplyInput {
            request: input,
            expected_source_path: plan.source_path,
            expected_file_fingerprint: plan.file_fingerprint,
            expected_value_start: plan.value_start,
            expected_value_end: plan.value_end,
        });
        assert!(result.is_err());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn apply_changes_only_the_planned_literal_value() {
        let (root, input) = fixture("#hero { color: red; padding-top: 24px; }\n");
        let response = plan_internal(&input).unwrap();
        let plan = response.plan.unwrap();
        visual_source_apply(VisualSourceApplyInput {
            request: input,
            expected_source_path: plan.source_path.clone(),
            expected_file_fingerprint: plan.file_fingerprint.clone(),
            expected_value_start: plan.value_start,
            expected_value_end: plan.value_end,
        }).unwrap();
        assert_eq!(fs::read_to_string(root.join("app.css")).unwrap(), "#hero { color: red; padding-top: 32px; }\n");
        let _ = fs::remove_dir_all(root);
    }
}
