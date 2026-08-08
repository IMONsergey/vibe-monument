import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const build = await readFile(new URL('../src-tauri/build.rs', import.meta.url), 'utf8');
const lib = await readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8');
const source = await readFile(new URL('../src-tauri/src/visual_source.rs', import.meta.url), 'utf8');
const mainCapability = JSON.parse(await readFile(new URL('../src-tauri/capabilities/main-capability.json', import.meta.url), 'utf8'));
const previewCapability = JSON.parse(await readFile(new URL('../src-tauri/capabilities/preview-editor-capability.json', import.meta.url), 'utf8'));

test('deterministic visual source commands are main-only', () => {
  for (const command of ['visual_source_plan', 'visual_source_apply']) {
    assert.ok(build.includes(`"${command}"`));
    assert.ok(lib.includes(command));
    const permission = `allow-${command.replaceAll('_', '-')}`;
    assert.ok(mainCapability.permissions.includes(permission), `main capability missing ${permission}`);
    assert.ok(!previewCapability.permissions.includes(permission), `preview must not receive ${permission}`);
  }
});

test('literal CSS v1 requires exact stable id ownership and refuses ambiguous/shared scope', () => {
  for (const token of [
    'Deterministic CSS v1 requires a stable element id',
    'selector.contains(\',\')',
    'selector.contains(\':\')',
    'token_contains_id(rightmost, id)',
    'normalized_literal(value) != normalized_literal(observed_before)',
    'value.contains("var(")',
    'matches.len() != 1',
    'status: "ambiguous".into()',
  ]) assert.ok(source.includes(token), `literal CSS owner contract missing ${token}`);
});

test('deterministic source mutation re-plans and enforces stale-source/path boundaries', () => {
  for (const token of [
    'let response = plan_internal(&input.request)?',
    'Visual source changed after dry-run. Re-plan before applying.',
    'fingerprint(&bytes) != plan.file_fingerprint',
    'ensure_no_symlink_path',
    '!canonical.starts_with(root)',
    'create_new(true)',
    'file.sync_all()',
    'fs::rename(&temp, path)',
  ]) assert.ok(source.includes(token), `source mutation safety contract missing ${token}`);
  assert.ok(!source.includes('Regex'));
  assert.ok(!source.includes('regex::'));
  assert.ok(!source.includes('std::process::Command'));
});

test('literal CSS values cannot break declaration structure', () => {
  for (const token of [
    'fn css_value_is_balanced',
    'ch.is_control()',
    "'(' => parens += 1",
    "'[' => brackets += 1",
    'value.contains("/*")',
    'value.contains("*/")',
    "'\\\\' => return false",
    'rejects_malformed_or_breakout_css_values',
    'accepts_balanced_literal_css_values',
    'clean_value("32px; color: red").is_err()',
    'clean_value("32px} body { color: red").is_err()',
    'clean_value("foo\\\\bar").is_err()',
  ]) assert.ok(source.includes(token), `CSS literal safety contract missing ${token}`);
});
