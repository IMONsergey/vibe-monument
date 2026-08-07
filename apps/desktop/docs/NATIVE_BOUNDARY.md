# Native boundary

The browser prototype intentionally keeps a narrow host API so the UI remains testable without macOS tooling.

## Host responsibilities

The future Tauri host owns:

- lifecycle of exactly one Codex app-server child for the active Codex home;
- stdio JSONL framing (preferred for the embedded child path) or Unix-socket proxy when external control is required;
- process termination and crash restart policy;
- local repository access;
- Git/worktree operations;
- PTY terminals;
- dev-server process groups;
- native menus, windows, file dialogs, notifications, keychain/local secret references;
- WKWebView preview instrumentation bridge.

## Frontend responsibilities

- product state and rendering;
- mapping Codex protocol messages to task activity;
- user approvals UI;
- task/project navigation;
- preview/code/runtime orchestration intent;
- VibeOS evidence presentation.

## Frontend host interface

Conceptual API:

```ts
interface MonumentHost {
  codexStart(options?: { codexHome?: string }): Promise<CodexRuntimeInfo>
  codexSend(message: JsonRpcMessage): Promise<void>
  onCodexMessage(listener: (message: JsonRpcMessage) => void): Unsubscribe
  onCodexStderr(listener: (line: string) => void): Unsubscribe
  codexStop(): Promise<void>

  openProject(): Promise<ProjectHandle | null>
  gitStatus(projectId: string): Promise<GitStatus>
  createWorktree(input: WorktreeRequest): Promise<WorktreeHandle>

  startProcess(input: ProcessRequest): Promise<ProcessHandle>
  writeProcess(id: string, data: string): Promise<void>
  stopProcess(id: string): Promise<void>
}
```

No UI component should directly know how a Codex process is spawned.
