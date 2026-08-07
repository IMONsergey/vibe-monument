# Monument Version Timeline

Version Timeline is a product feature, not a Git UI.

The user should be able to treat Monument like Figma Make: go back to any earlier product state, move forward again, restore the first generated version or the original source, and create a new alternative from any point without losing the old future.

## Product invariant

> Back never destroys Forward.

Example:

```text
Original
  └─ V1
      └─ V2
          └─ V3
              ├─ V4 → V5 → V6
              └─ V7 → V8      alternative created from V3
```

If the user returns from V8 back to V3, Forward continues along the active alternative path rather than unexpectedly jumping to V4.

## Default UX

The top bar exposes only:

- `←` Previous version;
- `→` Next version;
- `Versions · Vn`.

The Versions drawer exposes:

- `Original` baseline;
- prompt checkpoints;
- manual `Save version` checkpoints;
- restore-safety checkpoints;
- `Current`, `Fork`, and `Alternative` badges;
- arbitrary `Restore`;
- source-file `Compare` against the current checkpoint.

`⌘Z` / `⇧⌘Z` navigate versions only outside text/select/contenteditable controls, so normal text undo remains native.

## What a checkpoint means

A checkpoint identifies a captured source tree. It is not merely a transcript marker.

`Original` is captured before the first Monument prompt. A prompt checkpoint is captured on the real Codex `turn/completed` signal. The displayed title comes from the user's prompt, not the hidden DOM/source context appended to the Codex turn.

Manual versions intentionally have no Codex turn generation. Therefore evidence from the previous Codex-produced state becomes stale until checks are rerun.

## Storage: shadow Git

Monument does not create automatic commits in the user's visible repository.

Each project owns a local bare object database under Monument Application Support. Native plumbing runs with isolated:

```text
GIT_DIR=<Monument shadow repo>
GIT_WORK_TREE=<real project root>
GIT_INDEX_FILE=<Monument private index>
```

Checkpoint commits are protected with internal refs under:

```text
refs/monument/checkpoints/<checkpoint-id>
```

Git blob/tree reuse gives storage deduplication without polluting the user's log, branch, staging index, or commit graph.

## Snapshot boundary

Version Timeline captures product source state and respects `.gitignore`, including projects that are not themselves Git repositories.

Always excluded:

- `.git`;
- `node_modules`;
- `target`;
- `dist`, `build`;
- `.next`, `.nuxt`, `.output`;
- coverage/cache/turbo output;
- `.env` and `.env.*` secrets.

Environment templates such as `.env.example`, `.env.sample`, and `.env.template` remain eligible for history.

## Restore safety

Restore changes only files owned by the Timeline snapshot set.

Ignored/unmanaged files are left untouched. If an older checkpoint would overwrite an unmanaged file/directory, restore aborts with a conflict instead of deleting it.

If the current managed source tree differs from the current checkpoint, Monument first creates `Before restore` and only then restores the requested version. Therefore a mistaken restore is itself reversible.

Monument never uses `git reset --hard` against the user's repository.

## Fork semantics

Each checkpoint has both a parent and a history path.

When current checkpoint equals the tip of its path, the next checkpoint continues that path. If the user restores an older checkpoint while later checkpoints still exist and then submits a new prompt, the new checkpoint gets a new path id.

The original future remains in the DAG.

Back preserves the active navigation path so Forward returns to the branch the user came from at a shared ancestor.

## Evidence relationship

Deterministic and browser evidence are attached to a code generation, not globally to a project.

When Timeline restores a checkpoint:

- the restored checkpoint's turn generation becomes the current code generation;
- evidence from a different generation is stale;
- manual/externally changed states have no proven generation until checks are rerun;
- live browser evidence is explicitly invalidated and the preview is reloaded.

## Current native API

```text
timeline_init
timeline_snapshot
timeline_list
timeline_status
timeline_restore
timeline_back
timeline_forward
timeline_diff
timeline_set_active_path
```

## Safety tests

The native test suite verifies at minimum:

- `.gitignore` works in a non-Git folder;
- `.env` secrets are excluded while templates are captured;
- restoring source does not remove excluded `.env` files;
- shadow Git uses a separate index and leaves the user's `.git/index` byte-for-byte unchanged;
- timeline path identifiers cannot escape their local namespace.

CI source contracts additionally fail if shadow Git isolation, safety checkpointing, fork navigation, Versions UX, or the prohibition on `git reset` regresses.

## Next upgrades

After the first Timeline gate is native-green:

1. attach exact evidence badges to every checkpoint;
2. richer visual Compare with two live previews;
3. pair `Try another version` with Codex thread isolation/worktree isolation;
4. optional version naming;
5. local storage usage and explicit cleanup controls;
6. screenshots for checkpoints after Browser QA exists.
