---
name: clarify-spec
description: "Turn a non-trivial feature or change request into explicit requirements and acceptance criteria. Use when behavior is ambiguous, multi-step, public-facing, risky, or likely to span several files; do not require a full spec for obvious trivial patches."
---

# Clarify and specify

1. Ground in existing code/context before inventing requirements.
2. State the desired outcome in user/system behavior, not implementation language.
3. Separate scope into `MUST`, `SHOULD`, `MAY`, `OUT OF SCOPE`.
4. Write observable acceptance criteria.
5. Enumerate material states and edge cases (success, error, loading, empty, permissions, boundaries) as applicable.
6. Mark uncertain but workable details as `ASSUMED` and state how to verify them.
7. Mark decisions that prevent safe progress as `BLOCKED`.
8. When multiple credible approaches materially differ, present 2–3 options with trade-offs before locking design.
9. Save non-trivial specs under `work/specs/` using `templates/SPEC.md`.

Avoid implementation detail that belongs in the plan. Avoid asking questions whose answer can be derived from the repository or authoritative documentation.
