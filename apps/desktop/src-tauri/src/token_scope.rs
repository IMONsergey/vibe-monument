use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

const MAX_CSS_FILES: usize = 800;
const MAX_FILE_BYTES: u64 = 1_500_000;
const MAX_TOTAL_BYTES: u64 = 16_000_000;
const MAX_TOKEN_NAME_BYTES: usize = 96;
const MAX_DEFINITIONS: usize = 128;
const MAX_USAGES: usize = 512;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum TokenScopeKind {
    Global,
    Scoped,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenDefinition {
    path: String,
    line: usize,
    selector: String,
    value: String,
    scope: TokenScopeKind,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenUsage {
    path: String,
    line: usize,
    selector: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenScopeInspection {
    token: String,
    definitions: Vec<TokenDefinition>,
    usages: Vec<TokenUsage>,
    definition_count: usize,
    usage_count: usize,
    truncated: bool,
    recommendation: String,
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

fn validate_token_name(token: &str) -> Result<String, String> {
    let token = token.trim();
    if !token.starts_with("--") || token.len() <= 2 || token.len() > MAX_TOKEN_NAME_BYTES {
        return Err("CSS token must be a bounded custom property name such as --space-4".into());
    }
    if !token[2..]
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    {
        return Err("CSS token contains unsupported characters".into());
    }
    Ok(token.to_string())
}

fn line_number(content: &str, offset: usize) -> usize {
    content.as_bytes()[..offset.min(content.len())]
        .iter()
        .filter(|byte| **byte == b'\n')
        .count()
        + 1
}

fn selector_before(content: &str, offset: usize) -> String {
    let prefix = &content[..offset.min(content.len())];
    let Some(open) = prefix.rfind('{') else {
        return String::new();
    };
    let before = &prefix[..open];
    let boundary = before
        .rfind(['}', ';'])
        .map(|index| index + 1)
        .unwrap_or(0);
    before[boundary..]
        .trim()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(220)
        .collect()
}

fn scope_kind(selector: &str) -> TokenScopeKind {
    let selector = selector.trim().to_ascii_lowercase();
    if selector == ":root" || selector == "html" || selector == "html:root" {
        TokenScopeKind::Global
    } else {
        TokenScopeKind::Scoped
    }
}

fn declaration_value(content: &str, token_end: usize) -> Option<String> {
    let tail = &content[token_end..];
    let colon = tail.find(':')?;
    if tail[..colon].trim().is_empty() {
        let value_tail = &tail[colon + 1..];
        let end = value_tail.find(';').unwrap_or(value_tail.len());
        let value = value_tail[..end].trim();
        if !value.is_empty() && value.len() <= 300 && !value.contains('{') && !value.contains('}') {
            return Some(value.to_string());
        }
    }
    None
}

fn project_root(project_path: String) -> Result<PathBuf, String> {
    let root = fs::canonicalize(PathBuf::from(project_path.trim()))
        .map_err(|error| format!("Could not resolve project root: {error}"))?;
    let metadata = fs::metadata(&root)
        .map_err(|error| format!("Could not inspect project root: {error}"))?;
    if !metadata.is_dir() {
        return Err("Project root is not a directory".into());
    }
    Ok(root)
}

fn relative_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
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

fn exact_usage_offsets(content: &str, token: &str) -> Vec<usize> {
    let bytes = content.as_bytes();
    let token_bytes = token.as_bytes();
    let mut offsets = Vec::new();
    let mut offset = 0usize;
    while offset + 4 <= bytes.len() {
        if ascii_var_function_at(bytes, offset) {
            if let Some(token_start) = skip_var_trivia(bytes, offset + 4) {
                let token_end = token_start.saturating_add(token_bytes.len());
                if bytes.get(token_start..token_end) == Some(token_bytes)
                    && token_boundary(bytes.get(token_end).copied())
                {
                    offsets.push(offset);
                }
            }
        }
        offset += 1;
    }
    offsets
}

fn inspect(root: &Path, token: &str) -> Result<TokenScopeInspection, String> {
    let token = validate_token_name(token)?;
    let mut files = Vec::new();
    let mut total_bytes = 0;
    collect_css_sources(root, &mut files, &mut total_bytes);

    let mut definitions = Vec::new();
    let mut usages = Vec::new();
    let mut definition_count = 0usize;
    let mut usage_count = 0usize;
    let mut truncated = files.len() >= MAX_CSS_FILES || total_bytes >= MAX_TOTAL_BYTES;

    for path in files {
        let Ok(content) = fs::read_to_string(&path) else {
            continue;
        };
        let relative = relative_path(root, &path);

        for (offset, _) in content.match_indices(&token) {
            let after = offset + token.len();
            let selector = selector_before(&content, offset);
            if declaration_value(&content, after).is_some()
                && token_boundary(content[..offset].bytes().next_back())
            {
                definition_count += 1;
                if definitions.len() < MAX_DEFINITIONS {
                    definitions.push(TokenDefinition {
                        path: relative.clone(),
                        line: line_number(&content, offset),
                        selector: selector.clone(),
                        value: declaration_value(&content, after).unwrap_or_default(),
                        scope: scope_kind(&selector),
                    });
                } else {
                    truncated = true;
                }
            }
        }

        for offset in exact_usage_offsets(&content, &token) {
            usage_count += 1;
            if usages.len() < MAX_USAGES {
                usages.push(TokenUsage {
                    path: relative.clone(),
                    line: line_number(&content, offset),
                    selector: selector_before(&content, offset),
                });
            } else {
                truncated = true;
            }
        }
    }

    let global_count = definitions
        .iter()
        .filter(|definition| definition.scope == TokenScopeKind::Global)
        .count();
    let scoped_count = definitions
        .iter()
        .filter(|definition| definition.scope == TokenScopeKind::Scoped)
        .count();
    let recommendation = match (definition_count, global_count, scoped_count) {
        (0, _, _) => "Token definition was not proven in bounded plain CSS; keep the edit on Codex.".to_string(),
        (1, 1, 0) if usage_count <= 1 => "One global token with bounded usage. Offer explicit token-vs-instance choice before mutation.".to_string(),
        (1, 1, 0) => "Global design token is shared. Never mutate it implicitly; require explicit global-token confirmation or create an instance override.".to_string(),
        (1, 0, 1) => "One scoped token owner was proven. A local-token edit may be eligible after selector ownership is proven for the selected element.".to_string(),
        _ => "Multiple token owners/scopes exist. Require an explicit owner choice; do not guess.".to_string(),
    };

    Ok(TokenScopeInspection {
        token,
        definitions,
        usages,
        definition_count,
        usage_count,
        truncated,
        recommendation,
    })
}

#[tauri::command]
pub fn project_token_scope_inspect(
    project_path: String,
    token: String,
) -> Result<TokenScopeInspection, String> {
    let root = project_root(project_path)?;
    inspect(&root, &token)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn fixture() -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("monument-token-scope-{unique}"));
        fs::create_dir_all(root.join("src")).expect("mkdir");
        root
    }

    #[test]
    fn classifies_global_and_scoped_tokens() {
        let root = fixture();
        fs::write(
            root.join("src/styles.css"),
            ":root { --space: 16px; }\n.card { --space: 12px; gap: var(--space); }\n.hero { gap: var(--space); }\n",
        )
        .expect("write");
        let result = inspect(&root, "--space").expect("inspect");
        assert_eq!(result.definition_count, 2);
        assert_eq!(result.usage_count, 2);
        assert_eq!(result.definitions[0].scope, TokenScopeKind::Global);
        assert_eq!(result.definitions[1].scope, TokenScopeKind::Scoped);
        assert!(result.recommendation.contains("explicit owner choice"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn shared_global_token_requires_explicit_confirmation() {
        let root = fixture();
        fs::write(
            root.join("tokens.css"),
            ":root { --brand: #111; }\n.a { color: var(--brand); }\n.b { color: var(--brand); }\n",
        )
        .expect("write");
        let result = inspect(&root, "--brand").expect("inspect");
        assert_eq!(result.definition_count, 1);
        assert_eq!(result.usage_count, 2);
        assert!(result.recommendation.contains("Never mutate it implicitly"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn counts_valid_var_whitespace_comments_and_case() {
        let root = fixture();
        fs::write(
            root.join("tokens.css"),
            ":root { --space: 8px; }\n.a { gap: var( --space ); }\n.b { gap: VAR(/* scope */ --space); }\n.c { gap: var(--space-large); }\n",
        )
        .expect("write");
        let result = inspect(&root, "--space").expect("inspect");
        assert_eq!(result.definition_count, 1);
        assert_eq!(result.usage_count, 2);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn does_not_count_longer_token_names_as_usage() {
        let root = fixture();
        fs::write(
            root.join("tokens.css"),
            ":root { --space: 8px; --space-large: 24px; }\n.a { gap: var(--space-large); }\n.b { gap: var(--space); }\n",
        )
        .expect("write");
        let result = inspect(&root, "--space").expect("inspect");
        assert_eq!(result.definition_count, 1);
        assert_eq!(result.usage_count, 1);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn rejects_unbounded_or_invalid_token_names() {
        let root = fixture();
        assert!(inspect(&root, "color").is_err());
        assert!(inspect(&root, "--bad token").is_err());
        let _ = fs::remove_dir_all(root);
    }
}
