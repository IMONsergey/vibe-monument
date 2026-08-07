# Initial routing test cases

Use these as the first smoke set for `vibe-route`. They are intentionally small; real benchmark cases should be collected from actual repositories.

| Request shape | Expected route | Why |
|---|---|---|
| "Fix typo in one label" | FAST_PATCH | mechanical, tiny blast radius |
| "Rename this local variable" | FAST_PATCH | no behavior change |
| "Update dependency to new major version" | RESEARCH or BUILD | current API/migration knowledge required |
| "Login sometimes loops back to /login" | BUG | reproduce/root cause/regression required |
| "Add passwordless login" | BUILD | new user behavior/security contract |
| "Make this landing page match Figma exactly" | UI | browser/visual evidence required |
| "Mobile card overflows at 390px" | UI or BUG | visual runtime defect; UI verification required |
| "Replace REST API with GraphQL" | EPIC | cross-cutting architecture/public contract |
| "Review this PR" | REVIEW | no implementation requested initially |
| "Deploy current approved release" | SHIP | release gates/approval semantics |
| "Which auth library should we use today?" | RESEARCH | current primary-source comparison |
| "Change DB primary key type" | EPIC | migration/irreversibility risk |
| "Add a missing null check where failing test already identifies exact line" | FAST_PATCH or BUG | route depends on confidence/blast radius; router should escalate if root cause unclear |
| "Improve performance" | BUILD/RESEARCH | too vague for direct editing; clarify/measure first |
| "Make it look more premium" | UI | ambiguous visual goal + live QA |
