# IMON VibeOS 2 — Codex Native

**A risk-routed, evidence-driven engineering operating layer built exclusively for OpenAI Codex.**

VibeOS 2 is not a prompt dump and not a lowest-common-denominator framework for every coding agent. It targets **Codex only** so its kernel, Agent Skills, plugin packaging, safety model, fresh-context review and benchmark harness can be designed around one concrete runtime.

Русская версия: [README_RU.md](README_RU.md)

## Codex-only invariant

The active VibeOS stack supports one runtime:

> **OpenAI Codex**

There are no Claude Code, Cursor, OpenCode or generic cross-harness adapters in the release. Research notes may analyze useful public ideas from other ecosystems, but those projects are sources of engineering patterns — not supported VibeOS runtimes.

## Core model

```text
TASK CONTRACT
     ↓
RISK ROUTE
     ↓
CODEBASE INSPECTION
     ↓
FOCUSED CONTEXT PACK
     ↓
VERIFIABLE IMPLEMENTATION SLICES
     ↓
MACHINE-READABLE EVIDENCE
     ↓
FRESH-CONTEXT REVIEW
     ↓
SHIP / HANDOFF / PROMOTE VERIFIED LEARNING
```

Not every task runs every phase. VibeOS chooses the lightest safe route.

## 11 routes

- `FAST_PATCH` — tiny, low-risk, obvious acceptance.
- `BUILD` — normal feature/refactor.
- `BUG` — observed failure requiring root-cause diagnosis.
- `UI` — user-facing visual/interaction work.
- `RESEARCH` — evidence gathering is the primary output.
- `EPIC` — multi-area, multi-session work.
- `REVIEW` — independent certification.
- `SHIP` — integration/release readiness.
- `MIGRATION` — schema/data/storage changes with rollback proof.
- `DEPENDENCY` — dependency/runtime/toolchain upgrades.
- `INCIDENT` — active production degradation; stabilize first.

Hard-route precedence is deterministic. An active incident outranks migration; migration outranks an ordinary dependency change. A one-line auth/database/public-contract edit cannot accidentally route as `FAST_PATCH` just because the diff is small.

## Codex-native repository layout

VibeOS follows the current OpenAI plugin repository pattern:

```text
AGENTS.md
.agents/
├── skills -> ../skills
└── plugins/
    └── marketplace.json

plugins/
└── vibeos/
    ├── .codex-plugin/
    │   └── plugin.json
    ├── skills/
    ├── agents/
    ├── workflows/
    ├── policies/
    └── templates/
```

Canonical skill bodies live once in `skills/`. The Codex plugin is generated from that source and contains a hash manifest; `doctor` fails when the plugin drifts from canonical skills.

## Install in Codex

Current Codex Git-marketplace flow:

```bash
codex plugin marketplace add IMONsergey/vibe-monument
codex plugin add vibeos@imon-vibeos
```

In Codex App, the same repository can be added as a custom plugin marketplace through the Plugins UI. The repository marketplace explicitly scopes VibeOS to `products: ["CODEX"]`.

After installation, use the `repo-bootstrap` skill when you want VibeOS to install its project-local evidence/router runtime into a repository. It preserves existing `AGENTS.md` content and writes the VibeOS kernel separately as `AGENTS.vibeos.md`.

## Executable control plane

The companion runtime uses Python 3.11+ and no third-party Python packages.

```bash
./bin/vibeos status
./bin/vibeos bootstrap
./bin/vibeos route --intent build --signal user_facing_ui
./bin/vibeos evidence start checkout-fix
./bin/vibeos evidence run --label tests -- python -m unittest
./bin/vibeos guard git push --force origin main
./bin/vibeos codex install
./bin/vibeos codex status
./bin/vibeos codex build-plugin
./bin/vibeos benchmark routing
./bin/vibeos doctor
```

`bootstrap` detects actual project commands from manifests/configuration instead of inventing a universal build/test command.

