import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

/**
 * Development/reference transport for a managed Codex app-server child.
 * The Tauri host will implement the same connect/send/close interface in Rust.
 */
export class NodeStdioTransport {
  constructor({ command = 'codex', args = ['app-server', '--stdio'], cwd, env = process.env } = {}) {
    this.command = command;
    this.args = args;
    this.cwd = cwd;
    this.env = env;
    this.proc = null;
    this.onMessage = null;
    this.stderrListeners = new Set();
  }

  async connect(onMessage) {
    if (this.proc) throw new Error('Codex transport already connected');
    this.onMessage = onMessage;
    this.proc = spawn(this.command, this.args, {
      cwd: this.cwd,
      env: this.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const stdout = createInterface({ input: this.proc.stdout, crlfDelay: Infinity });
    stdout.on('line', (line) => {
      if (!line.trim()) return;
      try {
        this.onMessage?.(JSON.parse(line));
      } catch (error) {
        this.#emitStderr(`Invalid JSON from Codex app-server: ${error.message}`);
      }
    });

    const stderr = createInterface({ input: this.proc.stderr, crlfDelay: Infinity });
    stderr.on('line', (line) => this.#emitStderr(line));

    await new Promise((resolve, reject) => {
      const onSpawn = () => { cleanup(); resolve(); };
      const onError = (error) => { cleanup(); reject(error); };
      const cleanup = () => {
        this.proc?.off('spawn', onSpawn);
        this.proc?.off('error', onError);
      };
      this.proc.once('spawn', onSpawn);
      this.proc.once('error', onError);
    });
  }

  send(message) {
    if (!this.proc?.stdin?.writable) throw new Error('Codex transport is not writable');
    this.proc.stdin.write(`${JSON.stringify(message)}\n`);
  }

  onStderr(listener) {
    this.stderrListeners.add(listener);
    return () => this.stderrListeners.delete(listener);
  }

  async close() {
    if (!this.proc) return;
    const proc = this.proc;
    this.proc = null;
    if (proc.exitCode == null) {
      proc.kill('SIGTERM');
      await Promise.race([
        new Promise((resolve) => proc.once('exit', resolve)),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);
      if (proc.exitCode == null) proc.kill('SIGKILL');
    }
  }

  #emitStderr(line) {
    this.stderrListeners.forEach((listener) => listener(line));
  }
}
