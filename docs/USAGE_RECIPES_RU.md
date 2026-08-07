# VibeOS 2 — рабочие рецепты

## Мелкая безопасная правка

```bash
./bin/vibeos route --intent fast
```

`FAST_PATCH`: inspect -> change -> targeted evidence -> diff review.

## Маленькая правка auth

```bash
./bin/vibeos route --intent fast --signal auth_permissions_security
```

Она автоматически эскалируется из fast lane; размер diff не отменяет риск.

## UI по скриншоту

Route `UI` + skills `visual-qa`, `accessibility-review`, `ui-reference-fidelity`. Сохрани финальные screenshots и runtime evidence.

## Обновление Next/React/SDK

Route `DEPENDENCY`: current usage -> primary migration docs -> compatibility changes -> build/runtime/targeted tests -> fresh review.

## Миграция БД

Route `MIGRATION`: инварианты, совместимость, rehearsal, postflight, rollback. Destructive step отдельно и human-gated.

## Production incident

Route `INCIDENT`: impact/evidence -> reversible mitigation -> stabilize -> root cause -> permanent fix -> regression guard -> learning.
