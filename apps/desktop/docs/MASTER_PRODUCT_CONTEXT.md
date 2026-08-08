# Monument — Master Product Context

> Canonical living context for product decisions, current capabilities, active engineering gates and future work.
>
> **Rule:** material product/architecture changes update this file and the relevant deep spec in the same PR. Chat history is not source of truth.

## 1. Product thesis

Monument is a product-first macOS building environment powered by Codex.

Target formula:

> **Figma Make simplicity × Lovable autonomy × Framer-class direct editing × Codex/VibeOS engineering depth.**

The live product is the primary workspace. Prompting, direct visual editing, history, evidence, review and shipping are one loop.

Monument is not:
- a VS Code clone;
- an AI sidebar;
- a second coding-agent implementation;
- a page builder with a hidden document model disconnected from repository source.

## 2. Non-negotiable product laws

1. **Product first.** The running artifact is the main workspace.
2. **One instruction triggers the engineering chain.** Routine users should not manually orchestrate build/test/browser/review after normal work.
3. **Progressive disclosure.** Git, terminal, code, worktrees and raw evidence exist but are secondary surfaces.
4. **Never claim success without proof.** Unknown, not-run and stale remain explicit states.
5. **Source is authoritative.** Visual editing must never create durable preview-only state.
6. **Visual context is evidence, not authority.** DOM selectors, runtime values and source hints must be independently resolved before deterministic writes.
7. **Remote preview is untrusted.** It may emit bounded visual evidence but receives no generic filesystem/process/Git/Codex/system/source-write authority.
8. **Opening a repository never executes project code.** Automatic project scripts require explicit project-level consent.
9. **Direct editing is proof-driven.** A lower direct-edit hit rate is preferable to an incorrect deterministic source write.
10. **Scope is part of ownership.** A property/token/source identity is insufficient when one mutation may affect multiple instances, components, breakpoints or global consumers.
11. **Blast radius is evidence, not fake precision.** Source-reference counts do not claim exact live-node impact through cascade/inheritance.
12. **Source lanes have precedence.** A lower-confidence source representation must not race a stronger proven owner for the same computed property.
13. **Dynamic JavaScript is reasoning work until statically proven otherwise.** Monument does not execute project JS to discover visual source ownership.
14. **Users should not need Git/Codex protocol knowledge to use Monument well.**

## 3. Normal product loop

1. Open a real project.
2. See the real running product.
3. Describe a change or enter Visual Editor.
4. Optionally select a live element through canvas/Layers.
5. Monument chooses the safest execution class/source lane.
6. The resulting source generation becomes a reversible Version Timeline checkpoint.
7. Deterministic/browser evidence binds to that exact generation.
8. Failed evidence may enter bounded repair.
9. Fresh Review independently inspects the exact saved generation.
10. Ship becomes Ready only when blocking evidence/review/work gates pass.
11. Local Git commit is explicit.
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
        ├── literal CSS transaction engine
        ├── CSS token scope + transaction engine
        ├── bounded JSX/Tailwind source parser + transaction engine
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

## 5. Product foundation

### Native/product foundation
- React + TypeScript + Vite product shell;
- Tauri 2 macOS host;
- real project picker/inspection;
- framework/package-manager/script discovery;
- real Git branch/remote/change count;
- managed local dev runtime;
- native child WKWebView preview restricted to exact loopback origin;
- local SQLite state;
- production entrypoint is not backed by mock product data.

### Codex integration
- managed `codex app-server --stdio` lifecycle;
- bidirectional JSON-RPC;
- real threads/tasks/streaming turns;
- interrupt;
- command/file/permission approvals;
- inline user questions;
- ChatGPT auth recovery;
- protocol/version diagnostics.

### Visual Editor M1
- real live DOM Layers projection;
- canvas ↔ Layers hover/select;
- real computed Properties;
- layout/spacing/type/appearance drafts;
- bounded direct-text intent;
- source hints as evidence only;
- unsupported/structural Apply through Prompt Queue/Codex to real source;
- no durable preview-only styling.

Deep record: [`VISUAL_EDITOR_M1_IMPLEMENTATION.md`](VISUAL_EDITOR_M1_IMPLEMENTATION.md).
Target architecture: [`VISUAL_EDITOR_SPEC.md`](VISUAL_EDITOR_SPEC.md).

### M2.1 — literal CSS source transactions
- bounded plain-CSS declaration resolver;
- dry-run + commit;
- source/runtime literal equivalence;
- duplicate/responsive/token-backed ambiguity refusal;
- native re-resolution;
- root/symlink/range/grammar/structural safety;
- atomic same-directory source write;
- visual Timeline/evidence/review/Ship integration;
- Codex fallback.

Deep record: [`VISUAL_EDITOR_M2_SOURCE_TRANSACTIONS.md`](VISUAL_EDITOR_M2_SOURCE_TRANSACTIONS.md).

