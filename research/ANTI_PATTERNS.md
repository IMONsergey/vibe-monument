# Anti-patterns rejected by VibeOS

## 1. Giant always-on instruction file
Why it fails: context cost, stale duplicated rules, contradictory guidance, hard-to-debug activation.
Replacement: small kernel + on-demand skills + canonical code references.

## 2. “Install every skill”
Why it fails: trigger collisions and skill list/context pressure.
Replacement: core pack + domain packs only when recurring.

## 3. One agent does research, code, review and certification
Why it fails: confirmation bias and context saturation.
Replacement: fresh-context bounded workers/reviewers for non-trivial work.

## 4. Infinite long-running chat
Why it fails: compaction, stale assumptions, lost decisions.
Replacement: disk artifacts + immutable handoffs + fresh contexts.

## 5. Memory as append-only chat history
Why it fails: rot and false authority.
Replacement: observation -> verified candidate -> scoped durable knowledge; stale-reference checks.

## 6. Permission bypass as “autonomy”
Why it fails: unrestricted blast radius.
Replacement: enforced sandbox + least privilege + iteration limits + human gates.

## 7. Plan theater
Why it fails: huge plans without executable grounding become stale prose.
Replacement: vertical slices with exact evidence and interfaces; FAST_PATCH for small changes.

## 8. Self-reported verification
Why it fails: model summaries are not evidence.
Replacement: actual commands/runtime/browser/eval evidence and independent final verification.

## 9. Screenshot-only frontend review
Why it fails: misses interactions, console/network failures, edge states and responsive behavior.
Replacement: live browser + screenshots + runtime checks + state coverage.

## 10. Arbitrary quality score
Why it fails: uncalibrated number hides severity and evidence.
Replacement: deterministic gates + BLOCKER/MAJOR/MINOR/NIT findings.

## 11. Universal test coverage quota
Why it fails: encourages testing implementation trivia and gaming the metric.
Replacement: behavior/regression/risk-based tests; coverage as diagnostic.

## 12. Auto-promoting every lesson
Why it fails: one bad inference becomes permanent doctrine.
Replacement: promotion gate and preference for deterministic encoding.
