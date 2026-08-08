import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
const editor = await readFile(new URL('../src/editor/VisualEditorLayer.tsx', import.meta.url), 'utf8');
const properties = await readFile(new URL('../src/editor/PropertiesPanel.tsx', import.meta.url), 'utf8');
const main = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
const browser = await readFile(new URL('../src/browser/evidence.ts', import.meta.url), 'utf8');
const verification = await readFile(new URL('../src/verification/controller.ts', import.meta.url), 'utf8');

test('App is the single coordinator for direct visual source transactions', () => {
  assert.ok(app.includes('registerVisualSourceCoordinator({'));
  assert.ok(app.includes('plan: planDirectVisualSource'));
  assert.ok(app.includes('commit: commitDirectVisualSource'));
  assert.ok(!main.includes('VisualSourceCoordinatorHost'));
});

test('direct source plan requires one id-owned change and an idle exact checkpoint', () => {
  for (const token of [
    'changes.length !== 1',
    "change.property === 'textContent'",
    '!editorSelection.id',
    '!canExecutePromptNow',
    'promptQueueState.items.length > 0',
    'const freshTimeline = await prepareTimeline(project)',
    'freshTimeline.dirty || !baseCheckpoint',
    "invokeNative<VisualSourcePlanResponse>('visual_source_plan'",
    "response.status !== 'deterministic'",
    'baseCheckpointId: baseCheckpoint.id',
  ]) assert.ok(app.includes(token), `direct plan contract missing ${token}`);
});

test('commit revalidates checkpoint and native source preconditions before saving a Version', () => {
  for (const token of [
    'currentCheckpoint.id !== prepared.baseCheckpointId',
    "invokeNative<VisualSourceApplyResult>('visual_source_apply'",
    'expectedFileFingerprint: prepared.plan.fileFingerprint',
    'expectedValueStart: prepared.plan.valueStart',
    'expectedValueEnd: prepared.plan.valueEnd',
    'await saveTimelineVersion(project, `Visual edit · ${prepared.change.property}`)',
    'await refreshTimeline(project)',
    "trigger: 'source-transaction'",
    'checkpointId: checkpoint.id',
    'captureBrowserEvidence(project.id, 0, checkpoint.id)',
  ]) assert.ok(app.includes(token), `direct commit contract missing ${token}`);
});

test('direct UI always shows a dry-run and preserves explicit Codex fallback', () => {
  assert.ok(editor.includes("setApplyMessage(`Direct source edit ready"));
  assert.ok(editor.includes('useCodexForPrepared'));
  assert.ok(properties.includes('Direct source edit'));
  assert.ok(properties.includes('previewBefore'));
  assert.ok(properties.includes('previewAfter'));
  assert.ok(properties.includes('Apply source'));
  assert.ok(properties.includes('Use Codex'));
});

test('explicit evidence checkpoint requests are accepted only while that checkpoint stays current', () => {
  assert.ok(browser.includes('checkpoint && (!checkpointId || checkpoint.id === checkpointId)'));
  assert.ok(browser.includes('checkpointAfterCapture.id === resolvedCheckpointId'));
  assert.ok(browser.includes('const finalCheckpointId = stillCurrent ? resolvedCheckpointId : null'));
  assert.ok(verification.includes('currentCheckpoint && (!checkpointId || currentCheckpoint.id === checkpointId)'));
  assert.ok(verification.includes('Source checkpoint changed while verification was running'));
});
