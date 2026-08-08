import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const previewRoot = dirname(fileURLToPath(import.meta.url));
const buildRoot = join(previewRoot, '..', 'dist-experience');
const assetRoot = join(buildRoot, 'assets');

const [workspaceHtml, foundationHtml, assetNames] = await Promise.all([
  readFile(join(buildRoot, 'index.html'), 'utf8'),
  readFile(join(buildRoot, 'foundation.html'), 'utf8'),
  readdir(assetRoot),
]);

assert.match(workspaceHtml, /assets\/workspace-[^"']+\.js/);
assert.match(foundationHtml, /assets\/foundation-[^"']+\.js/);
for (const html of [workspaceHtml, foundationHtml]) {
  assert.match(html, /Content-Security-Policy/i);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /font-src 'self' data:/);
}
assert.match(workspaceHtml, /<noscript>/);
assert.match(workspaceHtml, /Simulated concept/);

const mapNames = assetNames.filter((name) => name.endsWith('.js.map'));
assert.ok(mapNames.length > 0, 'expected source maps for dependency provenance inspection');

const mapSources = [];
for (const mapName of mapNames) {
  const map = JSON.parse(await readFile(join(assetRoot, mapName), 'utf8'));
  assert.ok(Array.isArray(map.sources), `${mapName} must expose its source module list`);
  mapSources.push(...map.sources);
}

const forbiddenLodashSources = mapSources.filter((source) =>
  /node_modules\/lodash(?:\/|\\|\.js$)/i.test(source),
);
assert.deepEqual(
  forbiddenLodashSources,
  [],
  `unused vulnerable lodash modules entered the preview bundle: ${forbiddenLodashSources.join(', ')}`,
);

assert.ok(
  mapSources.some((source) => source.includes('@openai/apps-sdk-ui')),
  'official @openai/apps-sdk-ui modules must be present in the preview bundle',
);

for (const assetName of assetNames.filter((name) => name.endsWith('.css') || name.endsWith('.js'))) {
  const source = await readFile(join(assetRoot, assetName), 'utf8');
  assert.doesNotMatch(source, /https:\/\/cdn\.openai\.com/i, `${assetName} contains a remote OpenAI asset`);
  assert.doesNotMatch(source, /url\(\s*["']?https?:\/\//i, `${assetName} contains a remote CSS asset`);
  if (assetName.endsWith('.js')) {
    assert.doesNotMatch(source, /\bfetch\s*\(/, `${assetName} contains a runtime fetch path`);
  }
}

console.log('Monument experience preview bundle provenance: PASS');
