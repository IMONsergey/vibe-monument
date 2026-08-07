# Context Policy

Context is an attention budget, not a storage system.

## Load hierarchy

1. `AGENTS.md` kernel.
2. Current task contract and the relevant stable `context/` facts.
3. Current spec/plan/execution packet.
4. Only the skill bodies needed for this branch of work.
5. Relevant source/tests/configuration and precise runtime evidence.

## Progressive disclosure

Keep routing descriptions and pointers concise. Put branch-specific reference material behind explicit pointers. Do not duplicate the same rule across `AGENTS.md`, Codex skills, workflows, and plugin copies. `AGENTS.md` is the kernel; skills are progressive disclosure.

## Fresh-context boundaries

Use fresh context when:

- a bounded worker can execute one slice independently;
- a reviewer must avoid author confirmation bias;
- the main session has accumulated stale exploratory history;
- an epic moves to a materially different subsystem.

A context packet carries contract + relevant evidence, not the entire conversation.

## Failure signals

If output degrades, first inspect for stale, conflicting, oversized or missing context before adding more instructions.
