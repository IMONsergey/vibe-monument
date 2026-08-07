import type { RepairFailureSummary } from './failure';
import {
  canAutoRetryRepair,
  createRepairState,
  finishRepairVerification,
  markRepairCheckpointing,
  markRepairCodexWorking,
  markRepairVerifying,
  startRepairAttempt,
  type RepairState,
} from './state';
import { loadRepairState, saveRepairState } from './persistence';

export interface RepairSession {
  projectId: string;
  sourceCheckpointId: string | null;
  state: RepairState;
  failure: RepairFailureSummary | null;
  updatedAt: number;
}

function now(): number {
  return Date.now();
}

function sessionKeyState(session: RepairSession): RepairState {
  return session.state;
}

export async function restoreRepairSession(
  projectId: string,
  currentFailure: RepairFailureSummary | null,
  sourceCheckpointId: string | null,
): Promise<RepairSession> {
  const stored = await loadRepairState(projectId).catch(() => null);
  const state = stored && stored.lastFingerprint === currentFailure?.fingerprint
    ? stored
    : createRepairState(currentFailure);
  return {
    projectId,
    sourceCheckpointId,
    state,
    failure: currentFailure,
    updatedAt: now(),
  };
}

async function persist(session: RepairSession): Promise<RepairSession> {
  await saveRepairState(session.projectId, sessionKeyState(session));
  return session;
}

export async function beginRepairSession(
  session: RepairSession,
  automatic: boolean,
): Promise<RepairSession> {
  const next = {
    ...session,
    state: startRepairAttempt(session.state, automatic),
    updatedAt: now(),
  };
  return persist(next);
}

export async function repairSessionCodexWorking(session: RepairSession): Promise<RepairSession> {
  return persist({ ...session, state: markRepairCodexWorking(session.state), updatedAt: now() });
}

export async function repairSessionCheckpointing(session: RepairSession): Promise<RepairSession> {
  return persist({ ...session, state: markRepairCheckpointing(session.state), updatedAt: now() });
}

export async function repairSessionVerifying(session: RepairSession): Promise<RepairSession> {
  return persist({ ...session, state: markRepairVerifying(session.state), updatedAt: now() });
}

export async function finishRepairSessionVerification(
  session: RepairSession,
  failure: RepairFailureSummary | null,
  sourceCheckpointId: string | null,
): Promise<RepairSession> {
  return persist({
    ...session,
    sourceCheckpointId,
    failure,
    state: finishRepairVerification(session.state, failure),
    updatedAt: now(),
  });
}

export function shouldAutoRetryRepair(session: RepairSession): boolean {
  return canAutoRetryRepair(session.state);
}
