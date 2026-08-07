export const CODEX_PLAN_REQUEST_EVENT = 'monument:codex-plan-request';
export const CODEX_PLAN_STATE_EVENT = 'monument:codex-plan-state';

export type CodexPlanStatus = 'idle' | 'working' | 'ready' | 'error';

export interface CodexPlanRequest {
  projectRoot: string;
  userText: string;
  compiledText: string;
}

export interface CodexPlanState {
  status: CodexPlanStatus;
  userText: string;
  text: string;
  threadId: string | null;
  turnId: string | null;
  error: string | null;
}

type Listener = (state: CodexPlanState) => void;

const EMPTY_PLAN: CodexPlanState = {
  status: 'idle',
  userText: '',
  text: '',
  threadId: null,
  turnId: null,
  error: null,
};

let current: CodexPlanState = EMPTY_PLAN;
const listeners = new Set<Listener>();

export function requestCodexPlan(request: CodexPlanRequest): boolean {
  if (typeof window === 'undefined') return false;
  window.dispatchEvent(new CustomEvent<CodexPlanRequest>(CODEX_PLAN_REQUEST_EVENT, { detail: request }));
  return true;
}

export function publishCodexPlanState(state: CodexPlanState): void {
  current = state;
  for (const listener of listeners) listener(state);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<CodexPlanState>(CODEX_PLAN_STATE_EVENT, { detail: state }));
  }
}

export function subscribeCodexPlan(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}

export function clearCodexPlan(): void {
  publishCodexPlanState(EMPTY_PLAN);
}
