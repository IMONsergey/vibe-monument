# Memory Policy

Memory must improve future correctness more than it increases stale-context risk.

## Layers

1. Stable current project truth in `context/`.
2. Immutable continuation handoffs under `work/handoffs/`.
3. Verified reusable learnings under `work/learnings/`.
4. Mature constraints encoded preferably as code/tests/types/linters/schemas; only then as durable rules/skills when procedure is the correct medium.

## Promotion pipeline

`observation -> repeat candidate -> verify -> scope -> human/benchmark acceptance -> promote -> prune source duplication`

A repeated observation is not automatically correct. Default candidate threshold is configured in `.vibeos/config.toml`.

Every promoted learning should have evidence and date volatile facts. External-world facts older than the configured volatile age are hypotheses until rechecked.

## Anti-rot

- one canonical home per fact;
- stale path checks;
- no raw conversation archives as truth;
- immutable dated handoffs instead of a rolling chronicle;
- prune superseded learnings;
- no self-modifying core rule without human approval or framework benchmark evidence.
