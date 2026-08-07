import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CodexAppServerClient } from '../src/codex/app-server-client.js';
import { NodeStdioTransport } from '../native/stdio-transport.mjs';
import { createProjection, projectCodexEvent } from '../src/codex/event-projector.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const fake = join(HERE, '..', 'native', 'fake-codex-app-server.mjs');

test('managed stdio transport completes Codex handshake and thread lifecycle', async () => {
  const transport = new NodeStdioTransport({ command: process.execPath, args: [fake] });
  const client = new CodexAppServerClient(transport);
  const init = await client.connect();
  assert.equal(init.platformOs, 'macos');

  const listed = await client.listThreads();
  assert.equal(listed.data.length, 2);
  assert.equal(listed.data[0].title, 'Refine launch hero');

  const forked = await client.forkThread('thread-1');
  assert.equal(forked.thread.forkedFromId, 'thread-1');

  await transport.close();
});

test('raw Codex notifications project into product-level task state', () => {
  let p = createProjection();
  p = projectCodexEvent(p, { method: 'turn/started', params: { turn: { id: 't1', status: 'inProgress' } } });
  p = projectCodexEvent(p, { method: 'item/agentMessage/delta', params: { delta: 'Hello ' } });
  p = projectCodexEvent(p, { method: 'item/agentMessage/delta', params: { delta: 'world' } });
  p = projectCodexEvent(p, { method: 'turn/completed', params: { turn: { id: 't1', status: 'completed' }, usage: { outputTokens: 2 } } });
  assert.equal(p.message, 'Hello world');
  assert.equal(p.activeTurn.status, 'completed');
  assert.equal(p.events.at(-1).label, 'Turn completed');
});
