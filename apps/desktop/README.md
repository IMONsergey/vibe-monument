# Monument Desktop

> Codename. Commercial naming has not been trademark-cleared.

Monument is a product-first macOS building environment powered by OpenAI Codex. The live product and one natural-language composer are the default experience; repository, Git, runtime, protocol and verification machinery is progressively disclosed only when it is useful.

The product invariant is defined in [`docs/PRODUCT_PRINCIPLES_V2.md`](docs/PRODUCT_PRINCIPLES_V2.md).

## Product rule

> Here is my product. Tell Monument what it should become.

Monument is deliberately not an IDE with an AI sidebar. Under the hood it can use Codex threads, approvals, local runtimes, Git/worktrees and VibeOS verification, but routine users should not have to operate those mechanisms manually.

## Current alpha — 0.2.0-alpha.3

The packaged desktop app is no longer the original decorative prototype. The current production path contains real native services and a real Select → Codex vertical slice.

### Product shell

- React + TypeScript + Vite production UI;
- native macOS project picker;
- real repository/framework/package-manager/script detection;
- real Git branch/remote/change-count discovery;
- bounded real file tree with build/cache/secret exclusions;
- local SQLite project/UI restoration;
- progressive-disclosure `Under the hood` surfaces.

### Runtime

- managed local `dev`, `start`, or `preview` process;
- argv execution rather than interpolated shell commands;
- stdout/stderr streaming;
- automatic loopback preview URL discovery;
- process-group cleanup.

### Codex

- one managed `codex app-server --stdio` child;
- bidirectional JSON-RPC;
- real threads/tasks and streaming turns;
- current `turn/start` text input contract;
- active-turn interrupt;
- bounded retry for App Server saturation;
- command, file-change and granular permission approvals;
- inline `request_user_input` questions;
- safe fallback for unsupported server request types;
- Codex-managed ChatGPT login recovery;
- actual Codex binary/version diagnostics;
- installed-binary JSON Schema compatibility probe.

### Live product Select / Inspect

The native app uses a dedicated child WKWebView for the real local product preview.

- press Select or `I`;
- hover outlines a real rendered element;
- click captures bounded runtime context;
- the UI shows a small selected-element chip rather than raw DOM data;
- the next Codex turn automatically receives URL/viewport/DOM/accessibility/rect/style context;
- Monument performs a bounded deterministic source search and attaches ranked source hints;
- Codex is told to inspect candidate source before editing rather than trusting a fabricated source location;
- selection is one-turn context and is cleared after send/new task/project switch/runtime stop.

See [`docs/VISUAL_CONTEXT.md`](docs/VISUAL_CONTEXT.md).

## Native preview security boundary

- only loopback HTTP(S) preview URLs are accepted;
- top-level navigation stays on the exact starting origin (scheme + host + port);
- the inspected page does not receive broad Tauri IPC privileges;
- the inspector is injected by the native host and is never written into the user's repository;
- observed page text/DOM/styles are data, not trusted instructions.

## Run the web shell

The browser shell is useful for layout/product development. Native project/Codex/runtime/Select actions intentionally remain native-only instead of silently substituting fake product data.

```bash
cd apps/desktop
npm install
npm run dev
```

## Run the native app

```bash
cd apps/desktop
npm install
npm install --no-save @tauri-apps/cli@latest
npx tauri dev
```

The native app resolves Codex from GUI-safe macOS locations and can start Codex-managed ChatGPT login when authentication is required.

## Validate

```bash
cd apps/desktop
npm install
npm run check
npm test
npm run build

cd src-tauri
cargo test --all-targets
```

CI runs the web/type/source contract and the native Rust contract independently. The source contract also rejects production mock imports, legacy Codex payloads, broad remote preview IPC, shell-interpolated runtimes, release-version drift and broken Select→context→source-hints wiring.

## Intel release gate

`0.2.0-alpha.3` replaces the opaque combined build/publish action with an explicit pipeline:

1. validate web/protocol/native contracts;
2. build an `x86_64-apple-darwin` DMG;
3. mount the DMG;
4. locate the packaged `.app` and executable;
5. verify `x86_64` using `lipo`;
6. verify code signature and `Info.plist`;
7. calculate SHA-256;
8. publish the GitHub prerelease explicitly;
9. persist a release marker, including the failed stage when publication does not complete.

The current alpha remains ad-hoc signed and is not notarized yet.

## Current user flow

1. Launch Monument.
2. Open a real local repository.
3. Monument inspects it without running project code.
4. Explicitly start the detected local runtime.
5. Work on the real product in the central preview.
6. Give Codex a normal task through the single composer.
7. For visual edits, press `I`, click the element and describe the desired change.
8. Respond to approvals/questions inline only when Codex actually needs attention.
9. Open `Under the hood` only when files, activity, runtime output or diagnostics are useful.

## Next product gates

1. Real Git task branches/worktrees + human version history/diff ergonomics.
2. Deterministic build/test/typecheck evidence after Codex changes.
3. Preview console/runtime/network evidence and responsive viewport matrix.
4. Automatic repair loop followed by fresh-context review and ship gates.
5. Crash/session recovery hardening, Developer ID signing, notarization and signed updater.

The legacy static prototype files remain temporarily for historical regression tests, but the packaged production entrypoint is `src/main.tsx` and must never import mock product state.
