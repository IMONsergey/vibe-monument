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
10. **Source state is identified by Timeline checkpoint, not agent turn.** Codex turns are provenance; checks/review/repair/Ship prove the exact saved checkpoint.
11. **Fast editing may only be fast while deterministic.** Ambiguity, shared scope, malformed source or concurrent work routes to Codex rather than guessing.

## 3. Normal product loop

1. Open a real project.
2. See the real running product.
3. Describe what to build/change or enter Visual Editor.
4. Optionally point at an element with Select / Layers.
5. For a provably deterministic property edit, Monument can dry-run and patch source directly; otherwise Codex works normally.
6. Approvals/questions appear only when actually required.
7. Monument creates one reversible Version Timeline checkpoint for the resulting source state.
8. Monument collects checkpoint-bound deterministic/browser evidence.
9. Failed evidence can be repaired with bounded loops.
10. Independent Fresh Review inspects the exact saved checkpoint.
11. Ship becomes Ready only when blocking evidence/review/work gates pass for that checkpoint.
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
        ├── deterministic visual-source transaction engine
        ├── Browser Evidence
        ├── deterministic verification
        ├── shadow-Git Version Timeline
        ├── local SQLite state
        ├── Prompt Queue
        ├── bounded Repair
        ├── ephemeral Fresh Review
        └── evidence-based Ship + local Git handoff
```

Codex remains the coding-agent engine. Monument owns product UX, local orchestration, visual context, safe deterministic edit classes, history, evidence, review and ship semantics.

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

### Product-first visual workflow — Visual Editor M1
- Native child WKWebView preview.
- Loopback-only exact-origin navigation boundary.
- Desktop/mobile preview.
- Select mode (`I`).
- Live hover outline + click capture.
- DOM/accessibility/text/rect/computed-style context.
- Bounded source-hint search.
- Real Layers projection from the running product.
- Bidirectional canvas ↔ Layers selection.
- Computed Properties for layout, spacing, typography and appearance.
- Bounded direct-text editing when complete text is available.
- Source ownership signal (`Likely / Possible / Weak / Unknown`).
- M1 Apply remains source-authoritative through Prompt Queue → Codex → Timeline → evidence.
- No durable preview-only styling model.

Deep M1 record: [`VISUAL_EDITOR_M1_IMPLEMENTATION.md`](VISUAL_EDITOR_M1_IMPLEMENTATION.md).
Target architecture/product spec: [`VISUAL_EDITOR_SPEC.md`](VISUAL_EDITOR_SPEC.md).

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
- Exact saved checkpoint is authoritative source/evidence identity.
- `turnSerial` is Codex provenance only and may legitimately be null.

### Evidence / QA
- Deterministic `typecheck/test/build` automatic lane after explicit per-project consent.
- Manual `lint/check` through explicit one-shot action.
- Timeouts, bounded output, safe argv process execution.
- Browser runtime/console/network evidence from the real preview.
- Deterministic evidence stores exact `checkpointId`.
- Browser evidence stores exact `capturedForCheckpointId` and revalidates after capture.
- Dirty/changed source makes old evidence stale.
- Timeline quality badges are checkpoint-keyed.
- Legacy turn-only quality is not guessed onto current checkpoints.

### Repair
- Explicit one-click Fix with Monument from evidence.
- Optional bounded Auto Repair.
- Maximum two autonomous attempts.
- Checkpoint safety guard before repair.
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
- Override semantics are checkpoint-bound so a bypass cannot leak onto another source state.

### Fresh Review
- independent reviewer with no implementer conversation history;
- exact saved Timeline checkpoint vs parent;
- bounded unified diff + bounded source/evidence context;
- separate ephemeral Codex process in a scratch directory;
- read-only sandbox, ignored user config, structured JSON output;
- hard timeout and bounded IO;
- findings persisted against checkpoint;
- blocker/high/medium/low severity plus category/location/evidence/suggested fix/confidence;
- blocker cannot be waived;
- non-blocking findings require explicit waiver reason;
- one-click finding repair routes through normal approval-safe Codex repair path;
- stale review never satisfies Ship.

### Ship Gate + local Git handoff
Ship is an evidence decision, not a decorative button.

Blocking state is computed from:
- exact saved non-dirty Timeline checkpoint;
- deterministic evidence freshness/result for that checkpoint;
- browser evidence freshness/result for that checkpoint when live web runtime applies;
- Fresh Review freshness/result for that checkpoint;
- unresolved findings/waivers;
- Prompt Queue emptiness;
- Codex approval/turn state;
- pending post-turn version/evidence/review work.

A saved checkpoint does **not** need a Codex turn to be shippable.

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
- Intel x86_64 (`x86_64-apple-darwin`);
- macOS 13+;
- built on `macos-15-intel`;
- DMG mount-smoke verified;
- binary architecture verified x86_64;
- SHA-256 `6b261684a7622d1324e8b20ab4df2d71ebd6a6e05f2c6ae19cb0ee3f7f280713`;
- ad-hoc signed, not notarized;
- release tag `monument-v0.2.0-alpha.8-intel`;
- asset `Monument-0.2.0-alpha.8-Intel-x86_64.dmg`.

Published release identities are immutable. Visual Editor M2 must ship as a newer version, never by replacing alpha.8.

## 7. ACTIVE GATE — Visual Editor M2: Deterministic Source Transactions

Branch / PR:
- `monument/visual-editor-m2-checkpoints`;
- PR #37.

Deep implementation/spec record: [`VISUAL_EDITOR_M2_CHECKPOINT_IDENTITY.md`](VISUAL_EDITOR_M2_CHECKPOINT_IDENTITY.md).

### M2 problem

M1 routes every property Apply through Codex. This is correct but too slow for changes where source ownership is provably exact.

M2 introduces a safe fast path without creating a second styling state:

> **Properties → deterministic dry-run → exact source preview → guarded atomic write → Timeline checkpoint → checkpoint-bound evidence.**

If ownership cannot be proved, the existing Codex path remains authoritative.

### M2 checkpoint identity migration

Implemented on the active branch:
- exact `checkpointId` is source/evidence identity;
- deterministic evidence is checkpoint-bound;
- browser evidence is checkpoint-bound;
- Fresh Review remains checkpoint-native;
- Repair validates checkpoint freshness;
- Timeline quality is keyed by checkpoint;
- App stale UI and Prompt Queue overrides use checkpoint identity;
- Ship accepts valid direct/manual checkpoints with `turnSerial = null`;
- legacy turn-only quality is intentionally treated as unproven rather than guessed.

### M2 deterministic CSS v1

Implemented on the active branch:
- native `visual_source_plan` dry-run command;
- native `visual_source_apply` guarded apply command;
- commands are privileged-main only; preview webview has no source-write permission;
- direct v1 requires exactly one changed property;
- stable safe element `id` is required;
- only one exact rightmost `#id`-owned plain-CSS literal declaration is eligible;
- shared class/pseudo/comma/responsive ambiguity falls back to Codex;
- token-backed `var(...)` source falls back until scope UI exists;
- dry-run returns exact path/selector/property/line/range/fingerprint/before/after;
- Properties shows exact before/after source preview plus **Apply source / Use Codex / Reset**;
- changing draft invalidates the prepared plan;
- apply replans and verifies path + fingerprint + source range again;
- canonical project containment is required;
- symlink traversal is refused;
- source write uses create-new temp + sync + permission preservation + atomic rename;
- malformed CSS values are rejected (control chars, `;`, braces, comments, unmatched quotes/brackets/parentheses, unsupported raw escapes);
- direct path is disabled while Codex/post-turn/verification/review/timeline/Prompt Queue activity could race the repository;
- one successful direct edit creates one `Visual edit · <property>` Timeline checkpoint;
- previous browser evidence is invalidated;
- post-edit verification uses `source-transaction` provenance and the same project-level execution-consent boundary;
- browser evidence is captured against the exact new checkpoint when appropriate;
- failed direct-edit verification can enter the bounded auto-repair path only when Auto Repair is explicitly enabled.

