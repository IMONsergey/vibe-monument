---
name: dependency-upgrade
description: "Upgrade a framework, library, runtime, SDK, or tool using current primary release/migration documentation and targeted compatibility evidence. Use when external dependency behavior or version changes are part of the task."
---

# Dependency upgrade

1. Record current and target versions and why the upgrade is needed.
2. Read primary release notes/migration guides for every crossed breaking boundary.
3. Inspect repository usage of changed/deprecated APIs before editing.
4. Separate mechanical version/lockfile changes from compatibility code changes when useful for review.
5. Run targeted tests for touched integration surfaces plus the relevant project gates.
6. Inspect transitive/security implications and lockfile diff; reject unrelated churn.
7. For runtime/framework upgrades, exercise a real startup/build path, not only static type checks.
8. Record verified migration notes; label anything inferred from incomplete docs.
