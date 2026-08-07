#[path = "../src/browser_evidence.rs"]
mod browser_evidence;

use browser_evidence::{parse_title_payload, BROWSER_EVIDENCE_PREFIX, MAX_PAYLOAD_BYTES};

#[test]
fn parses_minimal_valid_browser_evidence_snapshot() {
    let json = r#"{"requestId":"browser-1","capturedAt":1,"page":{"url":"http://localhost:5173/","viewport":{"width":390,"height":844,"dpr":2}},"console":[],"runtime":[],"network":[]}"#;
    let title = format!("{BROWSER_EVIDENCE_PREFIX}{json}");
    let snapshot = parse_title_payload(&title).unwrap().expect("browser evidence payload");
    assert_eq!(snapshot.request_id, "browser-1");
    assert!(snapshot.console.is_empty());
    assert!(snapshot.runtime.is_empty());
    assert!(snapshot.network.is_empty());
}

#[test]
fn rejects_payload_over_native_byte_ceiling() {
    let oversized = "x".repeat(MAX_PAYLOAD_BYTES + 1);
    let title = format!("{BROWSER_EVIDENCE_PREFIX}{oversized}");
    let error = parse_title_payload(&title).expect_err("oversized browser evidence must fail");
    assert!(error.contains("byte bound"));
}

#[test]
fn ignores_normal_document_titles() {
    assert!(parse_title_payload("Normal product title").unwrap().is_none());
}
