use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_CSS_FILES: usize = 800;
const MAX_FILE_BYTES: u64 = 1_500_000;
const MAX_TOTAL_BYTES: u64 = 16_000_000;
const MAX_CHANGES: usize = 24;
const MAX_VALUE_BYTES: usize = 300;
const MAX_SELECTOR_IDENT: usize = 96;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceTransactionSelection {
    id: Option<String>,
    #[serde(default)]
    classes: Vec<String>,
    selector: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceTransactionChange {
    property: String,
    before: String,
    after: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum SourceTransactionMode {
    Deterministic,
    Assisted,
    Codex,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceTransactionOperation {
    path: String,
    line: usize,
    selector: String,
    property: String,
    source_before: String,
    source_after: String,
    owner_kind: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceTransactionPlan {
    mode: SourceTransactionMode,
    reason: String,
    operations: Vec<SourceTransactionOperation>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceTransactionCommit {
    path: String,
    applied_count: usize,
    bytes_written: usize,
}

#[derive(Debug, Clone)]
struct RuleBlock {
    selector: String,
    body_start: usize,
    body_end: usize,
}

#[derive(Debug, Clone)]
struct BlockContext {
    selector: String,
    body_start: usize,
    has_nested_block: bool,
}

#[derive(Debug, Clone)]
struct DeclarationCandidate {
    relative_path: String,
    line: usize,
    selector: String,
    property: String,
    source_before: String,
    replacement_start: usize,
    replacement_end: usize,
    selector_score: u32,
}

#[derive(Debug, Clone)]
struct ResolvedOperation {
    public: SourceTransactionOperation,
    replacement_start: usize,
    replacement_end: usize,
}

#[derive(Debug, Clone)]
struct ResolvedPlan {
    public: SourceTransactionPlan,
    operations: Vec<ResolvedOperation>,
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
    )
}

fn collect_css_sources(directory: &Path, files: &mut Vec<PathBuf>, total_bytes: &mut u64) {
    if files.len() >= MAX_CSS_FILES || *total_bytes >= MAX_TOTAL_BYTES {
        return;
    }
    let Ok(entries) = fs::read_dir(directory) else {
        return;
    };
    let mut entries: Vec<_> = entries.filter_map(Result::ok).collect();
    entries.sort_by_key(|entry| entry.path());
    for entry in entries {
        if files.len() >= MAX_CSS_FILES || *total_bytes >= MAX_TOTAL_BYTES {
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
                collect_css_sources(&path, files, total_bytes);
            }
            continue;
        }
        if path.extension().and_then(|value| value.to_str()) != Some("css") {
            continue;
        }
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        let size = metadata.len();
        if size <= MAX_FILE_BYTES && total_bytes.saturating_add(size) <= MAX_TOTAL_BYTES {
            *total_bytes += size;
            files.push(path);
        }
    }
}

fn safe_selector_ident(value: Option<&str>) -> Option<String> {
    let value = value?.trim();
    if value.is_empty() || value.len() > MAX_SELECTOR_IDENT {
        return None;
    }
    if !value
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    {
        return None;
    }
    Some(value.to_string())
}

fn selector_token_present(selector: &str, prefix: u8, ident: &str) -> bool {
    let needle = format!("{}{}", prefix as char, ident);
    for (start, _) in selector.match_indices(&needle) {
        if start > 0 && selector.as_bytes()[start - 1] == b'\\' {
            continue;
        }
        let end = start + needle.len();
        let boundary_ok = selector.as_bytes().get(end).is_none_or(|byte| {
            !byte.is_ascii_alphanumeric() && !matches!(*byte, b'-' | b'_')
        });
        if boundary_ok {
            return true;
        }
    }
    false
}

fn selector_score(selector: &str, selection: &SourceTransactionSelection) -> u32 {
    if selector.trim_start().starts_with('@') {
        return 0;
    }
    let mut score = 0;
    if let Some(id) = safe_selector_ident(selection.id.as_deref()) {
        if selector_token_present(selector, b'#', &id) {
            score += 100;
        }
    }
    let mut seen = HashSet::new();
    for class in selection.classes.iter().take(16) {
        let Some(class) = safe_selector_ident(Some(class)) else {
            continue;
        };
        if seen.insert(class.clone()) && selector_token_present(selector, b'.', &class) {
            score += 20;
        }
    }
    if score == 0 {
        if let Some(selector_hint) = selection.selector.as_deref() {
            let hint = selector_hint.trim();
            if !hint.is_empty() && hint.len() <= 220 && selector.trim() == hint {
                score = 10;
            }
        }
    }
    score
}

fn rule_blocks(content: &str) -> Result<Vec<RuleBlock>, String> {
    let bytes = content.as_bytes();
    let mut blocks = Vec::new();
    let mut stack: Vec<BlockContext> = Vec::new();
    let mut segment_start = 0usize;
    let mut quote: Option<u8> = None;
    let mut escaped = false;
    let mut in_comment = false;
    let mut i = 0usize;

    while i < bytes.len() {
        let byte = bytes[i];
        if in_comment {
            if byte == b'*' && bytes.get(i + 1) == Some(&b'/') {
                in_comment = false;
                i += 2;
                continue;
            }
            i += 1;
            continue;
        }
        if let Some(active_quote) = quote {
            if escaped {
                escaped = false;
            } else if byte == b'\\' {
                escaped = true;
            } else if byte == active_quote {
                quote = None;
            }
            i += 1;
            continue;
        }
        if byte == b'/' && bytes.get(i + 1) == Some(&b'*') {
            in_comment = true;
            i += 2;
            continue;
        }
        if matches!(byte, b'\'' | b'"') {
            quote = Some(byte);
            i += 1;
            continue;
        }
        match byte {
            b'{' => {
                if let Some(parent) = stack.last_mut() {
                    parent.has_nested_block = true;
                }
                let selector = content[segment_start..i].trim().to_string();
                stack.push(BlockContext {
                    selector,
                    body_start: i + 1,
                    has_nested_block: false,
                });
                segment_start = i + 1;
            }
            b';' => segment_start = i + 1,
            b'}' => {
                let Some(context) = stack.pop() else {
                    return Err("CSS source has an unmatched closing brace".into());
                };
                if !context.has_nested_block && !context.selector.trim_start().starts_with('@') {
                    blocks.push(RuleBlock {
                        selector: context.selector,
                        body_start: context.body_start,
                        body_end: i,
                    });
                }
                segment_start = i + 1;
            }
            _ => {}
        }
        i += 1;
    }

    if quote.is_some() || in_comment || !stack.is_empty() {
        return Err("CSS source has an unterminated string, comment or block".into());
    }
    Ok(blocks)
}

fn value_is_balanced(value: &str) -> bool {
    if value.is_empty()
        || value.len() > MAX_VALUE_BYTES
        || value.bytes().any(|byte| byte.is_ascii_control())
        || value.contains(';')
        || value.contains('{')
        || value.contains('}')
        || value.contains("/*")
        || value.contains("*/")
    {
        return false;
    }
    let mut paren_depth = 0i32;
    let mut quote: Option<u8> = None;
    let mut escaped = false;
    for byte in value.bytes() {
        if let Some(active_quote) = quote {
            if escaped {
                escaped = false;
            } else if byte == b'\\' {
                escaped = true;
            } else if byte == active_quote {
                quote = None;
            }
            continue;
        }
        if matches!(byte, b'\'' | b'"') {
            quote = Some(byte);
            continue;
        }
        match byte {
            b'(' => paren_depth += 1,
            b')' => {
                paren_depth -= 1;
                if paren_depth < 0 {
                    return false;
                }
            }
            _ => {}
        }
    }
    quote.is_none() && paren_depth == 0
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

fn css_property(property: &str) -> Option<String> {
    const ALLOWED: &[&str] = &[
        "width",
        "height",
        "minWidth",
        "maxWidth",
        "minHeight",
        "maxHeight",
        "display",
        "position",
        "flexDirection",
        "flexWrap",
        "alignItems",
        "justifyContent",
        "gap",
        "gridTemplateColumns",
        "paddingTop",
        "paddingRight",
        "paddingBottom",
        "paddingLeft",
        "marginTop",
        "marginRight",
        "marginBottom",
        "marginLeft",
        "fontFamily",
        "fontSize",
        "fontWeight",
        "lineHeight",
        "letterSpacing",
        "textAlign",
        "color",
        "backgroundColor",
        "backgroundImage",
        "border",
        "borderRadius",
        "boxShadow",
        "opacity",
        "overflow",
        "zIndex",
    ];
    if !ALLOWED.contains(&property) {
        return None;
    }
    let mut css = String::with_capacity(property.len() + 4);
    for ch in property.chars() {
        if ch.is_ascii_uppercase() {
            css.push('-');
            css.push(ch.to_ascii_lowercase());
        } else {
            css.push(ch);
        }
    }
    Some(css)
}

fn declaration_segments(body: &str) -> Vec<(usize, usize)> {
    let bytes = body.as_bytes();
    let mut segments = Vec::new();
    let mut start = 0usize;
    let mut quote: Option<u8> = None;
    let mut escaped = false;
    let mut in_comment = false;
    let mut paren_depth = 0i32;
    let mut i = 0usize;
    while i < bytes.len() {
        let byte = bytes[i];
        if in_comment {
            if byte == b'*' && bytes.get(i + 1) == Some(&b'/') {
                in_comment = false;
                i += 2;
                continue;
            }
            i += 1;
            continue;
        }
        if let Some(active_quote) = quote {
            if escaped {
                escaped = false;
            } else if byte == b'\\' {
                escaped = true;
            } else if byte == active_quote {
                quote = None;
            }
            i += 1;
            continue;
        }
        if byte == b'/' && bytes.get(i + 1) == Some(&b'*') {
            in_comment = true;
            i += 2;
            continue;
        }
        if matches!(byte, b'\'' | b'"') {
            quote = Some(byte);
            i += 1;
            continue;
        }
        match byte {
            b'(' => paren_depth += 1,
            b')' => paren_depth = (paren_depth - 1).max(0),
            b';' if paren_depth == 0 => {
                segments.push((start, i));
                start = i + 1;
            }
            _ => {}
        }
        i += 1;
    }
    if start < body.len() {
        segments.push((start, body.len()));
    }
    segments
}

fn declaration_candidate(
    content: &str,
    relative_path: &str,
    block: &RuleBlock,
    property: &str,
    selector_score: u32,
) -> Vec<DeclarationCandidate> {
    let body = &content[block.body_start..block.body_end];
    let mut candidates = Vec::new();
    for (segment_start, segment_end) in declaration_segments(body) {
        let segment = &body[segment_start..segment_end];
        let Some(colon) = segment.find(':') else {
            continue;
        };
        if segment[..colon].trim() != property {
            continue;
        }
        let mut value_start = colon + 1;
        while value_start < segment.len() && segment.as_bytes()[value_start].is_ascii_whitespace() {
            value_start += 1;
        }
        let mut value_end = segment.len();
        while value_end > value_start && segment.as_bytes()[value_end - 1].is_ascii_whitespace() {
            value_end -= 1;
        }
        let trimmed = &segment[value_start..value_end];
        let lower = trimmed.to_ascii_lowercase();
        if let Some(important_start) = lower.rfind("!important") {
            if lower[important_start..].trim() == "!important" {
                let core = trimmed[..important_start].trim_end();
                value_end = value_start + core.len();
            }
        }
        if value_end <= value_start {
            continue;
        }
        let absolute_start = block.body_start + segment_start + value_start;
        let absolute_end = block.body_start + segment_start + value_end;
        let source_before = content[absolute_start..absolute_end].to_string();
        let line = content[..absolute_start]
            .bytes()
            .filter(|byte| *byte == b'\n')
            .count()
            + 1;
        candidates.push(DeclarationCandidate {
            relative_path: relative_path.to_string(),
            line,
            selector: block.selector.trim().chars().take(240).collect(),
            property: property.to_string(),
            source_before,
            replacement_start: absolute_start,
            replacement_end: absolute_end,
            selector_score,
        });
    }
    candidates
}

fn scan_candidates(
    root: &Path,
    files: &[PathBuf],
    selection: &SourceTransactionSelection,
    property: &str,
) -> Result<Vec<DeclarationCandidate>, String> {
    let mut result = Vec::new();
    for path in files {
        let content = fs::read_to_string(path)
            .map_err(|error| format!("Cannot read CSS source {}: {error}", path.display()))?;
        let relative_path = path
            .strip_prefix(root)
            .unwrap_or(path)
            .to_string_lossy()
            .to_string();
        for block in rule_blocks(&content)? {
            let score = selector_score(&block.selector, selection);
            if score == 0 {
                continue;
            }
            result.extend(declaration_candidate(
                &content,
                &relative_path,
                &block,
                property,
                score,
            ));
        }
    }
    result.sort_by(|left, right| {
        right
            .selector_score
            .cmp(&left.selector_score)
            .then_with(|| left.relative_path.cmp(&right.relative_path))
            .then_with(|| left.line.cmp(&right.line))
    });
    Ok(result)
}

fn normalize_change(change: &SourceTransactionChange) -> Result<(String, String, String), String> {
    let property = change.property.trim();
    let css_property = css_property(property)
        .ok_or_else(|| format!("{} is not eligible for deterministic CSS editing", property))?;
    let before = change.before.trim();
    let after = change.after.trim();
    if before.len() > MAX_VALUE_BYTES || after.len() > MAX_VALUE_BYTES {
        return Err("Visual property value exceeds the deterministic edit boundary".into());
    }
    if before == after || after.is_empty() {
        return Err("Visual property change is empty".into());
    }
    if !value_is_balanced(after) {
        return Err("Requested CSS value is outside the safe deterministic value grammar".into());
    }
    Ok((css_property, before.to_string(), after.to_string()))
}

fn non_deterministic_plan(mode: SourceTransactionMode, reason: impl Into<String>) -> ResolvedPlan {
    ResolvedPlan {
        public: SourceTransactionPlan {
            mode,
            reason: reason.into(),
            operations: Vec::new(),
        },
        operations: Vec::new(),
    }
}

fn resolve(
    root: &Path,
    selection: &SourceTransactionSelection,
    changes: &[SourceTransactionChange],
) -> Result<ResolvedPlan, String> {
    if changes.is_empty() || changes.len() > MAX_CHANGES {
        return Ok(non_deterministic_plan(
            SourceTransactionMode::Codex,
            "The visual edit batch is empty or exceeds the bounded transaction size.",
        ));
    }
    if safe_selector_ident(selection.id.as_deref()).is_none()
        && !selection
            .classes
            .iter()
            .any(|class| safe_selector_ident(Some(class)).is_some())
    {
        return Ok(non_deterministic_plan(
            SourceTransactionMode::Codex,
            "No safe id/class selector evidence is available for deterministic ownership.",
        ));
    }

    let mut files = Vec::new();
    let mut total_bytes = 0;
    collect_css_sources(root, &mut files, &mut total_bytes);
    if files.is_empty() {
        return Ok(non_deterministic_plan(
            SourceTransactionMode::Codex,
            "No bounded plain CSS sources were found; use source-aware Codex editing.",
        ));
    }

    let mut operations = Vec::new();
    for change in changes {
        let (property, before, after) = match normalize_change(change) {
            Ok(value) => value,
            Err(reason) => {
                return Ok(non_deterministic_plan(SourceTransactionMode::Codex, reason));
            }
        };
        let candidates = scan_candidates(root, &files, selection, &property)?;
        if candidates.is_empty() {
            return Ok(non_deterministic_plan(
                SourceTransactionMode::Codex,
                format!(
                    "No literal CSS owner was proven for {property}; structural/source-aware editing is required."
                ),
            ));
        }
        if candidates.len() != 1 {
            return Ok(non_deterministic_plan(
                SourceTransactionMode::Assisted,
                format!(
                    "{property} has {} matching CSS owners/scopes; direct mutation would be ambiguous.",
                    candidates.len()
                ),
            ));
        }
        let candidate = &candidates[0];
        if !values_equivalent(&candidate.source_before, &before) {
            let token_backed = candidate.source_before.contains("var(");
            return Ok(non_deterministic_plan(
                SourceTransactionMode::Assisted,
                if token_backed {
                    format!(
                        "{property} is token-backed in source; scope must be chosen before changing the token or instance."
                    )
                } else {
                    format!(
                        "{property} runtime value does not exactly match its source literal; units/cascade/abstraction require source-aware resolution."
                    )
                },
            ));
        }
        let public = SourceTransactionOperation {
            path: candidate.relative_path.clone(),
            line: candidate.line,
            selector: candidate.selector.clone(),
            property: candidate.property.clone(),
            source_before: candidate.source_before.clone(),
            source_after: after.clone(),
            owner_kind: "literal-css-declaration".into(),
        };
        operations.push(ResolvedOperation {
            public,
            replacement_start: candidate.replacement_start,
            replacement_end: candidate.replacement_end,
        });
    }

    let unique_paths: HashSet<_> = operations
        .iter()
        .map(|operation| operation.public.path.as_str())
        .collect();
    if unique_paths.len() != 1 {
        return Ok(non_deterministic_plan(
            SourceTransactionMode::Assisted,
            "The requested property batch resolves across multiple files; Monument keeps direct transactions single-file and atomic.",
        ));
    }
    let mut ranges: Vec<_> = operations
        .iter()
        .map(|operation| (operation.replacement_start, operation.replacement_end))
        .collect();
    ranges.sort_unstable();
    if ranges.windows(2).any(|pair| pair[0].1 > pair[1].0) {
        return Ok(non_deterministic_plan(
            SourceTransactionMode::Codex,
            "Resolved source ranges overlap; direct mutation is refused.",
        ));
    }

    let public_operations = operations
        .iter()
        .map(|operation| operation.public.clone())
        .collect();
    Ok(ResolvedPlan {
        public: SourceTransactionPlan {
            mode: SourceTransactionMode::Deterministic,
            reason: "Unique literal CSS ownership proven in one file; safe atomic source transaction is available.".into(),
            operations: public_operations,
        },
        operations,
    })
}

fn project_root(project_path: String) -> Result<PathBuf, String> {
    let root = PathBuf::from(project_path)
        .canonicalize()
        .map_err(|error| format!("Cannot inspect project source: {error}"))?;
    if !root.is_dir() {
        return Err("Source transaction root is not a directory".into());
    }
    Ok(root)
}

fn write_atomic(path: &Path, content: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Source file has no parent directory".to_string())?;
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("source.css");
    let permissions = fs::metadata(path)
        .map_err(|error| format!("Cannot read source permissions: {error}"))?
        .permissions();
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let temp = parent.join(format!(
        ".{file_name}.monument-{}-{nonce}.tmp",
        std::process::id()
    ));
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp)
        .map_err(|error| format!("Cannot create atomic source transaction file: {error}"))?;
    let result = (|| -> Result<(), String> {
        file.write_all(content.as_bytes())
            .map_err(|error| format!("Cannot write atomic source transaction: {error}"))?;
        file.flush()
            .map_err(|error| format!("Cannot flush atomic source transaction: {error}"))?;
        file.sync_all()
            .map_err(|error| format!("Cannot sync atomic source transaction: {error}"))?;
        fs::set_permissions(&temp, permissions)
            .map_err(|error| format!("Cannot preserve source permissions: {error}"))?;
        fs::rename(&temp, path)
            .map_err(|error| format!("Cannot atomically replace source file: {error}"))?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}

#[tauri::command]
pub fn project_source_transaction_preview(
    project_path: String,
    selection: SourceTransactionSelection,
    changes: Vec<SourceTransactionChange>,
) -> Result<SourceTransactionPlan, String> {
    let root = project_root(project_path)?;
    Ok(resolve(&root, &selection, &changes)?.public)
}

#[tauri::command]
pub fn project_source_transaction_commit(
    project_path: String,
    selection: SourceTransactionSelection,
    changes: Vec<SourceTransactionChange>,
) -> Result<SourceTransactionCommit, String> {
    let root = project_root(project_path)?;
    let resolved = resolve(&root, &selection, &changes)?;
    if resolved.public.mode != SourceTransactionMode::Deterministic
        || resolved.operations.is_empty()
    {
        return Err(format!(
            "Direct source transaction is not safe: {}",
            resolved.public.reason
        ));
    }
    let relative_path = resolved.operations[0].public.path.clone();
    let path = root.join(&relative_path);
    let metadata = fs::symlink_metadata(&path)
        .map_err(|error| format!("Cannot inspect source transaction target: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Direct source transaction refuses symlink or non-file targets".into());
    }
    let canonical = path
        .canonicalize()
        .map_err(|error| format!("Cannot canonicalize source transaction target: {error}"))?;
    if !canonical.starts_with(&root) {
        return Err("Direct source transaction target escapes project root".into());
    }
    let mut content = fs::read_to_string(&canonical)
        .map_err(|error| format!("Cannot read source transaction target: {error}"))?;
    for operation in &resolved.operations {
        if operation.public.path != relative_path {
            return Err("Direct source transaction unexpectedly spans multiple files".into());
        }
        let actual = content
            .get(operation.replacement_start..operation.replacement_end)
            .ok_or_else(|| "Source changed after transaction resolution".to_string())?;
        if actual != operation.public.source_before {
            return Err(
                "Source changed after transaction resolution; re-apply against the latest preview"
                    .into(),
            );
        }
    }
    let mut ordered = resolved.operations.clone();
    ordered.sort_by(|left, right| right.replacement_start.cmp(&left.replacement_start));
    for operation in &ordered {
        content.replace_range(
            operation.replacement_start..operation.replacement_end,
            &operation.public.source_after,
        );
    }
    rule_blocks(&content)
        .map_err(|error| format!("Updated CSS failed structural validation: {error}"))?;
    write_atomic(&canonical, &content)?;
    Ok(SourceTransactionCommit {
        path: relative_path,
        applied_count: ordered.len(),
        bytes_written: content.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_root(name: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "monument-source-transaction-{name}-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&root).unwrap();
        root
    }

    fn selection() -> SourceTransactionSelection {
        SourceTransactionSelection {
            id: None,
            classes: vec!["hero".into()],
            selector: Some("section.hero".into()),
        }
    }

    fn change(after: &str) -> Vec<SourceTransactionChange> {
        vec![SourceTransactionChange {
            property: "paddingTop".into(),
            before: "32px".into(),
            after: after.into(),
        }]
    }

    #[test]
    fn unique_literal_css_owner_is_deterministic() {
        let root = test_root("deterministic");
        fs::write(
            root.join("app.css"),
            ".hero { padding-top: 32px; color: black; }\n",
        )
        .unwrap();
        let plan = resolve(&root, &selection(), &change("48px")).unwrap();
        assert_eq!(plan.public.mode, SourceTransactionMode::Deterministic);
        assert_eq!(plan.public.operations.len(), 1);
        assert_eq!(plan.public.operations[0].source_before, "32px");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn responsive_duplicate_owner_is_assisted_not_guessed() {
        let root = test_root("ambiguous");
        fs::write(
            root.join("app.css"),
            ".hero { padding-top: 32px; }\n@media (max-width: 700px) { .hero { padding-top: 32px; } }\n",
        )
        .unwrap();
        let plan = resolve(&root, &selection(), &change("48px")).unwrap();
        assert_eq!(plan.public.mode, SourceTransactionMode::Assisted);
        assert!(plan.public.operations.is_empty());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn token_backed_value_requires_scope_resolution() {
        let root = test_root("token");
        fs::write(
            root.join("app.css"),
            ".hero { padding-top: var(--hero-space); }\n",
        )
        .unwrap();
        let plan = resolve(&root, &selection(), &change("48px")).unwrap();
        assert_eq!(plan.public.mode, SourceTransactionMode::Assisted);
        assert!(plan.public.reason.contains("token-backed"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn deterministic_commit_revalidates_and_writes_real_source() {
        let root = test_root("commit");
        let path = root.join("app.css");
        fs::write(
            &path,
            ".hero { padding-top: 32px; color: black; }\n",
        )
        .unwrap();
        let result = project_source_transaction_commit(
            root.to_string_lossy().to_string(),
            selection(),
            change("48px"),
        )
        .unwrap();
        assert_eq!(result.applied_count, 1);
        let updated = fs::read_to_string(&path).unwrap();
        assert!(updated.contains("padding-top: 48px"));
        assert!(!updated.contains("padding-top: 32px"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn unsafe_css_value_is_never_direct() {
        let root = test_root("unsafe");
        fs::write(root.join("app.css"), ".hero { padding-top: 32px; }\n").unwrap();
        let plan = resolve(&root, &selection(), &change("48px; color: red")).unwrap();
        assert_eq!(plan.public.mode, SourceTransactionMode::Codex);
        let _ = fs::remove_dir_all(root);
    }
}
