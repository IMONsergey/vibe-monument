# Monument build roadmap

## M0 — Product shell (current)
- commercial-neutral design system
- project/task navigation
- live preview surface
- Codex activity/composer surface
- code mode
- runtime bottom panel
- VibeOS evidence UI

## M1 — Native Codex connection
- Tauri 2 shell
- managed `codex app-server`
- initialize handshake
- ChatGPT login state
- real thread list/read/resume/fork
- streamed turns/items
- approval cards

## M2 — Real project runtime
- open repository
- trusted workspace roots
- Git branch/worktree manager
- PTY terminals
- dev-server detection/start/stop
- real preview URL
- file tree/editor

## M3 — Visual development
- inspect element in live preview
- DOM/computed-style/source context packet
- screenshot annotations
- viewport/state matrix
- console/network capture
- visual reference attachments

## M4 — VibeOS productization
- task routing UI
- evidence ledger in product
- fresh-context review workflow
- ship gates
- benchmark telemetry (opt-in/local)

## M5 — Commercial-grade polish
- updater/signing/notarization
- crash recovery/session restoration
- encrypted local state
- onboarding
- plugin/skill management
- accessibility/keyboard audit
- performance budget

## Current M1 implementation status

Implemented in source:
- Tauri 2 project/config/capability skeleton;
- managed Codex stdio runtime commands (`start/send/status/stop`);
- Rust → frontend JSON-RPC event bridge;
- dependency-free Tauri global frontend adapter;
- browser demo transport using the exact same `CodexAppServerClient` contract;
- live connection/session state in the product shell;
- 5 host/protocol tests plus UI smoke coverage.

Still requires a macOS build machine with Rust/Tauri toolchain for the first native binary compilation, signing, and WKWebView verification. The current CI environment intentionally does not claim a Rust compile because `rustc`/`cargo` are absent.
