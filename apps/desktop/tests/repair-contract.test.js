import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = await readFile(join(root, 'src/repair/failure.ts'), 'utf8');

test('repair packet is bounded and evidence-driven', () => {
  for (const token of [
    'MAX_PACKET_CHARS = 7_500',
    'MAX_FAILURE_LINES = 18',
    'summarizeRepairFailure',
    'compileRepairPacket',
    'REPAIR_MAX_AUTOMATIC_ATTEMPTS = 2',
    'Failure fingerprint',
  ]) {
    assert.ok(source.includes(token), `missing ${token}`);
  }
});

test('repair prompt explicitly forbids manufacturing green evidence', () => {
  for (const phrase of [
    'Do not delete, disable, skip, weaken, rewrite, or bypass tests/checks',
    'Do not change the verification mechanism unless the user explicitly requested',
    'Monument will rerun verification itself',
  ]) {
    assert.ok(source.includes(phrase), `missing safety rule: ${phrase}`);
  }
});

test('repair packet preserves privacy redaction', () => {
  for (const token of ['Bearer [redacted]', '[redacted-token]', '[redacted-jwt]', '$1[redacted]']) {
    assert.ok(source.includes(token), `missing redaction token ${token}`);
  }
  assert.ok(!source.includes('request.headers'));
  assert.ok(!source.includes('response.text'));
});
