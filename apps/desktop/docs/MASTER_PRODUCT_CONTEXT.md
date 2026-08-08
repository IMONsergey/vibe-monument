# Monument — Master Product Context

> Canonical living context for product decisions, current capabilities, active engineering gates and future work.
>
> **Rule:** material product/architecture changes update this file and the relevant deep spec in the same PR. Chat history is not source of truth.

## 1. Product thesis

Monument is a product-first macOS building environment powered by Codex.

Target formula:

> **Figma Make simplicity × Lovable autonomy × Framer-class direct editing × Codex/VibeOS engineering depth.**

The live product is the primary workspace. Prompting, direct visual editing, history, evidence, review and shipping should feel like one product loop rather than separate developer tools.

Monument is not:
- a VS Code clone;
- an AI sidebar;
- a second coding-agent implementation;
- a page builder with a hidden document model disconnected from repository source.

## 2. Non-negotiable product laws

1. **Product first.** The running artifact is the main workspace.
2. **One instruction triggers the engineering chain.** Routine users should not manually orchestrate build/test/browser/review after ordinary work.
3. **Progressive disclosure.** Git, terminal, code, worktrees, evidence and raw agent activity exist but are secondary surfaces.
4. **Never claim success without proof.** Unknown, not-run and stale remain explicit states.
5. **Source is authoritative.** Visual editing must never create durable preview-only state.
6. **Visual context is evidence, not authority.** DOM selectors, runtime values and source hints must be independently resolved before a deterministic write.
7. **Remote preview is untrusted.** It may emit bounded visual evidence but receives no generic filesystem/process/Git/Codex/system authority.
8. **Opening a repository never executes project code.** Automatic project scripts require explicit project-level consent.
9. **Direct editing is proof-driven.** A lower direct-edit hit rate is better than a wrong deterministic source write.
10. **Scope is part of ownership.** Property/token identity alone is insufficient when one mutation can affect multiple instances, components, breakpoints or global consumers.
11. **Blast radius is evidence, not fake precision.** Source-reference counts are useful but do not claim exact live-node impact through cascade/inheritance.
12. **A user should not need Git/Codex protocol knowledge to use Monument well.**

## 3. Normal product loop

1. Open a real project.
2. See the real running product.
3. Describe a change or enter Visual Editor.
4. Optionally select a live element through canvas/Layers.
5. Monument selects the safest execution class:
   - deterministic source transaction when ownership + scope are proven;
   - assisted deterministic choice when one bounded material scope decision remains;
   - Codex when reasoning, structure, ownership or scope is ambiguous.
6. The resulting source generation becomes a reversible Version Timeline checkpoint.
7. Deterministic/browser evidence binds to that exact generation.
8. Failed evidence can enter bounded repair.
9. Fresh Review independently inspects the exact saved generation.
10. Ship becomes Ready only when blocking evidence/review/work gates pass.
11. Local Git commit remains explicit.
12. Push/PR/network publication remains separate and explicit.

Routine users should spend almost all their time in Preview + Prompt + Visual Editor.

## 4. Production architecture

```text
React / TypeScript product UI
        ↓ typed Tauri boundary
Tauri / Rust native host
        ├── managed Codex App Server
        ├── project inspection
        ├── managed dev runtime
        ├── native WKWebView preview
        ├── Select / Layers / Properties bridge
        ├── literal CSS source transaction engine
        ├── CSS token scope + transaction engine
        ├── Browser Evidence
        ├── deterministic verification
        ├── shadow-Git Version Timeline
        ├── local SQLite state
        ├── Prompt Queue
        ├── bounded Repair
        ├── isolated Fresh Review
        └── evidence-based Ship + local Git handoff
```

Codex remains the reasoning/coding engine. Monument owns product UX, local orchestration, visual context, direct-edit proof, scope/blast-radius decisions, history, evidence, review and ship semantics.

## 5. Stable product foundation on `main`

