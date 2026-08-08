# OpenAI Design Foundation audit for Monument

Status: research-backed foundation, not a claim of OpenAI affiliation
Audit date: 2026-08-08
Applies to: Product Experience Refoundation preview gate

## 1. Classification contract

Every design input in this module belongs to exactly one category.

| Category | Meaning | Permitted claim |
|---|---|---|
| `OPENAI-PUBLISHED` | An official public document, repository, package, or explicit API contract | Exact documented behavior/value may be cited with source and date |
| `OPENAI-OBSERVED` | A behavior or visual tendency visible in current official product materials, but not published as a reusable contract | Qualitative observation only; no invented token or implementation claim |
| `MONUMENT-DERIVED` | A decision made for Monument from its product, safety, and platform constraints | Owned by Monument; OpenAI must not be presented as its author |

The preview is not a ChatGPT clone. It uses current public OpenAI materials to calibrate restraint, hierarchy, and AI interaction, then derives an editor architecture for Monument.

## 2. Audited source register

| Source | Category | Version / date | License / terms established | Use in this module |
|---|---|---|---|---|
| `openai/apps-sdk-ui` | `OPENAI-PUBLISHED` | package `0.2.2`, commit `0f00143c…`, audited 2026-08-08 | MIT | Direct preview dependency and base primitive/token layer |
| `openai/chatkit-js` | `OPENAI-PUBLISHED` | commit `22613848…`, audited 2026-08-08 | Apache-2.0 | Reference for theme/density/radius/composer configuration and AI UI state |
| OpenAI plugin UI guidelines | `OPENAI-PUBLISHED` | accessed 2026-08-08 | Public documentation; no package copied | Reference for fullscreen canvas + composer, bounded actions, progressive disclosure |
| ChatKit theming guide | `OPENAI-PUBLISHED` | accessed 2026-08-08 | Public documentation; no package copied | Reference for light/dark, density, radius, type, composer/tools |
| ChatGPT Work and desktop docs | `OPENAI-PUBLISHED` for text/behavior; screenshots treated as `OPENAI-OBSERVED` | accessed 2026-08-08 | Public documentation; images not copied | Reference for outcome/progress/steering/review and one-workspace mental model |
| OpenAI Sans Variable download | `OPENAI-PUBLISHED` resource link | accessed 2026-08-08 | Redistribution license not established in audited docs | Not downloaded, copied, or bundled |
| Monument canvas/editor model | `MONUMENT-DERIVED` | this decision | Monument repository | Contextual Orbit IA, selection/property behavior, proof/timeline/ship disclosure |

Primary links:

- https://developers.openai.com/plugins/concepts/ui-guidelines
- https://developers.openai.com/api/docs/guides/chatkit-themes
- https://developers.openai.com/api/docs/guides/custom-chatkit
- https://learn.chatgpt.com/docs/get-started-with-work
- https://learn.chatgpt.com/docs/app
- https://github.com/openai/apps-sdk-ui
- https://github.com/openai/chatkit-js

## 3. `OPENAI-PUBLISHED` foundation

### 3.1 Token architecture

`apps-sdk-ui` publicly separates primitive, semantic, and component variables. Monument adopts that separation, not the OpenAI token namespace:

1. **Foundation** — literal neutral/accent colors, 4px spatial base, type sizes, radii, shadows, motion durations/easings.
2. **Semantic** — canvas, surface, foreground, border, focus, selection, status, and AI-state roles for light and dark themes.
3. **Component** — composer, toolbar, inspector, menu, sheet, button, field, and selection geometry.

The machine-readable source is `experience-preview/tokens/monument.tokens.json`; CSS delivery is `experience-preview/tokens/tokens.css`.

### 3.2 Published calibration points

The audited `apps-sdk-ui` source provides these usable calibration points:

- 4px base spacing;
- neutral light/dark semantic surfaces and borders;
- system UI sans stack;
- weight ladder 400 / 500 / 600 / 700;
- radius ladder from 2px through 24px and full;
- control heights from 22px through 48px;
- 150ms basic motion with distinct enter/exit/move curves;
- elevated composer semantics with a 24px radius;
- 12px menu/popover radius;
- accessible focus and component primitives.

These values directly power the preview through the package. Monument adds semantic aliases and canvas/editor composites without claiming that private ChatGPT desktop tokens are identical.

### 3.3 Published AI interaction patterns

OpenAI's fullscreen UI guidance explicitly supports a rich editing canvas with the composer overlaid. During thinking, composer treatment can animate; completion may surface as a short transient result that opens deeper conversation. ChatKit exposes density, theme, radius, tools, models, entities, attachments, commands, and optional header/history.

Monument applies this as:

- a compact bottom composer that stays in the canvas context;
- a restrained active-only AI stroke and progress capsule;
- completed work summarized in one line, with details on demand;
- source/protocol telemetry hidden until the user asks for it.

### 3.4 Published disclosure rules

OpenAI's plugin guidelines reject deep navigation, nested scroll, duplicate inputs, and more than one primary plus one optional secondary action in lightweight cards. Monument extends that discipline to system summaries:

- Proof summary: status + one next action;
- Review summary: findings + one resolve action;
- Ship summary: readiness + one prepare action;
- technical ledgers: secondary disclosure, never the default canvas surface.

## 4. `OPENAI-OBSERVED` notes

These observations come from current official product pages and screenshots. They are dated, qualitative, and non-normative.

