# V1 limitations and unresolved work

VibeOS v1 is a synthesized architecture and a working portable skill/kernel template. It is **not yet a benchmark-proven universal optimum**.

## Not yet proven
- No controlled benchmark comparing VibeOS against vanilla Codex/Claude/Cursor on a fixed task suite.
- Skill trigger descriptions have not yet been statistically evaluated for false activation / missed activation across models.
- Review role separation reduces obvious self-confirmation but does not guarantee independent errors; different agents/models can share training biases.
- Browser QA requires a browser-capable host/tooling; VibeOS defines the procedure but does not bundle Playwright/Chrome DevTools itself.
- Beads, Poltergeist, Impeccable, gstack and other external tools are references/optional packs, not bundled dependencies.
- Platform adapter behavior can change over time. The canonical skill bodies are vendor-neutral; adapter docs/scripts should be rechecked against current vendor docs when platform behavior changes.

## Deliberately omitted from v1
- Hundreds of language/framework-specific skills.
- A mandatory MCP stack.
- Automatic production deployment.
- Automatic persistent cloud memory/database.
- Unsupervised permission bypass.
- A fake universal quality score.
- Hard-coded LLM/model routing.

## Best next research step
Build a VibeOS evaluation corpus of real repository tasks:
- 20 fast patches;
- 20 bugs;
- 20 medium features;
- 20 UI/visual tasks;
- 10 refactors/epics;
- 10 research-driven dependency/API changes.

For each, compare vanilla agent vs VibeOS on: task success, regressions, human interventions, tool calls, elapsed wall time, token/cost, review defects found, UI defects found, and stale-context failures. Use the evidence to remove rules/skills that do not measurably help.
