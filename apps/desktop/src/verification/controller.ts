import { invokeNative, stateGet, stateSet } from '../host/native';

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
  trigger: 'codex-turn' | 'manual';
  status: 'running' | 'passed' | 'failed' | 'no-checks' | 'error';
  startedAt: number;
  finishedAt: number | null;
  plan: VerificationPlanItem[];
  results: VerificationResult[];
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

function emit(progress: VerificationProgress): void {
  current = progress;
  for (const listener of listeners) listener(progress);
}

function newEvidence(projectId: string, trigger: VerificationEvidence['trigger'], plan: VerificationPlanItem[]): VerificationEvidence {
  return {
    id: `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    projectId,
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

async function persist(evidence: VerificationEvidence): Promise<void> {
  await stateSet(evidenceKey(evidence.projectId), evidence).catch(() => undefined);
}

export async function runVerification({
  projectId,
  projectRoot,
  trigger,
  includeManual = false,
}: {
  projectId: string;
  projectRoot: string;
  trigger: VerificationEvidence['trigger'];
  includeManual?: boolean;
}): Promise<VerificationEvidence> {
  let plan: VerificationPlanItem[] = [];
  try {
    plan = await loadVerificationPlan(projectRoot);
  } catch (error) {
    const evidence = newEvidence(projectId, trigger, []);
    evidence.status = 'error';
    evidence.error = error instanceof Error ? error.message : String(error);
    evidence.finishedAt = Date.now();
    emit({ evidence, currentScript: null });
    await persist(evidence);
    return evidence;
  }

  const evidence = newEvidence(projectId, trigger, plan);
  const selected = plan.filter((item) => includeManual || item.automatic).slice(0, 5);
  if (!selected.length) {
    evidence.status = 'no-checks';
    evidence.finishedAt = Date.now();
    emit({ evidence, currentScript: null });
    await persist(evidence);
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
    await persist(evidence);
    return evidence;
  } catch (error) {
    evidence.status = 'error';
    evidence.error = error instanceof Error ? error.message : String(error);
    evidence.finishedAt = Date.now();
    emit({ evidence: { ...evidence, results: [...evidence.results] }, currentScript: null });
    await persist(evidence);
    return evidence;
  }
}
