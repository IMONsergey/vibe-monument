# Visual Editor M2.3 — Tailwind + JSX/TSX source ownership

Status: active implementation gate.
Branch: `monument/visual-editor-m2-tailwind-jsx`.
Stacked PR: #43 on top of M2.2 PR #41 until M2.2 merges.

## 1. Product objective

M2.3 extends source-native visual editing from plain CSS and CSS custom properties into common static React/Tailwind source without introducing blind class-string mutation, JavaScript execution, or a second visual document model.

Core invariant:

> **A runtime value is not source ownership. A matching class is not source ownership. Direct markup mutation requires one proven live element, one proven static source DOM owner, one statically understood property owner, correct cascade precedence, no hidden multi-property competitor, and one exact atomic replacement. Otherwise use Codex.**

## 2. Unified routing and cascade model

For one supported visual property draft, Monument establishes ownership in this order:

1. **M2.2 token lane** when a proven token-backed CSS declaration owns the property.
2. **M2.3 markup probe for cascade safety**:
   - a deterministic JSX inline-style literal may immediately own the property;
   - a dynamic/ambiguous inline-style candidate is a hard Codex boundary because a stylesheet/class write could be visually ineffective or wrong.
3. **M2.1 CSS ownership check against Tailwind**:
   - deterministic or assisted plain-CSS ownership suppresses Tailwind direct mutation;
   - CSS preflight failure is fail-closed and also suppresses Tailwind.
4. **Independent Tailwind multi-property guard**:
   - re-scans the exact static JSX owner;
   - vetoes shorthands/helpers that can affect the same computed property but are outside the primary utility family resolver.
5. **Static Tailwind lane** only when no stronger/ambiguous inline-style owner, no competing CSS owner and no guard conflict exists.
6. **Plain literal CSS lane** continues through the existing M2.1 Apply path when markup does not claim/block ownership.
7. **Codex** for all ambiguous, dynamic, unsupported, or structurally complex cases.

This is not “CSS always wins.” Browser cascade matters:

> **proven/dynamic inline style → stylesheet-vs-Tailwind ownership decision → independent Tailwind conflict veto → Tailwind/CSS → Codex**.

A `.css` declaration and a Tailwind class are never allowed to race silently for the same computed property.

All successful direct lanes converge on the same visual Timeline/evidence/review/Ship pipeline.

## 3. Source element ownership

M2.3 does not attempt broad component inference.

A direct JSX/Tailwind candidate currently requires:
- selected live element has a bounded DOM id;
- preview proves `idUnique === true` in the current live document;
- source scan is within bounded file/byte budgets;
- exactly one `.tsx/.jsx` opening tag contains that literal id;
- source tag equals the selected lowercase real DOM tag;
- source owner is not a custom React component;
- source opening tag contains no top-level attribute spread;
- no duplicate `id`, `className`, `class` or `style` attributes.

This is intentionally strict. A lower hit rate is preferable to writing into a component abstraction whose source/runtime ownership is not proved.

A static JSX source owner may render more than once over an application's lifetime. Product copy therefore says **Apply to source**, not “change only this preview instance.”

## 4. Bounded JSX scanner

`jsx_source.rs` is a deliberately incomplete lexical scanner, not a JavaScript runtime or general AST parser.

It:
- bounds opening-tag bytes;
- bounds attribute count;
- parses literal/expression/bare/boolean attributes;
- balances JSX expression braces with string/comment awareness;
- excludes JSX-shaped strings, template literals and comments;
- skips closing tags so later duplicate opening-tag owners remain visible;
- refuses unsupported slash syntax rather than guessing regex-vs-division semantics.

A bare slash in ordinary JS code causes that bounded file scan to contribute no deterministic markup ownership. This deliberately creates false negatives to prevent regex-shaped JSX text from becoming source-write authority.

The parser never executes project JavaScript.

## 5. JSX inline-style lane

For an owner such as:

```tsx
<div id="hero" style={{ gap: '16px', opacity: 1 }} />
```

Monument may directly replace an existing visual property when:
- `style` is an expression containing one literal object;
- object shape is bounded and simple;
- no spread can override unknown keys;
- no computed key exists;
- requested property occurs exactly once;
- current value is a bounded string or supported number literal;
- source literal semantics match the observed computed value.

### Cascade role

Inline-style ownership is resolved **before** stylesheet-vs-Tailwind precedence because inline style can override both.

If the requested property has a deterministic inline-style literal, that source lane wins.

If the inline-style object is dynamic for the requested property — spread, computed/non-literal key/value, duplicate property, or another unsupported shape — Monument routes to Codex and does **not** fall through to direct stylesheet/Tailwind mutation.

