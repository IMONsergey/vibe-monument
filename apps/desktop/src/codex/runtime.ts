import type {
  ActivityItem,
  ApprovalRequest,
  CodexAccountSnapshot,
  CodexConnectionState,
  CodexLoginStart,
  CodexThreadSummary,
  SimpleApprovalDecision,
  UserInputQuestion,
} from '../types';
import { checkpointActiveTimelineTurn } from '../timeline/controller';
import { CodexClient } from './client';
import { NativeCodexTransport, type RpcMessage } from './transport';

export type RuntimeSnapshot = {
  state: CodexConnectionState;
  threads: CodexThreadSummary[];
  activeThreadId: string | null;
  activeTurnId: string | null;
  turnSerial: number;
  completionSerial: number;
  message: string;
  account: CodexAccountSnapshot | null;
  approval: ApprovalRequest | null;
  activity: ActivityItem[];
};

type Listener = (snapshot: RuntimeSnapshot) => void;
type ItemContext = { type?: string; command?: string; cwd?: string; changedPaths?: string[] };

const SIMPLE_DECISIONS = new Set<SimpleApprovalDecision>(['accept', 'acceptForSession', 'decline', 'cancel']);
const TIMELINE_RESTORED_EVENT = 'monument:timeline-restored';

function nowId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function asThread(value: unknown): CodexThreadSummary | null {
  const record = recordOf(value);
  if (typeof record.id !== 'string') return null;
  return {
    id: record.id,
    title: typeof record.name === 'string' ? record.name : typeof record.title === 'string' ? record.title : undefined,
    cwd: typeof record.cwd === 'string' ? record.cwd : undefined,
    status: typeof record.status === 'string' ? record.status : undefined,
  };
}

function asAccount(value: unknown): CodexAccountSnapshot {
  const result = recordOf(value);
  const accountValue = result.account;
  const account = accountValue && typeof accountValue === 'object' ? accountValue as Record<string, unknown> : null;
  const requiresOpenaiAuth = result.requiresOpenaiAuth !== false;
  return {
    accountType: account && typeof account.type === 'string' ? account.type : null,
    email: account && typeof account.email === 'string' ? account.email : null,
    planType: account && typeof account.planType === 'string' ? account.planType : null,
    requiresOpenaiAuth,
    readyForTurns: !requiresOpenaiAuth || Boolean(account),
  };
}

function asLoginStart(value: unknown): CodexLoginStart {
  const result = recordOf(value);
  return {
    type: typeof result.type === 'string' ? result.type : 'chatgpt',
    loginId: typeof result.loginId === 'string' ? result.loginId : null,
    authUrl: typeof result.authUrl === 'string' ? result.authUrl : null,
    verificationUrl: typeof result.verificationUrl === 'string' ? result.verificationUrl : null,
    userCode: typeof result.userCode === 'string' ? result.userCode : null,
  };
}

function objectId(value: unknown): string | null {
  const id = recordOf(value).id;
  return typeof id === 'string' ? id : null;
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value.join(' ');
  return undefined;
}

function simpleDecisions(value: unknown, fallback: SimpleApprovalDecision[]): SimpleApprovalDecision[] {
  if (!Array.isArray(value)) return fallback;
  const decisions = value.filter((item): item is SimpleApprovalDecision => typeof item === 'string' && SIMPLE_DECISIONS.has(item as SimpleApprovalDecision));
  return decisions.length ? decisions : fallback.filter((item) => item === 'decline' || item === 'cancel');
}

function parseQuestions(value: unknown): UserInputQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const question = recordOf(entry);
    if (typeof question.id !== 'string' || typeof question.question !== 'string') return [];
    const options = Array.isArray(question.options)
      ? question.options.flatMap((entry) => {
          const option = recordOf(entry);
          return typeof option.label === 'string'
            ? [{ label: option.label, description: typeof option.description === 'string' ? option.description : undefined }]
            : [];
        })
      : undefined;
    return [{
      id: question.id,
      header: typeof question.header === 'string' ? question.header : undefined,
      question: question.question,
      isOther: question.isOther === true,
      isSecret: question.isSecret === true,
      options,
    }];
  });
}

function itemContext(value: unknown): ItemContext | null {
  const item = recordOf(value);
  const id = typeof item.id === 'string' ? item.id : null;
  if (!id) return null;
  const changes = Array.isArray(item.changes) ? item.changes : [];
  const changedPaths = changes.flatMap((change) => {
    const path = recordOf(change).path;
    return typeof path === 'string' ? [path] : [];
  });
  return {
    type: typeof item.type === 'string' ? item.type : undefined,
    command: stringValue(item.command),
    cwd: typeof item.cwd === 'string' ? item.cwd : undefined,
    changedPaths: changedPaths.length ? changedPaths : undefined,
  };
}

