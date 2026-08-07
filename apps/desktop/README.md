# Monument Desktop

> Codename. Commercial naming has not been trademark-cleared.

Monument is a product-first development workspace powered by OpenAI Codex. The live artifact is the center of the experience; code, terminal, Git, runtime diagnostics, and VibeOS evidence appear when they are useful rather than occupying the screen by default.

This directory currently contains the **interactive alpha shell plus the Codex host contract**. It is intentionally dependency-free so the product experience can be iterated and smoke-tested in constrained environments before the native Tauri wrapper is introduced.

## Run the prototype

```bash
cd apps/desktop
npm run dev
```

Then open `http://localhost:4173`.

## Validate

```bash
npm run check
npm test
npm run build
python3 scripts/ui_smoke.py  # optional; needs Playwright + Chromium
```

## Current interaction model

- Tasks / Files navigation
- Preview / Code workspace
- Desktop / mobile preview sizing
- Inspect mode (`I`) with element → Codex composer handoff
- Command palette (`⌘K`)
- Runtime drawer (`⌘J`) with Terminal / Problems / Console / Network / Git / Evidence
- Codex plan, activity, review findings, composer
- VibeOS evidence presentation
- managed stdio Codex transport contract tested against a fake app-server

## Architecture

See:

- `docs/PRODUCT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/CODEX_INTEGRATION.md`
- `docs/NATIVE_BOUNDARY.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/USER_FLOWS.md`
- `docs/ROADMAP.md`

## Important boundary

Monument does not implement its own coding agent. The production app is designed as a client of the official `codex app-server` JSON-RPC interface and keeps Codex responsible for threads, turns, tools, sandboxing, approvals, and agent execution.

## Native M1 source

`src-tauri/` now contains the first Tauri 2 macOS host boundary. It starts one managed `codex app-server --stdio` process, emits Codex JSON-RPC messages into the frontend, and exposes only bounded runtime commands (`start`, `send`, `status`, `stop`). The browser build uses an in-memory demo transport through the same `CodexAppServerClient`, so product work remains executable before the native toolchain is available.

The current build environment does not contain `rustc`/`cargo`, so Rust compilation is not claimed yet. `npm run check` validates the native source/config contract and all JavaScript protocol/host tests run in CI.