M2.3 updates existing inline properties only. It does not synthesize new `style` keys.

## 6. Tailwind lane

Tailwind direct editing requires a static literal `className` or `class` attribute.

Dynamic composition remains Codex-backed:
- `clsx(...)`;
- `cn(...)`;
- template expressions;
- conditional expressions;
- array/object class builders;
- non-literal class expressions.

### 6.1 Proof model

A Tailwind utility receives direct authority only when:
- requested property family is explicitly registered;
- all source utilities that can affect that property are enumerated conservatively;
- no stronger/ambiguous inline-style owner blocks the property;
- no deterministic/assisted plain-CSS owner competes for the property;
- the independent conflict guard does not find a second property-affecting utility;
- no responsive/state variant exists in the property-affecting family;
- no unsupported important modifier exists;
- exactly one effective source candidate remains;
- exact source token is present on the selected live element;
- current utility semantics are statically provable against computed runtime value;
- requested value is representable by the bounded output grammar.

### 6.2 Theme/config refusal

Named scale utilities whose CSS value may depend on Tailwind configuration are not blindly rewritten.

Example:

```text
gap-4
```

Even when runtime happens to be `16px`, M2.3 does not assume the default Tailwind theme is authoritative. It remains Codex-backed until a dedicated project Tailwind config/theme ownership engine exists.

### 6.3 Deterministic utility subset

The first direct subset favors semantics that do not require project theme evaluation:
- display keywords;
- position keywords;
- flex direction/wrap;
- align-items / justify-content;
- text alignment;
- overflow keyword utilities;
- statically known font-weight keywords;
- bounded arbitrary spacing/sizing/type/radius values whose source literal proves runtime semantics;
- bounded arbitrary opacity/z-index/font-weight values.

### 6.4 First-order shorthand / axis conflicts

The primary v2 resolver already refuses direct ownership when ordinary shorthand/axis utilities participate.

Examples forced to Codex:
- `p-[16px] pt-[8px]` for `paddingTop`;
- `px-[16px] pl-[8px]` for `paddingLeft`;
- `my-[16px] mt-[8px]` for `marginTop`;
- `gap-x-[16px] gap-[8px]` for `gap`;
- `overflow-x-auto overflow-hidden` for `overflow`.

This is property-affecting conflict analysis, not prefix replacement.

### 6.5 Independent multi-property conflict guard

`markup_conflict_guard.rs` is a second native proof line. It deliberately duplicates only the question “can another static Tailwind token on this exact JSX owner also affect the requested property?”

It is separate from `markup_transaction_v2.rs` so future utility-family expansion cannot silently weaken the transaction resolver itself.

The guard catches multi-property helpers and shorthands such as:
- `size-*` competing with `width` / `height`;
- `container` competing with `width` / `maxWidth`;
- `place-items-*` competing with `alignItems`;
- `place-content-*` competing with `justifyContent`;
- `sr-only` / `not-sr-only` competing with position, size, spacing and overflow edits;
- `truncate` competing with overflow edits;
- `line-clamp-*` competing with display/overflow edits;
- the complete bounded Tailwind table/list display family competing with display edits.

The same guard sees variant tokens after stripping the variant prefix, so `md:size-*`, `hover:place-items-*`, etc. still count as property-affecting competitors.

The guard is bounded, main-webview only, read-only, executes no project code and grants no source-write authority by itself. Its role is veto-only.

### 6.6 Revalidation cadence

A Tailwind direct edit must pass the independent guard:
1. during the Properties/source ownership probe;
2. again immediately before native transaction preview;
3. again immediately before atomic commit.

Guard unavailability is fail-closed and routes to Codex.

This ensures stale UI proof cannot survive HMR/source changes and retain write authority.

### 6.7 Responsive/state variants

If a same-property family variant such as `md:gap-[24px]`, `hover:*`, `focus:*`, group/peer state or another variant is present, M2.3 refuses base direct editing for that property.

Responsive/state authoring requires its own explicit scope model.

## 7. Native commands

Privileged-main commands:
- `project_markup_edit_probe`;
- `project_markup_conflict_guard`;
- `project_markup_transaction_preview`;
- `project_markup_transaction_commit`.

Remote preview receives none of these permissions.

`project_markup_conflict_guard` is read-only and veto-only. Preview/commit output is evidence/UI intent only. The normal commit path independently re-runs current ownership and guard proof before invoking the atomic writer.

## 8. Native write boundary

The canonical hardened transaction engine is `markup_transaction_v2.rs`. The earlier prototype is removed from the compile path and repository; production contracts reject dual authority models.

A deterministic plan binds:
- exact source path;
- exact source byte range;
- exact source-before/source-after;
- lane (`tailwind` / `jsx-style`);
- owner kind;
- whole-file fingerprint.

