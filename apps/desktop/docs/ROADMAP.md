# Monument build roadmap

This roadmap is ordered by **user-visible product gates**. Monument should feel simpler as the engineering control plane underneath becomes more capable.

Canonical current context lives in [`MASTER_PRODUCT_CONTEXT.md`](MASTER_PRODUCT_CONTEXT.md). Deep future Visual Editor design lives in [`VISUAL_EDITOR_SPEC.md`](VISUAL_EDITOR_SPEC.md).

## Shipped — Product-first native core

Implemented, CI-verified and available in the Intel alpha line:

- React + TypeScript + Vite production shell;
- Tauri 2 macOS host;
- native project picker and bounded repository inspection;
- framework/package-manager/script discovery;
- real Git branch/remote/change count;
- managed local dev runtime with process-group cleanup;
- real local preview URL discovery;
- local SQLite state;
- real Codex App Server lifecycle;
- real thread/task projection and streamed turns;
- no production fallback to decorative mock product data.

## Shipped — Codex protocol + auth

- bidirectional JSON-RPC;
- current turn text contract;
- bounded retry for App Server saturation;
- active-turn interruption;
- command/file/permission approvals;
- inline `request_user_input`;
- safe handling of unsupported server requests;
- Codex-managed ChatGPT login recovery;
- account/plan state;
- actual Codex version detection;
- installed-binary JSON Schema compatibility probe.

## Shipped — Live Select / Inspect

- native child WKWebView live product preview;
- loopback-only and exact-origin security boundary;
- Select button + `I` shortcut;
- live hover outline and click selection;
- DOM/accessibility/computed-style packet;
- one-turn selected-element context chip;
- deterministic bounded source-hint locator;
- runtime + source hints attached automatically to the next Codex turn;
- desktop/mobile preview geometry.

## Shipped — Evidence + Browser QA

- explicit per-project Auto-QA consent;
- supervised `typecheck` / `test` / `build` checks;
- bounded command output, timeouts and process-group cleanup;
- evidence tied to code generation rather than agent narration;
- browser runtime / console / failed-network capture from the real preview;
- secret redaction and bounded browser payloads;
- stale evidence after newer work;
- one-click `Fix with Monument` for deterministic and browser failures;
- optional bounded Auto Repair with a two-attempt limit and normal Codex approvals.

## Shipped — Version Timeline

- `Original` baseline;
- automatic checkpoint after completed Codex work;
- Back / Forward and keyboard history;
- manual Save version;
- arbitrary restore without deleting future versions;
- alternative paths after editing an older version;
- safety checkpoint before restoring dirty source;
- clean Codex context after Timeline navigation;
- shadow Git isolated from the user's visible Git index/history;
- symlink-safe restore boundary;
- deterministic/browser quality stored per Timeline generation.

## Shipped — Prompt Queue

- persistent bounded queue;
- add work while Codex/post-turn verification is busy;
- captured Select context per queued request;
- pause/resume/reorder/remove;
- queue restore safety after app restart;
- task/thread detachment after Timeline restore;
- automatic hold on current failed evidence with explicit Continue anyway.

## Current gate — Fresh Review + real Ship (`0.2.0-alpha.7` target)

Fresh Review must be independent from the implementation conversation.

Implemented on the active branch:

- bounded unified diff of the current saved Timeline checkpoint vs its parent;
- reviewer bound to the exact checkpoint / generation;
- separate `codex exec` review process;
- `--ephemeral`, structured `--output-schema` result;
- reviewer runs from an isolated Monument scratch directory rather than the repository;
- bounded input/output/stderr and hard timeout;
- findings classified as blocker / high / medium / low;
- category, location, evidence, suggested fix and confidence;
- blocker findings cannot be waived;
- non-blocking findings require an explicit waiver reason;
- one-click finding repair through the existing approval-safe repair channel;
- review quality persisted per Timeline generation;
- real Ship checklist covering saved version, checks, browser evidence, Fresh Review, pending queue and current Codex/post-turn state;
- Ship is clickable even when blocked and explains exactly what remains.

Definition of done:

> Current saved generation → current deterministic evidence → current browser evidence when applicable → isolated Fresh Review → all material findings fixed/explicitly resolved → no pending requested work → no agent/post-turn work → Ship gate becomes ready.

Still inside this gate:

- final CI/macOS hardening;
- product docs/source-contract updates;
- Intel `0.2.0-alpha.7` release after merge;
- next handoff from ready Ship state into save/commit/push/PR UX.

## Next major gate — Framer-style Visual Editor

This is the next large user-visible product block after Fresh Review / Ship.

Goal:

> A designer can work directly on the real running product with a Layers tree and Framer-like property inspector while Monument keeps source code correct underneath.

Planned surfaces:

- Layers panel synchronized with the real DOM/component hierarchy;
- select from canvas or Layers;
- hover/selection synchronization both directions;
- hide/lock/rename where semantically safe;
- hierarchy search and component boundaries;
- right Properties panel;
- width/height/min/max;
- margin/padding/gap;
- flex/grid/layout controls;
- position/alignment/overflow;
- typography: family/weight/size/line-height/letter-spacing/alignment;
- colors/backgrounds/borders/radius/shadows/opacity;
- component props / variants where source mapping is trustworthy;
- design tokens / CSS variables awareness;
- desktop/tablet/mobile/breakpoint-aware editing;
- multi-select and batch-safe properties;
- instant canvas preview;
- deterministic source edit for simple unambiguous changes;
- patch preview or Codex fallback for ambiguous/structural changes;
- Timeline checkpoint + undo/redo for every committed visual edit;
- automatic evidence refresh after source-changing visual edits.

The architecture and source-synchronization rules are specified in [`VISUAL_EDITOR_SPEC.md`](VISUAL_EDITOR_SPEC.md).

## Following gate — Task isolation / parallel variants

The product already has task/thread projection and Timeline branches, but deeper engineering isolation remains:

- durable task ↔ branch mapping;
- optional worktree per parallel task;
- `Try another version` as a human action;
- thread fork + optional worktree fork underneath;
- side-by-side live variant comparison;
- Keep A / Keep B;
- safe cleanup of abandoned worktrees/branches.

## Reliability / recovery

- exact session restoration after app restart;
- Codex crash detection/restart;
- dev-runtime reattach/restart;
- stale process/worktree cleanup;
- sleep/wake revalidation;
- offline product/file/Git mode;
- secret-sanitized diagnostic support bundle;
- large-repository performance budgets;
- Intel-specific sustained-runtime testing.

## Commercial macOS distribution

Current Intel alphas are ad-hoc signed and not notarized. Commercial quality requires:

- Developer ID signing;
- hardened runtime;
- notarization + stapling;
- signed updater;
- stable/alpha channels;
- accessibility + keyboard audit;
- polished onboarding, native menus and recent projects;
- explicit privacy controls before any crash reporting/telemetry.

## Explicitly not on the critical path

Until the core loop is excellent, do not spend roadmap capacity on:

- VS Code extension compatibility;
- alternative coding agents;
- a custom model gateway;
- cloud collaboration/workspaces;
- SSH remote development;
- Kubernetes/Docker dashboards;
- marketplace mechanics;
- a second coding-agent loop implemented by Monument.

Product standard:

> **Preview + Prompt + Visual editing first. The engineering monster stays underneath.**
