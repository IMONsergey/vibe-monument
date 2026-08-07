import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { test } from 'node:test';

const repoRoot = new URL('../../../', import.meta.url);

async function exists(relativePath) {
  try {
    await access(new URL(relativePath, repoRoot), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

test('one-shot Browser Evidence migration workflows are not part of the product branch', async () => {
  for (const path of [
    '.github/workflows/monument-browser-evidence-bootstrap.yml',
    '.github/workflows/monument-browser-evidence-harden.yml',
    '.github/workflows/monument-browser-evidence-cleanup.yml',
  ]) {
    assert.equal(await exists(path), false, `${path} must be removed before merge`);
  }
});
