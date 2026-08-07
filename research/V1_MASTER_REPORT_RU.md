# IMON VibeOS v1 — итоговый отчет

Дата исследовательского среза: 2026-08-07

## Что сделано

Собрана первая рабочая версия переносимой операционной системы для серьезной AI-assisted разработки. Это не коллекция промптов и не форк одного чужого фреймворка.

VibeOS v1 синтезирует сильнейшие механики из 25 публичных репозиториев/систем и отделяет:

- то, что должно быть **всегда включено**;
- то, что должно **подгружаться только по задаче**;
- то, что должно жить как **durable artifact на диске**;
- то, что должно быть **детерминированной проверкой**;
- то, что полезно только как **опциональный внешний pack**;
- то, что я сознательно **отверг** как лишний церемониал, контекстный мусор или небезопасную автономность.

Главная формула v1:

`ROUTE -> UNDERSTAND -> SPEC -> PLAN -> BUILD -> VERIFY -> REVIEW -> SHIP -> LEARN`

Но это не линейный обязательный pipeline. Router выбирает минимальную достаточную траекторию.

---

# 1. Почему я не сделал очередной giant CLAUDE.md

После разбора реальных operational-файлов стало видно, что даже очень сильные системы со временем разрастаются.

- Superpowers дает мощную дисциплину, но способен заставить даже простую правку пройти дизайн-гейт.
- Compound Engineering отлично реализует compounding, но отдельные skills уже становятся полноценными программами оркестрации.
- gstack очень силен в продуктовой/browser QA, но его production skill runtime содержит большие preamble/config/telemetry слои.
- Everything Claude Code полезен как энциклопедия, но именно поэтому опасен как пакет «установить всё».

Поэтому VibeOS строится противоположно:

**короткий kernel -> маленький router -> маленькие scoped skills -> references/artifacts только когда они нужны.**

Это уменьшает trigger collision, stale context и противоречащие инструкции.

---

# 2. Что стало ядром

## Короткий `AGENTS.md`

В нем только 12 постоянных инвариантов:

1. route before acting;
2. inspect before edit;
3. define success;
4. verifiable slices;
5. evidence beats assertion;
6. creation != certification;
7. live visual QA for UI;
8. root-cause debugging;
9. curated memory;
10. security/autonomy boundaries;
11. stop conditions;
12. close the loop.

Подробные процедуры туда сознательно не помещены.

## 15 canonical Agent Skills

- `vibe-route`
- `inspect-codebase`
- `clarify-spec`
- `plan-slices`
- `research-primary`
- `implement-slice`
- `tdd-loop`
- `debug-root-cause`
- `verify-change`
- `code-review`
- `visual-qa`
- `security-review`
- `create-handoff`
- `promote-learning`
- `ship-change`

Все canonical skills vendor-neutral. В их телах нет зависимости от Claude/Codex/Cursor.

## 8 task workflows

### `FAST_PATCH`
Для очевидной низкорисковой правки.

`inspect -> change -> targeted verification -> diff review`

Это специально добавлено против чрезмерной бюрократии тяжелых agentic frameworks.

### `BUILD`
Новая функциональность/поведение.

`inspect -> acceptance/spec -> plan -> vertical slices -> verify -> independent review -> learn`

### `BUG`

`reproduce -> localize -> minimize -> hypotheses/instrument -> root-cause fix -> regression guard -> review`

### `UI`

`brief/spec -> inspect design system -> implement -> live browser -> responsive screenshots -> runtime checks -> visual critique -> review`

### `RESEARCH`

`question -> primary sources -> evidence artifact -> verified/inferred/unresolved -> recommendation`

### `EPIC`
Для cross-module и long-horizon work.

`research -> architecture/spec -> dependency graph -> execution packets -> isolated worktrees -> integration -> full verification`

### `REVIEW`
Requirements-aware независимая проверка без автоматического переписывания всего кода.

### `SHIP`
Финальные gates, evidence, release risk, approval semantics.

---

# 3. Главные механики, которые были украдены в хорошем смысле

## Из Superpowers

- сначала понять намерение/контракт, потом код;
- implementation plan должен быть executable fresh agent'ом;
- exact files/interfaces/tests вместо vague todo;
- TDD/debug/review discipline;
- isolation/worktrees.

**Не взято:** обязательная тяжелая процедура для каждой мелочи.

## Из Compound Engineering

- work должен делать следующий work дешевле;
- после решения есть отдельная стадия LEARN/COMPOUND.

**Изменено:** learning не становится правилом автоматически. Сначала evidence + scope + recurrence.

## Из Matt Pocock Skills

- small composable skills;
- context pointers;
- progressive disclosure;
- shared domain language;
- не кешировать в prompt то, что агент может дешево прочитать из environment;
- completion criteria вместо расплывчатого «разберись».

Это сильнее всего повлияло на форму VibeOS.

## Из Addy Osmani Agent Skills

