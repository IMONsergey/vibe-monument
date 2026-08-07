import type { RepairFailureSummary } from './failure';
import { REPAIR_MAX_AUTOMATIC_ATTEMPTS } from './failure';

export type RepairStatus =
  | 'idle'
  | 'failure-available'
  | 'preparing'
  | 'codex-working'
  | 'checkpointing'
  | 'verifying'
  | 'passed'
  | 'failed-again'
  | 'stopped';

export type RepairStopReason =
  | 'attempt-limit'
  | 'repeated-failure'
  | 'cancelled'
  | 'no-failure-evidence'
  | null;

export interface RepairState {
  status: RepairStatus;
  automatic: boolean;
  attempt: number;
  maxAutomaticAttempts: number;
  initialFingerprint: string | null;
  lastFingerprint: string | null;
  stopReason: RepairStopReason;
}

export function createRepairState(summary: RepairFailureSummary | null): RepairState {
  return {
    status: summary ? 'failure-available' : 'idle',
    automatic: false,
    attempt: 0,
    maxAutomaticAttempts: REPAIR_MAX_AUTOMATIC_ATTEMPTS,
    initialFingerprint: summary?.fingerprint ?? null,
    lastFingerprint: summary?.fingerprint ?? null,
    stopReason: summary ? null : 'no-failure-evidence',
  };
}

export function startRepairAttempt(state: RepairState, automatic: boolean): RepairState {
  if (!state.lastFingerprint) {
    return { ...state, status: 'stopped', stopReason: 'no-failure-evidence' };
  }
  if (automatic && state.attempt >= state.maxAutomaticAttempts) {
    return { ...state, status: 'stopped', stopReason: 'attempt-limit' };
  }
  return {
    ...state,
    status: 'preparing',
    automatic,
    attempt: state.attempt + 1,
    stopReason: null,
  };
}

export function markRepairCodexWorking(state: RepairState): RepairState {
  return state.status === 'preparing' ? { ...state, status: 'codex-working' } : state;
}

export function markRepairCheckpointing(state: RepairState): RepairState {
  return state.status === 'codex-working' ? { ...state, status: 'checkpointing' } : state;
}

export function markRepairVerifying(state: RepairState): RepairState {
  return ['codex-working', 'checkpointing'].includes(state.status)
    ? { ...state, status: 'verifying' }
    : state;
}

export function finishRepairVerification(
  state: RepairState,
  nextFailure: RepairFailureSummary | null,
): RepairState {
  if (!nextFailure) {
    return { ...state, status: 'passed', lastFingerprint: null, stopReason: null };
  }

  if (nextFailure.fingerprint === state.lastFingerprint) {
    return {
      ...state,
      status: 'stopped',
      lastFingerprint: nextFailure.fingerprint,
      stopReason: 'repeated-failure',
    };
  }

  if (state.automatic && state.attempt >= state.maxAutomaticAttempts) {
    return {
      ...state,
      status: 'stopped',
      lastFingerprint: nextFailure.fingerprint,
      stopReason: 'attempt-limit',
    };
  }

  return {
    ...state,
    status: 'failed-again',
    lastFingerprint: nextFailure.fingerprint,
    stopReason: null,
  };
}

export function cancelRepair(state: RepairState): RepairState {
  return { ...state, status: 'stopped', stopReason: 'cancelled' };
}

export function canAutoRetryRepair(state: RepairState): boolean {
  return Boolean(
    state.lastFingerprint
      && state.status === 'failed-again'
      && state.attempt < state.maxAutomaticAttempts,
  );
}