### M2 current Definition of Done

PR #37 may merge only when the final head has:
- green source/type contracts;
- green Node regression tests including checkpoint identity and direct-edit orchestration;
- green Vite production build;
- green Rust tests on Intel runner;
- malformed CSS-value safety tests green;
- preview capability still unable to invoke source-write commands;
- exact stale-file/fingerprint guard green;
- App freshness/queue logic fully checkpoint-first;
- deep spec + master context updated;
- PR body accurately describes real and not-yet-real scope.

### Explicitly not M2 v1

- CSS variable/design-token mutation;
- Tailwind utility mutation;
- JSX/TSX AST mutation;
- multi-property atomic source transaction;
- deterministic text mutation;
- resize/spacing canvas handles;
- multi-select/reparent/reorder;
- component prop/variant extraction;
- breakpoint override authoring;
- asset replacement.

Those remain Codex-backed until their ownership can be proved with the same guarantees.

## 8. Visual Editor edit classes

### A. Deterministic edit
One exact source owner is proven and a bounded source transaction can preserve scope.

Current real v1 example:
- one literal plain-CSS property in one exact stable `#id` rule.

Future examples:
- explicit design-token owner with chosen scope;
- safe Tailwind utility;
- literal JSX style/primitive prop;
- AST-proven direct text.

### B. Assisted deterministic edit
Several valid owners/scopes exist, but Monument can make the ambiguity explicit.

Examples:
- instance vs design token/global;
- base vs responsive override;
- one component prop vs shared component default.

Show one compact scope decision, then perform a deterministic transaction.

### C. Codex edit
Structural reasoning is required or source ownership is not deterministic.

Property/direct-manipulation intent becomes precise structured Codex context. M1 already implements this safe source-authoritative fallback.

**Never maintain a second hidden styling system. Source remains authoritative.**

## 9. Next gate — M2.1 / M2.2

Priority order:
1. CSS custom-property/design-token ownership + explicit instance/token/global scope UI;
2. safe Tailwind utility replacement with responsive/variant ownership detection;
3. AST-backed JSX/TSX literal `style` and primitive prop mutation;
4. multi-property transaction planning as one atomic Timeline checkpoint;
5. AST-proven direct text replacement;
6. richer source-diff preview and per-edit undo metadata;
7. ownership/source-plan caching for low-latency repeated edits;
8. framework adapters for CSS Modules and common styled systems;
9. canvas resize/spacing/position handles routed through the same transaction engine;
10. multi-select/alignment/distribution and asset workflows.

Then deepen browser/viewport/visual QA around deterministic editor transactions.

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

1. Finish Visual Editor M2 final CI and merge PR #37.
2. Publish immutable Intel **alpha.9** only from a green merged M2 head.
3. M2.1: design-token/CSS-variable scope-aware transactions.
4. M2.2: Tailwind + JSX/TSX AST-backed transactions.
5. Add canvas direct manipulation / multi-select / asset workflows on the same source transaction architecture.
6. Deepen browser/viewport/visual QA around visual editing.
7. Reliability/recovery.
8. Commercial signed/notarized distribution.

Product standard:

> **Preview + Prompt + direct visual editing first. The engineering monster stays underneath.**