export class CodexRuntime {
  private readonly client = new CodexClient(new NativeCodexTransport());
  private listeners = new Set<Listener>();
  private connected = false;
  private itemContexts = new Map<string, ItemContext>();
  private snapshot: RuntimeSnapshot = {
    state: 'idle',
    threads: [],
    activeThreadId: null,
    activeTurnId: null,
    turnSerial: 0,
    completionSerial: 0,
    message: '',
    account: null,
    approval: null,
    activity: [],
  };

  constructor() {
    this.client.onNotification((message) => this.projectNotification(message));
    this.client.onServerRequest((message) => void this.handleServerRequest(message));
    if (typeof window !== 'undefined') {
      window.addEventListener(TIMELINE_RESTORED_EVENT, this.handleTimelineRestore);
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => { this.listeners.delete(listener); };
  }

  async connect(projectRoot?: string): Promise<void> {
    if (this.connected) {
      await Promise.all([this.refreshThreads(projectRoot), this.refreshAccount(false)]);
      return;
    }
    this.patch({ state: 'starting' });
    try {
      await this.client.connect();
      this.connected = true;
      const account = await this.refreshAccount(false);
      await this.refreshThreads(projectRoot);
      this.patch({ state: account.readyForTurns ? 'ready' : 'auth-required' });
      this.activity('system', account.readyForTurns ? 'Codex connected' : 'Codex sign-in required', account.email ?? undefined);
    } catch (error) {
      this.connected = false;
      this.patch({ state: 'error' });
      this.activity('error', 'Codex is unavailable', String(error instanceof Error ? error.message : error));
      throw error;
    }
  }

  async refreshAccount(refreshToken = false): Promise<CodexAccountSnapshot> {
    if (!this.connected) throw new Error('Codex is not connected');
    const account = asAccount(await this.client.readAccount(refreshToken));
    const nextState = account.readyForTurns
      ? (this.snapshot.state === 'auth-required' ? 'ready' : this.snapshot.state)
      : (this.snapshot.state === 'busy' || this.snapshot.state === 'approval' ? this.snapshot.state : 'auth-required');
    this.patch({ account, state: nextState });
    return account;
  }

  async startChatGptLogin(): Promise<CodexLoginStart> {
    if (!this.connected) throw new Error('Codex is not connected');
    const login = asLoginStart(await this.client.startChatGptLogin());
    this.activity('system', 'ChatGPT sign-in started');
    return login;
  }

  async refreshThreads(projectRoot?: string): Promise<void> {
    if (!this.connected) return;
    const result = await this.client.listThreads(projectRoot ? { cwd: projectRoot } : {});
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
    this.patch({ activeThreadId: threadId, activeTurnId: null, message: '', approval: null });
  }

  newTask(): void {
    this.patch({ activeThreadId: null, activeTurnId: null, message: '', approval: null });
  }

  async send(text: string, projectRoot: string): Promise<void> {
    if (!this.connected) throw new Error('Codex is not connected');
    if (this.snapshot.account && !this.snapshot.account.readyForTurns) throw new Error('Sign in to Codex before starting a task');
    let threadId = this.snapshot.activeThreadId;
    if (!threadId) {
      const created = await this.client.startThread({ cwd: projectRoot });
      const record = recordOf(created);
      const thread = asThread(record.thread ?? created);
      if (!thread) throw new Error('Codex did not return a thread id');
      threadId = thread.id;
      this.patch({ threads: [thread, ...this.snapshot.threads], activeThreadId: thread.id });
    }

    this.patch({ state: 'busy', message: '', approval: null });
    this.activity('thinking', 'Working on your request', text.length > 110 ? `${text.slice(0, 107)}…` : text);
    const started = await this.client.startTurn(threadId, text, { cwd: projectRoot });
    const response = recordOf(started);
    const turnId = objectId(response.turn ?? started);
    if (turnId) this.patch({ activeTurnId: turnId });
  }

  async resolveApproval(decision: SimpleApprovalDecision): Promise<void> {
    const request = this.snapshot.approval;
    if (!request) return;

    if (request.kind === 'command' || request.kind === 'file-change') {
      if (!request.availableDecisions.includes(decision)) throw new Error(`Codex did not offer ${decision} for this request`);
      await this.client.respond(request.id, { decision });
    } else if (request.kind === 'permissions') {
      if (decision === 'accept' || decision === 'acceptForSession') {
        const requested = request.params.permissions;
        await this.client.respond(request.id, {
          scope: decision === 'acceptForSession' ? 'session' : 'turn',
          permissions: requested && typeof requested === 'object' ? requested : {},
        });
      } else {
        await this.client.respond(request.id, { scope: 'turn', permissions: {} });
      }
    } else if (request.kind === 'elicitation') {
      if (decision !== 'decline' && decision !== 'cancel') throw new Error('Structured MCP input is not yet accepted by Monument');
      await this.client.respond(request.id, { action: decision, content: null });
    } else {
      throw new Error(`Request ${request.method} requires a dedicated response UI`);
    }

    this.activity('system', decision === 'accept' || decision === 'acceptForSession' ? 'Permission approved' : 'Permission declined', request.reason);
    this.patch({ approval: null, state: 'busy' });
  }

  async answerUserInput(answers: Record<string, string[]>): Promise<void> {
    const request = this.snapshot.approval;
    if (!request || request.kind !== 'user-input') return;
    const allowedIds = new Set((request.questions ?? []).map((question) => question.id));
    const payload = Object.fromEntries(
      Object.entries(answers)
        .filter(([id]) => allowedIds.has(id))
        .map(([id, values]) => [id, { answers: values.filter((value) => value.trim().length > 0) }]),
    );
    await this.client.respond(request.id, { answers: payload });
    this.activity('system', 'Answered Codex question');
    this.patch({ approval: null, state: 'busy' });
  }

  async interrupt(): Promise<void> {
    const { activeThreadId, activeTurnId } = this.snapshot;
    if (!activeThreadId || !activeTurnId) return;
    await this.client.interruptTurn(activeThreadId, activeTurnId);
    this.activity('system', 'Stop requested');
  }

  async close(): Promise<void> {
    if (this.connected) await this.client.close();
    this.connected = false;
    this.patch({ state: 'idle', activeTurnId: null, account: null });
  }

  private readonly handleTimelineRestore = () => {
    if (this.snapshot.activeTurnId || this.snapshot.state === 'busy' || this.snapshot.state === 'approval') return;
    this.newTask();
    this.activity('system', 'Clean Codex context', 'The restored version will continue in a new task; previous tasks stay in history.');
  };

  private async finalizeCompletedTurn({
    codexThreadId,
    codexTurnId,
    turnSerial,
  }: {
    codexThreadId: string | null;
    codexTurnId: string | null;
    turnSerial: number;
  }): Promise<void> {
    try {
      await checkpointActiveTimelineTurn({ codexThreadId, codexTurnId, turnSerial });
    } catch (error) {
      this.activity('error', 'Could not save version checkpoint', String(error instanceof Error ? error.message : error));
    }
    this.patch({
      state: this.snapshot.account?.readyForTurns === false ? 'auth-required' : 'ready',
      approval: null,
      activeTurnId: null,
      completionSerial: this.snapshot.completionSerial + 1,
    });
    this.activity('review', 'Request completed', 'Version checkpoint finalized; verification starts separately.');
  }

  private async handleServerRequest(message: Required<Pick<RpcMessage, 'id' | 'method'>> & RpcMessage): Promise<void> {
    const params = recordOf(message.params);
    const itemId = typeof params.itemId === 'string' ? params.itemId : undefined;
    const context = itemId ? this.itemContexts.get(itemId) : undefined;
    let approval: ApprovalRequest | null = null;

    if (message.method === 'item/commandExecution/requestApproval') {
      approval = {
        id: message.id,
        method: message.method,
        kind: 'command',
        params,
        reason: typeof params.reason === 'string' ? params.reason : undefined,
        command: stringValue(params.command) ?? context?.command,
        cwd: typeof params.cwd === 'string' ? params.cwd : context?.cwd,
        availableDecisions: simpleDecisions(params.availableDecisions, ['accept', 'acceptForSession', 'decline', 'cancel']),
      };
    } else if (message.method === 'item/fileChange/requestApproval') {
      approval = {
        id: message.id,
        method: message.method,
        kind: 'file-change',
        params,
        reason: typeof params.reason === 'string' ? params.reason : undefined,
        changedPaths: context?.changedPaths,
        availableDecisions: simpleDecisions(params.availableDecisions, ['accept', 'acceptForSession', 'decline', 'cancel']),
      };
    } else if (message.method === 'item/permissions/requestApproval') {
      approval = {
        id: message.id,
        method: message.method,
        kind: 'permissions',
        params,
        reason: typeof params.reason === 'string' ? params.reason : undefined,
        cwd: typeof params.cwd === 'string' ? params.cwd : undefined,
        availableDecisions: ['accept', 'acceptForSession', 'decline'],
      };
    } else if (message.method === 'item/tool/requestUserInput') {
      approval = {
        id: message.id,
        method: message.method,
        kind: 'user-input',
        params,
        questions: parseQuestions(params.questions),
        isBlocking: params.isBlocking !== false,
        availableDecisions: [],
      };
    } else if (message.method === 'mcpServer/elicitation/request') {
      approval = {
        id: message.id,
        method: message.method,
        kind: 'elicitation',
        params,
        reason: typeof params.message === 'string' ? params.message : undefined,
        availableDecisions: ['decline', 'cancel'],
      };
    }

    if (!approval) {
      await this.client.respondError(message.id, -32601, `Monument does not support server request ${message.method}`);
      this.activity('error', 'Unsupported Codex request', message.method);
      return;
    }

    this.patch({ state: 'approval', approval });
    this.activity('system', approval.kind === 'user-input' ? 'Codex has a question' : 'Codex needs your approval', approval.reason ?? approval.command ?? approval.method);
  }

  private projectNotification(message: RpcMessage): void {
    const params = recordOf(message.params);
    switch (message.method) {
      case 'thread/started': {
        const thread = asThread(params.thread ?? params);
        if (thread && !this.snapshot.threads.some((item) => item.id === thread.id)) {
          this.patch({ threads: [thread, ...this.snapshot.threads], activeThreadId: thread.id });
        }
        break;
      }
      case 'turn/started':
        this.patch({
          state: 'busy',
          message: '',
          activeTurnId: objectId(params.turn) ?? this.snapshot.activeTurnId,
          turnSerial: this.snapshot.turnSerial + 1,
        });
        break;
      case 'item/started': {
        const item = recordOf(params.item);
        const id = typeof item.id === 'string' ? item.id : null;
        const context = itemContext(item);
        if (id && context) this.itemContexts.set(id, context);
        if (context?.type === 'commandExecution') this.activity('command', 'Running command', context.command);
        if (context?.type === 'fileChange') this.activity('edit', 'Preparing file changes', context.changedPaths?.join(' · '));
        break;
      }
      case 'item/completed': {
        const item = recordOf(params.item);
        const id = typeof item.id === 'string' ? item.id : null;
        const context = itemContext(item);
        if (id && context) this.itemContexts.set(id, context);
        if (context?.type === 'commandExecution') this.activity('command', 'Command finished', context.command);
        if (context?.type === 'fileChange') this.activity('edit', 'Files updated', context.changedPaths?.join(' · '));
        break;
      }
      case 'item/agentMessage/delta':
        if (typeof params.delta === 'string') this.patch({ message: this.snapshot.message + params.delta });
        break;
      case 'turn/diff/updated':
        this.activity('edit', 'Changes updated');
        break;
      case 'serverRequest/resolved': {
        const requestId = params.requestId;
        if (this.snapshot.approval && requestId === this.snapshot.approval.id) this.patch({ approval: null, state: 'busy' });
        break;
      }
      case 'account/updated':
        void this.refreshAccount(false).catch((error) => this.activity('error', 'Could not refresh Codex account', String(error instanceof Error ? error.message : error)));
        break;
      case 'account/login/completed':
        if (params.success === true) {
          this.activity('system', 'ChatGPT sign-in completed');
          void this.refreshAccount(true).catch((error) => this.activity('error', 'Could not refresh Codex account', String(error instanceof Error ? error.message : error)));
        } else {
          this.patch({ state: 'auth-required' });
          this.activity('error', 'ChatGPT sign-in failed', typeof params.error === 'string' ? params.error : undefined);
        }
        break;
      case 'turn/completed': {
        const codexThreadId = this.snapshot.activeThreadId;
        const codexTurnId = objectId(params.turn) ?? this.snapshot.activeTurnId;
        const turnSerial = this.snapshot.turnSerial;
        this.patch({ state: 'busy', approval: null, activeTurnId: null });
        void this.finalizeCompletedTurn({ codexThreadId, codexTurnId, turnSerial });
        break;
      }
      case 'turn/failed':
      case 'error':
        this.patch({ state: 'error', activeTurnId: null, approval: null });
        this.activity('error', 'Codex run failed', JSON.stringify(params));
        break;
      default:
        break;
    }
  }

  private activity(kind: ActivityItem['kind'], title: string, detail?: string): void {
    this.patch({
      activity: [
        ...this.snapshot.activity,
        { id: nowId(kind), kind, title, detail, timestamp: Date.now() },
      ].slice(-120),
    });
  }

  private patch(patch: Partial<RuntimeSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener(this.snapshot);
  }
}