### M2.2 — token-aware CSS editing
Parent gate / PR:
- `monument/visual-editor-m2-token-editing`;
- PR #41.

M2.2 adds:
- bounded token definition/reference inspection;
- exact token-name boundaries;
- global vs scoped token ownership;
- source-reference blast-radius evidence;
- unique-live-id-only `This element` detach path;
- explicit Local scope / Global token / Codex choices;
- explicit confirmation for **every** global token mutation;
- responsive/conditional token ownership refusal;
- native token transaction preview + commit;
- conservative cross-check with independent token scope inspector;
- same visual Timeline/evidence/review/Ship handoff.

Global source-reference count is evidence only; it is never the permission threshold for a global mutation.

Deep record: [`VISUAL_EDITOR_M2_TOKEN_SCOPE.md`](VISUAL_EDITOR_M2_TOKEN_SCOPE.md).

### Version Timeline / evidence / review / Ship
- reversible shadow-Git checkpoints independent of user Git history/index;
- prompt/visual/manual/safety checkpoint semantics;
- Back/Forward/restore/compare and alternative history paths;
- generation-bound deterministic checks and Browser Evidence;
- explicit bounded Repair;
- persistent Prompt Queue;
- independent isolated read-only Fresh Review;
- evidence-based Ship gate;
- exact local Git file plan + explicit local commit;
- no implicit push/network side effect.

## 6. ACTIVE GATE — M2.3 Tailwind + JSX/TSX source ownership

Branch:
- `monument/visual-editor-m2-tailwind-jsx`.

Deep contract:
- [`VISUAL_EDITOR_M2_TAILWIND_JSX.md`](VISUAL_EDITOR_M2_TAILWIND_JSX.md).

M2.3 is intentionally one serious module: bounded JSX lexical parsing, source ownership, Tailwind utility semantics, JSX inline-style ownership, atomic source mutation, Properties UX and production regression contracts ship together.

### 6.1 Bounded JSX source model

Native `jsx_source.rs` parses bounded opening tags without pretending to be a full JS parser.

Direct ownership refuses lexical uncertainty:
- strings/templates/comments are not JSX;
- closing tags cannot hide later duplicate owners;
- ambiguous bare slash / regex-vs-division syntax refuses the bounded file;
- JSX expression slash ambiguity refuses the tag;
- spreads and duplicate ownership attributes are recorded/refused.

False negatives are acceptable. Lexical false positives are not.

### 6.2 Strong source DOM identity

M2.3 direct markup currently requires:
- bounded live DOM id;
- `idUnique === true` from the live document;
- exactly one `.tsx`/`.jsx` static source tag with the same literal id and same real DOM tag;
- lowercase real DOM/custom-element tag, not a React component abstraction;
- no owner spread;
- no duplicate `id/className/class/style` ownership;
- non-truncated source scan.

A JSX source edit is described as an owning-source edit. It is not falsely marketed as preview-only instance state; the owner may render multiple times over the application lifecycle.

### 6.3 Source-lane precedence

For one visual property:

1. proven CSS token scope remains M2.2;
2. existing M2.1 CSS resolver is asked before M2.3;
3. if CSS returns deterministic/assisted ownership, JSX/Tailwind is suppressed;
4. only then may M2.3 claim static markup ownership;
5. otherwise literal CSS/Codex fallback continues normally.

A `.css` owner and `className` are never allowed to race silently.

### 6.4 Tailwind lane

Direct Tailwind editing requires:
- one static literal `className`/`class`;
- requested property belongs to an explicit supported utility family;
- exactly one base utility in that family;
- source utility is present on the selected live element;
- no responsive/state variant in that property family;
- no unsupported important semantics;
- current utility value can be statically proven;
- requested value can be represented by the bounded deterministic grammar.

M2.3 refuses dynamic class composition (`clsx`, `cn`, templates, ternaries, joins, expressions).

M2.3 does **not** guess project Tailwind theme scales. Named theme-dependent utilities such as `gap-4` remain Codex when their configured semantics cannot be proven statically.

Bounded arbitrary-value utilities such as `gap-[16px]` can be direct when runtime/source semantics match.

Responsive/state variants are never flattened into base utilities.

### 6.5 JSX inline-style lane

Direct JSX style editing supports static `style={{ ... }}` ownership only.

Requirements:
- one literal style object;
- no spreads;
- static safe key;
- requested property appears exactly once;
- source value is a bounded string or supported numeric literal;
- source semantic value matches observed runtime value.

Dynamic expressions/computed keys/spreads stay Codex-backed.

Inline style is evaluated before Tailwind because a proven inline owner has stronger browser cascade ownership for that property.

### 6.6 JSX props are not generically direct

M2.3 does not blindly rewrite presentation-like DOM/component props.

A literal prop is not automatically proof that it owns the observed computed style. `width={320}`, component props and presentation hints require an explicit semantic registry/ownership model before they receive direct mutation authority.

