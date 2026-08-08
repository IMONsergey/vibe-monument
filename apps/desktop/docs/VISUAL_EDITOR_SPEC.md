# Monument Visual Editor — Product & Architecture Spec

Status: **planned next major gate after Fresh Review + Ship Gate**.

## 1. Goal

Monument should offer a visual editing experience with the directness of Framer while remaining native to the user's real source code.

The editor is not a fake canvas disconnected from the repository. It is a source-aware editing system over the real running product.

Core promise:

> Select what you see, edit it visually, and Monument changes the real code safely.

## 2. Default layout

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Monument   Project        Preview / Editor              Versions   Ship     │
├────────────────┬───────────────────────────────────────────────┬─────────────┤
│ Layers         │                                               │ Properties  │
│                │                                               │             │
│ ▾ Page         │                 LIVE PRODUCT                  │ Layout      │
│   ▾ Hero       │                                               │ Size        │
│      Heading   │       select / drag / resize / edit           │ Spacing     │
│      Body      │                                               │ Typography  │
│      CTA       │                                               │ Fill        │
│   ▾ Features   │                                               │ Border      │
│                │                                               │ Effects     │
│                │                                               │ Component   │
├────────────────┴───────────────────────────────────────────────┴─────────────┤
│ Tell Monument what to build or change…                                    ↑ │
└──────────────────────────────────────────────────────────────────────────────┘
```

The visual editor is a first-class product mode, but Prompt stays available at all times.

## 3. User experience principles

### 3.1 Bidirectional selection
- click in preview → corresponding Layer is selected;
- click Layer → element is highlighted/scrolled into view;
- hover Layer ↔ hover preview highlight;
- selected element survives normal property edits and HMR refresh when it can be safely re-identified.

### 3.2 Framer-like right inspector
The right panel should expose only controls that make sense for the current selection.

Groups:
- Layout
- Size
- Position
- Spacing
- Typography
- Fill / Background
- Border
- Radius
- Effects
- Opacity
- Overflow
- Component / Props
- Responsive
- Accessibility (where deterministic)

Advanced raw code values may be disclosed, but should not dominate normal use.

### 3.3 Direct manipulation
Where semantics are deterministic:
- drag element position where the layout model supports it;
- resize handles;
- padding/margin handles;
- gap controls;
- alignment controls;
- inline text editing;
- image replacement;
- keyboard nudging;
- duplicate/hide/delete only when source operation is unambiguous and reversible.

### 3.4 Immediate feedback
Every change should update the live preview immediately after the source patch/HMR response.

Optimistic visual-only state must never become the persistent source of truth.

## 4. Layers model

Layers are a projection of the running artifact, not a manually maintained document tree.

A Layer may represent:
- semantic DOM element;
- framework component boundary when discoverable;
- repeated component instance;
- meaningful text/image/control element;
- layout container;
- page/route root.

### 4.1 Layer data packet
Each layer should carry bounded metadata such as:
- stable runtime id for the current preview session;
- tag;
- accessible name;
- text summary;
- role;
- classes;
- DOM parent/children;
- bounding rect;
- hidden/visible state;
- source hints;
- detected framework/component name;
- source file/line confidence;
- style ownership candidates;
- responsive/breakpoint observations.

### 4.2 Layer filtering
Raw DOM noise should be reduced.

Default Layer tree should favor:
- semantic containers;
- visible content;
- interactive controls;
- component boundaries;
- elements with editable layout/style ownership.

A developer toggle can expose raw DOM.

### 4.3 Repeated content
Repeated lists/cards require instance awareness.

The UI must distinguish:
- edit this instance;
- edit component/default;
- edit all instances;
- edit data/content source.

Monument must not silently convert an instance edit into a global component change.

## 5. Source ownership resolver

This is the critical engine behind the editor.

For every editable property, Monument attempts to resolve **where that value is actually owned**.

Possible owners:
- inline style literal;
- React/Vue/Svelte style prop;
- CSS/SCSS rule;
- CSS module;
- Tailwind utility;
- design token / CSS variable;
- theme object;
- component prop;
- framework variant;
- generated/dynamic expression;
- inherited ancestor style.

The resolver returns candidates with confidence and mutation capability.

Example:

```ts
StyleOwnerCandidate {
  property: 'padding-top'
  sourceKind: 'tailwind-class'
  path: 'src/components/Hero.tsx'
  line: 42
  value: 'pt-16'
  responsiveScope: 'base'
  confidence: 0.98
  mutation: 'deterministic'
}
```

## 6. Edit classes

### Class A — deterministic source edit
High-confidence one-to-one source mapping.

Examples:
- `p-8` → `p-10`;
- `--brand-accent` value change;
- literal `fontSize: 48`;
- component string text;
- known `variant="large"` prop.

Flow:
1. user changes control;
2. Monument creates an atomic source patch;
3. source patch is syntax/AST validated;
4. preview HMR updates;
5. changed generation becomes dirty until Timeline checkpoint;
6. Undo uses Version Timeline/edit transaction semantics.

### Class B — assisted deterministic edit
Several valid source owners/scopes exist.

Examples:
- padding comes from both base and media query;
- token is reused globally;
- editing a component instance could affect all instances.

UX:
- show one concise scope decision, e.g. `This breakpoint` / `All sizes`;
- or `This instance` / `Component`;
- then apply deterministically.

### Class C — Codex structural edit
Source transformation requires reasoning.

Examples:
- change flex architecture to grid;
- move element between component parents;
- introduce breakpoint logic;
- replace a dynamic expression;
- restructure reusable components;
- resolve style generated by runtime code.

The visual action becomes structured context for Codex:
- selected element packet;
- intended property/action;
- before value;
- desired value;
- source ownership candidates;
- screenshots/viewport;
- affected component/instances.

Codex performs the edit through normal approvals/evidence/history.

## 7. Property inspector details

## Layout
Detect actual layout model.

For flex:
- direction;
- align;
- justify;
- wrap;
- gap / row-gap / column-gap.

For grid:
- columns/rows;
- gap;
- alignment;
- item placement where deterministic.

For normal flow:
- display;
- block/inline behavior;
- container relationships.

Do not present flex controls for a grid container unless changing layout model is an explicit operation.

## Size
- width/height;
- min/max width/height;
- fixed / fill / fit-content concepts mapped to source representation;
- aspect ratio.

## Spacing
Framer-style box model editor:
- padding four sides;
- margin four sides;
- linked/unlinked sides;
- drag handles on canvas;
- unit awareness (`px`, `rem`, `%`, token/utilities).

When source uses tokens/utilities, inspector should prefer semantic values over flattening everything to arbitrary pixels.

## Typography
- family;
- weight;
- size;
- line height;
- letter spacing;
- alignment;
- text transform;
- decoration;
- color.

Font selection should understand local/project font assets and design tokens before offering arbitrary fallback fonts.

## Fill / Background
- solid color;
- token/color variable;
- opacity;
- gradients only where source representation is safely supported;
- image backgrounds.

## Border / Radius
- width/style/color;
- per-side when meaningful;
- radius linked/unlinked;
- token awareness.

## Effects
- shadow;
- opacity;
- simple filter where deterministic.

Avoid turning the property panel into a full CSS encyclopedia.

## Position
- static/relative/absolute/fixed/sticky;
- inset controls only when relevant;
- z-index.

Changing positioning mode is structural enough to require extra validation.

## 8. Responsive editing

Responsive editing must be a core feature, not an afterthought.

Viewports:
- desktop;
- laptop;
- tablet;
- mobile;
- custom.

For each property Monument tracks:
- observed computed value per viewport;
- source scope/breakpoint that owns it;
- inherited/base value;
- override value.

Inspector UX example:

```text
Padding
Desktop    64
Tablet     40   override
Mobile     24   override
```

Controls:
- edit current breakpoint;
- edit base/all;
- clear override;
- copy value across breakpoints.

Never create arbitrary media-query duplication if the project already has a breakpoint/token system.

## 9. Design-system awareness

Monument should discover and prefer the project's existing design language.

Potential sources:
- CSS variables;
- Tailwind config/theme;
- theme JS/TS objects;
- component variants;
- design token JSON;
- known spacing/type/color scales.

Property controls should surface semantic options where possible:

```text
Color
● Brand / Primary
● Surface / Dark
● Text / Muted
Custom…
```

Instead of immediately replacing a token with a raw hex value.

## 10. Component props and variants

For framework components, the panel can expose safe props.

Examples:
- `size`;
- `variant`;
- `tone`;
- `align`;
- boolean states;
- image/content props.

Discovery priority:
1. runtime framework metadata;
2. TypeScript prop types;
3. known variant utilities;
4. source analysis;
5. Codex inference as fallback.

Never expose arbitrary internal props as safe editable controls without evidence.

## 11. Text editing

Inline text edit should be exceptionally easy.

Double-click text → edit in place.

Monument resolves whether text belongs to:
- literal JSX/template text;
- prop;
- local data object;
- localization key;
- CMS/runtime data.

Direct edit is only deterministic for safe local ownership.

If text is localization/CMS-driven, the editor should indicate source and route appropriately rather than hardcoding rendered output into the component.

## 12. Images / assets

User can:
- drag/drop replacement image;
- choose project asset;
- change fit/position;
- edit alt text.

Asset operation must:
- copy/import into an explicit project asset location;
- avoid overwriting unrelated assets silently;
- update real source reference;
- preserve accessibility metadata.

## 13. Multi-select

Support only when operation semantics are clear.

Safe examples:
- same spacing value across selected siblings;
- alignment;
- typography token;
- shared color token.

Ambiguous multi-source edits should route to Codex or require scope selection.

## 14. Drag/reorder

Drag reorder in Layers is powerful but dangerous.

Only deterministic when:
- siblings map to a static source list/order;
- component structure is unambiguous;
- no dynamic key/data ordering is being overridden.

Otherwise drag action becomes a Codex structural request with a visual before/after target.

## 15. Undo / history

The editor must reuse Monument Version Timeline.

Two levels:
- micro undo while manipulating a property before commit/checkpoint;
- durable Timeline versions/checkpoints for source history.

A visual editor must never create a separate incompatible history system.

## 16. Dirty transactions

Property manipulation can generate many pointer events. Do not write one source patch per pixel.

Transaction model:
1. begin edit;
2. show bounded preview feedback;
3. debounce/coalesce source value;
4. commit one atomic source patch on release/enter;
5. HMR confirmation;
6. evidence marked stale;
7. optional lightweight verification based on edit class.

## 17. Preview instrumentation upgrades

Existing Select instrumentation becomes the base for Editor mode.

Add:
- full semantic Layer snapshot;
- stable runtime element ids;
- parent/child relationship packets;
- scroll-to/reveal command;
- hover/select from external Layers panel;
- computed box model;
- responsive observations;
- framework/component metadata;
- contenteditable-safe inline edit overlay;
- resize/spacing overlay geometry.

Remote preview still does **not** receive broad Tauri IPC.

## 18. Source editing engine

Preferred implementation path:

### TypeScript/JSX/TSX
Use AST-aware transformations rather than regex for structural edits.

Potential technologies to evaluate:
- TypeScript compiler API;
- ts-morph;
- Babel parser/recast for JSX-specific transforms.

### CSS
Use a parser/AST layer such as PostCSS for rule/value changes.

### Tailwind
Parse class strings into utilities/variants; preserve class ordering conventions when possible.

### Vue/Svelte/Astro
Use framework parser/compiler APIs where practical; otherwise fall back to source-aware Codex edit.

**Regex-only mutation is not acceptable for general source editing.**

## 19. Validation after deterministic edits

Cheap edits should feel instant but still be trustworthy.

Possible lightweight gate:
- parse/syntax validation;
- HMR success / preview alive;
- current element still resolves;
- no new browser runtime error;
- full Auto-QA deferred until meaningful batch/checkpoint unless configured otherwise.

Structural/Codex edits use normal full evidence route.

## 20. Editor + Prompt integration

The selected Layer automatically enriches Prompt.

Examples:
- select Hero → `Make this more compact`;
- change padding directly, then prompt `and make the typography feel stronger`;
- multi-select cards → `make these feel more premium`.

The right panel and Prompt are complementary, not competing modes.

## 21. Ask this / Explain

Context actions on a selected layer:
- Ask Monument;
- Explain source;
- Edit text;
- Find component;
- Show code;
- Fix issue;
- Create variant;
- Hide/Delete where safe.

## 22. Code escape hatch

Code editor remains available in Under the hood / Code.

Useful actions:
- open owning source;
- highlight edited range;
- diff last visual edit;
- revert edit;
- ask Codex about selected source.

But code should not become required for routine visual work.

## 23. Performance budgets

Especially for Intel Macs:
- Layers updates must be incremental, not full DOM serialization every frame;
- property drag feedback targeted to selected element;
- AST/source indexing cached and invalidated by file changes;
- no scanning entire repository on every selection;
- large Layers lists virtualized;
- source resolution cancellable;
- preview overlay work batched with animation frames.

## 24. Trust & safety

- user project is untrusted input;
- remote preview gets no broad native IPC;
- source paths canonicalized inside workspace;
- symlink escapes blocked;
- no shell interpolation;
- no hidden source mutations outside an explicit visual/user action;
- visual edit can never silently modify tests/config to validate itself;
- secrets are not copied into editor telemetry/context;
- source patch must be reversible.

## 25. Visual Editor product states

### Deterministic
`Editing source directly`

### Needs scope
`Choose where this change applies`

### Codex-required
`This change affects component structure. Monument will handle it as a task.`

### Unsupported
Explain why and offer Prompt/Code fallback.

Never pretend a change is editable visually when Monument cannot map it safely.

## 26. Definition of Done — first Visual Editor alpha

A user can:

1. open a real React/Vite or Next project;
2. start real preview;
3. enter Editor mode;
4. see a useful Layers tree;
5. click a Layer and highlight real preview element;
6. edit text safely;
7. edit padding/margin/gap;
8. edit width/height;
9. edit flex alignment;
10. edit typography;
11. edit color/radius/border;
12. edit a recognized component prop/variant;
13. switch mobile viewport and apply a breakpoint-specific value;
14. see real source update;
15. see HMR update live product;
16. undo/revert through Monument history;
17. inspect exact source/diff under the hood;
18. perform a structural visual request that correctly falls back to Codex rather than corrupting source;
19. run evidence/review on the resulting version;
20. restart Monument and retain the durable source/history state.

## 27. Later Visual Editor expansions

- grid track visual controls;
- component creation/extraction;
- reusable style/token creation;
- richer variants/states;
- route/page manager;
- animation/transitions editor;
- richer image focal-point controls;
- accessibility inspector;
- design-system cleanup/refactor tools;
- side-by-side variant editor.

## 28. Core invariant

> **The canvas is editable because Monument understands and changes the real source — not because it hides a second design document on top of the code.**
