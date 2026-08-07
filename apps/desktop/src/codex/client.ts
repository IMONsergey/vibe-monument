import type { CodexTransport, RpcMessage } from './transport';

export type NotificationHandler = (message: RpcMessage) => void;
export type ServerRequestHandler = (message: Required<Pick<RpcMessage, 'id' | 'method'>> & RpcMessage) => void;

type PendingRequest = {
  resolve(value: unknown): void;
  reject(reason: unknown): void;
  timer: number;
};

export class CodexRpcError extends Error {
  constructor(
    message: string,
    readonly code?: number,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = 'CodexRpcError';
  }
}

function normalizeRpcError(value: unknown): CodexRpcError {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return new CodexRpcError(
      typeof record.message === 'string' ? record.message : 'Codex request failed',
      typeof record.code === 'number' ? record.code : undefined,
      record.data,
    );
  }
  return new CodexRpcError(typeof value === 'string' ? value : 'Codex request failed');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export class CodexClient {
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private notificationHandlers = new Set<NotificationHandler>();
  private serverRequestHandlers = new Set<ServerRequestHandler>();

  constructor(private readonly transport: CodexTransport) {}

  async connect(): Promise<unknown> {
    await this.transport.connect(
      (message) => this.handleMessage(message),
      (line) => console.debug('[codex]', line),
    );
    const result = await this.request('initialize', {
      clientInfo: { name: 'monument_desktop', title: 'Monument', version: '0.2.0' },
      capabilities: {},
    });
    await this.notify('initialized', {});
    return result;
  }

  async close(): Promise<void> {
    for (const { reject, timer } of this.pending.values()) {
      window.clearTimeout(timer);
      reject(new Error('Codex connection closed'));
    }
    this.pending.clear();
    await this.transport.close();
  }

  onNotification(handler: NotificationHandler): () => void {
    this.notificationHandlers.add(handler);
    return () => this.notificationHandlers.delete(handler);
  }

  onServerRequest(handler: ServerRequestHandler): () => void {
    this.serverRequestHandlers.add(handler);
    return () => this.serverRequestHandlers.delete(handler);
  }

  async request<T = unknown>(method: string, params: unknown = {}): Promise<T> {
    const delays = [0, 120, 320, 800];
    let lastError: unknown;
    for (const delay of delays) {
      if (delay) await sleep(delay + Math.round(Math.random() * 80));
      try {
        return await this.requestOnce<T>(method, params);
      } catch (error) {
        lastError = error;
        if (!(error instanceof CodexRpcError) || error.code !== -32001) throw error;
      }
    }
    throw lastError;
  }

  async notify(method: string, params: unknown = {}): Promise<void> {
    await this.transport.send({ method, params });
  }

  async respond(id: string | number, result: unknown): Promise<void> {
    await this.transport.send({ id, result });
  }

  async respondError(id: string | number, code: number, message: string, data?: unknown): Promise<void> {
    await this.transport.send({ id, error: { code, message, ...(data === undefined ? {} : { data }) } });
  }

  listThreads(params: unknown = {}): Promise<{ data?: unknown[] }> {
    return this.request('thread/list', params);
  }

  readThread(threadId: string, includeTurns = true): Promise<unknown> {
    return this.request('thread/read', { threadId, includeTurns });
  }

  startThread(params: Record<string, unknown>): Promise<unknown> {
    return this.request('thread/start', params);
  }

  resumeThread(threadId: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return this.request('thread/resume', { threadId, ...params });
  }

  forkThread(threadId: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return this.request('thread/fork', { threadId, ...params });
  }

  startTurn(threadId: string, text: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return this.request('turn/start', {
      threadId,
      input: [{ type: 'text', text }],
      ...params,
    });
  }

  interruptTurn(threadId: string, turnId: string): Promise<unknown> {
    return this.request('turn/interrupt', { threadId, turnId });
  }

  readAccount(refreshToken = false): Promise<unknown> {
    return this.request('account/read', { refreshToken });
  }

  private async requestOnce<T>(method: string, params: unknown): Promise<T> {
    const id = this.nextId++;
    const response = new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new CodexRpcError(`${method} timed out`));
      }, 30_000);
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timer,
      });
    });

    try {
      await this.transport.send({ id, method, params });
    } catch (error) {
      const pending = this.pending.get(id);
      if (pending) window.clearTimeout(pending.timer);
      this.pending.delete(id);
      throw error;
    }
    return response;
  }

  private handleMessage(message: RpcMessage): void {
    if (message.id != null && message.method) {
      const request = message as Required<Pick<RpcMessage, 'id' | 'method'>> & RpcMessage;
      for (const handler of this.serverRequestHandlers) handler(request);
      return;
    }

    if (typeof message.id === 'number' && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id)!;
      window.clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error != null) pending.reject(normalizeRpcError(message.error));
      else pending.resolve(message.result);
      return;
    }

    if (message.method) {
      for (const handler of this.notificationHandlers) handler(message);
    }
  }
}
