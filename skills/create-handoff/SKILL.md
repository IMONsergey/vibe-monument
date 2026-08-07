---
name: create-handoff
description: "Create a compact durable handoff so a fresh session or agent can continue without replaying the conversation. Use before context reset, long pauses, agent changes, or when work spans sessions."
---

# Create a durable handoff

1. Re-ground in current code, spec/plan and latest evidence before writing.
2. Record only verified current state; mark assumptions explicitly.
3. Include:
   - goal;
   - branch/worktree;
   - current spec/plan;
   - completed work;
   - exact remaining work in priority order;
   - decisions made;
   - evidence/results;
   - blockers/risks;
   - next best action;
   - files a fresh agent should load first.
4. Save as a new immutable timestamped file under `work/handoffs/` using `templates/HANDOFF.md`.
5. Do not rewrite old handoffs to pretend they are current. New session = new handoff.

Keep it compact enough that it is cheaper to load than the conversation it replaces.
