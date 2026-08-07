---
name: adversarial-doubt
description: "Challenge a non-trivial decision or artifact from fresh context before it becomes expensive to reverse. Use for architecture, security, migrations, unfamiliar code, irreversible choices, or confident claims that are cheaper to disprove now than debug later."
---

# Adversarial doubt

1. State the decision as a compact `CLAIM` and why failure matters.
2. Extract the smallest reviewable `ARTIFACT` plus its `CONTRACT`.
3. Start a fresh-context reviewer. Give it **ARTIFACT + CONTRACT only**; do not give it the claim, author rationale, or desired verdict.
4. Prompt for disproof: unstated assumptions, contract violations, edge cases, hidden coupling, unsafe failure modes, and conflicting repository evidence.
5. Reconcile every finding yourself as: `CONTRACT_GAP`, `ACTIONABLE`, `TRADEOFF`, or `NOISE`.
6. Change the artifact for actionable findings, then re-review only the changed contract surface.
7. Stop when findings are trivial/already considered, after three substantive cycles, or when the human explicitly accepts the remaining tradeoff.

A fresh reviewer is a source of counter-evidence, not an authority. Do not rubber-stamp it.
