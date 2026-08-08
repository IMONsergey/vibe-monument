use serde::Deserialize;
use serde_json::{json, Value};

const TOKEN_MARKER: &str = " · token ";
const DETACH_MARKER: &str = " · detach ";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SourceRequestView {
    project_path: String,
    element_id: Option<String>,
    property: String,
    before: String,
    after: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SourceApplyView {
    request: SourceRequestView,
    expected_source_path: String,
    expected_file_fingerprint: String,
    expected_value_start: usize,
    expected_value_end: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RoutedScope {
    Element,
    Token,
}

#[derive(Debug, Clone)]
struct RoutedProperty {
    original_property: String,
    token_name: String,
    scope: RoutedScope,
}

fn safe_token(value: &str) -> bool {
    value.starts_with("--")
        && value.len() > 2
        && value.len() <= 120
        && value[2..]
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

fn routed_property(value: &str) -> Option<RoutedProperty> {
    let value = value.trim();
    let (original_property, token_name, scope) = if let Some((property, token)) = value.split_once(DETACH_MARKER) {
        (property.trim(), token.trim(), RoutedScope::Element)
    } else if let Some((property, token)) = value.split_once(TOKEN_MARKER) {
        (property.trim(), token.trim(), RoutedScope::Token)
    } else {
        return None;
    };
    if original_property.is_empty()
        || original_property.len() > 120
        || !original_property.bytes().all(|byte| byte.is_ascii_alphanumeric())
        || !safe_token(token_name)
    {
        return None;
    }
    Some(RoutedProperty {
        original_property: original_property.to_string(),
        token_name: token_name.to_string(),
        scope,
    })
}

fn exact_var(token: &str) -> String {
    format!("var({token})")
}

fn source_request_value(request: &SourceRequestView, property: &str) -> Value {
    json!({
        "projectPath": request.project_path,
        "elementId": request.element_id,
        "property": property,
        "before": request.before,
        "after": request.after,
    })
}

fn token_request_value(request: &SourceRequestView, property: &str) -> Value {
    source_request_value(request, property)
}

fn normal_source_plan(input: Value) -> Result<Value, String> {
    let typed = serde_json::from_value(input).map_err(|error| format!("Invalid visual source plan input: {error}"))?;
    serde_json::to_value(crate::visual_source::visual_source_plan(typed)?)
        .map_err(|error| error.to_string())
}

fn normal_source_apply(input: Value) -> Result<Value, String> {
    let typed = serde_json::from_value(input).map_err(|error| format!("Invalid visual source apply input: {error}"))?;
    serde_json::to_value(crate::visual_source::visual_source_apply(typed)?)
        .map_err(|error| error.to_string())
}

fn token_plan(input: Value) -> Result<Value, String> {
    let typed = serde_json::from_value(input).map_err(|error| format!("Invalid visual token plan input: {error}"))?;
    serde_json::to_value(crate::visual_tokens::visual_token_plan(typed)?)
        .map_err(|error| error.to_string())
}

fn token_apply(input: Value) -> Result<Value, String> {
    let typed = serde_json::from_value(input).map_err(|error| format!("Invalid visual token apply input: {error}"))?;
    serde_json::to_value(crate::visual_tokens::visual_token_apply(typed)?)
        .map_err(|error| error.to_string())
}

fn field<'a>(value: &'a Value, name: &str) -> Option<&'a Value> {
    value.as_object()?.get(name)
}

fn string_field(value: &Value, name: &str) -> Option<String> {
    field(value, name)?.as_str().map(str::to_string)
}

fn scope_plan<'a>(response: &'a Value, scope: RoutedScope) -> Option<&'a Value> {
    match scope {
        RoutedScope::Element => field(response, "elementPlan")?.as_object().map(|_| field(response, "elementPlan").unwrap()),
        RoutedScope::Token => field(response, "tokenPlan")?.as_object().map(|_| field(response, "tokenPlan").unwrap()),
    }
}

fn translated_source_plan(response: &Value, routed: &RoutedProperty, requested_property: &str) -> Result<Value, String> {
    if string_field(response, "status").as_deref() != Some("scope-choice") {
        return Ok(json!({
            "status": string_field(response, "status").unwrap_or_else(|| "not-found".into()),
            "reason": string_field(response, "reason").unwrap_or_else(|| "Token scope is not deterministic.".into()),
            "candidateCount": 0,
            "plan": null,
            "candidates": []
        }));
    }
    if string_field(response, "tokenName").as_deref() != Some(routed.token_name.as_str()) {
        return Err("Token router proof returned a different custom property".into());
    }
    let mut plan = scope_plan(response, routed.scope)
        .cloned()
        .ok_or_else(|| "Token router proof did not return the selected scope".to_string())?;
    let object = plan.as_object_mut().ok_or_else(|| "Invalid token scope plan".to_string())?;
    object.insert("requestedProperty".into(), Value::String(requested_property.to_string()));
    Ok(json!({
        "status": "deterministic",
        "reason": match routed.scope {
            RoutedScope::Element => "Explicit token scope: detach this element while keeping the global token unchanged.",
            RoutedScope::Token => "Explicit token scope: update the proved global :root token definition."
        },
        "candidateCount": 1,
        "plan": plan,
        "candidates": []
    }))
}

