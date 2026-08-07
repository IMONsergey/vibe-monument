import type { ProjectInspection } from '../types';

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

export async function stateGet<T>(key: string): Promise<T | null> {
  return invokeNative<T | null>('state_get', { key });
}

export async function stateSet(key: string, value: unknown): Promise<void> {
  await invokeNative<void>('state_set', { key, value });
}
