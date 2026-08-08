import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const content = await readFile(join(root, 'src-tauri/src/content_transaction.rs'), 'utf8');
const bridge = await readFile(join(root, 'src-tauri/src/preview_editor_bridge.rs'), 'utf8');
const tauriLib = await readFile(join(root, 'src-tauri/src/lib.rs'), 'utf8');
const tauriBuild = await readFile(join(root, 'src-tauri/build.rs'), 'utf8');
const capability = JSON.parse(await readFile(join(root, 'src-tauri/capabilities/main-capability.json'), 'utf8'));
const types = await readFile(join(root, 'src/editor/types.ts'), 'utf8');
const controller = await readFile(join(root, 'src/editor/controller.ts'), 'utf8');
const client = await readFile(join(root, 'src/editor/contentEditing.ts'), 'utf8');
const properties = await readFile(join(root, 'src/editor/PropertiesPanel.tsx'), 'utf8');
const intent = await readFile(join(root, 'src/editor/intent.ts'), 'utf8');
const visualLayer = await readFile(join(root, 'src/editor/VisualEditorLayer.tsx'), 'utf8');
const entry = await readFile(join(root, 'src/main.tsx'), 'utf8');
const styles = await readFile(join(root, 'src/styles/visual-editor-content.css'), 'utf8');

for (const command of [
  'project_content_edit_probe',
  'project_content_transaction_preview',
  'project_content_transaction_commit',
  'preview_editor_request_content',
]) {
  if (!tauriLib.includes(command)) throw new Error(`Content runtime registration missing ${command}`);
  if (!tauriBuild.includes(`"${command}"`)) throw new Error(`Tauri app manifest missing ${command}`);
  const permission = `allow-${command.replaceAll('_', '-')}`;
  if (!capability.permissions?.includes(permission)) throw new Error(`Trusted main capability missing ${permission}`);
}
if (JSON.stringify(capability.webviews) !== JSON.stringify(['main'])) {
  throw new Error('Content source/read commands must remain scoped to the trusted main webview');
}

for (const token of [
  'MAX_CONTENT_FILES', 'MAX_FILE_BYTES', 'MAX_TOTAL_BYTES', 'MAX_TEXT_BYTES', 'MAX_ATTRIBUTE_BYTES', 'MAX_CHANGES',
  'selection.id_unique', 'real_dom_tag', 'simple_text_body', 'decode_jsx_entities', 'encode_jsx_text',
  'outside the explicit semantic DOM content registry', 'attribute spread', 'duplicate content/semantic attributes',
  'fingerprint(&content)', 'fs::symlink_metadata', 'canonical.starts_with(&root)',
  '.create_new(true)', 'file.sync_all()', 'fs::rename(&temp, path)',
  'Updated JSX/TSX failed bounded content-owner structural validation',
]) {
  if (!content.includes(token)) throw new Error(`Content transaction contract missing ${token}`);
}
if (content.includes('Regex') || content.includes('sh -c') || content.includes('bash -c')) {
  throw new Error('Content editing must not use blind regex or interpolated shell mutation');
}

for (const token of [
  'MAX_CONTENT_BYTES', 'valid_dom_id', 'preview_editor_request_content',
  "\"content\" => Ok(MAX_CONTENT_BYTES)", 'ariaLabel', 'title', 'alt', 'placeholder',
]) {
  if (!bridge.includes(token)) throw new Error(`Preview semantic read channel missing ${token}`);
}
if (!types.includes("| { kind: 'content'; payload: unknown }")) throw new Error('Editor bridge content packet type missing');
for (const token of [
  "message.kind === 'content'", 'current.id !== content.domId', 'contentReady: true',
  "invokeNative<void>('preview_editor_request_content'",
]) {
  if (!controller.includes(token)) throw new Error(`Content selection merge contract missing ${token}`);
}

for (const token of [
  "CONTENT_PROPERTIES = new Set(['textContent', 'ariaLabel', 'title', 'alt', 'placeholder'])",
  'isVisualContentBatch', "'project_content_edit_probe'", "'project_content_transaction_preview'", "'project_content_transaction_commit'",
  "change.property !== 'textContent') && !selection.contentReady",
]) {
  if (!client.includes(token)) throw new Error(`Content client contract missing ${token}`);
}

for (const token of [
  'Content & semantics', 'ARIA label', 'Title', 'Alt', 'Placeholder',
  'Content source', 'Atomic batch', 'Apply atomic content batch', 'Use Codex',
  'probeVisualContentEdit', 'isVisualContentBatch', 'Reading bounded live semantic attributes',
]) {
  if (!properties.includes(token)) throw new Error(`Properties content UX missing ${token}`);
}
if (!styles.includes('.property-content-source-card') || !styles.includes('.property-content-semantic-field')) {
  throw new Error('Content editing styles are missing');
}
if (!entry.includes("./styles/visual-editor-content.css")) throw new Error('Content editor styles are not loaded');

for (const token of [
  'MAX_CONTENT_TEXT = 4_800', 'MAX_CONTENT_ATTRIBUTE = 800', 'cleanContent',
  'previewVisualContentTransaction', 'commitVisualContentTransaction', "sourceLane: 'jsx-content'",
  'checkpointVisualSourceTransaction', 'markBrowserEvidenceStale', 'recordSourceTransactionCheckpoint',
]) {
  if (!intent.includes(token)) throw new Error(`Content generation/evidence handoff missing ${token}`);
}
if (!visualLayer.includes("'JSX content'")) throw new Error('Content direct result UX missing');

console.log('Monument source-native JSX content editing contract: PASS');
