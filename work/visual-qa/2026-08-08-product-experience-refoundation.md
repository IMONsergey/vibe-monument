# Visual QA — Monument Product Experience Refoundation preview

Date: 2026-08-08
Build/ref: `agent/product-experience-refoundation-preview` based on `181b5f5`
URL/route: `http://127.0.0.1:4174/` and `/foundation.html`
Reference/design source: `apps/desktop/docs/OPENAI_DESIGN_FOUNDATION.md`, `apps/desktop/docs/PRODUCT_EXPERIENCE_REFOUNDATION.md`

## Viewports

- [x] 1440×900 desktop
- [x] 1280×800 laptop
- [x] 390×844 mobile
- [x] 1440×900 dark theme
- [x] 1440×900 full Foundation lab

## Behavior

- [x] Primary path works: select → contextual action → prompt → working → completed state
- [x] Hover/focus/active where relevant
- [x] Keyboard/focus: `Cmd/Ctrl+K`, `Escape`, `M`, `D`, `I`, `P`, `V`, `T`, palette arrows/Enter, Tab containment, focus entry and return
- [x] Working state
- [x] Idle/default state
- [x] Approval boundary state
- [x] Disabled production approval state
- [x] Completed state
- [x] Contextual inspector
- [x] Timeline disclosure
- [x] Timeline historical preview → explicit restore confirmation
- [x] Proof/Review/Release disclosure
- [x] Proof unknown and blocked edge states
- [x] Command palette
- [x] Readable no-JavaScript fallback

## Runtime

- [x] No relevant console errors
- [x] No broken/failed critical requests
- [x] No external runtime requests; only same-origin static assets observed
- [x] CSP blocks connections and remote fonts; built JS has no runtime `fetch`
- [x] No obvious layout shift/overflow at target viewports
- [x] Static preview bundle checked: 931 modules; shared client 243.89 kB / 79.16 kB gzip, workspace entry 39.58 kB / 11.67 kB gzip
- [x] Official package integration and preview contract pass
- [x] Separate locked dependency graph: every registry artifact has integrity; audited official tarball digest asserted
- [x] Exact candidate identity binds 20 preview inputs and all 9 emitted artifact files: `b2e81ebd714aa4ef6b9e568bab08493a195b9940878f710b0e8954fab069fc8a`

## Accessibility

- Initial automated audit found:
  - `CRITICAL`: hidden mobile brand text left its button unnamed;
  - `SERIOUS`: decorative art used `aria-label` without an image role;
  - `SERIOUS`: small selection/inspector/foundation labels and one official soft-success Badge missed contrast.
- Fixes:
  - explicit `aria-label="Open product map"`;
  - `role="img"` for labeled art;
  - darker semantic selection label;
  - higher-contrast small-copy roles;
  - scoped accessible override for the official soft-success semantic text;
  - explicit contrast for command keyboard hints, inactive inspector segments, Timeline/Proof edge-state copy, and compact overlay microcopy.
- Final pinned Axe 4.12.1 audit: **0 violations** in all ten tested states:
  - workspace default;
  - workspace inspector Design, Source, and Content;
  - Timeline restore confirmation;
  - Proof unknown and blocked;
  - workspace command palette;
  - mobile inspector;
  - Foundation lab.
- Raw `violations`, `incomplete`, engine, and environment nodes are retained in `axe-results.json`. Remaining `incomplete` results are only contrast cases Axe cannot calculate through gradients, pseudo-elements, or overlap; their exact targets were manually inspected in the retained screenshots.

## Visual critique

- [x] Hierarchy: the product occupies the viewport; chrome reads as locator, not dashboard.
- [x] Spacing/rhythm: 4px foundation and official controls remain consistent.
- [x] Alignment/grid: sample product, selection chrome, composer, and sheets align without permanently resizing the canvas; measured Timeline/selection and mobile inspector/selection overlap is exactly 0.
- [x] Typography: UI stays system sans; sample product owns its editorial serif identity.
- [x] Color/contrast: semantic light/dark themes; AI color is active-only; final Axe contrast is clear.
- [x] Responsive behavior: at 390px the inspector becomes one bounded bottom sheet with a clear gap above the composer.
- [x] Component consistency: official Buttons, Badges, Inputs, Textarea, Switch, SegmentedControl, and Icons render directly.
- [x] Content/copy density: default canvas is quiet; technical facts are behind Source/Details disclosure.
- [x] Motion/micro-interaction: entry/move feedback is restrained; AI perimeter exists only while working; reduced-motion disables travel.
- [x] Generic AI/SaaS visual patterns avoided: no card dashboard at rest, no permanent purple shell, no decorative idle glow.

