# V2 decision: Codex only

Date: 2026-08-07

VibeOS 2 targets OpenAI Codex exclusively. Cross-agent compatibility was removed before the full repository release.

Reasons:
- one runtime means fewer lowest-common-denominator compromises;
- `AGENTS.md`, Codex Agent Skills and Codex plugins can be treated as first-class contracts instead of adapters;
- the repository can mirror the official `openai/plugins` marketplace layout;
- sandbox/approval and plugin behavior can be tested against one concrete platform;
- benchmark results become easier to interpret because harness behavior is no longer a hidden variable.

Research notes may still discuss workflows created by users of other coding agents. Those notes are sources of engineering ideas only; they are not supported VibeOS execution surfaces.
