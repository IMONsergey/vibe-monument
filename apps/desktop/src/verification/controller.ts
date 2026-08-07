import { invokeNative, stateGet, stateSet } from '../host/native';
import { currentTimelineTurnSerial } from '../timeline/controller';
import { recordTimelineDeterministicQuality, type TimelineDeterministicStatus } from '../timeline/quality';

export interface VerificationPlanItem {
  script: string;
  command: string;
  automatic: boolean;
}

export interface VerificationResult {
  script: string;
  command: string;
  cwd: string;
  success: boolean;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  startedAtMs: number;
  stdout: string;
  stderr: string;
}

export interface VerificationEvidence {
  id: string;
  projectId: string;
  projectRoot: string;
  turnSerial: number;
  trigger: 'codex-turn' | 'manual';
  status: 'running' | 'passed' | 'failed' | 'no-checks' | 'error';
  startedAt: number;
  finishedAt: number | null;
  plan: VerificationPlanItem[];
  results: VerificationResult[];
  permissionRequired?: boolean;
  error?: string;
}

export type VerificationProgress = {
  evidence: VerificationEvidence;
  currentScript: string | null;
};

type Listener = (progress: VerificationProgress) => void;

const listeners = new Set<Listener>();
let current: VerificationProgress | null = null;

function evidenceKey(projectId: string): string {
  return `verification:${projectId}:latest`;
}

function autoVerificationKey(projectId: string): string {
  return `verification:auto:${projectId}`;
}

function emit(progress: VerificationProgress): void {
  current = progress;
  for (const listener of listeners) listener(progress);
}

function newEvidence(
  projectId: string,
  projectRoot: string,
  trigger: VerificationEvidence['trigger'],
  plan: VerificationPlanItem[],
  turnSerial: number,
): VerificationEvidence {
  return {
    id: `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    projectId,
    projectRoot,
    turnSerial,
    trigger,
    status: plan.some((item) => item.automatic) || trigger === 'manual' ? 'running' : 'no-checks',
    startedAt: Date.now(),
    finishedAt: null,
    plan,
    results: [],
  };
}

export function subscribeVerification(listener: Listener): () => void {
  listeners.add(listener);
  if (current) listener(current);
  return () => listeners.delete(listener);
}

export async function restoreVerification(projectId: string): Promise<VerificationProgress | null> {
  const evidence = await stateGet<VerificationEvidence>(evidenceKey(projectId)).catch(() => null);
  if (!evidence) return null;
  const restored = { evidence, currentScript: null };
  emit(restored);
  return restored;
}

export async function loadVerificationPlan(projectRoot: string): Promise<VerificationPlanItem[]> {
  return invokeNative<VerificationPlanItem[]>('verification_plan', { projectPath: projectRoot });
}

export async function isAutoVerificationEnabled(projectId: string): Promise<boolean> {
  return (await stateGet<boolean>(autoVerificationKey(projectId)).catch(() => null)) === true;
}

export async function setAutoVerificationEnabled(projectId: string, enabled: boolean): Promise<void> {
  await stateSet(autoVerificationKey(projectId), enabled);
}

async function persist(evidence: VerificationEvidence): Promise<void> {
  await stateSet(evidenceKey(evidence.projectId), evidence).catch(() => undefined);
}

function timelineStatusFor(evidence: VerificationEvidence): TimelineDeterministicStatus {
  if (evidence.permissionRequired) return 'permission-required';
  if (evidence.status === 'running') return 'not-run';
  return evidence.status;
}

async function persistFinal(evidence: VerificationEvidence): Promise<void> {
  await persist(evidence);
  if (evidence.turnSerial > 0) {
    const rawStatus = timelineStatusFor(evidence);
    const status: Exclude<TimelineDeterministicStatus, 'not-run'> = rawStatus === 'not-run' ? 'no-checks' : rawStatus;
    await recordTimelineDeterministicQuality(
      evidence.projectId,
      evidence.turnSerial,
      status,
      evidence.id,
    ).catch(() => undefined);
  }
}

export async function runVerification({
  projectId,
  projectRoot,
  trigger,
  includeManual = false,
  turnSerial = 0,
}: {
  projectId: string;
  projectRoot: string;
  trigger: VerificationEvidence['trigger'];
  includeManual?: boolean;
  turnSerial?: number;
}): Promise<VerificationEvidence> {
  const resolvedTurnSerial = trigger === 'manual'
    ? (await currentTimelineTurnSerial(projectId, turnSerial).catch(() => turnSerial)) ?? 0
    : turnSerial;
  let plan: VerificationPlanItem[] = [];
  try {
    plan = await loadVerificationPlan(projectRoot);
  } catch (error) {
    const evidence = newEvidence(projectId, projectRoot, trigger, [], resolvedTurnSerial);
    evidence.status = 'error';
    evidence.error = error instanceof Error ? error.message : String(error);
    evidence.finishedAt = Date.now();
    emit({ evidence, currentScript: null });
    await persistFinal(evidence);
    return evidence;
  }

  const evidence = newEvidence(projectId, projectRoot, trigger, plan, resolvedTurnSerial);
  const selected = plan.filter((item) => includeManual || item.automatic).slice(0, 5);
  if (!selected.length) {
    evidence.status = 'no-checks';
    evidence.finishedAt = Date.now();
    emit({ evidence, currentScript: null });
    await persistFinal(evidence);
    return evidence;
  }

  // Package scripts are repository code. A Codex completion is never permission to run them.
  // Automatic checks remain off until the user explicitly enables them for this project.
  if (trigger === 'codex-turn' && !includeManual && !(await isAutoVerificationEnabled(projectId))) {
    evidence.status = 'no-checks';
    evidence.permissionRequired = true;
    evidence.finishedAt = Date.now();
    emit({ evidence, currentScript: null });
    await persistFinal(evidence);
    return evidence;
  }

  emit({ evidence, currentScript: selected[0]?.script ?? null });
  await persist(evidence);

  try {
    for (const item of selected) {
      emit({ evidence: { ...evidence, results: [...evidence.results] }, currentScript: item.script });
      const result = await invokeNative<VerificationResult>('verification_run', { projectPath: projectRoot, script: item.script });
      evidence.results.push(result);
      await persist({ ...evidence, results: [...evidence.results] });
    }
    evidence.status = evidence.results.every((result) => result.success) ? 'passed' : 'failed';
    evidence.finishedAt = Date.now();
    emit({ evidence: { ...evidence, results: [...evidence.results] }, currentScript: null });
    await persistFinal(evidence);
    return evidence;
  } catch (error) {
    evidence.status = 'error';
    evidence.error = error instanceof Error ? error.message : String(error);
    evidence.finishedAt = Date.now();
    emit({ evidence: { ...evidence, results: [...evidence.results] }, currentScript: null });
    await persistFinal(evidence);
    return evidence;
  }
}
