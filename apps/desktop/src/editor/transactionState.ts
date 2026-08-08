const pendingSourceTransactions = new Set<string>();

type Listener = (projectId: string, pending: boolean) => void;
const listeners = new Set<Listener>();

function emit(projectId: string, pending: boolean): void {
  for (const listener of listeners) listener(projectId, pending);
}

export function markSourceTransactionDirty(projectId: string): void {
  if (!projectId) return;
  pendingSourceTransactions.add(projectId);
  emit(projectId, true);
}

export function clearSourceTransactionDirty(projectId: string): void {
  if (!pendingSourceTransactions.delete(projectId)) return;
  emit(projectId, false);
}

export function hasPendingSourceTransaction(projectId: string | null | undefined): boolean {
  return Boolean(projectId && pendingSourceTransactions.has(projectId));
}

export function subscribeSourceTransactionState(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
