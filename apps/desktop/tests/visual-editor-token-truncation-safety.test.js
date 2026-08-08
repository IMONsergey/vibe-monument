import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const properties = await readFile(new URL('../src/editor/PropertiesPanel.tsx', import.meta.url), 'utf8');
const tokenClient = await readFile(new URL('../src/editor/tokenEditing.ts', import.meta.url), 'utf8');

test('truncated token evidence cannot expose deterministic scope actions', () => {
  assert.ok(properties.includes('disabled={!probe.instanceEligible || probe.truncated}'));
  assert.ok(properties.includes('disabled={probe.truncated}'));
  assert.ok(properties.includes('Direct token mutation is disabled; Apply will use Codex.'));
  assert.ok(properties.includes("tokenProbe.truncated\n        ? { mode: 'codex' as const }"));
  assert.ok(properties.includes('Bounded token evidence truncated · Codex fallback required'));
});

test('independent token scope truncation propagates into the product probe', () => {
  assert.ok(tokenClient.includes('truncated: probe.truncated || scope.truncated'));
  assert.ok(tokenClient.includes('Math.max(probe.usageCount, scope.usageCount)'));
});
