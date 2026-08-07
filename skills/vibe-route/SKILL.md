---
name: vibe-route
description: "Route software tasks to the lightest safe VibeOS workflow. Use at the start of coding/research/review tasks when workflow choice is unclear; do not use to replace an already approved explicit workflow."
---

# Route the task

1. Read `AGENTS.md`, `.vibeos/config.toml`, and the user request.
2. Classify by **risk, ambiguity, scope, evidence needs**, not by prompt length.
3. Choose exactly one primary workflow:
   - `FAST_PATCH`: tiny, obvious, low-risk, clear acceptance.
   - `BUILD`: normal feature/refactor with bounded scope.
   - `BUG`: observed failure requiring diagnosis.
   - `UI`: user-facing visual/interaction work.
   - `RESEARCH`: evidence gathering without implementation as the primary output.
   - `EPIC`: multi-area, multi-session, dependency-heavy work.
   - `REVIEW`: independent certification/review.
   - `SHIP`: integration/release/PR/deploy readiness.
   - `MIGRATION`: schema/data/storage changes requiring migration safety and rollback proof.
   - `DEPENDENCY`: dependency/runtime/toolchain upgrades with compatibility and supply-chain checks.
   - `INCIDENT`: active production degradation/outage; stabilize first, diagnose second.
4. Escalate the workflow if any of these appear: unclear acceptance, public API/data/auth changes, irreversible operations, many independent areas, production/security impact, or large UI behavior changes.
5. De-escalate ceremony for obvious low-risk patches. A small change does not need a large spec merely because VibeOS supports specs.
6. Read the selected file under `workflows/` and only the additional skills it actually requires.

Return the selected workflow and one sentence explaining why. Then proceed; do not turn routing into a user-facing ceremony unless a decision is genuinely needed.
