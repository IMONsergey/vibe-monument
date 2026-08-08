import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, 'src-tauri/icons/preview-icon.png.b64');
const target = join(root, 'src-tauri/icons/icon.png');

const encoded = (await readFile(source, 'utf8')).replace(/\s+/g, '');
const png = Buffer.from(encoded, 'base64');
const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
if (png.length < 1024 || !png.subarray(0, 8).equals(signature)) {
  throw new Error('Temporary Monument icon source is not a valid PNG payload.');
}
await writeFile(target, png);
console.log(`Monument preview icon installed: ${png.length} bytes`);