fn routed_plan(request: &SourceRequestView, routed: &RoutedProperty) -> Result<Value, String> {
    // Reverse of an element detach is a normal literal -> var(--token) declaration restoration.
    if routed.scope == RoutedScope::Element && request.after.trim() == exact_var(&routed.token_name) {
        return normal_source_plan(source_request_value(request, &routed.original_property));
    }
    if request.after.contains("var(") {
        return Err("Token source transactions require a literal requested value".into());
    }
    let response = token_plan(token_request_value(request, &routed.original_property))?;
    translated_source_plan(&response, routed, &request.property)
}

fn routed_apply(input: &SourceApplyView, routed: &RoutedProperty) -> Result<Value, String> {
    // Reverse of an element detach uses the literal source engine so it can restore var(--token).
    if routed.scope == RoutedScope::Element && input.request.after.trim() == exact_var(&routed.token_name) {
        return normal_source_apply(json!({
            "request": source_request_value(&input.request, &routed.original_property),
            "expectedSourcePath": input.expected_source_path,
            "expectedFileFingerprint": input.expected_file_fingerprint,
            "expectedValueStart": input.expected_value_start,
            "expectedValueEnd": input.expected_value_end,
        }));
    }
    if input.request.after.contains("var(") {
        return Err("Token source transactions require a literal requested value".into());
    }
    let scope = match routed.scope {
        RoutedScope::Element => "element",
        RoutedScope::Token => "token",
    };
    let result = token_apply(json!({
        "request": token_request_value(&input.request, &routed.original_property),
        "scope": scope,
        "expectedSourcePath": input.expected_source_path,
        "expectedFileFingerprint": input.expected_file_fingerprint,
        "expectedValueStart": input.expected_value_start,
        "expectedValueEnd": input.expected_value_end,
    }))?;
    let plan = field(&result, "plan").cloned().ok_or_else(|| "Token apply returned no source plan".to_string())?;
    Ok(json!({
        "sourcePath": string_field(&result, "sourcePath").ok_or_else(|| "Token apply returned no source path".to_string())?,
        "cssProperty": string_field(&result, "cssProperty").unwrap_or_else(|| routed.original_property.clone()),
        "line": field(&result, "line").and_then(Value::as_u64).unwrap_or(0),
        "previousFingerprint": string_field(&result, "previousFingerprint").ok_or_else(|| "Token apply returned no previous fingerprint".to_string())?,
        "nextFingerprint": string_field(&result, "nextFingerprint").ok_or_else(|| "Token apply returned no next fingerprint".to_string())?,
        "bytesWritten": field(&result, "bytesWritten").and_then(Value::as_u64).unwrap_or(0),
        "plan": plan,
    }))
}

#[tauri::command]
pub fn visual_source_plan(input: Value) -> Result<Value, String> {
    let request: SourceRequestView = serde_json::from_value(input.clone())
        .map_err(|error| format!("Invalid visual source plan input: {error}"))?;
    if let Some(routed) = routed_property(&request.property) {
        routed_plan(&request, &routed)
    } else {
        normal_source_plan(input)
    }
}

#[tauri::command]
pub fn visual_source_apply(input: Value) -> Result<Value, String> {
    let view: SourceApplyView = serde_json::from_value(input.clone())
        .map_err(|error| format!("Invalid visual source apply input: {error}"))?;
    if let Some(routed) = routed_property(&view.request.property) {
        routed_apply(&view, &routed)
    } else {
        normal_source_apply(input)
    }
}

#[cfg(test)]
mod tests {
    use super::{routed_property, RoutedScope};

    #[test]
    fn parses_only_bounded_human_readable_token_operation_labels() {
        let detach = routed_property("paddingTop · detach --space-xl").unwrap();
        assert_eq!(detach.original_property, "paddingTop");
        assert_eq!(detach.token_name, "--space-xl");
        assert_eq!(detach.scope, RoutedScope::Element);

        let token = routed_property("paddingTop · token --space-xl").unwrap();
        assert_eq!(token.scope, RoutedScope::Token);
        assert!(routed_property("paddingTop · token var(--space-xl)").is_none());
        assert!(routed_property("padding-top · token --space-xl").is_none());
        assert!(routed_property("paddingTop · token --space); color:red").is_none());
    }
}
