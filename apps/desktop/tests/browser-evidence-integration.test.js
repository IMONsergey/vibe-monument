import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

function includesAll(text, tokens, label) {
  for (const token of tokens) assert.ok(text.includes(token), `${label} missing ${token}`);
}

function embeddedBrowserScript(rustSource) {
  const match = rustSource.match(/pub const BROWSER_EVIDENCE_SCRIPT: &str = r#"([\s\S]*?)"#;/);
  assert.ok(match, 'embedded browser evidence script was not found');
  return match[1];
}

test('native preview wires bounded browser evidence without broad remote IPC', async () => {
  const [preview, lib, browser] = await Promise.all([
    source('src-tauri/src/preview_runtime.rs'),
    source('src-tauri/src/lib.rs'),
    source('src-tauri/src/browser_evidence.rs'),
  ]);
  const browserScript = embeddedBrowserScript(browser);

  includesAll(preview, [
    'BROWSER_EVIDENCE_SCRIPT',
    'preview_install_browser_evidence',
    'preview_collect_browser_evidence',
    'preview_clear_browser_evidence',
    'monument://preview-browser-evidence',
    'parse_title_payload',
  ], 'preview runtime');
  includesAll(lib, [
    'mod browser_evidence;',
    'preview_collect_browser_evidence',
    'preview_clear_browser_evidence',
  ], 'native command registry');
  includesAll(browserScript, [
    "['warn', 'error']",
    'unhandledrejection',
    'window.fetch',
    'XMLHttpRequest',
    'url.pathname',
  ], 'embedded browser evidence script');
  includesAll(browser, [
    'MAX_CONSOLE_EVENTS',
    'MAX_RUNTIME_EVENTS',
    'MAX_NETWORK_EVENTS',
    'SLOW_REQUEST_MS',
    'MAX_PAYLOAD_BYTES',
  ], 'native browser evidence bounds');

  assert.ok(!preview.includes('dangerousRemoteDomainIpcAccess'));
  assert.ok(!browserScript.includes('url.search'));
  assert.ok(!browserScript.includes('url.hash'));
  assert.ok(!browserScript.includes('response.text'));
  assert.ok(!browserScript.includes('response.json'));
});

test('turn generations make deterministic and browser evidence stale after newer work', async () => {
  const [runtime, types, verification, browserStore, app] = await Promise.all([
    source('src/codex/runtime.ts'),
    source('src/types.ts'),
    source('src/verification/controller.ts'),
    source('src/browser/evidence.ts'),
    source('src/App.tsx'),
  ]);

  includesAll(runtime, [
    'turnSerial: number',
    'turnSerial: 0',
    "case 'turn/started'",
    'turnSerial: this.snapshot.turnSerial + 1',
  ], 'Codex turn generation');
  assert.ok(types.includes('turnSerial: number;'));
  includesAll(verification, ['turnSerial: number;', 'turnSerial = 0'], 'deterministic evidence generation');
  includesAll(browserStore, ['capturedForTurnSerial', 'markBrowserEvidenceStale', 'captureBrowserEvidence'], 'browser evidence generation');
  includesAll(app, [
    'turnSerial: snapshot.turnSerial',
    'deterministicEvidenceStale',
    'browserEvidenceStale',
    'markBrowserEvidenceStale',
    'clearBrowserEvidenceBuffer',
    'captureBrowserEvidence',
    'BrowserEvidencePanel',
  ], 'product evidence orchestration');
});

test('alpha4 release only runs on deliberate version/release changes', async () => {
  const [pkg, cargo, tauri, version, release, entry] = await Promise.all([
    source('package.json'),
    source('src-tauri/Cargo.toml'),
    source('src-tauri/tauri.conf.json'),
    source('src/version.ts'),
    readFile(new URL('../../../.github/workflows/monument-intel-alpha-release.yml', import.meta.url), 'utf8'),
    source('src/main.tsx'),
  ]);

  assert.equal(JSON.parse(pkg).version, '0.2.0-alpha.4');
  assert.match(cargo, /version = "0\.2\.0-alpha\.4"/);
  assert.equal(JSON.parse(tauri).version, '0.2.0-alpha.4');
  assert.ok(version.includes("0.2.0-alpha.4"));
  assert.ok(release.includes("MONUMENT_VERSION: '0.2.0-alpha.4'"));
  assert.ok(release.includes("monument-v0.2.0-alpha.4-intel"));
  assert.ok(release.includes("apps/desktop/package.json"));
  assert.ok(release.includes("apps/desktop/src/version.ts"));
  assert.ok(!release.includes("'apps/desktop/**'"));
  assert.ok(entry.includes("./styles/browser-evidence.css"));
});
