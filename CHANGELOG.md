# Changelog

## 2.0.0 — 2026-08-07

VibeOS 2 changes the project from a prompt/workflow template into an executable, benchmark-governed engineering layer.

### Added
- dependency-free `vibeos` Python CLI;
- deterministic risk router with hard-route precedence;
- project command/bootstrap detection and mechanical repo map;
- machine-readable evidence ledger;
- conservative command guard for destructive operations;
- executable Codex plugin build + repo-local marketplace manifest;
- 181 routing boundary cases;
- 22 runtime/unit tests;
- 10 executable hidden-check agent benchmark fixtures;
- fresh skills for adversarial review, context packing, accessibility, performance, reference fidelity, migrations, dependency upgrades and incidents;
- trust-zone, evidence and UI-quality policies;
- GitHub Actions self-validation.

### Codex-native release decision
- VibeOS 2 now targets OpenAI Codex exclusively;
- removed Claude Code, Cursor and generic cross-harness active surfaces;
- plugin packaging now mirrors `openai/plugins`: `.agents/plugins/marketplace.json` -> `plugins/vibeos/.codex-plugin/plugin.json`;
- marketplace policy is explicitly scoped to `products: ["CODEX"]`;
- added plugin-bundled project runtime and `repo-bootstrap` installer that preserves existing `AGENTS.md`;
- added Codex-native integration tests and project-mode doctor validation.

### Changed
- canonical config/router migrated from ad-hoc YAML parsing to TOML (`tomllib`);
- `AGENTS.md` strengthened around task contracts, evidence, trust zones and benchmark governance;
- memory promotion now explicitly requires evidence and controlled promotion;
- UI workflow requires accessibility review in addition to visual/runtime QA;
- migrations, dependency upgrades and live incidents use dedicated workflows.

### Removed
- v1 command placeholders as the normal setup path; `vibeos bootstrap` now detects project commands;
- v1 root build reports/manifests from the distributable root.
