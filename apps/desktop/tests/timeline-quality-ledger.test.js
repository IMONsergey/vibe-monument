import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('Timeline persists deterministic and browser quality by code generation', async () => {
  const [quality, verification, browser, panel] = await Promise.all([
    source('src/timeline/quality.ts'),
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

  assert.ok(verification.includes('recordTimelineDeterministicQuality'));
  assert.ok(verification.includes("'permission-required'"));
  assert.ok(browser.includes('recordTimelineBrowserQuality'));
  assert.ok(browser.includes("browserEvidenceHasIssues(record) ? 'issues' : 'clean'"));

  for (const token of ['Checks ✓', 'Browser ✓', 'Checks off', 'Not checked', 'subscribeTimelineQuality']) {
    assert.ok(panel.includes(token), `Timeline quality UI missing ${token}`);
  }
});
