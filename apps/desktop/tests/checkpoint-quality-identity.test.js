import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const timeline = await readFile(new URL('../src/timeline/controller.ts', import.meta.url), 'utf8');
const verification = await readFile(new URL('../src/verification/controller.ts', import.meta.url), 'utf8');
const browser = await readFile(new URL('../src/browser/evidence.ts', import.meta.url), 'utf8');
const repair = await readFile(new URL('../src/repair/controller.ts', import.meta.url), 'utf8');
const ship = await readFile(new URL('../src/ship/controller.ts', import.meta.url), 'utf8');

test('Timeline exposes exact clean checkpoint identity independently from Codex turn provenance', () => {
  assert.ok(timeline.includes('export async function currentTimelineCheckpoint'));
  assert.ok(timeline.includes('if (state.dirty) return null'));
  assert.ok(timeline.includes('checkpoint.id === state.currentCheckpointId'));
});

test('deterministic and browser evidence persist checkpoint identity', () => {
  assert.ok(verification.includes('checkpointId: string | null'));
  assert.ok(verification.includes('currentTimelineCheckpoint(projectId)'));
  assert.ok(verification.includes('checkpointId: resolvedCheckpointId'));
  assert.ok(browser.includes('capturedForCheckpointId: string | null'));
  assert.ok(browser.includes('currentTimelineCheckpoint(projectId)'));
  assert.ok(browser.includes('capturedForCheckpointId: resolvedCheckpointId'));
});

test('repair request schema carries checkpoint identity even while legacy turn fallback remains', () => {
  assert.ok(repair.includes('checkpointId: string | null'));
  assert.ok(repair.includes('checkpointId: evidence.checkpointId'));
  assert.ok(repair.includes('checkpointId: record.capturedForCheckpointId'));
  assert.ok(repair.includes('currentCheckpoint.id !== record.capturedForCheckpointId'));
});

test('Ship treats checkpoint id as source identity and turnSerial as provenance only', () => {
  assert.ok(ship.includes('const checkpointId = current?.id ?? null'));
  assert.ok(ship.includes('if (!evidence.checkpointId)'));
  assert.ok(ship.includes('evidence.checkpointId !== checkpointId'));
  assert.ok(ship.includes('if (!input.browser.capturedForCheckpointId)'));
  assert.ok(ship.includes('input.browser.capturedForCheckpointId !== checkpointId'));
  assert.ok(ship.includes('input.review.checkpointId !== current.id'));
  assert.ok(!ship.includes("turnSerial == null || turnSerial <= 0"));
  assert.ok(!ship.includes('This saved version is not bound to a Codex generation'));
});
