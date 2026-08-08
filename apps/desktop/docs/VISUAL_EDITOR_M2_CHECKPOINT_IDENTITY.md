# Visual Editor M2 — Deterministic Source Transactions

Status: **implemented in PR #37; pending final CI/merge**.

## What M2 changes

Visual Editor M1 is source-authoritative, but every `Apply` becomes a Codex task. That is safe and general, but too slow for edits whose source owner is provably deterministic.

M2 adds a second editing path:

1. the user edits a value in **Properties**;
2. Monument attempts a bounded native dry-run against the real repository;
3. only a single, high-confidence, instance-owned literal CSS declaration is eligible;
4. Monument shows the exact source line before/after;
5. `Apply source` revalidates the saved Timeline checkpoint, file fingerprint and source range;
6. one atomic source write is performed;
7. the result becomes a new Version Timeline checkpoint with no required Codex turn;
8. checks, browser evidence, review and Ship bind to that checkpoint;
9. anything ambiguous falls back to the existing Codex Queue path.

This is not preview styling. The repository remains the source of truth.

## Core identity invariant

> Evidence, Fresh Review, Repair and Ship prove an exact Timeline checkpoint. Agent turns describe provenance only.

`turnSerial` remains useful metadata for Codex-authored versions, but it is not source identity. A deterministic or manual saved version can validly have `turnSerial = null`.

Every saved version therefore has:

- `checkpointId` — authoritative source/evidence identity;
- native Timeline `treeSha` / `commitSha` — snapshot identity;
- optional `turnSerial` — Codex provenance;
- optional Codex thread/turn ids — provenance only.

## Checkpoint-first quality model

### Timeline

`currentTimelineCheckpoint(projectId)` returns the exact current checkpoint only while the working tree is clean. Dirty source returns `null` instead of incorrectly treating the previous checkpoint as current.

### Deterministic verification

`VerificationEvidence` carries:

- `checkpointId: string | null` as source identity;
- `turnSerial` as optional/legacy provenance;
- trigger `codex-turn`, `source-transaction` or `manual`.

Project package scripts remain an execution trust boundary. A Codex completion or direct visual edit is **not** implicit permission to execute repository scripts. Automatic post-change checks run only after the project-level automatic-verification consent has been enabled; manual **Run all** remains explicit.

### Browser evidence

`BrowserEvidenceRecord` carries:

- `capturedForCheckpointId` as source identity;
- `capturedForTurnSerial` as provenance.

Capture checks checkpoint identity both before and after collection. If source changes during capture, the evidence is stored stale rather than falsely bound to a newer version.

### Fresh Review

Fresh Review is checkpoint-native. Review results and Timeline quality attach to the exact reviewed checkpoint, including direct/manual checkpoints without Codex provenance.

### Repair

Repair requests carry checkpoint identity. The Codex repair guard validates that the evidence checkpoint is still the exact current saved checkpoint before starting a repair.

Automatic repair can also follow a failed `source-transaction` verification, but only when automatic repair was explicitly enabled for the project.

### Ship

Ship requires evidence for the exact current checkpoint:

- deterministic evidence checkpoint == current checkpoint;
- browser evidence checkpoint == current checkpoint when browser evidence is required;
- Fresh Review checkpoint == current checkpoint;
- working tree is clean/saved;
- no conflicting post-turn or quality work is running.

A current checkpoint does **not** need a Codex generation to be shippable.

### Timeline quality badges

`TimelineQualityMap` is keyed by `checkpointId`, not `turnSerial`.

Legacy turn-keyed alpha quality is intentionally not guessed onto a checkpoint. Unknown mapping means no badge until evidence is rerun.

## Deterministic CSS v1

M2 intentionally starts narrow.

### Eligible edit

A direct edit requires all of the following:

- exactly one changed property;
- live selected element has a stable safe `id`;
- Monument can find exactly one plain-CSS declaration whose rightmost selector is owned by that `#id`;
- the source literal value exactly matches the live computed value after normalization;
- source is not token-backed through `var(...)`;
- selector is not shared/comma-separated and does not contain pseudo-state/pseudo-element scope;
- the project is on one exact clean Timeline checkpoint;
- Codex is idle/ready;
- no post-turn processing is pending;
- Prompt Queue is loaded, empty and not dispatching;
- no conflicting verification/review/timeline operation is running.

If any rule fails, Monument uses the normal Codex Queue path. It never guesses.

### Dry-run contract

