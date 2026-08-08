use std::collections::HashMap;

pub const MAX_OPENING_TAG_BYTES: usize = 64 * 1024;
pub const MAX_ATTRIBUTES_PER_TAG: usize = 96;

#[derive(Debug, Clone)]
pub enum JsxAttributeValue {
    Literal {
        value: String,
        value_start: usize,
        value_end: usize,
        quote: u8,
    },
    Expression {
        inner_start: usize,
        inner_end: usize,
    },
    Bare {
        value_start: usize,
        value_end: usize,
    },
    Boolean,
}

#[derive(Debug, Clone)]
pub struct JsxAttribute {
    pub name: String,
    pub value: JsxAttributeValue,
}

#[derive(Debug, Clone)]
pub struct JsxOpeningTag {
    pub tag: String,
    pub start: usize,
    pub end: usize,
    pub attributes: Vec<JsxAttribute>,
    pub has_spread: bool,
}

impl JsxOpeningTag {
    pub fn attribute(&self, name: &str) -> Option<&JsxAttribute> {
        self.attributes.iter().find(|attribute| attribute.name == name)
    }

    pub fn duplicate_attribute_names(&self) -> Vec<String> {
        let mut counts: HashMap<&str, usize> = HashMap::new();
        for attribute in &self.attributes {
            *counts.entry(attribute.name.as_str()).or_default() += 1;
        }
        counts
            .into_iter()
            .filter_map(|(name, count)| (count > 1).then(|| name.to_string()))
            .collect()
    }
}

fn is_tag_name_start(byte: u8) -> bool {
    byte.is_ascii_alphabetic()
}

fn is_tag_name_byte(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b':')
}

fn is_attr_name_start(byte: u8) -> bool {
    byte.is_ascii_alphabetic() || matches!(byte, b'_' | b':')
}

fn is_attr_name_byte(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b':' | b'.')
}

fn skip_ws(bytes: &[u8], mut cursor: usize, end: usize) -> usize {
    while cursor < end && bytes[cursor].is_ascii_whitespace() {
        cursor += 1;
    }
    cursor
}

fn quoted_end(bytes: &[u8], start: usize, end: usize, quote: u8) -> Option<usize> {
    let mut cursor = start;
    let mut escaped = false;
    while cursor < end {
        let byte = bytes[cursor];
        if escaped {
            escaped = false;
        } else if byte == b'\\' {
            escaped = true;
        } else if byte == quote {
            return Some(cursor);
        }
        cursor += 1;
    }
    None
}

fn matching_brace(bytes: &[u8], open: usize, hard_end: usize) -> Result<usize, String> {
    if bytes.get(open) != Some(&b'{') {
        return Err("JSX expression does not start with an opening brace".into());
    }
    let mut cursor = open + 1;
    let mut depth = 1usize;
    let mut quote: Option<u8> = None;
    let mut escaped = false;
    let mut line_comment = false;
    let mut block_comment = false;

    while cursor < hard_end {
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
            // Regex-vs-division needs a real JS parser. Refuse the bounded JSX tag instead of guessing.
            return Err("JSX expression contains unsupported slash syntax".into());
        }
        if matches!(byte, b'\'' | b'"' | b'`') {
            quote = Some(byte);
            cursor += 1;
            continue;
        }
        match byte {
            b'{' => depth += 1,
            b'}' => {
                depth -= 1;
                if depth == 0 {
                    return Ok(cursor);
                }
            }
            _ => {}
        }
        cursor += 1;
    }
    Err("JSX expression is unterminated".into())
}

