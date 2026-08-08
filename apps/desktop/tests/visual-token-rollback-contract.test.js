import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const rollback = await readFile(new URL('../src/editor/tokenRollback.ts', import.meta.url), 'utf8');

test('element token detach rollback restores the original var reference through guarded literal source apply', () => {
  for (const token of [
    "before: prepared.change.after",
    "after: prepared.elementPlan.beforeSource",
    "invokeNative<VisualSourcePlanResponse>('visual_source_plan'",
    'plan.fileFingerprint !== applied.nextFingerprint',
    'plan.afterSource !== prepared.elementPlan.beforeSource',
    "invokeNative<VisualSourceApplyResult>('visual_source_apply'",
  ]) assert.ok(rollback.includes(token), `element token rollback missing ${token}`);
});

test('global token rollback replans the token definition and requires the exact forward-write fingerprint', () => {
  for (const token of [
    "before: prepared.change.after",
    "after: prepared.change.before",
    "invokeNative<VisualTokenPlanResponse>('visual_token_plan'",
    "reverse?.status === 'scope-choice'",
    'plan.fileFingerprint !== applied.nextFingerprint',
    "scope: 'token'",
    "invokeNative<VisualTokenApplyResult>('visual_token_apply'",
  ]) assert.ok(rollback.includes(token), `global token rollback missing ${token}`);
});

test('token rollback is complete only when the original two-scope proof is reproducible again', () => {
  assert.ok(rollback.includes('verifyOriginalTokenPlan(prepared)'));
  assert.ok(rollback.includes("verification.status === 'scope-choice'"));
  assert.ok(rollback.includes('verification.tokenName === prepared.tokenName'));
  assert.ok(rollback.includes('verification.elementPlan?.beforeSource === prepared.elementPlan.beforeSource'));
  assert.ok(rollback.includes('verification.tokenPlan?.beforeSource === prepared.tokenPlan.beforeSource'));
});
