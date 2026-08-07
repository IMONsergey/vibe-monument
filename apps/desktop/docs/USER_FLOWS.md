# Monument user flows

## 1. Open a project

1. Launch Monument.
2. Choose a recent repo or Open Folder.
3. Monument reads repo metadata and VibeOS config.
4. Runtime manager discovers likely dev command and local server.
5. Codex task list filters threads by project cwd/runtime roots.
6. User lands on last active task or an empty project canvas.

No agent command runs merely because a folder was opened.

## 2. Start a new task

1. `⌘N` or New Task.
2. User enters one natural-language goal.
3. Monument creates a task shell.
4. VibeOS routes risk/required evidence.
5. User can review route when risk is non-trivial.
6. Codex thread starts with project cwd, project instructions, selected skills, and approval policy.
7. For parallel work, Monument can create branch/worktree before the first implementation turn.

## 3. Continue an existing Codex session

1. Task sidebar lists compatible Codex threads.
2. Selecting one uses `thread/read` for lazy preview.
3. Continue calls `thread/resume`.
4. Existing conversation becomes a Monument task without copying transcript content into a second source of truth.

## 4. Visual edit

1. User activates Inspect (`I`).
2. Hover identifies rendered element and source hint.
3. Click selects element.
4. Monument attaches a context packet: viewport, DOM identity, bounding rect, computed styles, source metadata, screenshot crop.
5. Composer becomes: `Selected: Hero heading (Hero.tsx:24)` plus user instruction.
6. Codex makes change.
7. Preview refreshes.
8. Visual/evidence checks update automatically.

## 5. Fork an approach

1. User presses Fork Task.
2. Monument calls `thread/fork`.
3. User chooses:
   - conversation-only fork; or
   - code fork → new Git branch/worktree.
4. Fork appears beside original as Variant B.
5. Compare mode can show both live previews and diff/evidence scores.

## 6. Approval

1. Codex requests an approval.
2. Task execution visibly pauses.
3. Monument shows exact command/action, target, reason, and permission scope.
4. Choices are limited to semantics the Codex protocol actually supports.
5. No generic “always allow everything” affordance is placed next to routine actions.

## 7. Ship

1. User opens Evidence.
2. VibeOS shows required vs collected proof.
3. Fresh review findings must be resolved/accepted according to route.
4. Git view summarizes branch/diff.
5. Ship action only becomes primary when blocking gates pass.
