import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const conf = JSON.parse(await readFile(join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const capability = JSON.parse(await readFile(join(root, 'src-tauri/capabilities/main-capability.json'), 'utf8'));
const cargo = await readFile(join(root, 'src-tauri/Cargo.toml'), 'utf8');
const releaseWorkflow = await readFile(join(root, '../../.github/workflows/monument-intel-alpha-release.yml'), 'utf8');
const versionModule = await readFile(join(root, 'src/version.ts'), 'utf8');
const codex = await readFile(join(root, 'src-tauri/src/codex_runtime.rs'), 'utf8');
const project = await readFile(join(root, 'src-tauri/src/project_runtime.rs'), 'utf8');
const processRuntime = await readFile(join(root, 'src-tauri/src/process_runtime.rs'), 'utf8');
const previewRuntime = await readFile(join(root, 'src-tauri/src/preview_runtime.rs'), 'utf8');
const sourceLocator = await readFile(join(root, 'src-tauri/src/source_locator.rs'), 'utf8');
const timelineRuntime = await readFile(join(root, 'src-tauri/src/timeline_runtime.rs'), 'utf8');
const timelineCursor = await readFile(join(root, 'src-tauri/src/timeline_cursor.rs'), 'utf8');
const persistence = await readFile(join(root, 'src-tauri/src/persistence.rs'), 'utf8');
const systemRuntime = await readFile(join(root, 'src-tauri/src/system_runtime.rs'), 'utf8');
const app = await readFile(join(root, 'src/App.tsx'), 'utf8');
const entry = await readFile(join(root, 'src/main.tsx'), 'utf8');
const approval = await readFile(join(root, 'src/components/ApprovalCard.tsx'), 'utf8');
const diagnostics = await readFile(join(root, 'src/components/DiagnosticsPanel.tsx'), 'utf8');
const versionPanel = await readFile(join(root, 'src/components/VersionTimelinePanel.tsx'), 'utf8');
const timelineController = await readFile(join(root, 'src/timeline/controller.ts'), 'utf8');
const nativePreview = await readFile(join(root, 'src/preview/NativePreview.tsx'), 'utf8');
const selection = await readFile(join(root, 'src/preview/selection.ts'), 'utf8');
const turnContext = await readFile(join(root, 'src/context/turn.ts'), 'utf8');
const codexClient = await readFile(join(root, 'src/codex/client.ts'), 'utf8');
const codexProjection = await readFile(join(root, 'src/codex/runtime.ts'), 'utf8');

if (conf.app?.withGlobalTauri !== true) throw new Error('Tauri global API must remain enabled for the typed host boundary');
if (conf.build?.frontendDist !== '../dist') throw new Error('Tauri frontendDist drifted from the Vite build output');
if (conf.app?.windows?.[0]?.titleBarStyle !== 'Overlay') throw new Error('macOS title bar contract drifted');
if (!capability.permissions?.includes('core:default')) throw new Error('main capability must permit core event/listen APIs');
if (!cargo.includes('features = ["unstable"]')) throw new Error('Native child preview currently requires the explicit Tauri unstable feature');

const cargoVersion = cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
const uiVersion = versionModule.match(/MONUMENT_VERSION\s*=\s*'([^']+)'/)?.[1];
const versions = [packageJson.version, conf.version, cargoVersion, uiVersion];
if (versions.some((version) => version !== packageJson.version)) throw new Error(`Monument version drift: ${versions.join(' | ')}`);
if (!releaseWorkflow.includes(`MONUMENT_VERSION: '${packageJson.version}'`)) throw new Error('Intel release workflow version drifted from the app version');
if (!releaseWorkflow.includes(`monument-v${packageJson.version}-intel`)) throw new Error('Intel release tag drifted from the app version');
if (!releaseWorkflow.includes('hdiutil attach') || !releaseWorkflow.includes('lipo -archs') || !releaseWorkflow.includes('gh release create')) throw new Error('Intel release must build, mount/smoke and publish the explicit DMG');
if (!releaseWorkflow.includes('failed_stage')) throw new Error('Intel release failure marker must identify the failed stage');

for (const token of ['app-server', '--stdio', 'monument://codex-message', 'codex_send', 'codex_stop', 'codex_protocol_probe', 'generate-json-schema']) {
  if (!codex.includes(token)) throw new Error(`Native Codex runtime missing ${token}`);
}
for (const token of ['project_open', 'project_inspect', 'package.json', 'status', '--porcelain=v1']) {
  if (!project.includes(token)) throw new Error(`Project runtime missing ${token}`);
}
for (const token of ['runtime_start', 'runtime_stop', 'monument://runtime-output', 'monument://runtime-url']) {
  if (!processRuntime.includes(token)) throw new Error(`Process runtime missing ${token}`);
}
for (const token of ['preview_open', 'preview_set_bounds', 'preview_set_inspect', 'preview_close', 'WebviewBuilder', 'initialization_script', 'monument://preview-selection', '__MONUMENT_SELECTION__:', 'localhost', '127.0.0.1', 'same_origin']) {
  if (!previewRuntime.includes(token)) throw new Error(`Preview inspector runtime missing ${token}`);
}
if (previewRuntime.includes('dangerousRemoteDomainIpcAccess')) throw new Error('Live preview must not gain broad remote Tauri IPC access');
for (const token of ['project_source_hints', 'MAX_FILES', 'MAX_FILE_BYTES', 'tsx', 'vue', 'svelte', 'score_line']) {
  if (!sourceLocator.includes(token)) throw new Error(`Selected-element source locator missing ${token}`);
}
for (const token of ['monument.sqlite', 'CREATE TABLE IF NOT EXISTS app_state', 'state_get', 'state_set']) {
  if (!persistence.includes(token)) throw new Error(`Persistence runtime missing ${token}`);
}
for (const token of ['system_open_external', '/usr/bin/open', 'https://']) {
  if (!systemRuntime.includes(token)) throw new Error(`System runtime auth boundary missing ${token}`);
}

for (const token of [
  'timeline_init',
  'timeline_snapshot',
  'timeline_restore',
  'timeline_back',
  'timeline_forward',
  'timeline_diff',
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'refs/monument/checkpoints',
  'restore-safety',
  'Before restore',
  '.require_git(false)',
  '.env.example',
  'Restore blocked because unmanaged',
]) {
  if (!timelineRuntime.includes(token)) throw new Error(`Version Timeline runtime missing ${token}`);
}
if (timelineRuntime.includes('reset --hard') || timelineRuntime.includes('git reset')) throw new Error('Version Timeline must never reset the user repository');
if (!timelineCursor.includes('timeline_set_active_path')) throw new Error('Version Timeline fork navigation cursor is missing');
for (const token of ['prepareTimeline', 'rememberTimelinePrompt', 'checkpointCompletedTurn', 'timelineSetActivePath']) {
  if (!timelineController.includes(token)) throw new Error(`Version Timeline controller missing ${token}`);
}
for (const token of ['Versions', 'Save version', 'Restore', 'Compare', 'Going back never deletes later versions']) {
  if (!versionPanel.includes(token)) throw new Error(`Version Timeline product UX missing ${token}`);
}
for (const token of ['history-controls', 'VersionTimelinePanel', 'checkpointCompletedTurn', 'rememberTimelinePrompt', 'event.metaKey', 'goTimelineBack', 'goTimelineForward']) {
  if (!app.includes(token)) throw new Error(`Version Timeline App integration missing ${token}`);
}
if (!entry.includes("./styles/timeline.css")) throw new Error('Version Timeline styles are not loaded');

const productionSource = `${entry}\n${app}\n${approval}\n${diagnostics}\n${nativePreview}\n${selection}\n${turnContext}\n${versionPanel}\n${timelineController}`;
if (productionSource.includes('mock-data') || productionSource.includes('BrowserDemoCodexTransport')) throw new Error('Production Monument entrypoint must never depend on mock product data');
if (!app.includes('Tell Monument what to build or change')) throw new Error('Product-first composer contract drifted');
if (!app.includes('Under the hood')) throw new Error('Progressive disclosure developer surface is missing');
if (!approval.includes('Codex wants to run a command')) throw new Error('Human-facing approval UX is missing');
if (!diagnostics.includes('Run checks')) throw new Error('Runtime diagnostics UX is missing');
if (!app.includes('Sign in with ChatGPT') || !app.includes('auth-required')) throw new Error('Codex managed auth recovery UX is missing');
if (!entry.includes("./styles/preview.css")) throw new Error('Native preview product styles are not loaded');
for (const token of ['NativePreview', 'compileTurnText', 'selected-context', 'selectionLabel']) {
  if (!app.includes(token)) throw new Error(`Select-to-Codex product flow missing ${token}`);
}
for (const token of ['preview_open', 'preview_set_bounds', 'preview_set_inspect', 'monument://preview-selection', "event.key.toLowerCase() !== 'i'"]) {
  if (!nativePreview.includes(token)) throw new Error(`NativePreview integration missing ${token}`);
}
for (const token of ['[Monument live element context]', 'Selector:', 'Computed styles:', 'Locate the owning source/component']) {
  if (!selection.includes(token)) throw new Error(`Live selection context compiler missing ${token}`);
}
for (const token of ['project_source_hints', '[Monument deterministic source hints]', 'search-ranked hints', 'selectionContext(selection)']) {
  if (!turnContext.includes(token)) throw new Error(`Selected turn enrichment missing ${token}`);
}
if (!app.includes('await compileTurnText(text, project.rootPath)')) throw new Error('Selected live/source context is not awaited before starting the Codex turn');

for (const token of ['onServerRequest', 'respond(', 'respondError(', '-32001', "input: [{ type: 'text', text }]", 'account/read', 'account/login/start']) {
  if (!codexClient.includes(token)) throw new Error(`Codex client protocol gate missing ${token}`);
}
if (codexClient.includes('textElements')) throw new Error('Legacy textElements payload must not return to turn/start');
for (const token of ['item/commandExecution/requestApproval', 'item/fileChange/requestApproval', 'item/permissions/requestApproval', 'item/tool/requestUserInput', 'serverRequest/resolved', 'account/login/completed', 'account/updated', 'resolveApproval', 'answerUserInput', 'startChatGptLogin']) {
  if (!codexProjection.includes(token)) throw new Error(`Codex runtime projection missing ${token}`);
}
for (const source of [codex, processRuntime, previewRuntime, sourceLocator, systemRuntime, timelineRuntime]) {
  if (source.includes('sh -c') || source.includes('bash -c')) throw new Error('Native runtimes must not execute user work through an interpolated shell');
}

console.log(`Monument ${packageJson.version} production/native/protocol/auth/preview/select/timeline/release contract: PASS`);
