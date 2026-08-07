# Eval scorecard

Do not collapse this into one magic number.

| Dimension | Result |
|---|---|
| Acceptance passed | yes/no + count |
| Hidden checks passed | yes/no + count |
| Regressions | count |
| False "done" claims | count |
| BLOCKER findings after completion | count |
| MAJOR findings after completion | count |
| UI/accessibility defects after completion | count |
| Security/data defects | count |
| Human interventions | count |
| Human cleanup time | minutes |
| Agent turns/tool calls | count |
| Wall time | seconds/minutes |
| Tokens/cost | value if available |
| Repeated-failure loops | count |
| Unrelated edits | count |
| Evidence completeness | complete/partial/missing |
| Reviewer true-positive precision | measured subset |
| Bad/stale memory promoted | count |

Primary interpretation should start with successful finished outcomes and expensive human corrections, then examine cost/latency tradeoffs.
