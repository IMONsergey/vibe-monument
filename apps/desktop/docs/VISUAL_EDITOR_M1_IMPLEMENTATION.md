# Visual Editor M1 — Implementation State

This document records the concrete implementation state of Monument's first Framer-class visual editor slice. It supplements [`VISUAL_EDITOR_SPEC.md`](VISUAL_EDITOR_SPEC.md).

## Product goal

The Visual Editor is not a second page-builder document model.

It projects the **real running product** into:

- Layers on the left;
- the existing live native preview in the center;
- Properties on the right.

Source remains authoritative. Visual edits must become real repository changes and then pass through the same Timeline / evidence / review machinery as prompt-driven work.

## M1 user flow

```text
Open real project
  ↓
Start real preview
  ↓
Edit
  ↓
Layers ←→ live canvas ←→ Properties
  ↓
change text / size / layout / spacing / typography / appearance
  ↓
Apply
  ↓
Prompt Queue with captured live selection
  ↓
existing App execution pipeline
  ↓
source hints + Codex + normal approvals
  ↓
real source edit
  ↓
HMR
  ↓
selected Properties refresh
  ↓
Version Timeline + deterministic/browser evidence
```

There is no preview-only style database in this flow.

## Native security model

### App-command ACL

`src-tauri/build.rs` now declares the app command surface through `tauri_build::AppManifest::commands`.

This changes the default assumption from “all app commands are implicitly callable” to an explicit generated permission surface.

### Main webview

`capabilities/main-capability.json` is scoped to:

```json
"webviews": ["main"]
```

It contains the privileged Monument commands used by the bundled product UI.

It deliberately does **not** grant `preview_editor_emit`.

### Live preview webview

`capabilities/preview-editor-capability.json` is:

- `local: false`;
- scoped only to webview label `monument-preview`;
- scoped only to loopback HTTP(S) URL patterns;
- macOS-only;
- granted exactly one app permission: `allow-preview-editor-emit`.

The preview does not receive filesystem, process, Git, Codex, settings, system or generic `core:default` privileges.

The existing native preview still has exact-origin top-level navigation locking after it is opened.

## Preview editor bridge

File: `src-tauri/src/preview_editor_bridge.rs`.

Accepted preview → Monument data message kinds:

- `tree`;
- `selection`;
- `hover`;
- `ready`.

Hard limits:

- tree payload: 384 KiB;
- selection payload: 64 KiB;
- hover payload: 4 KiB;
- ready payload: 2 KiB;
- max 180 bridge messages / second.

The command also checks that the invoking webview label is exactly `monument-preview`.

Main → preview control commands:

- `preview_editor_set_active`;
- `preview_editor_request_tree`;
- `preview_editor_select`;
- `preview_editor_hover`.

Session node ids use bounded `m-<digits>` identifiers and are safely JSON-encoded before JavaScript evaluation.

## Runtime Layers projection

File: `src-tauri/src/preview_editor_script.rs`.

The script is injected into the existing child WKWebView together with the Select inspector and Browser Evidence runtime.

Properties:

- loopback host guard;
- maximum 600 meaningful layers;
- maximum projected depth 18;
- session-only WeakMap element ids;
- no persistent `data-monument-node-id` attributes;
- no second saved document tree;
- MutationObserver only emits while editor mode is active;
- Monument overlay mutations are filtered out to avoid feedback loops;
- selected computed properties are refreshed after real product DOM mutations / HMR.

Meaningful layer projection favors:

- semantic elements;
- controls;
- text-bearing elements;
- roles / stable ids;
- flex/grid containers;
- meaningful visible containers.

Noise-only DOM wrappers are skipped where possible while descendants remain connected to the nearest projected parent.

## Bidirectional selection

### Canvas → Layers / Properties

While editor mode is active:

- pointer hover highlights the real DOM element;
- click prevents the product action and selects the real DOM element;
- selection packet is sent through the bounded bridge;
- Layers highlights the same session node id;
- Properties receives the real computed values.

When editor mode is off, product clicks behave normally.

### Layers → Canvas / Properties

A Layers row:

- hovers the corresponding real DOM node;
- selects the real DOM node;
- scrolls it into view when necessary;
- updates the same selection packet and Properties.

## Layers UI

File: `src/editor/LayersPanel.tsx`.

Current features:

- live hierarchy;
- indentation by projected depth;
- collapse / expand;
- search;
- element-kind icons;
- semantic label / tag / display value;
- selected-state synchronization;
- hover synchronization;
- selected row scroll-into-view;
- bounded-tree warning;
- explicit “runtime projection · source remains authoritative” status.

## Properties UI

File: `src/editor/PropertiesPanel.tsx`.

Current real computed/editable groups:

### Content
- direct text when the projected layer has a safe direct text node signal.

### Size
- width / height;
- min/max width;
- min/max height.

