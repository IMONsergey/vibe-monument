import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AxePuppeteer } from '@axe-core/puppeteer';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const previewRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = join(previewRoot, '..', '..', '..');
const buildRoot = join(previewRoot, '..', 'dist-experience');
const outputRoot = process.env.MONUMENT_QA_OUTPUT
  ? normalize(process.env.MONUMENT_QA_OUTPUT)
  : join(repositoryRoot, 'work', 'visual-qa', '2026-08-08-product-experience-refoundation');

const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

await mkdir(outputRoot, { recursive: true });

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (requestUrl.pathname === '/favicon.ico') {
      response.writeHead(204);
      response.end();
      return;
    }

    const requestedPath = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
    const filePath = normalize(join(buildRoot, requestedPath));
    assert.ok(filePath.startsWith(`${buildRoot}/`), 'request escaped the static preview root');
    const body = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(filePath)] ?? 'application/octet-stream',
      'Content-Security-Policy': csp,
      'Cache-Control': 'no-store',
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert.ok(address && typeof address === 'object');
const origin = `http://127.0.0.1:${address.port}`;

const executablePath = process.env.MONUMENT_CHROMIUM_PATH || await chromium.executablePath();
const browser = await puppeteer.launch({
  executablePath,
  args: chromium.args,
  headless: 'shell',
  defaultViewport: null,
});

const consoleErrors = [];
const failedRequests = [];
const externalRequests = [];
const expectedAbortedRequests = [];
const screenshots = [];
const axeStates = [];

function observe(page, state) {
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push({ state, text: message.text() });
  });
  page.on('requestfailed', (request) => {
    if (state === 'workspace-no-js' && request.resourceType() === 'script') {
      expectedAbortedRequests.push({ state, url: request.url(), reason: 'JavaScript intentionally disabled' });
      return;
    }
    failedRequests.push({ state, url: request.url(), error: request.failure()?.errorText ?? 'unknown' });
  });
  page.on('request', (request) => {
    if (!request.url().startsWith(origin) && !request.url().startsWith('data:')) {
      externalRequests.push({ state, url: request.url(), method: request.method() });
    }
  });
}

async function newPage(state, width, height, path = '/') {
  const page = await browser.newPage();
  observe(page, state);
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(`${origin}${path}`, { waitUntil: 'networkidle0' });
  return page;
}

async function screenshot(page, name) {
  const path = join(outputRoot, name);
  await page.screenshot({ path, fullPage: false });
  screenshots.push(name);
}

async function settle(page) {
  await new Promise((resolve) => setTimeout(resolve, 260));
  await page.evaluate(async () => {
    const finiteAnimations = document
      .getAnimations()
      .filter((animation) => Number.isFinite(animation.effect?.getTiming().iterations ?? 1));
    await Promise.allSettled(finiteAnimations.map((animation) => animation.finished));
  });
}

async function clickByText(page, text) {
  const clicked = await page.evaluate((label) => {
    const element = [...document.querySelectorAll('button, summary')]
      .find((candidate) => candidate.textContent?.trim().includes(label));
    if (!(element instanceof HTMLElement)) return false;
    element.click();
    return true;
  }, text);
  assert.ok(clicked, `could not click control containing ${text}`);
}

async function clickRoleByText(page, role, text) {
  const clicked = await page.evaluate(({ roleName, label }) => {
    const element = [...document.querySelectorAll(`[role="${roleName}"]`)]
      .find((candidate) => candidate.textContent?.trim().includes(label));
    if (!(element instanceof HTMLElement)) return false;
    element.click();
    return true;
  }, { roleName: role, label: text });
  assert.ok(clicked, `could not click ${role} containing ${text}`);
}

