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
10. **Direct editing is proof-driven.** A lower direct-edit hit rate is acceptable; an incorrect deterministic source write is not.

## 3. Normal product loop

1. Open a real project.
2. See the real running product.
3. Describe what to build/change or enter Visual Editor.
4. Optionally point at an element with Select / Layers.
5. Monument chooses the safest execution class:
   - deterministic direct source transaction when ownership is proven;
   - assisted choice when a bounded scope decision is possible;
   - Codex when reasoning/structure/ownership is ambiguous.
6. Codex approvals/questions appear only when actually required.
7. Monument creates a reversible Version Timeline checkpoint for the resulting code generation.
8. Monument collects generation-bound deterministic/browser evidence.
9. Failed evidence can be repaired with bounded loops.
10. Independent Fresh Review inspects the exact saved generation.
11. Ship becomes Ready only when blocking evidence/review/work gates pass.
12. User may explicitly create a local Git commit from the reviewed file plan.
13. Push/PR remains a separate explicit network action.

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
        ├── deterministic source transaction engine
        ├── Browser Evidence
        ├── deterministic verification
        ├── shadow-Git Version Timeline
        ├── local SQLite state
        ├── Prompt Queue
        ├── bounded Repair
        ├── ephemeral Fresh Review
        └── evidence-based Ship + local Git handoff
