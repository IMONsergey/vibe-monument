# Visual Editor M2.3 — Hardened Tailwind + JSX/TSX ownership

Status: active implementation gate.  
Branch: `monument/visual-editor-m2-tailwind-jsx`.  
Stacked PR: #43 on M2.2 PR #41 until the parent merges.

## Product objective

M2.3 extends source-native Visual Editor ownership from plain CSS/custom properties into common **static React/Tailwind source** without treating class strings as a document model, executing project JavaScript, or creating preview-only state.

Core invariant:

> **A runtime value is not source ownership. A matching class is not source ownership. Direct markup mutation requires one proven live element, one proven static source DOM owner, correct cascade precedence, statically understood semantics, no hidden multi-property competitor, and one guarded atomic source transaction. Otherwise use Codex.**

## 1. Exact routing model

For one visual property Monument routes in this order:

1. **M2.2 token ownership** when a proven token-backed CSS declaration owns the property.
2. **M2.3 markup probe for inline-style cascade safety**:
   - deterministic static JSX inline style may own immediately;
   - dynamic/ambiguous inline style is a hard Codex boundary for the property.
3. **M2.1 CSS-vs-Tailwind precedence**:
   - deterministic/assisted CSS ownership suppresses Tailwind;
   - unavailable CSS preflight fails closed.
4. **Independent native Tailwind multi-property veto** for hidden helpers/shorthands.
5. **Static Tailwind direct lane** only when no stronger/ambiguous inline owner, no competing CSS owner and no guard veto exists.
6. Existing literal CSS/Codex fallback continues normally when markup does not claim/block ownership.

Routing invariant:

> **token → inline-style cascade safety → CSS-vs-Tailwind precedence → independent Tailwind veto → Tailwind/CSS → Codex**.

Frontend/main applies this model for immediate UX feedback. The final native Tailwind writer independently re-runs the CSS-precedence and multi-property-veto lines before writing.

## 2. Bounded JSX source model

`jsx_source.rs` is deliberately incomplete and prefers false negatives to lexical false positives.

It:
- bounds opening-tag bytes and attribute count;
- parses only the subset required for deterministic ownership;
- distinguishes literal/expression/bare/boolean attributes;
- records attribute spreads and duplicate attributes;
- excludes JSX-shaped JavaScript strings, template literals and comments;
- skips closing tags without hiding later duplicate opening-tag owners;
- refuses JSX expression slash ambiguity;
- refuses an ordinary JS file when bare slash / regex-vs-division syntax cannot be classified safely;
- never executes project JavaScript.

## 3. Strong live/source DOM identity

Direct markup currently requires:
- a bounded live DOM id;
- preview evidence `idUnique === true`;
- exactly one bounded `.tsx/.jsx` opening tag with the same **literal** id;
- same lowercase real DOM/custom-element tag as the selected live node;
- no custom React component abstraction;
- no owner attribute spread;
- no duplicate `id`, `className`, `class` or `style` ownership;
- non-truncated source scan.

A source tag may render multiple times over application lifetime, so product copy says **Apply to source**, not “change only this preview instance.”

## 4. JSX inline-style ownership

For source such as:

```tsx
<div id="hero" style={{ gap: '16px', opacity: 1 }} />
```

an existing property may be direct only when:
- `style` is one literal object expression;
- no spread/computed-key/dynamic syntax can override the property;
- requested property occurs exactly once;
- current value is a bounded string or supported numeric literal;
- source semantic value matches observed computed runtime value.

Inline style is evaluated before stylesheet/Tailwind precedence because it can override both.

If inline-style ownership for the property is dynamic or ambiguous, Monument uses Codex and does **not** fall through to a direct stylesheet/class mutation.

M2.3 updates existing static style keys only; it does not synthesize new keys.

## 5. Tailwind ownership

Direct Tailwind requires one static literal `className` / `class`.

Dynamic composition remains Codex-backed:
- `clsx(...)`;
- `cn(...)`;
- template expressions;
- ternaries;
- array/object builders;
- non-literal class expressions.

