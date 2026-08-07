# VibeOS 2 — быстрый старт для Codex

VibeOS 2 поддерживает **только OpenAI Codex**. Других runtime/adapters в активном стеке нет.

## Внутри репозитория VibeOS

```bash
./bin/vibeos codex install
./bin/vibeos codex status
./bin/vibeos status
python scripts/check_all.py
```

`codex install` делает две вещи: подключает канонические skills через `.agents/skills` и пересобирает официальный-style plugin в `plugins/vibeos/` + `.agents/plugins/marketplace.json`.

## Установка marketplace в Codex

Репозиторий уже содержит marketplace в формате Codex. Для Git-установки используйте Codex plugin marketplace, указывая этот GitHub-репозиторий. На текущих версиях Codex управление plugin marketplace выполняется через Codex UI или `codex plugin marketplace ...`; точный доступный интерфейс зависит от установленной версии Codex, поэтому VibeOS не хардкодит неподтвержденную команду установки.

После установки plugin VibeOS skills доступны Codex из plugin package. При разработке самого VibeOS repo Codex также видит `.agents/skills`.

## После переноса runtime в рабочий проект

```bash
./bin/vibeos bootstrap
./bin/vibeos codex install
./bin/vibeos doctor
```

Проверь `.vibeos/config.toml`: детектор не должен выдумывать команды, которых нет в проекте. Заполни `context/PROJECT.md`, `DOMAIN.md`, `ARCHITECTURE.md`, `DEFINITION-OF-DONE.md` только устойчивыми подтвержденными фактами.

## Маршрутизация

```bash
./bin/vibeos route --intent fast --signal user_facing_ui
./bin/vibeos route --intent build --signal auth_permissions_security
./bin/vibeos route --intent build --signal data_model_or_migration
```

## Evidence

```bash
./bin/vibeos evidence start checkout
./bin/vibeos evidence run --label targeted-tests -- python -m unittest tests.test_checkout
./bin/vibeos evidence record --label desktop-ui --status pass --artifact work/visual-qa/checkout-1440.png
./bin/vibeos evidence close
```

Failed checks сохраняются; ledger нельзя «причесать» удалением неудобных результатов.
