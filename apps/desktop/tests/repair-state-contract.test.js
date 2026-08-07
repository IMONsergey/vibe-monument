import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = await readFile(join(root, 'src/repair/state.ts'), 'utf8');

test('automatic repair has hard stop conditions', () => {
  for (const token of [
    "'attempt-limit'",
    "'repeated-failure'",
    "'cancelled'",
    'REPAIR_MAX_AUTOMATIC_ATTEMPTS',
    'state.attempt >= state.maxAutomaticAttempts',
    'nextFailure.fingerprint === state.lastFingerprint',
  ]) {
    assert.ok(source.includes(token), `missing repair stop condition ${token}`);
  }
});

test('repair progression separates Codex work from verification', () => {
  for (const token of [
    "'codex-working'",
    "'checkpointing'",
    "'verifying'",
    'markRepairCodexWorking',
    'markRepairCheckpointing',
    'markRepairVerifying',
    'finishRepairVerification',
  ]) {
    assert.ok(source.includes(token), `missing repair lifecycle token ${token}`);
  }
});
