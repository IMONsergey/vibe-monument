# Monument build roadmap

The roadmap is ordered by **user-visible capability gates**, not by how many internal subsystems exist. Monument should get simpler to use as the engine underneath becomes more capable.

## Shipped foundation — Product-first native core

Implemented and verified on macOS CI:

- React + TypeScript + Vite production shell;
- Tauri 2 macOS host;
- native project picker and bounded repository inspection;
- framework/package-manager/script discovery;
- real Git branch/remote/change count;
- managed local dev runtime with process-group cleanup;
- real local preview URL discovery;
- local SQLite state;
- real Codex `app-server` lifecycle;
- real thread/task projection and streamed turns;
- no production fallback to decorative mock data.

## Shipped gate — Codex protocol + auth

Implemented and verified on macOS CI:

- bidirectional JSON-RPC;
- current turn text contract;
- bounded retry for App Server saturation;
- active-turn interruption;
- command execution approvals;
- file-change approvals;
- granular permission approvals;
- inline `request_user_input`;
- safe handling of unknown/unsupported server requests;
- Codex-managed ChatGPT login recovery;
- account/plan state;
- actual Codex version detection;
- installed-binary JSON Schema compatibility probe;
- human-facing protocol surfaces rather than raw JSON.

## Current gate — Select / Inspect (`0.2.0-alpha.3`)

Implemented in the current release candidate:

- native child WKWebView live product preview;
- loopback-only + exact-origin security boundary;
- Select button + `I` shortcut;
- live hover outline;
- click-to-capture DOM/runtime context;
- accessible name, text, selector, rect and computed-style packet;
- one-turn selected context chip;
- deterministic bounded source-hint locator;
- selected runtime + source-hint context attached automatically to the next Codex turn;
- desktop/mobile preview geometry;
- explicit Intel DMG build/mount/architecture/release pipeline.

Definition of done for this gate:

> Open a real web project → start preview → point at a real element → describe the desired change → Codex receives precise observed context without the user touching code or DevTools → install the resulting Intel DMG.

## G4 — Task isolation + human version history

Next engineering target:

- durable Monument task records;
- task ↔ Codex thread mapping persisted locally;
- task ↔ Git branch mapping;
- optional worktree for parallel tasks;
- real changed-file list and diff viewer;
- human history labels instead of raw commit UX;
- “Try another version” → thread fork + optional worktree fork;
- side-by-side variant preview;
- commit/save-version flow;
- safe discard/revert semantics.

## G5 — Deterministic evidence + auto repair

- discover project build/test/typecheck/lint checks;
- one-shot supervised check runner;
- machine-readable evidence records with command/exit/time/output;
- automatic checks after meaningful Codex changes;
- preview console/runtime-error capture;
- failed-network capture without request bodies/secrets;
- responsive viewport matrix;
- before/after screenshots where native capture is available;
- bounded automatic repair loop;
- never show `Ready` solely because the agent says it is done.

## G6 — Fresh review + real Ship gate

- VibeOS risk route projected into the product only when useful;
- required evidence derived from route/task class;
- fresh-context reviewer receives contract + real diff + standards + raw evidence;
- findings classified by severity;
- one-click “Fix with Monument”;
- explicit accept/waive path for non-blocking findings;
- Ship enabled only when blocking gates pass;
- commit / push / PR handoff.

## G7 — Reliability / recovery

- exact session restoration after app restart;
- Codex crash detection/restart;
- dev-runtime reattach/restart;
- stale process/worktree cleanup;
- sleep/wake revalidation;
- offline product/file/Git mode;
- diagnostic support bundle with secret sanitization;
- large-repository performance budgets;
- Intel-specific sustained-runtime testing.

## G8 — Commercial macOS distribution

- Developer ID signing;
- hardened runtime;
- notarization + stapling;
- signed updater;
- stable/alpha channels;
- accessibility + keyboard audit;
- onboarding and high-quality empty/error states;
- polished native menus/recent projects;
- crash reporting only with explicit privacy policy/controls.

## Explicitly not on the critical path

Until the core product loop is excellent, do not spend roadmap capacity on:

- VS Code extension compatibility;
- generic multi-agent support beyond Codex;
- cloud workspaces/team collaboration;
- Kubernetes/Docker dashboards;
- SSH remote development;
- marketplace mechanics;
- a custom model gateway;
- a second coding-agent loop implemented by Monument.

The product standard remains:

> **Preview + Prompt first. The engineering monster stays underneath.**