### Native/product foundation
- React + TypeScript + Vite product shell.
- Tauri 2 macOS host.
- Real local project picker and inspection.
- Framework/package-manager/script discovery.
- Real Git branch/remote/change count.
- Managed local dev server with cleanup.
- Native child WKWebView preview restricted to exact loopback origin.
- Local SQLite state.
- Production entrypoint is not backed by mock product data.

### Codex integration
- managed `codex app-server --stdio` lifecycle;
- bidirectional JSON-RPC;
- real threads/tasks/streaming turns;
- interrupt;
- command/file/permission approvals;
- inline user questions;
- ChatGPT auth recovery through Codex;
- protocol/version diagnostics.

### Visual Editor M1
- real live DOM Layers projection;
- canvas ↔ Layers hover/select;
- real computed Properties;
- layout/spacing/type/appearance drafts;
- bounded direct-text intent;
- source-hint confidence without pretending hints are write authority;
- unsupported/structural Apply routes through Prompt Queue/Codex to real source;
- no durable preview-only styling.

Deep record: [`VISUAL_EDITOR_M1_IMPLEMENTATION.md`](VISUAL_EDITOR_M1_IMPLEMENTATION.md).
Target architecture: [`VISUAL_EDITOR_SPEC.md`](VISUAL_EDITOR_SPEC.md).

### Visual Editor M2.1 — literal CSS transactions
- bounded plain-CSS declaration resolver;
- dry-run + commit commands;
- source/runtime literal equivalence;
- duplicate/responsive/token-backed ambiguity refusal;
- native re-resolution on commit;
- root/symlink/range/grammar/structural safety;
- same-directory create-new + flush/fsync + permission preservation + atomic rename;
- direct visual Timeline generations;
- normal verification/browser/review/Ship handoff;
- Codex fallback preserved.

Deep record: [`VISUAL_EDITOR_M2_SOURCE_TRANSACTIONS.md`](VISUAL_EDITOR_M2_SOURCE_TRANSACTIONS.md).

### M2.2 Phase A already merged — token scope inspection
- bounded read-only CSS custom-property scanner;
- exact token-name usage boundaries;
- global vs scoped classification;
- path/line/selector/current-value evidence;
- source-reference blast-radius evidence;
- main-webview-only command authority;
- no source mutation in the inspector.

### Version Timeline / evidence / review / Ship
- reversible shadow-Git checkpoints independent of user Git history/index;
- original baseline, prompt, visual, manual and safety checkpoint semantics;
- Back/Forward/restore/compare and alternative history paths;
- generation-bound deterministic checks and Browser Evidence;
- explicit bounded Repair and optional bounded Auto Repair where allowed;
- persistent Lovable-style Prompt Queue;
- independent isolated read-only Fresh Review;
- evidence-based Ship gate;
- exact local Git file plan and explicit local commit;
- no implicit push/network side effect.

## 6. Active gate — Visual Editor M2.2: token-aware direct editing

Branch / PR:
- `monument/visual-editor-m2-token-editing`;
- PR #41 `feat: Visual Editor M2.2 — token-aware direct editing`.

Deep contract: [`VISUAL_EDITOR_M2_TOKEN_SCOPE.md`](VISUAL_EDITOR_M2_TOKEN_SCOPE.md).

### 6.1 End-to-end token-backed property flow

For a supported property whose unique source owner contains a simple token reference such as `gap: var(--space-4)`:

1. Properties observes a single-property draft.
2. Native token probe proves one non-conditional selected-property owner.
3. Native host extracts one simple CSS custom-property reference.
4. Definitions + source-reference blast radius are inspected.
5. Properties exposes material scope choices.
6. Monument dry-runs the exact source intent.
7. Commit independently re-runs ownership/scope proof.
8. One atomic source write is performed.
9. A `kind: visual` Timeline generation is created.
10. stale Browser Evidence is invalidated.
11. normal exact-generation verification/browser/review/Ship flow continues.

### 6.2 Scope choices

#### This element
Direct single-instance detachment is deliberately strict.

