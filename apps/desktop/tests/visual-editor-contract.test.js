import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const build = await readFile(new URL('../src-tauri/build.rs', import.meta.url), 'utf8');
const mainCapability = JSON.parse(await readFile(new URL('../src-tauri/capabilities/main-capability.json', import.meta.url), 'utf8'));
const previewCapability = JSON.parse(await readFile(new URL('../src-tauri/capabilities/preview-editor-capability.json', import.meta.url), 'utf8'));
const bridge = await readFile(new URL('../src-tauri/src/preview_editor_bridge.rs', import.meta.url), 'utf8');
const script = await readFile(new URL('../src-tauri/src/preview_editor_script.rs', import.meta.url), 'utf8');
const previewRuntime = await readFile(new URL('../src-tauri/src/preview_runtime.rs', import.meta.url), 'utf8');
const entry = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
const editorController = await readFile(new URL('../src/editor/controller.ts', import.meta.url), 'utf8');
const layers = await readFile(new URL('../src/editor/LayersPanel.tsx', import.meta.url), 'utf8');
const properties = await readFile(new URL('../src/editor/PropertiesPanel.tsx', import.meta.url), 'utf8');

function permissionFor(command) {
  return `allow-${command.replaceAll('_', '-')}`;
}

test('remote preview gets exactly one data-only app command permission', () => {
  const commandsBlock = build.match(/const APP_COMMANDS:[\s\S]*?\];/)?.[0] ?? '';
  const commands = [...commandsBlock.matchAll(/"([a-z][a-z0-9_]*)"/g)].map((match) => match[1]);
  assert.ok(commands.length > 30, 'app command ACL manifest must enumerate the native command surface');
  assert.deepEqual(mainCapability.webviews, ['main']);
  assert.equal(mainCapability.windows, undefined, 'main capability must not implicitly cover child webviews');
  assert.deepEqual(previewCapability.webviews, ['monument-preview']);
  assert.equal(previewCapability.local, false);
  assert.deepEqual(previewCapability.permissions, ['allow-preview-editor-emit']);
  assert.ok(previewCapability.remote.urls.every((url) => /^(https?):\/\/(localhost|127\.0\.0\.1):\*\/\*$/.test(url)));
  assert.ok(!previewCapability.permissions.includes('core:default'));

  for (const command of commands) {
    if (command === 'preview_editor_emit') {
      assert.ok(previewCapability.permissions.includes(permissionFor(command)));
      assert.ok(!mainCapability.permissions.includes(permissionFor(command)));
    } else {
      assert.ok(mainCapability.permissions.includes(permissionFor(command)), `main UI permission missing ${command}`);
      assert.ok(!previewCapability.permissions.includes(permissionFor(command)), `preview must not receive ${command}`);
    }
  }
});

test('visual editor bridge only ingests bounded data from the preview webview', () => {
  for (const token of [
    'webview.label() != PREVIEW_LABEL',
    'MAX_TREE_BYTES: usize = 384 * 1024',
    'MAX_SELECTION_BYTES: usize = 64 * 1024',
    'MAX_MESSAGES_PER_SECOND: u32 = 180',
    '"tree" => Ok(MAX_TREE_BYTES)',
    '"selection" => Ok(MAX_SELECTION_BYTES)',
    '"hover" => Ok(MAX_HOVER_BYTES)',
    '"ready" => Ok(MAX_READY_BYTES)',
  ]) assert.ok(bridge.includes(token), `bridge missing ${token}`);
  assert.ok(!bridge.includes('std::process::Command'));
  assert.ok(!bridge.includes('std::fs::'));
});

test('Layers are a bounded runtime projection and do not become a hidden document model', () => {
  for (const token of ['MAX_LAYERS = 600', 'new WeakMap()', 'treeSnapshot()', 'MutationObserver', 'setActive(next)', 'onCanvasClick', 'event.preventDefault()', 'selectionPayload(element)']) {
    assert.ok(script.includes(token), `preview editor runtime missing ${token}`);
  }
  assert.ok(!script.includes('data-monument-node-id'));
  assert.ok(previewRuntime.includes('PREVIEW_EDITOR_SCRIPT'));
  assert.ok(!previewRuntime.includes('dangerousRemoteDomainIpcAccess'));
});

test('product UI exposes real bidirectional Layers and source-native Properties', () => {
  assert.ok(entry.includes('VisualEditorLayer'));
  assert.ok(entry.includes("./styles/visual-editor.css"));
  for (const token of ['normalizeTree', 'normalizeSelection', 'preview_editor_select', 'preview_editor_hover', 'syncEditorSelectionFromPreview']) {
    assert.ok(editorController.includes(token), `editor controller missing ${token}`);
  }
  for (const token of ['Search layers', 'onSelect(layer.id)', 'onHover(layer.id)', 'Runtime projection']) assert.ok(layers.includes(token));
  for (const token of ['Live computed values', 'Typography', 'Spacing', 'Appearance', 'Source-authoritative editing', 'property-apply-bar']) assert.ok(properties.includes(token));
});
