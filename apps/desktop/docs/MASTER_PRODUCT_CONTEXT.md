# Monument — Master Product Context

> Canonical living context for product decisions, current capabilities, active engineering gates and future work.
>
> **Rule for future work:** when a material product/architecture decision changes, update this file and the relevant deep spec in the same PR. Chat history is not the source of truth.

## 1. Product thesis

Monument is a product-first macOS building environment powered by Codex.

It must feel closer to Figma Make / Lovable than to a traditional IDE:

> **Here is my product. Tell Monument what it should become.**

Default UX: live product + natural-language composer + lightweight product controls. The engineering system underneath may be extremely sophisticated, but complexity is progressively disclosed.

Target formula:

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
8. **Source remains authoritative.** Visual/product editing must never create a second hidden state that only looks correct in Monument.

## 3. Normal product loop

1. Open a real project.
2. See the real running product.
3. Describe what to build/change.
4. Optionally point at an element with Select.
5. Codex works; approvals/questions appear only when actually required.
6. Monument creates a reversible Version Timeline checkpoint.
7. Monument collects generation-bound deterministic/browser evidence.
8. Failed evidence can be repaired with bounded loops.
9. Independent Fresh Review inspects the exact saved generation.
10. Ship becomes Ready only when blocking evidence/review/work gates pass.
11. User may explicitly create a local Git commit from the reviewed file plan.
12. Push/PR remains a separate explicit network action.

Routine users should stay almost entirely in Preview + Prompt.

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
        ├── ephemeral Fresh Review
        └── evidence-based Ship + local Git handoff
