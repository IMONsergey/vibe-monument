export const CODEX_REVIEW_REQUEST_EVENT = 'monument:codex-review-request';

export type CodexReviewStatus = 'idle' | 'working' | 'ready' | 'error';

export interface CodexReviewRequest {
  projectRoot: string;
  target?: Record<string, unknown>;
}

export interface CodexReviewState {
  status: CodexReviewStatus;
  text: string;
  reviewThreadId: string | null;
  turnId: string | null;
  error: string | null;
  startedAt: number | null;
}

type Listener = (state: CodexReviewState) => void;

const EMPTY_REVIEW: CodexReviewState = {
  status: 'idle',
  text: '',
  reviewThreadId: null,
  turnId: null,
  error: null,
  startedAt: null,
};

let current: CodexReviewState = EMPTY_REVIEW;
const listeners = new Set<Listener>();

export function requestCodexReview(request: CodexReviewRequest): boolean {
  if (typeof window === 'undefined') return false;
  window.dispatchEvent(new CustomEvent<CodexReviewRequest>(CODEX_REVIEW_REQUEST_EVENT, { detail: request }));
  return true;
}

export function publishCodexReviewState(state: CodexReviewState): void {
  current = state;
  for (const listener of listeners) listener(state);
}

export function subscribeCodexReview(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}

export function clearCodexReview(): void {
  publishCodexReviewState(EMPTY_REVIEW);
}
