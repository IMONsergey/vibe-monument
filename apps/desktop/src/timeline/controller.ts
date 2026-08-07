import type { ProjectInspection } from '../types';
import {
  timelineBack,
  timelineDiff,
  timelineForward,
  timelineInit,
  timelineRestore,
  timelineSnapshot,
  timelineStatus,
} from '../host/native';
import type {
  TimelineCheckpoint,
  TimelineDiff,
  TimelineRestoreResult,
  TimelineState,
  TimelineStatus,
} from './types';

const pendingPrompts = new Map<string, string>();

function compactPrompt(value: string, limit = 120): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length <= limit ? compact : `${compact.slice(0, Math.max(0, limit - 1))}…`;
}

export async function prepareTimeline(project: ProjectInspection): Promise<TimelineState> {
  return timelineInit(project.rootPath, project.id);
}

export function rememberTimelinePrompt(projectId: string, userPrompt: string): void {
  pendingPrompts.set(projectId, userPrompt.trim());
}

export function forgetTimelinePrompt(projectId: string): void {
  pendingPrompts.delete(projectId);
}

export async function checkpointCompletedTurn({
  project,
  codexThreadId,
  codexTurnId,
  turnSerial,
}: {
  project: ProjectInspection;
  codexThreadId: string | null;
  codexTurnId: string | null;
  turnSerial: number;
}): Promise<TimelineCheckpoint> {
  const prompt = pendingPrompts.get(project.id) ?? '';
  const checkpoint = await timelineSnapshot(project.rootPath, project.id, {
    kind: 'prompt',
    title: compactPrompt(prompt, 76) || `Version ${turnSerial}`,
    promptExcerpt: compactPrompt(prompt, 240) || null,
    codexThreadId,
    codexTurnId,
    turnSerial,
  });
  pendingPrompts.delete(project.id);
  return checkpoint;
}

export async function saveTimelineVersion(
  project: ProjectInspection,
  title = 'Saved version',
): Promise<TimelineCheckpoint> {
  return timelineSnapshot(project.rootPath, project.id, {
    kind: 'manual',
    title: compactPrompt(title, 76) || 'Saved version',
    turnSerial: null,
  });
}

export async function readTimelineStatus(project: ProjectInspection): Promise<TimelineStatus> {
  return timelineStatus(project.rootPath, project.id);
}

export async function restoreTimelineVersion(
  project: ProjectInspection,
  checkpointId: string,
): Promise<TimelineRestoreResult> {
  return timelineRestore(project.rootPath, project.id, checkpointId);
}

export async function backTimeline(project: ProjectInspection): Promise<TimelineRestoreResult> {
  return timelineBack(project.rootPath, project.id);
}

export async function forwardTimeline(project: ProjectInspection): Promise<TimelineRestoreResult> {
  return timelineForward(project.rootPath, project.id);
}

export async function compareTimelineVersions(
  project: ProjectInspection,
  fromCheckpointId: string,
  toCheckpointId: string,
): Promise<TimelineDiff> {
  return timelineDiff(project.rootPath, project.id, fromCheckpointId, toCheckpointId);
}