### Layout
- display;
- position;
- flex direction / wrap;
- align / justify;
- gap;
- grid columns.

### Spacing
- four padding sides;
- four margin sides.

### Typography
- font family;
- size;
- weight;
- line height;
- tracking;
- alignment;
- color.

### Appearance
- background color;
- background image;
- border;
- radius;
- shadow;
- opacity;
- overflow;
- z-index.

The current controls intentionally accept source-oriented CSS values rather than pretending every project uses the same design system.

Higher-level token/dropdown controls are a later ownership-aware layer.

## Source ownership signal

File: `src/editor/ownership.ts`.

The editor reuses Monument's bounded deterministic source-hint search and exposes a non-authoritative ownership signal:

- Likely;
- Possible;
- Weak;
- Unknown.

The primary candidate shows path / line / score, with bounded alternatives.

Important invariant:

> A source hint is evidence for investigation, not proof that Monument may patch that location directly.

## Source-authoritative Apply

File: `src/editor/intent.ts`.

M1 deliberately does not mutate the page with temporary style overrides.

When the user presses Apply:

1. property deltas are bounded and normalized;
2. a human-readable Visual Editor source instruction is built;
3. the current live selection is captured with the request;
4. the request is added to the existing Prompt Queue;
5. a deliberately paused existing queue remains paused;
6. otherwise the user-initiated edit is eligible to execute immediately;
7. the existing App pipeline compiles live context + deterministic source hints;
8. the same Codex runtime / thread semantics / approvals apply;
9. the resulting source change gets normal Timeline + evidence processing.

This is the M1 **Codex edit path** from the architecture spec.

## Selection trust boundary

File: `src/preview/selection.ts`.

All preview selections are centrally normalized before they become shared application context.

Current bounds include:

- URL;
- tag / id / role;
- up to 12 classes;
- accessible name;
- rendered text;
- selector;
- parent selector;
- rect / viewport finite numbers;
- bounded style key/value count and length.

This applies to both legacy Select and Visual Editor selection packets.

## Layout integration

Visual editor panels do not visually cover the native child WKWebView.

`visual-editor-active` changes the product layout so the center canvas receives real left/right space. The existing `ResizeObserver` then moves/resizes the native child webview to the new canvas geometry.

Editor mode hides the legacy local Select toolbar because canvas selection is built into the editor mode itself.

## Current tests

### `visual-editor-contract.test.js`
Locks:

- app-command ACL enumeration;
- main/preview capability separation;
- preview data-only permission;
- loopback remote patterns;
- bridge limits / caller-label checks;
- no process/fs bridge code;
- bounded WeakMap Layers projection;
- no hidden node-id DOM attributes;
- bidirectional UI contracts.

### `visual-editor-source-edit.test.js`
Locks:

- Apply uses Prompt Queue;
- source-authoritative instruction contract;
- normal approvals;
- no preview mutation API in the source-edit path;
- Framer-like editable properties;
- source ownership remains a confidence signal.

### `preview-selection-boundary.test.js`
Locks:

- central selection normalization;
- bounded prompt context;
- overlay MutationObserver filtering;
- selected-property refresh after product mutation.

## M1 Definition of Done

M1 is complete when all of these are true on the merged head:

- Intel native CI passes the ACL/capability/runtime bridge;
- web TypeScript/source contracts pass;
- live Layers projection works without source mutation;
- canvas ↔ Layers selection is bidirectional;
- Properties shows real computed values;
- source candidate confidence is visible and non-authoritative;
- text + core style properties can be edited as drafts;
- Apply enters the normal source/Codex/Timeline/evidence pipeline;
- HMR refreshes the selected computed Properties;
- legacy Select and Browser Evidence still work;
- MASTER_PRODUCT_CONTEXT / VISUAL_EDITOR_SPEC reflect the implementation.

## Explicitly not yet M1

These belong to subsequent editor gates:

- AST/token-level direct deterministic writes without Codex;
- instant source transaction preview for deterministic edits;
- CSS variable / Tailwind / design-token picker UI;
- drag handles / resize handles / spacing handles;
- keyboard nudging;
- multi-select;
- drag reparent/reorder;
- component prop / variant extraction;
- breakpoint override authoring;
- grid track editor;
- media asset replacement UI;
- lock/hide semantics persisted to source;
- semantic component boundaries beyond current runtime/source evidence;
- direct file/code editor integration.

## Next gate after M1

**Visual Editor M2 — Deterministic Source Transactions.**

Priority order:

1. detect source styling ownership class;
2. CSS variables / tokens;
3. literal CSS declarations;
4. safe Tailwind utility replacement;
5. JSX/TSX literal style / simple prop values;
6. dry-run patch + source snippet;
7. apply as one Timeline transaction;
8. automatically invalidate and re-run evidence;
9. keep Codex fallback for ambiguity or structural edits.

Core rule remains:

> **The editor manipulates the real product, but source code remains the only durable truth.**