It is available only when:
- the live element has a non-empty DOM id;
- preview proves the id is unique in the current live document;
- the source owner is non-conditional;
- the source selector is actually id-owned and reaches native id-owner confidence;
- the bounded scan is not truncated or ambiguous.

A class-owned rule such as `.card` never receives `This element` authority because it may affect multiple instances. Duplicate live ids also disable it.

#### Local scope
A scoped custom-property definition may be mutated only when its non-conditional selector is independently proven against the selected element. Local scope may intentionally affect multiple instances of that component/class and is therefore distinct from `This element`.

#### Global token
A global definition (`:root`, `html`, `html:root`) is always an explicit high-blast-radius action.

**Every global token mutation requires explicit confirmation, independent of the observed source-reference count.** The count is informative evidence, not a safety threshold.

Properties cross-checks source-reference count through both:
- the selected-property transaction probe;
- the independent token-scope inspector.

It uses the conservative maximum and propagates truncation. The UI labels this as source-reference evidence rather than exact affected live nodes.

#### Use Codex
Codex remains available at all times and is mandatory for unsupported, ambiguous, truncated, conditional or structural cases.

### 6.3 Responsive / conditional safety

M2.2 tracks at-rule ancestry.

- selected property owners inside `@media` or other conditional/nested at-rules do not receive direct token authority;
- conditional token definitions remain visible as evidence but are read-only;
- responsive breakpoint authoring remains a future explicit product model rather than being guessed through ordinary local-token mutation.

### 6.4 Native trust boundary

New privileged-main commands:
- `project_token_edit_probe`;
- `project_token_transaction_preview`;
- `project_token_transaction_commit`.

The remote preview receives no source-write command. It may only contribute bounded evidence such as `idUnique`; Rust independently decides mutation authority.

Token mutation requires:
- bounded plain-CSS scan budgets;
- exactly one selected-property owner;
- supported simple `var(--token)` grammar;
- explicit chosen token definition for token mutation;
- exact path/line/selector/previous-value re-resolution;
- unconditional scope when direct editing requires it;
- explicit confirmation for every global token mutation;
- regular non-symlink target inside canonical project root;
- exact current source-range/value check immediately before replacement;
- bounded balanced CSS replacement grammar;
- full updated CSS structural validation;
- same-directory create-new temp + flush/fsync + permission preservation + atomic rename;
- no shell interpolation and no blind regex replacement.

### 6.5 Shared direct-edit engineering chain

Literal M2.1 and token M2.2 writes converge on one frontend handoff:

1. reject Codex/queue/timeline/check/browser/review/source-mutation races;
2. require clean exact Timeline provenance;
3. native dry-run;
4. native commit/re-resolution;
5. mark source transaction pending;
6. invalidate stale Browser Evidence;
7. create one visual Timeline checkpoint;
8. bind negative direct-visual generation identity;
9. emit `monument:source-transaction`;
10. run exact-generation deterministic/browser evidence;
11. preserve Fresh Review + Ship rules.

### 6.6 Regression contract

`npm run check:native` includes the dedicated token-editing production contract.

Coverage locks:
- main-webview-only source commands;
- unique-live-id propagation and native single-instance proof;
- class/duplicate-id instance refusal;
- local/global scope behavior;
- count-independent global confirmation;
- conservative source-reference blast-radius cross-check;
- responsive/conditional refusal;
- literal M2.1 preservation;
- Codex fallback preservation;
- Timeline/evidence handoff.

### 6.7 M2.2 Definition of Done

Merge only when the exact final head has:
- green TypeScript/source contracts;
- green token production contract;
- green Node regression suite;
- green Vite production build;
- green Rust tests / `cargo test --all-targets` on Intel macOS CI;
- token-backed Properties scope UX;
- visible conservative blast-radius evidence;
- deterministic unique-instance/local/global paths;
- explicit confirmation for every global mutation;
- native re-resolution on commit;
- responsive/conditional refusal;
- atomic source write;
- exact Timeline/evidence/Fresh Review/Ship handoff;
- no new preview source-write authority;
- aligned master + deep specs.

