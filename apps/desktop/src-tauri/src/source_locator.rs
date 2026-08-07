use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

const MAX_FILES: usize = 1_200;
const MAX_FILE_BYTES: u64 = 1_500_000;
const MAX_TOTAL_BYTES: u64 = 32_000_000;
const MAX_HINTS: usize = 8;

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceHintQuery {
    text: Option<String>,
    id: Option<String>,
    #[serde(default)]
    classes: Vec<String>,
    selector: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceHint {
    path: String,
    line: usize,
    score: u32,
    excerpt: String,
}

#[derive(Debug, Clone)]
struct SearchTerm {
    value: String,
    lower: String,
    weight: u32,
}

fn should_skip_dir(name: &str) -> bool {
    matches!(
        name,
        ".git" | "node_modules" | "target" | "dist" | "build" | ".next" | ".nuxt" | ".output" | "coverage" | ".cache" | ".turbo"
    )
}

fn source_extension(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|value| value.to_str()).unwrap_or_default().to_ascii_lowercase().as_str(),
        "tsx" | "jsx" | "ts" | "js" | "mjs" | "cjs" | "vue" | "svelte" | "astro" | "html" | "htm" | "css" | "scss" | "sass" | "less"
    )
}

fn clean_term(value: &str, max: usize) -> Option<String> {
    let compact = value.split_whitespace().collect::<Vec<_>>().join(" ");
    let trimmed = compact.trim();
    if trimmed.len() < 2 {
        return None;
    }
    Some(trimmed.chars().take(max).collect())
}

fn push_term(terms: &mut Vec<SearchTerm>, seen: &mut HashSet<String>, value: String, weight: u32) {
    let lower = value.to_ascii_lowercase();
    if seen.insert(lower.clone()) {
        terms.push(SearchTerm { value, lower, weight });
    }
}

fn query_terms(query: &SourceHintQuery) -> Vec<SearchTerm> {
    let mut terms = Vec::new();
    let mut seen = HashSet::new();
    if let Some(id) = query.id.as_deref().and_then(|value| clean_term(value, 120)) {
        push_term(&mut terms, &mut seen, id, 28);
    }
    for class in query.classes.iter().take(8) {
        if let Some(value) = clean_term(class, 120) {
            push_term(&mut terms, &mut seen, value, 11);
        }
    }
    if let Some(text) = query.text.as_deref().and_then(|value| clean_term(value, 180)) {
        let weight = if text.len() >= 8 { 36 } else { 18 };
        push_term(&mut terms, &mut seen, text, weight);
    }
    if let Some(selector) = query.selector.as_deref().and_then(|value| clean_term(value, 220)) {
        for token in selector.split(|ch: char| matches!(ch, ' ' | '>' | '#' | '.' | ':' | '[' | ']' | '(' | ')' | '=')) {
            let token = token.trim();
            if token.len() >= 3 && !token.chars().all(|ch| ch.is_ascii_digit()) {
                push_term(&mut terms, &mut seen, token.chars().take(80).collect(), 4);
            }
        }
    }
    terms.sort_by(|left, right| right.weight.cmp(&left.weight).then_with(|| left.value.cmp(&right.value)));
    terms.truncate(18);
    terms
}

fn collect_sources(directory: &Path, files: &mut Vec<PathBuf>, total_bytes: &mut u64) {
    if files.len() >= MAX_FILES || *total_bytes >= MAX_TOTAL_BYTES {
        return;
    }
    let Ok(entries) = fs::read_dir(directory) else { return; };
    let mut entries: Vec<_> = entries.filter_map(Result::ok).collect();
    entries.sort_by_key(|entry| entry.path());
    for entry in entries {
        if files.len() >= MAX_FILES || *total_bytes >= MAX_TOTAL_BYTES {
            break;
        }
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if path.is_dir() {
            if !should_skip_dir(&name) && !name.starts_with(".env") {
                collect_sources(&path, files, total_bytes);
            }
            continue;
        }
        if !source_extension(&path) {
            continue;
        }
        let Ok(metadata) = entry.metadata() else { continue; };
        let size = metadata.len();
        if size <= MAX_FILE_BYTES && total_bytes.saturating_add(size) <= MAX_TOTAL_BYTES {
            *total_bytes += size;
            files.push(path);
        }
    }
}

fn score_line(line: &str, terms: &[SearchTerm]) -> u32 {
    let lower = line.to_ascii_lowercase();
    terms.iter().filter(|term| lower.contains(&term.lower)).map(|term| term.weight).sum()
}

fn best_hint(root: &Path, path: &Path, terms: &[SearchTerm]) -> Option<SourceHint> {
    let content = fs::read_to_string(path).ok()?;
    let mut best: Option<(usize, u32, String)> = None;
    for (index, line) in content.lines().enumerate() {
        let score = score_line(line, terms);
        if score == 0 {
            continue;
        }
        let replace = best.as_ref().is_none_or(|(_, best_score, _)| score > *best_score);
        if replace {
            let excerpt: String = line.trim().chars().take(240).collect();
            best = Some((index + 1, score, excerpt));
        }
    }
    let (line, mut score, excerpt) = best?;
    let extension = path.extension().and_then(|value| value.to_str()).unwrap_or_default();
    if matches!(extension, "tsx" | "jsx" | "vue" | "svelte" | "astro") {
        score += 5;
    }
    let relative = path.strip_prefix(root).unwrap_or(path).to_string_lossy().to_string();
    Some(SourceHint { path: relative, line, score, excerpt })
}

fn locate(root: &Path, query: &SourceHintQuery) -> Vec<SourceHint> {
    let terms = query_terms(query);
    if terms.is_empty() {
        return Vec::new();
    }
    let mut files = Vec::new();
    let mut total_bytes = 0;
    collect_sources(root, &mut files, &mut total_bytes);
    let mut hints: Vec<_> = files.iter().filter_map(|path| best_hint(root, path, &terms)).collect();
    hints.sort_by(|left, right| right.score.cmp(&left.score).then_with(|| left.path.cmp(&right.path)).then_with(|| left.line.cmp(&right.line)));
    hints.truncate(MAX_HINTS);
    hints
}

#[tauri::command]
pub fn project_source_hints(project_path: String, query: SourceHintQuery) -> Result<Vec<SourceHint>, String> {
    let root = PathBuf::from(project_path).canonicalize().map_err(|error| format!("Cannot inspect project source: {error}"))?;
    if !root.is_dir() {
        return Err("Source hint root is not a directory".into());
    }
    Ok(locate(&root, &query))
}

#[cfg(test)]
mod tests {
    use super::{query_terms, score_line, SourceHintQuery, MAX_TOTAL_BYTES};

    #[test]
    fn exact_rendered_text_outweighs_generic_selector_tokens() {
        let query = SourceHintQuery {
            text: Some("Start building".into()),
            id: None,
            classes: vec!["primary-button".into()],
            selector: Some("main > section.hero > button.primary-button".into()),
        };
        let terms = query_terms(&query);
        assert!(score_line("<button>Start building</button>", &terms) > score_line("const button = true", &terms));
    }

    #[test]
    fn id_and_class_produce_search_terms() {
        let query = SourceHintQuery {
            text: None,
            id: Some("pricing-cta".into()),
            classes: vec!["cta-button".into()],
            selector: None,
        };
        let terms = query_terms(&query);
        assert!(score_line("id=\"pricing-cta\" className=\"cta-button\"", &terms) >= 39);
    }

    #[test]
    fn total_scan_budget_is_intentionally_bounded() {
        assert!(MAX_TOTAL_BYTES <= 32_000_000);
    }
}
