import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const main = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
const host = await readFile(new URL('../src/editor/VisualTokenCoordinatorHost.tsx', import.meta.url), 'utf8');
const layer = await readFile(new URL('../src/editor/VisualEditorLayer.tsx', import.meta.url), 'utf8');
const properties = await readFile(new URL('../src/editor/PropertiesPanel.tsx', import.meta.url), 'utf8');
const router = await readFile(new URL('../src-tauri/src/visual_source_router.rs', import.meta.url), 'utf8');

test('token coordinator is active but delegates commit to the one App source coordinator', () => {
  assert.ok(main.includes('VisualTokenCoordinatorHost'));
  assert.ok(host.includes('registerVisualTokenCoordinator(coordinator())'));
  assert.ok(host.includes('commitVisualSourceEdit(asSourceTransaction(prepared, scope))'));
  assert.ok(!host.includes("invokeNative<VisualTokenApplyResult>('visual_token_apply'"));
  assert.ok(!host.includes('saveTimelineVersion'));
  assert.ok(!host.includes('runVerification'));
  assert.ok(!host.includes('captureBrowserEvidence'));
});

test('token scope is encoded as a bounded readable source operation for App rollback/history', () => {
  assert.ok(host.includes("`${change.property} · ${scope === 'element' ? 'detach' : 'token'} ${tokenName}`"));
  assert.ok(host.includes('before: selected.beforeSource'));
  assert.ok(host.includes('after: selected.afterSource'));
  assert.ok(host.includes('before: prepared.change.before'));
  assert.ok(router.includes('const TOKEN_MARKER: &str = " · token ";'));
  assert.ok(router.includes('const DETACH_MARKER: &str = " · detach ";'));
  assert.ok(router.includes('safe_token(token_name)'));
});

test('router re-proves selected token scope and preserves element-detach rollback through literal CSS', () => {
  for (const token of [
    'string_field(response, "status").as_deref() != Some("scope-choice")',
    'string_field(response, "tokenName").as_deref() != Some(routed.token_name.as_str())',
    'scope_plan(response, routed.scope)',
    'request.after.trim() == exact_var(&routed.token_name)',
    'normal_source_plan(source_request_value(request, &routed.original_property))',
    'normal_source_apply(json!({',
    'token_apply(json!({',
  ]) assert.ok(router.includes(token), `token source router missing ${token}`);
});

test('Properties makes token blast radius explicit before source apply', () => {
  assert.ok(layer.includes('planVisualTokenEdit'));
  assert.ok(layer.includes('setTokenScope(\'element\')'));
  assert.ok(layer.includes('commitVisualTokenEdit(preparedTokenEdit, tokenScope)'));
  for (const token of [
    'Design token',
    'This element',
    'Detach token here',
    'Global source change',
    'usageCount',
    'Apply source',
    'Use Codex',
  ]) assert.ok(properties.includes(token), `token scope UX missing ${token}`);
});
