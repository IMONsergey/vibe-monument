import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const controller = await readFile(new URL('../src/verification/controller.ts', import.meta.url), 'utf8');
const panel = await readFile(new URL('../src/components/EvidencePanel.tsx', import.meta.url), 'utf8');

test('Codex completion cannot execute project verification scripts before explicit project consent', () => {
  for (const token of [
    'verification:auto:',
    'isAutoVerificationEnabled',
    'setAutoVerificationEnabled',
    "trigger === 'codex-turn'",
    '!includeManual',
    'permissionRequired = true',
  ]) {
    assert.ok(controller.includes(token), `Auto-QA consent contract missing ${token}`);
  }

  const consentGate = controller.indexOf("if (trigger === 'codex-turn' && !includeManual");
  const execution = controller.indexOf("invokeNative<VerificationResult>('verification_run'");
  assert.ok(consentGate >= 0 && execution > consentGate, 'project scripts must be gated before verification_run');
});

test('Evidence UX makes automatic permission explicit and manual checks stay one-shot', () => {
  for (const token of [
    'Auto checks ·',
    'Enable for this project',
    'These are project scripts and require your permission.',
    'did not execute them',
    'Run all checks',
    'setAutoVerificationEnabled(evidence.projectId, true)',
    'setAutoVerificationEnabled(evidence.projectId, false)',
  ]) {
    assert.ok(panel.includes(token), `Auto-QA permission UX missing ${token}`);
  }
  assert.ok(controller.includes("trigger === 'codex-turn' && !includeManual"), 'manual verification must bypass only the automatic-consent gate for that explicit run');
});
