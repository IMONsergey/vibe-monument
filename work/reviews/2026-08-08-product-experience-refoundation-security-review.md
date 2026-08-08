# Security Review — Monument refoundation preview

Date: 2026-08-08

Reviewer context: independent exact-candidate security review

Scope: standalone preview, dependency/build boundary, CI, and production isolation

## Final verdict

**YES — certified for a draft PR as an isolated non-production preview.**

- BLOCKER: 0
- MAJOR: 0
- MINOR: 0
- Candidate: `b2e81ebd714aa4ef6b9e568bab08493a195b9940878f710b0e8954fab069fc8a`
- Source manifest: `b9cc81bf4cb26f1d2467348ac2eefbd3b6851cfd3c2f892dc9d12df09b6cc7b1`
- Artifact manifest: `4a303a563fd5532704c648eb699ab9b0a3028b89c737f9db442aa7bd2e8fb958`

The reviewer independently recomputed all 20 preview inputs and all 9 recursive artifact files. Both retained JSON reports contain identical manifests and digests.

## Confirmed boundaries

- no preview runtime file, Tauri, invoke, Git, Codex, project-exec, persistence, or network primitive;
- no HTML injection sink, `eval`, or unsafe rendering path; prompt content remains React-escaped state;
- `connect-src 'none'`, local-only fonts, constrained script/form/object CSP, zero browser external/failed requests, and zero console errors;
- no remote font URL, runtime `fetch`, XHR, WebSocket, EventSource, beacon, or full `lodash` in the emitted artifact;
- source maps bind current authored sources, the official UI package, and no production source;
- separate preview manifest/lock; 415 registry artifacts with integrity and no non-registry resolutions;
- independently matching `@openai/apps-sdk-ui@0.2.2` tarball SHA-512;
- read-only `pull_request` workflow, no secrets, SHA-pinned actions, exact Node, and lifecycle-script-free install;
- Tailwind/Vite root, dependency graph, and output remain isolated;
- `apps/desktop/src` and `src-tauri` are byte-unchanged from base `181b5f5`.

## Findings resolved during review

The first pass found latent remote KaTeX font URLs from the official stylesheet, Vite's same-origin module-preload `fetch`, and lock/CI evidence gaps. The build now strips/rejects remote font declarations, disables the preload polyfill, enforces CSP and runtime request assertions, uses an isolated integrity-bearing lock with `npm ci --ignore-scripts`, and binds evidence to complete input/artifact manifests. The final exact pass found no remaining preview-specific severity.

## Residual risk and production blockers

- The official package declares dev-only `lodash@4.17.21`; npm reports unresolved high/moderate advisories. The preview does not import the affected package and it is absent from the artifact, but production adoption remains blocked on upstream resolution or separately reviewed replacement/patch.
- Build/QA execute pinned npm tooling and a pinned Chromium binary; the GitHub `ubuntu-24.04` runner image is rolling infrastructure.
- The inherited alpha head remains red (`TS2322` in `src/editor/contentEditing.ts:84`; 68/81 Node tests pass). These failures are unchanged and outside preview certification.

This review does not certify a production migration or release.