```

Codex remains the coding-agent engine. Monument owns product UX, local orchestration, visual context, history, evidence, review and ship semantics.

## 5. Implemented product state

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
- Quality bound to exact code generations.

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
- Anti-test-weakening rules and bounded evidence context.

### Prompt Queue
- Persistent Lovable-style queue.
- Up to 20 items.
- Enqueue while Codex/post-turn work is active.
- Captures Select context at enqueue time.
- Pause/reorder/remove.
- Restore/task safety.
- Failed evidence can block dequeue until explicitly overridden.

### Fresh Review
- independent reviewer with no implementer conversation history;
- exact saved Timeline generation vs parent;
- bounded unified diff + bounded source/evidence context;
- separate ephemeral Codex process in a scratch directory;
- read-only sandbox, ignored user config, structured JSON output;
- hard timeout and bounded IO;
- findings persisted against checkpoint/generation;
- blocker/high/medium/low severity plus category/location/evidence/suggested fix/confidence;
- blocker cannot be waived;
- non-blocking findings require explicit waiver reason;
- one-click finding repair routes through normal approval-safe Codex repair path;
- stale review never satisfies Ship.

### Ship Gate
Ship is now an evidence decision, not a disabled decorative button.

Blocking state is computed from:
- exact saved non-dirty Timeline generation;
- deterministic evidence freshness/result;
- browser evidence freshness/result when live web runtime applies;
- Fresh Review freshness/result;
- unresolved findings/waivers;
- Prompt Queue emptiness;
- Codex approval/turn state;
- pending post-turn version/evidence/review work.

When all blocking gates pass, UI says **Ready to ship**.

### Local Git Ship handoff
After Ready:
- Monument calculates an exact local Git file plan;
- user reviews the exact file list;
- existing staged index causes a hard refusal rather than being mixed silently;
- machine-safe NUL-delimited Git path enumeration supports spaces/Unicode/untracked files;
- `git add -- <exact paths>` only;
- repository commit hooks are respected; no `--no-verify`;
- user supplies/edits the commit message;
- commit is explicit and local only;
- no push/PR/network side effect happens automatically;
- post-commit working-tree changes are reported instead of hidden.

## 6. Current stable Intel release line

Latest confirmed release before Fresh Review/Ship merge:
- `0.2.0-alpha.6`;
- Intel x86_64;
- macOS 13+;
- DMG mount-smoke verified in CI;
- binary architecture verified x86_64;
- SHA-256 recorded in `builds/monument-intel-alpha.json`;
- ad-hoc signed, not notarized.

Fresh Review/Ship must publish under a new immutable version; never reuse alpha.6.

## 7. NEXT ACTIVE GATE — Framer-class Visual Editor

This starts immediately after Fresh Review + Ship is merged/released.

Goal: a deeply usable source-native visual editor with Framer-like directness, not a superficial CSS overlay.

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
- DOM/component Layers tree synchronized with real preview;
- preview selection ↔ Layers selection bidirectionally;
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
- direct text editing;
- component props/variants when discoverable;
- responsive breakpoint editing;
- design-token awareness;
- multi-select where deterministic semantics are available;
- keyboard nudging and direct manipulation;
- undo/redo through Version Timeline;
- every visual change becomes real source code, never opaque preview-only state.

Deep specification: [`VISUAL_EDITOR_SPEC.md`](VISUAL_EDITOR_SPEC.md).

## 8. Visual Editor edit classes

### A. Deterministic edit
High-confidence runtime property → concrete source/AST/token mapping.

Examples:
- known CSS variable;
- Tailwind spacing token;
- literal style prop;
- component text;
- known design-token reference.

Apply direct source patch + preview update + Timeline checkpoint.

### B. Assisted deterministic edit
Several plausible source locations or responsive/token implications.

Show a compact proposed change or one concrete choice, then patch source.

### C. Codex edit
Structural reasoning is required.

Examples:
- move component between semantic parents;
- refactor layout architecture;
- introduce new responsive behavior;
- modify generated abstraction;
- resolve dynamic style expression.

Property-panel/direct-manipulation intent becomes precise structured Codex context.

**Never maintain a second hidden styling system. Source remains authoritative.**

## 9. Visual Editor delivery sequence

1. Editor shell mode without harming Preview-first default.
2. Real Layers tree from instrumented preview.
3. Bidirectional selection and breadcrumbs.
4. Source ownership/confidence model.
5. Read-only property inspector from computed + source-resolved values.
6. Deterministic text edit.
7. Spacing/sizing source edits.
8. Typography/color/border/radius edits.
9. Flex/grid controls.
10. Design tokens and Tailwind/class-aware editing.
11. Component props/variants.
12. Responsive breakpoint model.
13. Direct resize/reposition handles where semantics permit.
14. Multi-select/alignment/distribution.
15. Image replacement/assets.
16. Assisted-edit preview/patch flow.
17. Codex structural-edit handoff.
18. Timeline checkpoints + evidence after visual edit transactions.
19. Editor-specific browser/viewport/visual QA.
20. Intel performance gate and release.

## 10. Required future gates after Visual Editor

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

## 11. Explicit non-goals until core loop is excellent

- VS Code extension marketplace compatibility;
- generic multi-agent product surface;
- cloud workspaces/team collaboration;
- SSH remote development;
- Docker/Kubernetes dashboards;
- generic model gateway;
- full browser DevTools clone.

## 12. Context preservation protocol

For every major PR:
1. Update this master context when product state/roadmap changes.
2. Update the relevant deep system spec/contract.
3. Add/maintain CI regression contracts for non-negotiable invariants.
4. PR body states user-facing capability, trust boundary, real/not-yet-real state, Definition of Done and next gate.
5. Important decisions must not live only in chat, commit messages or implementation code.

## 13. Current priority order

1. Merge Fresh Review + evidence-based Ship + local Git handoff after final green macOS CI.
2. Publish a new immutable Intel release for that gate.
3. **Build Framer-class Visual Editor (Layers + Properties + source-sync).**
4. Deepen browser/viewport/visual QA around visual editing.
5. Reliability/recovery.
6. Commercial signed/notarized distribution.

Product standard:

> **Preview + Prompt + direct visual editing first. The engineering monster stays underneath.**
