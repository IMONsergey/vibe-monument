# Spec — Monument Product Experience Refoundation, preview gate

Status: IMPLEMENTED — standalone preview gate; production migration blocked
Owner: Monument / Sergey
Date: 2026-08-08

## Problem / outcome

The current interface exposes three overlapping product shells and makes internal process more prominent than the product being built. This module must produce a credible, testable alternative in which the live product is the interface, while preserving Monument's source-authoritative safety model. The outcome is an interactive standalone preview and a reviewable design foundation—not a production migration.

## Scope

### MUST

- Audit the active GitHub stack, current runtime, design documents, CI, Intel release path, and superseded work.
- Audit current official OpenAI-published UI materials and distinguish `OPENAI-PUBLISHED`, `OPENAI-OBSERVED`, and `MONUMENT-DERIVED` decisions.
- Define an independent light/dark semantic token architecture with machine-readable source.
- Define core interface primitives with keyboard focus, reduced-motion, and accessible labels.
- Compare three materially different workspace architectures and choose one with explicit tradeoffs.
- Build a standalone interactive preview directly on the official `@openai/apps-sdk-ui` package, where the canvas dominates and technical detail is progressively disclosed.
- Demonstrate selection, contextual properties, composer idle/active/completed states, Timeline, Evidence/Review/Ship disclosure, command palette, light/dark, responsive behavior, and keyboard operation.
- Add a deterministic preview contract/type/build check and isolated CI job.
- Preserve the production React/Tauri runtime unchanged.
- Publish the work on a separate GitHub branch and open a draft PR against the actual active stack head.

### SHOULD

- Provide a primitive/foundation lab beside the workspace preview.
- Capture visual evidence at desktop, laptop, and compact widths.
- Make technical source details available without making them the default language.
- Keep all simulated behavior explicitly labeled as concept behavior.

### MAY

- Add further non-production preview states after product review.
- Retarget the draft PR after the stacked alpha chain is merged.

### OUT OF SCOPE

- Replacing `App`, `VisualEditorLayer`, or `AlphaPreviewShell` in production.
- Changing Tauri commands, ACLs, source transaction code, Codex protocol, Timeline persistence, evidence semantics, or Intel packaging.
- Adding OpenAI Sans, copied private tokens, undocumented packages, or unrelated third-party assets.
- Closing, merging, rebasing, deleting, or force-updating existing branches/PRs.
- Fixing unrelated inherited alpha test failures.

## Acceptance criteria

- [x] A dated research artifact records the active PR DAG, current head, superseded candidates, CI state, and inherited baseline failures.
- [x] `OPENAI_DESIGN_FOUNDATION.md` records source category, provenance, license, technical fit, uncertainty, and explicit non-use decisions.
- [x] A machine-readable token file contains foundation, semantic light/dark, and component layers.
- [x] Every CSS custom property used by the standalone preview resolves in its token/component styles.
- [x] The preview launches through its isolated Vite entry and builds to static HTML/assets; authored/final JS has no application network API, CSP blocks connections, and browser QA observes only same-origin static assets.
- [x] The canvas remains the dominant surface at 1440×900 and 1280×800.
- [x] Properties appear contextually and can be dismissed without losing selection.
- [x] Codex activity is quiet at rest, visible during simulated work, and collapsible into details.
- [x] Timeline, Proof, Review, and Ship are absent from the default canvas chrome and available through explicit disclosure.
- [x] Light and dark themes share semantic tokens rather than duplicated component styles.
- [x] Interactive controls have accessible names, visible `:focus-visible`, Escape behavior, and reduced-motion support.
- [x] At 390×844, panels become bounded sheets and the primary canvas/composer path remains usable.
- [x] The official package is pinned to the audited version; preview type/contract/build checks pass in a path-scoped GitHub Actions job.
- [x] `apps/desktop/src/main.tsx` and production runtime files are unchanged by this module.
- [ ] A draft PR targets `monument/alpha-preview-intel`; no production migration is presented as complete.

## States / edge cases

- Nothing selected: no inspector; composer and canvas remain available.
- Selected element: selection frame, contextual toolbar, and optional inspector.
- Codex idle / working / completed / needs approval: restrained visual differentiation; no ambient glow while idle.
- Proof unknown / checking / ready / blocked: plain-language summary first, technical ledger second.
- Timeline current / historical preview / restore confirmation: restore remains an explicit action.
- Narrow screen: one modal sheet at a time; no nested page scroll inside the canvas.
- Reduced motion: transitions and shimmer are disabled or reduced.
- JavaScript disabled: the composed workspace remains readable, with a clear concept-preview label.

## Constraints

- Source remains authoritative; the preview simulates UI state only and does not write files.
- Remote preview safety, generation identity, evidence freshness, Fresh Review, and Ship gates remain unchanged.
- Intel x86_64 remains a first-class production gate.
- The official UI package is added only to the isolated preview manifest/lock and is not installed or imported by the alpha runtime.
- All new icons are local SVG geometry with no external asset dependency.

## Assumptions

- `ASSUMED` — PR #47 remains the correct integration base until the active stack is merged — verify immediately before retarget/merge.
- `ASSUMED` — a static concept preview is sufficient for the product-approval gate — verify through Sergey’s review before production planning.
- `ASSUMED` — English UI copy is acceptable for the architectural prototype because the existing product is English — confirm before production localization work.

## Blockers

- `BLOCKED` — production migration awaits explicit approval of the interactive preview — owner: Sergey.
- `BLOCKED` — OpenAI Sans redistribution terms are not established — owner: legal/provenance review if the font is ever proposed.
- `BLOCKED` — inherited alpha head has local TypeScript/build and contract-test failures — owner: active alpha stack, outside this module.
- `BLOCKED` — `@openai/apps-sdk-ui@0.2.2` declares an unresolved advised `lodash@4.17.21`; the unused code is excluded from this preview bundle, but production adoption requires an upstream resolution or independently reviewed patch/replacement — owner: production migration.

## Source context

- `work/research/2026-08-08-monument-current-state-audit.md`
- `work/research/2026-08-08-openai-interface-foundation.md`
- `apps/desktop/docs/MASTER_PRODUCT_CONTEXT.md`
- `apps/desktop/docs/OPENAI_DESIGN_FOUNDATION.md`
- `apps/desktop/docs/PRODUCT_EXPERIENCE_REFOUNDATION.md`
