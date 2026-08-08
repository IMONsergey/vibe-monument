import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const color = await readFile(new URL('../src-tauri/src/markup_color_v2.rs', import.meta.url), 'utf8');
const tauriLib = await readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8');
const tauriBuild = await readFile(new URL('../src-tauri/build.rs', import.meta.url), 'utf8');
const capability = await readFile(new URL('../src-tauri/capabilities/main-capability.json', import.meta.url), 'utf8');

test('hardened color foundation is bounded and proof-driven', () => {
  for (const token of [
    'MAX_FILES',
    'MAX_FILE_BYTES',
    'MAX_TOTAL_BYTES',
    'MAX_CLASS_TOKENS',
    'MAX_CLASS_TOKEN_BYTES',
    'id_unique',
    'real DOM elements',
    'attribute spread',
    'duplicate id/class/style attributes',
    'parse_hex',
    'parse_rgb',
    'hex/rgb/rgba grammar',
    'tailwind-arbitrary-color',
    'jsx-inline-color-literal',
    'theme-dependent or multiple possible color owners',
    'Responsive/state Tailwind color ownership',
    'Static color class list exceeds bounded token count',
    'fingerprint(&content)',
    'fs::symlink_metadata',
    'canonical.starts_with(&root)',
    '.create_new(true)',
    'file.sync_all()',
    'fs::rename(&temp, path)',
    'Updated JSX/TSX failed bounded color owner structural validation',
  ]) assert.ok(color.includes(token), `color foundation missing ${token}`);
  assert.ok(!color.includes('sh -c'));
  assert.ok(!color.includes('bash -c'));
  assert.ok(!color.includes('Regex'));
});

test('color foundation has native regression coverage for canonicalization and refusal cases', () => {
  for (const token of [
    'canonicalizes_hex_rgb_rgba_percent_and_alpha',
    'edits_tailwind_arbitrary_text_and_background_colors',
    'inline_color_literal_outranks_tailwind_color',
    'named_theme_multiple_variant_and_dynamic_color_owners_stay_on_codex',
    'oversized_static_color_class_list_fails_closed_as_codex',
  ]) assert.ok(color.includes(token), `color native regression missing ${token}`);
});

test('color foundation cannot accidentally become production authority without explicit wiring gate', () => {
  // This test is intentionally inverted while the module is staged. When color-v2 is promoted,
  // the promotion commit must replace this assertion with command/ACL/frontend/CI contracts.
  assert.ok(!tauriLib.includes('mod markup_color_v2;'));
  assert.ok(!tauriBuild.includes('project_markup_color_edit_probe'));
  assert.ok(!capability.includes('allow-project-markup-color-edit-probe'));
});
