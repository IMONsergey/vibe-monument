# Monument — Master Product Context

> Canonical living context for product decisions, current capabilities, active engineering gates and future work.
>
> **Rule:** material product/architecture changes update this file and the relevant deep spec in the same PR. Chat history is not source of truth.

## 1. Product thesis

Monument is a product-first macOS building environment powered by Codex.

Target formula:

> **Figma Make simplicity × Lovable autonomy × Framer-class direct editing × Codex/VibeOS engineering depth.**

The running product is the primary workspace. Prompting, direct visual editing, history, evidence, review and shipping are one continuous loop.

Monument is not a VS Code clone, an AI sidebar, a second coding-agent implementation, or a page builder with a hidden source model.

## 2. Non-negotiable product laws

1. **Product first.** The running artifact is the main workspace.
2. **One instruction triggers the engineering chain.** Build/test/browser/review should follow normal work automatically when permitted.
3. **Progressive disclosure.** Git, terminal, code and raw evidence are secondary surfaces.
4. **Never claim success without proof.** Unknown/not-run/stale remain explicit.
5. **Source is authoritative.** No durable preview-only styling/document state.
6. **Visual context is evidence, not authority.** Runtime selectors/values must be independently resolved before deterministic writes.
7. **Remote preview is untrusted.** It may emit bounded evidence but receives no generic source/process/Git/Codex/system authority.
8. **Opening a repository never executes project code.** Automatic scripts require explicit project-level consent.
9. **Direct editing is proof-driven.** False negatives are preferable to incorrect deterministic writes.
10. **Scope and cascade are part of ownership.** A source match is insufficient when another instance, breakpoint, token or higher-cascade source can own the property.
11. **Blast radius is evidence, not fake precision.** Source-reference counts do not claim exact live-node impact.
12. **Source lanes have precedence.** Competing representations must never race silently.
13. **Dynamic JavaScript remains reasoning work until statically proved.** Project JS is not executed to infer visual ownership.
14. **Independent vetoes can deny authority but never grant it.**
15. **Final write authority is native.** Frontend preflight is UX; commit re-proves ownership/safety.
16. **Users should not need Git/Codex protocol knowledge to use Monument well.**

## 3. Normal loop

1. Open a real project.
2. See the running product.
3. Describe a change or enter Visual Editor.
4. Optionally select a live element through canvas/Layers.
5. Monument chooses the safest source lane.
6. Direct lanes re-prove source authority natively; ambiguous work routes to Codex.
7. The resulting source generation becomes a reversible Version Timeline checkpoint.
8. Deterministic/browser evidence binds to that exact generation.
9. Failed evidence may enter bounded repair.
10. Fresh Review independently inspects the exact saved generation.
11. Ship becomes Ready only when blocking evidence/review/work gates pass.
12. Local Git commit is explicit; push/network publication stays separate.

Routine users should remain almost entirely in Preview + Prompt + Visual Editor.

## 4. Architecture

```text
React / TypeScript product UI
        ↓ typed Tauri boundary
Tauri / Rust native host
        ├── managed Codex App Server
        ├── project inspection + managed dev runtime
        ├── native loopback WKWebView preview
        ├── Select / Layers / Properties bridge
        ├── literal CSS transaction engine (M2.1)
        ├── token scope + transaction engine (M2.2)
        ├── bounded JSX/Tailwind ownership core (M2.3)
        ├── independent Tailwind multi-property guard
        ├── hardened markup commit wrapper
        ├── Browser Evidence + deterministic verification
        ├── shadow-Git Version Timeline
        ├── Prompt Queue + bounded Repair
        ├── isolated Fresh Review
        └── evidence-based Ship + local Git handoff
```

Codex remains the reasoning/coding engine. Monument owns product UX, local orchestration, direct-edit proof, cascade/scope/blast-radius decisions, history, evidence, review and ship semantics.

## 5. Implemented foundation

