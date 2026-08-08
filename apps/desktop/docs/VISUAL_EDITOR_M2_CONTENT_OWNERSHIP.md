# Visual Editor M2.4 — Content & Semantic Source Ownership

Status: active stacked implementation gate.  
Branch: `monument/visual-editor-m2-component-content`.  
Parent: M2.3 branch `monument/visual-editor-m2-tailwind-jsx` / PR #43.

## Product objective

Before M2.4, Visual Editor could draft direct text but source application still fell through to Codex. M2.4 gives common static content changes the same proof-driven source-native transaction model as CSS, tokens and hardened JSX/Tailwind.

The gate intentionally combines:
- static direct JSX text ownership;
- a small explicit semantic DOM attribute registry;
- bounded live semantic evidence;
- one atomic multi-change source transaction;
- Properties UX;
- the existing Timeline/evidence/Fresh Review/Ship chain.

Core invariant:

> **Content is direct only when one unique live DOM node maps to one static JSX/TSX DOM owner and every requested content operation is statically proved in that owner. One ambiguous operation makes the whole content batch Codex-backed.**

## 1. Explicit scope

M2.4 direct content properties are exactly:
- `textContent`;
- `ariaLabel` → `aria-label`;
- `title`;
- `alt` for `<img>`;
- `placeholder` for `<input>` / `<textarea>`.

This is an explicit semantic registry, not a generic prop writer.

Not automatically direct:
- `value` / `defaultValue`;
- `src` / asset replacement;
- `href` / navigation semantics;
- `role`;
- arbitrary `data-*`;
- component props;
- React variants;
- event handlers;
- children expressions;
- rich/nested JSX content.

Those remain Codex-backed until a dedicated semantic ownership model exists.

## 2. Strong live/source identity

Native `content_transaction.rs` requires:
- bounded live DOM id;
- `idUnique === true`;
- real lowercase DOM/custom-element tag;
- bounded `.tsx/.jsx` scan;
- exactly one opening tag with matching literal id and tag;
- no owning attribute spread;
- no duplicate content/semantic attributes;
- non-truncated source scan.

Multiple source elements with the same literal id or an absent static owner refuse direct authority.

## 3. Static direct text ownership

A direct text change requires one **simple direct JSX text body**.

Eligible shape:

```tsx
<button id="hero">Hello world</button>
```

Not direct:

```tsx
<button id="hero">Hello <strong>world</strong></button>
<button id="hero">Hello {name}</button>
```

The bounded text owner refuses:
- nested tags;
- JSX expressions / braces;
- self-closing elements;
- unsupported/ambiguous source entities;
- incomplete/truncated live direct text;
- source/runtime text mismatch.

Source text is decoded through a bounded HTML/JSX entity model, normalized against live direct-text evidence, and replacement text is encoded for JSX (`&`, `<`, `>`, `{`, `}`) before source mutation.

M2.4 does not attempt rich-text AST editing.

## 4. Semantic attribute ownership

For the explicit registry, native resolution supports:
- replacing one existing literal attribute value;
- inserting one missing literal attribute when the live attribute is absent;
- multiple supported operations in one batch.

Existing dynamic attributes remain Codex-backed:

```tsx
<img id="hero" alt={computedAlt} />
```

An owner containing an attribute spread is also Codex-backed because spread order can override semantic attributes:

```tsx
<img {...props} id="hero" alt="Static" />
```

Literal source values are entity-decoded and compared against bounded live attribute evidence before direct ownership is granted.

## 5. Bounded live semantic evidence

M2.4 does not expand preview filesystem authority.

Trusted `main` may call:
- `preview_editor_request_content(domId)`.

Native host injects a bounded read into the existing child preview for the **already selected unique DOM id**. The preview returns only:
- `aria-label`;
- `title`;
- `alt`;
- `placeholder`;

through the existing `preview_editor_emit` data-only bridge as a bounded `content` packet.

Bridge constraints:
- bounded DOM id;
- bounded content payload (`MAX_CONTENT_BYTES`);
- existing bridge rate limit;
- only the `content` message kind is added;
- no new remote source/process/filesystem command permission.

Frontend accepts a packet only when `domId` still equals the current unique selection; stale packets are ignored.

The read channel is runtime evidence, not independent write authority. Native source ownership is still re-proved from repository source.

## 6. Atomic batch model

One Content group may change multiple supported properties before Apply, e.g.:

- text;
- `aria-label`;
- `title`.

Native resolution requires **every** operation in the batch to be deterministic in the same unique source owner.

If one operation is nested, dynamic, unsupported, stale or ambiguous:
- no partial source write occurs;
- the whole batch uses Codex.