## 7. Visual Editor edit classes

### A. Deterministic
Ownership and material scope are both proven.

Implemented examples:
- literal CSS declaration owner (M2.1);
- unique-id token-backed declaration detached to a literal instance (M2.2);
- explicitly chosen proven local/global token definition (M2.2).

### B. Assisted deterministic
Ownership is proven but one bounded material choice remains.

Implemented example:
- token-backed property → `This element / Local scope / Global token / Codex`.

Future examples:
- responsive breakpoint scope;
- component prop/variant scope;
- multiple safely distinguishable AST owners.

### C. Codex
Reasoning/structure/ownership/scope remains ambiguous or unsupported.

Examples:
- Tailwind/JSX before M2.3;
- conditional/responsive work before breakpoint authoring;
- multi-file structural changes;
- unsupported token expression graphs;
- CSS-in-JS/Sass/Less/theme-object ownership before dedicated engines.

**Never maintain a second hidden styling system. Source remains authoritative.**

## 8. Next major gate — M2.3 Tailwind + JSX/TSX ownership

This is the next large engineering module, not a collection of small patches.

### M2.3 objectives

1. **Tailwind utility ownership**
   - parse static `class` / `className` literals in JSX/TSX/HTML-like source;
   - map supported computed visual properties to utility families;
   - distinguish base vs responsive/state variants;
   - refuse conflicting/conditional/composed class ownership;
   - preview exact utility replacement;
   - reparse/re-resolve on commit;
   - preserve arbitrary-value syntax safely;
   - no blind string replacement.

2. **JSX/TSX literal style ownership**
   - support bounded literal `style={{ ... }}` properties;
   - support simple literal visual props only where property semantics are explicitly registered;
   - never execute JavaScript to understand ownership;
   - refuse spread/computed/dynamic expressions;
   - exact source-range dry-run + native re-resolution + atomic write.

3. **Unified source-ownership routing**
   - one Properties decision model across CSS literal, CSS token, Tailwind and JSX literal lanes;
   - one visual Timeline/evidence/review/Ship handoff;
   - explicit route reason when falling back to Codex.

4. **Proof and safety**
   - bounded source-file count/bytes;
   - regular-file/root/symlink guarantees;
   - no shell interpolation;
   - source fingerprint/range staleness rejection;
   - responsive/state variants never silently flattened into base utilities;
   - dynamic `clsx`, `cn`, template expressions, spreads and component abstractions remain Codex-backed until dedicated ownership exists.

### M2.3 Definition of Done

Common React/Tailwind projects should be able to directly edit a meaningful set of spacing, sizing, typography, color, radius and layout properties when source ownership is statically provable, while ambiguous/dynamic cases safely fall back to Codex.

## 9. Priority after M2.3

1. component text AST ownership;
2. component props/variants;
3. responsive breakpoint ownership + explicit override authoring;
4. project token catalog/searchable token picker;
5. canvas resize/spacing/direct-manipulation handles built on the same transaction engine;
6. keyboard nudging;
7. multi-select/alignment/distribution;
8. asset replacement;
9. only then proven multi-file atomic transactions.

## 10. Reliability / distribution gates after core Visual Editor

### Reliability / recovery
- exact workspace restoration;
- Codex crash/reconnect recovery;
- dev runtime reattach/restart;
- sleep/wake revalidation;
- stale process cleanup;
- large-repo / long-session Intel budgets;
- sanitized support bundle.

### Commercial distribution
- Developer ID signing;
- hardened runtime;
- notarization + stapling;
- signed updater;
- stable/alpha channels;
- accessibility/keyboard audit;
- polished onboarding/empty/error states.

## 11. Explicit non-goals until the core loop is excellent

- VS Code extension marketplace compatibility;
- generic multi-agent product surface;
- cloud workspaces/team collaboration;
- SSH remote development;
- Docker/Kubernetes dashboards;
- generic model gateway;
- full browser DevTools clone.