### Product / Codex / preview
- React + TypeScript + Vite + Tauri 2;
- real project picker/inspection and Git state;
- managed local dev runtime;
- managed `codex app-server --stdio` with streaming turns, approvals, questions, interrupt and ChatGPT auth recovery;
- native child preview restricted to exact loopback origin;
- local SQLite product state;
- production entrypoint not backed by mock data.

### Visual Editor M1
- real DOM Layers projection;
- canvas ↔ Layers hover/select;
- real computed Properties;
- layout/spacing/type/appearance drafts;
- bounded direct-text intent;
- source hints as evidence only;
- unsupported/structural Apply through Prompt Queue/Codex to real source;
- no durable preview-only styling.

Deep record: [`VISUAL_EDITOR_M1_IMPLEMENTATION.md`](VISUAL_EDITOR_M1_IMPLEMENTATION.md).  
Target: [`VISUAL_EDITOR_SPEC.md`](VISUAL_EDITOR_SPEC.md).

### M2.1 — literal CSS transactions
- bounded CSS owner resolution;
- source/runtime literal equivalence;
- duplicate/responsive/token ambiguity refusal;
- dry-run + native re-resolution;
- root/symlink/range/grammar/structural checks;
- same-directory atomic write;
- visual Timeline/evidence/review/Ship handoff;
- Codex fallback.

Deep record: [`VISUAL_EDITOR_M2_SOURCE_TRANSACTIONS.md`](VISUAL_EDITOR_M2_SOURCE_TRANSACTIONS.md).

### M2.2 — token-aware CSS editing
Branch / PR: `monument/visual-editor-m2-token-editing` / #41.

Adds:
- bounded token definitions/references and exact token-name boundaries;
- global/scoped ownership;
- source-reference blast-radius evidence;
- unique-live-id-only `This element` detach;
- Local scope / Global token / Codex choices;
- explicit confirmation for **every** global token mutation;
- responsive/conditional refusal;
- native token preview/commit + independent scope cross-check;
- same visual Timeline/evidence/review/Ship handoff.

Truncated token evidence forces Codex and cannot fall through to a weaker direct lane.

Deep record: [`VISUAL_EDITOR_M2_TOKEN_SCOPE.md`](VISUAL_EDITOR_M2_TOKEN_SCOPE.md).

### Timeline / evidence / review / Ship
- reversible shadow-Git checkpoints independent of user Git index/history;
- Back/Forward/restore/compare and alternative history paths;
- generation-bound deterministic checks + Browser Evidence;
- explicit bounded Repair;
- persistent Prompt Queue;
- independent isolated read-only Fresh Review;
- evidence-based Ship gate;
- exact local Git plan + explicit local commit;
- no implicit push/network side effect.

## 6. ACTIVE GATE — M2.3 hardened Tailwind + JSX/TSX ownership

Branch / stacked PR:
- `monument/visual-editor-m2-tailwind-jsx`;
- PR #43 stacked on M2.2 PR #41 until parent merge.

Canonical deep contract: [`VISUAL_EDITOR_M2_MARKUP_OWNERSHIP.md`](VISUAL_EDITOR_M2_MARKUP_OWNERSHIP.md).  
`VISUAL_EDITOR_M2_TAILWIND_JSX.md` is only a compatibility pointer.

M2.3 is one integrated module: lexical JSX model, source identity, cascade routing, Tailwind semantics, independent conflict veto, JSX inline-style ownership, guarded native writer, Properties UX and production contracts.

### 6.1 JSX ownership boundary

`jsx_source.rs` deliberately prefers false negatives:
- bounded opening tags/attributes;
- strings/templates/comments excluded;
- closing tags cannot hide later duplicate owners;
- slash/regex-vs-division ambiguity is refused;
- project JavaScript is never executed.

Direct source identity requires:
- bounded live DOM id + `idUnique === true`;
- exactly one static `.tsx/.jsx` source tag with same literal id and same lowercase real DOM/custom-element tag;
- no custom React component abstraction;
- no owner spread;
- no duplicate `id/className/class/style` ownership;
- non-truncated scan.

### 6.2 Cascade / lane routing

For one property:

