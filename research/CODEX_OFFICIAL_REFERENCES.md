# Codex-native primary references

Checked: 2026-08-07.

VibeOS 2 uses OpenAI Codex as its only target runtime. These are the primary references used for the release architecture.

## OpenAI plugin repository

- https://github.com/openai/plugins
- Repository layout: `.agents/plugins/marketplace.json` + `plugins/<name>/.codex-plugin/plugin.json`.
- Plugin companion surfaces documented by OpenAI include `skills/`, plugin-level `agents/`, `commands/`, hooks, apps/MCP and assets where applicable.

## Official plugin manifest examples

- https://github.com/openai/plugins/blob/main/plugins/build-web-apps/.codex-plugin/plugin.json
- https://github.com/openai/plugins/blob/main/plugins/superpowers/.codex-plugin/plugin.json
- VibeOS follows the same `skills: "./skills/"` and interface metadata shape.

## Codex plugin creator assets

- https://github.com/openai/codex/blob/main/codex-rs/skills/src/assets/samples/plugin-creator/SKILL.md
- https://github.com/openai/codex/blob/main/codex-rs/skills/src/assets/samples/plugin-creator/references/plugin-json-spec.md
- Used for manifest/path conventions and validation expectations.

## Codex workflow direction

- https://developers.openai.com/codex/use-cases
- OpenAI explicitly presents reusable skills, codebase analysis, browser/computer QA, security review and scored improvement loops as Codex workflows. VibeOS composes those ideas into a risk-routed engineering layer.

## Current marketplace CLI behavior

- `codex plugin marketplace add <git-source>` and `codex plugin add <plugin@marketplace>` are present in current public Codex implementation/issues as of the checked date.
- Plugin installation UX is evolving, so VibeOS keeps its committed marketplace/manifest canonical and avoids depending on undocumented cache paths.