### 5.1 Primary v2 resolver

`markup_transaction_v2.rs` is the canonical bounded markup ownership core.

A utility receives initial deterministic ownership only when:
- requested visual property belongs to an explicit supported utility family;
- source utilities that can affect that family are enumerated conservatively;
- no responsive/state variant exists in the family;
- no unsupported `!important` semantics exist;
- exactly one effective candidate remains;
- exact source utility is present on the selected live element;
- current source utility semantics are statically provable against runtime;
- requested value is representable by bounded output grammar.

M2.3 does **not** assume project Tailwind default theme scales. Theme/config-dependent named utilities such as `gap-4` remain Codex unless configured semantics are actually proved.

Bounded arbitrary values such as `gap-[16px] → gap-[24px]` can be direct when source/runtime semantics agree.

The primary resolver rejects first-order conflicts including padding/margin shorthand-axis-side combinations, `gap` axis/base collisions, `overflow` axis/base collisions and same-family responsive/state variants.

### 5.2 Independent multi-property conflict guard

`markup_conflict_guard.rs` is a **read-only veto**, never a writer and never a source-authority grant.

It catches helpers a narrow family resolver can miss, including:
- `size-*` vs width/height;
- `container` vs width/maxWidth;
- `place-items-*` vs alignItems;
- `place-content-*` vs justifyContent;
- `sr-only` / `not-sr-only` vs position/size/spacing/overflow;
- `truncate` vs overflow;
- `line-clamp-*` vs display/overflow;
- extended table/list display helpers.

Variant-prefixed forms still count as conflicts after bounded variant-prefix stripping.

## 6. Native write authority — hardened commit wrapper

Production does **not** register raw `markup_transaction_v2` commit authority directly.

`markup_transaction_hardened.rs` is the production markup command module. It includes the v2 ownership core internally and exposes:
- `project_markup_edit_probe`;
- `project_markup_transaction_preview`;
- `project_markup_transaction_commit`.

`project_markup_conflict_guard` remains a separate privileged-main read-only command for early UX vetoes.

### 6.1 Authoritative Tailwind commit sequence

For a Tailwind write, one native `project_markup_transaction_commit` call performs:

1. canonical project-root resolution;
2. exact v2 markup ownership resolution;
3. require deterministic markup operation;
4. invoke the existing M2.1 `project_source_transaction_preview` **inside native commit authority** for the same property/runtime before/after;
5. allow Tailwind only when M2.1 returns explicit `mode=codex`; deterministic/assisted CSS ownership or CSS resolver error fails closed;
6. run the independent Tailwind conflict guard **inside the same native commit**;
7. re-read the target only after both vetoes;
8. require the original whole-file fingerprint from v2 resolution;
9. require exact replacement byte range/source value;
10. perform one bounded replacement;
11. reparse bounded JSX opening tags and require the same selected literal id/tag owner to remain structurally valid;
12. same-directory create-new temp file;
13. write + flush + `sync_all`;
14. preserve source permissions;
15. atomic rename over source.

This closes both frontend TOCTOU classes:
- external `.css` ownership introduced after main preflight cannot inherit Tailwind write authority;
- hidden Tailwind multi-property competitors introduced after main preflight cannot inherit write authority.

Any edit before the post-veto reread invalidates the v2 whole-file fingerprint/range. Frontend checks remain UX only; **native hardened commit is authoritative**.

### 6.2 JSX inline-style commits

For a deterministic JSX inline-style lane, stylesheet-vs-Tailwind checks are irrelevant because the static inline source itself owns the property. The hardened wrapper therefore preserves the v2 inline-style operation and skips Tailwind-only CSS/guard vetoes, while still enforcing fingerprint/range/structural/atomic-write safety.

### 6.3 Filesystem/trust boundary

