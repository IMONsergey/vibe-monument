use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_CSS_FILES: usize = 800;
const MAX_FILE_BYTES: u64 = 1_500_000;
const MAX_TOTAL_BYTES: u64 = 16_000_000;
const MAX_VALUE_BYTES: usize = 300;
const MAX_SELECTOR_IDENT: usize = 96;
const MAX_SELECTOR_BYTES: usize = 240;
const MAX_DEFINITIONS: usize = 128;
const MAX_USAGES: usize = 512;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenEditSelection {
    id: Option<String>,
    #[serde(default)]
    id_unique: bool,
    #[serde(default)]
    classes: Vec<String>,
    selector: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenEditChange {
    property: String,
    before: String,
    after: String,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum TokenDefinitionScope {
    Global,
    Scoped,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenEditSource {
    path: String,
    line: usize,
    selector: String,
    property: String,
    source_value: String,
    conditional: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenEditDefinition {
    path: String,
    line: usize,
    selector: String,
    value: String,
    scope: TokenDefinitionScope,
    selected_scope: bool,
    conditional: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenEditProbe {
    eligible: bool,
    reason: String,
    token: Option<String>,
    source: Option<TokenEditSource>,
    definitions: Vec<TokenEditDefinition>,
    definition_count: usize,
    usage_count: usize,
    truncated: bool,
    instance_eligible: bool,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum TokenEditMode {
    Instance,
    Token,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenEditDecision {
    mode: TokenEditMode,
    target_path: Option<String>,
    target_line: Option<usize>,
    target_selector: Option<String>,
    expected_value: Option<String>,
    #[serde(default)]
    confirm_shared_global: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenTransactionPlan {
    safe: bool,
    reason: String,
    mode: TokenEditMode,
    token: Option<String>,
    scope: String,
    path: Option<String>,
    line: Option<usize>,
    selector: Option<String>,
    source_before: Option<String>,
    source_after: Option<String>,
    affected_usage_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenTransactionCommit {
    path: String,
    applied_count: usize,
    bytes_written: usize,
    token: String,
    scope: String,
    affected_usage_count: usize,
}

#[derive(Debug, Clone)]
struct RuleBlock {
    selector: String,
    body_start: usize,
    body_end: usize,
    conditional: bool,
}

#[derive(Debug, Clone)]
struct BlockContext {
    selector: String,
    body_start: usize,
    has_nested_block: bool,
    conditional: bool,
}

#[derive(Debug, Clone)]
struct DeclarationCandidate {
    path: String,
    line: usize,
    selector: String,
    property: String,
    source_value: String,
    replacement_start: usize,
    replacement_end: usize,
    selector_score: u32,
    conditional: bool,
}

#[derive(Debug, Clone)]
struct TokenDefinitionCandidate {
    public: TokenEditDefinition,
    replacement_start: usize,
    replacement_end: usize,
}

#[derive(Debug, Clone)]
struct ProbeInternal {
    public: TokenEditProbe,
    source: Option<DeclarationCandidate>,
    definitions: Vec<TokenDefinitionCandidate>,
}

#[derive(Debug, Clone)]
struct ResolvedTokenPlan {
    public: TokenTransactionPlan,
    replacement_start: Option<usize>,
    replacement_end: Option<usize>,
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

fn collect_css_sources(
    directory: &Path,
    files: &mut Vec<PathBuf>,
    total_bytes: &mut u64,
    truncated: &mut bool,
) {
    if files.len() >= MAX_CSS_FILES || *total_bytes >= MAX_TOTAL_BYTES {
        *truncated = true;
        return;
    }
    let Ok(entries) = fs::read_dir(directory) else {
        return;
    };
    let mut entries: Vec<_> = entries.filter_map(Result::ok).collect();
    entries.sort_by_key(|entry| entry.path());
    for entry in entries {
        if files.len() >= MAX_CSS_FILES || *total_bytes >= MAX_TOTAL_BYTES {
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
                collect_css_sources(&path, files, total_bytes, truncated);
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
        .map_err(|error| format!("Cannot inspect project source: {error}"))?;
    if !root.is_dir() {
        return Err("Token transaction root is not a directory".into());
    }
    Ok(root)
}

fn relative_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
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

fn selector_score(selector: &str, selection: &TokenEditSelection) -> u32 {
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
    score
}

fn has_selector_evidence(selection: &TokenEditSelection) -> bool {
    safe_selector_ident(selection.id.as_deref()).is_some()
        || selection
            .classes
            .iter()
            .any(|class| safe_selector_ident(Some(class)).is_some())
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
                let parent_conditional = stack
                    .last()
                    .map(|parent| parent.conditional || parent.selector.trim_start().starts_with('@'))
                    .unwrap_or(false);
                if let Some(parent) = stack.last_mut() {
                    parent.has_nested_block = true;
                }
                let selector = content[segment_start..i].trim().to_string();
                let conditional = parent_conditional || selector.trim_start().starts_with('@');
                stack.push(BlockContext {
                    selector,
                    body_start: i + 1,
                    has_nested_block: false,
                    conditional,
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
                        conditional: context.conditional,
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

fn css_property(property: &str) -> Option<String> {
    const ALLOWED: &[&str] = &[
        "width", "height", "minWidth", "maxWidth", "minHeight", "maxHeight",
        "display", "position", "flexDirection", "flexWrap", "alignItems",
        "justifyContent", "gap", "gridTemplateColumns", "paddingTop", "paddingRight",
        "paddingBottom", "paddingLeft", "marginTop", "marginRight", "marginBottom",
        "marginLeft", "fontFamily", "fontSize", "fontWeight", "lineHeight",
        "letterSpacing", "textAlign", "color", "backgroundColor", "backgroundImage",
        "border", "borderRadius", "boxShadow", "opacity", "overflow", "zIndex",
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

fn safe_token_name(token: &str) -> Option<String> {
    let token = token.trim();
    if !token.starts_with("--") || token.len() <= 2 || token.len() > MAX_SELECTOR_IDENT {
        return None;
    }
    token[2..]
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
        .then(|| token.to_string())
}

fn simple_var_token(value: &str) -> Option<String> {
    let value = value.trim();
    if !value.starts_with("var(") || !value.ends_with(')') {
        return None;
    }
    let inner = value[4..value.len() - 1].trim();
    if inner.contains(',') || inner.contains('(') || inner.contains(')') {
        return None;
    }
    safe_token_name(inner)
}

fn token_boundary(byte: Option<u8>) -> bool {
    byte.is_none_or(|byte| !byte.is_ascii_alphanumeric() && !matches!(byte, b'-' | b'_'))
}

fn ascii_var_function_at(bytes: &[u8], offset: usize) -> bool {
    bytes.get(offset).is_some_and(|byte| byte.eq_ignore_ascii_case(&b'v'))
        && bytes.get(offset + 1).is_some_and(|byte| byte.eq_ignore_ascii_case(&b'a'))
        && bytes.get(offset + 2).is_some_and(|byte| byte.eq_ignore_ascii_case(&b'r'))
        && bytes.get(offset + 3) == Some(&b'(')
}

fn skip_var_trivia(bytes: &[u8], mut offset: usize) -> Option<usize> {
    loop {
        while bytes.get(offset).is_some_and(|byte| byte.is_ascii_whitespace()) {
            offset += 1;
        }
        if bytes.get(offset) != Some(&b'/') || bytes.get(offset + 1) != Some(&b'*') {
            return Some(offset);
        }
        offset += 2;
        let mut closed = false;
        while offset + 1 < bytes.len() {
            if bytes[offset] == b'*' && bytes[offset + 1] == b'/' {
                offset += 2;
                closed = true;
                break;
            }
            offset += 1;
        }
        if !closed {
            return None;
        }
    }
}

fn token_usage_count(content: &str, token: &str) -> usize {
    let bytes = content.as_bytes();
    let token_bytes = token.as_bytes();
    let mut count = 0usize;
    let mut offset = 0usize;
    while offset + 4 <= bytes.len() {
        if ascii_var_function_at(bytes, offset) {
            if let Some(token_start) = skip_var_trivia(bytes, offset + 4) {
                let token_end = token_start.saturating_add(token_bytes.len());
                if bytes.get(token_start..token_end) == Some(token_bytes)
                    && token_boundary(bytes.get(token_end).copied())
                {
                    count = count.saturating_add(1);
                }
            }
        }
        offset += 1;
    }
    count
}

fn line_number(content: &str, offset: usize) -> usize {
    content.as_bytes()[..offset.min(content.len())]
        .iter()
        .filter(|byte| **byte == b'\n')
        .count()
        + 1
}

fn declaration_candidates(
    content: &str,
    path: &str,
    block: &RuleBlock,
    property: &str,
    score: u32,
) -> Vec<DeclarationCandidate> {
    let body = &content[block.body_start..block.body_end];
    let mut result = Vec::new();
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
                value_end = value_start + trimmed[..important_start].trim_end().len();
            }
        }
        if value_end <= value_start {
            continue;
        }
        let absolute_start = block.body_start + segment_start + value_start;
        let absolute_end = block.body_start + segment_start + value_end;
        result.push(DeclarationCandidate {
            path: path.to_string(),
            line: line_number(content, absolute_start),
            selector: block.selector.trim().chars().take(MAX_SELECTOR_BYTES).collect(),
            property: property.to_string(),
            source_value: content[absolute_start..absolute_end].to_string(),
            replacement_start: absolute_start,
            replacement_end: absolute_end,
            selector_score: score,
            conditional: block.conditional,
        });
    }
    result
}

fn scope_kind(selector: &str) -> TokenDefinitionScope {
    let selector = selector.trim().to_ascii_lowercase();
    if selector == ":root" || selector == "html" || selector == "html:root" {
        TokenDefinitionScope::Global
    } else {
        TokenDefinitionScope::Scoped
    }
}

fn token_definition_candidates(
    content: &str,
    path: &str,
    block: &RuleBlock,
    token: &str,
    selection: &TokenEditSelection,
) -> Vec<TokenDefinitionCandidate> {
    let body = &content[block.body_start..block.body_end];
    let mut result = Vec::new();
    for (segment_start, segment_end) in declaration_segments(body) {
        let segment = &body[segment_start..segment_end];
        let Some(colon) = segment.find(':') else {
            continue;
        };
        if segment[..colon].trim() != token {
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
        if value_end <= value_start {
            continue;
        }
        let absolute_start = block.body_start + segment_start + value_start;
        let absolute_end = block.body_start + segment_start + value_end;
        let selector: String = block.selector.trim().chars().take(MAX_SELECTOR_BYTES).collect();
        let scope = scope_kind(&selector);
        let selected_scope = !block.conditional
            && scope == TokenDefinitionScope::Scoped
            && selector_score(&selector, selection) >= 20;
        result.push(TokenDefinitionCandidate {
            public: TokenEditDefinition {
                path: path.to_string(),
                line: line_number(content, absolute_start),
                selector,
                value: content[absolute_start..absolute_end].trim().to_string(),
                scope,
                selected_scope,
                conditional: block.conditional,
            },
            replacement_start: absolute_start,
            replacement_end: absolute_end,
        });
    }
    result
}

fn empty_probe(reason: impl Into<String>, truncated: bool) -> ProbeInternal {
    ProbeInternal {
        public: TokenEditProbe {
            eligible: false,
            reason: reason.into(),
            token: None,
            source: None,
            definitions: Vec::new(),
            definition_count: 0,
            usage_count: 0,
            truncated,
            instance_eligible: false,
        },
        source: None,
        definitions: Vec::new(),
    }
}

fn probe_internal(
    root: &Path,
    selection: &TokenEditSelection,
    change: &TokenEditChange,
) -> Result<ProbeInternal, String> {
    let Some(property) = css_property(change.property.trim()) else {
        return Ok(empty_probe(
            "This property is outside the bounded token-edit grammar.",
            false,
        ));
    };
    if !has_selector_evidence(selection) {
        return Ok(empty_probe(
            "No safe id/class source ownership evidence is available for token editing.",
            false,
        ));
    }

    let mut files = Vec::new();
    let mut total_bytes = 0;
    let mut truncated = false;
    collect_css_sources(root, &mut files, &mut total_bytes, &mut truncated);
    if files.is_empty() {
        return Err("No bounded plain CSS sources were found".into());
    }

    let mut property_candidates = Vec::new();
    for path in &files {
        let content = fs::read_to_string(path)
            .map_err(|error| format!("Cannot read CSS source {}: {error}", path.display()))?;
        let relative = relative_path(root, path);
        for block in rule_blocks(&content)? {
            let score = selector_score(&block.selector, selection);
            if score < 20 {
                continue;
            }
            property_candidates.extend(declaration_candidates(
                &content,
                &relative,
                &block,
                &property,
                score,
            ));
        }
    }
    property_candidates.sort_by(|left, right| {
        right
            .selector_score
            .cmp(&left.selector_score)
            .then_with(|| left.path.cmp(&right.path))
            .then_with(|| left.line.cmp(&right.line))
    });

    if truncated {
        return Ok(empty_probe(
            "Token source scan hit its bounded project limit; deterministic ownership cannot be proven.",
            true,
        ));
    }
    if property_candidates.iter().any(|candidate| candidate.conditional) {
        return Ok(empty_probe(
            "Responsive/conditional CSS ownership is present for this property; breakpoint scope must be chosen explicitly through Codex.",
            false,
        ));
    }
    if property_candidates.len() != 1 {
        return Ok(empty_probe(
            if property_candidates.is_empty() {
                format!("No unique plain CSS owner was proven for {property}.")
            } else {
                format!(
                    "{property} has {} matching source owners; token editing refuses to guess.",
                    property_candidates.len()
                )
            },
            false,
        ));
    }

    let source = property_candidates.remove(0);
    let Some(token) = simple_var_token(&source.source_value) else {
        return Ok(ProbeInternal {
            public: TokenEditProbe {
                eligible: false,
                reason: format!(
                    "{property} is not backed by one simple CSS custom property reference."
                ),
                token: None,
                source: Some(TokenEditSource {
                    path: source.path.clone(),
                    line: source.line,
                    selector: source.selector.clone(),
                    property: source.property.clone(),
                    source_value: source.source_value.clone(),
                    conditional: source.conditional,
                }),
                definitions: Vec::new(),
                definition_count: 0,
                usage_count: 0,
                truncated: false,
                instance_eligible: false,
            },
            source: Some(source),
            definitions: Vec::new(),
        });
    };

    let mut definitions = Vec::new();
    let mut usage_count = 0usize;
    let mut definition_count = 0usize;
    for path in &files {
        let content = fs::read_to_string(path)
            .map_err(|error| format!("Cannot read CSS source {}: {error}", path.display()))?;
        let relative = relative_path(root, path);
        usage_count = usage_count.saturating_add(token_usage_count(&content, &token));
        for block in rule_blocks(&content)? {
            let found = token_definition_candidates(&content, &relative, &block, &token, selection);
            definition_count = definition_count.saturating_add(found.len());
            if definitions.len() < MAX_DEFINITIONS {
                let remaining = MAX_DEFINITIONS - definitions.len();
                definitions.extend(found.into_iter().take(remaining));
            }
        }
    }
    if definition_count > MAX_DEFINITIONS || usage_count > MAX_USAGES {
        truncated = true;
    }

    let public_definitions = definitions
        .iter()
        .map(|definition| definition.public.clone())
        .collect();
    let public_source = TokenEditSource {
        path: source.path.clone(),
        line: source.line,
        selector: source.selector.clone(),
        property: source.property.clone(),
        source_value: source.source_value.clone(),
        conditional: source.conditional,
    };
    let reason = if definitions.is_empty() {
        "Token-backed property proven. The selected source owner may be detached only when a unique live ID proves single-element scope; token definition was not found in bounded plain CSS.".to_string()
    } else if definitions.iter().all(|definition| definition.public.conditional) {
        format!(
            "Token-backed property proven, but all definitions of {token} are conditional; direct token mutation is disabled."
        )
    } else if usage_count > 1 {
        format!(
            "Token-backed property proven. {token} is observed in {usage_count} source references; global mutation always requires explicit confirmation."
        )
    } else {
        format!(
            "Token-backed property proven. Choose a proven source scope for {token}; global mutation always requires explicit confirmation."
        )
    };
    let instance_eligible = !truncated
        && !source.conditional
        && selection.id_unique
        && safe_selector_ident(selection.id.as_deref()).is_some()
        && source.selector_score >= 100;

    Ok(ProbeInternal {
        public: TokenEditProbe {
            eligible: true,
            reason,
            token: Some(token),
            source: Some(public_source),
            definitions: public_definitions,
            definition_count,
            usage_count,
            truncated,
            instance_eligible,
        },
        source: Some(source),
        definitions,
    })
}

fn unsafe_plan(mode: TokenEditMode, reason: impl Into<String>) -> ResolvedTokenPlan {
    ResolvedTokenPlan {
        public: TokenTransactionPlan {
            safe: false,
            reason: reason.into(),
            mode,
            token: None,
            scope: "codex".into(),
            path: None,
            line: None,
            selector: None,
            source_before: None,
            source_after: None,
            affected_usage_count: 0,
        },
        replacement_start: None,
        replacement_end: None,
    }
}

fn resolve_plan(
    root: &Path,
    selection: &TokenEditSelection,
    change: &TokenEditChange,
    decision: &TokenEditDecision,
) -> Result<ResolvedTokenPlan, String> {
    let after = change.after.trim();
    if change.before.len() > MAX_VALUE_BYTES
        || after.len() > MAX_VALUE_BYTES
        || !value_is_balanced(after)
    {
        return Ok(unsafe_plan(
            decision.mode,
            "Requested value is outside the bounded safe CSS value grammar.",
        ));
    }
    let probe = probe_internal(root, selection, change)?;
    if !probe.public.eligible || probe.public.truncated {
        return Ok(unsafe_plan(decision.mode, probe.public.reason));
    }
    let Some(token) = probe.public.token.clone() else {
        return Ok(unsafe_plan(
            decision.mode,
            "Token ownership was not proven.",
        ));
    };

    match decision.mode {
        TokenEditMode::Instance => {
            if !probe.public.instance_eligible {
                return Ok(unsafe_plan(
                    TokenEditMode::Instance,
                    "This element is not proven single-instance: deterministic detachment requires a unique live DOM id and an id-owned non-conditional source rule.",
                ));
            }
            let Some(source) = probe.source else {
                return Ok(unsafe_plan(
                    TokenEditMode::Instance,
                    "Selected source declaration disappeared during token resolution.",
                ));
            };
            Ok(ResolvedTokenPlan {
                public: TokenTransactionPlan {
                    safe: true,
                    reason: format!(
                        "Detach this uniquely identified element from {token} and write one literal declaration in its proven id-owned rule."
                    ),
                    mode: TokenEditMode::Instance,
                    token: Some(token),
                    scope: "instance".into(),
                    path: Some(source.path.clone()),
                    line: Some(source.line),
                    selector: Some(source.selector.clone()),
                    source_before: Some(source.source_value.clone()),
                    source_after: Some(after.to_string()),
                    affected_usage_count: 1,
                },
                replacement_start: Some(source.replacement_start),
                replacement_end: Some(source.replacement_end),
            })
        }
        TokenEditMode::Token => {
            let Some(target_path) = decision.target_path.as_deref() else {
                return Ok(unsafe_plan(
                    TokenEditMode::Token,
                    "Choose an exact token definition before applying a token mutation.",
                ));
            };
            let Some(target_line) = decision.target_line else {
                return Ok(unsafe_plan(
                    TokenEditMode::Token,
                    "Chosen token definition is missing its source line.",
                ));
            };
            let Some(target_selector) = decision.target_selector.as_deref() else {
                return Ok(unsafe_plan(
                    TokenEditMode::Token,
                    "Chosen token definition is missing its selector.",
                ));
            };
            let matching: Vec<_> = probe
                .definitions
                .iter()
                .filter(|definition| {
                    definition.public.path == target_path
                        && definition.public.line == target_line
                        && definition.public.selector == target_selector
                        && decision
                            .expected_value
                            .as_deref()
                            .is_none_or(|value| definition.public.value == value)
                })
                .collect();
            if matching.len() != 1 {
                return Ok(unsafe_plan(
                    TokenEditMode::Token,
                    "Chosen token definition is stale or ambiguous; reselect scope against current source.",
                ));
            }
            let definition = matching[0];
            if definition.public.conditional {
                return Ok(unsafe_plan(
                    TokenEditMode::Token,
                    "Chosen token definition is inside a conditional CSS scope; breakpoint-aware token authoring is not deterministic in M2.2.",
                ));
            }
            match definition.public.scope {
                TokenDefinitionScope::Global => {
                    if !decision.confirm_shared_global {
                        return Ok(unsafe_plan(
                            TokenEditMode::Token,
                            format!(
                                "{token} is a global token with {} bounded source references. Explicit global confirmation is always required.",
                                probe.public.usage_count
                            ),
                        ));
                    }
                }
                TokenDefinitionScope::Scoped => {
                    if !definition.public.selected_scope {
                        return Ok(unsafe_plan(
                            TokenEditMode::Token,
                            "Scoped token owner is not proven to belong to the selected element; use Codex instead.",
                        ));
                    }
                }
            }
            let scope = match definition.public.scope {
                TokenDefinitionScope::Global => "global-token",
                TokenDefinitionScope::Scoped => "local-token",
            };
            Ok(ResolvedTokenPlan {
                public: TokenTransactionPlan {
                    safe: true,
                    reason: match definition.public.scope {
                        TokenDefinitionScope::Global => {
                            format!("Explicitly mutate shared token {token} at its chosen global definition.")
                        }
                        TokenDefinitionScope::Scoped => {
                            format!("Mutate {token} inside the proven selected-element scope.")
                        }
                    },
                    mode: TokenEditMode::Token,
                    token: Some(token),
                    scope: scope.into(),
                    path: Some(definition.public.path.clone()),
                    line: Some(definition.public.line),
                    selector: Some(definition.public.selector.clone()),
                    source_before: Some(definition.public.value.clone()),
                    source_after: Some(after.to_string()),
                    affected_usage_count: probe.public.usage_count,
                },
                replacement_start: Some(definition.replacement_start),
                replacement_end: Some(definition.replacement_end),
            })
        }
    }
}

fn write_atomic(path: &Path, content: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Token source file has no parent directory".to_string())?;
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("source.css");
    let permissions = fs::metadata(path)
        .map_err(|error| format!("Cannot read token source permissions: {error}"))?
        .permissions();
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let temp = parent.join(format!(
        ".{file_name}.monument-token-{}-{nonce}.tmp",
        std::process::id()
    ));
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp)
        .map_err(|error| format!("Cannot create atomic token transaction file: {error}"))?;
    let result = (|| -> Result<(), String> {
        file.write_all(content.as_bytes())
            .map_err(|error| format!("Cannot write atomic token transaction: {error}"))?;
        file.flush()
            .map_err(|error| format!("Cannot flush atomic token transaction: {error}"))?;
        file.sync_all()
            .map_err(|error| format!("Cannot sync atomic token transaction: {error}"))?;
        fs::set_permissions(&temp, permissions)
            .map_err(|error| format!("Cannot preserve token source permissions: {error}"))?;
        fs::rename(&temp, path)
            .map_err(|error| format!("Cannot atomically replace token source file: {error}"))?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}

#[tauri::command]
pub fn project_token_edit_probe(
    project_path: String,
    selection: TokenEditSelection,
    change: TokenEditChange,
) -> Result<TokenEditProbe, String> {
    let root = project_root(project_path)?;
    Ok(probe_internal(&root, &selection, &change)?.public)
}

#[tauri::command]
pub fn project_token_transaction_preview(
    project_path: String,
    selection: TokenEditSelection,
    change: TokenEditChange,
    decision: TokenEditDecision,
) -> Result<TokenTransactionPlan, String> {
    let root = project_root(project_path)?;
    Ok(resolve_plan(&root, &selection, &change, &decision)?.public)
}

#[tauri::command]
pub fn project_token_transaction_commit(
    project_path: String,
    selection: TokenEditSelection,
    change: TokenEditChange,
    decision: TokenEditDecision,
) -> Result<TokenTransactionCommit, String> {
    let root = project_root(project_path)?;
    let resolved = resolve_plan(&root, &selection, &change, &decision)?;
    if !resolved.public.safe {
        return Err(format!(
            "Token source transaction is not safe: {}",
            resolved.public.reason
        ));
    }
    let path_string = resolved
        .public
        .path
        .clone()
        .ok_or_else(|| "Token transaction path missing".to_string())?;
    let path = root.join(&path_string);
    let metadata = fs::symlink_metadata(&path)
        .map_err(|error| format!("Cannot inspect token transaction target: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Token source transaction refuses symlink or non-file targets".into());
    }
    let canonical = path
        .canonicalize()
        .map_err(|error| format!("Cannot canonicalize token transaction target: {error}"))?;
    if !canonical.starts_with(&root) {
        return Err("Token source transaction target escapes project root".into());
    }
    let mut content = fs::read_to_string(&canonical)
        .map_err(|error| format!("Cannot read token transaction target: {error}"))?;
    let start = resolved
        .replacement_start
        .ok_or_else(|| "Token replacement range missing".to_string())?;
    let end = resolved
        .replacement_end
        .ok_or_else(|| "Token replacement range missing".to_string())?;
    let expected = resolved
        .public
        .source_before
        .as_deref()
        .ok_or_else(|| "Token expected source missing".to_string())?;
    let replacement = resolved
        .public
        .source_after
        .as_deref()
        .ok_or_else(|| "Token replacement source missing".to_string())?;
    let actual = content
        .get(start..end)
        .ok_or_else(|| "Source changed after token transaction resolution".to_string())?;
    if actual.trim() != expected.trim() {
        return Err(
            "Source changed after token transaction resolution; re-apply against current source"
                .into(),
        );
    }
    content.replace_range(start..end, replacement);
    rule_blocks(&content)
        .map_err(|error| format!("Updated CSS failed structural validation: {error}"))?;
    write_atomic(&canonical, &content)?;
    Ok(TokenTransactionCommit {
        path: path_string,
        applied_count: 1,
        bytes_written: content.len(),
        token: resolved.public.token.unwrap_or_default(),
        scope: resolved.public.scope,
        affected_usage_count: resolved.public.affected_usage_count,
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
            "monument-token-transaction-{name}-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&root).unwrap();
        root
    }

    fn selection() -> TokenEditSelection {
        TokenEditSelection {
            id: None,
            id_unique: false,
            classes: vec!["card".into()],
            selector: ".card".into(),
        }
    }

    fn instance_selection() -> TokenEditSelection {
        TokenEditSelection {
            id: Some("card-1".into()),
            id_unique: true,
            classes: vec!["card".into()],
            selector: "#card-1".into(),
        }
    }

    fn change(after: &str) -> TokenEditChange {
        TokenEditChange {
            property: "gap".into(),
            before: "16px".into(),
            after: after.into(),
        }
    }

    #[test]
    fn probe_exposes_token_scope_and_blast_radius() {
        let root = fixture("probe");
        fs::write(
            root.join("styles.css"),
            ":root { --space: 16px; }\n#card-1 { gap: var(--space); }\n.other { gap: var(--space); }\n",
        )
        .unwrap();
        let probe = probe_internal(&root, &instance_selection(), &change("24px"))
            .unwrap()
            .public;
        assert!(probe.eligible);
        assert!(probe.instance_eligible);
        assert_eq!(probe.token.as_deref(), Some("--space"));
        assert_eq!(probe.definition_count, 1);
        assert_eq!(probe.usage_count, 2);
        assert_eq!(probe.definitions[0].scope, TokenDefinitionScope::Global);
        assert!(!probe.definitions[0].conditional);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn blast_radius_counts_valid_var_trivia() {
        let root = fixture("var-trivia");
        fs::write(
            root.join("styles.css"),
            ":root { --space: 16px; }\n.card { gap: var(--space); }\n.other { gap: var( --space ); }\n.third { gap: VAR(/* note */ --space); }\n.long { gap: var(--space-large); }\n",
        )
        .unwrap();
        let probe = probe_internal(&root, &selection(), &change("24px"))
            .unwrap()
            .public;
        assert!(probe.eligible);
        assert_eq!(probe.usage_count, 3);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn class_owned_rule_is_not_a_single_element_edit() {
        let root = fixture("class-instance");
        fs::write(
            root.join("styles.css"),
            ":root { --space: 16px; }\n.card { gap: var(--space); }\n",
        )
        .unwrap();
        let probe = probe_internal(&root, &selection(), &change("24px"))
            .unwrap()
            .public;
        assert!(probe.eligible);
        assert!(!probe.instance_eligible);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn duplicate_live_id_is_not_a_single_element_edit() {
        let root = fixture("duplicate-live-id");
        fs::write(
            root.join("styles.css"),
            ":root { --space: 16px; }\n#card-1 { gap: var(--space); }\n",
        )
        .unwrap();
        let mut selected = instance_selection();
        selected.id_unique = false;
        let probe = probe_internal(&root, &selected, &change("24px"))
            .unwrap()
            .public;
        assert!(probe.eligible);
        assert!(!probe.instance_eligible);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn instance_transaction_detaches_only_unique_id_rule() {
        let root = fixture("instance");
        fs::write(
            root.join("styles.css"),
            ":root { --space: 16px; }\n#card-1 { gap: var(--space); }\n.other { gap: var(--space); }\n",
        )
        .unwrap();
        let decision = TokenEditDecision {
            mode: TokenEditMode::Instance,
            target_path: None,
            target_line: None,
            target_selector: None,
            expected_value: None,
            confirm_shared_global: false,
        };
        let plan = resolve_plan(&root, &instance_selection(), &change("24px"), &decision).unwrap();
        assert!(plan.public.safe);
        let path = root.join(plan.public.path.as_ref().unwrap());
        let mut content = fs::read_to_string(&path).unwrap();
        content.replace_range(
            plan.replacement_start.unwrap()..plan.replacement_end.unwrap(),
            "24px",
        );
        assert!(content.contains("#card-1 { gap: 24px; }"));
        assert!(content.contains(".other { gap: var(--space); }"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn shared_global_token_requires_explicit_confirmation() {
        let root = fixture("global");
        fs::write(
            root.join("styles.css"),
            ":root { --space: 16px; }\n.card { gap: var(--space); }\n.other { gap: var(--space); }\n",
        )
        .unwrap();
        let probe = probe_internal(&root, &selection(), &change("24px")).unwrap();
        let definition = &probe.public.definitions[0];
        let decision = TokenEditDecision {
            mode: TokenEditMode::Token,
            target_path: Some(definition.path.clone()),
            target_line: Some(definition.line),
            target_selector: Some(definition.selector.clone()),
            expected_value: Some(definition.value.clone()),
            confirm_shared_global: false,
        };
        let blocked = resolve_plan(&root, &selection(), &change("24px"), &decision).unwrap();
        assert!(!blocked.public.safe);
        assert!(blocked.public.reason.contains("confirmation"));
        let confirmed = TokenEditDecision {
            confirm_shared_global: true,
            ..decision
        };
        assert!(
            resolve_plan(&root, &selection(), &change("24px"), &confirmed)
                .unwrap()
                .public
                .safe
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn single_reference_global_token_still_requires_confirmation() {
        let root = fixture("single-global");
        fs::write(
            root.join("styles.css"),
            ":root { --space: 16px; }\n.card { gap: var(--space); }\n",
        )
        .unwrap();
        let probe = probe_internal(&root, &selection(), &change("24px")).unwrap();
        assert_eq!(probe.public.usage_count, 1);
        let definition = &probe.public.definitions[0];
        let decision = TokenEditDecision {
            mode: TokenEditMode::Token,
            target_path: Some(definition.path.clone()),
            target_line: Some(definition.line),
            target_selector: Some(definition.selector.clone()),
            expected_value: Some(definition.value.clone()),
            confirm_shared_global: false,
        };
        let blocked = resolve_plan(&root, &selection(), &change("24px"), &decision).unwrap();
        assert!(!blocked.public.safe);
        assert!(blocked.public.reason.contains("always required"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn local_token_must_belong_to_selected_scope() {
        let root = fixture("local");
        fs::write(
            root.join("styles.css"),
            ":root { --space: 16px; }\n.card { --space: 12px; gap: var(--space); }\n.other { --space: 8px; }\n",
        )
        .unwrap();
        let probe = probe_internal(&root, &selection(), &change("20px")).unwrap();
        let local = probe
            .public
            .definitions
            .iter()
            .find(|definition| definition.selector == ".card")
            .unwrap();
        assert!(local.selected_scope);
        assert!(!local.conditional);
        let decision = TokenEditDecision {
            mode: TokenEditMode::Token,
            target_path: Some(local.path.clone()),
            target_line: Some(local.line),
            target_selector: Some(local.selector.clone()),
            expected_value: Some(local.value.clone()),
            confirm_shared_global: false,
        };
        assert!(
            resolve_plan(&root, &selection(), &change("20px"), &decision)
                .unwrap()
                .public
                .safe
        );
        let other = probe
            .public
            .definitions
            .iter()
            .find(|definition| definition.selector == ".other")
            .unwrap();
        let unsafe_decision = TokenEditDecision {
            target_path: Some(other.path.clone()),
            target_line: Some(other.line),
            target_selector: Some(other.selector.clone()),
            expected_value: Some(other.value.clone()),
            ..decision
        };
        assert!(
            !resolve_plan(&root, &selection(), &change("20px"), &unsafe_decision)
                .unwrap()
                .public
                .safe
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn duplicate_property_owners_never_resolve_by_order() {
        let root = fixture("ambiguous");
        fs::write(
            root.join("styles.css"),
            ":root { --space: 16px; }\n.card { gap: var(--space); }\n.card { gap: var(--space); }\n",
        )
        .unwrap();
        let probe = probe_internal(&root, &selection(), &change("20px"))
            .unwrap()
            .public;
        assert!(!probe.eligible);
        assert!(probe.reason.contains("2 matching source owners"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn responsive_property_owner_requires_codex() {
        let root = fixture("responsive-owner");
        fs::write(
            root.join("styles.css"),
            ":root { --space: 16px; }\n.card { gap: var(--space); }\n@media (max-width: 700px) { .card { gap: var(--space); } }\n",
        )
        .unwrap();
        let probe = probe_internal(&root, &selection(), &change("20px"))
            .unwrap()
            .public;
        assert!(!probe.eligible);
        assert!(probe.reason.contains("Responsive/conditional CSS ownership"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn conditional_token_definition_cannot_be_directly_mutated() {
        let root = fixture("conditional-token");
        fs::write(
            root.join("styles.css"),
            ".card { gap: var(--space); }\n@media (max-width: 700px) { .card { --space: 12px; } }\n",
        )
        .unwrap();
        let probe = probe_internal(&root, &selection(), &change("20px")).unwrap();
        let conditional = probe
            .public
            .definitions
            .iter()
            .find(|definition| definition.conditional)
            .unwrap();
        assert!(!conditional.selected_scope);
        let decision = TokenEditDecision {
            mode: TokenEditMode::Token,
            target_path: Some(conditional.path.clone()),
            target_line: Some(conditional.line),
            target_selector: Some(conditional.selector.clone()),
            expected_value: Some(conditional.value.clone()),
            confirm_shared_global: false,
        };
        let plan = resolve_plan(&root, &selection(), &change("20px"), &decision).unwrap();
        assert!(!plan.public.safe);
        assert!(plan.public.reason.contains("conditional CSS scope"));
        let _ = fs::remove_dir_all(root);
    }
}
