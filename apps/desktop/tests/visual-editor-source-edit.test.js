import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const intent = await readFile(new URL('../src/editor/intent.ts', import.meta.url), 'utf8');
const ownership = await readFile(new URL('../src/editor/ownership.ts', import.meta.url), 'utf8');
const properties = await readFile(new URL('../src/editor/PropertiesPanel.tsx', import.meta.url), 'utf8');
const layer = await readFile(new URL('../src/editor/VisualEditorLayer.tsx', import.meta.url), 'utf8');
const editorTypes = await readFile(new URL('../src/editor/types.ts', import.meta.url), 'utf8');
const editorController = await readFile(new URL('../src/editor/controller.ts', import.meta.url), 'utf8');
const editorScript = await readFile(new URL('../src-tauri/src/preview_editor_script.rs', import.meta.url), 'utf8');

test('visual property Apply tries deterministic source editing and preserves the Codex fallback', () => {
  assert.ok(intent.includes("project_source_transaction_preview"));
  assert.ok(intent.includes("project_source_transaction_commit"));
  assert.ok(intent.includes("plan.mode === 'deterministic'"));
  assert.ok(intent.includes('checkpointVisualSourceTransaction'));
  assert.ok(intent.includes('recordSourceTransactionCheckpoint'));
  assert.ok(intent.includes('markBrowserEvidenceStale'));
  assert.ok(intent.includes('enqueuePrompt(project.id, instruction(selection, changes), selection, null)'));
  assert.ok(intent.includes('loadPromptQueue(project.id, false)'));
  assert.ok(intent.includes('setPromptQueuePaused(project.id, false)'));
  assert.ok(intent.includes('Source code is authoritative'));
  assert.ok(intent.includes('Normal Codex approvals remain authoritative'));
  assert.ok(!intent.includes('preview_editor_select'));
  assert.ok(!intent.includes('preview_editor_emit'));
  assert.ok(!intent.includes('.style.'));
  assert.ok(!intent.includes('setAttribute('));
});

test('Properties exposes useful Framer-like fields and explains deterministic Apply', () => {
  for (const token of [
    "key: 'width', editable: true",
    "key: 'paddingTop', editable: true",
    "key: 'gap', editable: true",
    "key: 'fontFamily', editable: true",
    "key: 'fontSize', editable: true",
    "key: 'color', editable: true",
    "key: 'backgroundColor', editable: true",
    "key: 'border', editable: true",
    "key: 'borderRadius', editable: true",
    "key: 'boxShadow', editable: true",
    "key: 'opacity', editable: true",
    'Source-authoritative editing',
    'bounded atomic source transaction',
    'automatically fall back to the normal Codex path',
    'property-apply-bar',
    'await onApply(changes)',
    "applying ? 'Applying…' : 'Apply'",
  ]) assert.ok(properties.includes(token), `Properties contract missing ${token}`);
});

test('direct text edit is bounded, complete and disabled when runtime text was truncated', () => {
  assert.ok(editorTypes.includes('directText: string'));
  assert.ok(editorTypes.includes('directTextTruncated: boolean'));
  assert.ok(editorController.includes('directText: clipped(source.directText, 1200)'));
  assert.ok(editorController.includes('directTextTruncated: source.directTextTruncated === true'));
  assert.ok(editorScript.includes('MAX_DIRECT_TEXT = 1200'));
  assert.ok(editorScript.includes('directTextTruncated: rawDirectText.length > MAX_DIRECT_TEXT'));
  assert.ok(properties.includes('!selection.directTextTruncated'));
  assert.ok(properties.includes('selection.directText'));
  assert.ok(properties.includes('Direct text exceeds the safe editor limit'));
});

test('source ownership UI remains a confidence signal while direct mutations require native proof', () => {
  assert.ok(ownership.includes("level: 'likely' | 'possible' | 'weak' | 'unknown'"));
  assert.ok(ownership.includes("invokeNative<unknown[]>('project_source_hints'"));
  assert.ok(ownership.includes('Monument still verifies ownership before editing.'));
  assert.ok(ownership.includes('Weak source signal'));
  assert.ok(layer.includes('locateEditorSource'));
  assert.ok(layer.includes('applyVisualPropertyEdit'));
  assert.ok(layer.includes('Promise<boolean>'));
});
