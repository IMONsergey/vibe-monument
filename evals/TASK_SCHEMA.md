# Real-task record schema

Each real benchmark task should record:

```json
{
  "id": "repo-task-001",
  "class": "BUG",
  "repository": "owner/repo",
  "starting_commit": "immutable sha",
  "request": "original user request",
  "acceptance": ["hidden/deterministic criteria"],
  "public_checks": ["commands agent can know"],
  "hidden_checks": ["runner-owned checks"],
  "permissions": "equivalent policy for both variants",
  "viewports": ["1440x900", "390x844"],
  "known_traps": ["scoring-only notes, not shown to agent"]
}
```

Keep hidden scoring material outside the agent workspace. Preserve the original task request rather than rewriting it to favor VibeOS concepts.
