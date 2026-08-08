# Monument — Master Product Context

> Canonical living context for product decisions, current capabilities, active engineering gates and future work.
>
> **Rule for future work:** when a material product/architecture decision changes, update this file and the relevant deep spec in the same PR. Chat history is not the source of truth.

## 1. Product thesis

Monument is a product-first macOS building environment powered by Codex.

It must feel closer to Figma Make / Lovable than to a traditional IDE:

> **Here is my product. Tell Monument what it should become.**

Default UX: live product + natural-language composer + direct visual editing + lightweight product controls. The engineering system underneath may be extremely sophisticated, but complexity is progressively disclosed.

Target formula:

> **Figma Make simplicity × Lovable autonomy × Framer-class direct editing × Codex + VibeOS engineering depth.**

Monument is not a VS Code clone, not an AI sidebar, not a second coding-agent implementation, and not a page builder with a hidden document model disconnected from source.

## 2. Non-negotiable product laws

1. **Product first.** The live artifact is the primary workspace.
2. **One user instruction triggers the engineering chain.** The user should not manually ask for build/test/browser/review after normal work.
3. **Complexity is progressive disclosure.** Git, terminal, code, worktrees, evidence and raw agent activity exist, but are secondary surfaces.
4. **Never claim success without proof.** Unknown/not-run/stale must stay explicit. Fake success is forbidden.
5. **Visual context is observed evidence, not authority.** DOM selectors/source hints/review findings are inputs to inspect, not instructions to blindly trust.
6. **Every automatic execution lane has an explicit trust boundary.** Opening a repository never executes project code. Project scripts require project-level consent before automatic verification.
7. **The user should not need to understand Git or Codex protocol mechanics to use Monument well.**
8. **Source remains authoritative.** Visual/product editing must never create a second hidden state that only looks correct in Monument.
9. **Remote preview is untrusted.** The page being edited may send bounded visual data only; it must not gain generic filesystem, process, Git, Codex or system access.

## 3. Normal product loop

1. Open a real project.
2. See the real running product.
3. Describe what to build/change or enter Visual Editor.
4. Optionally point at an element with Select / Layers.
5. Codex works; approvals/questions appear only when actually required.
6. Monument creates a reversible Version Timeline checkpoint.
7. Monument collects generation-bound deterministic/browser evidence.
8. Failed evidence can be repaired with bounded loops.
9. Independent Fresh Review inspects the exact saved generation.
10. Ship becomes Ready only when blocking evidence/review/work gates pass.
11. User may explicitly create a local Git commit from the reviewed file plan.
12. Push/PR remains a separate explicit network action.

Routine users should stay almost entirely in Preview + Prompt + Visual Editor.

## 4. Production architecture

