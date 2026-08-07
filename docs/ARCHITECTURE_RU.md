# Архитектура IMON VibeOS 2 — Codex Native

## 1. Codex kernel

`AGENTS.md` — минимальный всегда загруженный контракт для Codex. Он задает инварианты, а подробные процедуры уходят в Agent Skills.

## 2. Machine-readable control plane

`.vibeos/config.toml` хранит project commands и quality/memory/autonomy policy. `.vibeos/router.toml` хранит workflows, skills, risk weights и hard routes. Runtime использует стандартный Python `tomllib`.

## 3. Codex Agent Skills

`skills/<name>/SKILL.md` — канонические процедуры. `.agents/skills -> ../skills` дает Codex repo-level discovery без дублирования. Plugin builder копирует skills в `plugins/vibeos/skills` для установки через marketplace.

## 4. Codex plugin

Структура повторяет официальный `openai/plugins`:

```text
.agents/plugins/marketplace.json
plugins/vibeos/.codex-plugin/plugin.json
plugins/vibeos/skills/
plugins/vibeos/agents/
plugins/vibeos/workflows/
plugins/vibeos/policies/
plugins/vibeos/templates/
```

Marketplace entry жестко ограничен `products: ["CODEX"]`. Doctor проверяет manifest, marketplace path и hash parity plugin skills с каноническими `skills/`.

## 5. Workflows и fresh-context review

Маршрут — orchestration lane, skill — специализированная процедура. Review roles описывают bounded responsibilities. Codex получает минимальный contract + diff + evidence, а не весь исторический разговор и не самооценку автора.

## 6. Evidence plane

`evidence/*.json` — машиночитаемые прогоны. `work/` — specs/plans/reviews/screenshots/handoffs/learnings. Narrative объясняет; evidence доказывает.

## 7. Memory

Handoff — continuation note, learning — проверенный reusable вывод, rule — зрелое ограничение. Если constraint можно надежнее выразить тестом/типом/schema/linter, механический gate предпочтительнее нового текста в prompt.

## 8. Eval governance

Routing tests, runtime unit tests, micro-fixtures и public replay seeds проверяют сам framework. Реальное преимущество над vanilla Codex должно измеряться paired same-model benchmark, а не заявляться по ощущениям.

## 9. Неподдерживаемые runtime

Claude Code, Cursor, OpenCode и другие агенты **не являются target runtime VibeOS 2**. Их публичные проекты могут оставаться в `research/` только как источники инженерных паттернов.
