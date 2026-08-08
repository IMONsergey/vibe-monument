# Visual Editor M2.3 — Tailwind + JSX/TSX source ownership

Status: active implementation gate.
Branch: `monument/visual-editor-m2-tailwind-jsx`.
Parent gate: M2.2 token-aware direct editing.

## Product objective

M2.1 made plain literal CSS source-native. M2.2 made simple CSS custom-property ownership source-native. Real React products still fall back to Codex too often because visual ownership frequently lives in JSX/TSX:

```tsx
<div id="hero" className="flex gap-[16px] rounded-[8px]" />
```

or:

```tsx
<div id="hero" style={{ gap: '16px', opacity: 1 }} />
```

M2.3 adds a **bounded static markup ownership lane** without turning Monument into a regex rewriter or trusting the live preview as source authority.

Product rule:

> **A JSX/Tailwind source write is direct only when one live element, one static source DOM owner and one exact static source value all agree. Dynamic composition, variants, competing CSS or uncertain semantics remain Codex-backed.**

## End-to-end routing

For one changed visual property, Properties now routes in this order:

1. CSS token scope (M2.2) when a proven token-backed owner exists;
2. plain CSS ownership (M2.1) outranks markup ownership when CSS resolver sees deterministic/assisted ownership;
3. bounded JSX/Tailwind source probe;
4. literal CSS direct transaction when applicable;
5. Codex fallback.

All direct lanes converge on the same:

`source write → visual Timeline checkpoint → generation-bound deterministic/browser evidence → Fresh Review → Ship`.

No markup-only history or hidden editor document model is introduced.

## Native modules

### `jsx_source.rs`

A deliberately conservative bounded JSX opening-tag scanner.

It supports:
- lowercase/normal JSX opening tags;
- bounded attributes;
- literal quoted attributes;
- bounded expression attributes for later static-object inspection;
- spread detection;
- duplicate attribute detection.

It explicitly refuses lexical ambiguity rather than pretending to be a full JavaScript parser.

Safety behavior:
- JavaScript strings are not parsed as JSX;
- template literals are not parsed as JSX;
- line/block comments are not parsed as JSX;
- closing tags are skipped without hiding later opening tags;
- JSX expressions containing ambiguous slash syntax are refused;
- a bare slash in ordinary JS code makes the bounded file scan refuse direct ownership, preventing regex-shaped JSX lookalikes from becoming write authority.

The scanner intentionally has false negatives. M2.3 does not claim full JavaScript/TypeScript parsing.

### `markup_transaction.rs`

Privileged native ownership + transaction engine.

Commands:
- `project_markup_edit_probe`;
- `project_markup_transaction_preview`;
- `project_markup_transaction_commit`.

The commands are registered only for the trusted `main` webview. The remote preview receives no new source-write permission.

## Source element ownership

M2.3 core deliberately requires strong identity.

A direct markup candidate requires:
- selected live element has a bounded DOM id;
- preview reports that id as unique in the current live document;
- exactly one bounded `.tsx` / `.jsx` source opening tag has the same **literal id** and same real DOM tag;
- source tag is a lowercase real DOM/custom-element tag, not a React component abstraction;
- no source spread attribute on the owner;
- no duplicate `id`, `className`, `class` or `style` attributes;
- source scan is not truncated.

Multiple source tags with the same literal id refuse direct ownership.

This does **not** claim single rendered-instance scope for component source. A JSX source owner may render more than once over the lifetime of the application. The UI therefore describes the operation as an edit to the owning source rather than pretending it is a preview-only instance mutation.

## CSS precedence rule

Markup ownership may not race plain CSS ownership.

Before `project_markup_edit_probe`, the frontend asks the existing M2.1 source transaction resolver about the same property.

If that CSS resolver returns:
- `deterministic`; or
- `assisted`,

then the JSX/Tailwind lane is suppressed.

This preserves one ownership hierarchy instead of allowing `.css` and `className` to compete for the same computed value.

## Tailwind lane

### Static class ownership only

Direct Tailwind requires one static literal:
- `className="..."`; or
- `class="..."`.

Dynamic/composed forms remain Codex-backed:
- `clsx(...)`;
- `cn(...)`;
- template expressions;
- ternaries;
- array joins;
- object maps;
- spread-driven class ownership;
- any non-literal class expression.

### Supported property families

The native engine contains an explicit visual-property → utility-family registry for bounded layout/spacing/type/appearance families such as:
- width / height / min/max size;
- gap;
- side-specific padding/margin;
- display / position;
- flex direction / wrap;
- align / justify;
- font size/weight/line-height/tracking;
- text align;
- border radius;
- opacity;
- overflow;
- z-index.

Unsupported families stay Codex-backed.

### Semantic proof

A Tailwind source token must:
- belong to the requested utility family;
- be present in the static source class string;
- also be present on the selected live element;
- be the only base utility in that family;
- not carry responsive/state variants;
- not carry unsupported `!important` semantics;
- have current value semantics that Monument can prove statically.

M2.3 **does not blindly assume Tailwind default theme scales**.

For example:

```tsx
className="gap-4"
```

is not directly rewritten merely because the runtime currently computes to `16px`; project Tailwind configuration/theme semantics may have redefined that utility.

By contrast, bounded arbitrary-value ownership such as:

```tsx
className="gap-[16px]"
```

can prove its current semantic value and may be deterministically replaced with:

```tsx
className="gap-[24px]"
```

when the observed runtime value also matches.

Known non-theme keywords such as basic display/position/flex alignment classes may also be deterministic when their semantics are explicitly registered.

### Variants

If the same family has responsive/state ownership such as:

```tsx
className="gap-[16px] md:gap-[24px]"
```

