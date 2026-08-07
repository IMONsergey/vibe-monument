import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('Auto Repair is opt-in, evidence-bounded and limited to two autonomous attempts', async () => {
  const [repair, verification, runtime, panel] = await Promise.all([
    source('src/repair/controller.ts'),
    source('src/verification/controller.ts'),
    source('src/codex/runtime.ts'),
    source('src/components/EvidencePanel.tsx'),
  ]);

  for (const token of [
    'MAX_AUTO_REPAIR_ATTEMPTS = 2',
    'verification:auto-repair:',
    "evidence.trigger !== 'codex-turn'",
    "evidence.status !== 'failed'",
    'MAX_RESULT_TEXT',
    'MAX_REPAIR_PROMPT',
    'untrusted diagnostic data',
    'Do not delete, skip, disable, weaken, or rewrite tests',
    'Do not change package scripts, lint/typecheck configuration, or thresholds',
    'Monument will not auto-approve it',
    "source: 'automatic'",
  ]) {
    assert.ok(repair.includes(token), `Auto Repair controller missing ${token}`);
  }

  assert.ok(verification.includes('requestAutoRepairIfEnabled(evidence)'));
  assert.ok(verification.indexOf('await persistFinal(evidence)') < verification.indexOf('requestAutoRepairIfEnabled(evidence)'), 'failed evidence and Timeline quality must persist before repair is requested');

  for (const token of [
    'handledRepairEvidence',
    'autoRepairAttempts',
    'currentTimelineTurnSerial(request.projectId, this.snapshot.turnSerial)',
    'request.turnSerial !== currentGeneration',
    "request.source === 'automatic'",
    'attempts >= MAX_AUTO_REPAIR_ATTEMPTS',
    'this.autoRepairAttempts.set(projectRoot, 0)',
    'this.client.startTurn(threadId, request.prompt',
    'Auto repair stopped',
  ]) {
    assert.ok(runtime.includes(token), `Codex Auto Repair runtime missing ${token}`);
  }

  assert.ok(!repair.includes("decision: 'accept'"), 'Repair controller must not auto-approve commands or file changes');

  for (const token of [
    'Auto repair ·',
    'Enable auto repair',
    'Enable checks first',
    'up to 2 bounded repair attempts',
    'Permissions are never auto-approved',
  ]) {
    assert.ok(panel.includes(token), `Auto Repair UX missing ${token}`);
  }
});
