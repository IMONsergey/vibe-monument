# Optional packs

VibeOS 2 намеренно не vendor-lock'ится на большие сторонние frameworks. Их стоит подключать только при конкретной необходимости.

- **Beads** — persistent dependency/task graph для очень длинных multi-agent проектов.
- **Poltergeist / build watchers** — короткий feedback loop в проектах с дорогой сборкой.
- **gstack** — богатые specialized QA/design workflows, если их runtime overhead оправдан.
- **Impeccable / frontend design skills** — дополнительный design-critique слой.
- **Aider / Pi** — альтернативный coding-agent runtime/harness.
- **Open Code Review / specialized reviewers** — дополнительная независимая review-мощность.

Правило: external pack не становится фундаментом VibeOS. Core должен продолжать работать, если pack исчез, изменил API или не подходит конкретному стеку.
