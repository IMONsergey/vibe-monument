# Monument Product Principles v2

## Product thesis

Monument is not an IDE with an AI sidebar. It is a product-first building environment that should feel as direct as modern visual AI builders while running a substantially stronger engineering control plane underneath.

The default user mental model is:

> Here is my product. Tell Monument what it should become.

Not:

> Here is my repository. Operate Git, terminal, editor and an agent manually.

## The four laws

### 1. Product first

The live artifact receives the majority of the screen and the majority of user attention.

Default surfaces:
- live preview;
- task history;
- one natural-language composer;
- lightweight viewport and project controls.

Advanced engineering surfaces are available, but hidden behind progressive disclosure:
- files;
- code;
- Git/diff;
- terminal/runtime;
- console/network;
- evidence;
- raw Codex activity;
- diagnostics.

A user should be able to use Monument successfully without opening a terminal or understanding a worktree.

### 2. One user instruction triggers the engineering chain

The user should not have to say:
- run the build;
- now run tests;
- now inspect console errors;
- now check mobile;
- now review your own diff.

Monument selects the lightest safe VibeOS route and automatically performs the verification required by the task class.

### 3. Complexity is progressive disclosure

Power is not removed. It is moved out of the default path.

User language:
- `New task`, not `thread/start`;
- `Try another version`, not `fork thread + worktree`;
- `4 changes`, not a mandatory Git staging workflow;
- `Start preview`, not a process supervisor UI;
- `Ready`, only when verification gates are satisfied.

The underlying implementation may use Codex threads, Git branches, worktrees, PTYs, process groups, JSON-RPC, evidence ledgers and review contexts. Those are implementation details until the user asks to inspect them.

### 4. Never claim success without proof

`Ready`, green checks and ship affordances are assertions backed by evidence.

A build check means a real command ran and exited successfully.
A visual check means a real viewport was captured/inspected.
A console check means the actual preview runtime was observed.
A review check means a bounded reviewer inspected the real contract, diff and raw evidence.

Unknown is displayed as unknown. Not-run is displayed as not-run. Fake success data is forbidden in production.

## Default workspace

```text
┌────────────────────────────────────────────────────────────────────┐
│ Monument        Project                          Under hood  Ship   │
├──────────────┬─────────────────────────────────────────────────────┤
│ Tasks        │                                                     │
│              │                                                     │
│ New task     │                   LIVE PRODUCT                      │
│ Existing…    │                                                     │
│              │                                                     │
│              │                                                     │
│              │                                                     │
├──────────────┴─────────────────────────────────────────────────────┤
│             Tell Monument what to build or change…            ↑   │
└────────────────────────────────────────────────────────────────────┘
```

No fake terminal, fake file tree, fake evidence, fake tests or fake preview is allowed in this default workspace.

## Interaction hierarchy

### Level 1 — normal use

- Open project
- See live product
- Prompt
- Select/inspect an element (next gate)
- Attach a reference (next gate)
- Desktop/mobile
- Task history
- Stop work
- Try another version (later gate)
- Ship when verified (later gate)

### Level 2 — Under the hood

- real Codex activity
- real repository file tree
- runtime stdout/stderr
- Git/diff
- terminal
- console/network
- evidence
- diagnostics

Level 2 must never become a dependency for routine use.

## Invisible engine

A non-trivial request may execute this pipeline without exposing its internal machinery by default:

```text
USER INTENT
  ↓
project intelligence
  ↓
VibeOS risk route
  ↓
task contract
  ↓
Git isolation / worktree when needed
  ↓
Codex implementation thread
  ↓
local build / tests / typecheck
  ↓
live runtime verification
  ↓
responsive/browser checks
  ↓
fresh-context review
  ↓
automatic bounded repair loop
  ↓
evidence gate
  ↓
READY
```

Small changes must take a smaller route. Monument must not create an agent bureaucracy around trivial edits.

## Codex boundary

Monument does not implement a second coding-agent loop. Codex App Server owns agent execution, threads, turns, tools, sandbox semantics and approvals.

Monument owns:
- product UX;
- task projection;
- local project/runtime management;
- visual context;
- Git/worktree ergonomics;
- verification orchestration;
- VibeOS evidence/review/ship gates.

Protocol shapes must be generated/validated against the installed supported Codex version. Approval response shapes must never be guessed.

## Production truth rule

Every production UI datum has one of three origins:

1. real local state/runtime data;
2. a clear loading state;
3. a clear unavailable/not-run state.

There is no fourth state called demo pretending to be real.

Demo mode, fixtures and fake app servers are allowed only when explicitly enabled for tests/development and must be structurally unreachable from the normal packaged app.

## Current foundation gate — 0.2

The 0.2 foundation establishes:
- React + TypeScript production shell;
- no production import of prototype mock data;
- native project picker;
- real project/framework/package-manager/script detection;
- real Git branch/remote/change-count discovery;
- real bounded file tree;
- managed local dev-server process;
- real live-preview URL detection;
- native-only production Codex transport;
- bidirectional server-request awareness;
- local SQLite UI/application state;
- explicit `Under the hood` progressive-disclosure surface.

## Next product gates

### Gate A — exact Codex protocol
- generated TS/schema bindings;
- approval cards with exact supported allow/deny responses;
- account/auth/rate-limit projection;
- resilient reconnect and backpressure;
- exact item/tool/command activity projection.

### Gate B — visual building
- instrumented live preview;
- hover/select overlay;
- DOM/accessibility/computed-style packet;
- source mapping hints;
- screenshot crop + full viewport;
- reference attachments;
- `Ask this` interaction.

### Gate C — engineering monster
- Git task branches/worktrees;
- PTY terminal;
- deterministic checks;
- browser/console/network QA;
- responsive viewport matrix;
- VibeOS evidence ledger;
- fresh-context reviewer;
- bounded automatic repair loop;
- real ship gate.

### Gate D — commercial desktop quality
- crash/session recovery;
- sleep/wake recovery;
- diagnostics bundle;
- Developer ID signing;
- notarization/stapling;
- signed updater;
- Intel performance budget and native smoke suite.

## Non-goals until the core loop is excellent

- other coding agents;
- VS Code extension compatibility;
- cloud collaboration;
- remote SSH workspaces;
- Kubernetes/Docker dashboards;
- generic model gateway;
- plugin marketplace;
- full browser DevTools replacement.

## Decision test

Before adding any persistent UI, ask:

> Does the user need to see or operate this to get a better product result?

If not, keep it under the hood.
