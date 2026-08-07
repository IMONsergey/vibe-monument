---
name: evidence-ledger
description: "Create and maintain a machine-readable ledger of verification evidence for a change. Use when work has multiple quality gates, when certification happens in fresh context, or when completion claims must be auditable."
---

# Evidence ledger

Use `./bin/vibeos evidence` when available.

1. Start one evidence run for the bounded change.
2. Record each material check with a specific label: targeted tests, build, runtime flow, visual state, security check, migration invariant, etc.
3. Prefer `evidence run` for deterministic commands so exit status/output are captured directly.
4. For browser/screenshots or external tools, use `evidence record` with artifact paths and concise notes.
5. Failed checks remain in the ledger; do not delete evidence to make the run green.
6. Close the ledger only after applicable gates are complete.
7. Give independent reviewers the ledger plus raw artifacts, not a rewritten success narrative.
