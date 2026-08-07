import type { ActivityItem, ApprovalRequest, CodexConnectionState, CodexThreadSummary } from '../types';
import { CodexClient } from './client';
import { NativeCodexTransport, type RpcMessage } from './transport';

type RuntimeSnapshot = {
  state: CodexConnectionState;
  threads: CodexThreadSummary[];
  activeThreadId: string | null;
  message: string;
  approval: ApprovalRequest | null;
  activity: ActivityItem[];
};

type Listener = (snapshot: RuntimeSnapshot) => void;

function nowId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function asThread(value: unknown): CodexThreadSummary | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string') return null;
  return {
    id: record.id,
    title: typeof record.title === 'string' ? record.title : undefined,
    cwd: typeof record.cwd === 'string' ? record.cwd : undefined,
    status: typeof record.status === 'string' ? record.status : undefined,
  };
}

export class CodexRuntime {
  private readonly client = new CodexClient(new NativeCodexTransport());
  private listeners = new Set<Listener>();
  private snapshot: RuntimeSnapshot = {
    state: 'idle',
    threads: [],
    activeThreadId: null,
    message: '',
    approval: null,
    activity: [],
  };

  constructor() {
    this.client.onNotification((message) => this.projectNotification(message));
    this.client.onServerRequest((message) => {
      this.patch({
        state: 'approval',
        approval: { id: message.id, method: message.method, params: message.params },
      });
      this.activity('system', 'Codex needs your input', message.method);
    });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  async connect(projectRoot?: string): Promise<void> {
    this.patch({ state: 'starting' });
    try {
      await this.client.connect();
      await this.refreshThreads(projectRoot);
      this.patch({ state: 'ready' });
      this.activity('system', 'Codex connected');
    } catch (error) {
      this.patch({ state: 'error' });
      this.activity('error', 'Codex is unavailable', String(error instanceof Error ? error.message : error));
      throw error;
    }
  }

  async refreshThreads(projectRoot?: string): Promise<void> {
    const result = await this.client.listThreads({});
    const threads = (result.data ?? []).map(asThread).filter((thread): thread is CodexThreadSummary => Boolean(thread));
    const scoped = projectRoot ? threads.filter((thread) => !thread.cwd || thread.cwd === projectRoot || thread.cwd.startsWith(`${projectRoot}/`)) : threads;
    this.patch({
      threads: scoped,
      activeThreadId: scoped.some((thread) => thread.id === this.snapshot.activeThreadId)
        ? this.snapshot.activeThreadId
        : scoped[0]?.id ?? null,
    });
  }

  selectThread(threadId: string): void {
    this.patch({ activeThreadId: threadId, message: '' });
  }

  async send(text: string, projectRoot: string): Promise<void> {
    let threadId = this.snapshot.activeThreadId;
    if (!threadId) {
      const created = await this.client.startThread({ cwd: projectRoot });
      const record = created as Record<string, unknown> | null;
      const thread = asThread(record?.thread ?? created);
      if (!thread) throw new Error('Codex did not return a thread id');
      threadId = thread.id;
      this.patch({ threads: [thread, ...this.snapshot.threads], activeThreadId: thread.id });
    }

    this.patch({ state: 'busy', message: '' });
    this.activity('thinking', 'Working on your request', text.length > 110 ? `${text.slice(0, 107)}…` : text);
    await this.client.startTurn(threadId, text, { cwd: projectRoot });
  }

  async interrupt(): Promise<void> {
    // The active turn id is intentionally not guessed from protocol shapes.
    // It will be wired from generated Codex protocol types in the next protocol gate.
    this.activity('system', 'Stop requested', 'Waiting for the active turn identifier from the protocol projection.');
  }

  async close(): Promise<void> {
    await this.client.close();
    this.patch({ state: 'idle' });
  }

  private projectNotification(message: RpcMessage): void {
    const params = (message.params ?? {}) as Record<string, unknown>;
    switch (message.method) {
      case 'thread/started': {
        const thread = asThread(params.thread ?? params);
        if (thread && !this.snapshot.threads.some((item) => item.id === thread.id)) {
          this.patch({ threads: [thread, ...this.snapshot.threads], activeThreadId: thread.id });
        }
        break;
      }
      case 'turn/started':
        this.patch({ state: 'busy', message: '' });
        break;
      case 'item/agentMessage/delta':
        if (typeof params.delta === 'string') this.patch({ message: this.snapshot.message + params.delta });
        break;
      case 'turn/diff/updated':
        this.activity('edit', 'Changes updated');
        break;
      case 'turn/completed':
        this.patch({ state: 'ready', approval: null });
        this.activity('review', 'Request completed', 'Monument will attach deterministic verification as the runtime layer comes online.');
        break;
      case 'turn/failed':
      case 'error':
        this.patch({ state: 'error' });
        this.activity('error', 'Codex run failed', JSON.stringify(params));
        break;
      default:
        if (message.method?.startsWith('item/started')) this.activity('system', 'Codex started an action');
        if (message.method?.startsWith('item/completed')) this.activity('system', 'Codex finished an action');
    }
  }

  private activity(kind: ActivityItem['kind'], title: string, detail?: string): void {
    this.patch({
      activity: [
        ...this.snapshot.activity,
        { id: nowId(kind), kind, title, detail, timestamp: Date.now() },
      ].slice(-80),
    });
  }

  private patch(patch: Partial<RuntimeSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener(this.snapshot);
  }
}