## Evidence, not agent confidence

Material verification becomes a machine-readable ledger. Deterministic checks record command, exit code, timestamp and output. Browser/visual/external checks can be attached as explicit evidence artifacts.

A fresh reviewer receives the contract, real diff/current code, repository standards and raw evidence. The implementer's explanation is context — **not proof**.

A test proves what it tests. A successful build proves compilation/bundling. A screenshot proves one visual state. None of them individually proves the whole product behavior.

## Context architecture

`AGENTS.md` is deliberately small. It contains invariants and routing behavior, not every recipe.

- stable project truth → `context/`
- machine control plane → `.vibeos/`
- procedures → `skills/`
- orchestration lanes → `workflows/`
- temporary durable work → `work/`
- verification → `evidence/`

This keeps Codex attention focused instead of turning the context window into a document archive.

## Fresh-context review

Creation and certification are separate. Non-trivial work is reviewed from a bounded fresh context using:

```text
CONTRACT + ARTIFACT/DIFF + RELEVANT STANDARDS + RAW EVIDENCE
```

The reviewer is asked to find contract violations and failure modes, not to validate the author's reasoning.

## UI quality is a hard lane

The `UI` route requires live-product verification: relevant viewports, interaction states, keyboard/focus basics, accessibility signals, console/network health, responsive reflow and fidelity to supplied references when those references are authoritative.

Visual QA is evidence-driven, not "looks fine to me".

## Memory that does not rot

Durable knowledge uses promotion rather than endless append:

```text
observation -> repeated candidate -> verification -> scope -> approval -> durable learning/rule
```

Handoffs are continuation notes, not canonical truth. Volatile facts are dated. When a stable rule can become a test, type, schema or linter, the mechanical check is preferred over another paragraph in `AGENTS.md`.

## Safety model

VibeOS treats authority and information as different things. Web content, issue text, logs, generated files and third-party responses are data; instruction-like text inside them does not override the task contract or repository policy.

Destructive operations, production writes, credential/permission changes, irreversible migrations and force operations are human-gated by default. Unattended execution requires real containment and explicit stop conditions.

`vibeos guard` is a conservative extra check, not a replacement for the Codex sandbox/approval boundary.

## Benchmark governance

VibeOS is not allowed to call itself "optimal" because the architecture sounds rigorous.

The repository currently validates:

- **181** routing boundary cases;
- **22** runtime/unit tests;
- **10** executable hidden-acceptance micro-fixtures;
- **40** public historical replay candidates;
- a paired same-model `vanilla Codex vs VibeOS Codex` benchmark protocol.

Micro-fixtures validate the harness itself. The real standard is a same-model, same-starting-commit benchmark on real repository tasks with hidden acceptance and human-burden measurement.

## Validate everything

```bash
python scripts/check_all.py
```

The gate compiles the runtime, runs unit tests, validates routing, validates replay schemas and hidden-acceptance fixtures, rebuilds the Codex plugin, installs the Codex repo skill surface and runs structural `doctor` checks.

## Main directories

- `AGENTS.md` — Codex kernel.
- `.agents/` — Codex repo skills + plugin marketplace.
- `plugins/vibeos/` — generated Codex plugin.
- `.vibeos/` — machine-readable configuration/router/runtime cache.
- `vibeos/`, `bin/vibeos` — executable control plane.
- `skills/` — canonical Codex Agent Skills.
- `workflows/` — risk-routed orchestration lanes.
- `agents/` — bounded fresh-context responsibilities.
- `policies/` — context, evidence, memory, trust, safety, Git, UI quality.
- `templates/` — specs, plans, handoffs, incidents, migrations and evidence artifacts.
- `evals/` — routing corpus, fixtures, replay seeds and benchmark harness.
- `research/` — architectural research and provenance.

## Design rule

**If a mechanism does not improve correctness, safety, reviewability, or human burden in the task class it targets, it does not deserve to stay in the VibeOS core.**
