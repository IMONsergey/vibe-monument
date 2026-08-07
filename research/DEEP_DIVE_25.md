# Deep Dive: 25 repositories that shaped IMON VibeOS v1

Research snapshot: 2026-08-07.

This is not a star-count ranking. It records what was actually useful for architecture extraction. For each source:

- **Inspected** — operational surfaces reviewed during this research pass.
- **Best idea** — strongest reusable mechanism.
- **Failure mode** — what becomes dangerous or wasteful if copied literally.
- **VibeOS extraction** — where the idea lands in v1.
- **Depth** — `DEEP` means operational files were inspected; `WORKFLOW` means primary README/docs/workflow material; `REFERENCE` means used mainly as an implementation/harness reference.

---

## 1. `obra/superpowers` — DEEP

**Inspected:** `README.md`, `skills/brainstorming/SKILL.md`, `skills/writing-plans/SKILL.md`, subagent/review/debugging workflow material.

**Best idea:** force ambiguity out before expensive implementation, then give a fresh worker a plan that is executable without hidden conversation context. The plan is not a vague todo list: exact files/interfaces, acceptance checks, tests and completion criteria are part of the artifact.

**Second-best idea:** creation and certification are separate phases. Fresh workers/reviewers reduce the tendency of one long context to rationalize its own earlier decisions.

**Failure mode:** its brainstorming gate explicitly applies even to very small work. That reliability is real, but applied universally it creates ceremony where the patch is already mechanically obvious.

**VibeOS extraction:** `clarify-spec`, `plan-slices`, execution packets, independent review, TDD/debug discipline, worktree guidance. VibeOS adds `FAST_PATCH` as an explicit escape hatch for low-risk mechanical work.

---

## 2. `EveryInc/compound-engineering-plugin` — DEEP

**Inspected:** `README.md`, current core loop, `skills/ce-compound/SKILL.md`, skill inventory and artifact model.

**Best idea:** completed engineering work should make future engineering cheaper. The loop does not stop at merge; it ends by turning solved problems into discoverable knowledge.

**Important implementation detail:** the modern compound workflow treats documentation as a structured artifact, uses overlap/grounding checks, and distinguishes interactive from non-interactive execution.

**Failure mode:** the individual skills have grown into substantial orchestration programs. Blindly importing the whole system would increase context/runtime complexity and duplicate responsibilities already present elsewhere.

**VibeOS extraction:** `promote-learning`, `work/learnings/`, explicit post-verification LEARN phase. Promotion is stricter than simple accumulation: evidence and future recurrence are required.

---

## 3. `mattpocock/skills` — DEEP

**Inspected:** `README.md`, engineering/productivity skill inventory, `writing-for-agents/SKILL.md`, context/domain-model patterns.

**Best idea:** a skill should be a small piece of repeatable discipline, not a framework that owns the user's entire process. The user-invoked orchestration layer and model-invoked discipline layer are usefully distinct.

**Critical insight:** always-loaded text has a real context cost. Matt's "context pointers" and progressive disclosure model gave VibeOS its short kernel + routed skill architecture.

**Another strong idea:** do not write in agent docs what the repository can cheaply reveal itself. `package.json`, config, types and filesystem are stronger sources of truth than cached prose that will go stale.

**Failure mode:** a purely modular pack can still lack a single cross-project safety contract if every responsibility is optional.

**VibeOS extraction:** short `AGENTS.md`; canonical small skills; `DOMAIN.md`; context pointers; completion criteria; no duplicated environment facts unless discovery is genuinely expensive.

---

## 4. `addyosmani/agent-skills` — DEEP

**Inspected:** `README.md`, lifecycle inventory, `context-engineering/SKILL.md`, `doubt-driven-development/SKILL.md`, frontend/browser/review concepts.

**Best idea:** context quality is not "load more files". It is a hierarchy: stable rules -> relevant spec/architecture -> relevant source -> current errors/evidence -> conversation. This became a core VibeOS context policy.

**Best verification idea:** a fresh reviewer should receive `ARTIFACT + CONTRACT`, not the author's conclusion or self-justification. That framing reduces confirmation bias.

**Best security idea:** external content and instruction-like text inside data/config should be treated as untrusted input.

**Failure mode:** some thresholds/checklists are valuable defaults but are not universal laws. Fixed line-count/context/coverage heuristics should not become hard merge gates across every stack.

**VibeOS extraction:** `policies/CONTEXT.md`, independent review packet, source-first research, UI/browser QA, security boundaries, bounded adversarial review.

---

## 5. `hamelsmu/evals-skills` — DEEP

**Inspected:** `README.md`, eval skill inventory and intended audit/error-analysis flow.

