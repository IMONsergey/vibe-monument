# Monument — Master Product Context

> Canonical living context for product decisions, current capabilities, active engineering gates and future work.
>
> **Rule:** material product/architecture changes update this file and the relevant deep spec in the same PR. Chat history is not source of truth.

## 1. Product thesis

Monument is a product-first macOS building environment powered by Codex.

Target formula:

> **Figma Make simplicity × Lovable autonomy × Framer-class direct editing × Codex/VibeOS engineering depth.**

The running product is the primary workspace. Prompting, direct visual editing, history, evidence, review and shipping are one continuous loop.

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
9. **Direct editing is proof-driven.** A lower hit rate is preferable to an incorrect deterministic source write.
10. **Scope is part of ownership.** Property/token/source identity is insufficient when a mutation may affect multiple instances, components, breakpoints or global consumers.
11. **Cascade is part of ownership.** A weaker stylesheet/class source cannot outrank a proven or potentially overriding inline owner.
12. **Blast radius is evidence, not fake precision.** Source-reference counts do not claim exact live-node impact through cascade/inheritance.
13. **Source lanes have precedence.** Competing source representations for one computed property must never race silently.
14. **Dynamic JavaScript is reasoning work until statically proven otherwise.** Monument does not execute project JS to discover visual ownership.
15. **Independent vetoes may reduce direct hit rate but never grant write authority.**
16. **Write authority is re-proved at commit.** Frontend preflight is UX; the final native writer is authoritative.
17. **Users should not need Git/Codex protocol knowledge to use Monument well.**

## 3. Normal product loop

1. Open a real project.
2. See the running product.
3. Describe a change or enter Visual Editor.
4. Optionally select a live element through canvas/Layers.
5. Monument chooses the safest source lane.
6. Direct lanes re-prove source ownership natively; ambiguous work routes to Codex.
7. The resulting source generation becomes a reversible Version Timeline checkpoint.
8. Deterministic/browser evidence binds to that exact generation.
9. Failed evidence may enter bounded repair.
10. Fresh Review independently inspects the exact saved generation.
11. Ship becomes Ready only when blocking evidence/review/work gates pass.
12. Local Git commit is explicit.
13. Push/PR/network publication remains separate and explicit.

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
        ├── bounded JSX/Tailwind ownership core
        ├── independent Tailwind multi-property conflict guard
        ├── hardened guarded markup commit wrapper
        ├── Browser Evidence
        ├── deterministic verification
        ├── shadow-Git Version Timeline
        ├── local SQLite state
        ├── Prompt Queue
        ├── bounded Repair
        ├── isolated Fresh Review
        └── evidence-based Ship + local Git handoff
