# Source Matrix

Research snapshot: 2026-08-07. `TAKE` means incorporated into VibeOS. `ADAPT` means useful but changed. `REJECT` means intentionally not copied as a core default.

| # | Source | Primary value | TAKE | ADAPT | REJECT / caution |
|---:|---|---|---|---|---|
| 1 | `obra/superpowers` | Full disciplined agentic SDLC | design/spec before complex code; planning; TDD; worktrees; review | ceremony scales with task | mandatory heavyweight flow for trivial patches |
| 2 | `EveryInc/compound-engineering-plugin` | Work that makes future work easier | post-work compound/learning phase | verify learnings before promotion | unfiltered accumulation |
| 3 | `mattpocock/skills` | Small composable real-engineering skills | router vs reusable discipline; domain language; ADRs; TDD/debug | combine with a lightweight kernel | process framework owning every task |
| 4 | `addyosmani/agent-skills` | Lifecycle skills and quality gates | DEFINE->PLAN->BUILD->VERIFY->REVIEW->SHIP; source-driven development; UI/browser | remove fixed rules that are not universal | giant all-installed context / arbitrary universal metrics |
| 5 | `hamelsmu/evals-skills` | Evaluation discipline | audit/error-analysis mindset; calibrate subjective judges | translate LLM-eval mechanics to software/UI evidence | generic evals treated as domain-specific truth |
| 6 | `simonw/research` | AI-assisted research as repository artifact | primary-source research; provenance; prompts/artifacts | keep research summaries concise | link dumps without decisions |
| 7 | `ghuntley/how-to-ralph-wiggum` | Fresh-context outer loop | disk state; fresh iteration; tests/build as backpressure | add explicit sandbox/limits | unsandboxed permission bypass; note repo is a playbook/fork around Huntley’s technique |
| 8 | `ghuntley/how-to-build-a-coding-agent` | Understand coding-agent internals | simple tool/control-loop mental model | reference, not runtime dependency | rebuilding a harness without need |
| 9 | `earendil-works/pi` | Minimal extensible coding-agent harness | small core; extensions; harness-neutral mindset | use as architectural reference | treating “project trusted” as sandbox; unreviewed packages |
| 10 | `gastownhall/beads` | Persistent dependency-aware work state | issue/dependency graph concept | optional adapter/backend | hard dependency in VibeOS core |
| 11 | `danielmiessler/LifeOS` | Persistent AI OS/self-improvement | routing, explicit LEARN, purpose-based memory | coding-only subset | general life-OS scope and context bloat |
| 12 | `humanlayer/12-factor-agents` | Production agent design principles | own context/control flow; small focused agents; resumability; compact errors | map app-agent ideas onto coding workflows | treating model as entire application/control plane |
| 13 | `mattlgroff/pbc` | Research->Plan->Implement->Review across agents | execution packets; parallel recon; independent reviewer | tool/model agnostic implementation | fixed provider/model assumptions |
| 14 | `pedrohcgs/claude-code-my-workflow` | Requirement discipline + adversarial QA + context survival | MUST/SHOULD/MAY; CLEAR/ASSUMED/BLOCKED; fresh verifier; handoffs | reduce reviewer count; severity gates | advisory “scores” as hard truth; academic-specific bulk |
| 15 | `Aider-AI/aider` | Mature coding-agent reference implementation | repo-map/context indexing idea; git checkpoints; test-fix loop | borrow ideas, not couple system | assuming one harness solves orchestration/memory/UI |
| 16 | `spencermarx/open-code-review` | Multi-agent requirements-aware review | requirements propagation; independent findings; persistent review artifacts | use multiple reviewers only for independent axes | reviewer swarms/discourse on small changes |
| 17 | `garrytan/gstack` | End-to-end AI software factory incl. UI QA | Think->Plan->Build->Review->Test->Ship->Reflect; live QA; screenshot/design review; skill routing | extract compact primitives | very large skills/always using all roles |
| 18 | `affaan-m/everything-claude-code` | Massive cross-harness reference pack | security/prompt-defense ideas; cross-tool examples; code-map/learning ideas | cherry-pick only | “install everything”; trigger/rule collisions; context bulk |
| 19 | `steipete/agent-scripts` | Canonical shared rules/skills/helpers across repos | short trigger descriptions; canonical skills; symlink adapters; validation scripts | simplify machine-specific assumptions | duplicated shared blocks in every repo |
| 20 | `steipete/poltergeist` | Fast continuous build feedback for humans/agents | fresh build guarantee; post-build tests; actionable errors | optional tool integration | making a watcher a required VibeOS dependency |
| 21 | `awrshift/claude-memory-kit` | Memory hygiene across long sessions/projects | immutable handoffs; memory caps; stale refs; observation->candidate->law; independent subagents | vendor-neutral file layout | “remember everything” marketing interpretation; automatic promotion without approval |
| 22 | `pbakaus/impeccable` | Frontend design vocabulary and anti-pattern checks | typography/color/spatial/motion/interaction/responsive vocabulary; deterministic anti-pattern idea | optional design pack layered on visual QA | design taste reduced to universal style rules |
| 23 | `gptme/gptme` | Persistent local autonomous agent + browser/tools | lessons/persistent agent concepts; tool/browser self-correction | reference runtime only | continuous autonomy without VibeOS sandbox policy |
| 24 | `citypaul/.dotfiles` | Practical cross-agent dotfiles + curated skills | modular install/discovery; curated specialized skill packs | use adapter approach, not personal environment | importing personal machine assumptions |
| 25 | `openai/codex` + current Codex docs | Current platform baseline | AGENTS layering, `.agents/skills`, symlink support, sandbox/worktrees | adapter-specific behavior stays outside kernel | coupling VibeOS semantics to one vendor |

## Standards / platform references (not practitioner ranking)

- Open Agent Skills specification — canonical `SKILL.md` format and progressive disclosure.
- Current Codex documentation — `AGENTS.md`, local skills, sandboxing, worktrees.
- Current Cursor documentation — project rules, Agent Skills, AGENTS.md support.
- Current Claude Code documentation — project memory/instructions, permissions and non-interactive limits.