async function runAxe(page, name) {
  const result = await new AxePuppeteer(page).analyze();
  axeStates.push({
    name,
    testEngine: result.testEngine,
    testEnvironment: result.testEnvironment,
    violations: result.violations,
    incomplete: result.incomplete,
    passesCount: result.passes.length,
  });
  if (result.violations.length > 0) {
    console.error(JSON.stringify({ state: name, violations: result.violations }, null, 2));
  }
  assert.equal(result.violations.length, 0, `${name} has accessibility violations`);
}

async function overlap(page) {
  return page.evaluate(() => {
    const selected = document.querySelector('.demo-selectable.is-selected');
    const surface = document.querySelector('.mon-sheet');
    if (!(selected instanceof HTMLElement) || !(surface instanceof HTMLElement)) return null;
    const a = selected.getBoundingClientRect();
    const b = surface.getBoundingClientRect();
    const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const area = width * height;
    return {
      selected: { x: a.x, y: a.y, width: a.width, height: a.height },
      surface: { x: b.x, y: b.y, width: b.width, height: b.height },
      overlapArea: area,
      overlapRatio: a.width * a.height === 0 ? 0 : area / (a.width * a.height),
    };
  });
}

const defaultPage = await newPage('workspace-default', 1440, 900);
await screenshot(defaultPage, 'workspace-1440-light.png');
await runAxe(defaultPage, 'workspace-default');

await defaultPage.click('textarea[aria-label="Ask Monument"]');
await defaultPage.keyboard.type('Refine the heading rhythm');
await defaultPage.keyboard.press('Enter');
await defaultPage.waitForSelector('.experience-shell[data-agent="working"]');
await settle(defaultPage);
await screenshot(defaultPage, 'workspace-1440-working.png');
await new Promise((resolve) => setTimeout(resolve, 1800));
await defaultPage.click('button[aria-label^="Switch to dark"]');
await screenshot(defaultPage, 'workspace-1440-dark-complete.png');

const inspectorPage = await newPage('workspace-inspector', 1280, 800);
await inspectorPage.click('button[aria-label="Open contextual inspector"]');
await inspectorPage.waitForSelector('[data-transient-surface="inspector"]');
await settle(inspectorPage);
assert.match(
  await inspectorPage.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''),
  /^Close Hero heading$/,
  'opening a sheet must move focus to its close action',
);
await screenshot(inspectorPage, 'workspace-1280-inspector.png');
await runAxe(inspectorPage, 'workspace-inspector');
await clickRoleByText(inspectorPage, 'radio', 'Source');
await settle(inspectorPage);
await runAxe(inspectorPage, 'workspace-inspector-source');
await clickRoleByText(inspectorPage, 'radio', 'Content');
await settle(inspectorPage);
await runAxe(inspectorPage, 'workspace-inspector-content');

const timelinePage = await newPage('workspace-timeline', 1280, 800);
await timelinePage.keyboard.press('v');
await timelinePage.waitForSelector('[data-transient-surface="timeline"]');
await settle(timelinePage);
const timelineGeometry = await overlap(timelinePage);
assert.ok(timelineGeometry && timelineGeometry.overlapRatio === 0, `Timeline covers selected element: ${JSON.stringify(timelineGeometry)}`);
await screenshot(timelinePage, 'workspace-1280-timeline.png');
await timelinePage.click('.timeline-card:nth-of-type(1)');
await clickByText(timelinePage, 'Restore v8');
await timelinePage.waitForSelector('.restore-confirmation');
assert.match(await timelinePage.$eval('.restore-confirmation', (element) => element.textContent ?? ''), /Restore v8\?/);
await settle(timelinePage);
await runAxe(timelinePage, 'workspace-timeline-restore');

const proofPage = await newPage('workspace-proof', 1280, 800);
await proofPage.click('.proof-trigger');
await proofPage.waitForSelector('[data-transient-surface="proof"]');
await settle(proofPage);
await screenshot(proofPage, 'workspace-1280-proof.png');
await runAxe(proofPage, 'workspace-proof-unknown');
await clickByText(proofPage, 'Evidence details');
await clickByText(proofPage, 'Blocked');
await proofPage.waitForSelector('.proof-blocker');
await settle(proofPage);
await screenshot(proofPage, 'workspace-1280-proof-blocked.png');
await runAxe(proofPage, 'workspace-proof-blocked');

