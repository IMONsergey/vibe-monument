# Alpha 10 Preview Candidate

Candidate head is frozen after this commit except for CI-driven fixes.

Release target:
- version: `0.2.0-alpha.10`
- architecture: `x86_64-apple-darwin`
- runner: `macos-15-intel`
- asset: `Monument-0.2.0-alpha.10-Intel-x86_64.dmg`
- signing: ad-hoc
- minimum macOS: 13.0

The candidate must pass all web/native/source/token/markup/content/release contracts, Node regressions, Vite production build, Rust all-target tests, DMG mount, x86_64 architecture verification and plist/codesign smoke checks before being called ready.