M2.3 refuses direct replacement rather than flattening responsive behavior into the base utility.

Breakpoint-aware authoring remains a separate gate.

## JSX inline-style lane

M2.3 supports bounded static inline style objects:

```tsx
style={{ gap: '16px', opacity: 1 }}
```

Direct ownership requires:
- the `style` attribute is a JSX expression;
- the expression is one literal object;
- no spread in the object;
- requested property appears exactly once;
- key is a static safe identifier;
- current value is a bounded string literal or supported numeric literal;
- its semantic value matches the observed computed runtime value.

Dynamic ownership is refused:
- spread objects;
- computed keys;
- dynamic expressions;
- duplicate requested property;
- unsupported slash/expression syntax;
- non-literal requested owner.

The replacement is encoded as a quoted JSX string literal. The engine never interpolates raw user input into executable JavaScript.

Inline style is checked before Tailwind because, when the requested property is statically present, it has stronger browser cascade ownership than a class utility.

If the style object contains a spread, M2.3 refuses Tailwind fallback too because that spread could dynamically override the requested property.

## Why arbitrary JSX props are not claimed yet

M2.3 does not market ordinary DOM/component props as generic visual direct-edit ownership.

Examples such as `width={320}` can interact with presentation hints, CSS cascade, intrinsic element semantics and component abstractions. A literal source value alone is not enough to prove that mutating the prop owns the observed computed CSS property.

Future direct prop editing requires an explicit semantic registry per DOM/component prop, not a string-based attribute replacer.

Until then, those changes remain Codex-backed.

## Filesystem / transaction safety

A deterministic markup plan records:
- exact source path;
- exact source range;
- exact source-before/source-after;
- lane (`tailwind` or `jsx-style`);
- owner kind;
- whole-file fingerprint.

Commit independently re-runs source ownership resolution and then:
- checks target with `symlink_metadata`;
- requires a regular non-symlink file;
- canonicalizes target and requires it inside canonical project root;
- rereads the file;
- requires exact whole-file fingerprint match;
- requires exact replacement-range/source match;
- applies one bounded replacement;
- reparses JSX opening tags and requires the selected literal id/tag owner to remain structurally valid;
- writes through same-directory create-new temp file;
- flushes + `sync_all`;
- preserves file permissions;
- atomically renames over the source;
- uses no shell interpolation;
- uses no regex-based blind replacement.

## Properties UX

For a proven M2.3 candidate Properties shows a dedicated **Source-native** card with:
- lane label (`Tailwind utility` / `JSX inline style`);
- exact source path + line;
- native reason;
- owner kind;
- source Before / After;
- `Apply to source`;
- `Use Codex`.

A dynamic/unsupported markup case can surface the Codex route and its reason rather than looking like a mysterious failure.

## Timeline / evidence integration

Markup direct edits use `finishDirectVisualEdit`, the same handoff used by M2.1/M2.2:
- mark source mutation pending;
- invalidate stale Browser Evidence;
- create one `kind: visual` Timeline checkpoint;
- bind the negative direct-visual generation id;
- emit `monument:source-transaction`;
- run existing generation-bound deterministic/browser evidence orchestration;
- preserve Fresh Review and Ship gates.

The checkpoint/event additionally carries:
- source lane;
- owner kind.

## Regression and production contracts

### Rust coverage

`jsx_source.rs` covers:
- literal/expression attribute parsing;
- spread + duplicate attributes;
- slash-expression refusal;
- JSX-shaped strings/comments/templates exclusion;
- closing-tag duplicate visibility;
- regex/bare-slash file refusal.

`markup_transaction.rs` covers:
- arbitrary Tailwind direct replacement;
- named theme-scale refusal;
- responsive variant refusal;
- JSX inline-style replacement;
- style-spread refusal;
- non-unique live id refusal;
- source spread refusal.

### Node contract

`tests/visual-editor-markup-editing.test.js` locks:
- lexical scanner safety;
- unique literal DOM source ownership;
- Tailwind safety semantics;
- JSX style dynamic refusal;
- fingerprint/root/symlink/atomic write boundary;
- main-webview-only command ACL;
- CSS-over-markup precedence;
- Properties source-lane UX;
- Timeline/evidence handoff;
- preservation of CSS/token/Codex lanes.

### Production contract

`npm run check:native` includes `scripts/check_markup_editing.mjs` alongside the existing source/token contracts.

## Explicit non-goals for M2.3 core

- dynamic `className` composition;
- Tailwind config execution;
- blind assumptions about default theme scales;
- responsive/state variant authoring;
- arbitrary component-prop mutation;
- CSS-in-JS ownership;
- styled-components/emotion parsing;
- Sass/Less variables;
- component text AST editing;
- component variant extraction;
- multi-file atomic transactions;
- canvas resize handles.

These remain Codex-backed or future dedicated ownership gates.

## Definition of Done

M2.3 is mergeable only when the exact final head has:
- green TypeScript/source contracts;
- green source/token/markup production contracts;
- green Node regression suite;
- green Vite production build;
- green Rust tests on Intel macOS CI;
- bounded lexical JSX scanner;
- exact static source DOM ownership;
- static Tailwind utility lane with variant/theme safety;
- static JSX inline-style literal lane;
- CSS-over-markup precedence;
- native re-resolution + fingerprinted atomic commit;
- main-webview-only source commands;
- shared visual Timeline/evidence/Fresh Review/Ship handoff;
- Codex fallback for every dynamic/ambiguous/unsupported case;
- no hidden preview-only state.

## Product standard

> **Static source ownership must be proved twice: once as a bounded source model and again immediately before commit. “Looks like Tailwind/JSX” is never write authority.**
