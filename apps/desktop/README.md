# Monument Desktop

> Codename. Commercial naming has not been trademark-cleared.

Monument is a product-first macOS building environment powered by OpenAI Codex. The live artifact and a natural-language composer are the default experience; repository, Git, runtime and evidence machinery is progressively disclosed only when it is useful.

The production direction is defined in [`docs/PRODUCT_PRINCIPLES_V2.md`](docs/PRODUCT_PRINCIPLES_V2.md).

## Product rule

> Here is my product. Tell Monument what it should become.

Monument is deliberately not an IDE with an AI sidebar. The engine may use Codex threads, Git/worktrees, process supervision and VibeOS verification, but routine users should not have to operate those mechanisms manually.

## 0.2 product foundation

The current production branch introduces the first real vertical slice:

- React + TypeScript + Vite production shell;
- native macOS project picker;
- real repository/framework/package-manager/script detection;
- real Git branch/remote/change-count detection;
- bounded real file tree (secrets and build/cache directories excluded);
- managed local dev-server runtime with stdout/stderr streaming;
- automatic localhost preview URL detection;
- real live product iframe with desktop/mobile viewports;
- native-only packaged Codex transport;
- bidirectional App Server request awareness;
- real Codex thread/task list and streamed agent message projection;
- local SQLite app-state persistence;
- explicit `Under the hood` activity/files/runtime surface;
- CI guard forbidding production imports of prototype mock data.

The legacy static prototype files remain temporarily for historical regression tests, but the packaged production entrypoint is `src/main.tsx` and must not import them.

## Run the web shell

The browser shell is useful for visual development, but native project/Codex/runtime actions intentionally report unavailable outside Tauri rather than silently substituting fake product data.

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

The native app expects an installed and authenticated Codex CLI. The host resolves Codex from GUI-safe macOS locations rather than assuming a login-shell PATH.

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

CI runs the web/type contract on Linux and the native Rust contract on macOS.

## Current product flow

1. Launch Monument.
2. Open a real local repository.
3. Monument inspects project metadata without executing project code.
4. Start the detected `dev`, `start`, or `preview` script explicitly.
5. Monument supervises the process and discovers the local preview URL.
6. Work on the real live product from the central canvas.
7. Use the single composer to create/continue real Codex tasks.
8. Open `Under the hood` only when activity, files or runtime output is useful.

## Important safety boundaries

- opening a folder does not run package scripts;
- production UI does not invent success/test/evidence states;
- project scripts are launched as bounded argv commands, not interpolated through `sh -c`;
- environment files and common build/cache directories are excluded from the product file tree;
- Codex sandbox/approval semantics remain authoritative;
- server approval/request shapes are detected but not guessed before generated protocol bindings are installed;
- Codex conversation history remains owned by Codex; Monument persists only local app/project linkage and UI state.

## Next gates

1. Generated exact Codex App Server protocol + real approval UI.
2. Instrumented preview Select/Inspect mode with DOM/style/source/screenshot context.
3. Git task branches/worktrees + real diff/history ergonomics.
4. Deterministic build/test/browser evidence, VibeOS review and repair loops.
5. Crash recovery, signing/notarization and signed updates.

See [`docs/PRODUCT_PRINCIPLES_V2.md`](docs/PRODUCT_PRINCIPLES_V2.md) for the invariant product model and the existing architecture documents for the deeper runtime design.
