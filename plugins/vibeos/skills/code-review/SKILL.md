---
name: code-review
description: "Perform an independent fresh-context review of a proposed change against requirements and repository standards. Use before merging non-trivial work or when explicitly asked for review; do not accept the implementer’s narrative as evidence."
---

# Independent code review

1. Start with a fresh context/role when the host supports it.
2. Read the review packet: requirements, target diff, project standards and existing evidence.
3. Inspect the actual code/tests; do not review only a summary.
4. Review separately for:
   - spec/behavior compliance;
   - correctness/regressions;
   - architecture and maintainability;
   - security/data boundaries;
   - test/evidence adequacy;
   - runtime/UI concerns when relevant.
5. Report only actionable findings with evidence.
6. Severity must be one of `BLOCKER`, `MAJOR`, `MINOR`, `NIT`.
7. Avoid style churn when project tooling already settles the matter.
8. If reviewers disagree, preserve the disagreement until evidence resolves it; synthesis must not average away a real risk.
9. After fixes, verify from the new diff/evidence rather than trusting a “fixed” statement.

Do not use arbitrary overall scores as proof of readiness.
