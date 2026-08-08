import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const jsx = await readFile(new URL('../src-tauri/src/jsx_source.rs', import.meta.url), 'utf8');
const markup = await readFile(new URL('../src-tauri/src/markup_transaction_v2.rs', import.meta.url), 'utf8');
const hardened = await readFile(new URL('../src-tauri/src/markup_transaction_hardened.rs', import.meta.url), 'utf8');
const guard = await readFile(new URL('../src-tauri/src/markup_conflict_guard.rs', import.meta.url), 'utf8');
const tauriLib = await readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8');
const tauriBuild = await readFile(new URL('../src-tauri/build.rs', import.meta.url), 'utf8');
const capability = await readFile(new URL('../src-tauri/capabilities/main-capability.json', import.meta.url), 'utf8');
const client = await readFile(new URL('../src/editor/markupEditing.ts', import.meta.url), 'utf8');
const properties = await readFile(new URL('../src/editor/PropertiesPanel.tsx', import.meta.url), 'utf8');
const intent = await readFile(new URL('../src/editor/intent.ts', import.meta.url), 'utf8');
const visualLayer = await readFile(new URL('../src/editor/VisualEditorLayer.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/styles/visual-editor-editing.css', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('bounded JSX scanner excludes lexical false positives and ambiguous slash syntax', () => {
  for (const token of [
    'MAX_OPENING_TAG_BYTES',
    'MAX_ATTRIBUTES_PER_TAG',
    'line_comment',
    'block_comment',
    'skip_closing_tag',
    'ignores_jsx_shaped_strings_comments_and_templates',
    'closing_tags_do_not_hide_later_duplicate_opening_tags',
    'bare_slash_syntax_refuses_the_file_instead_of_risking_regex_false_positive',
    'JSX expression contains unsupported slash syntax',
  ]) assert.ok(jsx.includes(token), `JSX scanner contract missing ${token}`);
  assert.ok(jsx.includes('&tag.attribute("style").expect("style").value'));
  assert.ok(!jsx.includes('Regex::'));
});

test('production registers the hardened writer wrapper and independent guard as main-only', () => {
  assert.ok(tauriLib.includes('mod markup_transaction_hardened;'));
  assert.ok(tauriLib.includes('mod markup_conflict_guard;'));
  assert.ok(!tauriLib.includes('mod markup_transaction_v2;'));
  assert.ok(!tauriLib.includes('mod markup_transaction;'));
  assert.ok(hardened.includes('include!("markup_transaction_v2.rs")'));
  for (const command of [
    'project_markup_edit_probe',
    'project_markup_conflict_guard',
    'project_markup_transaction_preview',
    'project_markup_transaction_commit',
  ]) {
    assert.ok(tauriLib.includes(command), `lib.rs missing ${command}`);
    assert.ok(tauriBuild.includes(`"${command}"`), `build.rs missing ${command}`);
    assert.ok(capability.includes(`allow-${command.replaceAll('_', '-')}`), `main capability missing ${command}`);
  }
  assert.ok(capability.includes('"webviews": ["main"]'));
});

test('markup ownership is bounded to one literal real DOM source owner', () => {
  for (const token of [
    'MAX_MARKUP_FILES',
    'MAX_FILE_BYTES',
    'MAX_TOTAL_BYTES',
    'selection.id_unique',
    'real_dom_tag',
    'No unique literal JSX/TSX owner',
    'Multiple JSX/TSX elements use the selected literal id',
    'attribute spread',
    'duplicate id/class/style attributes',
    'custom component ownership stays on Codex',
  ]) assert.ok(markup.includes(token), `markup ownership contract missing ${token}`);
});

test('Tailwind direct editing proves semantics and refuses variants theme values and first-order shorthand conflicts', () => {
  for (const token of [
    'literal-tailwind-utility',
    'static literal className/class',
    'Responsive/state Tailwind ownership',
    'Important-modifier Tailwind ownership',
    'theme/config',
    'padding_conflict',
    'margin_conflict',
    'gap-x-',
    'gap-y-',
    'overflow-x-',
    'shorthand_and_axis_utilities_block_side_or_gap_edit',
    'theme_scale_utility_stays_on_codex',
    'responsive_variant_blocks_base_edit',
  ]) assert.ok(markup.includes(token), `Tailwind contract missing ${token}`);
  assert.ok(!markup.includes('Regex'));
});

test('independent native guard catches Tailwind multi-property competitors', () => {
  for (const token of [
    'multi_property_conflict',
    'size-',
    'place-items-',
    'place-content-',
    'sr-only',
    'not-sr-only',
    'truncate',
    'line-clamp-',
    'container',
    'table-caption',
    'list-item',
    'size_utility_conflicts_with_width_and_height_owner',
    'place_shorthands_conflict_with_alignment_owner',
    'accessibility_and_text_helpers_conflict_with_multiple_properties',
    'full_display_family_is_counted_as_competing_ownership',
  ]) assert.ok(guard.includes(token), `Tailwind conflict guard missing ${token}`);
  assert.ok(!guard.includes('Regex'));
  assert.ok(!guard.includes('sh -c'));
  assert.ok(!guard.includes('bash -c'));
});

test('native commit binds exact v2 ownership and conflict veto before fingerprinted atomic write', () => {
  for (const token of [
    'enforce_tailwind_conflict_guard',
    'project_markup_conflict_guard',
    'let resolved = resolve(&root, &selection, &change)?;',
    'Source changed while validating the Tailwind conflict guard',
    'fingerprint(&content) != expected_fingerprint',
    'write_atomic(&canonical, &content)?',
    'native_commit_refuses_hidden_size_competitor_after_v2_resolution',
    'native_commit_preserves_safe_tailwind_write',
  ]) assert.ok(hardened.includes(token), `hardened native commit missing ${token}`);

  const resolve = hardened.indexOf('let resolved = resolve(&root, &selection, &change)?;');
  const guardCall = hardened.indexOf('enforce_tailwind_conflict_guard(', resolve + 1);
  const reread = hardened.indexOf('let mut content = fs::read_to_string', guardCall);
  const fingerprint = hardened.indexOf('fingerprint(&content) != expected_fingerprint', reread);
  const write = hardened.indexOf('write_atomic(&canonical, &content)?', fingerprint);
  assert.ok(resolve >= 0 && guardCall > resolve && reread > guardCall && fingerprint > reread && write > fingerprint);
});

test('JSX inline style direct editing refuses dynamic ownership and outranks Tailwind', () => {
  for (const token of [
    'jsx-inline-style-literal',
    'style={{...}}',
    'Inline style object contains a spread',
    'computed/non-literal key',
    'not a bounded string/number literal',
    'edits_matching_inline_style_literal_before_tailwind',
    'dynamic_style_or_class_spread_has_no_write_authority',
  ]) assert.ok(markup.includes(token), `JSX style contract missing ${token}`);
});

test('markup core and hardened wrapper preserve stale-source root and atomic write boundaries', () => {
  for (const token of [
    'fingerprint(&content)',
    'fs::symlink_metadata',
    'canonical.starts_with(&root)',
    '.create_new(true)',
    'file.sync_all()',
    'fs::rename(&temp, path)',
    'Updated JSX/TSX failed bounded opening-tag structural validation',
  ]) assert.ok(markup.includes(token) || hardened.includes(token), `markup write boundary missing ${token}`);
  assert.ok(!markup.includes('sh -c'));
  assert.ok(!markup.includes('bash -c'));
  assert.ok(!hardened.includes('sh -c'));
  assert.ok(!hardened.includes('bash -c'));
});

test('frontend cascade and Tailwind conflict proof fail closed before native guarded commit', () => {
  for (const token of [
    'nativeMarkupProbe',
    'inlineStyleBlocksStylesheetFallback',
    "markup.operation?.lane === 'jsx-style'",
    'competingCssOwnership',
    'CSS ownership preflight unavailable:',
    'nativeTailwindConflictGuard',
    "'project_markup_conflict_guard'",
    'Tailwind conflict guard unavailable:',
    'validateTailwindDirectLane',
    'exactDirectProbe',
  ]) assert.ok(client.includes(token), `markup routing contract missing ${token}`);
  assert.ok(client.includes("cssPlan.mode !== 'codex'"));
});

test('dry-run and commit both re-run exact frontend proof and commit enters guarded native authority', () => {
  const preview = client.indexOf('export async function previewVisualMarkupTransaction');
  const commit = client.indexOf('export async function commitVisualMarkupTransaction');
  assert.ok(preview >= 0);
  assert.ok(commit > preview);
  assert.ok(client.indexOf('const exact = await exactDirectProbe', preview) > preview);
  assert.ok(client.indexOf('const exact = await exactDirectProbe', commit) > commit);
  assert.ok(client.indexOf("'project_markup_transaction_preview'", preview) > preview);
  assert.ok(client.indexOf("'project_markup_transaction_commit'", commit) > commit);
  assert.ok(tauriLib.includes('use markup_transaction_hardened::{project_markup_edit_probe, project_markup_transaction_commit, project_markup_transaction_preview};'));
});

test('Properties exposes exact source lane Codex escape hatch and preserves token truncation safety', () => {
  for (const token of [
    'Source-native',
    'Tailwind utility',
    'JSX inline style',
    'Apply to source',
    'Use Codex',
    'property-markup-card',
    'property-markup-diff',
    'Inspecting source ownership',
    'Bounded token evidence truncated · Codex fallback required',
    'Direct token mutation is disabled; Apply will use Codex.',
  ]) assert.ok(properties.includes(token), `Properties source ownership UX missing ${token}`);
  assert.ok(properties.includes('probeVisualMarkupEdit'));
  assert.ok(styles.includes('.property-markup-card'));
  assert.ok(styles.includes('.property-markup-actions'));
});

test('markup direct edits converge on existing visual generation and evidence chain', () => {
  const preview = intent.indexOf('const plan = await previewVisualMarkupTransaction');
  const commit = intent.indexOf('const committed = await commitVisualMarkupTransaction');
  const finish = intent.indexOf('return finishDirectVisualEdit', commit);
  assert.ok(preview >= 0 && commit > preview && finish > commit);
  assert.ok(intent.includes('checkpointVisualSourceTransaction'));
  assert.ok(intent.includes('markBrowserEvidenceStale'));
  assert.ok(intent.includes('recordSourceTransactionCheckpoint'));
  assert.ok(intent.includes("window.dispatchEvent(new CustomEvent('monument:source-transaction'"));
  assert.ok(intent.includes("sourceLane: 'tailwind' | 'jsx-style' | null"));
  assert.ok(visualLayer.includes("result.sourceLane === 'tailwind'"));
});

test('literal CSS token and Codex lanes remain available beside M2.3', () => {
  assert.ok(intent.includes("'project_source_transaction_preview'"));
  assert.ok(intent.includes('previewVisualTokenTransaction'));
  assert.ok(intent.includes('queueVisualPropertyEdit'));
  assert.ok(properties.includes('tokenProbe'));
  assert.ok(properties.includes('markupProbe'));
  assert.ok(packageJson.scripts['check:native'].includes('check_markup_editing.mjs'));
});
