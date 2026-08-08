# Monument 0.2.0-alpha.10 — Intel Preview

This build is a product-review snapshot for Intel Macs, not a claim that the Visual Editor roadmap is complete.

## Included stack

- existing Codex/runtime/project workflow;
- Version Timeline, deterministic verification, Browser Evidence, Fresh Review and Ship Gate;
- Visual Editor Layers/canvas/Properties;
- literal CSS direct transactions;
- CSS token-aware instance/local/global editing;
- hardened static Tailwind and JSX inline-style ownership;
- source-native static JSX text and semantic content batch editing;
- Codex fallback for ambiguous/dynamic source;
- temporary user-provided application icon.

## Stabilization rules

- `npm run check:native` must include source, token, markup and content contracts;
- web and native versions must match `0.2.0-alpha.10`;
- the app icon is installed deterministically before dev/build;
- release is Intel-only: `x86_64-apple-darwin` on `macos-15-intel`;
- DMG must mount successfully and contain an x86_64 executable;
- plist and ad-hoc signature must validate;
- release workflow always uploads diagnostics and uploads the verified DMG as an Actions artifact before prerelease publication;
- no green checks means no claim that the preview is ready.

## Known scope boundaries

Dynamic JSX/class composition, rich/nested JSX text, responsive/state authoring, arbitrary component props/variants, asset replacement and multi-file/cross-engine deterministic transactions remain Codex-backed or future gates.
