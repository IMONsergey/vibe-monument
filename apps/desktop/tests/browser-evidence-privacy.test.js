import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const browser = await readFile(new URL('../src-tauri/src/browser_evidence.rs', import.meta.url), 'utf8');
const scriptMatch = browser.match(/pub const BROWSER_EVIDENCE_SCRIPT: &str = r#"([\s\S]*?)"#;/);
assert.ok(scriptMatch, 'embedded browser evidence script was not found');
const browserScript = scriptMatch[1];

test('browser evidence redacts common secret patterns and bounds payload size', () => {
  for (const token of [
    'MAX_PAYLOAD_BYTES',
    '48 * 1024',
    'Bearer [redacted]',
    '[redacted-token]',
    '[redacted-jwt]',
    'state.console.slice(-20)',
    'state.runtime.slice(-15)',
    'state.network.slice(-30)',
  ]) {
    assert.ok(browser.includes(token), `browser evidence missing ${token}`);
  }

  assert.ok(!browserScript.includes('response.text'));
  assert.ok(!browserScript.includes('response.json'));
  assert.ok(!browserScript.includes('url.search'));
  assert.ok(!browserScript.includes('url.hash'));
  assert.match(browser, /MAX_EVENT_TEXT: usize = 600/);
});