## Evidence

| View/state | Before | After/final | Notes |
|---|---|---|---|
| 1440×900 default | `2026-08-08-product-experience-refoundation/before-current-alpha-1440.png` | `2026-08-08-product-experience-refoundation/workspace-1440-light.png` | Existing Command Center hides the product; new default makes the live product dominant |
| AI working | — | `2026-08-08-product-experience-refoundation/workspace-1440-working.png` | Active-only perimeter and compact progress capsule |
| Dark/completed | — | `2026-08-08-product-experience-refoundation/workspace-1440-dark-complete.png` | Same semantic component system; sample product remains its own light artifact |
| 1280 inspector | — | `2026-08-08-product-experience-refoundation/workspace-1280-inspector.png` | Overlay does not permanently shrink the canvas; selected element stays visible |
| 1280 Proof | — | `2026-08-08-product-experience-refoundation/workspace-1280-proof.png` | Checks → browser proof → Fresh Review → release readiness in one causal sheet |
| 1280 Proof blocked | — | `2026-08-08-product-experience-refoundation/workspace-1280-proof-blocked.png` | Explicit blocked browser-proof state and retry path |
| 1280 Timeline | — | `2026-08-08-product-experience-refoundation/workspace-1280-timeline.png` | Preview and restore language are distinct; selected heading remains fully visible |
| 1280 commands | — | `2026-08-08-product-experience-refoundation/workspace-1280-command.png` | Every hidden surface remains discoverable and arrow-navigable |
| 390 inspector | — | `2026-08-08-product-experience-refoundation/workspace-390-inspector.png` | One scroll-bounded sheet, composer preserved, measured selected-element overlap 0 |
| No JavaScript | — | `2026-08-08-product-experience-refoundation/workspace-1280-no-js.png` | Composed product and concept label remain readable |
| Foundation | — | `2026-08-08-product-experience-refoundation/foundation-1440-light.png` | Official primitives and Monument composites shown separately |

## Findings

- BLOCKER: none for the standalone preview.
- Fresh Product Review initially found selection/sheet collision, keyboard/focus mismatch, inert controls, missing Proof/Timeline edge behavior, a blank no-JavaScript state, and later edge-state contrast gaps. All findings were fixed and independently re-tested. Final exact-candidate verdict: **YES for draft PR; 0 BLOCKER / 0 MAJOR / 0 MINOR**.
- Fresh Security Review initially found a boundary mismatch from latent remote KaTeX URLs and Vite's preload `fetch`, then a partial evidence digest. The build now strips/rejects remote font URLs, removes the polyfill, enforces CSP, proves zero external requests, and hashes the complete preview input/artifact manifests. Final exact-candidate verdict: **YES for draft PR; 0 BLOCKER / 0 MAJOR / 0 MINOR**.
- Full `npm audit` retains upstream high/moderate advisories for dev-only, unused `lodash@4.17.21` declared by the official package. It is absent from the source maps and static bundle; `npm audit --omit=dev` reports 0. This remains a production-migration blocker, not a hidden green claim.
- Production source transactions, native proof, and release approval remain intentionally out of scope and visibly simulated.

Final exact identity:

- source manifest: `b9cc81bf4cb26f1d2467348ac2eefbd3b6851cfd3c2f892dc9d12df09b6cc7b1`;
- emitted artifact manifest: `4a303a563fd5532704c648eb699ab9b0a3028b89c737f9db442aa7bd2e8fb958`;
- complete candidate: `b2e81ebd714aa4ef6b9e568bab08493a195b9940878f710b0e8954fab069fc8a`.
