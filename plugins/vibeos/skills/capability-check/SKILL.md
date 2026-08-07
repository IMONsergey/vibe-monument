---
name: capability-check
description: "Check whether the current agent host actually has the tools needed by a planned workflow and choose a safe fallback when it does not. Use before browser QA, parallel subagents, sandboxed autonomy, external source research, or other capability-dependent work."
---

# Capability check

For each required workflow capability, classify it as `AVAILABLE`, `DEGRADED`, or `MISSING` with evidence from the current host.

Common capabilities:

- file read/edit/search;
- shell command execution;
- isolated worktrees/branches;
- fresh-context subagents;
- current web/primary-source research;
- live browser + screenshots + console/network inspection;
- sandbox/read-only execution;
- GitHub/PR actions.

If a hard quality gate depends on a missing capability, do not silently substitute confidence. Use a documented fallback, ask for the missing evidence/tool when human action is necessary, or mark the acceptance criterion unverified.
