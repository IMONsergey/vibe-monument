import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const native = await readFile(new URL('../src-tauri/src/git_ship.rs', import.meta.url), 'utf8');
const panel = await readFile(new URL('../src/components/ShipPanel.tsx', import.meta.url), 'utf8');
const host = await readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8');

test('Ship commit is explicit, bounded and does not bypass repository hooks', () => {
  assert.ok(native.includes('MAX_SHIP_FILES: usize = 400'));
  assert.ok(native.includes('MAX_COMMIT_MESSAGE: usize = 180'));
  assert.ok(native.includes('Your Git index already contains staged changes'));
  assert.ok(native.includes('add.arg("--")'));
  assert.ok(native.includes('.args(["commit", "-m", &message])'));
  assert.ok(!native.includes('--no-verify'));
  assert.ok(!native.includes('git add .'));
  assert.ok(!native.includes('push'));
});

test('Ship UI shows the exact planned files before local commit', () => {
  assert.ok(panel.includes("invokeNative<GitShipPlan>('git_ship_plan'"));
  assert.ok(panel.includes("invokeNative<GitShipCommitResult>('git_ship_commit'"));
  assert.ok(panel.includes('Review files being committed'));
  assert.ok(panel.includes('Commit locally'));
  assert.ok(panel.includes('No push was performed.'));
  assert.ok(host.includes('git_ship_plan'));
  assert.ok(host.includes('git_ship_commit'));
});