1. M2.2 token ownership when applicable.
2. Native markup probe establishes JSX inline-style cascade safety.
3. Deterministic static inline style wins.
4. Dynamic/ambiguous inline style forces Codex for the property.
5. M2.1 CSS ownership then competes with Tailwind.
6. Deterministic/assisted CSS or unavailable CSS preflight suppresses Tailwind.
7. Independent Tailwind guard checks hidden multi-property helpers.
8. Static Tailwind may be direct only after all previous proof lines pass.
9. Existing literal CSS/Codex fallback continues normally otherwise.

Routing invariant:

> **token → inline-style cascade safety → CSS-vs-Tailwind precedence → independent Tailwind veto → Tailwind/CSS → Codex**.

### 6.3 Tailwind direct lane

Requires:
- static literal `className` / `class`;
- explicit supported utility family;
- exact source utility on live element;
- no same-property responsive/state variant;
- no unsupported important modifier;
- statically provable source semantics;
- bounded representable requested value.

Dynamic class composition stays Codex-backed.

Theme/config-dependent named utilities such as `gap-4` are **not** guessed. Bounded arbitrary values like `gap-[16px] → gap-[24px]` may be direct when source/runtime semantics match.

Primary v2 conflict logic handles side/axis/base families (padding/margin/gap/overflow).

Independent `markup_conflict_guard.rs` additionally vetoes helpers including:
- `size-*`;
- `container`;
- `place-items-*` / `place-content-*`;
- `sr-only` / `not-sr-only`;
- `truncate`;
- `line-clamp-*`;
- extended table/list display helpers.

### 6.4 JSX inline-style lane

Supports an existing static `style={{ ... }}` property only:
- literal bounded object;
- no spread/computed-key ambiguity;
- requested property exactly once;
- bounded string/supported numeric literal;
- source semantics match computed runtime value.

Dynamic inline style is a hard Codex boundary because it can override stylesheet/class ownership.

Generic DOM/component prop mutation is not claimed; props require a future semantic registry.

### 6.5 Native command / ACL boundary

Privileged `main` only:
- `project_markup_edit_probe`;
- `project_markup_conflict_guard`;
- `project_markup_transaction_preview`;
- `project_markup_transaction_commit`.

Remote preview receives none of these permissions.

### 6.6 Hardened production writer

Production `lib.rs` registers `markup_transaction_hardened`, not raw v2 commit authority.

`markup_transaction_hardened.rs` includes v2 as its internal ownership core.

For a Tailwind commit, **one native command** performs:

1. exact v2 markup ownership resolution;
2. M2.1 `project_source_transaction_preview` inside native commit for stylesheet precedence;
3. allow Tailwind only when M2.1 returns explicit `mode=codex`; deterministic/assisted CSS or resolver error fails closed;
4. independent Tailwind multi-property conflict guard inside native commit;
5. target re-read after both vetoes;
6. original whole-file fingerprint check;
7. exact source-range/value check;
8. bounded replacement;
9. JSX structural reparse + same literal id/tag validation;
10. create-new temp + flush/fsync + permission preservation + atomic rename.

This means write safety no longer depends on frontend IPC timing. Frontend still re-runs the same proof lines during Properties, before dry-run and before commit for early UX refusal; native commit is authoritative.

For a proven JSX inline-style lane, Tailwind-only CSS/guard checks are skipped while fingerprint/range/structure/atomic-write guarantees remain.

### 6.7 Properties UX

A proven source owner gets a `Source-native` card with:
- `Tailwind utility` or `JSX inline style`;
- exact path:line;
- owner kind;
- proof/refusal reason;
- source Before/After;
- **Apply to source**;
- **Use Codex**.

Dynamic/unsupported cases expose the Codex reason rather than a fake direct option.

### 6.8 Shared engineering chain

M2.1 CSS, M2.2 token and M2.3 markup writes converge on `finishDirectVisualEdit`:
- orchestration/race guards;
- clean exact Timeline provenance;
- native preview + commit;
- stale Browser Evidence invalidation;
- one `kind: visual` checkpoint;
- negative direct-visual generation identity;
- generation-bound deterministic/browser evidence;
- Fresh Review;
- Ship.

