# Monument build roadmap

This roadmap is ordered by **user-visible product gates**. Monument should feel simpler as the engineering control plane underneath becomes more capable.

Canonical current context lives in [`MASTER_PRODUCT_CONTEXT.md`](MASTER_PRODUCT_CONTEXT.md). Deep Visual Editor design lives in [`VISUAL_EDITOR_SPEC.md`](VISUAL_EDITOR_SPEC.md).

## Shipped — Product-first native core

- React + TypeScript + Vite production shell
- Tauri 2 macOS host
- real project inspection, Git metadata and local file tree
- managed local dev runtime and real preview
- local SQLite state
- real Codex App Server lifecycle
- real tasks/threads/streaming/approvals/auth
- no production decorative mock fallback

## Shipped — Live Select / Inspect

- native child WKWebView preview
- loopback-only exact-origin boundary
- Select + `I`
- live hover/select
- DOM/accessibility/text/rect/computed-style context
- bounded source hints
- one-turn visual context attached to Codex
- desktop/mobile viewports

## Shipped — Evidence / Browser QA / Repair

- explicit per-project Auto-QA consent
- supervised typecheck/test/build
- one-shot lint/check
- bounded command output/timeouts/process cleanup
- browser runtime/console/network evidence
- generation-bound evidence freshness
- one-click Fix with Monument
- opt-in bounded Auto Repair, max 2 attempts
- approvals remain authoritative

## Shipped — Version Timeline

- Original baseline
- prompt checkpoints
- Back / Forward / Restore
- alternative paths
- manual Save version
- Compare
- safety checkpoint before restore
- shadow Git isolated from user Git index/history
- symlink-safe restore
- clean Codex context after history navigation
- quality bound to code generations

## Shipped — Prompt Queue

- persistent bounded queue
- enqueue during Codex/post-turn work
- captured Select context
- pause/reorder/remove
- restart/restore safety
- evidence-aware dequeue blocking with explicit override

## Current merge gate — Fresh Review + real Ship (`0.2.0-alpha.7` target)

Implemented in PR #32.

### Fresh Review
- independent reviewer without implementer conversation history
- exact saved Timeline generation vs parent
- bounded diff + bounded source/evidence context
- isolated scratch runtime
- ephemeral read-only structured Codex review
- hard timeout and bounded IO
- blocker/high/medium/low findings
- category/location/evidence/suggested fix/confidence
- blocker cannot be waived
- other findings require explicit waiver reason
- one-click finding repair through normal approval-safe Codex path
- stale review never satisfies Ship

### Ship Gate
- no global Ready without real evidence
- saved/non-dirty/generation-bound version required
- deterministic evidence freshness/result
- browser evidence freshness/result for applicable web runtimes
- Fresh Review freshness/result
- unresolved findings/waivers
- Prompt Queue emptiness
- no active Codex approval/turn/post-turn work
- blocked Ship remains clickable and explains exact missing gates/actions

### Local Git handoff
- exact file plan shown before commit
- refuses pre-staged user index
- NUL-safe path enumeration for spaces/Unicode/untracked files
- explicit `git add -- <exact paths>` only
- repository commit hooks preserved
- explicit local commit message/action
- post-commit remaining working-tree changes surfaced
- no hidden push/PR/network side effect

Definition of done:

> Current saved generation → current checks/browser evidence → independent Fresh Review → blockers resolved/waived according to policy → Ship says Ready → exact Git file plan → explicit local commit succeeds or clearly reports why it cannot.

Remaining before release:
- final web + macOS CI on the final head
- merge PR #32
- publish immutable Intel `0.2.0-alpha.7`

## NEXT ACTIVE GATE — Framer-class Visual Editor

Deep spec: [`VISUAL_EDITOR_SPEC.md`](VISUAL_EDITOR_SPEC.md).

Target workspace:

```text
Layers | Live product canvas | Properties
```

### Editor M1 — Layers + Inspector foundation
- editor mode without harming Preview-first default
- real Layers tree from preview DOM/component intelligence
- preview ↔ Layers selection synchronization
- breadcrumbs and stable selection identity
- source ownership/confidence model
- read-only Properties from computed + source-resolved values

### Editor M2 — Deterministic source editing
- direct text edit
- padding/margin/gap
- width/height/min/max
- typography
- fills/colors
- border/radius/shadow/opacity
- visibility/overflow
- source patches only; no hidden overlay state
- Timeline transaction per committed visual edit

### Editor M3 — Layout intelligence
- flex/grid controls
- alignment/distribution
- position/inset/z-index
- Tailwind/class/design-token aware edits
- component props/variants where discoverable
- responsive breakpoint editing

### Editor M4 — Direct manipulation
- semantic resize handles
- constrained repositioning
- keyboard nudging
- multi-select
- alignment/distribution
- image/source replacement
- undoable visual edit transactions

### Editor M5 — Assisted + Codex structural edits
- ambiguity detection
- compact proposed patch UI
- one-choice assisted edits
- structural changes routed to Codex with exact visual/source context
- no blind mutation of dynamic/generated abstractions

### Editor M6 — Editor QA
- before/after viewport evidence
- desktop/tablet/mobile matrix
- overflow/layout regression signals
- visual hierarchy/spacing review inputs
- editor-specific Fresh Review/Ship evidence
- Intel long-session performance gate

Definition of done:

> Select a real element from Canvas or Layers → inspect real source-backed properties → change text/spacing/color/typography/layout from the right panel → Monument writes real source safely → preview updates → Undo/Redo works through Timeline → ambiguous/structural edits route to assisted/Codex flow rather than corrupting code.

## Following gate — Task isolation / parallel variants

- durable task ↔ branch mapping
- optional worktree per parallel task
- `Try another version`
- thread/worktree fork underneath
- side-by-side live comparison
- Keep A / Keep B
- safe branch/worktree cleanup

## Reliability / recovery

- exact session restoration
- Codex crash/reconnect recovery
- dev runtime reattach/restart
- sleep/wake revalidation
- stale process/worktree cleanup
- offline product/file/Git mode
- secret-sanitized support bundle
- large-repository performance budgets
- Intel sustained-runtime testing

## Commercial macOS distribution

- Developer ID signing
- hardened runtime
- notarization + stapling
- signed updater
- stable/alpha channels
- accessibility + keyboard audit
- onboarding/error/empty-state polish
- native menus/recent projects

## Explicitly not on the critical path

- VS Code extension compatibility
- alternative coding agents
- custom model gateway
- cloud collaboration/workspaces
- SSH remote development
- Kubernetes/Docker dashboards
- marketplace mechanics
- second coding-agent loop implemented by Monument

Product standard:

> **Preview + Prompt + direct visual editing first. The engineering monster stays underneath.**
