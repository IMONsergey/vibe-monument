# Git Policy

- Inspect `git status` and relevant diff before work and before completion.
- Preserve unrelated user changes.
- Prefer isolated worktrees for parallel agents, risky refactors and epics.
- Commits are save points, not proof of correctness.
- Keep commits coherent enough to review/revert; do not force arbitrary line-count limits.
- Never rewrite shared history unless explicitly approved.
- Before merge/ship, verify the integrated tree, not only isolated branch results.