**Best idea:** an evaluator is itself a system that can be wrong. Subjective judges need calibration against human labels, not blind trust.

**Why this matters beyond LLM evals:** coding-agent workflows also need explicit evidence definitions. "Tests passed" can be inadequate if acceptance criteria include UI, latency, browser errors or migration safety.

**Failure mode:** transplanting generic LLM-eval recipes directly into application engineering without domain-specific ground truth.

**VibeOS extraction:** `evals/`, explicit evidence scorecard, distinction between deterministic gates and subjective review, future benchmark corpus design.

---

## 6. `simonw/research` — WORKFLOW

**Inspected:** repository structure and Simon Willison's public agentic-engineering research workflow material.

**Best idea:** AI research should leave reproducible artifacts — prompt/task, sources, output and provenance — inside the repository instead of disappearing into chat history.

**Failure mode:** turning research into a large link dump without a decision, confidence level or unresolved questions.

**VibeOS extraction:** `research-primary`, `work/research/`, primary-source preference, verified/inferred/unresolved separation.

---

## 7. `ghuntley/how-to-ralph-wiggum` — WORKFLOW

**Inspected:** public playbook structure, planning/build loops, fresh-context/disk-state approach, backpressure and safety caveats.

**Best idea:** the main durable state can live on disk while each important execution iteration starts with fresh context. Tests/typecheck/build/runtime feedback provide backpressure instead of relying on the model to remember everything correctly.

**Attribution note:** the repository identifies itself as a playbook/fork around Geoffrey Huntley's Ralph technique; VibeOS treats it as a reference implementation, not proof of sole repository authorship.

**Failure mode:** permission-bypass examples become unsafe if copied onto an unsandboxed machine with valuable credentials/files.

**VibeOS extraction:** fresh-context execution/review, handoffs, disk artifacts, bounded retries, explicit sandbox requirement for unattended work.

---

## 8. `ghuntley/how-to-build-a-coding-agent` — REFERENCE

**Inspected:** coding-agent loop/tutorial material.

**Best idea:** demystify the agent as a bounded loop around model calls, tool execution and state rather than a magical autonomous engineer.

**Failure mode:** rebuilding an entire harness when the real project problem is workflow/context/evidence.

**VibeOS extraction:** conceptual control-loop model only. No custom harness is required by v1.

---

## 9. `earendil-works/pi` — WORKFLOW

**Inspected:** README, quickstart/security/extension architecture material.

**Best idea:** keep the coding-agent harness small and expose extension points. A minimal runtime makes it possible to reason about what the agent can actually do.

**Security lesson:** a repository being "trusted" is not the same as process isolation. Extensions/tools can still execute real code.

**Failure mode:** equating local project trust with a sandbox or loading arbitrary community extensions without review.

**VibeOS extraction:** vendor-neutral kernel, explicit tool-boundary thinking, `policies/AUTONOMY.md` and `policies/SECURITY.md`.

---

## 10. `gastownhall/beads` — WORKFLOW

**Inspected:** current project overview and dependency-aware persistent work-state model.

**Best idea:** long-running agent work benefits from structured task/dependency state instead of a flat todo document or chat-memory narrative.

**Failure mode:** making a specific task-graph database/tool mandatory in every repository, including small projects.

**VibeOS extraction:** dependency graph as an EPIC concept; Beads remains an optional backend rather than a core dependency.

---

## 11. `danielmiessler/LifeOS` — WORKFLOW

**Inspected:** current LifeOS/earlier PAI architecture and public writing on persistent AI operating systems.

**Best idea:** explicit routing, purpose-specific memory and an intentional LEARN phase can turn repeated work into a compounding system.

**Failure mode:** a general life operating system is far broader than a coding OS. Importing it whole would explode scopes, agents and always-on context.

**VibeOS extraction:** routing + verified LEARN concepts only; personal-life/knowledge-management scope is rejected from core.

---

## 12. `humanlayer/12-factor-agents` — WORKFLOW

**Inspected:** 12-factor architecture and factor explanations.

**Best idea:** own the control flow outside the model. Prompts, state transitions, pause/resume semantics and tool interfaces should be inspectable application logic wherever practical.

**Best agent-design idea:** prefer small focused agents and compact error context over one giant autonomous context.

**Failure mode:** letting an LLM implicitly become the entire application/controller because orchestration feels convenient.

**VibeOS extraction:** explicit router/workflows, small role profiles, resumable disk artifacts, bounded error context.

---

## 13. `mattlgroff/pbc` — WORKFLOW

**Inspected:** PBC workflow and public description of Research -> Plan -> Implement -> Review with separate workers.

