# Monument — Master Product Context

> Canonical living context for product decisions, current capabilities, active engineering gates and future work.
>
> **Rule:** material product/architecture changes update this file and the relevant deep spec in the same PR. Chat history is not source of truth.

## 1. Product thesis

Monument is a product-first macOS building environment powered by Codex.

Target formula:

> **Figma Make simplicity × Lovable autonomy × Framer-class direct editing × Codex/VibeOS engineering depth.**

The running product is the primary workspace. Prompting, direct visual editing, history, evidence, review and shipping are one continuous product loop.

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
9. **Direct editing is proof-driven.** A lower hit rate is preferable to an incorrect deterministic write.
10. **Scope is part of ownership.** Property/token/source identity is insufficient when a mutation may affect multiple instances, components, breakpoints or global consumers.
11. **Cascade is part of ownership.** A weaker stylesheet/class source cannot outrank a proven or potentially overriding inline owner.
12. **Blast radius is evidence, not fake precision.** Source-reference counts do not claim exact live-node impact through cascade/inheritance.
13. **Source lanes have precedence.** Competing source representations for one computed property must never race silently.
14. **Dynamic JavaScript is reasoning work until statically proven otherwise.** Monument does not execute project JS to discover visual ownership.
15. **Users should not need Git/Codex protocol knowledge to use Monument well.**

## 3. Normal product loop

1. Open a real project.
2. See the running product.
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
        ├── bounded JSX/Tailwind parser + transaction engine
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
- real project picker and inspection;
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

Truncated token evidence cannot expose deterministic scope actions and cannot fall through into a weaker direct lane.

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
- PR #43 on top of M2.2 PR #41 until the parent merges.

Canonical deep contract:
- [`VISUAL_EDITOR_M2_MARKUP_OWNERSHIP.md`](VISUAL_EDITOR_M2_MARKUP_OWNERSHIP.md).

`VISUAL_EDITOR_M2_TAILWIND_JSX.md` exists only as a compatibility pointer and is not a second architecture contract.

M2.3 ships as one module: bounded JSX lexical parsing, source ownership, Tailwind utility semantics, JSX inline-style ownership, source-lane routing, atomic mutation, Properties UX and regression contracts.

### 6.1 Bounded JSX source model

`jsx_source.rs` intentionally prefers false negatives to lexical false positives.

It:
- bounds opening-tag bytes and attribute count;
- parses only the subset required for deterministic ownership;
- excludes JSX-shaped strings, template literals and comments;
- skips closing tags without hiding later duplicate owners;
- refuses JSX expression slash ambiguity;
- refuses an ordinary JS file when bare slash/regex-vs-division syntax cannot be classified safely;
- never executes project JavaScript.

### 6.2 Strong source DOM identity

M2.3 direct markup requires:
- bounded live DOM id;
- `idUnique === true` in the live document;
- exactly one static `.tsx/.jsx` source tag with the same literal id and same real lowercase DOM tag;
- no custom React component abstraction;
- no owner attribute spread;
- no duplicate `id/className/class/style` ownership;
- non-truncated bounded scan.

The product describes this as an edit to the owning source. It does not falsely claim preview-only instance state.

### 6.3 Correct cascade / source-lane routing

For one changed visual property:

1. M2.2 token ownership is resolved first when applicable.
2. M2.3 performs a native markup probe to establish **inline-style cascade safety**.
3. If a deterministic JSX inline-style literal owns the property, that lane wins.
4. If inline-style ownership is dynamic/ambiguous for the property, direct stylesheet/Tailwind fallback is blocked and the edit goes to Codex.
5. Only after inline-style safety is established does Monument ask M2.1 CSS ownership about competition with Tailwind.
6. A deterministic/assisted CSS owner — or an unavailable CSS preflight — suppresses Tailwind direct mode.
7. Static Tailwind may become direct only when no stronger/ambiguous inline-style owner and no competing CSS owner exists.
8. Existing literal CSS/Codex fallback continues normally after markup routing.

The invariant is:

> **inline-style cascade safety → CSS-vs-Tailwind precedence → Tailwind/CSS → Codex**.

This prevents a real but visually ineffective `.css` write when inline style is the actual owner.

### 6.4 Tailwind lane

Direct Tailwind requires:
- one static literal `className` / `class`;
- requested property belongs to an explicit utility family;
- exactly one effective base utility owns that family;
- exact source utility is present on the selected live element;
- no responsive/state variant in that property-affecting family;
- no unsupported important modifier;
- source utility semantics are statically provable;
- requested value is representable by the bounded output grammar.

Dynamic `clsx`, `cn`, templates, ternaries, joins and other class composition stay Codex-backed.

M2.3 does **not** assume project Tailwind default theme scales. Named theme-dependent utilities such as `gap-4` remain Codex until configured semantics are actually proved.

Bounded arbitrary values such as `gap-[16px] → gap-[24px]` may be direct when source/runtime semantics agree.

