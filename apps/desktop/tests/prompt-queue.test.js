import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('Prompt Queue waits for post-turn work, captures visual context and remains task/restore safe', async () => {
  const [queue, component, app, turn, entry] = await Promise.all([
    source('src/queue/controller.ts'),
    source('src/components/PromptQueue.tsx'),
    source('src/App.tsx'),
    source('src/context/turn.ts'),
    source('src/main.tsx'),
  ]);

  for (const token of [
    'MAX_QUEUE_ITEMS = 20',
    'MAX_PROMPT_CHARS = 8_000',
    'prompt-queue:',
    'pauseRestored',
    'threadId: string | null',
    'detachPromptQueueThreads',
    'paused: current.items.length ? true',
    'takeNextPrompt',
    'restoreQueuedPromptToFront',
  ]) {
    assert.ok(queue.includes(token), `queue controller missing ${token}`);
  }

  for (const token of [
    'capturedSelection: PreviewSelection | null | undefined = undefined',
    'capturedSelection === undefined ? getPreviewSelection() : capturedSelection',
    'locateSourceHints(projectRoot, selection)',
  ]) {
    assert.ok(turn.includes(token), `queued visual context compiler missing ${token}`);
  }

  for (const token of [
    'postTurnPending = workspace.completionSerial > handledCompletionSerial.current',
    '!postTurnPending',
    'getPreviewSelection()',
    'enqueuePrompt(project.id, text, capturedSelection, workspace.activeThreadId)',
    'promptQueueState?.items.length || queueDispatching',
    'takeNextPrompt(projectId)',
    'if (item.threadId) codex.selectThread(item.threadId)',
    'activeProjectIdRef.current !== projectId',
    'detachPromptQueueThreads(project.id)',
    'queueBlockedByEvidence',
    'Continue anyway',
  ]) {
    assert.ok(app.includes(token), `Prompt Queue orchestration missing ${token}`);
  }

  assert.ok(app.indexOf('postTurnPending = workspace.completionSerial > handledCompletionSerial.current') < app.indexOf('if (queueBlockedByEvidence || !canExecutePromptNow || postTurnPending) return;'));
  assert.ok(app.includes("verificationProgress.evidence.status === 'failed' || verificationProgress.evidence.status === 'error'"));
  assert.ok(app.includes('browserEvidenceHasIssues(browserEvidence)'));

  for (const token of ['Queue paused', 'Blocked by current failed evidence', 'Continue anyway', 'onMove', 'onRemove']) {
    assert.ok(component.includes(token), `Prompt Queue UI missing ${token}`);
  }
  assert.ok(entry.includes("./styles/queue.css"));
});
