---
name: plan-slices
description: "Create an implementation plan from an approved spec or clearly defined request. Use when work has multiple dependent changes or needs delegation; plan vertical independently verifiable slices rather than vague phases."
---

# Plan in verifiable slices

1. Re-read the spec and relevant architecture; do not plan from memory of a long chat.
2. Choose the simplest architecture that fits existing boundaries and constraints.
3. Decompose by **independently observable outcomes**, not “frontend/backend/tests” silos when a vertical slice is possible.
4. For every slice define:
   - goal;
   - likely files/interfaces;
   - existing pattern to follow;
   - dependencies;
   - acceptance checks;
   - validation commands/runtime evidence;
   - out-of-scope;
   - rollback/checkpoint if risky.
5. Keep slices small enough to review and verify, but do not force arbitrary 2-minute microtasks.
6. Make dependencies explicit so parallel work is used only where boundaries are real.
7. End with integrated checks on the merged/final tree.
8. Save under `work/plans/` using `templates/PLAN.md`.

A plan must give a fresh-context implementer enough grounding to proceed without reconstructing the entire design conversation.
