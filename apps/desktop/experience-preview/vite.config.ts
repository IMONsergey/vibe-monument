import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const previewRoot = fileURLToPath(new URL('.', import.meta.url));

function stripUnusedRemoteKatexFonts() {
  return {
    name: 'monument-strip-unused-remote-katex-fonts',
    apply: 'build' as const,
    enforce: 'post' as const,
    generateBundle(_options: unknown, bundle: Record<string, { type: string; source?: string | Uint8Array }>) {
      for (const [fileName, output] of Object.entries(bundle)) {
        if (output.type !== 'asset' || !fileName.endsWith('.css') || output.source === undefined) continue;

        const source = String(output.source);
        output.source = source.replace(
          /@font-face\{[^{}]*https:\/\/cdn\.openai\.com\/common\/fonts\/katex\/[^{}]*\}/g,
          '',
        );
      }
    },
  };
}

export default defineConfig({
  root: previewRoot,
  base: './',
  plugins: [react(), tailwindcss(), stripUnusedRemoteKatexFonts()],
  server: {
    host: '127.0.0.1',
    port: 4174,
    strictPort: true,
    hmr: false,
  },
  clearScreen: false,
  build: {
    target: 'es2022',
    sourcemap: true,
    modulePreload: { polyfill: false },
    outDir: '../dist-experience',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        workspace: fileURLToPath(new URL('./index.html', import.meta.url)),
        foundation: fileURLToPath(new URL('./foundation.html', import.meta.url)),
      },
    },
  },
});
