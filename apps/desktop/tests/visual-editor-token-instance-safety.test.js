import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const nativeToken = await readFile(new URL('../src-tauri/src/token_transaction.rs', import.meta.url), 'utf8');
const previewEditor = await readFile(new URL('../src-tauri/src/preview_editor_script.rs', import.meta.url), 'utf8');
const tokenClient = await readFile(new URL('../src/editor/tokenEditing.ts', import.meta.url), 'utf8');
const editorController = await readFile(new URL('../src/editor/controller.ts', import.meta.url), 'utf8');
const selection = await readFile(new URL('../src/preview/selection.ts', import.meta.url), 'utf8');

test('live preview proves id uniqueness before single-element editing', () => {
  assert.ok(previewEditor.includes('function uniqueId(element)'));
  assert.ok(previewEditor.includes('document.querySelectorAll'));
  assert.ok(previewEditor.includes('idUnique: uniqueId(element)'));
  assert.ok(selection.includes('idUnique?: boolean'));
  assert.ok(editorController.includes('idUnique: Boolean(id && source.idUnique === true)'));
  assert.ok(tokenClient.includes('idUnique: selection.idUnique === true'));
});

test('native instance transaction independently requires unique id ownership', () => {
  assert.ok(nativeToken.includes('id_unique: bool'));
  assert.ok(nativeToken.includes('selection.id_unique'));
  assert.ok(nativeToken.includes('source.selector_score >= 100'));
  assert.ok(nativeToken.includes('unique live DOM id'));
  assert.ok(nativeToken.includes('class_owned_rule_is_not_a_single_element_edit'));
  assert.ok(nativeToken.includes('duplicate_live_id_is_not_a_single_element_edit'));
  assert.ok(nativeToken.includes('instance_transaction_detaches_only_unique_id_rule'));
});