- context hierarchy;
- source-driven development;
- ARTIFACT + CONTRACT для fresh reviewer;
- adversarial review как проверка, а не просьба «подтверди что все хорошо»;
- external content = untrusted data;
- UI/browser как engineering surface.

## Из Hamel Husain

- evaluator тоже может ошибаться;
- subjective review должен калиброваться;
- нельзя путать confidence с evidence.

Отсюда появился отдельный eval scaffold.

## Из Ralph

- fresh context;
- durable state на диске;
- outer loop;
- tests/build/type/browser как backpressure.

**Не взято:** permission bypass без реального sandbox.

## Из PBC / Open Code Review / Pedro Sant'Anna

- execution packets;
- независимый reviewer;
- bounded fix-review loop;
- requirement states;
- reviewer получает contract/evidence, а не self-justification автора.

## Из AWRShift Memory Kit

- memory = hot cache, не архив;
- immutable handoffs;
- stale-reference awareness;
- timestamp volatile facts;
- `observation -> candidate -> verified -> promote`;
- one home per fact.

## Из gstack + Impeccable

- UI нельзя сертифицировать чтением JSX/CSS;
- live browser;
- responsive viewports;
- interaction states;
- console/network;
- screenshot evidence;
- explicit design vocabulary;
- проверка AI-generic visual patterns.

## Из Peter Steinberger agent-scripts

- один canonical skill body;
- tool-specific adapters/links;
- skill descriptions как routing layer;
- deterministic validation script.

## Из 12-Factor Agents / Pi / Codex security model

- control flow должен быть внешним и inspectable;
- small focused roles;
- approval prompt != sandbox;
- unattended autonomy — это проблема containment, а не «напиши агенту быть осторожным».

---

# 4. Самое важное для веб-разработки

Обычные AI coding setups переоценивают unit tests и недооценивают реальный продукт.

Для UI VibeOS считает работу незавершенной, пока применимый review не проверил:

- реальный запущенный интерфейс;
- desktop/laptop/mobile;
- реальные клики/переходы/формы;
- loading;
- empty;
- error;
- disabled;
- success;
- console errors;
- failed network calls;
- overflow/collision;
- hierarchy;
- typography;
- spacing;
- consistency;
- basic accessibility;
- признаки generic AI design;
- screenshot evidence для материальных изменений.

Default viewports в шаблоне:

- `1440 x 900`
- `1280 x 800`
- `390 x 844`

Их нужно адаптировать под реальный продукт.

---

# 5. Архитектура памяти

VibeOS сознательно не делает «бесконечный мозг агента».

Четыре слоя:

1. **Stable current project grounding** — `context/`.
2. **Immutable handoffs** — `work/handoffs/`.
3. **Verified reusable learnings** — `work/learnings/`.
4. **Mature durable encoding** — test/type/schema/linter/code/context/skill/AGENTS rule.

Приоритет сохранения знания:

`code invariant/type/schema -> test -> linter/check -> docs/context -> skill -> AGENTS rule`

То есть если правило можно превратить в failing test, это лучше, чем заставлять модель вспоминать текстовую инструкцию.

---

# 6. Fresh-context review

Одна из самых важных идей v1:

**implementer не имеет права быть единственным доказательством собственной корректности.**

Для non-trivial work final reviewer/verifier получает:

- requirement/spec;
- standards;
- diff/artifact;
- evidence;

И не получает длинное объяснение автора, почему его решение якобы правильное.

Review severity:

- `BLOCKER`
- `MAJOR`
- `MINOR`
- `NIT`

Default fix/re-review loop ограничен двумя раундами. Если проблема не сходится, нужно остановиться и переосмыслить решение, а не бесконечно гонять агента.

---

# 7. Autonomy model

Default: **supervised**.

Unattended разрешается только когда существуют реальные ограничения:

- enforced sandbox;
- limited filesystem scope;
- limited credentials;
- bounded network/tool access;
- isolated worktree;
- max iterations;
- max repeated failures;
- stop conditions;
- no unattended production access.

`--dangerously-skip-permissions`-подобный подход на обычной рабочей машине не считается архитектурой автономности.

---

# 8. Optional packs вместо dependency hell

В core не включены как зависимости:

- Beads;
- Poltergeist;
- gstack;
- Impeccable;
- Open Code Review;
- Aider;
- Pi.

Для них создан `docs/OPTIONAL_PACKS_RU.md` с условиями подключения.

Причина простая: VibeOS должен продолжать работать, даже если внешний инструмент изменился или вообще не нужен конкретному проекту.

---

# 9. Cross-harness layout

Canonical skills:

`skills/<name>/SKILL.md`

Adapters:

- Codex/Open Agent Skills: `.agents/skills -> ../skills`
- Cursor: `.cursor/skills -> ../skills`
- Claude Code: flat links `.claude/skills/<name> -> ../../skills/<name>`

