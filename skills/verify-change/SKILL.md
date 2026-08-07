---
name: verify-change
description: "Prove a code change satisfies its acceptance criteria using direct evidence. Use before claiming non-trivial completion or after integrating parallel work; do not rely on the implementer saying tests passed."
---

# Verify the change

Start from the requirements and current final tree.

1. Map each acceptance criterion to a concrete check.
2. Run configured static gates that apply: lint, typecheck, targeted tests, build, e2e.
3. Exercise runtime behavior when static checks cannot prove it.
4. For UI, invoke `visual-qa` and browser/runtime checks.
5. For integrated/parallel work, rerun checks after merge/integration; isolated branch success is not enough.
6. Confirm there are no unresolved BLOCKER/MAJOR review findings.
7. Capture command names/results and any unverified areas.

Output a verification table:
`criterion | evidence | result | residual uncertainty`.

Never replace missing evidence with confidence language.
