---
name: context-pack
description: "Create a focused fresh-context packet for a bounded implementation or review task. Use when an epic is split across agents/sessions, context is long, or a worker needs exactly the contract and repository evidence required for one slice."
---

# Context pack

Create the smallest packet that lets a fresh agent act correctly without inheriting stale conversation history.

Include:

- task outcome and acceptance criteria;
- exact scope and protected/out-of-scope boundaries;
- relevant spec/ADR excerpts by path;
- files/interfaces to inspect or modify;
- one canonical existing pattern when useful;
- known constraints and verified gotchas;
- commands/evidence required for completion;
- dependencies on prior slices and outputs promised to later slices.

Exclude:

- brainstorming history once the decision is settled;
- implementer self-justification;
- unrelated repository documentation;
- raw logs when a precise error excerpt is enough;
- speculative requirements.

Save execution packets with `templates/EXECUTION_PACKET.md` when the handoff must survive a session boundary.
