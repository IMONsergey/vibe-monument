# VibeOS 2 benchmark protocol

VibeOS is an engineering hypothesis until it beats a simpler baseline on **paired real-repository tasks**.

## Layers

### Layer 0 — framework integrity (runs now)
- Python runtime/unit tests;
- structural doctor;
- generated adapter hash parity;
- routing boundary cases.

### Layer 1 — executable micro-fixtures (runs now with any configured coding agent)
`evals/fixtures/` contains small repositories whose baseline fails a hidden acceptance script and whose reference solution passes. `evals/harness.py` copies only the start repo into a temporary workspace and can run the same agent twice: `vanilla` and `vibeos`.

These fixtures test harness mechanics and common failure modes. They are deliberately **not** used to claim real-world superiority.

### Layer 2 — 100 paired real-repository tasks (required for the main claim)
Use historical tasks with an immutable starting commit and known outcome:

- 20 FAST_PATCH;
- 20 BUG;
- 20 BUILD;
- 20 UI;
- 10 EPIC/refactor;
- 10 RESEARCH/DEPENDENCY/MIGRATION.

Run the same model/harness/version, same starting commit, same task request and equivalent permissions for each pair.

## Variants

- **A Vanilla:** repository's normal instructions only.
- **B VibeOS:** same environment + VibeOS.
- Optional **C Heavy framework:** one external framework when comparison is useful.

Never compare different models and credit the difference to VibeOS.

## Leakage control

Acceptance criteria and regression traps should be hidden from the agent when they represent information the original developer would not have had. Public tests/documentation remain available exactly as in the historical task.

Do not place reference solutions inside the agent workspace.

## Metrics

### Outcome
- acceptance/hidden checks;
- regressions;
- runtime/browser failures;
- visual/accessibility defects after claimed completion;
- security/data defects;
- false completion claims.

### Human burden
- interventions;
- unnecessary clarification;
- minutes of cleanup;
- unresolved reviewer noise requiring adjudication.

### Agent cost
- wall time;
- tool/model turns;
- retries/context resets/subagents;
- tokens/cost when available.

### Process quality
- requirement misses before coding;
- wrong architecture/file selection;
- stale-context failures;
- defects found only by fresh review;
- useful vs noisy promoted learning.

## UI tasks

Use fixed test data and named viewports. Blind human review should compare implementation/reference without revealing which variant produced it when subjective design quality is scored.

Automated screenshot distance can supplement but not replace product/design review.

## Reviewer calibration

LLM findings are not ground truth. Human-label a representative sample as true defect / valid tradeoff / false positive. Track precision by reviewer role and remove roles that mainly create noise.

## Statistics

Treat tasks as paired observations. Report raw wins/losses/ties and confidence intervals for the primary success outcome. Do not hide regressions behind one weighted "quality score". For binary paired success, a McNemar-style paired comparison is preferable to treating runs as independent.

## Ablations

After VibeOS beats vanilla, remove mechanisms one at a time:

- independent fresh reviewer;
- task contract/spec;
- visual/accessibility QA;
- evidence ledger;
- handoff/context packet;
- learning promotion;
- fast lane;
- adversarial doubt.

If a mechanism does not improve its target class enough to justify cost/latency, simplify or delete it.

## Claim threshold

Do not market VibeOS as "better" from Layer 0/1 alone. The real claim requires Layer 2 evidence across multiple repositories and task classes.
