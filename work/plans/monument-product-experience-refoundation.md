# Plan — Monument Product Experience Refoundation, preview gate

Spec: `work/specs/monument-product-experience-refoundation.md`
Date: 2026-08-08

## Strategy

Separate product discovery from production migration. First freeze the evidence and architecture contract, then build an isolated static experience on the pinned official UI package that can be inspected without Tauri/Codex setup. Prove its structure, dependency boundary, accessibility basics, interactions, and visual states independently. Only after product approval should the chosen architecture be decomposed into production React slices.

## Dependency graph

- Slice 1 → Slice 2
- Slice 2 → Slice 3
- Slice 3 → Slice 4
- Slice 4 → Slice 5
- Product approval → future production migration (not part of this plan)

## Slices

### Slice 1 — source-of-truth and design provenance

- Goal: establish the active code/PR base, inherited failures, protected contracts, and legitimate OpenAI inputs.
- Files/interfaces likely touched: `work/research/*`, `apps/desktop/docs/OPENAI_DESIGN_FOUNDATION.md`.
- Existing pattern to follow: research template and provenance categories.
- Constraints: official sources only for OpenAI claims; do not present observations as tokens.
- Acceptance checks: every external claim has URL/date/category; licenses and unresolved assets are explicit.
- Validation commands: Markdown link/path review; repository/GitHub re-check before PR.
- Out of scope: dependency adoption.
- Rollback/checkpoint: research-only commit can stand independently.

### Slice 2 — architecture decision and interaction contract

- Goal: teardown current IA, compare three workspace hypotheses, choose one, and map complete user journeys.
- Files/interfaces likely touched: `apps/desktop/docs/PRODUCT_EXPERIENCE_REFOUNDATION.md`, spec.
- Existing pattern to follow: current product safety documents; no second source model.
- Constraints: canvas dominant; composer compact; panels contextual; proof progressive.
- Acceptance checks: alternatives are materially different; chosen tradeoffs and non-goals are explicit.
- Validation commands: manual architecture review against product principles and safety contracts.
- Out of scope: production component replacement.
- Rollback/checkpoint: decision record can be revised without code migration.

### Slice 3 — tokens and core primitives

- Goal: integrate the audited official package, then create machine-readable Monument semantic/component adapters and reusable preview composites.
- Files/interfaces likely touched: `apps/desktop/experience-preview/package.json`, lock, `tokens/*`, `components.css`, `foundation.html`.
- Existing pattern to follow: direct `@openai/apps-sdk-ui` primitives and published layer separation, with Monument-specific semantic naming above them.
- Constraints: system fonts; local SVG only; light/dark and reduced-motion from one source.
- Acceptance checks: token JSON parses; CSS variables resolve; focus and disabled states exist.
- Validation commands: isolated `npm run check`, `npm run build`, and source-map/network bundle contract.
- Out of scope: importing the preview or Tailwind layer into the production entry point.
- Rollback/checkpoint: preview directory is isolated and deletable without runtime impact.

### Slice 4 — interactive canvas-first preview

- Goal: make the chosen Contextual Orbit hypothesis tangible across selection, Codex, Timeline, Proof/Review/Ship, command palette, theme, and responsive states.
- Files/interfaces likely touched: `experience-preview/index.html`, `src/App.tsx`, `src/workspace.css`, `src/components.css`, and `qa-preview.mjs`.
- Existing pattern to follow: current domain contracts, but translate system detail into user language.
- Constraints: static simulation; no project writes/network; one active sheet; canvas never duplicated.
- Acceptance checks: primary flows work by pointer and keyboard at target viewports.
- Validation commands: reproducible pinned Chromium/Axe harness covering static server, requests, geometry, keyboard/focus, screenshots, no-JavaScript, and accessibility.
- Out of scope: native integration.
- Rollback/checkpoint: keep production imports untouched.

### Slice 5 — evidence, independent review, and draft PR

- Goal: retain validation output, visual QA, security review, fresh-context review, and publish a stacked draft PR.
- Files/interfaces likely touched: `work/visual-qa/*`, `work/reviews/*`, `evidence/*`, workflow, PR metadata.
- Existing pattern to follow: VibeOS evidence ledger, fresh review, security review, draft publication.
- Constraints: no green claim for inherited alpha failures; exact head must be named.
- Acceptance checks: preview contract green; screenshots reviewed; production runtime diff absent; PR targets #47 head branch.
- Validation commands: evidence verification, `git diff`, GitHub checks/PR metadata.
- Out of scope: merge or production migration.
- Rollback/checkpoint: draft PR can be closed without affecting active alpha.

## Integration checks

- Preview contract and locked build pass after lifecycle-script-free dependency installation.
- Built source-map provenance proves that the advised full `lodash` package is absent from the static artifact.
- Static preview serves without external requests or console errors.
- Light/dark and target viewport screenshots are inspected.
- `git diff -- apps/desktop/src apps/desktop/src-tauri` shows no production changes.
- Exact inherited baseline failures are retained separately.
- Fresh independent reviewer certifies the final diff and evidence.
- Security review confirms no privileged/network boundary change.

Final standalone candidate: `b2e81ebd714aa4ef6b9e568bab08493a195b9940878f710b0e8954fab069fc8a`; Product Experience and Security reviews both certify it for a draft PR with 0 BLOCKER / 0 MAJOR / 0 MINOR. Production migration remains a separate future plan.

## Risks

- A visually convincing preview may be mistaken for integrated functionality; every artifact must label simulated states.
- OpenAI visual mimicry could weaken Monument's identity; source categories and Monument-derived decisions must remain visible.
- The stacked base can move; rebase/retarget must be explicit, never forced.
- Dense proof data can creep back into the default UI; progressive-disclosure rules need production contract tests later.
