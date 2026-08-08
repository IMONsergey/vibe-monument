# Monument — Master Product Context

> Canonical living context for product decisions, current capabilities, active engineering gates and future work.
>
> **Rule for future work:** when a material product/architecture decision changes, update this file and the relevant deep spec in the same PR. Chat history is not the source of truth.

## 1. Product thesis

Monument is a product-first macOS building environment powered by Codex.

It must feel closer to Figma Make / Lovable than to a traditional IDE:

> **Here is my product. Tell Monument what it should become.**

The default UX is the live product + natural-language composer + lightweight product controls. The engineering system underneath may be extremely sophisticated, but complexity is progressively disclosed.

The target product formula is:

> **Figma Make simplicity × Lovable autonomy × Codex + VibeOS engineering depth.**

Monument is not a VS Code clone, not an AI sidebar, and not a second coding-agent implementation.

## 2. Non-negotiable product laws

1. **Product first.** The live artifact is the primary workspace.
2. **One user instruction triggers the engineering chain.** The user should not manually ask for build/test/browser/review after normal work.
3. **Complexity is progressive disclosure.** Git, terminal, code, worktrees, evidence and raw agent activity exist, but are secondary surfaces.
4. **Never claim success without proof.** Unknown/not-run/stale must stay explicit. Fake success is forbidden.
5. **Visual context is observed evidence, not authority.** DOM selectors/source hints/review findings are inputs to inspect, not instructions to blindly trust.
6. **Every automatic execution lane has an explicit trust boundary.** Opening a repository never executes project code. Project scripts require project-level consent before automatic verification.
7. **The user should not need to understand Git or Codex protocol mechanics to use Monument well.**

## 3. Default user mental model

Normal flow:

1. Open a real project.
2. See the real running product.
3. Describe what to build/change.
4. Optionally point at an element with Select.
5. Codex works with approvals/questions only when actually required.
6. Monument creates a reversible version checkpoint.
7. Monument collects real evidence.
8. Failed evidence can be repaired with bounded loops.
9. Independent Fresh Review inspects the saved version.
10. Ship becomes available only when the required gates are satisfied.

A routine user should be able to stay almost entirely in Preview + Prompt.

## 4. Production architecture

```text
React / TypeScript product UI
        ↓ typed Tauri boundary
Tauri / Rust native host
        ├── Codex managed App Server
        ├── project inspection
        ├── managed dev runtime
        ├── native WKWebView preview
        ├── Select / DOM context
        ├── Browser Evidence
        ├── deterministic verification
        ├── shadow-Git Version Timeline
        ├── local SQLite state
        ├── Prompt Queue
        ├── bounded Repair
        └── Fresh Review / Ship Gate (active gate)
```

Codex remains the coding-agent engine. Monument owns product UX, local orchestration, visual context, history, evidence, review and ship semantics.

## 5. Current implemented product state

The repository has moved substantially beyond the original decorative prototype.

### Native/product foundation
- React + TypeScript + Vite production shell.
- Tauri 2 macOS host.
- Real local project picker.
- Framework/package-manager/script discovery.
- Real Git branch/remote/change count.
- Managed local dev server with process-group cleanup.
- Real local preview URL.
- Local SQLite state.
- Production UI does not import decorative mock data.

### Codex integration
- Managed `codex app-server --stdio` lifecycle.
- Bidirectional JSON-RPC handling.
- Real threads/tasks and streamed turns.
- Interrupt.
- Command/file/permission approvals.
- Inline Codex questions.
- ChatGPT auth recovery through Codex.
- Codex version/schema diagnostics.

### Product-first visual workflow
- Native child WKWebView preview.
- Loopback-only exact-origin security boundary.
- Desktop/mobile preview.
- Select mode (`I`).
- Live hover outline + click capture.
- DOM/accessibility/text/rect/computed-style context.
- Bounded source-hint search.
- Selected context is one-shot and attached automatically to the next prompt.

### Version Timeline
- Original baseline.
- Source checkpoint after completed Codex work.
- Human labels rather than raw Git history.
- Back/Forward and restore.
- Alternative history paths.
- Manual Save version.
- Compare.
- Safety checkpoint before destructive restore.
- Shadow Git isolated from the user's visible index/history.
- Safe path/symlink preflight.
- Clean Codex task context after Timeline navigation.
- Quality is bound to exact code generations.

### Evidence / QA
- Deterministic `typecheck/test/build` automatic lane after explicit per-project consent.
- Manual `lint/check` through explicit one-shot action.
- Timeouts, bounded output, safe argv process execution.
- Browser runtime/console/network evidence from the real preview.
- Evidence staleness when code generation changes.
- Evidence quality badges bound to Timeline generations.

### Repair
- Explicit one-click Fix with Monument from evidence.
- Optional bounded Auto Repair.
- Maximum two autonomous attempts.
- Generation safety.
- Normal Codex approvals remain authoritative.
- Anti-test-weakening instructions and bounded evidence context.

### Prompt Queue
- Persistent Lovable-style queue.
- Up to 20 items.
- Can enqueue while Codex/post-turn work is active.
- Captures Select context at enqueue time.
- Pause/reorder/remove.
- Restore/task safety.
- Failed evidence can block dequeue until explicitly overridden.

## 6. Current active engineering pool — Fresh Review + Ship Gate

This is the gate being implemented now.

