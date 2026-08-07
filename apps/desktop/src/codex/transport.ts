import { invokeNative, isNativeHost } from '../host/native';

export type RpcMessage = {
  id?: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: unknown;
};

export interface CodexTransport {
  readonly kind: 'native';
  connect(onMessage: (message: RpcMessage) => void, onStderr: (line: string) => void): Promise<void>;
  send(message: RpcMessage): Promise<void>;
  close(): Promise<void>;
}

export class NativeCodexTransport implements CodexTransport {
  readonly kind = 'native' as const;
  private unlisten: Array<() => void> = [];

  async connect(onMessage: (message: RpcMessage) => void, onStderr: (line: string) => void): Promise<void> {
    if (!isNativeHost()) throw new Error('Codex requires the Monument desktop host.');
    const listen = window.__TAURI__?.event?.listen;
    if (!listen) throw new Error('Tauri event bridge is unavailable.');

    this.unlisten.push(await listen<RpcMessage>('monument://codex-message', (event) => onMessage(event.payload)));
    this.unlisten.push(await listen<string>('monument://codex-stderr', (event) => onStderr(event.payload)));
    await invokeNative('codex_start', { options: null });
  }

  async send(message: RpcMessage): Promise<void> {
    await invokeNative('codex_send', { message });
  }

  async close(): Promise<void> {
    for (const dispose of this.unlisten.splice(0)) dispose();
    if (isNativeHost()) await invokeNative('codex_stop');
  }
}
