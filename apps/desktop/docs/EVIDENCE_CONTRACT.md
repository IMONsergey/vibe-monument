# Monument Deterministic Evidence Contract

## Why this exists

Monument must never confuse agent confidence with proof.

A Codex turn completing means only:

> Codex reported the turn lifecycle as completed.

It does **not** mean the code compiles, tests pass, the page works, the visual result is correct, or the task is safe to ship.

Evidence is collected separately from agent narration.

## First evidence class: project checks

The first deterministic evidence lane supports explicit package scripts with these names:

- `typecheck`
- `test`
- `build`
- `lint`
- `check`

The automatic subset is intentionally smaller:

- `typecheck`
- `test`
- `build`

`lint` and generic `check` remain available through an explicit Run all checks action in this slice.

No package lifecycle scripts such as install/postinstall/prepare are eligible.

## Trust boundary

`package.json` scripts are executable repository code.

Therefore:

- opening a folder never runs them;
- merely connecting Codex never runs them;
- a Codex turn completing does not grant Monument permission to run them;
- automatic project checks are disabled by default for each project;
- the first automatic verification request becomes `permission-required` and executes nothing;
- the user can enable automatic checks once for that local project;
- the preference is persisted locally and can be disabled again;
- `Run all checks` is an explicit one-pass action and does not silently grant future automatic execution.

This native verification runner is **not** a replacement for Codex sandbox/approval semantics. It is a separate deterministic evidence mechanism with its own narrow, explicit trust boundary.

## Execution contract

Each verification process:

- is launched as executable + argv, never interpolated through `sh -c` / `bash -c`;
- runs in the selected project root;
- receives `CI=1`, `NO_COLOR=1`, `FORCE_COLOR=0`;
- has no stdin;
- owns a killable process group on Unix;
- has a hard timeout;
- drains stdout and stderr concurrently;
- stores only bounded output;
- records command, cwd, exit code, timeout state, duration and timestamp.

Checks run sequentially in the initial slice so one project cannot accidentally spawn multiple heavy test/build processes at once on an Intel Mac.

## Evidence statuses

- `running` — deterministic checks are actively executing;
- `passed` — every selected check exited successfully;
- `failed` — at least one selected check failed or timed out;
- `no-checks` — the project exposes no supported check scripts;
- `permission-required` — automatic checks were detected but not authorized; nothing executed;
- `error` — Monument itself could not plan/run the verification lane.

`no-checks` and `permission-required` are never rendered as verified success.

## Persistence

The latest evidence snapshot is stored in Monument local state and restored with the project.

It contains bounded command output and local paths. It is not cloud telemetry and is not automatically uploaded anywhere.

The Codex conversation remains owned by Codex; evidence is a separate local proof ledger.

## What a passing check actually proves

A passing **typecheck** proves the configured typecheck command exited successfully.

A passing **test** proves only the behavior covered by the project's tests.

A passing **build** proves the configured build completed successfully.

None of them individually proves:

- visual correctness;
- responsive correctness;
- runtime interaction correctness;
- accessibility quality;
- clean browser console/network behavior;
- task-contract completeness;
- absence of unrelated regressions;
- release readiness.

For that reason the global Ship action remains blocked after this evidence gate.

## Refresh after checks

After verification, Monument re-inspects the real project so visible Git change count and file tree reflect current disk state rather than the snapshot from when the project was opened.

## Future evidence classes

The same evidence model will expand with independent lanes:

- browser runtime / console errors;
- network failures and slow requests without secret/request-body leakage;
- viewport matrix;
- screenshots and before/after visual evidence;
- accessibility signals;
- Git diff/repository state;
- fresh-context review findings;
- migration/deployment-specific proof.

Each lane must state what it proves and what it does not prove.

## Repair boundary

Failed deterministic checks can later be attached to a repair turn, but that is a separate gate.

The repair system must:

- attach bounded raw evidence rather than a fabricated explanation;
- instruct Codex to diagnose root cause;
- forbid weakening/removing checks merely to obtain green status;
- cap automatic repair attempts;
- stop on repeated identical failure or new higher-severity failure;
- keep destructive/permission-requiring actions behind Codex approvals.

## Core invariant

> **Monument may automate verification, but it may never automate trust.**