Until then they remain Codex-backed.

### 6.7 Native transaction boundary

New privileged-main commands:
- `project_markup_edit_probe`;
- `project_markup_transaction_preview`;
- `project_markup_transaction_commit`.

The preview webview receives none of these permissions.

A deterministic markup plan binds:
- exact path;
- exact byte range;
- source-before/source-after;
- lane;
- owner kind;
- whole-file fingerprint.

Commit independently re-resolves ownership and then requires:
- regular non-symlink target;
- canonical containment inside project root;
- exact whole-file fingerprint;
- exact source range/value;
- bounded structural reparse after replacement;
- same-directory create-new temp + flush/fsync + permission preservation + atomic rename;
- no shell interpolation;
- no blind regex replacement.

### 6.8 Properties UX

A proven M2.3 edit gets a `Source-native` card showing:
- Tailwind or JSX-style lane;
- exact path/line;
- owner kind;
- native reason;
- source Before/After;
- Apply to source;
- Use Codex.

Unsupported/dynamic cases surface the Codex route with a reason rather than disappearing behind a generic failure.

### 6.9 Shared engineering chain

M2.1 CSS, M2.2 token and M2.3 markup writes converge on `finishDirectVisualEdit`:
- orchestration/race guards;
- clean Timeline provenance;
- native dry-run + commit;
- stale Browser Evidence invalidation;
- one `kind: visual` checkpoint;
- negative direct-visual generation identity;
- generation-bound checks/browser evidence;
- Fresh Review;
- Ship.

M2.3 adds source-lane/owner-kind metadata to the checkpoint/event but no new history model.

### 6.10 Production regression contract

`npm run check:native` runs:
- `check_native_source.mjs`;
- `check_token_editing.mjs`;
- `check_markup_editing.mjs`.

`visual-editor-markup-editing.test.js` locks lexical safety, ownership, Tailwind/JSX refusal rules, CSS precedence, filesystem transaction safety, main-only ACL and shared evidence handoff.

### 6.11 M2.3 Definition of Done

Merge only when the exact final head has:
- green TypeScript/source contracts;
- green source/token/markup production contracts;
- green Node regression suite;
- green production Vite build;
- green Rust tests on Intel macOS CI;
- bounded lexical JSX scanner;
- unique static source DOM ownership;
- safe static Tailwind utility lane;
- static JSX inline-style lane;
- CSS-over-markup precedence;
- native fingerprinted re-resolution + atomic commit;
- main-webview-only markup source commands;
- shared Timeline/evidence/Fresh Review/Ship handoff;
- Codex fallback for dynamic/ambiguous/unsupported cases;
- no hidden preview-only source of truth.

## 7. Visual Editor edit classes

### A. Deterministic
Ownership and material scope are proven.

Examples:
- literal CSS declaration (M2.1);
- unique token-backed instance detach (M2.2);
- explicitly chosen local/global token definition (M2.2);
- proven static Tailwind arbitrary/known-semantic utility (M2.3);
- proven static JSX inline-style literal (M2.3).

### B. Assisted deterministic
Ownership is proven but one bounded material choice remains.

Examples:
- token-backed scope choice;
- future breakpoint scope;
- future component prop/variant scope.

### C. Codex
Reasoning/structure/ownership/scope remains ambiguous or unsupported.

Examples:
- dynamic JSX/class composition;
- theme-dependent Tailwind utility semantics not statically proven;
- responsive/state authoring;
- custom-component abstractions;
- component props without semantic registry;
- multi-file structural work;
- CSS-in-JS/Sass/Less/theme-object ownership.

**Never maintain a second hidden styling system. Source remains authoritative.**

## 8. Next gates after M2.3

Priority after a green M2.3:
1. component text AST ownership;
2. explicit component props/variants with semantic registry;
3. responsive breakpoint ownership + override authoring;
4. project token catalog / searchable picker;
5. canvas resize/spacing handles on the same transaction architecture;
6. keyboard nudging;
7. multi-select/alignment/distribution;
8. asset replacement;
9. only then consider proven multi-file atomic transactions.

## 9. Reliability / commercial gates after core editor

Reliability:
- exact workspace restoration;
- Codex crash/reconnect recovery;
- dev runtime reattach/restart;
- sleep/wake revalidation;
- stale process cleanup;
- large-repo/long-session Intel budgets;
- sanitized support bundle.

Distribution:
- Developer ID signing;
- hardened runtime;
- notarization/stapling;
- signed updater;
- stable/alpha channels;
- accessibility/keyboard audit;
- polished onboarding/empty/error states.

## 10. Explicit non-goals until core loop is excellent

- VS Code extension marketplace compatibility;
- generic multi-agent product surface;
- cloud workspaces/team collaboration;
- SSH remote development;
- Docker/Kubernetes dashboards;
- generic model gateway;
- full browser DevTools clone.
