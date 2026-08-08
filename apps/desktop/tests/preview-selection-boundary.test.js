import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const selection = await readFile(new URL('../src/preview/selection.ts', import.meta.url), 'utf8');
const editorScript = await readFile(new URL('../src-tauri/src/preview_editor_script.rs', import.meta.url), 'utf8');

test('all live selection context is normalized before entering prompt state', () => {
  for (const token of [
    'normalizePreviewSelection(selection)',
    'clipped(selection.url, 2048)',
    '.slice(0, 12)',
    'clipped(selection.text, 480)',
    'clipped(selection.selector, 1200)',
    '.slice(0, 48)',
    'clipped(value, 500)',
    'const normalized = normalizePreviewSelection(selection)',
  ]) assert.ok(selection.includes(token), `selection boundary missing ${token}`);
});

test('editor observer ignores Monument overlays and refreshes current computed selection after product mutation', () => {
  assert.ok(editorScript.includes("records.some((record) => !editorNode(record.target))"));
  assert.ok(editorScript.includes("send('selection', selectionPayload(selectedElement))"));
  assert.ok(editorScript.includes("selectedElement instanceof Element && selectedElement.isConnected"));
});
