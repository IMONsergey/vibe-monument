import { createProjection, projectCodexEvent } from './event-projector.js';

export class CodexRuntimeController {
  constructor(client, { mode = 'demo', onStatus = () => {}, onThreads = () => {}, onProjection = () => {} } = {}) {
    this.client = client;
    this.mode = mode;
    this.onStatus = onStatus;
    this.onThreads = onThreads;
    this.onProjection = onProjection;
    this.projection = createProjection();
    this.connected = false;
    this.client.on('*', (message) => this.#project(message));
  }

  async connect() {
    this.onStatus({ status: 'connecting', mode: this.mode });
    try {
      const info = await this.client.connect();
      this.connected = true;
      const listed = await this.client.listThreads({});
      this.onThreads(listed.data ?? []);
      this.onStatus({ status: 'connected', mode: this.mode, info });
      return info;
    } catch (error) {
      this.connected = false;
      this.onStatus({ status: 'error', mode: this.mode, error: String(error?.message ?? error) });
      throw error;
    }
  }

  async sendText(threadId, text) {
    if (!this.connected) throw new Error('Codex is not connected');
    return this.client.startTurn(threadId, [{ type: 'text', text, textElements: [] }]);
  }

  async fork(threadId) {
    const result = await this.client.forkThread(threadId);
    const listed = await this.client.listThreads({});
    this.onThreads(listed.data ?? []);
    return result;
  }

  #project(message) {
    this.projection = projectCodexEvent(this.projection, message);
    this.onProjection(this.projection, message);
  }
}
