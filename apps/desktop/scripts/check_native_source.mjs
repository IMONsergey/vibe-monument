import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const conf = JSON.parse(await readFile(join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
const capability = JSON.parse(await readFile(join(root, 'src-tauri/capabilities/main-capability.json'), 'utf8'));
const codex = await readFile(join(root, 'src-tauri/src/codex_runtime.rs'), 'utf8');
const project = await readFile(join(root, 'src-tauri/src/project_runtime.rs'), 'utf8');
const processRuntime = await readFile(join(root, 'src-tauri/src/process_runtime.rs'), 'utf8');
const persistence = await readFile(join(root, 'src-tauri/src/persistence.rs'), 'utf8');
const app = await readFile(join(root, 'src/App.tsx'), 'utf8');
const entry = await readFile(join(root, 'src/main.tsx'), 'utf8');
const codexClient = await readFile(join(root, 'src/codex/client.ts'), 'utf8');
const codexProjection = await readFile(join(root, 'src/codex/runtime.ts'), 'utf8');

if (conf.app?.withGlobalTauri !== true) throw new Error('Tauri global API must remain enabled for the typed host boundary');
if (conf.build?.frontendDist !== '../dist') throw new Error('Tauri frontendDist drifted from the Vite build output');
if (conf.app?.windows?.[0]?.titleBarStyle !== 'Overlay') throw new Error('macOS title bar contract drifted');
if (!capability.permissions?.includes('core:default')) throw new Error('main capability must permit core event/listen APIs');

for (const token of ['app-server', '--stdio', 'monument://codex-message', 'codex_send', 'codex_stop', 'codex_protocol_probe', 'generate-json-schema']) {
  if (!codex.includes(token)) throw new Error(`Native Codex runtime missing ${token}`);
}
for (const token of ['project_open', 'project_inspect', 'package.json', 'status', '--porcelain=v1']) {
  if (!project.includes(token)) throw new Error(`Project runtime missing ${token}`);
}
for (const token of ['runtime_start', 'runtime_stop', 'monument://runtime-output', 'monument://runtime-url']) {
  if (!processRuntime.includes(token)) throw new Error(`Process runtime missing ${token}`);
}
for (const token of ['monument.sqlite', 'CREATE TABLE IF NOT EXISTS app_state', 'state_get', 'state_set']) {
  if (!persistence.includes(token)) throw new Error(`Persistence runtime missing ${token}`);
}

const productionSource = `${entry}\n${app}`;
if (productionSource.includes('mock-data') || productionSource.includes('BrowserDemoCodexTransport')) {
  throw new Error('Production Monument entrypoint must never depend on mock product data');
}
if (!app.includes('Tell Monument what to build or change')) throw new Error('Product-first composer contract drifted');
if (!app.includes('Under the hood')) throw new Error('Progressive disclosure developer surface is missing');
if (!app.includes('Run checks') || !app.includes('Codex wants to run a command')) throw new Error('Protocol diagnostics/approval UX is missing');

for (const token of ['onServerRequest', 'respond(', 'respondError(', 'Server overloaded', "input: [{ type: 'text', text }]"]) {
  if (!codexClient.includes(token)) throw new Error(`Codex client protocol gate missing ${token}`);
}
if (codexClient.includes('textElements')) throw new Error('Legacy textElements payload must not return to turn/start');
for (const token of [
  'item/commandExecution/requestApproval',
  'item/fileChange/requestApproval',
  'item/permissions/requestApproval',
  'item/tool/requestUserInput',
  'serverRequest/resolved',
  'resolveApproval',
  'answerUserInput',
]) {
  if (!codexProjection.includes(token)) throw new Error(`Codex runtime projection missing ${token}`);
}

for (const source of [codex, processRuntime]) {
  if (source.includes('sh -c') || source.includes('bash -c')) throw new Error('Native runtimes must not execute user work through an interpolated shell');
}

console.log('Monument production/native/protocol source contract: PASS');
