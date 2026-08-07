---
name: ship-change
description: "Prepare a verified change for commit, pull request, release or deployment. Use only after implementation/review are substantially complete; do not deploy or perform irreversible production operations without the required human approval."
---

# Ship safely

1. Confirm the final integrated tree matches the intended spec/acceptance.
2. Run the configured integrated gates, not only targeted development tests.
3. Inspect final `git status`/diff for accidental files, secrets, debug artifacts, generated noise and dependency/config surprises.
4. Confirm all BLOCKER/MAJOR findings are resolved or explicitly accepted by the authorized human.
5. For migrations/releases, confirm rollback/recovery and observability.
6. Create coherent commit/PR/release notes using project conventions.
7. Production deployment, destructive operations or credential changes require explicit human authorization unless policy already grants a bounded approved mechanism.
8. If deployed and access permits, run a targeted post-deploy smoke check.
9. Capture residual risk/follow-up and then invoke `promote-learning` only for verified reusable lessons.
