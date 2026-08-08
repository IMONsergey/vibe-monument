# Monument Product Experience Refoundation

Status: architecture decision + interactive preview; production migration blocked pending approval
Date: 2026-08-08

## 1. The teardown

The current screen does not fail because its border radii are slightly wrong. It fails because three different products are mounted into one viewport:

1. `App` owns project/task/canvas/composer/developer/timeline/ship chrome.
2. `VisualEditorLayer` adds fixed Layers, Properties, canvas offsets, and selection tooling.
3. `AlphaPreviewShell` adds a separate full-screen Command Center with a dark purple health-dashboard language.

This creates five product-level problems:

- **The product is demoted.** Rails, cards, and system status occupy the user's focal hierarchy before the thing being built.
- **Implementation language leaks early.** Source ownership, token scope, raw CSS, protocol and evidence mechanics are presented as ordinary editing controls.
- **State has competing homes.** Codex activity, version state, proof state, and release state appear in multiple shells.
- **Panels shrink the canvas by default.** Contextual tools behave as permanent structure.
- **The visual system has no single authority.** Product, editor, and alpha shell each own colors, density, type, and elevation.

The correct response is an information-architecture reset, not a cosmetic pass.

## 2. Non-negotiable product laws

- The live product/canvas is the primary interface.
- Source is authoritative; the canvas is evidence and interaction context.
- The composer is compact, persistent, and context-aware.
- Properties appear because something is selected, not because an inspector exists.
- Codex is quiet when idle and legible when active.
- Timeline, Proof, Review, and Ship are progressive disclosure around the same generation—not four dashboards.
- Technical detail remains available, precise, and secondary.
- No project code is auto-run by the refoundation surface.
- Intel x86_64 is a production gate, not an afterthought.

## 3. Three workspace hypotheses

| Hypothesis | Spatial model | Strengths | Failure modes | Decision |
|---|---|---|---|---|
| **A. Contextual Orbit** | Full product canvas; compact composer below; selection tools, inspector, time, and proof appear as transient orbiting surfaces | Maintains direct manipulation and conversational continuity; least permanent chrome; proof can stay generation-bound; scales from novice to expert | Requires excellent dismissal, shortcuts, and surface priority; overlays can collide if unmanaged | **Chosen** |
| **B. Product Rooms** | Build, Review, and Ship are separate full-workspace rooms sharing one top-level project switcher | Extremely clear mode boundaries; review/release can be focused and calm | Frequent context switches; canvas disappears at the exact moment users need to compare proof; risks recreating Command Center as a room | Rejected for core loop; useful only for future deep review sessions |
| **C. Magnetic Edge Rails** | Empty canvas center with 4–8px edge affordances that expand Layers/Properties/Time/Proof on hover, click, or shortcut | Maximum canvas area; strong pro-tool feel; fast expert access | Low discoverability, hover dependence, inaccessible hidden state, edge collisions on small screens | Rejected as default; shortcuts/edge gestures may supplement A later |

## 4. Chosen architecture — Contextual Orbit

The workspace has one spatial anchor: the product. Everything else answers one of four questions:

| User question | Surface | Default state |
|---|---|---|
| What am I changing? | selection frame + contextual toolbar + optional inspector | visible only on selection |
| What should Monument do? | bottom composer | compact, always available |
| What just happened? | activity/result capsule above composer | visible only during/recent work |
| Can I trust or ship it? | Proof sheet and Timeline strip | hidden until requested or blocking |

### 4.1 Persistent anatomy

- **Window bar:** project identity, branch/version breadcrumb, viewport control, proof status, command entry. It is a locator, not a dashboard.
- **Canvas:** fills the workspace and owns visual hierarchy.
- **Composer:** centered at the bottom, narrow enough to keep the product visible, expandable for long prompts.

Nothing else is permanently open.

### 4.2 Contextual anatomy

- **Selection frame:** belongs to the chosen DOM element and uses an explicit label.
- **Mini toolbar:** high-frequency actions only: move/inspect, edit content, open inspector, ask Monument.
- **Inspector sheet:** human language first (`Layout`, `Appearance`, `Content`); source truth is a collapsed `Implementation` disclosure.
- **Activity capsule:** one-line plan/progress/result; opens Codex details without creating a global panel.
- **Map sheet:** bounded hierarchy/search for selecting an element; not a permanent Layers rail.
- **Timeline strip:** recent checkpoints arranged in time; expands only when comparing/restoring.
- **Proof sheet:** Checks → Fresh Review → Release readiness in one causal flow.
- **Command palette:** global access to every hidden surface and shortcut.

