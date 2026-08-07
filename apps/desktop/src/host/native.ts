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

export function isNativeHost(): boolean {
  return Boolean(window.__TAURI__?.core?.invoke && window.__TAURI__?.event?.listen);
}

export async function invokeNative<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) throw new Error('Monument native host is unavailable. Launch the installed desktop app.');
  return invoke<T>(command, args);
}

export async function openProject(): Promise<ProjectInspection | null> {
  return invokeNative<ProjectInspection | null>('project_open');
}

export async function inspectProject(path: string): Promise<ProjectInspection> {
  return invokeNative<ProjectInspection>('project_inspect', { path });
}

export async function stateGet<T>(key: string): Promise<T | null> {
  return invokeNative<T | null>('state_get', { key });
}

export async function stateSet(key: string, value: unknown): Promise<void> {
  await invokeNative<void>('state_set', { key, value });
}
