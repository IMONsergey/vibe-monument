import type { CodexProtocolProbe, CodexRuntimeInfo, ProjectInspection } from '../types';
import type {
  TimelineCheckpoint,
  TimelineDiff,
  TimelineRestoreResult,
  TimelineSnapshotMetadata,
  TimelineState,
  TimelineStatus,
} from '../timeline/types';

type Unlisten = () => void;

type TauriGlobal = {
  core?: {
    invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  };
  event?: {
    listen<T>(event: string, handler: (event: { payload: T }) => void): Promise<Unlisten>;
  };
};

declare global {
  interface Window {
    __TAURI__?: TauriGlobal;
  }
}

export interface RuntimeInfo {
  running: boolean;
  pid?: number | null;
  command?: string | null;
  cwd?: string | null;
}

export interface RuntimeOutput {
  stream: 'stdout' | 'stderr';
  line: string;
}

export function isNativeHost(): boolean {
  return Boolean(window.__TAURI__?.core?.invoke && window.__TAURI__?.event?.listen);
}

export async function invokeNative<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) throw new Error('Monument native host is unavailable. Launch the installed desktop app.');
  return invoke<T>(command, args);
}

export async function listenNative<T>(event: string, handler: (payload: T) => void): Promise<Unlisten> {
  const listen = window.__TAURI__?.event?.listen;
  if (!listen) return () => {};
  return listen<T>(event, (message) => handler(message.payload));
}

export async function openProject(): Promise<ProjectInspection | null> {
  return invokeNative<ProjectInspection | null>('project_open');
}

export async function inspectProject(path: string): Promise<ProjectInspection> {
  return invokeNative<ProjectInspection>('project_inspect', { path });
}

export async function startRuntime(projectPath: string, script: string): Promise<RuntimeInfo> {
  return invokeNative<RuntimeInfo>('runtime_start', { projectPath, script });
}

export async function stopRuntime(): Promise<void> {
  await invokeNative<void>('runtime_stop');
}

export async function runtimeStatus(): Promise<RuntimeInfo> {
  return invokeNative<RuntimeInfo>('runtime_status');
}

export async function codexStatus(): Promise<CodexRuntimeInfo> {
  return invokeNative<CodexRuntimeInfo>('codex_status');
}

export async function probeCodexProtocol(): Promise<CodexProtocolProbe> {
  return invokeNative<CodexProtocolProbe>('codex_protocol_probe');
}

export async function openExternalUrl(url: string): Promise<void> {
  await invokeNative<void>('system_open_external', { url });
}

export async function timelineInit(projectPath: string, projectId: string): Promise<TimelineState> {
  return invokeNative<TimelineState>('timeline_init', { projectPath, projectId });
}

export async function timelineSnapshot(
  projectPath: string,
  projectId: string,
  metadata: TimelineSnapshotMetadata,
): Promise<TimelineCheckpoint> {
  return invokeNative<TimelineCheckpoint>('timeline_snapshot', { projectPath, projectId, metadata });
}

export async function timelineList(projectId: string): Promise<TimelineCheckpoint[]> {
  return invokeNative<TimelineCheckpoint[]>('timeline_list', { projectId });
}

export async function timelineStatus(projectPath: string, projectId: string): Promise<TimelineStatus> {
  return invokeNative<TimelineStatus>('timeline_status', { projectPath, projectId });
}

export async function timelineRestore(
  projectPath: string,
  projectId: string,
  checkpointId: string,
): Promise<TimelineRestoreResult> {
  return invokeNative<TimelineRestoreResult>('timeline_restore', { projectPath, projectId, checkpointId });
}

export async function timelineBack(projectPath: string, projectId: string): Promise<TimelineRestoreResult> {
  return invokeNative<TimelineRestoreResult>('timeline_back', { projectPath, projectId });
}

export async function timelineForward(projectPath: string, projectId: string): Promise<TimelineRestoreResult> {
  return invokeNative<TimelineRestoreResult>('timeline_forward', { projectPath, projectId });
}

export async function timelineDiff(
  projectPath: string,
  projectId: string,
  fromCheckpointId: string,
  toCheckpointId: string,
): Promise<TimelineDiff> {
  return invokeNative<TimelineDiff>('timeline_diff', {
    projectPath,
    projectId,
    fromCheckpointId,
    toCheckpointId,
  });
}

export async function stateGet<T>(key: string): Promise<T | null> {
  return invokeNative<T | null>('state_get', { key });
}

export async function stateSet(key: string, value: unknown): Promise<void> {
  await invokeNative<void>('state_set', { key, value });
}
