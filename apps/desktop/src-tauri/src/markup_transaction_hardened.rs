mod core {
    include!("markup_transaction_v2.rs");

    use serde_json::json;

    fn enforce_stylesheet_precedence(
        project_path: &str,
        selection: &MarkupEditSelection,
        change: &MarkupEditChange,
        lane: MarkupLane,
    ) -> Result<(), String> {
        if lane != MarkupLane::Tailwind {
            return Ok(());
        }

        let css_selection: crate::source_transaction::SourceTransactionSelection =
            serde_json::from_value(json!({
                "id": selection.id.clone(),
                "classes": selection.classes.clone(),
                "selector": null,
            }))
            .map_err(|error| format!("Cannot build CSS precedence selection: {error}"))?;
        let css_change: crate::source_transaction::SourceTransactionChange =
            serde_json::from_value(json!({
                "property": change.property.clone(),
                "before": change.before.clone(),
                "after": change.after.clone(),
            }))
            .map_err(|error| format!("Cannot build CSS precedence change: {error}"))?;

        // The existing M2.1 resolver is the authority for whether a stylesheet can own this
        // property. Only an explicit Codex result means CSS ownership was not proved. Any error,
        // deterministic owner or assisted owner fails closed before Tailwind write authority.
        let plan = crate::source_transaction::project_source_transaction_preview(
            project_path.to_string(),
            css_selection,
            vec![css_change],
        )?;
        let serialized = serde_json::to_value(&plan)
            .map_err(|error| format!("Cannot inspect CSS precedence result: {error}"))?;
        let mode = serialized.get("mode").and_then(|value| value.as_str()).unwrap_or("unknown");
        if mode == "codex" {
            return Ok(());
        }
        let reason = serialized
            .get("reason")
            .and_then(|value| value.as_str())
            .unwrap_or("CSS ownership is present or could not be excluded safely");
        Err(format!("Tailwind direct write blocked by CSS ownership: {reason}"))
    }

    fn enforce_tailwind_conflict_guard(
        project_path: &str,
        selection: &MarkupEditSelection,
        change: &MarkupEditChange,
        lane: MarkupLane,
    ) -> Result<(), String> {
        if lane != MarkupLane::Tailwind {
            return Ok(());
        }

        let guard_selection: crate::markup_conflict_guard::MarkupGuardSelection =
            serde_json::from_value(json!({
                "id": selection.id.clone(),
                "idUnique": selection.id_unique,
                "tag": selection.tag.clone(),
            }))
            .map_err(|error| format!("Cannot build Tailwind conflict guard selection: {error}"))?;
        let guard_change: crate::markup_conflict_guard::MarkupGuardChange =
            serde_json::from_value(json!({ "property": change.property.clone() }))
                .map_err(|error| format!("Cannot build Tailwind conflict guard change: {error}"))?;

        let guard = crate::markup_conflict_guard::project_markup_conflict_guard(
            project_path.to_string(),
            guard_selection,
            guard_change,
        )?;
        let serialized = serde_json::to_value(&guard)
            .map_err(|error| format!("Cannot inspect Tailwind conflict guard result: {error}"))?;
        let safe = serialized.get("safe").and_then(|value| value.as_bool()).unwrap_or(false);
        if safe {
            return Ok(());
        }
        let reason = serialized
            .get("reason")
            .and_then(|value| value.as_str())
            .unwrap_or("Tailwind conflict guard refused the source transaction");
        let conflicts = serialized
            .get("conflicts")
            .and_then(|value| value.as_array())
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.as_str())
                    .take(24)
                    .collect::<Vec<_>>()
                    .join(", ")
            })
            .unwrap_or_default();
        Err(if conflicts.is_empty() {
            reason.to_string()
        } else {
            format!("{reason} · {conflicts}")
        })
    }

    pub(super) fn hardened_commit(
        project_path: String,
        selection: MarkupEditSelection,
        change: MarkupEditChange,
    ) -> Result<MarkupTransactionCommit, String> {
        let root = project_root(project_path.clone())?;
        let resolved = resolve(&root, &selection, &change)?;
        if resolved.public.mode != MarkupEditMode::Deterministic {
            return Err(format!(
                "Markup source transaction is not deterministic: {}",
                resolved.public.reason
            ));
        }

        let operation_ref = resolved
            .public
            .operation
            .as_ref()
            .ok_or_else(|| "Markup operation disappeared during commit resolution".to_string())?;

        // Production write authority repeats both source-lane proof lines inside the same native
        // commit command: M2.1 stylesheet precedence first, then the independent Tailwind
        // multi-property veto. Frontend checks remain UX only.
        enforce_stylesheet_precedence(
            &project_path,
            &selection,
            &change,
            operation_ref.lane,
        )?;
        enforce_tailwind_conflict_guard(
            &project_path,
            &selection,
            &change,
            operation_ref.lane,
        )?;

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

        // Re-read only after both independent proof lines. An external edit between v2 ownership
        // resolution and either veto cannot inherit the old write authority because the original
        // whole-file fingerprint and exact source range must still match here.
        let mut content = fs::read_to_string(&canonical)
            .map_err(|error| format!("Cannot read markup transaction target: {error}"))?;
        if fingerprint(&content) != expected_fingerprint {
            return Err(
                "Source changed while validating markup write authority; re-apply against current source"
                    .into(),
            );
        }
        let actual = content
            .get(start..end)
            .ok_or_else(|| "Markup source range changed after guarded resolution".to_string())?;
        if actual != operation.source_before {
            return Err(
                "Markup source value changed after guarded resolution; re-apply against current source"
                    .into(),
            );
        }

        content.replace_range(start..end, &operation.source_after);
        let target_id = selection.id.clone().unwrap_or_default();
        if !opening_tags(&content).iter().any(|tag| {
            literal_attribute(tag, "id").is_some_and(|(id, _, _)| id == target_id)
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
}

pub use core::{MarkupEditChange, MarkupEditProbe, MarkupEditSelection, MarkupTransactionCommit, MarkupTransactionPlan};

#[tauri::command]
pub fn project_markup_edit_probe(
    project_path: String,
    selection: MarkupEditSelection,
    change: MarkupEditChange,
) -> Result<MarkupEditProbe, String> {
    core::project_markup_edit_probe(project_path, selection, change)
}

#[tauri::command]
pub fn project_markup_transaction_preview(
    project_path: String,
    selection: MarkupEditSelection,
    change: MarkupEditChange,
) -> Result<MarkupTransactionPlan, String> {
    core::project_markup_transaction_preview(project_path, selection, change)
}

#[tauri::command]
pub fn project_markup_transaction_commit(
    project_path: String,
    selection: MarkupEditSelection,
    change: MarkupEditChange,
) -> Result<MarkupTransactionCommit, String> {
    core::hardened_commit(project_path, selection, change)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn fixture(name: &str, classes: &str, css: Option<&str>) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("monument-markup-hardened-{name}-{nonce}"));
        fs::create_dir_all(root.join("src")).unwrap();
        fs::write(
            root.join("src/App.tsx"),
            format!(r#"export const App=()=> <div id="hero" className="{classes}"/>;"#),
        )
        .unwrap();
        if let Some(css) = css {
            fs::write(root.join("src/styles.css"), css).unwrap();
        }
        root
    }

    fn selection(classes: &[&str]) -> MarkupEditSelection {
        serde_json::from_value(serde_json::json!({
            "id": "hero",
            "idUnique": true,
            "classes": classes,
            "tag": "div",
        }))
        .unwrap()
    }

    fn change(property: &str, before: &str, after: &str) -> MarkupEditChange {
        serde_json::from_value(serde_json::json!({
            "property": property,
            "before": before,
            "after": after,
        }))
        .unwrap()
    }

    #[test]
    fn native_commit_refuses_competing_css_owner_after_markup_resolution() {
        let root = fixture("css", "w-[16px]", Some("#hero { width: 16px; }"));
        let result = project_markup_transaction_commit(
            root.to_string_lossy().to_string(),
            selection(&["w-[16px]"]),
            change("width", "16px", "24px"),
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("CSS ownership"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn native_commit_refuses_hidden_size_competitor_after_v2_resolution() {
        let root = fixture("size", "w-[16px] size-[32px]", None);
        let result = project_markup_transaction_commit(
            root.to_string_lossy().to_string(),
            selection(&["w-[16px]", "size-[32px]"]),
            change("width", "16px", "24px"),
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Tailwind"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn native_commit_preserves_safe_tailwind_write() {
        let root = fixture("safe", "w-[16px]", None);
        project_markup_transaction_commit(
            root.to_string_lossy().to_string(),
            selection(&["w-[16px]"]),
            change("width", "16px", "24px"),
        )
        .unwrap();
        assert!(fs::read_to_string(root.join("src/App.tsx"))
            .unwrap()
            .contains("w-[24px]"));
        let _ = fs::remove_dir_all(root);
    }
}