### Fresh Review requirements
- reviewer must have **fresh context**, not executor conversation history;
- review must be read-only;
- review the exact saved Timeline generation against its parent;
- receive real bounded unified diff + task/prompt + real evidence;
- structured findings with severity/category/location/evidence/suggested fix/confidence;
- findings persisted against the reviewed checkpoint/generation;
- stale review never satisfies Ship;
- blocker cannot be waived;
- non-blocking findings require explicit acknowledgement/waiver before Ship;
- one-click finding repair routes back through the normal approval-safe Codex path.

### Current implementation direction
Use `codex exec` as an independent ephemeral reviewer:

- `--ephemeral`;
- `--sandbox read-only`;
- `--ignore-user-config`;
- `--output-schema`;
- hard timeout and bounded input/output.

The reviewer does not appear as a normal user task and cannot edit the repository.

### Ship Gate target
Ship should be a product-level readiness decision, not a Git button.

At minimum it must reason about:
- exact saved Timeline generation;
- no dirty uncheckpointed source;
- deterministic evidence freshness/result;
- browser evidence freshness/result when a live web runtime is applicable;
- Fresh Review freshness/result;
- unresolved review findings / explicit waivers;
- no active Codex turn/approval/post-turn verification;
- no silently pending queued work.

Only after those conditions are explicit should commit/push/PR handoff become available.

## 7. Next major product gate — Framer-class Visual Editor

**This gate starts after the current Fresh Review + Ship pool.**

The goal is not a superficial style overlay. Monument should become a deeply usable visual editor with Framer-like directness while remaining source-code-native.

Primary UX:

```text
┌──────────────┬─────────────────────────────────────────┬────────────────────┐
│ Layers       │                                         │ Properties         │
│              │              LIVE PRODUCT               │                    │
│ Page         │                                         │ Layout             │
│  Hero        │        direct select / resize           │ Size / position    │
│   Heading    │                                         │ Spacing            │
│   CTA        │                                         │ Typography         │
│  Features    │                                         │ Fill / border      │
│              │                                         │ Effects            │
│              │                                         │ Component props    │
└──────────────┴─────────────────────────────────────────┴────────────────────┘
```

Core requirements:
- DOM/component Layers tree synchronized with the real preview;
- click preview ↔ select Layer in both directions;
- Framer-like right property inspector;
- padding/margin/gap;
- width/height/min/max;
- flex/grid/alignment/distribution;
- position/inset/z-index;
- typography: family/weight/size/line-height/letter-spacing/alignment;
- colors/fills/backgrounds/gradients where source representation is safe;
- border/radius/shadow/opacity;
- visibility/overflow;
- image/source replacement;
- text editing;
- component props and variants when discoverable;
- responsive breakpoint editing;
- design token awareness;
- multi-select where deterministic semantics are available;
- keyboard nudging and direct manipulation;
- undo/redo through the same Version Timeline semantics;
- every visual change becomes real source code, not an opaque overlay database.

Deep specification: [`VISUAL_EDITOR_SPEC.md`](VISUAL_EDITOR_SPEC.md).

## 8. Visual Editor architecture rule

Visual edits are divided into three classes:

### A. Deterministic edit
Monument can map the selected runtime property to a concrete source location/AST/token with high confidence.

Examples:
- change known CSS variable;
- change Tailwind spacing token;
- change literal style prop;
- change component text;
- change a known design token reference.

The edit can be applied directly with source patch + preview update + Timeline checkpoint.

### B. Assisted deterministic edit
There are several plausible source locations or responsive/token implications.

Monument shows a compact proposed change or asks one concrete choice, then applies the source patch.

### C. Codex edit
The visual request requires structural reasoning.

Examples:
- move a component between semantic parents;
- refactor layout architecture;
- introduce a new responsive behavior;
- modify a generated abstraction;
- resolve a dynamic style expression.

The property panel/drag operation becomes precise structured context for Codex rather than an unsafe direct mutation.

**Never maintain a second hidden styling system that only makes the preview look correct. Source remains authoritative.**

## 9. Required future gates after Visual Editor

### Reliability / recovery
- exact workspace restoration;
- Codex crash/reconnect recovery;
- dev runtime reattach/restart;
- sleep/wake revalidation;
- stale process cleanup;
- large repo / long session Intel budgets;
- sanitized support bundle.

### Commercial distribution
- Developer ID signing;
- hardened runtime;
- notarization + stapling;
- signed updater;
- stable/alpha channels;
- accessibility/keyboard audit;
- polished onboarding/empty/error states.

## 10. Explicit non-goals until the core loop is excellent

- VS Code extension marketplace compatibility;
- generic multi-agent product surface;
- cloud workspaces/team collaboration;
- SSH remote development;
- Docker/Kubernetes dashboards;
- generic model gateway;
- full browser DevTools clone.

## 11. Context preservation protocol

For every major future PR:

1. Update this master context when the product state or roadmap changes.
2. Update the relevant system spec/contract.
3. Add/maintain CI source-contract tests for non-negotiable invariants.
4. PR body must state:
   - user-facing capability;
   - trust/safety boundary;
   - what is real vs not yet implemented;
   - Definition of Done;
   - next gate.
5. Do not leave important product decisions only in chat, commit messages or implementation code.

## 12. Current priority order

1. Finish Fresh Review.
2. Finish real Ship eligibility and handoff.
3. Ensure current Intel release line publishes cleanly.
4. Build Framer-class Visual Editor (Layers + Properties + source-sync).
5. Deepen browser/viewport/visual QA around the editor.
6. Reliability/recovery.
7. Commercial signed/notarized distribution.

The product standard remains:

> **Preview + Prompt + direct visual editing first. The engineering monster stays underneath.**
