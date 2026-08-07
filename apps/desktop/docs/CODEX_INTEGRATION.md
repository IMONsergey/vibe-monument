# Codex app-server integration contract

Monument is a client of the official Codex `app-server` control plane. It does not reimplement model orchestration.

## Transport

Production macOS target:

```text
Monument Tauri process
   ↓ managed child lifecycle
codex app-server --stdio
   ↓ newline-delimited JSON-RPC over stdin/stdout
Codex threads / turns / tools / approvals
```

For the embedded managed child, `stdio` is the primary transport: it is supported, simple to supervise, and keeps one process lifecycle under the native host. The Unix-socket control plane remains an optional integration path for attaching to an externally managed Codex daemon. The WebSocket listener is experimental/unsupported and is not a production dependency.

## Initialization

Every connection must perform:

```json
{"id":1,"method":"initialize","params":{"clientInfo":{"name":"monument_desktop","title":"Monument","version":"0.1.0"}}}
{"method":"initialized","params":{}}
```

The real app must generate TypeScript/JSON schema from the exact installed Codex binary (`codex app-server generate-ts` or `generate-json-schema`) during development/compatibility checks so protocol drift is detected against that installed version.

## Thread model

UI object → Codex primitive:

- Monument Task → Thread
- Task run/interaction → Turn
- Agent message/tool edit/command/reasoning summary → Item
- Alternative solution → `thread/fork`
- Continue existing Codex work → `thread/resume`
- Sidebar/history → `thread/list` + lazy `thread/read`

A task may also map to a Git branch/worktree, preview runtime, and VibeOS evidence ledger, but Codex remains the transcript/source-of-truth for the agent conversation.

## Event projection

The UI should convert raw protocol events into product-level events:

```text
item/agentMessage/delta     -> streamed response body
item/started shell command  -> Activity: Running command
item/completed shell command-> Activity: command + exit state
file-change items           -> Changed files / diff summary
turn/diff/updated           -> current aggregate change set
turn/completed              -> task run state + usage
approval server request     -> blocking Approval Card
skills/changed              -> refresh skill inventory
```

Raw JSON-RPC is never directly rendered to users.

## Backpressure

App-server can reject saturated ingress with retryable error `-32001`. The runtime manager must use bounded local queues and exponential backoff with jitter rather than flooding retries.

## Compatibility policy

- detect Codex binary/version at startup;
- generate/compare schema in dev and CI compatibility jobs;
- feature-gate experimental endpoints;
- degrade gracefully when an optional endpoint is absent;
- never silently reinterpret approval or sandbox semantics.
