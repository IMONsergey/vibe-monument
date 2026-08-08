# Visual Editor M2 — Checkpoint-bound Source Identity

Status: **active foundation for deterministic source transactions**.

## Why this exists

Visual Editor M1 deliberately routes `Apply` through the normal Codex task pipeline. That is source-authoritative and safe, but it is not yet the low-latency deterministic editor we ultimately want.

M2 introduces deterministic source transactions that may change repository source **without creating a Codex turn**. Therefore Codex `turnSerial` can no longer serve as the identity of the source state being verified.

The authoritative source identity is the exact saved **Version Timeline checkpoint ID**.

`turnSerial` remains useful metadata describing Codex provenance, but a manual or deterministic visual edit can validly have no Codex turn at all.

## Core invariant

> Evidence, Fresh Review, Repair and Ship prove an exact Timeline checkpoint. Agent turns describe provenance only.

## Identity model

Every saved source version has:

- `checkpointId` — authoritative source identity;
- `treeSha` / `commitSha` — native Timeline source snapshot identity;
- optional `turnSerial` — Codex provenance when the version came from an agent turn;
- optional Codex thread/turn ids — provenance only.

A deterministic visual source transaction will be able to create a checkpoint with `turnSerial = null` and still receive:

- deterministic checks;
- browser evidence;
- Fresh Review;
- Timeline quality badges;
- Repair eligibility;
- Ship eligibility.

## M2 migration implemented in this branch

### Timeline controller

`currentTimelineCheckpoint(projectId)` returns only the exact current checkpoint when the working tree is clean. If files are dirty, it returns `null` rather than pretending the previous checkpoint still describes current source.

### Deterministic evidence

`VerificationEvidence` carries:

- `checkpointId: string | null`;
- `turnSerial` only as provenance.

Final deterministic quality is persisted only when a checkpoint ID exists.

### Browser evidence

`BrowserEvidenceRecord` carries:

- `capturedForCheckpointId` as source identity;
- `capturedForTurnSerial` as provenance.

A capture without a saved checkpoint is stale by definition.

### Fresh Review

Review already operates on exact `checkpointId` vs parent checkpoint. M2 also binds its Timeline quality badge to that checkpoint, including manual/direct versions with no Codex turn.

### Repair

Repair requests carry `checkpointId`. The Codex runtime validates that the evidence checkpoint is still the exact current saved checkpoint before starting repair.

Legacy turn-only persisted evidence remains a bounded compatibility fallback only. New evidence must carry checkpoint identity.

### Ship

Ship checks:

- deterministic evidence checkpoint == current checkpoint;
- browser evidence checkpoint == current checkpoint;
- Fresh Review checkpoint == current checkpoint.

A current checkpoint does **not** need a Codex generation in order to be shippable.

### Timeline quality badges

`TimelineQualityMap` is now keyed by `checkpointId`, not `turnSerial`.

Older turn-keyed alpha entries are not treated as proof for a checkpoint because Monument cannot safely infer exact source identity from those legacy records. Users can simply rerun evidence for the current checkpoint.

## Why no automatic legacy migration

A single Codex turn serial is not a cryptographic/source identity and older state may have been restored, manually saved or changed outside that turn. Guessing a checkpoint from legacy quality could display a false green badge.

M2 chooses a safe migration rule:

> Unknown mapping → no quality badge → rerun evidence.

## Next step after this foundation

Build the deterministic source transaction engine in this order:

1. resolve candidate source owner for selected property;
2. require high-confidence single-owner mapping;
3. support CSS custom property value replacement;
4. support literal CSS declaration replacement;
5. support safe Tailwind utility replacement;
6. support simple JSX/TSX literal style/prop replacement;
7. produce a dry-run source patch before mutation;
8. validate path containment and source hash/precondition;
9. apply one atomic source write;
10. create a new Timeline checkpoint with no required Codex turn;
11. invalidate old evidence automatically;
12. run lightweight verification / browser refresh;
13. fall back to the existing Codex Apply path whenever ownership/scope is ambiguous.

## Non-negotiable safety rules

- no regex-only general source rewriting;
- no preview-only persistent styles;
- no broad project write permission from the preview webview;
- source path must stay canonically inside project root;
- mutation must have a source precondition so stale files cannot be overwritten silently;
- one visual transaction must be reversible through Version Timeline;
- token/global-scope edits require an explicit scope decision before deterministic mutation;
- ambiguity routes to Codex rather than guessing.
