# Quality Gates

Use observable gates, not one magic quality score.

## Gate selection

Choose gates from the task contract and risk route. Typical gates:

- acceptance behavior;
- targeted/full tests;
- type/lint/static checks;
- build/startup/runtime smoke;
- live browser interaction;
- visual/reference/accessibility checks;
- performance baseline comparison;
- security/data-boundary review;
- migration invariants/rollback readiness;
- independent review.

## Severity

- `BLOCKER`: unsafe/incorrect; cannot ship.
- `MAJOR`: material product/correctness/security/architecture defect; fix before ship by default.
- `MINOR`: worthwhile but normally non-blocking.
- `NIT`: optional style/preference; never generate churn to appear thorough.

Default review/fix loop is bounded by `.vibeos/config.toml`. If substantive blockers survive the bound, escalate rather than looping indefinitely.