Property-affecting conflicts force Codex, including:
- `p-[16px] pt-[8px]` for `paddingTop`;
- `px-[16px] pl-[8px]` for `paddingLeft`;
- `my-[16px] mt-[8px]` for `marginTop`;
- `gap-x-[16px] gap-[8px]` for `gap`;
- `overflow-x-auto overflow-hidden` for `overflow`.

Responsive/state variants are never silently flattened into base utilities.

### 6.5 JSX inline-style lane

Direct JSX style editing supports an existing static `style={{ ... }}` property only.

Requirements:
- one literal object;
- no spread/computed-key ambiguity;
- requested property appears exactly once;
- value is a bounded string or supported numeric literal;
- source semantic value matches observed runtime value.

Dynamic inline style is a hard Codex boundary for the property because it can override stylesheet/class ownership.

M2.3 does not generically mutate DOM/component presentation props. Props require an explicit semantic registry before they receive direct authority.

### 6.6 Canonical native engine + ACL

Only `markup_transaction_v2.rs` is compiled. The prototype engine is removed; production contracts reject dual authority models.

Privileged-main commands:
- `project_markup_edit_probe`;
- `project_markup_transaction_preview`;
- `project_markup_transaction_commit`.

Remote preview receives none of these permissions.

A deterministic plan binds exact path/range/source-before/source-after, lane, owner kind and whole-file fingerprint.

Commit independently re-resolves and requires:
- regular non-symlink target;
- canonical containment inside project root;
- exact whole-file fingerprint;
- exact source range/value;
- bounded JSX structure still reparses after replacement;
- same selected literal id/tag remains valid;
- same-directory create-new temp + flush/fsync + permission preservation + atomic rename;
- no shell interpolation;
- no blind regex replacement.

### 6.7 Properties UX

A proven M2.3 source lane gets a `Source-native` card showing:
- `Tailwind utility` or `JSX inline style`;
- exact path:line;
- owner kind;
- native proof/refusal reason;
- source Before/After;
- **Apply to source**;
- **Use Codex**.

Dynamic/unsupported ownership surfaces the Codex reason rather than a fake direct option.

### 6.8 Shared engineering chain

M2.1 CSS, M2.2 token and M2.3 markup writes all converge on `finishDirectVisualEdit`:
- source orchestration/race guards;
- clean exact Timeline provenance;
- native dry-run + commit;
- stale Browser Evidence invalidation;
- one `kind: visual` checkpoint;
- negative direct-visual generation identity;
- generation-bound deterministic/browser evidence;
- Fresh Review;
- Ship.

M2.3 adds source-lane/owner-kind metadata but no new history model.

### 6.9 Production regression contract

`npm run check:native` runs:
- `check_native_source.mjs`;
- `check_token_editing.mjs`;
- `check_markup_editing.mjs`.

M2.3 contracts lock:
- only hardened v2 engine compiled;
- lexical JSX false-positive refusal;
- unique live/source DOM ownership;
- main-only source commands;
- inline-style cascade safety before CSS-vs-Tailwind precedence;
- fail-closed CSS preflight;
- theme/config refusal;
- responsive/state refusal;
- shorthand/axis conflict refusal;
- dynamic style/class/spread refusal;
- stale-source/root/symlink/atomic write boundary;
- Properties source-native UX;
- common Timeline/evidence handoff;
- M2.2 truncated-token safety preservation.

### 6.10 M2.3 Definition of Done

Merge only when the final exact head has:
- green TypeScript/source contracts;
- green source/token/markup production contracts;
- green Node regression suite;
- green production Vite build;
- green Rust tests on Intel macOS CI;
- one canonical hardened markup engine;
- bounded JSX lexical scanner;
- safe static Tailwind lane;
- safe static JSX inline-style lane;
- correct cascade/source precedence;
- native fingerprinted re-resolution + atomic commit;
- main-webview-only markup commands;
- shared Timeline/evidence/Fresh Review/Ship handoff;
- Codex fallback for every dynamic/ambiguous/unsupported case;
- no hidden preview-only source of truth.

## 7. Visual Editor edit classes

### A. Deterministic
Ownership, cascade and material scope are proven.

Examples:
- literal CSS declaration (M2.1);
- unique token-backed instance detach (M2.2);
- explicitly chosen local/global token definition (M2.2);
- proven static Tailwind arbitrary/known-semantic utility (M2.3);
- proven static JSX inline-style literal (M2.3).

### B. Assisted deterministic
Ownership is proven but one bounded material choice remains.

Examples:
- token scope choice;
- future breakpoint scope;
- future component prop/variant scope.

### C. Codex
Reasoning/structure/ownership/cascade/scope remains ambiguous or unsupported.

Examples:
- dynamic JSX/class/style composition;
- theme-dependent Tailwind semantics not statically proven;
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

## 9. Reliability / distribution after the core editor

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

## 10. Explicit non-goals until the core loop is excellent

- VS Code extension marketplace compatibility;
- generic multi-agent product surface;
- cloud workspaces/team collaboration;
- SSH remote development;
- Docker/Kubernetes dashboards;
- generic model gateway;
- full browser DevTools clone.
