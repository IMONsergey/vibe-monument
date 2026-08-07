# Monument — Product Vision

Monument is a Codex-native development workspace designed around the product being built rather than around files.

## Product thesis

Traditional IDEs keep code at the center and add an AI chat beside it. Monument reverses that hierarchy:

1. the live product is the primary canvas;
2. work is organized as durable tasks backed by Codex threads and Git worktrees;
3. code, terminal, Git, network, tests, and VibeOS evidence appear contextually;
4. Codex remains the reasoning and execution engine;
5. VibeOS supplies routing, verification, fresh-context review, and evidence gates.

## First-class surfaces

- Projects — local repositories and trusted runtime roots.
- Tasks — Codex threads presented as units of work, not generic chats.
- Live Canvas — browser/simulator/output surface with inspect-and-edit context capture.
- Codex — streaming turns, tool execution, approvals, thread fork/resume, reasoning summaries.
- Code — source navigation and focused editor, not the default center of the product.
- Runtime — terminal, console, network, problems, processes.
- Git — branch/worktree/version comparison and changes.
- Evidence — VibeOS tests, build, browser QA, screenshots, review findings, shipping gate.

## Design principles

- Calm density: information-rich without dashboard noise.
- Product first: maximize the artifact, collapse tools until needed.
- Progressive disclosure: show the next decision, not every possible control.
- Reversible actions: branches, worktrees, forks, checkpoints, explicit destructive approvals.
- Evidence over confidence: completion state comes from checks and review, not agent prose.
- Native-feeling desktop ergonomics: keyboard-first, fluid panel resizing, macOS conventions.
- Independent identity: inspired by high-quality modern software, never cloning OpenAI proprietary UI tokens or branding.
