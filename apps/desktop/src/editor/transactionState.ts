export interface SourceTransactionCheckpointRef {
  checkpointId: string;
  turnSerial: number;
}

const pendingSourceTransactions = new Set<string>();
const unacknowledgedCheckpoints = new Map<string, SourceTransactionCheckpointRef>();
const validatingSourceTransactions = new Set<string>();

type Listener = (projectId: string) => void;
const listeners = new Set<Listener>();

function emit(projectId: string): void {
  for (const listener of listeners) listener(projectId);
}

export function markSourceTransactionDirty(projectId: string): void {
  if (!projectId) return;
  pendingSourceTransactions.add(projectId);
  emit(projectId);
}

export function clearSourceTransactionDirty(projectId: string): void {
  if (!pendingSourceTransactions.delete(projectId)) return;
  emit(projectId);
}

export function hasPendingSourceTransaction(projectId: string | null | undefined): boolean {
  return Boolean(projectId && pendingSourceTransactions.has(projectId));
}

export function recordSourceTransactionCheckpoint(projectId: string, checkpointId: string, turnSerial: number): void {
  if (!projectId || !checkpointId || !Number.isFinite(turnSerial) || turnSerial === 0) return;
  unacknowledgedCheckpoints.set(projectId, { checkpointId, turnSerial: Math.trunc(turnSerial) });
  emit(projectId);
}

export function acknowledgeSourceTransactionCheckpoint(projectId: string, currentCheckpointId: string | null | undefined): void {
  const pending = unacknowledgedCheckpoints.get(projectId);
  if (!pending || !currentCheckpointId || pending.checkpointId !== currentCheckpointId) return;
  unacknowledgedCheckpoints.delete(projectId);
  emit(projectId);
}

export function clearSourceTransactionCheckpoint(projectId: string): void {
  if (!unacknowledgedCheckpoints.delete(projectId)) return;
  emit(projectId);
}

export function hasUnacknowledgedSourceTransaction(projectId: string | null | undefined): boolean {
  return Boolean(projectId && unacknowledgedCheckpoints.has(projectId));
}

export function beginSourceTransactionValidation(projectId: string): void {
  if (!projectId) return;
  validatingSourceTransactions.add(projectId);
  emit(projectId);
}

export function endSourceTransactionValidation(projectId: string): void {
  if (!validatingSourceTransactions.delete(projectId)) return;
  emit(projectId);
}

export function isSourceTransactionValidationBusy(projectId: string | null | undefined): boolean {
  return Boolean(projectId && validatingSourceTransactions.has(projectId));
}

export function subscribeSourceTransactionState(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