## 5. Surface priority rules

1. One dominant canvas.
2. At most one large sheet open.
3. Selection toolbar may coexist with a sheet only when it does not cover the selected element.
4. Command palette supersedes all sheets and closes first on Escape.
5. Composer stays reachable; a modal confirmation may temporarily take focus only for destructive/privileged action.
6. No panel creates a second canvas or a second composer.

## 6. Core journeys

### 6.1 Direct edit

1. User clicks product text.
2. Selection frame and compact toolbar appear.
3. `Content` opens a small inline editor; `Inspect` opens the contextual sheet.
4. The sheet shows direct edit if ownership is proved; otherwise it says why Monument must handle it.
5. Apply remains generation-bound and enters the existing Timeline/Evidence chain in production.

The preview simulates this state only; it performs no source transaction.

### 6.2 Prompted change

1. Selection is attached as composer context.
2. User asks for an outcome.
3. Composer perimeter becomes active and a capsule names the current step in plain language.
4. A completed one-line result appears; opening it reveals task detail and changed areas.
5. Canvas stays primary throughout.

### 6.3 Time travel

1. User opens Timeline from the window bar, result capsule, or command palette.
2. A horizontal strip shows meaningful checkpoints, current generation, and proof freshness.
3. Previewing a checkpoint is visually distinct from restoring it.
4. Restore requires an explicit action and production re-proves native state.

### 6.4 Proof, review, and ship

1. Proof status reads `Needs checks`, `Checking`, `Ready`, or `Blocked`.
2. Opening Proof shows a causal stack: deterministic checks, browser evidence, Fresh Review, release readiness.
3. Each stage shows one next action and short blocking language.
4. Technical evidence and generation IDs live under `Details`.
5. `Prepare release` remains blocked until the exact production generation satisfies existing gates.

## 7. Default information architecture

| Existing surface | New home | Disclosure rule |
|---|---|---|
| Tasks rail | activity capsule + Codex details sheet | only active/recent work |
| Facts cards | inspector `Implementation` or Proof details | on demand |
| Layers rail | Map sheet / command search | explicit open or selection shortcut |
| Permanent Properties | contextual inspector | selection only |
| Developer panel | Codex details / Proof technical details | on demand |
| Timeline panel | temporal strip + expanded sheet | explicit open |
| Ship panel | final stage of Proof sheet | only after readiness interest |
| Alpha Command Center | removed as a concept | health state folded into project/proof summaries |

## 8. Language architecture

Default copy answers user intent:

- `Hero heading` instead of a raw selector.
- `This change affects one element` instead of `unique id ownership proved`.
- `Monument needs to make this change` instead of `mode=codex`.
- `Checks are out of date` instead of exposing a stale generation integer.

Exact technical language remains available under Implementation/Details and is never falsified. Simplicity is a disclosure policy, not removal of truth.

## 9. Responsive architecture

- **≥1200px:** inspector overlays the right canvas edge with a safe inset; Timeline is a bottom strip above composer.
- **768–1199px:** sheets use a narrower overlay; the composer contracts; nonessential toolbar labels disappear.
- **<768px:** one bottom sheet at a time; the selected product remains visible above it; command palette becomes a full-width sheet; no hover-only behavior.
- **390×844 proof target:** select an element, open inspector, close it, prompt, open Timeline, and switch theme without losing the canvas/composer path.

## 10. Technical boundary

The standalone preview:

- contains static sample product content;
- stores transient UI state in the page only;
- contains no authored or built `fetch`, XHR, WebSocket, file, shell, Tauri, Git, Codex, or project action;
- serves only same-origin static assets, strips unused remote font declarations, blocks connections through CSP, and produces zero external requests in browser QA;
- does not import or mount inside `src/main.tsx`;
- uses shared preview tokens/primitives only;
- labels its results as simulated concept behavior.

The production system remains authoritative for selection normalization, source probes, native commits, Timeline generation, Evidence, Fresh Review, Ship, ACLs, and Intel packaging.

## 11. Approval and migration gate

This module stops after the standalone preview and draft PR. It must not replace the production shell until Sergey approves the direction.

After approval, migration begins with one vertical slice:

`select product element → contextual inspector → one existing proven edit → Timeline checkpoint → Evidence status → Fresh Review`

That slice must use existing production controllers and native commands. It must not fork source authority, evidence state, or version history. Only after this vertical slice is exact-head green on Intel should the old rails/shells be removed in subsequent bounded slices.
