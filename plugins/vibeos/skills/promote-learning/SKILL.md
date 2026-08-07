---
name: promote-learning
description: "Promote a verified recurring lesson into durable project knowledge without polluting memory. Use after successful verification/review when a pattern is likely to recur; do not store one-off chatter or unverified model opinions."
---

# Promote a learning

1. Start from a concrete observation after work/review/incident.
2. Gather evidence: tests, source paths, repeated occurrences, bug/review artifact.
3. Ask whether it is likely to recur and what exact scope it applies to.
4. Prefer deterministic encoding in this order when suitable:
   `code invariant/type/schema -> automated test -> linter/check -> documentation/context -> skill -> always-on AGENTS rule`.
5. Only use an always-on rule for a stable, broad invariant worth permanent context cost.
6. Record the learning using `templates/LEARNING.md`, including when it does *not* apply and what would make it stale.
7. If a new durable rule replaces older memory, mark old entries superseded/prune them.

Do not promote “the agent prefers X” or a single accidental implementation detail into project law.
