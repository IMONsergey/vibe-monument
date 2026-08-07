# Architectural Findings — IMON VibeOS v1

Research snapshot: 2026-08-07

This document records the synthesis, not a popularity ranking.

## Executive conclusion

The strongest public AI-coding systems converge on a few ideas, but they disagree on how much process should be hard-coded. The best architecture is neither “one enormous CLAUDE.md” nor “zero process, just prompt harder”. It is:

**small kernel + progressive-disclosure skills + durable work artifacts + fresh-context verification + fast deterministic feedback + curated memory + sandboxed autonomy.**

## 1. The kernel should be tiny

Matt Pocock’s skills explicitly reject monolithic process ownership; current Open Agent Skills/Codex guidance uses progressive disclosure. Peter Steinberger’s agent-scripts likewise keeps skill descriptions short and routes detailed behavior into terse skills/helpers.

### VibeOS decision
TAKE: short `AGENTS.md` with invariants/router.
REJECT: stuffing every workflow/checklist into always-on context.

## 2. Requirements and design need an artifact before non-trivial code

Superpowers is strongest on the behavioral discipline of understanding/design before implementation. Addy Osmani similarly maps a lifecycle from DEFINE/PLAN to BUILD/VERIFY/REVIEW/SHIP. Matt’s “grill/shared domain language” adds the missing vocabulary layer.

### VibeOS decision
TAKE: spec for non-trivial/ambiguous/risky behavior; explicit MUST/SHOULD/MAY/out-of-scope and observable acceptance.
ADAPT: full design ceremony is conditional; FAST_PATCH bypasses it for low-risk obvious edits.

## 3. Plans should be execution interfaces, not essays

Superpowers’ plans and PBC’s implementation packets are useful because a fresh agent can execute them. The core unit is an independently verifiable slice with file/interface grounding and explicit evidence.

### VibeOS decision
TAKE: execution packets and vertical slices.
ADAPT: avoid arbitrary “2–5 minute” microtask dogma; slice by evidence boundaries.

## 4. Fresh context is a feature

Ralph-style loops deliberately reset context. PBC assigns independent implementation/review roles. Open Code Review and Pedro Sant’Anna separate reviewers and verification. This counters context saturation and self-confirmation.

### VibeOS decision
TAKE: main context as scheduler/decision holder; fresh bounded workers; fresh final reviewers.
REJECT: one endless session that researches, implements, argues for, and certifies its own work.

## 5. Backpressure determines agent quality

Across Superpowers, Matt Pocock, Addy, Ralph, Aider and Poltergeist, reliable output depends on fast external signals: tests, types, builds, browser/runtime, static checks, observable errors.

### VibeOS decision
TAKE: “evidence beats assertion” as a kernel invariant.
TAKE: validation command in every execution packet.
TAKE: stop repeated speculative retries when feedback is not discriminating.

## 6. Independent verification must see requirements, not persuasion

PBC uses independent review. Open Code Review propagates requirements. Pedro’s workflow includes adversarial/forked verification. The useful insight is not “many agents are always better”; it is that certification should not inherit the implementer’s confirmation bias.

### VibeOS decision
TAKE: review packet = requirements + standards + diff + evidence.
REJECT: implementer self-summary as primary review context.
ADAPT: multiple reviewers only when the axes are meaningfully independent; avoid expensive reviewer swarms for small changes.

## 7. UI requires a separate evidence model

gstack’s design-review/QA and Impeccable’s design vocabulary/anti-patterns expose a major gap in generic coding systems: green tests can coexist with mediocre/broken UI.

### VibeOS decision
TAKE: live-browser QA for material UI work.
TAKE: configured responsive viewports, console/network checks, interaction/state checks, screenshot evidence, visual critique.
TAKE: design vocabulary and anti-pattern review as optional specialized references.
REJECT: static code review or one screenshot as sufficient UI certification.

## 8. Memory must have a promotion gate

AWRShift’s memory kit is the clearest public example of memory hygiene: handoffs, layers, caps, stale-reference checks, promotion from observations to durable rules. Beads contributes structured/dependency-aware long-horizon state. LifeOS contributes explicit LEARN/self-improvement.

### VibeOS decision
TAKE: observation -> candidate -> verified learning -> best durable encoding.
TAKE: immutable handoffs rather than an endlessly-mutated diary.
TAKE: scope and staleness trigger on learnings.
ADAPT: Beads is an optional task-graph backend, not a hard runtime dependency.
REJECT: “remember everything forever”.

## 9. The best memory is often not text memory

A recurring engineering lesson is that deterministic artifacts outperform reminders. If a recurring fact can become a type, schema, test, linter, validation script or code abstraction, it should not remain only an instruction.

### VibeOS decision
Knowledge promotion priority:
`code invariant/type/schema -> test -> linter/check -> docs/context -> skill -> always-on rule`.

## 10. Autonomy is a containment problem

Ralph examples may use permission bypass, but they also warn about blast radius. Pi’s security docs emphasize that project trust is not a sandbox. Current Codex documentation explicitly separates sandbox boundaries from approval policy.

### VibeOS decision
TAKE: unattended autonomy only under enforced sandbox + least privileges + bounded credentials/network/writes + iteration limits.
REJECT: permission-bypass on an unsandboxed host as a default workflow.

## 11. Harness portability should be native, not copied

Open Agent Skills provides a shared `SKILL.md` format. Codex currently discovers repo skills under `.agents/skills` and follows symlinks. Cursor supports dynamic Agent Skills and project rules. Peter’s agent-scripts demonstrates canonical skills with per-harness links instead of duplicated bodies.

### VibeOS decision
TAKE: one canonical `skills/` directory and generated/symlinked adapters.
TAKE: root `AGENTS.md` as cross-tool kernel; `CLAUDE.md` is a pointer, not a second giant instruction file.

## 12. Large skill collections have a real context cost

Current Codex docs explicitly budget the initial skills list and can omit skills when sets are huge. Huge collections also create trigger collisions and contradictory procedures.

### VibeOS decision
Ship ~15 core skills, not hundreds. Add specialized packs only when they have a real recurring job.

## 13. “Compound engineering” is worth keeping — but only verified learning

Every’s loop ends by compounding reusable knowledge. This is valuable, but automatic accumulation risks turning errors into doctrine.

### VibeOS decision
TAKE: LEARN/COMPOUND as the final optional phase.
ADAPT: only promote after verification and scope classification.

## 14. Review scores are often pseudo-precision

Some public systems use thresholds or aggregate quality scores. They can be useful for dashboards but are not intrinsically calibrated.

### VibeOS decision
REJECT: arbitrary 0–100 merge gates in the kernel.
TAKE: explicit severity + evidence + hard deterministic gates.

## 15. The system needs two speeds

Process-heavy systems can make agents reliable but tedious. Minimal systems can be fast but fragile on complex tasks.

### VibeOS decision
FAST_PATCH handles obvious low-risk work. BUILD/BUG/UI cover most work. EPIC adds decomposition/worktrees/fresh agents only when context or dependency complexity justifies it.
