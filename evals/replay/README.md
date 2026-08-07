# Public historical replay seeds

This corpus contains **candidate replay tasks harvested from public Git history**, not fabricated prompts.

For each row:

1. clone `repository_url`;
2. resolve `target_sha^1` as the baseline (skip if the commit has no parent or is unsuitable);
3. give the agent only the baseline tree + `task`;
4. keep `target_sha` hidden as the historical oracle;
5. create/validate task-specific acceptance checks before the pair is admitted to the certified benchmark.

The historical diff is **not** the grading target. Different implementations may be better. The target commit is evidence for what changed and a source for hidden checks.

`status=candidate` deliberately means **not benchmark-certified yet**. A candidate becomes certified only after:

- baseline reproduces the missing/broken behavior;
- hidden acceptance is independent of exact diff shape;
- oracle passes the hidden acceptance;
- prompt contains enough product intent without leaking the solution;
- the task can be reproduced from a public commit.

No private repositories are included in this public file.
