import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const build = await readFile(new URL('../src-tauri/build.rs', import.meta.url), 'utf8');
const lib = await readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8');
const tokens = await readFile(new URL('../src-tauri/src/visual_tokens.rs', import.meta.url), 'utf8');
const mainCapability = JSON.parse(await readFile(new URL('../src-tauri/capabilities/main-capability.json', import.meta.url), 'utf8'));
const previewCapability = JSON.parse(await readFile(new URL('../src-tauri/capabilities/preview-editor-capability.json', import.meta.url), 'utf8'));

test('token plan/apply commands stay main-only', () => {
  for (const command of ['visual_token_plan', 'visual_token_apply']) {
    assert.ok(build.includes(`"${command}"`));
    assert.ok(lib.includes(command));
    const permission = `allow-${command.replaceAll('_', '-')}`;
    assert.ok(mainCapability.permissions.includes(permission));
    assert.ok(!previewCapability.permissions.includes(permission));
  }
});

test('token v1 proves exact id reference and one literal root definition before scope choice', () => {
  for (const token of [
    'exact_var_reference',
    'rule.selector.trim() != expected_selector',
    'rule.at_rule_depth > 0',
    'rule.selector.trim() != ":root"',
    'declaration.value.contains("var(")',
    'normalized_literal(&declaration.value) != normalized_literal(&before)',
    'references.len() != 1',
    'definitions.len() != 1',
    'status: "scope-choice".into()',
    'scope_plan("element"',
    'scope_plan("token"',
  ]) assert.ok(tokens.includes(token), `token proof contract missing ${token}`);
});

test('element detach and global token writes replan and use guarded atomic source writes', () => {
  for (const token of [
    'let response = plan_internal(&input.request)?',
    'Visual token source changed after dry-run. Re-plan before applying.',
    'fingerprint(&bytes) != plan.file_fingerprint',
    'ensure_no_symlink_path',
    'create_new(true)',
    'file.sync_all()',
    'fs::rename(&temp, path)',
    'applies_only_the_selected_scope_and_replans_stale_source',
    'applies_global_token_scope_without_detaching_reference',
  ]) assert.ok(tokens.includes(token), `token apply contract missing ${token}`);
});

test('fallback/nested/scoped/token-chain ambiguity stays out of deterministic token path', () => {
  for (const token of [
    'inner.contains(\',\')',
    'token_scope_conflict = true',
    'id_property_conflict = true',
    'refuses_fallback_nested_scoped_or_mismatched_tokens',
  ]) assert.ok(tokens.includes(token), `token fallback contract missing ${token}`);
});