Commit requires:
- regular non-symlink target via `symlink_metadata`;
- canonical target inside canonical project root;
- exact whole-file fingerprint after vetoes;
- exact source range/value;
- bounded JSX structural reparse;
- no blind regex replacement;
- no interpolated shell;
- no preview source-write permission.

## 7. Commands / ACL

Privileged `main` only:
- `project_markup_edit_probe`;
- `project_markup_conflict_guard`;
- `project_markup_transaction_preview`;
- `project_markup_transaction_commit`.

Remote `monument-preview` receives none of these permissions.

## 8. Properties UX

A proven M2.3 owner produces a `Source-native` card with:
- lane `Tailwind utility` or `JSX inline style`;
- exact `path:line`;
- owner kind;
- native proof/refusal reason;
- exact source Before / After;
- **Apply to source**;
- **Use Codex**.

Dynamic/unsupported ownership keeps the Codex route visible instead of presenting a fake direct option.

M2.2 remains stronger than M2.3 when token evidence exists. In particular, a **truncated token scan forces Codex and cannot fall through to markup direct editing**.

## 9. Shared generation/evidence chain

CSS/token/markup direct writes converge on the same `finishDirectVisualEdit` handoff:
- source mutation/orchestration race guards;
- clean exact Timeline provenance;
- native preview + commit;
- stale Browser Evidence invalidation;
- one `kind: visual` Timeline checkpoint;
- negative direct-visual generation identity;
- generation-bound deterministic/browser evidence;
- Fresh Review;
- Ship.

M2.3 adds `sourceLane` / `ownerKind` metadata but no separate history model.

## 10. Regression / production contracts

`npm run check:native` includes `scripts/check_markup_editing.mjs`.

The exact-head contract locks:
- `markup_transaction_hardened.rs` is the production write surface;
- v2 remains internal ownership core, not a registered writer;
- independent guard compiled and main-only;
- native Tailwind commit sequence is `v2 resolve → M2.1 CSS precedence → independent Tailwind guard → post-veto reread/fingerprint/range → atomic write`;
- competing CSS owner is refused by native commit;
- hidden `size-*` competitor is refused by native commit;
- safe Tailwind commit remains functional;
- lexical JSX false-positive refusal;
- inline-style cascade safety;
- fail-closed frontend CSS-vs-Tailwind precedence;
- theme/config refusal;
- responsive/state refusal;
- shorthand/axis/multi-property conflict refusal;
- dynamic style/class/spread refusal;
- stale-source/root/symlink/atomic-write safety;
- Properties source-native UX;
- M2.2 truncation safety;
- common Timeline/evidence handoff.

## 11. Explicitly not M2.3

- execution of Tailwind config/theme code;
- named theme-token mutation without proof;
- dynamic `className` AST rewriting;
- generic DOM/component prop mutation;
- component text AST mutation;
- responsive/state authoring;
- CSS-in-JS;
- Sass/Less;
- JS/TS theme objects;
- multi-file atomic transactions;
- canvas resize/reparent machinery.

Those remain Codex-backed or future dedicated ownership gates.

## 12. Definition of Done

M2.3 is merge-ready only when the **final exact head** has:
- green TypeScript/source contracts;
- green source/token/markup production contracts;
- green Node regression suite;
- green Vite production build;
- green Rust tests / `cargo test --all-targets` on Intel macOS CI;
- bounded lexical JSX scanner;
- unique static source DOM ownership;
- safe static Tailwind lane;
- safe static JSX inline-style lane;
- correct cascade/source precedence;
- native CSS-precedence revalidation;
- independent multi-property conflict protection;
- authoritative native guarded commit + post-veto fingerprint validation;
- main-webview-only markup/guard commands;
- shared Timeline/evidence/Fresh Review/Ship handoff;
- Codex fallback for all dynamic/ambiguous/unsupported cases;
- no hidden preview-only source of truth;
- master + this deep spec aligned.

## Product standard

> **Static proof gets speed. Cascade and scope stay explicit. The final native writer re-runs both stylesheet precedence and independent Tailwind conflict proof before touching source.**
