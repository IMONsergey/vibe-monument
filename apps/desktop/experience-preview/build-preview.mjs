import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const configFile = fileURLToPath(new URL('./vite.config.ts', import.meta.url));

await build({ configFile });
await import('./check-preview-bundle.mjs');
