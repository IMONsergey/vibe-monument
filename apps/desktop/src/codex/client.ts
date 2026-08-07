import type { CodexTransport, RpcMessage } from './transport';

export type NotificationHandler = (message: RpcMessage) => void;
export type ServerRequestHandler = (message: Required<Pick<RpcMessage, 'id' | 'method'>> & RpcMessage) => void;

export class CodexClient {
  private nextId = 1;
  private pending = new Map<number, { resolve(value: unknown): void; reject(reason: unknown): void }>();
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
    });
    await this.notify('initialized', {});
    return result;
  }

  async close(): Promise<void> {
    for (const { reject } of this.pending.values()) reject(new Error('Codex connection closed'));
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
    const id = this.nextId++;
    const response = new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
    });
    await this.transport.send({ id, method, params });
    return response;
  }

  async notify(method: string, params: unknown = {}): Promise<void> {
    await this.transport.send({ method, params });
  }

  async respond(id: string | number, result: unknown): Promise<void> {
    await this.transport.send({ id, result });
  }

  async respondError(id: string | number, error: unknown): Promise<void> {
    await this.transport.send({ id, error });
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
      input: [{ type: 'text', text, textElements: [] }],
      ...params,
    });
  }

  interruptTurn(threadId: string, turnId: string): Promise<unknown> {
    return this.request('turn/interrupt', { threadId, turnId });
  }

  private handleMessage(message: RpcMessage): void {
    if (message.id != null && message.method) {
      const request = message as Required<Pick<RpcMessage, 'id' | 'method'>> & RpcMessage;
      for (const handler of this.serverRequestHandlers) handler(request);
      return;
    }

    if (typeof message.id === 'number' && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id)!;
      this.pending.delete(message.id);
      if (message.error != null) pending.reject(message.error);
      else pending.resolve(message.result);
      return;
    }

    if (message.method) {
      for (const handler of this.notificationHandlers) handler(message);
    }
  }
}
