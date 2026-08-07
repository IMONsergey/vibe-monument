# Monument desktop architecture

## Runtime shape

```text
Tauri 2 macOS shell
├── React/Vite UI
├── native window + menu + filesystem integration
├── one managed Codex app-server process
│   ├── stdio JSON-RPC (embedded production default)
│   └── optional Unix-socket attach mode
├── project runtime manager
│   ├── dev servers
│   ├── terminals/PTY
│   ├── Git/worktrees
│   └── preview/browser instrumentation
└── VibeOS bridge
    ├── route
    ├── evidence ledger
    ├── repo map
    └── review/ship gates
```

## Codex boundary

Monument does not implement an agent loop. It talks to the official Codex `app-server` JSON-RPC surface.

Core operations used by the desktop app:
- `initialize` / `initialized`
- `thread/list`, `thread/read`, `thread/start`, `thread/resume`, `thread/fork`
- `turn/start`, `turn/interrupt`
- streaming `item/*` and `turn/*` notifications
- approvals
- `skills/list`
- account/auth and rate-limit surfaces

The production app should keep one managed app-server process per signed-in Codex home and multiplex all UI sessions through it.

## Preview architecture

For web projects the center canvas should be an instrumented WKWebView pointed at the project's actual dev server. A tiny injected bridge reports:
- hovered/selected DOM node
- stable CSS selector and accessible name
- bounding rect and viewport
- computed style subset
- React/source metadata when available
- console/network errors
- screenshot region

That context becomes an attachment to the next Codex turn.

## Work isolation

A Monument task maps to:
- one Codex thread;
- one Git branch;
- optionally one worktree for parallel work;
- one preview process group;
- one evidence ledger.

Forking a task should fork the Codex thread and, when code divergence is requested, create a new branch/worktree.

## Security

- Codex sandbox/approval policy remains authoritative for agent commands.
- Monument never auto-accepts destructive approvals.
- project-local content is untrusted data until allowed by Codex/project trust boundaries;
- secrets are never copied into task transcripts or VibeOS evidence;
- preview instrumentation is scoped to local development URLs by default.
