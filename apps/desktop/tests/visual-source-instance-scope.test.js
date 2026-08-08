import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const coordinator = await readFile(new URL('../src/editor/sourceTransaction.ts', import.meta.url), 'utf8');
const selection = await readFile(new URL('../src/preview/selection.ts', import.meta.url), 'utf8');
const editorScript = await readFile(new URL('../src-tauri/src/preview_editor_script.rs', import.meta.url), 'utf8');

test('direct visual source edits require a live DOM id proven unique', () => {
  assert.ok(selection.includes('idUnique?: boolean | null'));
  assert.ok(editorScript.includes('function elementIdUnique(element)'));
  assert.ok(editorScript.includes('idUnique: elementIdUnique(element)'));
  assert.ok(coordinator.includes('selection.idUnique !== true'));
  assert.ok(coordinator.includes('liveSelection.idUnique !== true'));
});

test('complex selector syntax is kept off the deterministic v1 path', () => {
  for (const token of [
    "selector.includes('[')",
    "selector.includes('/*')",
    "selector.includes('\\\\')",
    "selector.includes('(')",
  ]) assert.ok(coordinator.includes(token), `selector fallback guard missing ${token}`);
  assert.ok(coordinator.includes('This selector needs deeper source parsing'));
});
