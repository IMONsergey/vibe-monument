---
name: implement-slice
description: "Implement one approved bounded execution slice and return evidence to an orchestrator or user. Use after requirements/plan are clear; do not expand scope or certify the whole project."
---

# Implement one slice

1. Read the execution packet, relevant project context and exact source files.
2. Confirm the working tree/worktree does not contain unrelated changes you would overwrite.
3. Follow existing interfaces and naming unless the approved plan explicitly changes them.
4. Make the smallest coherent implementation that satisfies this slice.
5. Use TDD when behavior is deterministic and a meaningful failing test can be written first.
6. Run the packet's targeted validation before stopping.
7. Inspect the final diff for accidental changes, dead code, debug output and unhandled states.
8. Return only:
   - what changed;
   - exact evidence run and result;
   - files changed;
   - known risk/blocker;
   - assumptions that still need checking.

Do not claim final feature completion. Do not silently redesign neighboring systems. Do not weaken tests to make them pass unless the test expectation is proven wrong.
