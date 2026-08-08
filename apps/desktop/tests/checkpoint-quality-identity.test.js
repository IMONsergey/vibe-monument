import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const timeline = await readFile(new URL('../src/timeline/controller.ts', import.meta.url), 'utf8');
const quality = await readFile(new URL('../src/timeline/quality.ts', import.meta.url), 'utf8');
const timelinePanel = await readFile(new URL('../src/components/VersionTimelinePanel.tsx', import.meta.url), 'utf8');
const verification = await readFile(new URL('../src/verification/controller.ts', import.meta.url), 'utf8');
const browser = await readFile(new URL('../src/browser/evidence.ts', import.meta.url), 'utf8');
const review = await readFile(new URL('../src/review/controller.ts', import.meta.url), 'utf8');
const repair = await readFile(new URL('../src/repair/controller.ts', import.meta.url), 'utf8');
const ship = await readFile(new URL('../src/ship/controller.ts', import.meta.url), 'utf8');

test('Timeline exposes exact clean checkpoint identity independently from Codex turn provenance', () => {
  assert.ok(timeline.includes('export async function currentTimelineCheckpoint'));
  assert.ok(timeline.includes('if (state.dirty) return null'));
  assert.ok(timeline.includes('checkpoint.id === state.currentCheckpointId'));
});

test('Timeline quality store is keyed by checkpoint while turnSerial remains provenance', () => {
  assert.ok(quality.includes('checkpointId: string'));
  assert.ok(quality.includes('turnSerial: number | null'));
  assert.ok(quality.includes('const key = checkpointKey(checkpointId)'));
  assert.ok(quality.includes('export function timelineQualityForCheckpoint'));
  assert.ok(quality.includes('Legacy turn-keyed entries'));
  assert.ok(timelinePanel.includes('timelineQualityForCheckpoint(quality, checkpoint.id)'));
  assert.ok(!timelinePanel.includes('timelineQualityForTurn(quality, checkpoint.turnSerial)'));
});

test('deterministic, browser and review quality persist checkpoint identity', () => {
  assert.ok(verification.includes('checkpointId: string | null'));
  assert.ok(verification.includes('currentTimelineCheckpoint(projectId)'));
  assert.ok(verification.includes('evidence.checkpointId,'));
  assert.ok(verification.includes('evidence.turnSerial > 0 ? evidence.turnSerial : null'));

  assert.ok(browser.includes('capturedForCheckpointId: string | null'));
  assert.ok(browser.includes('currentTimelineCheckpoint(projectId)'));
  assert.ok(browser.includes('resolvedCheckpointId,'));
  assert.ok(browser.includes('resolvedTurnSerial > 0 ? resolvedTurnSerial : null'));

  assert.ok(review.includes('record.checkpointId,'));
  assert.ok(review.includes('record.turnSerial,'));
  assert.ok(review.includes('Codex turn provenance'));
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
