/**
 * Product transport boundary.
 * In a Tauri build, calls are forwarded to the Rust host. In a normal browser,
 * an in-memory Codex-shaped demo server keeps the exact same client contract.
 */
export class TauriCodexTransport {
  constructor(tauri = globalThis.__TAURI__) {
    this.tauri = tauri;
    this.unlisten = [];
    this.onMessage = null;
    this.kind = 'native';
  }

  async connect(onMessage) {
    if (!this.tauri?.core?.invoke || !this.tauri?.event?.listen) {
      throw new Error('Tauri global API is not available');
    }
    this.onMessage = onMessage;
    globalThis.document?.body?.classList?.add('native-shell');
    this.unlisten.push(await this.tauri.event.listen('monument://codex-message', (event) => {
      this.onMessage?.(event.payload);
    }));
    this.unlisten.push(await this.tauri.event.listen('monument://codex-stderr', (event) => {
      console.debug('[codex]', event.payload);
    }));
    await this.tauri.core.invoke('codex_start', { options: null });
  }

  send(message) {
    void this.tauri.core.invoke('codex_send', { message }).catch((error) => {
      console.error('Failed to send message to Codex', error);
    });
  }

  async close() {
    for (const unlisten of this.unlisten.splice(0)) unlisten?.();
    await this.tauri?.core?.invoke?.('codex_stop');
  }
}

export class BrowserDemoCodexTransport {
  constructor() {
    this.kind = 'demo';
    this.onMessage = null;
    this.threads = [
      { id: 'thread-1', title: 'Refine launch hero', status: 'idle', cwd: '/demo/northstar', turns: [] },
      { id: 'thread-2', title: 'Mobile navigation', status: 'notLoaded', cwd: '/demo/northstar', turns: [] },
    ];
  }

  async connect(onMessage) { this.onMessage = onMessage; }

  send(message) {
    queueMicrotask(() => this.#dispatch(message));
  }

  async close() {}

  #result(id, result) { this.onMessage?.({ id, result }); }
  #notify(method, params) { this.onMessage?.({ method, params }); }

  #dispatch({ id, method, params = {} }) {
    if (method === 'initialized') return;
    if (method === 'initialize') return this.#result(id, {
      userAgent: 'monument-browser-demo/0.1',
      codexHome: '~/.codex',
      platformFamily: 'unix',
      platformOs: 'macos',
    });
    if (method === 'thread/list') return this.#result(id, { data: this.threads, nextCursor: null });
    if (method === 'thread/read' || method === 'thread/resume') {
      return this.#result(id, { thread: this.threads.find((thread) => thread.id === params.threadId) ?? null });
    }
    if (method === 'thread/fork') {
      const source = this.threads.find((thread) => thread.id === params.threadId);
      const fork = { ...source, id: `fork-${Date.now()}`, forkedFromId: source?.id, title: `${source?.title ?? 'Task'} · Variant` };
      this.threads.push(fork);
      this.#notify('thread/started', { thread: fork });
      return this.#result(id, { thread: fork });
    }
    if (method === 'turn/start') {
      const turn = { id: `turn-${Date.now()}`, status: 'inProgress', items: [] };
      this.#result(id, { turn });
      this.#notify('turn/started', { threadId: params.threadId, turn });
      setTimeout(() => this.#notify('item/agentMessage/delta', {
        threadId: params.threadId,
        turnId: turn.id,
        delta: 'I have the task context. I’ll make the smallest verifiable change first.',
      }), 35);
      setTimeout(() => this.#notify('turn/completed', {
        threadId: params.threadId,
        turn: { ...turn, status: 'completed' },
      }), 90);
      return;
    }
    if (method === 'skills/list') return this.#result(id, { data: [{ name: 'visual-qa' }, { name: 'inspect-codebase' }] });
    if (id != null) this.onMessage?.({ id, error: { code: -32601, message: `Method not found: ${method}` } });
  }
}

export function createCodexTransport(scope = globalThis) {
  return scope.__TAURI__ ? new TauriCodexTransport(scope.__TAURI__) : new BrowserDemoCodexTransport();
}
