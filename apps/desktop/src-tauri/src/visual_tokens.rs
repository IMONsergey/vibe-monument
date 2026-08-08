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
const MAX_TOKEN_BYTES: usize = 120;
static TEMP_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VisualTokenPlanInput {
    project_path: String,
    element_id: Option<String>,
    property: String,
    before: String,
    after: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VisualTokenScopePlan {
    scope: String,
    token_name: String,
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
pub struct VisualTokenPlanResponse {
    status: String,
    reason: String,
    token_name: Option<String>,
    usage_count: usize,
    element_plan: Option<VisualTokenScopePlan>,
    token_plan: Option<VisualTokenScopePlan>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VisualTokenApplyInput {
    request: VisualTokenPlanInput,
    scope: String,
    expected_source_path: String,
    expected_file_fingerprint: String,
    expected_value_start: usize,
    expected_value_end: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VisualTokenApplyResult {
    scope: String,
    token_name: String,
    source_path: String,
    css_property: String,
    line: usize,
    previous_fingerprint: String,
    next_fingerprint: String,
    bytes_written: usize,
    plan: VisualTokenScopePlan,
}

#[derive(Debug, Clone)]
struct RuleSpan {
    selector: String,
    body_start: usize,
    body_end: usize,
    at_rule_depth: usize,
}

#[derive(Debug, Clone)]
struct Declaration {
    name: String,
    value: String,
    line: usize,
    value_start: usize,
    value_end: usize,
}

#[derive(Debug, Clone)]
struct SourceMatch {
    source_path: String,
    selector: String,
    css_property: String,
    line: usize,
    value_start: usize,
    value_end: usize,
    source_value: String,
    file_fingerprint: String,
}

fn canonical_project(project_path: &str) -> Result<PathBuf, String> {
    let root = PathBuf::from(project_path)
        .canonicalize()
        .map_err(|error| format!("Cannot inspect visual token source: {error}"))?;
    if !root.is_dir() {
        return Err("Visual token source root is not a directory".into());
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

fn safe_token(value: &str) -> bool {
    value.starts_with("--")
        && value.len() <= MAX_TOKEN_BYTES
        && value.len() > 2
        && value[2..]
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
        if let Some(active) = quote {
            if escaped {
                escaped = false;
                continue;
            }
            if ch == '\\' {
                escaped = true;
            } else if ch == active {
                quote = None;
            }
            continue;
        }
        match ch {
            '\'' | '"' => quote = Some(ch),
            '(' => parens += 1,
            ')' if parens == 0 => return false,
            ')' => parens -= 1,
            '[' => brackets += 1,
            ']' if brackets == 0 => return false,
            ']' => brackets -= 1,
            '\\' => return false,
            _ => {}
        }
    }
    quote.is_none() && !escaped && parens == 0 && brackets == 0
}

fn clean_value(value: &str) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() || value.len() > MAX_VALUE_BYTES {
        return Err("Visual token value is empty or exceeds the deterministic edit boundary".into());
    }
    if value.contains(['\n', '\r', '{', '}', ';'])
        || value.contains("/*")
        || value.contains("*/")
        || !css_value_is_balanced(value)
    {
        return Err("Visual token value requires Codex because it is not one safe balanced CSS literal".into());
    }
    Ok(value.to_string())
}

fn normalized_literal(value: &str) -> String {
    value.trim().to_ascii_lowercase()
}

fn exact_var_reference(value: &str) -> Option<String> {
    let value = value.trim();
    let inner = value.strip_prefix("var(")?.strip_suffix(')')?.trim();
    if inner.contains(',') || !safe_token(inner) {
        return None;
    }
    Some(inner.to_string())
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

fn collect_rules(content: &str, start: usize, end: usize, at_rule_depth: usize, output: &mut Vec<RuleSpan>) {
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
                    let prelude = content[prelude_start..prelude_end].trim();
                    if prelude.starts_with('@') {
                        collect_rules(content, index + 1, close, at_rule_depth + 1, output);
                    } else {
                        output.push(RuleSpan {
                            selector: prelude.chars().take(700).collect(),
                            body_start: index + 1,
                            body_end: close,
                            at_rule_depth,
                        });
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

fn collect_declarations(content: &str, rule: &RuleSpan) -> Option<Vec<Declaration>> {
    let bytes = content.as_bytes();
    let mut declarations = Vec::new();
    let mut segment_start = rule.body_start;
    let mut index = rule.body_start;
    let mut parens = 0usize;
    let mut brackets = 0usize;
    while index < rule.body_end {
        if let Some(next) = skip_comment(bytes, index, rule.body_end) {
            index = next;
            continue;
        }
        if let Some(next) = skip_string(bytes, index, rule.body_end) {
            index = next;
            continue;
        }
        match bytes[index] {
            b'(' => parens += 1,
            b')' => parens = parens.saturating_sub(1),
            b'[' => brackets += 1,
            b']' => brackets = brackets.saturating_sub(1),
            b'{' | b'}' if parens == 0 && brackets == 0 => return None,
            b';' if parens == 0 && brackets == 0 => {
                push_declaration(content, bytes, segment_start, index, &mut declarations);
                segment_start = index + 1;
            }
            _ => {}
        }
        index += 1;
    }
    push_declaration(content, bytes, segment_start, rule.body_end, &mut declarations);
    Some(declarations)
}

fn push_declaration(content: &str, bytes: &[u8], start: usize, end: usize, output: &mut Vec<Declaration>) {
    let (start, end) = trim_ascii_range(bytes, start, end);
    if start >= end {
        return;
    }
    let Some(colon) = declaration_colon(bytes, start, end) else { return; };
    let (name_start, name_end) = trim_ascii_range(bytes, start, colon);
    let (value_start, value_end) = trim_ascii_range(bytes, colon + 1, end);
    if name_start >= name_end || value_start >= value_end {
        return;
    }
    let line = bytes[..name_start].iter().filter(|byte| **byte == b'\n').count() + 1;
    output.push(Declaration {
        name: content[name_start..name_end].trim().to_string(),
        value: content[value_start..value_end].trim().to_string(),
        line,
        value_start,
        value_end,
    });
}

fn token_mentions(content: &str, token: &str) -> usize {
    content.matches(token).count()
}

fn preview_lines(content: &str, start: usize, end: usize, after: &str) -> (String, String) {
    let line_start = content[..start].rfind('\n').map_or(0, |index| index + 1);
    let line_end = content[end..].find('\n').map_or(content.len(), |index| end + index);
    let before_line = content[line_start..line_end].trim_end().chars().take(700).collect::<String>();
    let mut changed = String::with_capacity((line_end - line_start) + after.len());
    changed.push_str(&content[line_start..start]);
    changed.push_str(after);
    changed.push_str(&content[end..line_end]);
    (before_line, changed.trim_end().chars().take(700).collect())
}

fn scope_plan(
    scope: &str,
    token: &str,
    requested_property: &str,
    match_: &SourceMatch,
    after: &str,
    content: &str,
) -> VisualTokenScopePlan {
    let (preview_before, preview_after) = preview_lines(content, match_.value_start, match_.value_end, after);
    VisualTokenScopePlan {
        scope: scope.into(),
        token_name: token.into(),
        source_path: match_.source_path.clone(),
        selector: match_.selector.clone(),
        requested_property: requested_property.into(),
        css_property: match_.css_property.clone(),
        line: match_.line,
        value_start: match_.value_start,
        value_end: match_.value_end,
        before_source: match_.source_value.clone(),
        after_source: after.into(),
        file_fingerprint: match_.file_fingerprint.clone(),
        preview_before,
        preview_after,
        confidence: 0.99,
    }
}

fn plan_internal(input: &VisualTokenPlanInput) -> Result<VisualTokenPlanResponse, String> {
    let root = canonical_project(&input.project_path)?;
    let Some(id) = input.element_id.as_deref().map(str::trim).filter(|value| safe_ident(value)) else {
        return Ok(VisualTokenPlanResponse {
            status: "unsupported".into(),
            reason: "Token transactions require a stable live element id.".into(),
            token_name: None,
            usage_count: 0,
            element_plan: None,
            token_plan: None,
        });
    };
    let Some(property) = css_property(input.property.trim()) else {
        return Ok(VisualTokenPlanResponse {
            status: "unsupported".into(),
            reason: "This property is not in the deterministic token allowlist yet.".into(),
            token_name: None,
            usage_count: 0,
            element_plan: None,
            token_plan: None,
        });
    };
    let before = clean_value(&input.before)?;
    let after = clean_value(&input.after)?;
    if normalized_literal(&before) == normalized_literal(&after) {
        return Err("Visual token plan has no effective value change".into());
    }

    let expected_selector = format!("#{id}");
    let files = collect_css(&root);
    let mut references: Vec<(SourceMatch, String)> = Vec::new();
    let mut id_property_conflict = false;

    for path in &files {
        let Ok(bytes) = fs::read(path) else { continue; };
        let Ok(content) = std::str::from_utf8(&bytes) else { continue; };
        let relative = path.strip_prefix(&root).unwrap_or(path).to_string_lossy().replace('\\', "/");
        let file_fingerprint = fingerprint(&bytes);
        let mut rules = Vec::new();
        collect_rules(content, 0, content.len(), 0, &mut rules);
        for rule in rules {
            let selector_mentions_id = rule.selector.contains(&format!("#{id}"));
            if !selector_mentions_id {
                continue;
            }
            let Some(declarations) = collect_declarations(content, &rule) else {
                id_property_conflict = true;
                continue;
            };
            for declaration in declarations.into_iter().filter(|declaration| declaration.name.eq_ignore_ascii_case(property)) {
                if rule.at_rule_depth > 0 || rule.selector.trim() != expected_selector {
                    id_property_conflict = true;
                    continue;
                }
                let Some(token) = exact_var_reference(&declaration.value) else {
                    id_property_conflict = true;
                    continue;
                };
                references.push((SourceMatch {
                    source_path: relative.clone(),
                    selector: rule.selector.clone(),
                    css_property: property.into(),
                    line: declaration.line,
                    value_start: declaration.value_start,
                    value_end: declaration.value_end,
                    source_value: declaration.value,
                    file_fingerprint: file_fingerprint.clone(),
                }, token));
            }
        }
    }

    if id_property_conflict || references.len() != 1 {
        return Ok(VisualTokenPlanResponse {
            status: if references.len() > 1 || id_property_conflict { "ambiguous" } else { "not-found" }.into(),
            reason: "Token-backed property ownership is missing, responsive, scoped, duplicated, or otherwise ambiguous.".into(),
            token_name: references.first().map(|(_, token)| token.clone()),
            usage_count: 0,
            element_plan: None,
            token_plan: None,
        });
    }

    let (reference, token) = references.remove(0);
    let mut definitions = Vec::new();
    let mut token_scope_conflict = false;
    let mut usage_count = 0usize;

    for path in &files {
        let Ok(bytes) = fs::read(path) else { continue; };
        let Ok(content) = std::str::from_utf8(&bytes) else { continue; };
        usage_count = usage_count.saturating_add(token_mentions(content, &token));
        let relative = path.strip_prefix(&root).unwrap_or(path).to_string_lossy().replace('\\', "/");
        let file_fingerprint = fingerprint(&bytes);
        let mut rules = Vec::new();
        collect_rules(content, 0, content.len(), 0, &mut rules);
        for rule in rules {
            let Some(declarations) = collect_declarations(content, &rule) else { continue; };
            for declaration in declarations.into_iter().filter(|declaration| declaration.name == token) {
                if rule.at_rule_depth > 0 || rule.selector.trim() != ":root" {
                    token_scope_conflict = true;
                    continue;
                }
                if declaration.value.contains("var(")
                    || clean_value(&declaration.value).is_err()
                    || normalized_literal(&declaration.value) != normalized_literal(&before)
                {
                    token_scope_conflict = true;
                    continue;
                }
                definitions.push(SourceMatch {
                    source_path: relative.clone(),
                    selector: rule.selector.clone(),
                    css_property: token.clone(),
                    line: declaration.line,
                    value_start: declaration.value_start,
                    value_end: declaration.value_end,
                    source_value: declaration.value,
                    file_fingerprint: file_fingerprint.clone(),
                });
            }
        }
    }

    if token_scope_conflict || definitions.len() != 1 {
        return Ok(VisualTokenPlanResponse {
            status: "ambiguous".into(),
            reason: "The custom property does not have one proved top-level :root literal definition matching the live computed value.".into(),
            token_name: Some(token),
            usage_count,
            element_plan: None,
            token_plan: None,
        });
    }

    let definition = definitions.remove(0);
    let reference_content = fs::read_to_string(root.join(&reference.source_path))
        .map_err(|error| format!("Cannot read token reference source: {error}"))?;
    let definition_content = fs::read_to_string(root.join(&definition.source_path))
        .map_err(|error| format!("Cannot read token definition source: {error}"))?;

    Ok(VisualTokenPlanResponse {
        status: "scope-choice".into(),
        reason: "One exact token reference and one matching global :root definition were proved. Choose element or global token scope.".into(),
        token_name: Some(token.clone()),
        usage_count,
        element_plan: Some(scope_plan("element", &token, &input.property, &reference, &after, &reference_content)),
        token_plan: Some(scope_plan("token", &token, &input.property, &definition, &after, &definition_content)),
    })
}

fn validate_relative_path(value: &str) -> Result<&Path, String> {
    let path = Path::new(value);
    if value.is_empty()
        || path.is_absolute()
        || path.components().any(|component| matches!(component, Component::ParentDir | Component::RootDir | Component::Prefix(_)))
    {
        return Err("Unsafe visual token source path".into());
    }
    Ok(path)
}

fn ensure_no_symlink_path(root: &Path, relative: &Path) -> Result<PathBuf, String> {
    let mut cursor = root.to_path_buf();
    for component in relative.components() {
        let Component::Normal(part) = component else { return Err("Unsafe visual token source path".into()); };
        cursor.push(part);
        let metadata = fs::symlink_metadata(&cursor).map_err(|error| format!("Cannot inspect visual token source path: {error}"))?;
        if metadata.file_type().is_symlink() {
            return Err("Deterministic visual token edits do not follow symlinks".into());
        }
    }
    let canonical = cursor.canonicalize().map_err(|error| format!("Cannot resolve visual token source path: {error}"))?;
    if !canonical.starts_with(root) || !canonical.is_file() || !css_file(&canonical) {
        return Err("Deterministic visual token target is outside the supported project CSS boundary".into());
    }
    Ok(canonical)
}

fn atomic_write(path: &Path, content: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or_else(|| "Visual token source file has no parent directory".to_string())?;
    let name = path.file_name().and_then(|value| value.to_str()).unwrap_or("source.css");
    let counter = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
    let temp = parent.join(format!(".{name}.monument-token-{}-{now}-{counter}.tmp", std::process::id()));
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

fn plan_for_scope<'a>(response: &'a VisualTokenPlanResponse, scope: &str) -> Option<&'a VisualTokenScopePlan> {
    match scope {
        "element" => response.element_plan.as_ref(),
        "token" => response.token_plan.as_ref(),
        _ => None,
    }
}

#[tauri::command]
pub fn visual_token_plan(input: VisualTokenPlanInput) -> Result<VisualTokenPlanResponse, String> {
    plan_internal(&input)
}

#[tauri::command]
pub fn visual_token_apply(input: VisualTokenApplyInput) -> Result<VisualTokenApplyResult, String> {
    let response = plan_internal(&input.request)?;
    if response.status != "scope-choice" {
        return Err(format!("Deterministic token apply is unavailable: {}", response.reason));
    }
    let plan = plan_for_scope(&response, input.scope.trim())
        .ok_or_else(|| "Unknown or unavailable visual token scope".to_string())?
        .clone();
    if plan.source_path != input.expected_source_path
        || plan.file_fingerprint != input.expected_file_fingerprint
        || plan.value_start != input.expected_value_start
        || plan.value_end != input.expected_value_end
    {
        return Err("Visual token source changed after dry-run. Re-plan before applying.".into());
    }

    let root = canonical_project(&input.request.project_path)?;
    let relative = validate_relative_path(&plan.source_path)?;
    let path = ensure_no_symlink_path(&root, relative)?;
    let bytes = fs::read(&path).map_err(|error| format!("Cannot read visual token source for apply: {error}"))?;
    if fingerprint(&bytes) != plan.file_fingerprint {
        return Err("Visual token source changed after dry-run. Re-plan before applying.".into());
    }
    let content = std::str::from_utf8(&bytes).map_err(|_| "Deterministic token CSS source must be UTF-8".to_string())?;
    if plan.value_start > plan.value_end
        || plan.value_end > content.len()
        || &content[plan.value_start..plan.value_end] != plan.before_source
    {
        return Err("Visual token declaration no longer matches the dry-run range".into());
    }
    clean_value(&plan.after_source)?;

    let mut next = Vec::with_capacity(bytes.len() + plan.after_source.len());
    next.extend_from_slice(&bytes[..plan.value_start]);
    next.extend_from_slice(plan.after_source.as_bytes());
    next.extend_from_slice(&bytes[plan.value_end..]);
    atomic_write(&path, &next)?;
    let next_fingerprint = fingerprint(&next);

    Ok(VisualTokenApplyResult {
        scope: plan.scope.clone(),
        token_name: plan.token_name.clone(),
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
    use super::{plan_internal, visual_token_apply, VisualTokenApplyInput, VisualTokenPlanInput};
    use std::fs;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEST_COUNTER: AtomicU64 = AtomicU64::new(1);

    fn fixture(css: &str) -> (PathBuf, VisualTokenPlanInput) {
        let id = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
        let root = std::env::temp_dir().join(format!("monument-visual-token-{}-{id}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("app.css"), css).unwrap();
        let input = VisualTokenPlanInput {
            project_path: root.to_string_lossy().to_string(),
            element_id: Some("hero".into()),
            property: "paddingTop".into(),
            before: "24px".into(),
            after: "32px".into(),
        };
        (root, input)
    }

    #[test]
    fn plans_explicit_element_and_global_token_scopes() {
        let (root, input) = fixture(":root { --space-xl: 24px; }\n#hero { padding-top: var(--space-xl); }\n.card { gap: var(--space-xl); }\n");
        let result = plan_internal(&input).unwrap();
        assert_eq!(result.status, "scope-choice");
        assert_eq!(result.token_name.as_deref(), Some("--space-xl"));
        assert!(result.usage_count >= 3);
        let element = result.element_plan.unwrap();
        let token = result.token_plan.unwrap();
        assert_eq!(element.scope, "element");
        assert_eq!(element.before_source, "var(--space-xl)");
        assert_eq!(element.after_source, "32px");
        assert_eq!(token.scope, "token");
        assert_eq!(token.selector, ":root");
        assert_eq!(token.before_source, "24px");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn refuses_fallback_nested_scoped_or_mismatched_tokens() {
        let cases = [
            ":root { --space-xl: 24px; } #hero { padding-top: var(--space-xl, 20px); }",
            ":root { --space-xl: var(--space-lg); } #hero { padding-top: var(--space-xl); }",
            ":root { --space-xl: 20px; } #hero { padding-top: var(--space-xl); }",
            ":root { --space-xl: 24px; } .theme { --space-xl: 24px; } #hero { padding-top: var(--space-xl); }",
            ":root { --space-xl: 24px; } @media (max-width: 600px) { #hero { padding-top: var(--space-xl); } }",
        ];
        for css in cases {
            let (root, input) = fixture(css);
            assert_ne!(plan_internal(&input).unwrap().status, "scope-choice");
            let _ = fs::remove_dir_all(root);
        }
    }

    #[test]
    fn applies_only_the_selected_scope_and_replans_stale_source() {
        let (root, input) = fixture(":root { --space-xl: 24px; }\n#hero { padding-top: var(--space-xl); }\n");
        let result = plan_internal(&input).unwrap();
        let element = result.element_plan.clone().unwrap();
        visual_token_apply(VisualTokenApplyInput {
            request: input.clone(),
            scope: "element".into(),
            expected_source_path: element.source_path,
            expected_file_fingerprint: element.file_fingerprint,
            expected_value_start: element.value_start,
            expected_value_end: element.value_end,
        }).unwrap();
        let content = fs::read_to_string(root.join("app.css")).unwrap();
        assert!(content.contains("--space-xl: 24px"));
        assert!(content.contains("padding-top: 32px"));
        let _ = fs::remove_dir_all(root);

        let (root, input) = fixture(":root { --space-xl: 24px; }\n#hero { padding-top: var(--space-xl); }\n");
        let result = plan_internal(&input).unwrap();
        let token = result.token_plan.clone().unwrap();
        fs::write(root.join("app.css"), ":root { --space-xl: 25px; }\n#hero { padding-top: var(--space-xl); }\n").unwrap();
        assert!(visual_token_apply(VisualTokenApplyInput {
            request: input,
            scope: "token".into(),
            expected_source_path: token.source_path,
            expected_file_fingerprint: token.file_fingerprint,
            expected_value_start: token.value_start,
            expected_value_end: token.value_end,
        }).is_err());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn applies_global_token_scope_without_detaching_reference() {
        let (root, input) = fixture(":root { --space-xl: 24px; }\n#hero { padding-top: var(--space-xl); }\n");
        let result = plan_internal(&input).unwrap();
        let token = result.token_plan.clone().unwrap();
        visual_token_apply(VisualTokenApplyInput {
            request: input,
            scope: "token".into(),
            expected_source_path: token.source_path,
            expected_file_fingerprint: token.file_fingerprint,
            expected_value_start: token.value_start,
            expected_value_end: token.value_end,
        }).unwrap();
        let content = fs::read_to_string(root.join("app.css")).unwrap();
        assert!(content.contains("--space-xl: 32px"));
        assert!(content.contains("padding-top: var(--space-xl)"));
        let _ = fs::remove_dir_all(root);
    }
}
