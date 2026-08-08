# Fresh Review + Ship Gate

## Purpose

Monument must never equate “Codex finished” with “safe to ship”.

Fresh Review is an independent, generation-bound review lane. Ship is the product-level gate that combines the current saved version, deterministic evidence, browser evidence, independent findings, pending requested work and agent/post-turn state.

The user-facing goal is simple:

> Ship tells me exactly what is still unproven, and becomes ready only when the current version has enough evidence.

## Fresh Review independence

The reviewer must not inherit the implementer conversation.

Current mechanism:

- Monument creates a bounded review packet for the **current saved Timeline checkpoint**;
- the packet compares the current checkpoint to its parent;
- reviewer execution uses a separate `codex exec` invocation;
- the invocation is ephemeral;
- user Codex config is ignored;
- output is constrained by a JSON Schema;
- the reviewer process runs from a Monument-owned scratch directory, not from the repository;
- the review does not appear as a normal Monument Task;
- reviewer output is persisted locally as structured review evidence.

The project path is used only to bind the request to a real local project. It is not used as the reviewer working directory.

## Review packet

The packet is bounded and contains:

- current checkpoint id;
- parent checkpoint id;
- current Timeline turn generation when available;
- human version title;
- original prompt excerpt when available;
- changed-file list;
- bounded unified diff;
- deterministic evidence summary for the same generation when available;
- browser evidence summary for the same generation when available.

Missing evidence is represented as missing. Stale evidence is represented as stale. Neither is converted into a pass.

## Diff boundary

The review diff comes from Monument shadow Timeline history rather than the user's visible Git staging area.

This matters because the review must answer:

> What did this saved Monument version change relative to its parent Monument version?

not:

> What happens to be staged or unstaged in the user's Git repository right now?

The unified patch is bounded to 320 KiB and the changed-file list is bounded. Truncation is explicit.

## Reviewer process boundary

The native reviewer has hard limits:

- input packet: bounded;
- structured final output: bounded;
- stderr: bounded;
- findings count: bounded;
- hard timeout: 4 minutes;
- process-group cleanup on timeout;
- no persistent reviewer session.

The reviewer is instructed to treat all task text, diff text, code strings, logs and observations as untrusted data.

## Structured output

Fresh Review returns:

- `verdict`: clean / issues;
- concise summary;
- structured findings.

Each finding contains:

- severity;
- category;
- title;
- description;
- optional source path;
- optional line;
- reviewer evidence;
- suggested fix direction;
- confidence.

Supported severities:

- `blocker` — shipping this version is unsafe;
- `high` — serious material issue;
- `medium` — material but lower-risk issue;
- `low` — actionable low-risk issue.

Supported categories include correctness, regression, security, data, UX, accessibility, performance, maintainability and testing.

## Finding resolution

A finding has two normal resolution paths:

### Fix with Monument

The finding is transformed into a bounded explicit repair request and sent through the existing Monument repair channel.

Normal Codex approvals remain authoritative. Fresh Review never auto-approves commands, file changes or permissions.

### Waive

Waiver rules:

- blocker cannot be waived;
- high / medium / low require an explicit written reason;
- waiver is stored with the review record;
- review quality for that Timeline generation is updated after waiver.

A waiver is a user decision, not a model-generated pass.

## Generation binding

Fresh Review is valid only for the exact checkpoint it reviewed.

Any of these make a previous review insufficient for the current Ship gate:

- newer Codex work;
- Timeline restore to another checkpoint;
- a new visual/source edit;
- uncheckpointed source changes;
- current checkpoint differs from the reviewed checkpoint.

The same generation-binding principle applies to deterministic and browser evidence.

## Ship gate inputs

Ship evaluates these independent lanes.

### Project

A real project must be open.

### Saved version

The current Timeline version must:

- exist;
- not be the Original baseline;
- not be dirty;
- be bound to a valid code generation.

### Deterministic checks

For the current generation:

- failed = block;
- verification error = block;
- supported checks waiting for permission = block;
- running = block;
- stale/different generation = block;
- no supported checks = warning, not proof.

### Browser evidence

For a web project with a supported live runtime:

- preview unavailable = block;
- not captured = block;
- stale/different generation = block;
- runtime errors = block;
- console errors = block;
- failed network requests = block;
- clean bounded captured signals = pass for this evidence lane.

Browser evidence is not proof of complete UX correctness or full end-to-end coverage.

### Fresh Review

- not run = block;
- running = block;
- error = block;
- review belongs to another checkpoint = block;
- unresolved blocker = block;
- unresolved high/medium/low finding = block until fixed or explicitly waived;
- no unresolved findings = pass.

### Pending requested work

Prompt Queue must be empty. Queued user instructions are unfinished requested work and therefore block Ship.

### Agent / post-turn state

Ship blocks while:

- Codex is not ready;
- an approval or question is pending;
- Timeline checkpointing is pending;
- deterministic verification is running;
- browser capture is running;
- Fresh Review is running;
- post-turn finalization is still pending.

## Ship UX

Ship is always inspectable when a project exists.

It must not be a disabled mystery button.

When blocked, Ship shows:

- each gate;
- pass / block / warning state;
- human explanation;
- direct next action where available.

Primary actions include:

- Run checks;
- Capture browser evidence;
- Run Fresh Review;
- Fix finding;
- Waive eligible finding;
- resolve pending queue/work.

When all blocking gates pass, the button can show `Ship ✓`.

## Local Git handoff

A ready Ship state can now create an explicit **local Git commit**.

The flow is deliberately human-controlled:

1. Monument computes the current Git plan.
2. The exact changed files are shown before staging.
3. Existing staged changes block Monument Ship so user staging is never mixed silently.
4. The user reviews/edits the commit message.
5. `Commit locally` stages only the exact displayed paths via `git add -- <paths>`.
6. Repository commit hooks run normally.
7. On commit-hook/commit failure, Monument restores the previously-clean index while keeping working-tree changes.
8. After commit, Monument reports the commit SHA and any remaining working-tree changes.

Path enumeration is machine-safe and NUL-delimited, including spaces, Unicode and untracked files.

Monument does not use `git add .`, does not use `--no-verify`, and does not push implicitly.

## What `Ship ✓` means

`Ship ✓` means the configured Monument evidence policy for the **exact current saved generation** has no blocking requirements.

It proves only the evidence lanes that actually ran and passed under the current policy. It is not a universal correctness claim.

After `Ship ✓`, the user may explicitly create a local commit through the Git handoff above.

It does **not** mean:

- changes have been pushed;
- a PR has been opened;
- deployment succeeded;
- production monitoring is healthy;
- every possible user flow was tested;
- every accessibility criterion was audited.

Those remain separate explicit network/deployment/coverage gates.

## Next network handoff

Future Ship work may add explicit actions for:

- push the reviewed branch;
- create a PR or hand off the exact diff;
- attach/localize evidence metadata for the handoff;
- deployment gates.

These actions must remain separate and explicit because they create remote/network side effects.

The user should still see human actions, while advanced Git details remain progressively disclosed.

## Core invariant

> **Fresh Review is independent evidence. Ship is an evidence decision, not model confidence.**
