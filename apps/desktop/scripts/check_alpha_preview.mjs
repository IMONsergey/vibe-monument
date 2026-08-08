import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const tauri = JSON.parse(await readFile(join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
const cargo = await readFile(join(root, 'src-tauri/Cargo.toml'), 'utf8');
const version = await readFile(join(root, 'src/version.ts'), 'utf8');
const workflow = await readFile(join(root, '../../.github/workflows/monument-intel-alpha-release.yml'), 'utf8');
const iconSource = (await readFile(join(root, 'src-tauri/icons/preview-icon.png.b64'), 'utf8')).replace(/\s+/g, '');

const expected = '0.2.0-alpha.10';
if (packageJson.version !== expected) throw new Error(`package version drift: ${packageJson.version}`);
if (tauri.version !== expected) throw new Error(`Tauri version drift: ${tauri.version}`);
if (!cargo.includes(`version = "${expected}"`)) throw new Error('Cargo version drift');
if (!version.includes(`'${expected}'`)) throw new Error('UI version drift');
if (!workflow.includes(`MONUMENT_VERSION: '${expected}'`)) throw new Error('release workflow version drift');
if (!packageJson.scripts['check:native'].includes('check_content_editing.mjs')) throw new Error('M2.4 content contract is not release-gated');
if (!packageJson.scripts.build.includes('prepare:icon')) throw new Error('build does not install preview icon');
if (iconSource.length < 1000) throw new Error('temporary icon payload missing');
const icon = Buffer.from(iconSource, 'base64');
if (!icon.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) throw new Error('temporary icon payload is not PNG');
if (!workflow.includes('x86_64-apple-darwin') || !workflow.includes('macos-15-intel')) throw new Error('Intel release target drift');
if (!workflow.includes('lipo -archs') || !workflow.includes('hdiutil attach')) throw new Error('DMG smoke verification missing');
console.log('Monument alpha.10 preview release contract: PASS');
