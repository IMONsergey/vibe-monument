import type { ProjectInspection } from '../types';
import {
  timelineBack,
  timelineDiff,
  timelineForward,
  timelineInit,
  timelineRestore,
  timelineSetActivePath,
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

export function timelineProjectId(project: Pick<ProjectInspection, 'rootPath'>): string {
  const bytes = new TextEncoder().encode(project.rootPath.normalize('NFC'));
  let hash = 0xcbf29ce484222325n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `timeline-${hash.toString(16).padStart(16, '0')}`;
}

export async function prepareTimeline(project: ProjectInspection): Promise<TimelineState> {
  return timelineInit(project.rootPath, timelineProjectId(project));
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
  const checkpoint = await timelineSnapshot(project.rootPath, timelineProjectId(project), {
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
  return timelineSnapshot(project.rootPath, timelineProjectId(project), {
    kind: 'manual',
    title: compactPrompt(title, 76) || 'Saved version',
    turnSerial: null,
  });
}

export async function readTimelineStatus(project: ProjectInspection): Promise<TimelineStatus> {
  return timelineStatus(project.rootPath, timelineProjectId(project));
}

export async function restoreTimelineVersion(
  project: ProjectInspection,
  checkpointId: string,
): Promise<TimelineRestoreResult> {
  return timelineRestore(project.rootPath, timelineProjectId(project), checkpointId);
}

export async function backTimeline(project: ProjectInspection): Promise<TimelineRestoreResult> {
  const projectId = timelineProjectId(project);
  const before = await timelineStatus(project.rootPath, projectId);
  const activePathId = before.activePathId;
  const result = await timelineBack(project.rootPath, projectId);
  if (activePathId && result.state.activePathId !== activePathId) {
    await timelineSetActivePath(projectId, activePathId);
    const next = result.state.checkpoints
      .filter((checkpoint) => checkpoint.parentId === result.target.id && checkpoint.pathId === activePathId)
      .sort((left, right) => left.sequence - right.sequence)[0] ?? null;
    result.state = {
      ...result.state,
      activePathId,
      forwardCheckpointId: next?.id ?? null,
    };
  }
  return result;
}

export async function forwardTimeline(project: ProjectInspection): Promise<TimelineRestoreResult> {
  return timelineForward(project.rootPath, timelineProjectId(project));
}

export async function compareTimelineVersions(
  project: ProjectInspection,
  fromCheckpointId: string,
  toCheckpointId: string,
): Promise<TimelineDiff> {
  return timelineDiff(
    project.rootPath,
    timelineProjectId(project),
    fromCheckpointId,
    toCheckpointId,
  );
}