```

Codex remains the reasoning/coding engine. Monument owns product UX, local orchestration, visual context, direct-edit proof, cascade/scope/blast-radius decisions, history, evidence, review and ship semantics.

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
- production entrypoint does not depend on mock product data.

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
- same-directory create-new + flush/fsync + permission preservation + atomic rename;
- visual Timeline/evidence/review/Ship integration;
- Codex fallback.

Deep record: [`VISUAL_EDITOR_M2_SOURCE_TRANSACTIONS.md`](VISUAL_EDITOR_M2_SOURCE_TRANSACTIONS.md).

### M2.2 — token-aware CSS editing
Parent branch / PR:
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
- independent token-scope cross-check;
- same visual Timeline/evidence/review/Ship handoff.

Truncated token evidence forces Codex and cannot fall through into a weaker direct lane.

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

## 6. ACTIVE GATE — M2.3 hardened Tailwind + JSX/TSX ownership

Branch / stacked PR:
- `monument/visual-editor-m2-tailwind-jsx`;
- PR #43 stacked on M2.2 PR #41 until the parent merges.

Canonical deep contract:
- [`VISUAL_EDITOR_M2_MARKUP_OWNERSHIP.md`](VISUAL_EDITOR_M2_MARKUP_OWNERSHIP.md).

`VISUAL_EDITOR_M2_TAILWIND_JSX.md` is only a compatibility pointer.

M2.3 ships as one serious module: lexical JSX model, source ownership, cascade routing, Tailwind semantics, independent conflict veto, JSX inline-style ownership, guarded native commit, Properties UX and production regression contracts.

### 6.1 Bounded JSX source model

`jsx_source.rs` intentionally prefers false negatives to lexical false positives.

It:
- bounds opening-tag bytes and attributes;
- excludes JSX-shaped strings/templates/comments;
- skips closing tags without hiding later duplicate owners;
- refuses slash/regex-vs-division ambiguity instead of guessing;
- never executes project JavaScript.

### 6.2 Strong source DOM identity

Direct markup requires:
- bounded live DOM id;
- `idUnique === true` in the live document;
- exactly one static `.tsx/.jsx` source tag with the same literal id and same lowercase real DOM/custom-element tag;
- no custom component abstraction;
- no owner attribute spread;
- no duplicate `id/className/class/style` ownership;
- non-truncated scan.

The product describes this as an owning-source edit, not preview-only instance state.

### 6.3 Exact cascade / source-lane routing

For one property:

1. M2.2 token ownership first when applicable.
2. Native markup probe establishes JSX inline-style cascade safety.
3. Deterministic static inline-style literal wins.
4. Dynamic/ambiguous inline-style ownership forces Codex for the property.
5. Only after inline safety does M2.1 CSS ownership compete with Tailwind.
6. Deterministic/assisted CSS ownership or unavailable CSS preflight suppresses Tailwind direct mode.
7. Independent native Tailwind conflict guard checks hidden multi-property competitors.
8. Static Tailwind may become direct only after all previous proof lines pass.
9. Existing literal CSS/Codex fallback continues normally otherwise.

Routing invariant:

> **token → inline-style cascade safety → CSS-vs-Tailwind precedence → independent Tailwind veto → Tailwind/CSS → Codex**.

### 6.4 Tailwind lane

Direct Tailwind requires:
- static literal `className` / `class`;
- explicit supported utility family;
- exact source utility present on the live element;
- no responsive/state variant in the property family;
- no unsupported important modifier;
- source semantics statically provable;
- requested value representable by bounded output grammar.

Dynamic class composition stays Codex-backed.

M2.3 does not guess Tailwind theme configuration. Named theme-dependent utilities such as `gap-4` remain Codex until configured semantics are proved.

Bounded arbitrary values such as `gap-[16px] → gap-[24px]` may be direct when source/runtime semantics match.

Primary v2 conflict analysis handles side/axis/base families such as padding/margin/gap/overflow.

The independent guard additionally catches multi-property helpers such as:
- `size-*`;
- `container`;
- `place-items-*`;
- `place-content-*`;
- `sr-only` / `not-sr-only`;
- `truncate`;
- `line-clamp-*`;
- extended table/list display utilities.

### 6.5 JSX inline-style lane

Direct JSX style editing supports an existing static `style={{ ... }}` property only.

Requirements:
- one literal object;
- no spread/computed-key ambiguity;
- requested property exactly once;
- bounded string/supported numeric literal;
- source semantics match observed runtime value.

Dynamic inline style is a hard Codex boundary because it can override stylesheet/class ownership.

Generic DOM/component prop mutation is **not** claimed; props require a future semantic registry.

### 6.6 Native command / ACL boundary

Privileged `main` only:
- `project_markup_edit_probe`;
- `project_markup_conflict_guard`;
- `project_markup_transaction_preview`;
- `project_markup_transaction_commit`.

Remote preview receives none of these permissions.

### 6.7 Hardened production writer

Production `lib.rs` registers `markup_transaction_hardened`, not raw `markup_transaction_v2` commit authority.

`markup_transaction_hardened.rs` includes the v2 ownership core internally and exposes the production probe/preview/commit surface.

For Tailwind, one native commit call performs:
1. exact v2 ownership resolution;
2. independent conflict guard inside native write authority;
3. target re-read after the guard;
4. original whole-file fingerprint validation;
5. exact source-range/value validation;
6. bounded replacement;
7. JSX structural reparse + same literal id/tag owner validation;
8. create-new temp + flush/fsync + permission preservation + atomic rename.

This removes dependence on a separate frontend guard IPC for write safety. Frontend/main still re-runs ownership/CSS precedence/guard during Properties, before dry-run and before commit for earlier UX refusal; native commit is authoritative.

### 6.8 Properties UX

A proven markup owner gets a `Source-native` card with:
- `Tailwind utility` or `JSX inline style` lane;
- exact `path:line`;
- owner kind;
- native reason;
- source Before/After;
- **Apply to source**;
- **Use Codex**.

Dynamic/unsupported cases show the Codex reason rather than a fake direct option.

### 6.9 Shared engineering chain

M2.1 CSS, M2.2 token and M2.3 markup writes all converge on `finishDirectVisualEdit`:
- source orchestration/race guards;
- clean exact Timeline provenance;
- native preview + commit;
- stale Browser Evidence invalidation;
- one `kind: visual` checkpoint;
- negative direct-visual generation identity;
- generation-bound deterministic/browser evidence;
- Fresh Review;
- Ship.

No markup-specific history exists.

### 6.10 Regression contract

`npm run check:native` runs source + token + markup production contracts.

M2.3 exact-head contracts lock:
- hardened wrapper is the production write surface;
- v2 is internal ownership core only;
- independent guard compiled/main-only;
- guard executes inside native Tailwind commit after v2 resolve;
- post-guard fingerprint/range validation precedes write;
- hidden `size-*` competitor fails native commit;
- safe Tailwind write remains functional;
- lexical JSX false-positive refusal;
- inline-style cascade safety;
- fail-closed CSS-vs-Tailwind precedence;
- theme/responsive/shorthand/dynamic ownership refusal;
- M2.2 truncation safety;
- common Timeline/evidence handoff.

### 6.11 Definition of Done

Merge only when the **final exact head** has:
- green TypeScript/source contracts;
- green source/token/markup production contracts;
- green Node regression suite;
- green Vite production build;
- green Rust tests / `cargo test --all-targets` on Intel macOS CI;
- one canonical hardened markup write surface;
- bounded JSX lexical model;
- safe static Tailwind lane;
- safe static JSX inline-style lane;
- correct cascade/source precedence;
- independent multi-property guard;
- authoritative guarded native commit + post-guard fingerprint validation;
- main-webview-only markup/guard commands;
- shared Timeline/evidence/Fresh Review/Ship handoff;
- Codex fallback for every dynamic/ambiguous/unsupported case;
- no hidden preview-only source of truth;
- master + deep spec aligned.

## 7. Visual Editor edit classes

### Deterministic
Ownership, cascade and material scope are proved.

Examples:
- literal CSS declaration (M2.1);
- unique token-backed instance detach (M2.2);
- chosen local/global token definition (M2.2);
- static Tailwind utility with primary + independent conflict proof (M2.3);
- static JSX inline-style literal (M2.3).

### Assisted deterministic
Ownership is proved but one bounded material choice remains.

Examples:
- token scope choice;
- future breakpoint scope;
- future component prop/variant scope.

### Codex
Reasoning/structure/ownership/cascade/scope remains ambiguous or unsupported.

Examples:
- dynamic JSX/class/style composition;
- theme-dependent Tailwind semantics not statically proved;
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

## 9. Reliability / distribution after core editor

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
