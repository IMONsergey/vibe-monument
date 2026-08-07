import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const conf = JSON.parse(await readFile(join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
const capability = JSON.parse(await readFile(join(root, 'src-tauri/capabilities/main-capability.json'), 'utf8'));
const rust = await readFile(join(root, 'src-tauri/src/codex_runtime.rs'), 'utf8');

if (conf.app?.withGlobalTauri !== true) throw new Error('Tauri global API must be enabled for the dependency-free frontend adapter');
if (conf.build?.frontendDist !== '../dist') throw new Error('Tauri frontendDist drifted from the static build output');
if (conf.app?.windows?.[0]?.titleBarStyle !== 'Overlay') throw new Error('macOS title bar contract drifted');
if (!capability.permissions?.includes('core:default')) throw new Error('main capability must permit core event/listen APIs');
for (const token of ['app-server', '--stdio', 'monument://codex-message', 'codex_send', 'codex_stop']) {
  if (!rust.includes(token)) throw new Error(`Native Codex runtime missing ${token}`);
}
if (rust.includes('sh -c') || rust.includes('bash -c')) throw new Error('Native Codex runtime must not invoke Codex through a shell');
console.log('Monument native source contract: PASS');
