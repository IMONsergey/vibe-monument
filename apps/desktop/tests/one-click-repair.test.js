import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('explicit Fix with Monument reuses bounded repair without enabling autonomy', async () => {
  const [repair, runtime, evidencePanel, browserPanel, timeline] = await Promise.all([
    source('src/repair/controller.ts'),
    source('src/codex/runtime.ts'),
    source('src/components/EvidencePanel.tsx'),
    source('src/components/BrowserEvidencePanel.tsx'),
    source('src/timeline/controller.ts'),
  ]);

  for (const token of [
    'requestVerificationRepair',
    'requestBrowserRepair',
    "source: 'explicit'",
    'buildBrowserRepairPrompt',
    'MAX_BROWSER_EVENT_TEXT',
    'MAX_REPAIR_PROMPT',
    'activeTimelineProjectRoot',
    'currentTimelineTurnSerial',
    'currentGeneration !== record.capturedForTurnSerial',
  ]) {
    assert.ok(repair.includes(token), `explicit repair controller missing ${token}`);
  }

  assert.ok(repair.indexOf('requestVerificationRepair') < repair.indexOf('requestAutoRepairIfEnabled'));
  const explicitSection = repair.slice(repair.indexOf('export function requestVerificationRepair'), repair.indexOf('export async function requestAutoRepairIfEnabled'));
  assert.ok(!explicitSection.includes('isAutoRepairEnabled'), 'explicit repair must not silently enable or require Auto Repair');

  for (const token of [
    'currentTimelineTurnSerial(request.projectId, this.snapshot.turnSerial)',
    'request.turnSerial !== currentGeneration',
    "request.source === 'automatic'",
    "request.source === 'automatic' && attempt != null",
    "request.label || 'Fix with Monument'",
  ]) {
    assert.ok(runtime.includes(token), `repair runtime missing ${token}`);
  }

  assert.ok(evidencePanel.includes('Fix with Monument'));
  assert.ok(evidencePanel.includes('requestVerificationRepair(evidence)'));
  assert.ok(evidencePanel.includes('stale || evidence.status !== \'failed\''));
  assert.ok(browserPanel.includes('Fix with Monument'));
  assert.ok(browserPanel.includes('requestBrowserRepair(record)'));
  assert.ok(browserPanel.includes('!record.stale'));

  for (const token of ['activeTimelineProjectRoot', 'project?.id === projectId ? project.rootPath : null']) {
    assert.ok(timeline.includes(token), `Timeline explicit-repair context missing ${token}`);
  }

  assert.ok(!repair.includes('request.headers'));
  assert.ok(!repair.includes('response.body'));
  assert.ok(!repair.includes("decision: 'accept'"));
});