```

Codex remains the coding-agent engine. Monument owns product UX, local orchestration, visual context, direct-edit proof, history, evidence, review and ship semantics.

## 5. Implemented product state on stable `main`

Stable `main` at the parent of the active M2 gate contains Visual Editor M1 and the full proof-oriented Codex workflow.

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

### Product-first visual workflow / Visual Editor M1
- Native child WKWebView preview.
- Loopback-only exact-origin navigation boundary.
- Desktop/mobile preview.
- Select mode (`I`).
- Live hover outline + click capture.
- Real Layers projection with bounded runtime hierarchy.
- Bidirectional canvas ↔ Layers selection/hover.
- Real computed Properties.
- Core Framer-like layout/spacing/type/appearance draft controls.
- Bounded complete direct text editing intent.
- Bounded source-hint search.
- Visible source-confidence signal (`Likely / Possible / Weak / Unknown`).
- Source hints are explicitly evidence, not proof.
- M1 `Apply` remains source-authoritative by routing property intent through the normal Prompt Queue/Codex path; it never persists preview-only styling.

Deep M1 record: [`VISUAL_EDITOR_M1_IMPLEMENTATION.md`](VISUAL_EDITOR_M1_IMPLEMENTATION.md).
Target editor architecture: [`VISUAL_EDITOR_SPEC.md`](VISUAL_EDITOR_SPEC.md).

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
Ship is an evidence decision, not a decorative button.

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
- **`0.2.0-alpha.8` — Visual Editor M1**;
- Intel x86_64;
- macOS 13+;
- DMG mount-smoke verified in CI;
- binary architecture verified x86_64;
- SHA-256 `6b261684a7622d1324e8b20ab4df2d71ebd6a6e05f2c6ae19cb0ee3f7f280713`;
- ad-hoc signed, not notarized;
- release tag `monument-v0.2.0-alpha.8-intel`.

Published release identities are immutable. M2 must ship as a newer version; alpha.8 must never be replaced in place.

## 7. ACTIVE GATE — Visual Editor M2.1: Deterministic Source Transactions

Branch:
- `monument/visual-editor-m2-source-transactions`.

Deep implementation contract: [`VISUAL_EDITOR_M2_SOURCE_TRANSACTIONS.md`](VISUAL_EDITOR_M2_SOURCE_TRANSACTIONS.md).
Editor target architecture: [`VISUAL_EDITOR_SPEC.md`](VISUAL_EDITOR_SPEC.md).

### M2.1 implemented on the active branch

#### First real direct source-edit lane
- bounded plain `.css` literal-declaration ownership resolver in Rust;
- dry-run command `project_source_transaction_preview`;
- commit command `project_source_transaction_commit`;
- native commit re-runs the resolver instead of trusting the frontend preview;
- source/runtime literal equivalence required before direct write;
- explicit deterministic / assisted / Codex routing modes;
- unsupported/ambiguous cases retain the M1 Codex fallback.

#### Safety / transaction boundary
- no regex-based blind replacement;
- bounded CSS file/byte/change/value budgets;
- comments/strings/functions/braces parsed by a bounded structural state machine;
- safe id/class selector evidence;
- duplicate/responsive owners refuse direct mutation;
- token-backed values such as `var(--space)` are recognized as assisted rather than flattened to literals;
- entire direct batch must resolve to one file;
- target must be a regular non-symlink file inside canonical project root;
- expected original source ranges are checked again immediately before replacement;
- updated CSS is structurally revalidated;
- same-directory create-new temp write + flush + `sync_all` + permission preservation + atomic rename;
- no shell interpolation.

#### Tauri capability boundary
- both direct transaction commands are in the app command manifest;
- both are allowed only in the privileged `main` webview capability;
- remote preview capability remains data-only and does not gain source-write authority.

#### Visual generations
Direct edits are first-class Timeline generations without pretending to be Codex turns.

Namespace:
- positive generation serials = Codex turns;
- negative generation serials = direct Visual Editor transactions;
- zero = unbound/invalid.

A successful direct write immediately creates `kind: visual` Timeline checkpoint with bounded human context.

The same negative generation serial is used to bind:
- deterministic verification;
- browser evidence;
- Version Timeline quality;
- Fresh Review checkpoint identity;
- Ship eligibility.

#### Orchestration / race safety
The active branch tracks three handoff states:
- source changed but checkpoint not completed;
- visual checkpoint created but main Timeline state has not acknowledged it as current;
- exact visual generation is still in evidence processing.

Ship blocks across all three.

Direct source mutation is also globally refused while Monument is already changing/verifying project state through:
- Codex;
- Prompt Queue dispatch;
- Timeline operations;
- deterministic verification;
- browser capture;
- Fresh Review.

A second direct edit cannot overlap the evidence cycle of the first.

#### Post-edit engineering chain
Successful direct `Apply` dispatches `monument:source-transaction` and the main App:
1. refreshes Timeline to the exact visual checkpoint;
2. starts generation-bound deterministic verification;
3. respects the existing per-project Auto checks permission;
4. refreshes project inspection;
5. clears old browser evidence buffer when preview exists;
6. allows HMR to settle;
7. captures browser runtime/console/network evidence for the same visual generation;
8. releases the validation/source-mutation lock.

This preserves the product law that normal work triggers the engineering chain automatically.

#### User-facing Apply routing
Properties `Apply` now reports either:
- **direct source apply** with source path and applied-change count; or
- **Codex fallback** for token/responsive/ambiguous/structural/unsupported edits.

The visible source-confidence card is still not write authority; the native resolver independently proves the direct transaction.

### M2.1 Definition of Done
M2.1 is complete when the final merged head has:
- green TypeScript/source contracts;
- green Node regression tests;
- green production Vite build;
- green Rust unit tests / `cargo test --all-targets` on Intel macOS CI;
- native direct CSS literal transaction engine;
- dry-run + native re-resolution on commit;
- symlink/root containment and atomic-write guarantees;
- hybrid direct/Codex routing;
- visual Timeline generation namespace;
- automatic evidence handoff;
- Ship race guards;
- legacy M1 Select/Layers/Properties/Codex path preserved;
- master/deep specs updated.

### Explicitly not M2.1
These must not be represented as direct yet:
- CSS variable/design-token scope editing;
- design-token picker UI;
- Tailwind utility replacement;
- JSX/TSX literal style/simple prop editing;
- component text AST mutation;
- className composition edits;
- CSS-in-JS ownership;
- responsive breakpoint authoring UI;
- multi-file direct transactions;
- drag resize / spacing handles;
- keyboard nudging;
- multi-select;
- drag reparent/reorder;
- component prop/variant extraction;
- asset replacement UI.

They remain Codex-routed or future gates.

## 8. Visual Editor edit classes

### A. Deterministic edit
High-confidence runtime property → one concrete bounded source location whose current literal/source semantics can be proven.

M2.1 first implementation:
- one literal CSS declaration owner;
- one source file for the full transaction.

Action:
- dry-run;
- native re-resolution;
- atomic source transaction;
- visual Timeline generation;
- evidence processing.

### B. Assisted deterministic edit
Source evidence is strong, but one bounded scope/ownership choice remains.

Examples:
- token local/global/instance scope;
- responsive scope;
- multiple plausible owners.

Current M2.1 behavior: route to Codex rather than guessing. Future behavior: compact explicit choice + deterministic patch.

### C. Codex edit
Structural reasoning is required or ownership cannot be proven safely.

Examples:
- text/structure;
- Tailwind/JSX before their dedicated ownership engines exist;
- multi-file change;
- ambiguous styling abstraction.

The existing source-authoritative Prompt Queue/Codex path remains the safe fallback.

**Never maintain a second hidden styling system. Source remains authoritative.**

## 9. Next M2 gates

Priority order after M2.1:
1. token-aware CSS variable ownership;
2. explicit local/global/instance scope choice;
3. direct transaction dry-run/source diff UI where a human choice is useful;
4. safe Tailwind utility parser/replacement;
5. JSX/TSX literal style/simple prop ownership;
6. component text AST ownership;
7. component props/variants;
8. responsive breakpoint ownership and override authoring;
9. design-system token picker;
10. canvas resize/spacing/direct-manipulation handles on top of the same transaction engine;
11. multi-select/alignment/distribution;
12. asset replacement;
13. only then consider proven multi-file atomic transactions.

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

1. Finish Visual Editor M2.1 x86_64 CI and merge the deterministic source-transaction PR.
2. Publish immutable Intel **alpha.9** only after the merged M2.1 head passes release smoke/architecture checks.
3. Add token-aware CSS variables + explicit scope decisions.
4. Add Tailwind + JSX/TSX ownership engines.
5. Add design-token/component-prop/responsive intelligence.
6. Build direct manipulation / multi-select / asset workflows on top of the same transaction layer.
7. Deepen browser/viewport/visual QA around visual editing.
8. Reliability/recovery.
9. Commercial signed/notarized distribution.

Product standard:

> **Preview + Prompt + direct visual editing first. The engineering monster stays underneath.**
