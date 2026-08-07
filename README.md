# IMON VibeOS 2

**Risk-routed, evidence-driven operating layer for AI-assisted software engineering.**

VibeOS is not a prompt dump and not an autonomous permission bypass. It is a compact agent kernel + composable skills + executable guardrails + durable work artifacts + independent verification + live UI QA + a benchmark harness.

Russian documentation: [README_RU.md](README_RU.md)

## Why V2 exists

AI coding gets fast long before it gets reliably finished. Common failure modes are predictable:

- coding before the actual requirement is settled;
- huge always-loaded instruction files that dilute attention;
- stale context carried through long sessions;
- implementers certifying their own work;
- tests being treated as proof of untested UI/runtime behavior;
- migrations/auth/production work slipping through a "small patch" process;
- memory accumulating until old assumptions look authoritative;
- frameworks adding ceremony that has never been shown to improve outcomes.

VibeOS 2 encodes countermeasures as both **instructions and executable checks**.

## Core model

```text
CONTRACT -> ROUTE -> INSPECT -> PACK CONTEXT -> IMPLEMENT SLICES
        -> EVIDENCE -> FRESH REVIEW -> SHIP -> PROMOTE LEARNING
```

Not every task runs every phase. The router chooses the lightest safe workflow.

### Dedicated routes

`FAST_PATCH`, `BUILD`, `BUG`, `UI`, `RESEARCH`, `EPIC`, `REVIEW`, `SHIP`, `MIGRATION`, `DEPENDENCY`, `INCIDENT`.

Hard-route precedence is deterministic: an active incident beats migration; migration beats an ordinary dependency upgrade.

## Executable runtime

No third-party Python package is required.

```bash
./bin/vibeos status
./bin/vibeos bootstrap
./bin/vibeos route --intent build --signal user_facing_ui
./bin/vibeos evidence start checkout-fix
./bin/vibeos evidence run --label tests -- python -m unittest
./bin/vibeos guard git push --force origin main
./bin/vibeos adapters install
./bin/vibeos adapters build-codex
./bin/vibeos benchmark routing
./bin/vibeos doctor
```

`bootstrap` detects real project commands and writes a mechanical repo map instead of inventing a universal build/test command.

## Evidence, not confidence

Material work gets a machine-readable ledger under `evidence/`. Deterministic commands are recorded with exit status and output tail. Browser/screenshots/external checks can be attached as explicit evidence records.

Independent reviewers receive:

- approved task contract;
- actual diff/current code;
- repository standards;
- raw evidence ledger/artifacts.

They do **not** receive the implementer's self-justification as proof.

## Context + memory

The always-loaded `AGENTS.md` stays small. Branch-specific procedure lives in `skills/`. Specs, plans, review packets, evidence and handoffs live on disk.

Memory uses controlled promotion:

```text
observation -> repeat candidate -> verify -> scope -> approve -> promote
```

Whenever possible, a stable constraint should become a test/type/schema/linter rather than another paragraph in the prompt.

## UI/product quality

The `UI` route requires live-product QA plus accessibility review. When a screenshot/design is authoritative, `ui-reference-fidelity` compares against the actual reference. Performance-sensitive changes use measured before/after evidence.

A screenshot proves one state at one viewport; it does not prove interaction, accessibility or runtime health.

## Safety model

VibeOS explicitly separates authority from information. Web pages, issue text, logs, generated files and arbitrary repository prose are data, not higher-priority instructions.

Unattended execution requires containment. Production writes, destructive operations, permission/credential changes and irreversible migrations are human-gated by default.

`vibeos guard` catches common destructive shell patterns, but it is a guardrail — not a sandbox.

## Agent Skills + harness adapters

Canonical skills live once in `skills/`.

- `.agents/skills` — Codex-compatible repository skill discovery adapter.
- `.claude/skills` — flat Claude Code adapter.
- `.cursor/skills` — Cursor Agent Skills adapter.
- `dist/codex-plugin/vibeos/` — generated Codex plugin bundle with `.codex-plugin/plugin.json`.
- `.agents/plugins/marketplace.json` — repo-local custom marketplace entry generated with the bundle.

Generated adapters are validated against hashes of canonical skills so they cannot silently drift.

## Benchmark governance

VibeOS is not allowed to call itself "optimal" because the rules sound rigorous.

Current framework validation includes:

- **181** deterministic routing boundary cases;
- **20** Python runtime/unit tests;
- **10** executable agent micro-fixtures whose starting state fails hidden acceptance and whose reference solution passes;
- a harness for same-model `vanilla` vs `vibeos` A/B runs;
- a protocol for a future 100-task real-repository corpus.

The executable fixtures validate the benchmark machinery; they are **not** a substitute for the real-repository model benchmark. `evals/BENCHMARK_PLAN.md` defines that standard.

## Validate the whole repository

```bash
python scripts/check_all.py
```

This compiles the runtime, runs unit tests, runs the routing benchmark, validates all executable fixtures, rebuilds the Codex plugin, installs adapters and runs the structural doctor.

## Repository map

- `AGENTS.md` — small always-on kernel.
- `.vibeos/` — TOML routing/configuration and runtime state/cache.
- `vibeos/`, `bin/vibeos` — dependency-free executable runtime.
- `skills/` — canonical portable Agent Skills.
- `workflows/` — risk-routed orchestration lanes.
- `agents/` — fresh-context responsibilities/reviewer profiles.
- `policies/` — trust, evidence, context, memory, security, autonomy, Git, UI quality.
- `templates/` — task contract, spec, plan, migration, incident, review, handoff and evidence artifacts.
- `work/` — generated specs/plans/reviews/handoffs/learnings/visual QA.
- `evidence/` — machine-readable verification ledgers (ignored by default except `.gitkeep`).
- `evals/` — routing cases, executable fixtures, A/B harness and real-task benchmark protocol.
- `research/` — source analysis and design decisions.
- `dist/` — generated harness packages.

## Design rule

**If a mechanism does not improve correctness, safety, reviewability, or human burden in the task class it targets, it does not deserve to stay in the core.**