```text
React / TypeScript product UI
        ↓ typed Tauri boundary
Tauri / Rust native host
        ├── Codex managed App Server
        ├── project inspection
        ├── managed dev runtime
        ├── native WKWebView preview
        ├── Select / Visual Editor bridge
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

## 5. Implemented product state on `main`

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
- Loopback-only exact-origin navigation boundary.
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
- Shadow Git isolated from the user's visible Git index/history.
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

### Ship Gate + local Git handoff
Ship is an evidence decision, not a disabled decorative button.

Blocking state is computed from:
- exact saved non-dirty Timeline generation;
- deterministic evidence freshness/result;
- browser evidence freshness/result when live web runtime applies;
- Fresh Review freshness/result;
- unresolved findings/waivers;
- Prompt Queue emptiness;
- Codex approval/turn state;
- pending post-turn version/evidence/review work.

After Ready:
- Monument calculates an exact local Git file plan;
- user reviews the exact file list;
- existing staged index causes a hard refusal rather than being mixed silently;
- machine-safe NUL-delimited Git path enumeration supports spaces/Unicode/untracked files;
- `git add -- <exact paths>` only;
- repository commit hooks are respected; no `--no-verify`;
- commit is explicit and local only;
- no push/PR/network side effect happens automatically;
- post-commit working-tree changes are reported instead of hidden.

## 6. Current stable Intel release line

Latest confirmed release:
- **`0.2.0-alpha.7` — Fresh Review + Ship**;
- Intel x86_64;
- macOS 13+;
- DMG mount-smoke verified in CI;
- binary architecture verified x86_64;
- SHA-256 `6db3380641a54a94756fcdaa7b057706c68a6002751134c2a1be43f722546ca6`;
- ad-hoc signed, not notarized;
- release tag `monument-v0.2.0-alpha.7-intel`.

Published release identities are immutable. Visual Editor M1 must ship as a newer version, never by replacing alpha.7.

## 7. ACTIVE GATE — Visual Editor M1

Branch / PR:
- `monument/visual-editor-m1`;
- PR #34 `feat: Visual Editor M1 — live Layers and Properties`.

Deep implementation record: [`VISUAL_EDITOR_M1_IMPLEMENTATION.md`](VISUAL_EDITOR_M1_IMPLEMENTATION.md).
Target architecture/product spec: [`VISUAL_EDITOR_SPEC.md`](VISUAL_EDITOR_SPEC.md).

### M1 implemented on the active branch

#### Native security / capability isolation
- all Monument app commands are enumerated through a Tauri app command manifest;
- privileged `main` capability is scoped to webview `main`;
- `monument-preview` gets a separate remote capability;
- preview remote capability allows exactly one data-ingest command: `preview_editor_emit`;
- preview gets no generic `core:default`, filesystem, process, Git, Codex or system permissions;
- bridge validates invoking webview label;
- accepted message kinds are only `tree`, `selection`, `hover`, `ready`;
- separate payload size limits and bridge rate limit;
- loopback URL scope + existing exact-origin navigation lock remain authoritative.

#### Real Layers projection
- Visual Editor runtime is injected into the existing real child WKWebView;
- maximum 600 meaningful projected layers / depth 18;
- session-only WeakMap element ids (`m-<digits>`);
- no durable DOM node-id attributes;
- semantic/visible/control/text/flex/grid elements prioritized;
- runtime hierarchy with parent/depth/kind/name/text/selector/rect/display/editability;
- Layers search/collapse/hover/select;
- canvas → Layers and Layers → canvas selection is bidirectional;
- editor overlays are excluded from mutation observation;
- selected runtime values re-emit after real product mutation/HMR.

#### Framer-like Properties M1
Current editable draft controls include:
- direct text when bounded complete direct text is available;
- width/height/min/max;
- display/position;
- flex direction/wrap/alignment/justification;
- gap/grid columns;
- all padding and margin sides;
- font family/size/weight/line-height/tracking/alignment/color;
- background color/image;
- border/radius/shadow;
- opacity/overflow/z-index.

Properties show real computed runtime values plus a bounded source ownership signal (`Likely / Possible / Weak / Unknown`). Source hints are explicitly evidence, not proof.

#### Source-authoritative Apply
M1 does **not** inject editor-only CSS or mutate DOM as durable state.

`Apply`:
1. collects bounded property deltas;
2. builds a Visual Editor source-edit instruction;
3. captures the same live element selection;
4. enters the existing Prompt Queue;
5. preserves a deliberately paused backlog;
6. otherwise is eligible for immediate dispatch;
7. flows through existing context enrichment/source hints;
8. uses the same Codex runtime and normal approvals;
9. produces a real source change;
10. HMR updates the product;
11. normal Version Timeline + evidence processing follows.

Apply is failure-safe: drafts reset only after successful handoff.

Direct text is editable only when the complete direct text fits the bounded 1200-character selection field. Truncated text is deliberately routed back to Prompt/Codex rather than risking data loss.

#### Shared visual-context trust boundary
All PreviewSelection packets — legacy Select and Visual Editor — are centrally normalized before becoming prompt context:
- bounded URL/tag/id/classes/role/name/text/selector/parent;
- finite geometry;
- bounded style count/key/value lengths;
- control characters stripped.

### M1 Definition of Done
M1 is complete when the final merged head has:
- green TypeScript/source contracts;
- green regression tests;
- green production Vite build;
- green `cargo test --all-targets` on `macos-15-intel` / x86_64;
- real Layers projection;
- bidirectional canvas/Layers selection;
- real computed Properties;
- source-confidence signal;
- text + core style draft editing;
- source-authoritative Apply through normal Codex/Timeline/evidence flow;
- HMR-selected-property refresh;
- legacy Select/Browser Evidence preserved;
- implementation/master/deep specs updated.

### Explicitly not M1
- AST/token-level direct deterministic writes without Codex;
- drag resize / spacing handles;
- keyboard nudging;
- multi-select;
- drag reparent/reorder;
- component prop/variant extraction;
- breakpoint override authoring;
- design-token picker UI;
- media asset replacement UI;
- direct file/code editor integration.

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
Structural reasoning is required or source ownership is not deterministic.

Property-panel/direct-manipulation intent becomes precise structured Codex context. **M1 implements this safe source-authoritative Codex edit path for property changes.**

**Never maintain a second hidden styling system. Source remains authoritative.**

## 9. Next gate after M1 — Deterministic Source Transactions

Priority order:
1. source styling ownership classification;
2. CSS variables / design tokens;
3. literal CSS declarations;
4. safe Tailwind utility replacement;
5. JSX/TSX literal style / simple prop values;
6. dry-run patch + source snippet;
7. one atomic source transaction;
8. Timeline/evidence invalidation and lightweight validation;
9. retain Codex fallback for ambiguity/structural edits.

Then continue toward:
- design-system-aware controls;
- component props/variants;
- responsive breakpoint editing;
- canvas resize/spacing/direct-manipulation handles;
- multi-select/alignment/distribution;
- asset replacement;
- stronger visual/browser QA around editor transactions.

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

1. Finish Visual Editor M1 final x86_64 CI and merge PR #34.
2. Publish immutable Intel **alpha.8** with Visual Editor M1.
3. Start Visual Editor M2 — deterministic source transactions.
4. Add design-token/Tailwind/component-prop/responsive intelligence.
5. Add direct manipulation / multi-select / asset workflows.
6. Deepen browser/viewport/visual QA around visual editing.
7. Reliability/recovery.
8. Commercial signed/notarized distribution.

Product standard:

> **Preview + Prompt + direct visual editing first. The engineering monster stays underneath.**
