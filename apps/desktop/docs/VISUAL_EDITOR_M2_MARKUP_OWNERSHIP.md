# Visual Editor M2.3 — Tailwind + JSX/TSX source ownership

Status: active implementation gate.
Branch: `monument/visual-editor-m2-tailwind-jsx`.
Stacked PR: #43 on top of M2.2 PR #41 until M2.2 merges.

## 1. Product objective

M2.3 extends source-native visual editing from plain CSS and CSS custom properties into modern React/Tailwind source without introducing blind class-string mutation or a second visual document model.

Core invariant:

> **A runtime value is not source ownership. A matching class name is not source ownership. Direct markup mutation requires one proven live DOM instance, one proven static source element, one statically understood property owner and one exact atomic replacement. Otherwise use Codex.**

## 2. Unified routing order

For one supported visual property draft, Monument resolves lanes in this order:

1. CSS token ownership / M2.2 assisted scope;
2. JSX/TSX static ownership:
   - inline `style={{...}}` literal;
   - static Tailwind utility;
3. plain literal CSS / M2.1;
4. Codex.

CSS ownership is checked before markup ownership. A deterministic or assisted plain-CSS owner prevents the markup lane from racing the same computed property.

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

This is intentionally strict. A lower hit rate is preferable to writing into a component template that controls multiple live instances.

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

A file that cannot be lexically classified safely contributes no deterministic markup owner.

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
- current value is a bounded string or number literal;
- source literal semantics match the observed computed value.

Inline-style ownership outranks Tailwind on the same element because inline style wins the CSS cascade.

If the `style` object is dynamic, contains spread/computed/nested syntax, or the requested property literal does not match runtime, the markup lane routes to Codex instead of falling through to Tailwind and pretending the class owns the property.

M2.3 updates existing inline properties only. It does not synthesize new `style` keys.

## 6. Tailwind lane

Tailwind direct editing currently requires a static literal `className` or `class` attribute.

Dynamic composition such as:
- `clsx(...)`;
- `cn(...)`;
- template expressions;
- conditional expressions;
- array/object class builders;

remains Codex-backed.

### 6.1 Proof model

A Tailwind utility receives direct authority only when:
- the relevant property family is explicitly registered;
- all source utilities that can affect that property are enumerated conservatively;
- no responsive/state variant exists in that property family;
- no important modifier exists;
- exactly one effective source candidate remains;
- exact source token is present on the selected live element;
- current utility semantics can be proven statically against the computed runtime value;
- requested value is representable by the bounded output grammar.

### 6.2 Theme/config refusal

Named scale utilities whose CSS value may depend on Tailwind project configuration are not blindly rewritten.

Example:

```text
gap-4
```

Even when runtime happens to be `16px`, M2.3 does not assume the default Tailwind theme is authoritative. It stays Codex-backed until Monument has a dedicated project Tailwind config/theme ownership engine.

### 6.3 Deterministic utility subset

The first direct subset favors semantics that do not require project theme evaluation:
- display keywords;
- position keywords;
- flex direction/wrap;
- align-items / justify-content;
- text alignment;
- overflow keyword utilities;
- statically known font-weight keywords;
- bounded arbitrary values for spacing/sizing/type/radius where source value itself proves the runtime literal;
- bounded arbitrary opacity/z-index/font-weight values.

### 6.4 Shorthand / axis conflict model

A side property is not owned by a side utility if a shorthand or axis utility also participates.

Examples that force Codex rather than direct mutation:
- `p-[16px] pt-[8px]` for `paddingTop`;
- `px-[16px] pl-[8px]` for `paddingLeft`;
- `my-[16px] mt-[8px]` for `marginTop`;
- `gap-x-[16px] gap-[8px]` for `gap`;
- `overflow-x-auto overflow-hidden` for `overflow`.

This is a property-affecting conflict model, not a prefix replacement model.

### 6.5 Responsive/state variants

If a same-family variant such as `md:gap-[24px]`, `hover:*`, `focus:*`, group/peer state or another Tailwind variant is present, M2.3 refuses base direct editing for that property.

Responsive/state authoring needs an explicit scope model and is a future gate.

## 7. Native transaction commands

Privileged-main commands:
- `project_markup_edit_probe`;
- `project_markup_transaction_preview`;
- `project_markup_transaction_commit`.

Remote preview receives none of these permissions.

Preview returns exact source intent only. It is never write authority.

Commit independently re-runs ownership resolution.

## 8. Native write boundary

The hardened engine is `markup_transaction_v2.rs`. The original prototype is removed from the compile path and repository to avoid dual authority models.

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

Project-level source-mutation/orchestration locks from M2.1/M2.2 remain authoritative around this native lane.

## 9. Properties UX

When markup ownership is proven, Properties shows a `Source-native` card with:
- lane: `Tailwind utility` or `JSX inline style`;
- exact `path:line`;
- native proof/refusal reason;
- exact source Before/After;
- `Apply to source`;
- `Use Codex`.

When markup probe is non-deterministic, direct apply is disabled and the reason remains visible.

Token M2.2 semantics remain higher priority. In particular, truncated token evidence cannot be bypassed by falling through to markup ownership: the token lane is forced to Codex.

## 10. Shared generation / evidence pipeline

A successful JSX/Tailwind write uses `finishDirectVisualEdit`, exactly like CSS/token direct writes:

1. reject conflicting source/Codex/queue/check/browser/review work;
2. require clean exact Timeline provenance;
3. native preview;
4. native commit/re-resolution;
5. mark source transaction pending;
6. invalidate stale Browser Evidence;
7. create one `kind: visual` checkpoint;
8. bind negative direct-visual generation identity;
9. emit `monument:source-transaction` with `sourceLane` / `ownerKind` metadata;
10. run generation-bound deterministic/browser evidence;
11. Fresh Review and Ship remain exact-generation gates.

No markup-specific history exists.

## 11. Production / regression contracts

`npm run check:native` includes `scripts/check_markup_editing.mjs`.

Contracts lock:
- only hardened v2 engine is compiled;
- JSX lexical false-positive refusal;
- unique live/source DOM ownership;
- main-only source-write commands;
- CSS ownership precedence;
- static Tailwind requirement;
- theme/config refusal;
- responsive/state refusal;
- shorthand/axis conflict refusal;
- inline-style literal precedence;
- dynamic style/class/spread refusal;
- stale-source/root/symlink/atomic-write boundaries;
- Properties source card;
- exact Timeline/evidence handoff;
- preservation of M2.2 truncated-token Codex fallback.

## 12. Deliberately outside M2.3

- execution of Tailwind config/theme code;
- direct named theme-token mutation;
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

## 13. Definition of Done

M2.3 is merge-ready only when the final exact head has:
- green TypeScript/source contracts;
- green markup production contract;
- green Node regression suite;
- green production Vite build;
- green Rust tests / `cargo test --all-targets` on Intel macOS CI;
- one canonical hardened markup engine;
- static Tailwind and JSX inline-style direct lanes working end-to-end;
- shorthand/axis/responsive/dynamic ownership refusal;
- CSS ownership precedence;
- M2.2 token safety preserved;
- exact visual Timeline/evidence/Fresh Review/Ship handoff;
- no preview source-write authority;
- master + deep context aligned.

## 14. Product standard

M2.3 should make common static React/Tailwind code feel much closer to Framer direct editing, but without pretending that Tailwind class strings are a document model.

> **Static proof gets speed. Dynamic structure gets Codex. Both produce real source and the same evidence-bound history.**
