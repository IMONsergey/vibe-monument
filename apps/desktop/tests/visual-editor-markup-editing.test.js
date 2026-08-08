import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const jsxSource = await readFile(new URL('../src-tauri/src/jsx_source.rs', import.meta.url), 'utf8');
const markup = await readFile(new URL('../src-tauri/src/markup_transaction.rs', import.meta.url), 'utf8');
const tauriLib = await readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8');
const tauriBuild = await readFile(new URL('../src-tauri/build.rs', import.meta.url), 'utf8');
const capability = await readFile(new URL('../src-tauri/capabilities/main-capability.json', import.meta.url), 'utf8');
const client = await readFile(new URL('../src/editor/markupEditing.ts', import.meta.url), 'utf8');
const properties = await readFile(new URL('../src/editor/PropertiesPanel.tsx', import.meta.url), 'utf8');
const intent = await readFile(new URL('../src/editor/intent.ts', import.meta.url), 'utf8');
const visualLayer = await readFile(new URL('../src/editor/VisualEditorLayer.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/styles/visual-editor-editing.css', import.meta.url), 'utf8');

test('bounded JSX scanner excludes non-code lookalikes and ambiguous slash syntax', () => {
  for (const token of [
    'MAX_OPENING_TAG_BYTES',
    'MAX_ATTRIBUTES_PER_TAG',
    'line_comment',
    'block_comment',
    "matches!(byte, b'\\'' | b'\"' | b'`')",
    'skip_closing_tag',
    'return Vec::new()',
    'ignores_jsx_shaped_strings_comments_and_templates',
    'closing_tags_do_not_hide_later_duplicate_opening_tags',
    'bare_slash_syntax_refuses_the_file_instead_of_risking_regex_false_positive',
  ]) assert.ok(jsxSource.includes(token), `JSX scanner contract missing ${token}`);
  assert.ok(jsxSource.includes('JSX expression contains unsupported slash syntax'));
});

test('markup ownership is bounded to one literal DOM source owner', () => {
  for (const token of [
    'MAX_MARKUP_FILES',
    'MAX_FILE_BYTES',
    'MAX_TOTAL_BYTES',
    'selection.id_unique',
    'direct_dom_tag',
    'literal JSX/TSX DOM owner',
    'element.tag.has_spread',
    'duplicate id/class/style attributes',
    'Multiple JSX/TSX elements use the selected literal id',
  ]) assert.ok(markup.includes(token), `markup ownership contract missing ${token}`);
  assert.ok(markup.includes('M2.3 direct markup editing is limited to real DOM elements, not custom components.'));
});

test('Tailwind direct editing only mutates statically proven non-variant utilities', () => {
  for (const token of [
    'literal-tailwind-utility',
    'static literal className/class attribute',
    'responsive/state Tailwind variant',
    'Important-modifier Tailwind ownership',
    'theme/config/runtime semantics',
    'Requested value cannot be represented by the bounded deterministic Tailwind grammar',
    'replaces_proven_arbitrary_tailwind_utility',
    'named_theme_spacing_utility_is_not_blindly_replaced',
    'responsive_tailwind_variant_is_refused',
  ]) assert.ok(markup.includes(token), `Tailwind contract missing ${token}`);
  assert.ok(!markup.includes('Regex'));
});

test('JSX inline style direct editing refuses dynamic ownership', () => {
  for (const token of [
    'jsx-inline-style-literal',
    'static object expression',
    'inline style object contains a spread',
    'computed/non-literal key',
    'not a bounded string/number literal',
    'replaces_matching_jsx_inline_style_literal',
    'style_spread_refuses_tailwind_fallback',
  ]) assert.ok(markup.includes(token), `JSX style contract missing ${token}`);
});

test('markup writes are fingerprinted, root-contained and atomic', () => {
  for (const token of [
    'file_fingerprint',
    'fs::symlink_metadata',
    'canonical.starts_with(&root)',
    '.create_new(true)',
    'file.sync_all()',
    'fs::rename(&temp, path)',
    'Source changed after markup transaction resolution',
    'Markup source value changed after resolution',
    'Updated JSX/TSX failed bounded opening-tag structural validation',
  ]) assert.ok(markup.includes(token), `markup write boundary missing ${token}`);
  assert.ok(!markup.includes('sh -c'));
  assert.ok(!markup.includes('bash -c'));
});

test('markup commands remain privileged-main only', () => {
  for (const command of [
    'project_markup_edit_probe',
    'project_markup_transaction_preview',
    'project_markup_transaction_commit',
  ]) {
    assert.ok(tauriLib.includes(command), `lib.rs missing ${command}`);
    assert.ok(tauriBuild.includes(`"${command}"`), `build.rs missing ${command}`);
    assert.ok(capability.includes(`allow-${command.replaceAll('_', '-')}`), `main capability missing ${command}`);
  }
  assert.ok(capability.includes('"webviews": ["main"]'));
});

test('CSS ownership outranks Tailwind and JSX ownership', () => {
  assert.ok(client.includes("'project_source_transaction_preview'"));
  assert.ok(client.includes("cssPlan.mode !== 'codex'"));
  assert.ok(client.indexOf('competingCssOwnership') < client.indexOf("'project_markup_edit_probe'"));
});

test('Properties exposes exact JSX/Tailwind source lane and Codex escape hatch', () => {
  for (const token of [
    'Source-native',
    'Tailwind utility',
    'JSX inline style',
    'Apply to source',
    'Use Codex',
    'property-markup-card',
    'property-markup-diff',
    'Inspecting source ownership',
  ]) assert.ok(properties.includes(token), `Properties markup UX missing ${token}`);
  assert.ok(properties.includes('probeVisualMarkupEdit'));
  assert.ok(styles.includes('.property-markup-card'));
  assert.ok(styles.includes('.property-markup-actions'));
});

test('markup direct edits converge on existing visual generation and evidence chain', () => {
  const preview = intent.indexOf('previewVisualMarkupTransaction');
  const commit = intent.indexOf('commitVisualMarkupTransaction');
  const finish = intent.indexOf('finishDirectVisualEdit', commit);
  assert.ok(preview >= 0 && commit > preview && finish > commit);
  assert.ok(intent.includes('checkpointVisualSourceTransaction'));
  assert.ok(intent.includes('markBrowserEvidenceStale'));
  assert.ok(intent.includes('recordSourceTransactionCheckpoint'));
  assert.ok(intent.includes("window.dispatchEvent(new CustomEvent('monument:source-transaction'"));
  assert.ok(intent.includes("sourceLane: 'tailwind' | 'jsx-style' | null"));
  assert.ok(visualLayer.includes("result.sourceLane === 'tailwind'"));
});

test('literal CSS, token and Codex lanes remain available beside M2.3', () => {
  assert.ok(intent.includes("'project_source_transaction_preview'"));
  assert.ok(intent.includes('previewVisualTokenTransaction'));
  assert.ok(intent.includes('queueVisualPropertyEdit'));
  assert.ok(properties.includes('tokenProbe'));
  assert.ok(properties.includes('markupProbe'));
});