pub fn parse_opening_tag_at(content: &str, start: usize) -> Option<JsxOpeningTag> {
    let bytes = content.as_bytes();
    if bytes.get(start) != Some(&b'<') {
        return None;
    }
    let hard_end = start.saturating_add(MAX_OPENING_TAG_BYTES).min(bytes.len());
    let mut cursor = start + 1;
    if matches!(bytes.get(cursor), Some(b'/') | Some(b'!') | Some(b'?') | Some(b'>')) {
        return None;
    }
    if !bytes.get(cursor).copied().is_some_and(is_tag_name_start) {
        return None;
    }
    let name_start = cursor;
    cursor += 1;
    while cursor < hard_end && is_tag_name_byte(bytes[cursor]) {
        cursor += 1;
    }
    let tag = content[name_start..cursor].to_string();
    let mut attributes = Vec::new();
    let mut has_spread = false;

    loop {
        cursor = skip_ws(bytes, cursor, hard_end);
        if cursor >= hard_end {
            return None;
        }
        if bytes[cursor] == b'>' {
            return Some(JsxOpeningTag {
                tag,
                start,
                end: cursor + 1,
                attributes,
                has_spread,
            });
        }
        if bytes[cursor] == b'/' && bytes.get(cursor + 1) == Some(&b'>') {
            return Some(JsxOpeningTag {
                tag,
                start,
                end: cursor + 2,
                attributes,
                has_spread,
            });
        }
        if bytes[cursor] == b'{' {
            let close = matching_brace(bytes, cursor, hard_end).ok()?;
            let inner = content[cursor + 1..close].trim_start();
            if inner.starts_with("...") {
                has_spread = true;
            }
            cursor = close + 1;
            continue;
        }
        if !is_attr_name_start(bytes[cursor]) {
            return None;
        }
        if attributes.len() >= MAX_ATTRIBUTES_PER_TAG {
            return None;
        }
        let attr_start = cursor;
        cursor += 1;
        while cursor < hard_end && is_attr_name_byte(bytes[cursor]) {
            cursor += 1;
        }
        let name = content[attr_start..cursor].to_string();
        cursor = skip_ws(bytes, cursor, hard_end);
        if cursor >= hard_end || bytes[cursor] != b'=' {
            attributes.push(JsxAttribute {
                name,
                value: JsxAttributeValue::Boolean,
            });
            continue;
        }
        cursor += 1;
        cursor = skip_ws(bytes, cursor, hard_end);
        if cursor >= hard_end {
            return None;
        }
        let value = match bytes[cursor] {
            quote @ (b'\'' | b'"') => {
                let value_start = cursor + 1;
                let close = quoted_end(bytes, value_start, hard_end, quote)?;
                let value = content[value_start..close].to_string();
                cursor = close + 1;
                JsxAttributeValue::Literal {
                    value,
                    value_start,
                    value_end: close,
                    quote,
                }
            }
            b'{' => {
                let close = matching_brace(bytes, cursor, hard_end).ok()?;
                let value = JsxAttributeValue::Expression {
                    inner_start: cursor + 1,
                    inner_end: close,
                };
                cursor = close + 1;
                value
            }
            _ => {
                let value_start = cursor;
                while cursor < hard_end
                    && !bytes[cursor].is_ascii_whitespace()
                    && bytes[cursor] != b'>'
                    && !(bytes[cursor] == b'/' && bytes.get(cursor + 1) == Some(&b'>'))
                {
                    cursor += 1;
                }
                if value_start == cursor {
                    return None;
                }
                JsxAttributeValue::Bare {
                    value_start,
                    value_end: cursor,
                }
            }
        };
        attributes.push(JsxAttribute { name, value });
    }
}

fn skip_closing_tag(bytes: &[u8], start: usize) -> usize {
    let mut cursor = start + 2;
    while cursor < bytes.len() && bytes[cursor] != b'>' {
        cursor += 1;
    }
    (cursor + 1).min(bytes.len())
}

