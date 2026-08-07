import test from 'node:test';
import assert from 'node:assert/strict';
import { CodexAppServerClient } from '../src/codex/app-server-client.js';
import { CodexRuntimeController } from '../src/codex/runtime-controller.js';
import { BrowserDemoCodexTransport, TauriCodexTransport, createCodexTransport } from '../src/host/codex-transport.js';

test('browser demo uses the real Codex client contract end-to-end', async () => {
  const transport = new BrowserDemoCodexTransport();
  const client = new CodexAppServerClient(transport);
  let projection;
  const runtime = new CodexRuntimeController(client, {
    mode: transport.kind,
    onProjection: (next) => { projection = next; },
  });
  await runtime.connect();
  await runtime.sendText('thread-1', 'Make the hero calmer');
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(projection.activeTurn.status, 'completed');
  assert.match(projection.message, /smallest verifiable change/i);
});

test('Tauri transport invokes the native Codex runtime and forwards events', async () => {
  const listeners = new Map();
  const calls = [];
  const tauri = {
    core: { invoke: async (command, args) => { calls.push([command, args]); return { running: true }; } },
    event: { listen: async (name, listener) => { listeners.set(name, listener); return () => listeners.delete(name); } },
  };
  const transport = new TauriCodexTransport(tauri);
  let received;
  await transport.connect((message) => { received = message; });
  listeners.get('monument://codex-message')?.({ payload: { method: 'turn/started', params: {} } });
  transport.send({ id: 1, method: 'initialize', params: {} });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(received.method, 'turn/started');
  assert.equal(calls[0][0], 'codex_start');
  assert.equal(calls[1][0], 'codex_send');
  await transport.close();
  assert.equal(calls.at(-1)[0], 'codex_stop');
});

test('transport factory stays browser-safe without Tauri globals', () => {
  assert.equal(createCodexTransport({}).kind, 'demo');
});
