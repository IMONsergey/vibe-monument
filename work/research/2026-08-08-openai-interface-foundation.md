# Research — current official OpenAI interface foundation

Date: 2026-08-08
Decision supported: determine which current OpenAI interface materials are legitimate inputs to Monument's independent design system.

## Questions

1. Which current UI packages, tokens, and patterns are officially published by OpenAI?
2. Which interface conclusions are observations rather than published contracts?
3. What can be reused legally and technically?
4. What must remain Monument-derived?

## Findings

### Finding 1 — `@openai/apps-sdk-ui` is an official, licensed source

Status: VERIFIED

- Conclusion: OpenAI publishes `openai/apps-sdk-ui`. The audited repository package is version `0.2.2` at commit `0f00143c7a639906f1621fe58e1b6be7b5bea46d`, licensed MIT.
- Evidence/source: https://github.com/openai/apps-sdk-ui, cloned and inspected 2026-08-08; official UI guidelines link to the same library.
- Freshness/date: repository head inspected 2026-08-08.
- Project implication: its primitive/semantic/component layering, system font stack, 4px spatial base, neutral surfaces, control sizing, radius ladder, focus treatment, and restrained motion are used directly in the isolated preview. Tailwind 4 stays scoped to that preview until the production migration gate.

### Finding 2 — the component library is useful but not a ChatGPT shell specification

Status: VERIFIED

- Conclusion: the package includes accessible primitives such as Button, Input, Textarea, Select, SegmentedControl, Menu, Popover, Tooltip, Badge, Alert, Switch, Checkbox, Slider, DatePicker, CodeBlock, Markdown, Avatar, Indicator, and transitions. It does not define Monument's canvas, source inspector, Timeline, Evidence, Review, or Ship IA.
- Evidence/source: package exports and source files at the commit above.
- Freshness/date: 2026-08-08.
- Project implication: use the library as a calibrated foundation reference, not as a claim that Monument is an OpenAI product or that ChatGPT's private product tokens have been recovered.

### Finding 3 — ChatKit publishes configuration contracts for AI UI

Status: VERIFIED

- Conclusion: current ChatKit supports light/dark color schemes, `pill|round|soft|sharp` radius, `compact|normal|spacious` density, typography configuration, composer placeholder/attachments/tools/models/dictation, command search, entity tags, and optional header/history regions.
- Evidence/source:
  - https://developers.openai.com/api/docs/guides/chatkit-themes
  - https://github.com/openai/chatkit-js at commit `22613848a656077a408788f028c7727e38d10449`, Apache-2.0.
- Freshness/date: official docs and repository inspected 2026-08-08.
- Project implication: composer state, density, theme, and progressive disclosure are first-class configuration axes. Monument's composer remains compact and contextual rather than becoming a second dashboard.

### Finding 4 — official fullscreen guidance supports a canvas plus persistent composer

Status: VERIFIED

- Conclusion: OpenAI's UI guidelines describe fullscreen as suitable for a rich editing canvas and keep the native composer overlaid. Thinking is shown through composer shimmer; a completed response can appear as a short ephemeral snippet that opens deeper conversation.
- Evidence/source: https://developers.openai.com/plugins/concepts/ui-guidelines (fullscreen section), accessed 2026-08-08.
- Freshness/date: 2026-08-08.
- Project implication: Monument derives a dominant live canvas, bottom composer, compact activity capsule, and optional Codex detail sheet. This is a pattern transfer, not a pixel copy.

### Finding 5 — official guidelines favor bounded actions and disclosure

Status: VERIFIED

- Conclusion: official plugin UI guidance limits inline cards to one primary plus one optional secondary action, rejects deep navigation, nested scrolling, and duplicate ChatGPT inputs, and recommends system colors with restrained brand accents.
- Evidence/source: https://developers.openai.com/plugins/concepts/ui-guidelines, accessed 2026-08-08.
- Freshness/date: 2026-08-08.
- Project implication: Monument's evidence/review/ship summaries each expose one next action. Detailed ledgers and developer data live in sheets or disclosure regions, not in permanent cards.

### Finding 6 — current Work/desktop language emphasizes outcome, progress, steering, and review