No markup-specific history model exists.

### 6.9 Exact-head contracts / DoD

`npm run check:native` runs source + token + markup production contracts.

M2.3 contracts require:
- hardened wrapper is the production write surface;
- v2 is internal ownership core only;
- independent guard compiled/main-only;
- native sequence `v2 resolve → CSS precedence → multi-property guard → post-veto fingerprint/range → atomic write`;
- native competing-CSS refusal;
- native hidden-`size-*` refusal;
- safe Tailwind commit remains functional;
- lexical JSX false-positive refusal;
- inline-style cascade safety;
- fail-closed frontend CSS-vs-Tailwind precedence;
- theme/responsive/shorthand/dynamic refusal;
- M2.2 truncation safety;
- common Timeline/evidence handoff.

M2.3 is merge-ready only when the **final exact head** has green TypeScript/source contracts, source/token/markup production contracts, Node tests, Vite build and Rust tests on Intel macOS CI.

## 7. Edit classes

**Deterministic:** ownership, cascade and scope proved. Examples: M2.1 literal CSS; M2.2 token transactions; M2.3 guarded static Tailwind/static JSX style.

**Assisted deterministic:** one bounded material choice remains, e.g. token scope or future breakpoint/variant scope.

**Codex:** dynamic/ambiguous/unsupported ownership, including dynamic JSX/class/style, unproved Tailwind theme semantics, responsive/state authoring, custom components, props without semantic registry, multi-file structural work, CSS-in-JS/Sass/Less/theme objects.

**Never maintain a second hidden styling system. Source remains authoritative.**

## 8. Next gates after M2.3

1. component text AST ownership;
2. component props/variants with explicit semantic registry;
3. responsive breakpoint ownership + override authoring;
4. project token catalog/searchable picker;
5. canvas resize/spacing handles on the same source transaction architecture;
6. keyboard nudging;
7. multi-select/alignment/distribution;
8. asset replacement;
9. only then consider proven multi-file atomic transactions.

## 9. Reliability / distribution after core editor

Reliability: exact workspace restoration, Codex reconnect, dev-runtime reattach, sleep/wake revalidation, stale process cleanup, large-repo/long-session Intel budgets, sanitized support bundle.

Distribution: Developer ID signing, hardened runtime, notarization/stapling, signed updater, stable/alpha channels, accessibility/keyboard audit, polished onboarding/empty/error states.

## 10. Explicit non-goals until core loop is excellent

- VS Code extension marketplace compatibility;
- generic multi-agent product surface;
- cloud workspaces/team collaboration;
- SSH remote development;
- Docker/Kubernetes dashboards;
- generic model gateway;
- full browser DevTools clone.

## 11. Product Experience Refoundation preview gate (2026-08-08)

The current production head mounts three sibling shells (`App`, `VisualEditorLayer`, and `AlphaPreviewShell`). This is now recorded as an information-architecture defect, not a styling backlog.

The active refoundation direction is **Contextual Orbit**:

- the live product/canvas dominates;
- the composer is compact and persistent;
- selection and Properties are contextual;
- Codex is quiet when idle and transient when active;
- Timeline, Evidence, Fresh Review, and Ship use progressive disclosure around the same generation;
- technical/source truth remains available under explicit details;
- source authority, native safety, preview isolation, generation semantics, and Intel release gates do not change.

Canonical decision documents:

- `OPENAI_DESIGN_FOUNDATION.md` — published/observed/derived provenance and token foundation;
- `PRODUCT_EXPERIENCE_REFOUNDATION.md` — teardown, architecture hypotheses, chosen IA, journeys, and migration gate;
- `../experience-preview/` — standalone interactive concept and primitive lab.

**Hard gate:** the preview is not imported into production. No production migration begins until Sergey approves the direction and a separate vertical-slice spec proves the existing source → Timeline → Evidence → Fresh Review chain on Intel.
