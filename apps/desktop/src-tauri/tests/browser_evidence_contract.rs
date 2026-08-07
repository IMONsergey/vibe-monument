#[path = "../src/browser_evidence.rs"]
mod browser_evidence;

#[test]
fn browser_evidence_contract_stays_bounded() {
    assert!(browser_evidence::MAX_CONSOLE_EVENTS <= 60);
    assert!(browser_evidence::MAX_RUNTIME_EVENTS <= 40);
    assert!(browser_evidence::MAX_NETWORK_EVENTS <= 80);
    assert!(browser_evidence::MAX_EVENT_TEXT <= 1_000);
    assert!(browser_evidence::SLOW_REQUEST_MS >= 1_500);
}
