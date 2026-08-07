import { invokeNative, listenNative, stateGet, stateSet } from '../host/native';

export interface BrowserConsoleEvent {
  at: number;
  level: 'warn' | 'error' | string;
  message: string;
}

export interface BrowserRuntimeEvent {
  at: number;
  kind: string;
  message: string;
  source?: string | null;
  line?: number | null;
  column?: number | null;
}

export interface BrowserNetworkEvent {
  at: number;
  transport: 'fetch' | 'xhr' | string;
  method: string;
  url: string;
  status?: number | null;
  durationMs: number;
  failed: boolean;
  error?: string | null;
}

export interface BrowserEvidenceSnapshot {
  requestId: string;
  capturedAt: number;
  page: {
    url?: string;
    title?: string;
    readyState?: string;
    viewport?: { width?: number; height?: number; dpr?: number };
  };
  console: BrowserConsoleEvent[];
  runtime: BrowserRuntimeEvent[];
  network: BrowserNetworkEvent[];
}

export interface BrowserEvidenceRecord {
  projectId: string;
  snapshot: BrowserEvidenceSnapshot;
  stale: boolean;
  capturedForTurnSerial: number;
}

type Listener = (record: BrowserEvidenceRecord | null) => void;

const listeners = new Set<Listener>();
let current: BrowserEvidenceRecord | null = null;

function evidenceKey(projectId: string): string {
  return `browser-evidence:${projectId}:latest`;
}

function emit(record: BrowserEvidenceRecord | null): void {
  current = record;
  for (const listener of listeners) listener(record);
}

export function subscribeBrowserEvidence(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}

export async function restoreBrowserEvidence(projectId: string): Promise<BrowserEvidenceRecord | null> {
  const record = await stateGet<BrowserEvidenceRecord>(evidenceKey(projectId)).catch(() => null);
  emit(record);
  return record;
}

export async function markBrowserEvidenceStale(projectId: string): Promise<void> {
  const source = current?.projectId === projectId ? current : await stateGet<BrowserEvidenceRecord>(evidenceKey(projectId)).catch(() => null);
  if (!source || source.stale) return;
  const record = { ...source, stale: true };
  emit(record);
  await stateSet(evidenceKey(projectId), record).catch(() => undefined);
}

export async function installBrowserEvidence(): Promise<void> {
  await invokeNative<void>('preview_install_browser_evidence');
}

export async function clearBrowserEvidenceBuffer(): Promise<void> {
  await invokeNative<void>('preview_clear_browser_evidence');
}

export async function captureBrowserEvidence(projectId: string, turnSerial: number): Promise<BrowserEvidenceRecord> {
  let unlisten: (() => void) | null = null;
  let timeout: number | null = null;
  const snapshot = await new Promise<BrowserEvidenceSnapshot>(async (resolve, reject) => {
    try {
      const waiting = new Map<string, BrowserEvidenceSnapshot>();
      let requestId: string | null = null;
      unlisten = await listenNative<BrowserEvidenceSnapshot>('monument://preview-browser-evidence', (payload) => {
        if (!requestId) {
          waiting.set(payload.requestId, payload);
          return;
        }
        if (payload.requestId === requestId) resolve(payload);
      });
      requestId = await invokeNative<string>('preview_collect_browser_evidence');
      const early = waiting.get(requestId);
      if (early) {
        resolve(early);
        return;
      }
      timeout = window.setTimeout(() => reject(new Error('Browser evidence capture timed out')), 4_000);
    } catch (error) {
      reject(error);
    }
  }).finally(() => {
    if (timeout != null) window.clearTimeout(timeout);
    unlisten?.();
  });

  const record: BrowserEvidenceRecord = {
    projectId,
    snapshot,
    stale: false,
    capturedForTurnSerial: turnSerial,
  };
  emit(record);
  await stateSet(evidenceKey(projectId), record).catch(() => undefined);
  return record;
}

export function browserEvidenceHasIssues(record: BrowserEvidenceRecord | null): boolean {
  if (!record || record.stale) return false;
  return record.snapshot.runtime.length > 0
    || record.snapshot.console.some((event) => event.level === 'error')
    || record.snapshot.network.some((event) => event.failed);
}
