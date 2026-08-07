/**
 * Thin protocol client for Codex app-server.
 * The browser prototype uses a mock transport. The native shell will provide
 * a transport backed by one managed `codex app-server` process over a local
 * Unix socket / stdio bridge.
 */
export class CodexAppServerClient {
  constructor(transport, clientInfo = { name: 'monument_desktop', title: 'Monument', version: '0.1.0' }) {
    this.transport = transport;
    this.clientInfo = clientInfo;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.initialized = false;
  }

  async connect() {
    await this.transport.connect((message) => this.#handle(message));
    const result = await this.request('initialize', { clientInfo: this.clientInfo });
    this.transport.send({ method: 'initialized', params: {} });
    this.initialized = true;
    return result;
  }

  request(method, params = {}) {
    const id = this.nextId++;
    const payload = { id, method, params };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.transport.send(payload);
    });
  }

  on(method, listener) {
    if (!this.listeners.has(method)) this.listeners.set(method, new Set());
    this.listeners.get(method).add(listener);
    return () => this.listeners.get(method)?.delete(listener);
  }

  listThreads(params = {}) { return this.request('thread/list', params); }
  readThread(id, includeTurns = true) { return this.request('thread/read', { threadId: id, includeTurns }); }
  resumeThread(id, params = {}) { return this.request('thread/resume', { threadId: id, ...params }); }
  forkThread(id, params = {}) { return this.request('thread/fork', { threadId: id, ...params }); }
  startTurn(threadId, input, params = {}) { return this.request('turn/start', { threadId, input, ...params }); }
  interruptTurn(threadId, turnId) { return this.request('turn/interrupt', { threadId, turnId }); }
  listSkills(params = {}) { return this.request('skills/list', params); }

  #handle(message) {
    if (message.id != null && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) pending.reject(message.error);
      else pending.resolve(message.result);
      return;
    }
    if (!message.method) return;
    this.listeners.get(message.method)?.forEach((listener) => listener(message.params));
    this.listeners.get('*')?.forEach((listener) => listener(message));
  }
}

export class MockCodexTransport {
  async connect(onMessage) { this.onMessage = onMessage; }
  send(payload) {
    if (payload.method === 'initialize') {
      queueMicrotask(() => this.onMessage({ id: payload.id, result: { codexHome: '~/.codex', platformFamily: 'unix', platformOs: 'macos' } }));
    }
  }
}
