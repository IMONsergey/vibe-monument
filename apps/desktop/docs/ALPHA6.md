# Monument 0.2.0 Alpha 6 — Intel

Alpha 6 packages the current product-first Monument main for Intel Macs.

Included product gates:

- native local project + managed dev runtime;
- Codex App Server threads, streaming, approvals, inline questions and ChatGPT sign-in;
- live native WKWebView preview;
- Select / Inspect with deterministic source hints;
- Figma Make-style Version Timeline with Original, automatic checkpoints, Back/Forward, Restore, Compare, forks and safety checkpoints;
- generation-bound deterministic and Browser Evidence badges on versions;
- explicit per-project Auto checks consent;
- bounded opt-in Auto Repair with at most 2 autonomous attempts and no auto-approval;
- one-click **Fix with Monument** from current failed deterministic checks or Browser Evidence issues;
- persistent Lovable-style Prompt Queue with captured Select context, task affinity, pause/reorder/remove, restore-safe behavior and evidence-aware dequeue;
- privacy-hardened Browser Evidence and stale-generation protection.

Release target:

- architecture: `x86_64-apple-darwin`;
- runner: `macos-15-intel`;
- minimum macOS: 13.0;
- asset: `Monument-0.2.0-alpha.6-Intel-x86_64.dmg`;
- tag: `monument-v0.2.0-alpha.6-intel`.

The release pipeline must pass full web/source/protocol regressions and macOS Rust tests, then mount the DMG and verify the packaged binary is x86_64 before publication.
