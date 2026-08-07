# Evidence Policy

Completion claims must be traceable to observations that could prove them wrong.

## Evidence classes

- **Deterministic:** test/type/lint/build/migration checks with exit status.
- **Runtime:** exercised behavior, logs, console/network state, smoke flows.
- **Visual:** screenshots/reference comparisons at named viewport/state.
- **Static inspection:** diff, types, configuration, dependency graph.
- **External factual:** current primary documentation/release notes.
- **Human acceptance:** explicit approval of a subjective or irreversible choice.

## Ledger

For material work, create one bounded evidence ledger using `./bin/vibeos evidence`.

Keep failed checks. Evidence history is not a marketing report.

Every review packet should identify which acceptance criteria have direct evidence and which remain unverified.

## Claim discipline

Use:

- `VERIFIED` when direct evidence supports the claim;
- `INFERRED` when evidence supports a reasoned conclusion but not direct observation;
- `UNVERIFIED` when the necessary check was not possible;
- `BLOCKED` when a required condition/tool/permission is missing.

Never upgrade `INFERRED` or `UNVERIFIED` to `VERIFIED` because the answer sounds likely.
