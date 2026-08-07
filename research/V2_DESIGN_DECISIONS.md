# VibeOS 2 design decisions — 2026-08-07

V2 builds on the v1 deep-dive but changes the framework where execution evidence exposed weak spots.

## D1 — Instructions + executable control plane

V1 had a good kernel/router concept but its router/config were effectively interpreted prose. V2 uses TOML read by a dependency-free Python runtime for deterministic risk routing, structural validation, evidence capture and adapter builds.

**Take:** executable invariants where a machine can check them.
**Reject:** pretending every engineering judgment can be reduced to a numeric score.

## D2 — Hard routes for migrations, dependencies and incidents

Diff size is a poor proxy for blast radius. A one-line auth/schema/production change can be more dangerous than a 500-line local refactor. V2 therefore has dedicated workflows and deterministic precedence for active incidents/migrations/dependency changes.

## D3 — Evidence ledger

Completion is certified from raw checks rather than the implementer's narrative. V2 records deterministic commands directly and external/browser evidence by artifact reference.

## D4 — Context packets

Fresh context is useful only when the receiving agent gets a complete bounded contract. V2 formalizes a context-pack skill rather than using "start a new agent" as a magic correctness technique.

## D5 — Trust zones

Repository/web/tool text can contain instruction-like content. V2 makes authority explicit: fetched/logged/generated content is evidence/data and cannot override user/kernel policy.

## D6 — UI = visual + runtime + accessibility + reference fidelity

Generic coding frameworks routinely stop at tests. V2 treats live UI as a separate evidence domain and adds accessibility/reference/performance specialists only when applicable.

## D7 — Generated Codex plugin, canonical skill source

OpenAI's current plugin examples package each Codex plugin with `.codex-plugin/plugin.json` plus optional `skills/`, agents, hooks and other surfaces. V2 generates a release bundle from canonical skills and stores source hashes so the bundle cannot drift silently.

## D8 — Framework changes are benchmark-governed

The framework itself can accumulate "process debt". V2 requires failure-mode/routing/eval justification for core additions and explicitly plans ablations after a real A/B benchmark.
