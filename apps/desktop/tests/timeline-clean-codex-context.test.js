import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const controller = await readFile(new URL('../src/timeline/controller.ts', import.meta.url), 'utf8');
const runtime = await readFile(new URL('../src/codex/runtime.ts', import.meta.url), 'utf8');

test('successful Timeline navigation forces the next prompt into a clean Codex task', () => {
  assert.ok(controller.includes("TIMELINE_RESTORED_EVENT = 'monument:timeline-restored'"));
  assert.ok(controller.includes('notifyTimelineRestored(await timelineRestore'));
  assert.ok(controller.includes('return notifyTimelineRestored(result);'));
  assert.ok(controller.includes('notifyTimelineRestored(await timelineForward'));

  assert.ok(runtime.includes("TIMELINE_RESTORED_EVENT = 'monument:timeline-restored'"));
  assert.ok(runtime.includes('window.addEventListener(TIMELINE_RESTORED_EVENT, this.handleTimelineRestore)'));
  assert.ok(runtime.includes('this.newTask();'));
  assert.ok(runtime.includes('previous tasks stay in history'));
});

test('turn completion finalizes its Timeline checkpoint before Codex becomes ready', () => {
  assert.ok(runtime.includes('checkpointActiveTimelineTurn'));
  assert.ok(runtime.includes('await checkpointActiveTimelineTurn({ codexThreadId, codexTurnId, turnSerial })'));
  assert.ok(runtime.includes("case 'turn/completed': {"));
  assert.ok(runtime.includes("this.patch({ state: 'busy', approval: null, activeTurnId: null })"));
  assert.ok(runtime.includes('void this.finalizeCompletedTurn({ codexThreadId, codexTurnId, turnSerial })'));
  const finalize = runtime.indexOf('await checkpointActiveTimelineTurn');
  const ready = runtime.indexOf("state: this.snapshot.account?.readyForTurns === false ? 'auth-required' : 'ready'", finalize);
  assert.ok(finalize >= 0 && ready > finalize, 'Codex must not become ready until Timeline checkpoint finalization returns');
});
