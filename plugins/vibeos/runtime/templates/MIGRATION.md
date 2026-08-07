# Migration Plan — <title>

## Source -> target state
<exact state/schema/protocol change>

## Invariants
- <must remain true before/during/after>

## Compatibility window
<old/new coexistence, expand/contract, dual read/write, feature flag, downtime>

## Preflight
- [ ] backup/recovery path verified if applicable
- [ ] representative rehearsal complete
- [ ] volume/time estimate observed or bounded

## Execution
1. <reversible step>
2. <backfill/transition step>
3. <human-gated destructive/contract step if needed>

## Observability / progress
- <metric/query/log>

## Postflight evidence
- <counts/invariants/tests>

## Rollback / recovery
<trigger + exact recovery approach>
