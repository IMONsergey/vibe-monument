---
name: migration-safety
description: "Design and verify data/schema/state migrations with rollback, compatibility, and production-safety gates. Use for database migrations, irreversible transformations, protocol/state format changes, or any change where old and new versions may coexist."
---

# Migration safety

1. Define source state, target state, invariants, affected volume, and acceptable downtime.
2. Decide compatibility strategy: expand/contract, dual-read/write, backfill, feature gate, or explicit maintenance window.
3. Make destructive steps separate and human-gated.
4. Provide preflight checks, migration command, progress/observability signals, postflight validation, and rollback/recovery procedure.
5. Test on representative data or a disposable environment before production.
6. Verify idempotence/restart behavior for long-running migrations where possible.
7. Check old/new application-version coexistence if rollout can overlap.
8. Record evidence for counts/invariants before and after.

Never hide irreversible work inside a normal feature slice.