**Best idea:** execution packets. The implementer gets a bounded contract that can stand alone, rather than the full exploratory conversation.

**Best review idea:** the reviewer is independent and can send an implementation back through a bounded fix loop.

**Failure mode:** provider/model-specific orchestration assumptions if copied literally.

**VibeOS extraction:** `templates/EXECUTION_PACKET.md`, separate role profiles, max review/fix rounds, parallel recon for EPIC work.

---

## 14. `pedrohcgs/claude-code-my-workflow` — WORKFLOW

**Inspected:** workflow guide/repository organization and reviewer/context-survival patterns.

**Best idea:** requirements need explicit state, e.g. `CLEAR / ASSUMED / BLOCKED` and priority semantics such as `MUST / SHOULD / MAY`.

**Best review idea:** the final verifier should not inherit the implementation author's chain of rationalization.

**Failure mode:** large reviewer rosters and advisory numeric scoring can produce expensive pseudo-certainty.

**VibeOS extraction:** requirement state labels, fresh verifier, handoff discipline, severity-based review instead of a universal numeric score.

---

## 15. `Aider-AI/aider` — REFERENCE

**Inspected:** project documentation around repository maps, git integration and test/fix loops.

**Best idea:** give the model a compact structural map of a larger repository instead of naively loading the entire codebase.

**Best workflow idea:** automatic git checkpoints and executable feedback loops make agent changes easier to inspect/revert.

**Failure mode:** assuming a powerful harness eliminates the need for product requirements, independent review, memory hygiene or visual QA.

**VibeOS extraction:** codebase-map mindset, git checkpoint discipline and test/fix feedback ideas; Aider is not a required runtime.

---

## 16. `spencermarx/open-code-review` — WORKFLOW

**Inspected:** multi-agent review architecture, requirements-aware review and persistent review-session concept.

**Best idea:** reviewers should be grounded in the requirements and their findings should become durable review artifacts.

**Failure mode:** reviewer swarms are wasteful for low-risk work and can manufacture disagreement/nitpicks simply because multiple agents were asked to find something.

**VibeOS extraction:** independent axes (`spec`, `quality`, `security`, `visual`) only when applicable; persistent review packet; no swarm by default.

---

## 17. `garrytan/gstack` — DEEP

**Inspected:** current README/workflow, skill inventory, `design-review/SKILL.md`, QA/review/learn architecture.

**Best idea:** UI quality is an engineering verification problem. A live product should be clicked, inspected and compared, with browser/runtime evidence and screenshots — not judged only from React/CSS source.

**Strong design-review idea:** explicitly look for hierarchy, spacing, inconsistency, interaction quality and recurring AI-generated visual tells; make fixes and re-check visually.

**Failure mode:** current skills include large preambles/runtime/config/telemetry mechanics. These are appropriate for a full productized skill suite but far too heavy to copy into a portable project kernel.

**VibeOS extraction:** `visual-qa`, `workflows/UI.md`, screenshot evidence, console/network/state checks and design-review vocabulary. Runtime scaffolding is rejected.

---

## 18. `affaan-m/everything-claude-code` — WORKFLOW

**Inspected:** README, agent/rule/skill organization, cross-harness configuration patterns and security/research concepts.

**Best idea:** the repository is an excellent inventory of things a mature agent setup may eventually need.

**Failure mode:** it is also a demonstration of why "install everything" is dangerous: overlap, trigger collisions and context bulk rise quickly as packs become encyclopedic.

**VibeOS extraction:** cherry-picked security, prompt-defense and cross-tool integration ideas only. The collection is an idea mine, not the foundation.

---

## 19. `steipete/agent-scripts` — DEEP

**Inspected:** `README.md`, canonical `AGENTS.MD`/skills/helpers design, adapter synchronization and validation approach.

**Best idea:** maintain one canonical body and expose it to multiple harnesses with thin links/adapters. Do not copy the same shared instructions into every repository/tool-specific file.

**Strong skill-authoring rule:** descriptions are routing metadata; bodies are terse operational procedures; repeatable mechanics belong in scripts and should be validated.

**Failure mode:** personal-machine assumptions should not leak into a generic project template.

**VibeOS extraction:** canonical `skills/`, `.agents/skills` and `.cursor/skills` links, flat Claude skill links, `doctor.py`, pointer-style `CLAUDE.md`.

---

## 20. `steipete/poltergeist` — WORKFLOW

**Inspected:** build-watcher architecture and AI-oriented build freshness/error reporting.

**Best idea:** the agent should receive fast, current, machine-readable feedback from the thing it is changing. Stale build state is a context bug.

**Failure mode:** making a specific watcher mandatory when the target repository already has Vite, test watch, CI or a different feedback mechanism.

