# Prompt: интеграция VibeOS 2 в проект через OpenAI Codex

```text
Интегрируй IMON VibeOS 2 в этот репозиторий как Codex-native operating layer.

1. Сначала прочитай существующий AGENTS.md и проектные conventions. Не перезаписывай доменные правила вслепую.
2. Подключи только Codex surfaces: `.agents/skills`, `.agents/plugins/marketplace.json`, `plugins/vibeos` и VibeOS runtime. Не создавай `.claude`, `.cursor` или другие agent adapters.
3. Запусти `./bin/vibeos bootstrap` и сверь найденные install/dev/lint/typecheck/test/build/e2e команды с реальными manifest/CI/config файлами.
4. Заполни context/PROJECT.md, DOMAIN.md, ARCHITECTURE.md и DEFINITION-OF-DONE.md только подтвержденными фактами и моими явными решениями.
5. Не добавляй secrets, tokens или private credentials в VibeOS artifacts.
6. Запусти `./bin/vibeos codex install`, затем `./bin/vibeos doctor` и релевантные проектные checks.
7. Покажи итоговый diff, evidence и любые смысловые конфликты между существующим AGENTS.md и VibeOS. Не решай такие конфликты молча.
8. Финальный runtime — только OpenAI Codex.
```