Current batch bound: maximum 8 content operations.

Multiple attribute insertions at the same opening-tag insertion point are still one file transaction; replacements are applied in descending source-offset order.

## 7. Native transaction boundary

Privileged-main commands:
- `project_content_edit_probe`;
- `project_content_transaction_preview`;
- `project_content_transaction_commit`.

Remote preview receives none of these source commands.

A deterministic plan binds:
- exact source path;
- operation kind (`text` / `attribute`);
- exact source range;
- source-before/source-after;
- owner kind;
- whole-file fingerprint.

Commit independently re-runs content ownership and then requires:
- one source file for the full batch;
- regular non-symlink target;
- canonical containment inside project root;
- exact whole-file fingerprint;
- exact source range/value for every operation;
- bounded JSX source owner still present after replacement;
- same literal id/tag owner still visible;
- create-new same-directory temp file;
- flush + `sync_all`;
- permission preservation;
- atomic rename;
- no shell interpolation;
- no blind regex replacement.

## 8. Values and sanitization

Content uses a separate value path from style editing.

Style values retain the M2.1/M2.3 300-character canonicalizer.

Content values use bounded control-character stripping without the old whitespace-collapsing 300-character sanitizer:
- text: up to the dedicated content bound;
- semantic attributes: up to 800 characters.

This prevents source-native text from being silently truncated or rewritten by a style-specific sanitizer before native resolution.

## 9. Properties UX

Properties now contains **Content & semantics**:
- Text when complete bounded direct text is available;
- ARIA label;
- Title;
- Alt only for images;
- Placeholder only for input/textarea.

Semantic fields remain disabled until the bounded live semantic packet is available.

When the whole content batch is source-native, Properties shows a `Content source` card with:
- atomic operation count;
- exact path;
- native proof reason;
- each operation’s property, owner kind and line;
- source Before / After;
- **Apply atomic content batch**;
- **Use Codex**.

Nested/dynamic content shows the Codex route instead of a fake direct option.

## 10. Source-lane routing

M2.4 adds a new direct lane:
- `jsx-content`.

Content-only batches are resolved by M2.4 before style/token/markup/CSS routing because those engines do not own semantic text/attributes.

Mixed content + style batches currently remain Codex-backed rather than attempting an unsafe cross-engine partial transaction.

This is deliberate: multi-engine atomic source transactions are still a future gate.

## 11. Shared generation / evidence chain

A successful content commit enters the existing `finishDirectVisualEdit` path:
- source orchestration/race guards;
- clean exact Timeline provenance;
- native preview + commit;
- stale Browser Evidence invalidation;
- one `kind: visual` checkpoint;
- negative direct-visual generation identity;
- `sourceLane: jsx-content` metadata;
- generation-bound deterministic/browser evidence;
- Fresh Review;
- Ship.

There is no content-specific history model.

## 12. Production contracts

`npm run check:native` includes `scripts/check_content_editing.mjs`.

Regression coverage locks:
- bounded unique source owner;
- static text entity safety;
- nested/dynamic text refusal;
- explicit semantic registry;
- dynamic/spread semantic refusal;
- atomic multi-operation batch;
- whole-file fingerprint + root/symlink/range safety;
- bounded live semantic read channel;
- stale content packet rejection;
- main-only content commands;
- Content Properties UX;
- content-specific value bounds;
- shared Timeline/evidence handoff;
- preservation of M2.1/M2.2/M2.3/Codex lanes.

## 13. Explicit non-goals

- rich/nested text AST mutation;
- arbitrary React children expressions;
- generic component prop mutation;
- variant extraction;
- asset/source replacement;
- href/navigation editing;
- input state/control ownership;
- cross-engine multi-file atomic transactions;
- localization key mutation;
- CMS/content-source synchronization.

## 14. Definition of Done

M2.4 is merge-ready only when the **final exact head** has:
- green TypeScript/source contracts;
- green source/token/markup/content production contracts;
- green Node regression suite;
- green Vite production build;
- green Rust tests on Intel macOS CI;
- bounded live semantic read channel;
- static direct-text ownership;
- explicit semantic attribute registry;
- atomic content batch transaction;
- main-webview-only source commands;
- whole-file fingerprinted atomic commit;
- `jsx-content` Timeline/evidence/Fresh Review/Ship handoff;
- Codex fallback for nested/dynamic/unsupported content;
- no preview source-write authority;
- master + this deep spec aligned.

## Product standard

> **Plain content should feel instant when it is actually plain. The moment content becomes nested, computed, spread-driven or component-owned, Monument stops pretending and hands the source problem to Codex.**
