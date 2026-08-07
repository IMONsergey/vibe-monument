import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('Fix with Monument is explicit, bounded, generation-safe and approval-safe', async () => {
  const [repair, runtime, checks, browser, timeline] = await Promise.all([
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
    'currentTimelineTurnSerial',
    'activeTimelineProjectRoot',
  ]) assert.ok(repair.includes(token), `explicit repair missing ${token}`);

  const explicitStart = repair.indexOf('export function requestVerificationRepair');
  const automaticStart = repair.indexOf('export async function requestAutoRepairIfEnabled');
  assert.ok(explicitStart >= 0 && automaticStart > explicitStart);
  const explicitSection = repair.slice(explicitStart, automaticStart);
  assert.ok(!explicitSection.includes('isAutoRepairEnabled'), 'explicit repair must not require the autonomous Auto Repair toggle');
  assert.ok(!repair.includes("decision: 'accept'"), 'repair must never auto-approve permissions');

  for (const token of [
    'currentTimelineTurnSerial(request.projectId, this.snapshot.turnSerial)',
    'request.turnSerial !== currentGeneration',
    "request.source === 'automatic'",
    "request.source === 'automatic' && attempt != null",
    "request.label || 'Fix with Monument'",
  ]) assert.ok(runtime.includes(token), `repair runtime missing ${token}`);

  assert.ok(checks.includes('Fix with Monument'));
  assert.ok(checks.includes('requestVerificationRepair(evidence)'));
  assert.ok(checks.includes("evidence.status !== 'failed'"));
  assert.ok(browser.includes('Fix with Monument'));
  assert.ok(browser.includes('requestBrowserRepair(record)'));
  assert.ok(browser.includes('hasRepairableIssues'));

  assert.ok(timeline.includes('activeTimelineProjectRoot'));
  assert.ok(timeline.includes('project?.id === projectId ? project.rootPath : null'));
});
