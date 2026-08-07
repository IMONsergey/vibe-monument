import { createInterface } from 'node:readline';

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
const threads = [
  { id: 'thread-1', title: 'Refine launch hero', status: 'idle', cwd: '/tmp/northstar', turns: [] },
  { id: 'thread-2', title: 'Mobile navigation', status: 'notLoaded', cwd: '/tmp/northstar', turns: [] },
];

function write(message) { process.stdout.write(`${JSON.stringify(message)}\n`); }
function result(id, value) { write({ id, result: value }); }

rl.on('line', (line) => {
  const message = JSON.parse(line);
  const { id, method, params = {} } = message;
  if (method === 'initialized') return;
  if (method === 'initialize') return result(id, { userAgent: 'fake-codex/0.1', codexHome: '/tmp/.codex', platformFamily: 'unix', platformOs: 'macos' });
  if (method === 'thread/list') return result(id, { data: threads, nextCursor: null });
  if (method === 'thread/read') return result(id, { thread: threads.find(t => t.id === params.threadId) ?? null });
  if (method === 'thread/resume') return result(id, { thread: threads.find(t => t.id === params.threadId) ?? null });
  if (method === 'thread/fork') {
    const source = threads.find(t => t.id === params.threadId);
    const fork = { ...source, id: `fork-${Date.now()}`, forkedFromId: source?.id };
    threads.push(fork);
    write({ method: 'thread/started', params: { thread: fork } });
    return result(id, { thread: fork });
  }
  if (method === 'turn/start') {
    const turn = { id: `turn-${Date.now()}`, status: 'inProgress', items: [] };
    result(id, { turn });
    write({ method: 'turn/started', params: { threadId: params.threadId, turn } });
    write({ method: 'item/agentMessage/delta', params: { threadId: params.threadId, turnId: turn.id, delta: 'Working on it.' } });
    write({ method: 'turn/completed', params: { threadId: params.threadId, turn: { ...turn, status: 'completed' }, usage: { inputTokens: 10, outputTokens: 4 } } });
    return;
  }
  if (method === 'skills/list') return result(id, { data: [{ name: 'visual-qa' }, { name: 'inspect-codebase' }] });
  if (id != null) write({ id, error: { code: -32601, message: `Method not found: ${method}` } });
});
