# Monument Desktop Release Contract

## Problem this contract prevents

A Git tag and downloadable DMG are user-facing identities.

The same release tag must never silently begin pointing at a materially different application just because an unrelated desktop feature merged into `main`.

## Deliberate release rule

Normal feature merges do not publish a desktop release by themselves.

The Intel release workflow is triggered from `main` only when a deliberate release surface changes:

- `apps/desktop/package.json`;
- `apps/desktop/src/version.ts`;
- `apps/desktop/src-tauri/Cargo.toml`;
- `apps/desktop/src-tauri/tauri.conf.json`;
- the Intel release workflow itself.

A release can also be started explicitly with `workflow_dispatch`.

## Version invariant

These version surfaces must match exactly:

- npm package version;
- Rust package version;
- Tauri bundle version;
- UI/runtime version constant;
- release workflow version/tag/asset metadata.

CI fails on drift.

## Feature gates and releases

A major installable alpha gate intentionally bumps the version in the same PR that contains the tested feature.

Example:

```text
0.2.0-alpha.3  Select / Inspect
0.2.0-alpha.4  Browser Evidence / Auto-QA
```

After merge, the release workflow builds the exact `main` commit that contains that version bump.

## Intel release proof

A release is not marked published merely because `tauri build` returned success.

The Intel gate must:

1. validate product/source/protocol contracts;
2. run web tests/build;
3. run native Rust tests;
4. build `x86_64-apple-darwin` DMG explicitly;
5. verify the DMG exists and is non-empty;
6. mount it;
7. find the packaged `.app` and executable;
8. verify `x86_64` architecture with `lipo`;
9. verify the bundle signature and `Info.plist`;
10. calculate SHA-256;
11. publish the prerelease asset;
12. persist a machine-readable release marker.

Failure markers identify the failed stage rather than recording only `failed`.

## Signing state

Until Developer ID signing/notarization is implemented, alpha releases must state clearly that they are:

- ad-hoc signed;
- not notarized.

The release UI must not imply production-grade Apple distribution before that gate exists.

## No silent clobbering

A workflow may use `--clobber` only to recover/retry the **same tested release version**. It must not be used as a substitute for incrementing the version after product changes.

## Core invariant

> **A Monument release is a verified immutable product checkpoint, not a side effect of merging code.**
