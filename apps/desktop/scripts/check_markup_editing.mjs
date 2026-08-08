import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const jsxSource = await readFile(join(root, 'src-tauri/src/jsx_source.rs'), 'utf8');
const markup = await readFile(join(root, 'src-tauri/src/markup_transaction_v2.rs'), 'utf8');
const guard = await readFile(join(root, 'src-tauri/src/markup_conflict_guard.rs'), 'utf8');
const tauriLib = await readFile(join(root, 'src-tauri/src/lib.rs'), 'utf8');
const tauriBuild = await readFile(join(root, 'src-tauri/build.rs'), 'utf8');
const capability = JSON.parse(await readFile(join(root, 'src-tauri/capabilities/main-capability.json'), 'utf8'));
const client = await readFile(join(root, 'src/editor/markupEditing.ts'), 'utf8');
const properties = await readFile(join(root, 'src/editor/PropertiesPanel.tsx'), 'utf8');
const intent = await readFile(join(root, 'src/editor/intent.ts'), 'utf8');
const styles = await readFile(join(root, 'src/styles/visual-editor-editing.css'), 'utf8');

for (const command of [
  'project_markup_edit_probe',
  'project_markup_conflict_guard',
  'project_markup_transaction_preview',
  'project_markup_transaction_commit',
]) {
  if (!tauriLib.includes(command)) throw new Error(`Markup runtime registration missing ${command}`);
  if (!tauriBuild.includes(`"${command}"`)) throw new Error(`Tauri app manifest missing ${command}`);
  const permission = `allow-${command.replaceAll('_', '-')}`;
  if (!capability.permissions?.includes(permission)) throw new Error(`Trusted main capability missing ${permission}`);
}
if (JSON.stringify(capability.webviews) !== JSON.stringify(['main'])) {
  throw new Error('Markup source-write/guard permissions must remain scoped to the trusted main webview');
}
if (!tauriLib.includes('mod markup_transaction_v2;') || tauriLib.includes('mod markup_transaction;')) {
  throw new Error('Only the hardened markup transaction engine may be compiled');
}
if (!tauriLib.includes('mod markup_conflict_guard;')) {
  throw new Error('Independent Tailwind conflict guard must remain compiled');
}

for (const token of [
  'MAX_OPENING_TAG_BYTES', 'MAX_ATTRIBUTES_PER_TAG', 'skip_closing_tag',
  'ignores_jsx_shaped_strings_comments_and_templates',
  'bare_slash_syntax_refuses_the_file_instead_of_risking_regex_false_positive',
]) {
  if (!jsxSource.includes(token)) throw new Error(`Bounded JSX scanner missing ${token}`);
}
if (jsxSource.includes('Regex')) throw new Error('JSX scanner must not introduce blind regex source ownership');

for (const token of [
  'MAX_MARKUP_FILES', 'MAX_FILE_BYTES', 'MAX_TOTAL_BYTES', 'MAX_VALUE_BYTES',
  'selection.id_unique', 'real_dom_tag', 'attribute spread', 'literal-tailwind-utility',
  'Responsive/state Tailwind ownership', 'theme/config', 'jsx-inline-style-literal',
  'Inline style object contains a spread', 'padding_conflict', 'margin_conflict',
  'gap-x-', 'overflow-x-', 'fingerprint(&content)', 'fs::symlink_metadata',
  'canonical.starts_with(&root)', '.create_new(true)', 'file.sync_all()', 'fs::rename(&temp, path)',
  'Updated JSX/TSX failed bounded opening-tag structural validation',
  'shorthand_and_axis_utilities_block_side_or_gap_edit',
]) {
  if (!markup.includes(token)) throw new Error(`Hardened markup transaction missing ${token}`);
}
if (markup.includes('sh -c') || markup.includes('bash -c') || markup.includes('Regex')) {
  throw new Error('Markup editing must not use blind regex or interpolated shell mutation');
}

for (const token of [
  'MAX_GUARD_FILES', 'MAX_TOTAL_BYTES', 'multi_property_conflict',
  'size-', 'place-items-', 'place-content-', 'sr-only', 'not-sr-only', 'truncate', 'line-clamp-',
  'table-caption', 'list-item', 'container',
  'size_utility_conflicts_with_width_and_height_owner',
  'place_shorthands_conflict_with_alignment_owner',
  'accessibility_and_text_helpers_conflict_with_multiple_properties',
  'full_display_family_is_counted_as_competing_ownership',
]) {
  if (!guard.includes(token)) throw new Error(`Independent Tailwind conflict guard missing ${token}`);
}
if (guard.includes('sh -c') || guard.includes('bash -c') || guard.includes('Regex')) {
  throw new Error('Tailwind conflict guard must remain bounded and parser-based');
}

for (const token of [
  'nativeMarkupProbe', 'inlineStyleBlocksStylesheetFallback',
  "markup.operation?.lane === 'jsx-style'", "'project_source_transaction_preview'",
  'competingCssOwnership', "cssPlan.mode !== 'codex'",
  'nativeTailwindConflictGuard', "'project_markup_conflict_guard'",
  'validateTailwindDirectLane', 'exactDirectProbe',
  "'project_markup_edit_probe'", "'project_markup_transaction_preview'", "'project_markup_transaction_commit'",
  'idUnique: selection.idUnique === true',
]) {
  if (!client.includes(token)) throw new Error(`Markup client ownership contract missing ${token}`);
}
if (!client.includes('CSS ownership preflight unavailable:')) {
  throw new Error('Unknown CSS ownership must fail closed before Tailwind direct editing');
}
if (!client.includes('Tailwind conflict guard unavailable:')) {
  throw new Error('Unavailable Tailwind conflict guard must fail closed');
}
const previewGuard = client.indexOf('export async function previewVisualMarkupTransaction');
const commitGuard = client.indexOf('export async function commitVisualMarkupTransaction');
if (!(previewGuard >= 0 && client.indexOf('const exact = await exactDirectProbe', previewGuard) > previewGuard)) {
  throw new Error('Markup dry-run must re-run exact ownership + conflict proof');
}
if (!(commitGuard >= 0 && client.indexOf('const exact = await exactDirectProbe', commitGuard) > commitGuard)) {
  throw new Error('Markup commit path must re-run exact ownership + conflict proof');
}

for (const token of [
  'Source-native', 'Tailwind utility', 'JSX inline style', 'Apply to source', 'Use Codex',
  'property-markup-card', 'property-markup-diff', 'probeVisualMarkupEdit',
  'Bounded token evidence truncated · Codex fallback required',
  'Direct token mutation is disabled; Apply will use Codex.',
]) {
  if (!properties.includes(token)) throw new Error(`Properties markup/token safety UX missing ${token}`);
}
if (!styles.includes('.property-markup-card') || !styles.includes('.property-markup-actions')) {
  throw new Error('Markup editing styles are missing');
}

for (const token of [
  'previewVisualMarkupTransaction', 'commitVisualMarkupTransaction', 'finishDirectVisualEdit',
  'checkpointVisualSourceTransaction', 'markBrowserEvidenceStale', 'recordSourceTransactionCheckpoint',
  "window.dispatchEvent(new CustomEvent('monument:source-transaction'", "sourceLane: 'tailwind' | 'jsx-style' | null",
]) {
  if (!intent.includes(token)) throw new Error(`Markup generation/evidence handoff missing ${token}`);
}

console.log('Monument hardened Tailwind + JSX source editing contract: PASS');