`CLAUDE.md` не дублирует kernel — он указывает на `AGENTS.md`.

Это убирает главный класс будущих проблем: три почти одинаковых набора правил, которые через месяц начинают противоречить друг другу.

---

# 10. Что проверяет doctor

`scripts/doctor.py` проверяет:

- обязательные kernel/context/policy/template файлы;
- размер `AGENTS.md`;
- Agent Skills frontmatter;
- совпадение имени skill и directory;
- duplicate skill names;
- лимит description;
- подозрительно большие skills;
- router -> существование workflow;
- router -> существование skills;
- explicit local references внутри skills;
- битые adapter symlinks;
- неполный Claude adapter;
- project command placeholders.

Текущее состояние шаблона:

**15 skills checked / 0 errors / 1 expected warning.**

Warning ожидаемый: `.vibeos/config.toml` нельзя честно заполнить универсальными `dev/test/build/typecheck` командами — они должны быть извлечены из конкретного target repo.

---

# 11. Что я сознательно НЕ утверждаю

VibeOS v1 пока не является «доказанно лучшей системой мира».

Это был бы bullshit без benchmark.

Пока доказано другое:

- структура internally consistent;
- skill metadata валидна;
- router не ссылается на отсутствующие skills/workflows;
- adapters не битые;
- canonical skills vendor-neutral;
- архитектура основана на сравнении сильных публичных систем, а не на одном любимом repo.

Но не проведен controlled benchmark `vanilla agent vs VibeOS` на одинаковой модели и одинаковом corpus задач.

Поэтому добавлен `evals/BENCHMARK_PLAN.md`.

---

# 12. Как должен выглядеть реальный benchmark

100 реальных задач:

- 20 fast patches;
- 20 bugs;
- 20 medium features;
- 20 UI tasks;
- 10 epics/refactors;
- 10 research/API/dependency tasks.

Сравнение:

`same model + same repo + same starting commit`

A. vanilla agent

B. VibeOS

При необходимости C. тяжелый framework.

Измерять:

- acceptance success;
- regressions;
- hidden test failures;
- UI/runtime defects;
- false completion claims;
- human interventions;
- human cleanup time;
- retries;
- tool calls;
- latency/cost;
- review precision;
- stale context errors.

И потом делать **ablation**: удалять отдельные механики VibeOS. Если правило красиво звучит, но не улучшает outcome — удалить его.

---

# 13. Главные файлы в архиве

## Начать отсюда

- `README.md`
- `AGENTS.md`
- `docs/QUICKSTART_RU.md`
- `docs/ARCHITECTURE_RU.md`
- `docs/INTEGRATION_PROMPT_FOR_CODEX.md`

## Исследование

- `research/DEEP_DIVE_25.md`
- `research/SOURCE_MATRIX.md`
- `research/LAYER_WINNERS.md`
- `research/ARCHITECTURAL_FINDINGS.md`
- `research/RANKED_REPOS.md`
- `research/INSPECTION_DEPTH.md`
- `research/ANTI_PATTERNS.md`
- `research/SOURCES.md`
- `research/V1_LIMITATIONS.md`

## Проверка

- `scripts/doctor.py`
- `research/DOCTOR_REPORT.txt`

## Будущие evals

- `evals/BENCHMARK_PLAN.md`
- `evals/ROUTING_CASES.md`
- `evals/TASK_SCHEMA.md`
- `evals/SCORECARD.md`

---

# 14. Как использовать на реальном репозитории

Не надо просто копировать папку и сразу кодить.

Правильная интеграция:

1. Агент сначала анализирует существующие `AGENTS.md`, `CLAUDE.md`, Cursor rules, scripts, CI, package files и test/build commands.
2. VibeOS используется как template/source architecture.
3. Существующие хорошие project rules сохраняются.
4. Конфликты дедуплицируются, а не складываются слоями.
5. `context/` заполняется только проверенными фактами из target repo.
6. `.vibeos/config.toml` получает настоящие команды проекта.
7. UI verification адаптируется под реальные routes/viewports/design system.
8. Запускается `doctor.py`.
9. Только после этого начинается product work.

Готовый промпт для этого находится в `docs/INTEGRATION_PROMPT_FOR_CODEX.md`.

---

# 15. Что я считаю сильнейшим результатом этого ресерча

Не конкретный prompt и не конкретный repo.

Самая сильная комбинация выглядит так:

**Superpowers discipline**
+
**Matt Pocock progressive disclosure**
+
**Compound Engineering verified learning**
+
**PBC/fresh reviewers**
+
**AWRShift memory hygiene**
+
**gstack/Impeccable visual QA**
+
**Hamel-style evidence/evals**
+
**Ralph disk-state/fresh-context loop**
+
**Peter-style canonical adapters**
+
**technical sandbox boundaries**

Но только если все это уменьшить до небольшого composable core.

Именно это VibeOS v1 и делает.
