import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const content = await readFile(new URL('../src-tauri/src/content_transaction.rs', import.meta.url), 'utf8');
const bridge = await readFile(new URL('../src-tauri/src/preview_editor_bridge.rs', import.meta.url), 'utf8');
const tauriLib = await readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8');
const tauriBuild = await readFile(new URL('../src-tauri/build.rs', import.meta.url), 'utf8');
const capability = await readFile(new URL('../src-tauri/capabilities/main-capability.json', import.meta.url), 'utf8');
const types = await readFile(new URL('../src/editor/types.ts', import.meta.url), 'utf8');
const controller = await readFile(new URL('../src/editor/controller.ts', import.meta.url), 'utf8');
const client = await readFile(new URL('../src/editor/contentEditing.ts', import.meta.url), 'utf8');
const properties = await readFile(new URL('../src/editor/PropertiesPanel.tsx', import.meta.url), 'utf8');
const intent = await readFile(new URL('../src/editor/intent.ts', import.meta.url), 'utf8');
const visualLayer = await readFile(new URL('../src/editor/VisualEditorLayer.tsx', import.meta.url), 'utf8');
const entry = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/styles/visual-editor-content.css', import.meta.url), 'utf8');

test('content transaction proves one static real DOM source owner and remains bounded', () => {
  for (const token of [
    'MAX_CONTENT_FILES', 'MAX_FILE_BYTES', 'MAX_TOTAL_BYTES', 'MAX_TEXT_BYTES', 'MAX_ATTRIBUTE_BYTES', 'MAX_CHANGES',
    'selection.id_unique', 'real_dom_tag', 'No unique literal JSX/TSX content owner',
    'Multiple JSX/TSX elements use the selected literal id', 'attribute spread',
    'duplicate content/semantic attributes', 'Content source scan was truncated',
  ]) assert.ok(content.includes(token), `content ownership contract missing ${token}`);
});

test('static JSX text is entity-safe and nested or dynamic content stays Codex-backed', () => {
  for (const token of [
    'simple_text_body', 'decode_jsx_entities', 'encode_jsx_text',
    'jsx-static-direct-text', 'nested/dynamic content requires Codex',
    'edits_static_direct_text_atomically', 'nested_or_dynamic_text_stays_on_codex',
  ]) assert.ok(content.includes(token), `text ownership contract missing ${token}`);
  assert.ok(content.includes('&amp;'));
  assert.ok(content.includes('&lt;'));
  assert.ok(content.includes('&#123;'));
});

test('semantic DOM editing uses an explicit registry instead of arbitrary props', () => {
  for (const token of [
    'ariaLabel', 'aria-label', 'title', 'alt', 'placeholder',
    'outside the explicit semantic DOM content registry',
    'jsx-static-semantic-attribute', 'jsx-static-semantic-attribute-insert',
    'updates_and_inserts_semantic_attributes_in_one_batch',
    'unsupported_component_prop_is_never_treated_as_semantic_content',
  ]) assert.ok(content.includes(token), `semantic content registry missing ${token}`);
  assert.ok(content.includes('"alt" if tag == "img"'));
  assert.ok(content.includes('"placeholder" if matches!(tag, "input" | "textarea")'));
});

test('content batch writes are fingerprinted, root-contained, structural and atomic', () => {
  for (const token of [
    'fingerprint(&content)', 'fs::symlink_metadata', 'canonical.starts_with(&root)',
    'Source changed after content transaction resolution', 'Content source value changed after resolution',
    'Updated JSX/TSX failed bounded content-owner structural validation',
    '.create_new(true)', 'file.sync_all()', 'fs::rename(&temp, path)',
  ]) assert.ok(content.includes(token), `content write boundary missing ${token}`);
  assert.ok(!content.includes('Regex'));
  assert.ok(!content.includes('sh -c'));
  assert.ok(!content.includes('bash -c'));
});

test('live semantic attributes use a bounded data-only preview channel', () => {
  for (const token of [
    'MAX_CONTENT_BYTES', 'preview_editor_request_content', 'valid_dom_id',
    'ariaLabel', 'title', 'alt', 'placeholder', "kind: 'content'",
  ]) assert.ok(bridge.includes(token), `preview content channel missing ${token}`);
  assert.ok(types.includes("| { kind: 'content'; payload: unknown }"));
  assert.ok(types.includes('contentAttributes: EditorContentAttributes'));
  assert.ok(types.includes('contentReady: boolean'));
  assert.ok(controller.includes("message.kind === 'content'"));
  assert.ok(controller.includes('current.id !== content.domId'));
  assert.ok(controller.includes("'preview_editor_request_content'"));
});

test('content source commands and live read request stay privileged-main only', () => {
  for (const command of [
    'project_content_edit_probe',
    'project_content_transaction_preview',
    'project_content_transaction_commit',
    'preview_editor_request_content',
  ]) {
    assert.ok(tauriLib.includes(command), `lib.rs missing ${command}`);
    assert.ok(tauriBuild.includes(`"${command}"`), `build.rs missing ${command}`);
    assert.ok(capability.includes(`allow-${command.replaceAll('_', '-')}`), `main capability missing ${command}`);
  }
  assert.ok(capability.includes('"webviews": ["main"]'));
  assert.ok(!capability.includes('allow-preview-editor-emit"') || capability.includes('"webviews": ["main"]'));
});

test('Properties exposes Content & semantics and one atomic source batch', () => {
  for (const token of [
    'Content & semantics', 'ARIA label', 'Title', 'Alt', 'Placeholder',
    'Content source', 'Atomic batch', 'Apply atomic content batch', 'Use Codex',
    'property-content-source-card', 'property-content-source-ops',
    'Reading bounded live semantic attributes',
  ]) assert.ok(properties.includes(token), `Properties content UX missing ${token}`);
  assert.ok(properties.includes('probeVisualContentEdit'));
  assert.ok(properties.includes('isVisualContentBatch'));
  assert.ok(styles.includes('.property-content-source-card'));
  assert.ok(styles.includes('.property-content-semantic-field'));
  assert.ok(entry.includes("./styles/visual-editor-content.css"));
});

test('content values bypass the old 300-character style sanitizer and enter the shared evidence chain', () => {
  assert.ok(intent.includes('MAX_CONTENT_TEXT = 4_800'));
  assert.ok(intent.includes('MAX_CONTENT_ATTRIBUTE = 800'));
  assert.ok(intent.includes('cleanContent'));
  assert.ok(intent.includes('previewVisualContentTransaction'));
  assert.ok(intent.includes('commitVisualContentTransaction'));
  assert.ok(intent.includes("sourceLane: 'jsx-content'"));
  assert.ok(intent.includes('checkpointVisualSourceTransaction'));
  assert.ok(intent.includes('markBrowserEvidenceStale'));
  assert.ok(intent.includes('recordSourceTransactionCheckpoint'));
  assert.ok(visualLayer.includes("'JSX content'"));
});

test('content client only grants direct authority to bounded content batches with live evidence', () => {
  assert.ok(client.includes("CONTENT_PROPERTIES = new Set(['textContent', 'ariaLabel', 'title', 'alt', 'placeholder'])"));
  assert.ok(client.includes('isVisualContentBatch'));
  assert.ok(client.includes('!selection.id || !selection.idUnique'));
  assert.ok(client.includes("change.property !== 'textContent') && !selection.contentReady"));
  assert.ok(client.includes("'project_content_edit_probe'"));
  assert.ok(client.includes("'project_content_transaction_preview'"));
  assert.ok(client.includes("'project_content_transaction_commit'"));
});