Status: VERIFIED

- Conclusion: official ChatGPT Work documentation frames substantial work as an outcome the user can follow, steer, approve, and review. Current desktop documentation frames files and outputs inside one workspace, with work mode chosen near the composer.
- Evidence/source:
  - https://learn.chatgpt.com/docs/get-started-with-work
  - https://learn.chatgpt.com/docs/app
- Freshness/date: 2026-08-08.
- Project implication: Monument exposes human task progress and approval at the point of action; it does not make protocol telemetry the primary product language.

### Finding 7 — OpenAI Sans is a provided resource but redistribution terms are unresolved

Status: UNRESOLVED

- Conclusion: official ChatKit documentation links an OpenAI Sans Variable download, but the audited documentation did not establish an explicit redistribution license for bundling it into an independent desktop product. The MIT `apps-sdk-ui` package itself uses a system sans stack rather than bundling OpenAI Sans.
- Evidence/source: https://developers.openai.com/api/docs/guides/custom-chatkit and the `apps-sdk-ui` token source, accessed 2026-08-08.
- Freshness/date: 2026-08-08.
- Project implication: do not download, copy, or bundle OpenAI Sans in this module. Use a system font stack. Legal/provenance review is required before any future font inclusion.

### Finding 8 — current product appearance is evidence, not a token contract

Status: INFERENCE

- Conclusion: official product documentation screenshots and interaction descriptions consistently show calm neutral surfaces, compact icon actions, content-first hierarchy, and composer-centered mode/context selection. Those observations do not disclose private production tokens or implementation details.
- Evidence/source: the official Work, desktop, Codex IDE, and UI guideline pages above, observed 2026-08-08.
- Freshness/date: 2026-08-08.
- Project implication: label these as `OPENAI-OBSERVED`; never attach exact color, spacing, or type claims to them.

## Conflicts / uncertainty

- `apps-sdk-ui` is explicitly for ChatGPT apps. Monument adopts it directly inside the OpenAI ecosystem through a separate preview manifest/lock, keeping Tailwind and the dependency graph outside the current desktop install/runtime boundary.
- The package declares `lodash@4.17.21` for `Slider`; npm reports an unresolved high-severity advisory for that transitive package. The preview does not import `Slider`, and a build-time source-map check proves that full `lodash` modules are absent from the static artifact. This is contained for the non-production preview, not waived for migration.
- The package's global stylesheet includes remote OpenAI-hosted KaTeX fonts even when math is unused. The isolated build strips those declarations, disables the fetch-based module-preload fallback, applies a no-connect/local-font CSP, and verifies zero external browser requests.
- OpenAI product UI changes frequently. Observations are dated and may not remain current.
- No private ChatGPT/Codex package, proprietary token dump, or unlicensed icon/font asset was used.
- The font download exists, but redistribution rights remain unresolved.

## Recommendation

Adopt `@openai/apps-sdk-ui` directly as the preview's primitive/token base. Add Monument-owned semantic aliases and canvas/editor composites above it, label product observations separately, and derive Monument-specific behavior from the source-authoritative architecture. Do not import the preview layer into the alpha runtime before approval.

## Sources

- OpenAI UI guidelines — https://developers.openai.com/plugins/concepts/ui-guidelines (accessed 2026-08-08)
- ChatKit theming — https://developers.openai.com/api/docs/guides/chatkit-themes (accessed 2026-08-08)
- Advanced ChatKit integration resources — https://developers.openai.com/api/docs/guides/custom-chatkit (accessed 2026-08-08)
- ChatGPT Work — https://learn.chatgpt.com/docs/get-started-with-work (accessed 2026-08-08)
- ChatGPT desktop app — https://learn.chatgpt.com/docs/app (accessed 2026-08-08)
- `openai/apps-sdk-ui` — https://github.com/openai/apps-sdk-ui, MIT, audited commit `0f00143c7a639906f1621fe58e1b6be7b5bea46d`
- `openai/chatkit-js` — https://github.com/openai/chatkit-js, Apache-2.0, audited commit `22613848a656077a408788f028c7727e38d10449`
