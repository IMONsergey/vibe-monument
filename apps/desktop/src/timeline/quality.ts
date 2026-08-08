import { stateGet, stateSet } from '../host/native';

export type TimelineDeterministicStatus = 'passed' | 'failed' | 'no-checks' | 'permission-required' | 'error' | 'not-run';
export type TimelineBrowserStatus = 'clean' | 'issues' | 'not-run';
export type TimelineReviewStatus = 'clean' | 'issues' | 'blocked' | 'error' | 'not-run';

export interface TimelineQualitySummary {
  checkpointId: string;
  /** Codex provenance only. Source/evidence identity is checkpointId. */
  turnSerial: number | null;
  deterministic: TimelineDeterministicStatus;
  browser: TimelineBrowserStatus;
  review: TimelineReviewStatus;
  deterministicEvidenceId?: string | null;
  browserCapturedAt?: number | null;
  reviewId?: string | null;
  updatedAt: number;
}

export type TimelineQualityMap = Record<string, TimelineQualitySummary>;
type Listener = (quality: TimelineQualityMap) => void;

const listeners = new Map<string, Set<Listener>>();
const cache = new Map<string, TimelineQualityMap>();
const MAX_CHECKPOINT_ID = 220;

function storageKey(projectId: string): string {
  // Keep the existing storage namespace so old alpha data is not destructively deleted.
  // Legacy turn-keyed entries are ignored by normalizeQuality because they do not carry checkpointId.
  return `timeline:quality:${projectId}`;
}

function checkpointKey(checkpointId: string): string {
  return checkpointId.trim().slice(0, MAX_CHECKPOINT_ID);
}

function nullableTurnSerial(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.max(1, Math.trunc(value));
}

function deterministicStatus(value: unknown): TimelineDeterministicStatus {
  return ['passed', 'failed', 'no-checks', 'permission-required', 'error', 'not-run'].includes(String(value))
    ? value as TimelineDeterministicStatus
    : 'not-run';
}

function browserStatus(value: unknown): TimelineBrowserStatus {
  return ['clean', 'issues', 'not-run'].includes(String(value)) ? value as TimelineBrowserStatus : 'not-run';
}

function reviewStatus(value: unknown): TimelineReviewStatus {
  return ['clean', 'issues', 'blocked', 'error', 'not-run'].includes(String(value)) ? value as TimelineReviewStatus : 'not-run';
}

function optionalString(value: unknown, limit = 300): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : null;
}

function normalizeQuality(value: unknown): TimelineQualityMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: TimelineQualityMap = {};
  for (const [storedKey, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const record = raw as Record<string, unknown>;
    const checkpointId = checkpointKey(typeof record.checkpointId === 'string' ? record.checkpointId : '');
    // Alpha <=8 stored quality by numeric turnSerial and therefore cannot prove exact source identity.
    // Preserve it in storage but do not project it as current quality.
    if (!checkpointId || storedKey !== checkpointId) continue;
    result[checkpointId] = {
      checkpointId,
      turnSerial: nullableTurnSerial(record.turnSerial),
      deterministic: deterministicStatus(record.deterministic),
      browser: browserStatus(record.browser),
      review: reviewStatus(record.review),
      deterministicEvidenceId: optionalString(record.deterministicEvidenceId),
      browserCapturedAt: typeof record.browserCapturedAt === 'number' && Number.isFinite(record.browserCapturedAt) ? record.browserCapturedAt : null,
      reviewId: optionalString(record.reviewId),
      updatedAt: typeof record.updatedAt === 'number' && Number.isFinite(record.updatedAt) ? record.updatedAt : Date.now(),
    };
  }
  return result;
}

function emit(projectId: string, quality: TimelineQualityMap): void {
  cache.set(projectId, quality);
  for (const listener of listeners.get(projectId) ?? []) listener(quality);
}

export async function loadTimelineQuality(projectId: string): Promise<TimelineQualityMap> {
  const stored = await stateGet<unknown>(storageKey(projectId)).catch(() => null);
  const quality = normalizeQuality(stored);
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
  checkpointId: string,
  turnSerial: number | null,
  patch: Partial<Omit<TimelineQualitySummary, 'checkpointId' | 'turnSerial' | 'updatedAt'>>,
): Promise<TimelineQualitySummary> {
  const key = checkpointKey(checkpointId);
  if (!key) throw new Error('Timeline quality requires a saved checkpoint id');
  const current = cache.get(projectId) ?? normalizeQuality(await stateGet<unknown>(storageKey(projectId)).catch(() => null));
  const previous = current[key] ?? {
    checkpointId: key,
    turnSerial: nullableTurnSerial(turnSerial),
    deterministic: 'not-run' as const,
    browser: 'not-run' as const,
    review: 'not-run' as const,
    updatedAt: Date.now(),
  };
  const next: TimelineQualitySummary = {
    ...previous,
    ...patch,
    checkpointId: key,
    turnSerial: nullableTurnSerial(turnSerial) ?? previous.turnSerial,
    updatedAt: Date.now(),
  };
  const quality = { ...current, [key]: next };
  emit(projectId, quality);
  await stateSet(storageKey(projectId), quality).catch(() => undefined);
  return next;
}

export async function recordTimelineDeterministicQuality(
  projectId: string,
  checkpointId: string,
  turnSerial: number | null,
  status: Exclude<TimelineDeterministicStatus, 'not-run'>,
  evidenceId?: string | null,
): Promise<TimelineQualitySummary> {
  return patchTimelineQuality(projectId, checkpointId, turnSerial, {
    deterministic: status,
    deterministicEvidenceId: evidenceId ?? null,
  });
}

export async function recordTimelineBrowserQuality(
  projectId: string,
  checkpointId: string,
  turnSerial: number | null,
  status: Exclude<TimelineBrowserStatus, 'not-run'>,
  capturedAt?: number | null,
): Promise<TimelineQualitySummary> {
  return patchTimelineQuality(projectId, checkpointId, turnSerial, {
    browser: status,
    browserCapturedAt: capturedAt ?? null,
  });
}

export async function recordTimelineReviewQuality(
  projectId: string,
  checkpointId: string,
  turnSerial: number | null,
  status: Exclude<TimelineReviewStatus, 'not-run'>,
  reviewId?: string | null,
): Promise<TimelineQualitySummary> {
  return patchTimelineQuality(projectId, checkpointId, turnSerial, {
    review: status,
    reviewId: reviewId ?? null,
  });
}

export function timelineQualityForCheckpoint(quality: TimelineQualityMap, checkpointId: string | null): TimelineQualitySummary | null {
  if (!checkpointId) return null;
  return quality[checkpointKey(checkpointId)] ?? null;
}

/** Legacy presentation helper only. Never use turnSerial to prove current source identity. */
export function timelineQualityForTurn(quality: TimelineQualityMap, turnSerial: number | null): TimelineQualitySummary | null {
  const serial = nullableTurnSerial(turnSerial);
  if (serial == null) return null;
  return Object.values(quality).find((entry) => entry.turnSerial === serial) ?? null;
}
