---
name: inspect-codebase
description: "Inspect an unfamiliar or relevant code path before editing. Use before non-trivial implementation, refactors, architecture work, or when existing patterns are unknown; skip exhaustive exploration for an obvious tiny patch."
---

# Inspect before changing

## Objective
Build the minimum reliable map needed to change the code without inventing parallel architecture.

1. Read stable project context: `context/PROJECT.md`, `DOMAIN.md`, `ARCHITECTURE.md` when relevant.
2. Inspect `git status` and relevant current diff so user work is not overwritten.
3. Locate entry points, interfaces, data flow, tests and canonical neighboring implementations.
4. Search for the project's actual vocabulary from `context/DOMAIN.md`.
5. Identify the smallest set of files/modules that own the behavior.
6. Check recent history only when it can explain intent or a regression.
7. For framework/library behavior that may have changed, prefer current primary documentation over model memory.
8. Produce a compact map:
   - behavior owner;
   - relevant files/interfaces;
   - existing pattern to reuse;
   - tests/verification path;
   - constraints/unknowns.

Do not start a rewrite merely because existing code is imperfect. Do not load the whole repository into context.
