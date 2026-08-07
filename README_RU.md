# IMON VibeOS 2 — Codex Native

**Инженерная операционная система для вайбкодинга, построенная исключительно под OpenAI Codex.**

VibeOS 2 — не свалка промптов и не универсальный слой «для всех агентов сразу». Я сознательно оставил **только Codex**, чтобы не тащить компромиссы совместимости и использовать его нативные `AGENTS.md`, Agent Skills, plugins, sandbox/approval-модель и fresh-context работу как фундамент.

## Жесткий инвариант

Поддерживаемый runtime один:

> **OpenAI Codex**

В активном стеке нет `.claude`, `.cursor`, OpenCode и generic adapters. В `research/` могут встречаться разборы чужих подходов — мы берем оттуда инженерные идеи, но не поддерживаем их runtime.

## Что делает VibeOS

```text
КОНТРАКТ ЗАДАЧИ
      ↓
МАРШРУТ ПО РИСКУ
      ↓
АНАЛИЗ КОДОВОЙ БАЗЫ
      ↓
СБОР ТОЛЬКО НУЖНОГО КОНТЕКСТА
      ↓
РЕАЛИЗАЦИЯ МАЛЕНЬКИМИ ПРОВЕРЯЕМЫМИ СРЕЗАМИ
      ↓
MACHINE-READABLE EVIDENCE
      ↓
НЕЗАВИСИМОЕ FRESH-CONTEXT REVIEW
      ↓
SHIP / HANDOFF / ПРОДВИЖЕНИЕ ПРОВЕРЕННОГО ЗНАНИЯ
```

Главное: **не каждая задача проходит полный церемониал**. Система выбирает самый легкий маршрут, который не ломает надежность.

## 11 маршрутов

`FAST_PATCH`, `BUILD`, `BUG`, `UI`, `RESEARCH`, `EPIC`, `REVIEW`, `SHIP`, `MIGRATION`, `DEPENDENCY`, `INCIDENT`.

Маленький diff не означает маленький риск. Изменение auth, схемы БД, production или публичного контракта не может случайно стать `FAST_PATCH` только потому, что там одна строка.

## Структура сделана как Codex plugin

```text
AGENTS.md
.agents/
├── skills -> ../skills
└── plugins/
    └── marketplace.json

plugins/
└── vibeos/
    ├── .codex-plugin/plugin.json
    ├── skills/
    ├── agents/
    ├── workflows/
    ├── policies/
    └── templates/
```

То есть layout повторяет актуальный подход официального `openai/plugins`: marketplace на уровне репозитория, plugin — в `plugins/<name>/`.

## Установка в Codex

Актуальный Git-marketplace flow Codex:

```bash
codex plugin marketplace add IMONsergey/vibe-monument
codex plugin add vibeos@imon-vibeos
```

В Codex App тот же репозиторий можно добавить как custom marketplace через Plugins UI. В marketplace VibeOS жестко ограничен `products: ["CODEX"]`.

После установки используй skill `repo-bootstrap`, когда нужно развернуть в конкретном проекте локальные router/evidence/runtime-файлы. Он сохраняет существующий `AGENTS.md`, а VibeOS kernel кладет отдельно в `AGENTS.vibeos.md`.

## CLI

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

Runtime dependency-free на уровне Python-пакетов: Python 3.11+ и стандартная библиотека.

## Evidence вместо «я вроде проверил»

Существенные проверки пишутся в машиночитаемый ledger: команда, exit code, timestamp, output/artifact. Fresh reviewer получает реальный diff, контракт и сырые доказательства — а не рассуждения автора о том, почему его код хороший.

Тест доказывает только то, что тестирует. Build доказывает сборку. Screenshot доказывает один state на одном viewport. Это разные типы evidence.

## Контекст

`AGENTS.md` остается небольшим kernel. Все тяжелые процедуры лежат в skills и подгружаются только когда нужны.

- `context/` — стабильная правда о проекте;
- `.vibeos/` — machine-readable control plane;
- `skills/` — процедуры Codex;
- `workflows/` — orchestration lanes;
- `work/` — specs/plans/reviews/handoffs;
- `evidence/` — доказательства.

## UI — отдельный жесткий контур

Для пользовательских интерфейсов VibeOS требует живую проверку продукта: viewports, взаимодействия, loading/empty/error/success states, keyboard/focus, accessibility, console/network, responsive reflow и сравнение с референсом, если он задан.

## Память

```text
наблюдение -> повторившийся кандидат -> проверка -> scope -> подтверждение -> durable learning/rule
```

Мы не делаем вечный `MEMORY.md`, который через месяц начинает уверенно врать. Handoff — заметка для продолжения, а не канонический факт. Если правило можно превратить в test/type/schema/linter — это лучше текста.

## Безопасность

Внешняя документация, issue text, логи, generated files и web content считаются данными, а не командами более высокого приоритета.

Production writes, destructive actions, permission/credential changes, irreversible migrations и force-операции по умолчанию требуют человека. Автономный режим допустим только в реальном containment/sandbox с ограничениями и stop conditions.

## Бенчмарк

VibeOS не имеет права называть себя «лучшей» без измерения.

Сейчас в framework gate есть:

- **181** routing boundary case;
- **22** unit/runtime tests;
- **10** executable hidden-acceptance micro-fixtures;
- **40** public historical replay candidates;
- протокол paired benchmark `vanilla Codex vs VibeOS Codex` на одной модели и одном starting commit.

## Полная проверка

```bash
python scripts/check_all.py
```

Она компилирует runtime, запускает tests, routing benchmark, replay validation, hidden fixtures, пересобирает Codex plugin, синхронизирует `.agents/skills` и запускает doctor.

## Принцип VibeOS

**Если механизм не улучшает correctness, safety, reviewability или человеческую нагрузку на конкретном классе задач — он не должен жить в core.**