- Neutral surfaces and thin spatial separation are more common than saturated chrome.
- Compact icon actions defer to the artifact/content.
- Composer-adjacent controls carry mode and work context.
- Long-running work exposes progress and steering without turning the entire workspace into a telemetry dashboard.
- Review often appears beside the affected output rather than in a separate admin center.

No exact colors, dimensions, fonts, private components, or implementation packages are inferred from these observations.

## 5. `MONUMENT-DERIVED` system

### 5.1 Product identity

Monument's defining visual object is the live product under construction. The product is not framed by a permanent IDE clone. Selection, prompt, proof, and time orbit the product and appear only when relevant.

The visual identity is calm graphite/porcelain with a small mineral-blue accent. A multi-hue AI aura exists only during active Codex work. Gradients are reserved for the sample product content and the active AI perimeter, not generic app chrome.

### 5.2 Type

The preview uses:

```css
ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

Monospace is limited to source facts and shortcuts. OpenAI Sans is not bundled because redistribution terms were not established. Monument does not need a proprietary font to achieve hierarchy.

### 5.3 Icons

The preview uses local inline SVG geometry with `currentColor`, consistent 1.75px strokes, rounded line caps, and accessible button names. It does not use random Unicode symbols, copied product assets, external icon requests, or an invented OpenAI package.

Before production migration, Monument should choose either:

- a small audited local icon set under a compatible license; or
- a project-owned SVG set maintained as typed React primitives.

### 5.4 Color and theme

Components consume semantic roles only. Theme changes remap roles and do not fork component CSS. Status colors never carry meaning alone; icon, label, and state text accompany them. AI accent is absent when idle.

### 5.5 Density and layout

- Default control target: 36px; compact canvas toolbar: 32px.
- Minimum pointer target in compact desktop chrome: 32px; primary actions: 36–40px.
- Default spacing follows 4px increments.
- The workspace uses one dominant scroll context; sheets own their own bounded content only when open.
- Canvas padding is responsive and inspector sheets overlay rather than permanently shrinking the product.

### 5.6 Radius and depth

- Small controls: 8–10px.
- Menus/popovers: 12–14px.
- Composer and large sheets: 18–24px.
- Shadows communicate elevation only for floating composer, menus, sheets, and selection tooling.
- Persistent borders and card-on-card stacks are intentionally minimized.

### 5.7 Motion

| Role | Duration | Behavior |
|---|---:|---|
| control feedback | 120ms | color/opacity only |
| popover/sheet enter | 180ms | fade + 4–8px move |
| layout move | 220ms | restrained transform |
| AI working | stateful | low-amplitude perimeter travel, never full-screen ambient glow |

`prefers-reduced-motion: reduce` removes travel, shimmer, smooth scrolling, and nonessential transforms.

### 5.8 Accessibility contract

- Visible `:focus-visible` ring on every interactive primitive.
- Escape closes the topmost transient surface.
- `Cmd/Ctrl+K` opens the command palette.
- Selection and system state are announced through a polite live region.
- Dialogs/sheets have labels; inspector content remains reachable without pointer input.
- No status is expressed only by color.
- Compact mobile state preserves the canvas/composer path and permits one sheet at a time.
- Production migration requires semantic focus trapping and automated accessibility testing; the static preview provides the architecture and keyboard proof, not final compliance certification.

## 6. Adoption decision

`@openai/apps-sdk-ui@0.2.2` is adopted directly for the isolated preview. The preview imports its official CSS, Tailwind source, Buttons, Badges, Inputs, Textarea, Switch, SegmentedControl, and Icon components. Monument owns only the semantic adapter and product-specific composites above that base.

The package is intentionally not imported by `src/main.tsx` yet. This preserves the requested preview-before-migration gate while making the prototype representative of the intended OpenAI ecosystem integration rather than a visual imitation.

The isolated preview owns a separate package manifest and lock. The official UI package is a pinned `devDependency` of that build-only project; the existing desktop install graph, runtime, and release bundle neither import nor install it. All registry artifacts in the preview lock carry integrity digests, the audited OpenAI tarball SHA-512 is asserted, lifecycle scripts are disabled, and the static build verifies its source-map module graph.

As of this audit, the package declares `lodash@4.17.21` for `Slider`; npm reports an unresolved high-severity advisory for that transitive version. Monument does not import `Slider`, and the full `lodash` package is absent from the built preview. `lodash.debounce`, a separately packaged dependency used by an imported primitive, is present and is not the package named by that advisory. The package's global CSS also publishes remote KaTeX font URLs; the preview does not render math, strips those unused font declarations from the build, disables Vite's fetch-based module-preload fallback, and enforces `connect-src 'none'` plus local-only fonts. This containment is acceptable for the isolated non-production preview, but the unresolved upstream advisory is an explicit production-migration blocker rather than a green dependency claim.

After approval, the production migration spec will decide how to share the Tailwind 4 layer with the Tauri application without creating parallel global style authorities. Direct adoption is the default direction; isolation and bundle evidence remain implementation work, not permission blockers.

## 7. Production migration gate

Production code must not consume these tokens or preview components until all are true:

1. Sergey approves the canvas-first architecture from the interactive preview.
2. A migration spec maps existing product states and safety contracts to production components.
3. One vertical slice proves source selection → contextual edit → Timeline → Evidence → Fresh Review on Intel.
4. The old shell is removed in bounded steps; no fourth overlay shell is added.
5. Exact-head TypeScript, Node, Vite, Rust, accessibility, visual, and Intel x86_64 gates are green.
6. The official UI dependency graph has no unresolved high/critical production advisory, or an approved replacement/patch removes the affected code path and is independently reviewed.
