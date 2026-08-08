import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
const layer = await readFile(new URL('../src/editor/VisualEditorLayer.tsx', import.meta.url), 'utf8');
const properties = await readFile(new URL('../src/editor/PropertiesPanel.tsx', import.meta.url), 'utf8');
const coordinator = await readFile(new URL('../src/editor/sourceTransaction.ts', import.meta.url), 'utf8');
const verification = await readFile(new URL('../src/verification/controller.ts', import.meta.url), 'utf8');
const repair = await readFile(new URL('../src/repair/controller.ts', import.meta.url), 'utf8');

test('visual editor direct path is coordinated by the product shell, not the preview webview', () => {
  for (const token of [
    'registerVisualSourceCoordinator',
    "invokeNative<VisualSourcePlanResponse>('visual_source_plan'",
    "invokeNative<VisualSourceApplyResult>('visual_source_apply'",
    'baseCheckpointId',
    'freshTimeline.dirty',
    'currentCheckpoint.id !== prepared.baseCheckpointId',
    'promptQueueState.items.length > 0',
    "workspace.codexState === 'ready'",
  ]) assert.ok(app.includes(token), `App direct-edit guard missing ${token}`);

  assert.ok(coordinator.includes('VisualSourceCoordinator'));
  assert.ok(coordinator.includes('registerVisualSourceCoordinator'));
  assert.ok(coordinator.includes('commitVisualSourceEdit'));
});

test('direct source mutation becomes one checkpoint with checkpoint-bound evidence', () => {
  for (const token of [
    'saveTimelineVersion(project, `Visual edit · ${prepared.change.property}`)',
    "trigger: 'source-transaction'",
    'checkpointId: checkpoint.id',
    'captureBrowserEvidence(project.id, 0, checkpoint.id)',
    'markBrowserEvidenceStale(project.id)',
    'clearBrowserEvidenceBuffer()',
  ]) assert.ok(app.includes(token), `checkpoint/evidence orchestration missing ${token}`);

  assert.ok(verification.includes("'source-transaction'"));
  assert.ok(verification.includes("trigger !== 'manual'"));
  assert.ok(repair.includes("['codex-turn', 'source-transaction'].includes(evidence.trigger)"));
});

test('App freshness and queue override use checkpoint identity, never turn identity', () => {
  for (const token of [
    'verificationProgress.evidence.checkpointId !== currentCheckpointId',
    'browserEvidence.capturedForCheckpointId !== currentCheckpointId',
    'queueFailureOverride === currentCheckpointId',
    'setQueueFailureOverride(currentCheckpointId)',
  ]) assert.ok(app.includes(token), `checkpoint-first App freshness missing ${token}`);

  assert.ok(!app.includes('const currentCodeTurnSerial ='));
  assert.ok(!app.includes('queueFailureOverride === currentCodeTurnSerial'));
});

test('Properties exposes explicit dry-run preview and preserves Codex fallback', () => {
  for (const token of [
    'planVisualSourceEdit',
    'queueVisualPropertyEdit',
    'preparedSourceEdit',
    'commitVisualSourceEdit',
  ]) assert.ok(layer.includes(token), `VisualEditorLayer integration missing ${token}`);

  for (const token of [
    'Direct source edit',
    'previewBefore',
    'previewAfter',
    'Apply source',
    'Use Codex',
    'onDismissSourcePreview',
  ]) assert.ok(properties.includes(token), `Properties direct-edit UX missing ${token}`);
});
