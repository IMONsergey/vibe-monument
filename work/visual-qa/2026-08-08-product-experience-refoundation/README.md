# Product Experience Refoundation visual evidence

This directory contains exact screenshots and automated browser/accessibility results for the standalone Contextual Orbit preview.

- `before-current-alpha-1440.png` — inherited Alpha Command Center before the module.
- `workspace-1440-light.png` — final default canvas-first state.
- `workspace-1440-working.png` — active Codex state.
- `workspace-1440-dark-complete.png` — dark/completed state.
- `workspace-1280-inspector.png` — contextual inspector.
- `workspace-1280-proof.png` — Proof/Review/Release progression.
- `workspace-1280-proof-blocked.png` — explicit blocked proof edge state.
- `workspace-1280-timeline.png` — version Timeline.
- `workspace-1280-command.png` — command palette.
- `workspace-390-inspector.png` — compact bottom-sheet behavior.
- `workspace-1280-no-js.png` — readable composed fallback with JavaScript disabled.
- `foundation-1440-light.png` — official primitives and Monument composites.
- `browser-results.json` — exact source digest, console/network, keyboard/focus, geometry, and screenshot result.
- `axe-results.json` — raw per-state accessibility results, including violation/incomplete nodes.

Reproduce from `apps/desktop/experience-preview` with `npm run build && npm run qa` after a lifecycle-script-free locked install.