const commandPage = await newPage('workspace-command', 1280, 800);
await commandPage.click('button[aria-label="Open command palette"]');
await commandPage.waitForSelector('[data-transient-surface="command"]');
await settle(commandPage);
assert.equal(await commandPage.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Search commands');
await commandPage.keyboard.press('ArrowDown');
assert.equal(await commandPage.$eval('[role="option"][aria-selected="true"]', (element) => element.textContent?.includes('Inspect selection')), true);
await screenshot(commandPage, 'workspace-1280-command.png');
await runAxe(commandPage, 'workspace-command');
await commandPage.keyboard.press('Enter');
await commandPage.waitForSelector('[data-transient-surface="inspector"]');
await commandPage.keyboard.press('Escape');
await commandPage.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Open command palette');
assert.equal(await commandPage.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Open command palette');

await commandPage.click('button[aria-label="Open command palette"]');
await commandPage.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Search commands');
await commandPage.keyboard.down('Shift');
await commandPage.keyboard.press('Tab');
await commandPage.keyboard.up('Shift');
assert.equal(await commandPage.evaluate(() => Boolean(document.activeElement?.closest('[data-transient-surface="command"]'))), true);
await commandPage.keyboard.press('Tab');
assert.equal(await commandPage.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Search commands');
await commandPage.keyboard.press('Escape');

const shortcutPage = await newPage('workspace-shortcuts', 1280, 800);
await shortcutPage.keyboard.down('Control');
await shortcutPage.keyboard.press('k');
await shortcutPage.keyboard.up('Control');
await shortcutPage.waitForSelector('[data-transient-surface="command"]');
assert.equal(await shortcutPage.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Search commands');
await shortcutPage.keyboard.press('Escape');
for (const [key, expected] of [['m', 'map'], ['d', 'codex'], ['i', 'inspector'], ['p', 'proof'], ['v', 'timeline']]) {
  await shortcutPage.keyboard.press(key);
  await shortcutPage.waitForSelector(`[data-transient-surface="${expected}"]`);
  await shortcutPage.keyboard.press('Escape');
}
const themeBefore = await shortcutPage.evaluate(() => document.documentElement.dataset.theme);
await shortcutPage.keyboard.press('t');
assert.notEqual(await shortcutPage.evaluate(() => document.documentElement.dataset.theme), themeBefore);

const mobilePage = await newPage('workspace-mobile-inspector', 390, 844);
await mobilePage.click('button[aria-label="Open contextual inspector"]');
await mobilePage.waitForSelector('[data-transient-surface="inspector"]');
await settle(mobilePage);
const mobileGeometry = await overlap(mobilePage);
assert.ok(mobileGeometry && mobileGeometry.overlapRatio === 0, `Mobile inspector covers selected element: ${JSON.stringify(mobileGeometry)}`);
await screenshot(mobilePage, 'workspace-390-inspector.png');
await runAxe(mobilePage, 'workspace-mobile-inspector');

const foundationPage = await newPage('foundation', 1440, 900, '/foundation.html');
await screenshot(foundationPage, 'foundation-1440-light.png');
await runAxe(foundationPage, 'foundation');

const noJsPage = await browser.newPage();
observe(noJsPage, 'workspace-no-js');
await noJsPage.setJavaScriptEnabled(false);
await noJsPage.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
await noJsPage.goto(origin, { waitUntil: 'networkidle0' });
assert.match(await noJsPage.$eval('body', (element) => element.textContent ?? ''), /Simulated concept/);
assert.match(await noJsPage.$eval('body', (element) => element.textContent ?? ''), /Objects for a slower home/);
await screenshot(noJsPage, 'workspace-1280-no-js.png');

assert.deepEqual(consoleErrors, [], 'browser console errors detected');
assert.deepEqual(failedRequests, [], 'failed browser requests detected');
assert.deepEqual(externalRequests, [], 'external browser requests detected');

async function recursiveFiles(root, relative = '') {
  const entries = await readdir(join(root, relative), { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await recursiveFiles(root, path));
    if (entry.isFile()) files.push(path);
  }
  return files;
}

async function manifest(root, paths) {
  const records = [];
  for (const path of [...paths].sort()) {
    const bytes = await readFile(join(root, path));
    records.push({
      path: path.replaceAll('\\', '/'),
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
  return records;
}

const inputPaths = [
  'README.md',
  'build-preview.mjs',
  'check-preview-bundle.mjs',
  'check-preview.mjs',
  'foundation.html',
  'index.html',
  'package-lock.json',
  'package.json',
  'qa-preview.mjs',
  'src/App.tsx',
  'src/components.css',
  'src/foundation.css',
  'src/foundation.tsx',
  'src/main.css',
  'src/main.tsx',
  'src/workspace.css',
  'tokens/monument.tokens.json',
  'tokens/tokens.css',
  'tsconfig.json',
  'vite.config.ts',
];
const inputManifest = await manifest(previewRoot, inputPaths);
const artifactManifest = await manifest(buildRoot, await recursiveFiles(buildRoot));
const sourceDigest = createHash('sha256').update(JSON.stringify(inputManifest)).digest('hex');
const artifactDigest = createHash('sha256').update(JSON.stringify(artifactManifest)).digest('hex');
const candidateDigest = createHash('sha256')
  .update(JSON.stringify({ inputManifest, artifactManifest }))
  .digest('hex');
const browserVersion = await browser.version();

const browserResults = {
  date: new Date().toISOString(),
  sourceDigest,
  artifactDigest,
  candidateDigest,
  manifests: { inputs: inputManifest, artifacts: artifactManifest },
  browser: browserVersion,
  automation: 'puppeteer-core@25.5.0',
  viewports: ['1440x900', '1280x800', '390x844'],
  states: [
    'workspace-default',
    'workspace-working',
    'workspace-dark-complete',
    'inspector',
    'inspector-source',
    'inspector-content',
    'timeline-restore-confirmation',
    'proof-unknown',
    'proof-blocked',
    'command-palette',
    'global-shortcuts',
    'mobile-inspector',
    'foundation',
    'no-javascript',
  ],
  consoleErrors,
  failedRequests,
  externalRequests,
  expectedAbortedRequests,
  keyboard: {
    commandPaletteOpen: 'pass',
    commandPaletteShortcut: 'Control+K (shared Ctrl/Cmd handler)',
    arrowNavigationAndEnter: 'pass',
    focusContainment: 'pass',
    focusReturn: 'pass',
    shortcuts: ['M', 'D', 'I', 'P', 'V', 'T'],
  },
  geometry: { timeline: timelineGeometry, mobileInspector: mobileGeometry },
  screenshotCount: screenshots.length,
  screenshots,
  status: 'pass',
};

const axeResults = {
  date: new Date().toISOString(),
  sourceDigest,
  artifactDigest,
  candidateDigest,
  manifests: { inputs: inputManifest, artifacts: artifactManifest },
  engine: '@axe-core/puppeteer@4.12.1',
  states: axeStates,
  status: 'pass',
  failedChecksRetainedIn: '../2026-08-08-product-experience-refoundation.md',
};

await Promise.all([
  writeFile(join(outputRoot, 'browser-results.json'), `${JSON.stringify(browserResults, null, 2)}\n`),
  writeFile(join(outputRoot, 'axe-results.json'), `${JSON.stringify(axeResults, null, 2)}\n`),
]);

await browser.close();
await new Promise((resolve) => server.close(resolve));

console.log('Monument browser, keyboard, geometry, and accessibility QA: PASS');