/// Bounded JSX source discovery deliberately prefers false negatives to lexical false positives.
/// Strings, templates and comments are never parsed as JSX. A bare `/` in JS code is ambiguous
/// between division and a regex literal without a real JavaScript parser, so the entire file is
/// refused for deterministic markup ownership when such syntax is encountered outside a parsed tag.
pub fn opening_tags(content: &str) -> Vec<JsxOpeningTag> {
    let bytes = content.as_bytes();
    let mut tags = Vec::new();
    let mut cursor = 0usize;
    let mut quote: Option<u8> = None;
    let mut escaped = false;
    let mut line_comment = false;
    let mut block_comment = false;

    while cursor < bytes.len() {
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
        if matches!(byte, b'\'' | b'"' | b'`') {
            quote = Some(byte);
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
        if byte == b'<' && bytes.get(cursor + 1) == Some(&b'/') {
            cursor = skip_closing_tag(bytes, cursor);
            continue;
        }
        if byte == b'<' {
            if let Some(tag) = parse_opening_tag_at(content, cursor) {
                cursor = tag.end.max(cursor + 1);
                tags.push(tag);
                continue;
            }
            cursor += 1;
            continue;
        }
        if byte == b'/' {
            // A lexical false-positive here could turn a string/regex-shaped fragment into write
            // authority. Refuse the file until M2.3 grows a full JS/TS parser-backed ownership lane.
            return Vec::new();
        }
        cursor += 1;
    }

    if quote.is_some() || block_comment {
        return Vec::new();
    }
    tags
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_literal_and_expression_attributes() {
        let source = r#"const x = <div id="hero" className="flex gap-[16px]" style={{ gap: '16px' }} aria-label="Hero" />;"#;
        let tag = opening_tags(source).into_iter().next().expect("tag");
        assert_eq!(tag.tag, "div");
        assert!(!tag.has_spread);
        match &tag.attribute("id").expect("id").value {
            JsxAttributeValue::Literal { value, .. } => assert_eq!(value, "hero"),
            other => panic!("unexpected id attribute {other:?}"),
        }
        assert!(matches!(
            &tag.attribute("style").expect("style").value,
            JsxAttributeValue::Expression { .. }
        ));
    }

    #[test]
    fn detects_spread_and_duplicate_attributes() {
        let source = r#"<section {...props} id="hero" className="a" className="b">"#;
        let tag = opening_tags(source).into_iter().next().expect("tag");
        assert!(tag.has_spread);
        assert_eq!(tag.duplicate_attribute_names(), vec!["className".to_string()]);
    }

    #[test]
    fn refuses_unbounded_slash_expression_instead_of_guessing() {
        let source = r#"<div id="hero" data-value={foo / 2} className="gap-[16px]" />"#;
        assert!(opening_tags(source).is_empty());
    }

    #[test]
    fn ignores_jsx_shaped_strings_comments_and_templates() {
        let source = r#"
          const a = "<div id=\"hero\" className=\"gap-[16px]\"/>";
          const b = '<div id="hero" className="gap-[16px]"/>';
          const c = `<div id="hero" className="gap-[16px]"/>`;
          // <div id="hero" className="gap-[16px]"/>
          /* <div id="hero" className="gap-[16px]"/> */
          export const App = () => <div id="real" className="gap-[16px]"/>;
        "#;
        let tags = opening_tags(source);
        assert_eq!(tags.len(), 1);
        assert_eq!(literal_attr(&tags[0], "id"), Some("real"));
    }

    fn literal_attr<'a>(tag: &'a JsxOpeningTag, name: &str) -> Option<&'a str> {
        match &tag.attribute(name)?.value {
            JsxAttributeValue::Literal { value, .. } => Some(value.as_str()),
            _ => None,
        }
    }

    #[test]
    fn closing_tags_do_not_hide_later_duplicate_opening_tags() {
        let source = r#"<div id="hero"/><span></span><div id="hero"/>"#;
        let tags = opening_tags(source);
        assert_eq!(tags.iter().filter(|tag| literal_attr(tag, "id") == Some("hero")).count(), 2);
    }

    #[test]
    fn bare_slash_syntax_refuses_the_file_instead_of_risking_regex_false_positive() {
        let source = r#"const re = /<div id="hero" className="gap-[16px]"\/>/; export const App = () => <div id="real"/>;"#;
        assert!(opening_tags(source).is_empty());
    }
}
