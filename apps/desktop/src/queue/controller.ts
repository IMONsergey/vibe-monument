import { stateGet, stateSet } from '../host/native';
import type { PreviewSelection } from '../preview/selection';

export interface QueuedPrompt {
  id: string;
  projectId: string;
  text: string;
  selection: PreviewSelection | null;
  threadId: string | null;
  createdAt: number;
}

export interface PromptQueueState {
  projectId: string;
  paused: boolean;
  items: QueuedPrompt[];
}

type Listener = (state: PromptQueueState) => void;

const MAX_QUEUE_ITEMS = 20;
const MAX_PROMPT_CHARS = 8_000;
const states = new Map<string, PromptQueueState>();
const listeners = new Map<string, Set<Listener>>();

function key(projectId: string): string {
  return `prompt-queue:${projectId}`;
}

function empty(projectId: string): PromptQueueState {
  return { projectId, paused: false, items: [] };
}

function normalize(projectId: string, value: PromptQueueState | null): PromptQueueState {
  if (!value || value.projectId !== projectId || !Array.isArray(value.items)) return empty(projectId);
  const items = value.items.slice(0, MAX_QUEUE_ITEMS).flatMap((item) => {
    if (!item || item.projectId !== projectId || typeof item.id !== 'string' || typeof item.text !== 'string') return [];
    const text = item.text.trim().slice(0, MAX_PROMPT_CHARS);
    if (!text) return [];
    return [{
      id: item.id,
      projectId,
      text,
      selection: item.selection ?? null,
      threadId: typeof item.threadId === 'string' ? item.threadId : null,
      createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now(),
    }];
  });
  return { projectId, paused: Boolean(value.paused), items };
}

function publish(state: PromptQueueState): void {
  states.set(state.projectId, state);
  for (const listener of listeners.get(state.projectId) ?? []) listener(state);
}

async function persist(state: PromptQueueState): Promise<void> {
  await stateSet(key(state.projectId), state).catch(() => undefined);
}

async function mutate(projectId: string, apply: (current: PromptQueueState) => PromptQueueState): Promise<PromptQueueState> {
  const current = states.get(projectId) ?? normalize(projectId, await stateGet<PromptQueueState>(key(projectId)).catch(() => null));
  const next = apply(current);
  publish(next);
  await persist(next);
  return next;
}

export async function loadPromptQueue(projectId: string, pauseRestored = true): Promise<PromptQueueState> {
  const stored = normalize(projectId, await stateGet<PromptQueueState>(key(projectId)).catch(() => null));
  const state = pauseRestored && stored.items.length ? { ...stored, paused: true } : stored;
  publish(state);
  if (state.paused !== stored.paused) await persist(state);
  return state;
}

export function subscribePromptQueue(projectId: string, listener: Listener): () => void {
  const bucket = listeners.get(projectId) ?? new Set<Listener>();
  bucket.add(listener);
  listeners.set(projectId, bucket);
  listener(states.get(projectId) ?? empty(projectId));
  return () => {
    const current = listeners.get(projectId);
    current?.delete(listener);
    if (current && current.size === 0) listeners.delete(projectId);
  };
}

export async function enqueuePrompt(
  projectId: string,
  text: string,
  selection: PreviewSelection | null,
  threadId: string | null,
): Promise<PromptQueueState> {
  const normalizedText = text.trim().slice(0, MAX_PROMPT_CHARS);
  if (!normalizedText) return states.get(projectId) ?? empty(projectId);
  return mutate(projectId, (current) => {
    if (current.items.length >= MAX_QUEUE_ITEMS) throw new Error(`Prompt queue is limited to ${MAX_QUEUE_ITEMS} pending requests`);
    const item: QueuedPrompt = {
      id: `queued-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      projectId,
      text: normalizedText,
      selection,
      threadId,
      createdAt: Date.now(),
    };
    return { ...current, items: [...current.items, item] };
  });
}

export async function removeQueuedPrompt(projectId: string, itemId: string): Promise<PromptQueueState> {
  return mutate(projectId, (current) => ({ ...current, items: current.items.filter((item) => item.id !== itemId) }));
}

export async function moveQueuedPrompt(projectId: string, itemId: string, direction: -1 | 1): Promise<PromptQueueState> {
  return mutate(projectId, (current) => {
    const index = current.items.findIndex((item) => item.id === itemId);
    if (index < 0) return current;
    const target = index + direction;
    if (target < 0 || target >= current.items.length) return current;
    const items = [...current.items];
    [items[index], items[target]] = [items[target], items[index]];
    return { ...current, items };
  });
}

export async function setPromptQueuePaused(projectId: string, paused: boolean): Promise<PromptQueueState> {
  return mutate(projectId, (current) => ({ ...current, paused }));
}

export async function detachPromptQueueThreads(projectId: string): Promise<PromptQueueState> {
  return mutate(projectId, (current) => ({
    ...current,
    paused: current.items.length ? true : current.paused,
    items: current.items.map((item) => ({ ...item, threadId: null })),
  }));
}

export async function takeNextPrompt(projectId: string): Promise<{ item: QueuedPrompt | null; state: PromptQueueState }> {
  let item: QueuedPrompt | null = null;
  const state = await mutate(projectId, (current) => {
    if (current.paused || !current.items.length) return current;
    item = current.items[0];
    return { ...current, items: current.items.slice(1) };
  });
  return { item, state };
}

export async function restoreQueuedPromptToFront(projectId: string, item: QueuedPrompt): Promise<PromptQueueState> {
  return mutate(projectId, (current) => ({
    ...current,
    paused: true,
    items: [item, ...current.items.filter((candidate) => candidate.id !== item.id)].slice(0, MAX_QUEUE_ITEMS),
  }));
}
