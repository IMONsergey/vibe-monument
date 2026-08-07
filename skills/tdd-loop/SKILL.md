---
name: tdd-loop
description: "Use red-green-refactor for deterministic behavior changes and regression fixes. Use when a meaningful automated test can express the requirement; do not force unit tests onto purely visual or inherently non-deterministic behavior."
---

# TDD loop

For one observable behavior at a time:

1. **RED** — write or adjust the smallest meaningful test/verification that fails for the intended reason. Run it and confirm the failure.
2. **GREEN** — implement the minimum coherent behavior to make it pass. Run it and confirm success.
3. **REFACTOR** — improve structure without changing behavior; rerun the relevant tests.
4. Repeat for the next behavior.

## Test quality
- Test public/meaningful behavior rather than implementation trivia.
- Prefer deterministic seams.
- Add a regression guard for fixed bugs when practical.
- Do not mock away the behavior under test.
- Do not rewrite a legitimate failing test just to make the build green.
- Coverage percentage is a diagnostic, not proof.

If a red test cannot be made meaningful, use another direct evidence loop and document why.