Native `visual_source_plan` returns:

- source path;
- selector;
- CSS property;
- source line;
- exact value byte range;
- current literal value;
- replacement literal value;
- file fingerprint;
- compact before/after line preview;
- deterministic confidence.

The main UI displays that preview before mutation. The preview webview never receives source-write permission.

### Apply contract

Native `visual_source_apply` does not trust the prior dry-run blindly. It:

1. reruns source planning;
2. requires the same source path;
3. requires the same file fingerprint;
4. requires the same byte range;
5. canonicalizes the project path;
6. refuses symlink traversal;
7. rereads and refingerprints the file;
8. confirms the exact old literal still occupies the planned range;
9. validates the replacement as one safe CSS literal value;
10. writes through a `create_new` temporary file, syncs it, preserves permissions and renames atomically.

A stale plan cannot silently overwrite newer source.

### CSS value safety

The direct path rejects values that would escape or leave ambiguous CSS structure, including:

- newline / carriage return / control characters;
- declaration semicolons;
- `{` / `}`;
- CSS comment delimiters;
- unmatched quotes;
- unmatched `()` or `[]`;
- unsupported raw backslash escapes.

Balanced values such as `calc(...)`, gradients, quoted font families and quoted `url(...)` remain eligible when all ownership rules also pass.

## Product orchestration

The direct path is coordinated by the privileged main product shell rather than by the preview webview.

After successful mutation Monument:

1. marks previous browser evidence stale;
2. clears the browser evidence buffer when live preview exists;
3. saves `Visual edit · <property>` as one Timeline checkpoint;
4. refreshes project and Timeline state;
5. runs checkpoint-bound deterministic verification under the existing consent policy;
6. captures browser evidence for the exact new checkpoint when appropriate;
7. leaves Fresh Review/Ship to prove that same checkpoint;
8. keeps normal Timeline back/forward restoration available.

Queue failure overrides are also keyed by checkpoint ID, so a bypass cannot leak onto a different source version.

## Current UX

Properties now has two outcomes after the first Apply click:

### Deterministic owner proved

The panel shows:

- `Direct source edit`;
- confidence;
- `path:line`;
- exact source line before;
- exact source line after;
- **Apply source**;
- **Use Codex**;
- **Reset**.

Changing the draft after preflight invalidates the prepared source edit.

### Direct ownership not proved

The edit is sent through the existing M1 source-aware Codex Queue with the reason for fallback. Text, structural edits, multi-property edits and ambiguous/shared scope intentionally remain here for now.

## Security boundary

Non-negotiable M2 rules:

- no regex-only general source rewriting;
- no preview-only persistent style as the final edit;
- no broad source write permission from the preview webview;
- no direct edit while Codex or Prompt Queue can race the same repository;
- canonical project containment is required;
- symlinks are refused;
- stale source fingerprints/ranges are refused;
- malformed CSS literals are refused;
- one direct edit creates one reversible Timeline checkpoint;
- token/global/shared scope does not silently become an instance edit;
- ambiguity always routes to Codex.

## Regression coverage

M2 adds contract coverage for:

- checkpoint-first quality identity;
- direct native commands being available to main only;
- exact `#id` CSS ownership;
- shared/responsive ambiguity refusal;
- token-backed literal refusal;
- stale file fingerprint rejection;
- canonical path and symlink boundaries;
- atomic source writing;
- malformed CSS value rejection;
- main-shell direct-edit orchestration;
- direct edit → Timeline checkpoint → verification/browser binding;
- checkpoint-keyed stale/queue logic;
- Properties dry-run UI and Codex fallback.

## Next: M2.1 / M2.2

Do not broaden the fast path until each ownership class can preserve the same proof guarantees.

Priority order:

1. CSS custom-property/design-token ownership with an explicit **instance vs token/global** scope decision;
2. safe Tailwind utility replacement, including variant/responsive ownership detection;
3. simple JSX/TSX literal `style` / primitive prop edits with AST-backed ownership;
4. multi-property transaction planning as one atomic Timeline version;
5. deterministic direct text replacement only where an AST proves one literal text owner;
6. richer diff preview and per-edit undo metadata;
7. selection/source ownership caching for lower preflight latency;
8. framework adapters for CSS Modules, styled systems and common component libraries;
9. live in-canvas manipulation (resize/spacing/position handles) routed through the same transaction engine — never through a separate preview-only state model.

The target is Figma-speed interaction without surrendering source correctness, provenance or rollback.
