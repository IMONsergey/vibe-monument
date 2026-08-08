import { stateGet, stateSet } from '../host/native';

export type TimelineDeterministicStatus = 'passed' | 'failed' | 'no-checks' | 'permission-required' | 'error' | 'not-run';
export type TimelineBrowserStatus = 'clean' | 'issues' | 'not-run';
export type TimelineReviewStatus = 'clean' | 'issues' | 'blocked' | 'error' | 'not-run';

export interface TimelineQualitySummary {
  turnSerial: number;
  deterministic: TimelineDeterministicStatus;
  browser: TimelineBrowserStatus;
  review?: TimelineReviewStatus;
  deterministicEvidenceId?: string | null;
  browserCapturedAt?: number | null;
  reviewId?: string | null;
  updatedAt: number;
}

export type TimelineQualityMap = Record<string, TimelineQualitySummary>;
type Listener = (quality: TimelineQualityMap) => void;

const listeners = new Map<string, Set<Listener>>();
const cache = new Map<string, TimelineQualityMap>();

function storageKey(projectId: string): string {
  return `timeline:quality:${projectId}`;
}

function serialKey(turnSerial: number): string {
  // Positive ids are Codex generations; negative ids are direct Visual Editor generations.
  // Zero remains the only unbound sentinel.
  return String(Math.trunc(turnSerial) || 0);
}

function emit(projectId: string, quality: TimelineQualityMap): void {
  cache.set(projectId, quality);
  for (const listener of listeners.get(projectId) ?? []) listener(quality);
}

export async function loadTimelineQuality(projectId: string): Promise<TimelineQualityMap> {
  const stored = await stateGet<TimelineQualityMap>(storageKey(projectId)).catch(() => null);
  const quality = stored && typeof stored === 'object' ? stored : {};
  emit(projectId, quality);
  return quality;
}

export function subscribeTimelineQuality(projectId: string, listener: Listener): () => void {
  const bucket = listeners.get(projectId) ?? new Set<Listener>();
  bucket.add(listener);
  listeners.set(projectId, bucket);
  listener(cache.get(projectId) ?? {});
  void loadTimelineQuality(projectId);
  return () => {
    const current = listeners.get(projectId);
    current?.delete(listener);
    if (current && current.size === 0) listeners.delete(projectId);
  };
}

async function patchTimelineQuality(
  projectId: string,
  turnSerial: number,
  patch: Partial<Omit<TimelineQualitySummary, 'turnSerial' | 'updatedAt'>>,
): Promise<TimelineQualitySummary> {
  const current = cache.get(projectId) ?? await stateGet<TimelineQualityMap>(storageKey(projectId)).catch(() => null) ?? {};
  const key = serialKey(turnSerial);
  const previous = current[key] ?? {
    turnSerial,
    deterministic: 'not-run' as const,
    browser: 'not-run' as const,
    review: 'not-run' as const,
    updatedAt: Date.now(),
  };
  const next: TimelineQualitySummary = {
    ...previous,
    ...patch,
    turnSerial,
    updatedAt: Date.now(),
  };
  const quality = { ...current, [key]: next };
  emit(projectId, quality);
  await stateSet(storageKey(projectId), quality).catch(() => undefined);
  return next;
}

export async function recordTimelineDeterministicQuality(
  projectId: string,
  turnSerial: number,
  status: Exclude<TimelineDeterministicStatus, 'not-run'>,
  evidenceId?: string | null,
): Promise<TimelineQualitySummary> {
  return patchTimelineQuality(projectId, turnSerial, {
    deterministic: status,
    deterministicEvidenceId: evidenceId ?? null,
  });
}

export async function recordTimelineBrowserQuality(
  projectId: string,
  turnSerial: number,
  status: Exclude<TimelineBrowserStatus, 'not-run'>,
  capturedAt?: number | null,
): Promise<TimelineQualitySummary> {
  return patchTimelineQuality(projectId, turnSerial, {
    browser: status,
    browserCapturedAt: capturedAt ?? null,
  });
}

export async function recordTimelineReviewQuality(
  projectId: string,
  turnSerial: number,
  status: Exclude<TimelineReviewStatus, 'not-run'>,
  reviewId?: string | null,
): Promise<TimelineQualitySummary> {
  return patchTimelineQuality(projectId, turnSerial, {
    review: status,
    reviewId: reviewId ?? null,
  });
}

export function timelineQualityForTurn(quality: TimelineQualityMap, turnSerial: number | null): TimelineQualitySummary | null {
  if (turnSerial == null) return null;
  return quality[serialKey(turnSerial)] ?? null;
}
