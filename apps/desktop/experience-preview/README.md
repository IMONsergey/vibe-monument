# Monument Contextual Orbit preview

This directory is the product-approval gate for the Monument Product Experience Refoundation. It is an isolated React/Vite surface built directly on the official `@openai/apps-sdk-ui` package. It is not imported by the alpha runtime and it performs no source, Git, Tauri, Codex, backend, or external-network action. Serving the static artifact naturally loads its own same-origin HTML, CSS, and JavaScript assets.

## Run

From this directory:

```bash
npm ci --ignore-scripts
npm run check
npm run dev
```

Open:

- `http://127.0.0.1:4174/` — interactive Contextual Orbit workspace;
- `http://127.0.0.1:4174/foundation.html` — official primitives plus Monument semantic composites.

Build a portable static preview:

```bash
npm run build
npm run qa
```

Output: `apps/desktop/dist-experience/`.

The package has its own manifest and lock, so production desktop installs do not consume the preview dependency graph. Every registry artifact in the lock has an integrity digest, and the official package digest is asserted by the contract check.

The build finishes with source-map and network-boundary checks. The official package currently declares
`lodash@4.17.21` for its `Slider`, which this preview does not import. The check fails if any module
from the full `lodash` package enters the static preview bundle. Package lifecycle scripts remain
disabled in local and CI installation. The unused remote KaTeX font declarations from the official
global stylesheet are stripped; both HTML entries enforce `connect-src 'none'`, and the build fails
on external font URLs or runtime `fetch`.

`npm run qa` starts the built artifact on loopback and runs pinned Chromium/Axe checks for keyboard
navigation, focus entry/return/containment, selected-element/sheet geometry, external requests,
no-JavaScript fallback, and accessibility. Set `MONUMENT_CHROMIUM_PATH` to use an existing local
Chromium-compatible browser instead of the bundled Linux QA binary.

## What is real

- official `@openai/apps-sdk-ui@0.2.2` buttons, badges, inputs, textarea, switches, segmented controls, and icons;
- Monument's semantic adapter tokens and canvas-first information architecture;
- keyboard, theme, selection, panels, responsive layouts, and reduced-motion behavior.

## What is simulated

- Codex progress and result text;
- edits to the sample product;
- Timeline preview/restore;
- Evidence, Fresh Review, and release readiness.

The simulation is deliberate: production migration is blocked until the direction is approved.