Commit requires:
- regular non-symlink target;
- canonical target inside canonical project root;
- full-file stale-source fingerprint match after native re-resolution;
- exact source-range/value match;
- bounded JSX structure still reparses after replacement;
- same owner literal id/tag remains visible;
- create-new same-directory temp file;
- flush + `sync_all`;
- source permission preservation;
- atomic rename;
- no shell interpolation;
- no blind regex replacement.

Project-level source-mutation/orchestration locks from M2.1/M2.2 remain authoritative around this lane.

## 9. Properties UX

When markup ownership is proven, Properties shows a `Source-native` card with:
- lane: `Tailwind utility` or `JSX inline style`;
- exact `path:line`;
- native proof/refusal reason;
- owner kind;
- exact source Before/After;
- `Apply to source`;
- `Use Codex`.

When markup/guard proof is non-deterministic, direct apply is disabled and the Codex reason remains visible.

Token M2.2 semantics remain higher priority. Truncated token evidence cannot be bypassed by falling through to markup ownership; token lane is forced to Codex.

## 10. Shared generation / evidence pipeline

A successful JSX/Tailwind write uses `finishDirectVisualEdit`, exactly like CSS/token direct writes:

1. reject conflicting source/Codex/queue/check/browser/review work;
2. require clean exact Timeline provenance;
3. re-run exact markup + conflict proof;
4. native preview;
5. re-run exact markup + conflict proof again;
6. native commit/re-resolution;
7. mark source transaction pending;
8. invalidate stale Browser Evidence;
9. create one `kind: visual` checkpoint;
10. bind negative direct-visual generation identity;
11. emit `monument:source-transaction` with `sourceLane` / `ownerKind` metadata;
12. run generation-bound deterministic/browser evidence;
13. Fresh Review and Ship remain exact-generation gates.

No markup-specific history exists.

## 11. Production / regression contracts

`npm run check:native` includes `scripts/check_markup_editing.mjs`.

Contracts lock:
- only hardened v2 engine is compiled;
- independent conflict guard is compiled and main-only;
- JSX lexical false-positive refusal;
- unique live/source DOM ownership;
- inline-style cascade safety before stylesheet/Tailwind precedence;
- CSS-over-Tailwind precedence and fail-closed CSS preflight;
- static Tailwind requirement;
- theme/config refusal;
- responsive/state refusal;
- first-order shorthand/axis refusal;
- multi-property helper/shorthand veto (`size/place/sr-only/truncate/line-clamp/display`);
- guard fail-closed semantics;
- guard re-run before preview and commit;
- inline-style literal ownership;
- dynamic style/class/spread refusal;
- stale-source/root/symlink/atomic-write boundaries;
- Properties source card;
- exact Timeline/evidence handoff;
- preservation of M2.2 truncated-token Codex fallback.

## 12. Why arbitrary JSX props are not direct yet

M2.3 does not market ordinary DOM/component props as generic visual source ownership.

A literal prop is not proof that it owns the observed computed CSS property. Presentation hints, CSS cascade, intrinsic element semantics and component abstractions require an explicit semantic registry before deterministic prop mutation is safe.

Those edits remain Codex-backed.

## 13. Deliberately outside M2.3

- execution of Tailwind config/theme code;
- direct named theme-token mutation without proof;
- dynamic `className` AST rewriting;
- custom component prop ownership;
- component text AST mutation;
- JSX child/reparent/reorder mutations;
- responsive breakpoint authoring;
- pseudo/state variant authoring;
- CSS-in-JS;
- Sass/Less;
- JS/TS theme objects;
- multi-file source transactions.

## 14. Definition of Done

M2.3 is merge-ready only when the final exact head has:
- green TypeScript/source contracts;
- green markup production contract;
- green Node regression suite;
- green production Vite build;
- green Rust tests / `cargo test --all-targets` on Intel macOS CI;
- one canonical hardened markup transaction engine;
- independent Tailwind conflict guard;
- static Tailwind and JSX inline-style direct lanes working end-to-end;
- inline-style cascade safety;
- CSS-over-Tailwind precedence;
- shorthand/axis/multi-property/responsive/dynamic ownership refusal;
- guard revalidation before preview and commit;
- M2.2 token safety preserved;
- exact visual Timeline/evidence/Fresh Review/Ship handoff;
- no preview source-write authority;
- master + deep context aligned.

## 15. Product standard

M2.3 should make common static React/Tailwind code feel much closer to Framer direct editing without pretending class strings are a document model.

> **Static proof gets speed. Cascade and scope stay explicit. Independent native guards veto hidden competitors. Dynamic structure gets Codex. All paths produce real source and the same evidence-bound history.**
