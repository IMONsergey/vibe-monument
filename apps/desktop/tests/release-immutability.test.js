import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { test } from 'node:test';

const repoRoot = new URL('../../../', import.meta.url);
const release = await readFile(new URL('.github/workflows/monument-intel-alpha-release.yml', repoRoot), 'utf8');

async function exists(relativePath) {
  try {
    await access(new URL(relativePath, repoRoot), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

test('published Monument tags cannot be silently repointed to a new commit', () => {
  for (const token of [
    'Guard immutable release identity',
    'git fetch --tags --force',
    'git rev-parse "$RELEASE_TAG^{commit}"',
    'git rev-list -n 1 "$RELEASE_TAG"',
    'EXISTING_SHA',
    'GITHUB_SHA',
    'Bump Monument version instead of replacing an existing release.',
  ]) {
    assert.ok(release.includes(token), `release workflow missing ${token}`);
  }
});

test('release immutability bootstrap is removed before merge', async () => {
  assert.equal(await exists('.github/workflows/monument-release-immutability-bootstrap.yml'), false);
});
