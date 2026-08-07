---
name: debug-root-cause
description: "Diagnose a real bug or regression systematically before fixing it. Use when behavior is failing, flaky, slow, or unexplained; do not stack speculative fixes without a reproducible signal."
---

# Root-cause debugging

1. **Reproduce** — establish a repeatable failing condition or the best available observable signal.
2. **Localize** — trace the path and narrow where reality diverges from expectation.
3. **Minimize** — remove irrelevant variables; find the smallest repro when feasible.
4. **Hypothesize** — list ranked hypotheses and what observation would falsify each.
5. **Instrument** — add temporary logs/probes/traces only when current evidence cannot discriminate.
6. **Fix** — change the root cause with the smallest coherent patch.
7. **Guard** — add a regression test/check where practical.
8. **Verify** — rerun original repro plus adjacent relevant checks.
9. Remove temporary instrumentation and inspect the diff.

Stop and ask/escalate if the same failure persists after two materially different evidence-based attempts. Do not confuse correlation with root cause.
