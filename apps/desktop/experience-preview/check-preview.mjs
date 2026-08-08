import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFile(join(root, path), 'utf8');

const [
  tokensSource,
  tokenCss,
  mainCss,
  workspaceCss,
  componentsCss,
  foundationCss,
  appSource,
  foundationSource,
  mainEntrySource,
  packageSource,
  lockSource,
  indexHtml,
  foundationHtml,
  mainRuntime,
] =
  await Promise.all([
    read('tokens/monument.tokens.json'),
    read('tokens/tokens.css'),
    read('src/main.css'),
    read('src/workspace.css'),
    read('src/components.css'),
    read('src/foundation.css'),
    read('src/App.tsx'),
    read('src/foundation.tsx'),
    read('src/main.tsx'),
    read('package.json'),
    read('package-lock.json'),
    read('index.html'),
    read('foundation.html'),
    read('../src/main.tsx'),
  ]);

const tokens = JSON.parse(tokensSource);
const packageJson = JSON.parse(packageSource);
const packageLock = JSON.parse(lockSource);

assert.equal(tokens.source.package, '@openai/apps-sdk-ui');
assert.equal(tokens.source.packageVersion, '0.2.2');
assert.equal(tokens.source.packageCategory, 'OPENAI-PUBLISHED');
assert.equal(tokens.source.adapterCategory, 'MONUMENT-DERIVED');
assert.ok(tokens.foundation && tokens.semantic && tokens.component);
assert.ok(tokens.semantic.modes?.light && tokens.semantic.modes?.dark);
assert.equal(packageJson.devDependencies['@openai/apps-sdk-ui'], '0.2.2');
assert.equal(packageLock.packages['node_modules/@openai/apps-sdk-ui'].version, '0.2.2');
assert.equal(
  packageLock.packages['node_modules/@openai/apps-sdk-ui'].integrity,
  'sha512-KaG+6qcVCKVRe51wr2te68OKoHfjRQPDVVkugxiF+SaZlgLpNbxOfyrL/FyUBmHbjh1q4p7eWDYAd75jHseZ9A==',
);
for (const [path, entry] of Object.entries(packageLock.packages)) {
  if (!path || !entry.resolved?.includes('registry.npmjs.org')) continue;
  assert.ok(entry.integrity, `${path} is a registry dependency without an integrity digest`);
}

assert.match(mainCss, /@import "@openai\/apps-sdk-ui\/css"/);
assert.match(mainCss, /@source "\.\.\/node_modules\/@openai\/apps-sdk-ui"/);
assert.match(appSource, /@openai\/apps-sdk-ui\/components\/Button/);
assert.match(appSource, /@openai\/apps-sdk-ui\/components\/Icon/);
assert.match(appSource, /@openai\/apps-sdk-ui\/components\/Textarea/);

for (const state of ['map', 'inspector', 'timeline', 'proof', 'codex', 'command']) {
  assert.ok(appSource.includes(`'${state}'`), `missing ${state} disclosure state`);
}

for (const state of ['idle', 'working', 'complete', 'approval']) {
  assert.ok(appSource.includes(`'${state}'`), `missing ${state} agent state`);
}

for (const state of ['unknown', 'needs-checks', 'checking', 'needs-review', 'ready', 'blocked']) {
  assert.ok(appSource.includes(`'${state}'`), `missing ${state} proof state`);
}

assert.match(appSource, /metaKey \|\| event\.ctrlKey/);
assert.match(appSource, /event\.key === 'Escape'/);
for (const shortcut of ["key === 'm'", "key === 'd'", "key === 't'"]) {
  assert.ok(appSource.includes(shortcut), `missing keyboard shortcut ${shortcut}`);
}
assert.match(appSource, /event\.key === 'ArrowDown'/);
assert.match(appSource, /aria-activedescendant/);
assert.match(appSource, /data-transient-surface/);
assert.match(appSource, /aria-live="polite"/);
assert.match(componentsCss + workspaceCss + foundationCss, /:focus-visible/);
assert.match(componentsCss + workspaceCss + foundationCss, /prefers-reduced-motion:\s*reduce/);

const customPropertyDefinition = /(--mon-[a-z0-9-]+)\s*:/gi;
const customPropertyUse = /var\((--mon-[a-z0-9-]+)/gi;
const defined = new Set([...tokenCss.matchAll(customPropertyDefinition)].map((match) => match[1]));
for (const match of (componentsCss + workspaceCss + foundationCss).matchAll(customPropertyUse)) {
  assert.ok(defined.has(match[1]), `unresolved Monument token ${match[1]}`);
}

const authoredRuntime = appSource + foundationSource + mainEntrySource;
for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon']) {
  assert.ok(!authoredRuntime.includes(forbidden), `preview runtime must not use ${forbidden}`);
}

for (const html of [indexHtml, foundationHtml]) {
  assert.match(html, /Content-Security-Policy/i);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /font-src 'self' data:/);
}
assert.match(indexHtml, /<noscript>/);
assert.match(indexHtml, /Objects for a slower home/);

assert.ok(!mainRuntime.includes('experience-preview'), 'production runtime must not import the preview');
assert.match(workspaceCss, /@media \(max-width:\s*767px\)/);
assert.match(workspaceCss, /@media \(max-width:\s*1199px\)/);
assert.match(appSource, /Simulated concept/);

console.log('Monument experience preview contract: PASS');
