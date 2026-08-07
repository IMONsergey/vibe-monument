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