**VibeOS extraction:** feedback-freshness rule; optional integration pack, not bundled core.

---

## 21. `awrshift/claude-memory-kit` — DEEP

**Inspected:** `README.md`, `CLAUDE.md`, session/memory layers, promotion and staleness rules.

**Best idea:** `MEMORY.md` should be a hot cache, not an archive. Session history belongs in immutable handoffs; stable concepts/rules are promoted only after recurrence/confirmation.

**Critical reliability idea:** date volatile facts and detect stale file references. A memory system that confidently points to deleted/moved code is worse than no memory.

**Strong structural idea:** one home per fact; duplicate restatements create stale copies.

**Failure mode:** interpreting "persistent memory" as permission to store everything forever or to automatically turn repeated observations into laws.

**VibeOS extraction:** `policies/MEMORY.md`, immutable handoffs, scoped/timestamped learnings, stale-reference principle, evidence-gated promotion.

---

## 22. `pbakaus/impeccable` — WORKFLOW

**Inspected:** design skill/command structure, design vocabulary and deterministic anti-pattern concept.

**Best idea:** subjective visual critique becomes more useful when the reviewer has explicit vocabulary: typography, color, spatial hierarchy, motion, interaction, responsive behavior and UX writing.

**Best automation idea:** deterministic visual/code anti-pattern checks can complement an LLM's taste-based critique.

**Failure mode:** encoding one designer's preferred aesthetic as a universal product rule.

**VibeOS extraction:** neutral visual-review dimensions and "AI-generic tells" check; no fixed aesthetic style is imposed.

---

## 23. `gptme/gptme` — REFERENCE

**Inspected:** persistent local-agent/tool/browser architecture and lessons/self-correction concepts.

**Best idea:** durable local state plus real tools/browser can support long-running self-correction loops.

**Failure mode:** continuous autonomous execution without a separate containment/approval model.

**VibeOS extraction:** reference for persistent-agent capability; autonomy remains governed by VibeOS sandbox/stop policies.

---

## 24. `citypaul/.dotfiles` — WORKFLOW

**Inspected:** multi-agent dotfile/skills installation patterns and cross-harness configuration approach.

**Best idea:** personal setups stay maintainable when shared capabilities are modular and tool adapters are generated/linked rather than hand-maintained copies.

**Failure mode:** personal shell/editor/path assumptions are not portable product architecture.

**VibeOS extraction:** installer/adapter design only; no machine-specific dotfiles are bundled.

---

## 25. `openai/codex` + current Codex documentation — DEEP PLATFORM BASELINE

**Inspected:** current `AGENTS.md` behavior, local Agent Skills discovery, skill context budget/progressive disclosure, sandbox model and worktree guidance.

**Best idea for VibeOS portability:** current Codex supports layered `AGENTS.md` instructions and local skills based on the open Agent Skills format. This makes a short root kernel + canonical skill folder a native architecture rather than a prompt hack.

**Best safety idea:** sandbox is a technical boundary distinct from the model's approval behavior. Unattended autonomy should rely on an enforced technical boundary, not an instruction saying "be careful".

**Failure mode:** coupling VibeOS semantics to Codex-specific behavior. Platform details change; the core must remain vendor-neutral and adapters must be revalidated.

**VibeOS extraction:** `AGENTS.md`, `.agents/skills`, symlink adapters, sandbox requirement, worktree guidance, small initial skill set.

---

# Cross-source conclusions

## What converged strongly enough to become core

1. Inspect real repository state before editing.
2. Materialize requirements/acceptance for non-trivial work.
3. Keep long-lived context small and load procedures on demand.
4. Break implementation into independently verifiable slices.
5. Use deterministic feedback loops wherever possible.
6. Separate authoring from certification on non-trivial work.
7. Treat UI/browser behavior as a first-class verification surface.
8. Persist state on disk for long tasks instead of trusting one conversation.
9. Curate/promote memory; do not archive the chat as doctrine.
10. Bound autonomous loops and enforce technical containment.
11. End useful work by capturing only verified reusable learning.

## What did NOT survive synthesis

- One enormous global prompt.
- Hundreds of always-available skills.
- Reviewer swarms by default.
- A mandatory third-party task database.
- One universal code-coverage threshold.
- One universal 0–100 quality score.
- Permission bypass as an autonomy strategy.
- Automatic promotion of agent observations into permanent rules.
- One fixed visual aesthetic.
- Full planning ceremony for a two-line mechanical patch.

## The resulting architecture

`small kernel -> router -> scoped skill -> durable artifact -> execution -> evidence -> fresh review -> ship -> verified learning`

That is the main synthesis behind IMON VibeOS v1.
