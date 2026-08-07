import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('Timeline persists deterministic and browser quality by code generation', async () => {
  const [quality, timeline, verification, browser, panel] = await Promise.all([
    source('src/timeline/quality.ts'),
    source('src/timeline/controller.ts'),
    source('src/verification/controller.ts'),
    source('src/browser/evidence.ts'),
    source('src/components/VersionTimelinePanel.tsx'),
  ]);

  for (const token of [
    'timeline:quality:',
    'turnSerial',
    'recordTimelineDeterministicQuality',
    'recordTimelineBrowserQuality',
    'subscribeTimelineQuality',
    'timelineQualityForTurn',
  ]) {
    assert.ok(quality.includes(token), `quality ledger missing ${token}`);
  }

  for (const token of [
    'currentTimelineTurnSerial',
    'state.dirty',
    'current?.turnSerial ?? null',
  ]) {
    assert.ok(timeline.includes(token), `Timeline generation resolver missing ${token}`);
  }

  assert.ok(verification.includes('recordTimelineDeterministicQuality'));
  assert.ok(verification.includes("'permission-required'"));
  assert.ok(verification.includes("trigger === 'manual'"));
  assert.ok(verification.includes('currentTimelineTurnSerial(projectId, turnSerial)'));

  assert.ok(browser.includes('recordTimelineBrowserQuality'));
  assert.ok(browser.includes('currentTimelineTurnSerial(projectId, turnSerial)'));
  assert.ok(browser.includes("browserEvidenceHasIssues(record) ? 'issues' : 'clean'"));
  assert.ok(browser.includes('stale: resolvedTurnSerial <= 0'));

  for (const token of ['Checks ✓', 'Browser ✓', 'Checks off', 'Not checked', 'subscribeTimelineQuality']) {
    assert.ok(panel.includes(token), `Timeline quality UI missing ${token}`);
  }
});
