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

export const TIMELINE_RESTORED_EVENT = 'monument:timeline-restored';

const pendingPrompts = new Map<string, string>();
let activeTimelineProject: ProjectInspection | null = null;

function compactPrompt(value: string, limit = 120): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length <= limit ? compact : `${compact.slice(0, Math.max(0, limit - 1))}…`;
}

function notifyTimelineRestored(result: TimelineRestoreResult): TimelineRestoreResult {
  window.dispatchEvent(new CustomEvent(TIMELINE_RESTORED_EVENT, {
    detail: {
      checkpointId: result.target.id,
      pathId: result.target.pathId,
    },
  }));
  return result;
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
  activeTimelineProject = project;
  return timelineInit(project.rootPath, timelineProjectId(project));
}

export function activeTimelineProjectRoot(projectId: string): string | null {
  const project = activeTimelineProject;
  return project?.id === projectId ? project.rootPath : null;
}

export async function currentTimelineCheckpoint(projectId: string): Promise<TimelineCheckpoint | null> {
  const project = activeTimelineProject;
  if (!project || project.id !== projectId) return null;
  const state = await timelineInit(project.rootPath, timelineProjectId(project));
  if (state.dirty) return null;
  return state.checkpoints.find((checkpoint) => checkpoint.id === state.currentCheckpointId) ?? null;
}

export async function currentTimelineTurnSerial(projectId: string, fallback: number): Promise<number | null> {
  const project = activeTimelineProject;
  if (!project || project.id !== projectId) return fallback;
  const current = await currentTimelineCheckpoint(projectId);
  return current?.turnSerial ?? null;
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
  activeTimelineProject = project;
  const projectId = timelineProjectId(project);
  const state = await timelineInit(project.rootPath, projectId);
  const current = state.checkpoints.find((checkpoint) => checkpoint.id === state.currentCheckpointId) ?? null;
  if (!state.dirty && current?.turnSerial === turnSerial) {
    pendingPrompts.delete(project.id);
    return current;
  }

  const prompt = pendingPrompts.get(project.id) ?? '';
  const checkpoint = await timelineSnapshot(project.rootPath, projectId, {
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

export async function checkpointActiveTimelineTurn({
  codexThreadId,
  codexTurnId,
  turnSerial,
}: {
  codexThreadId: string | null;
  codexTurnId: string | null;
  turnSerial: number;
}): Promise<TimelineCheckpoint | null> {
  if (!activeTimelineProject) return null;
  return checkpointCompletedTurn({
    project: activeTimelineProject,
    codexThreadId,
    codexTurnId,
    turnSerial,
  });
}

export async function saveTimelineVersion(
  project: ProjectInspection,
  title = 'Saved version',
): Promise<TimelineCheckpoint> {
  activeTimelineProject = project;
  return timelineSnapshot(project.rootPath, timelineProjectId(project), {
    kind: 'manual',
    title: compactPrompt(title, 76) || 'Saved version',
    turnSerial: null,
  });
}

export async function readTimelineStatus(project: ProjectInspection): Promise<TimelineStatus> {
  activeTimelineProject = project;
  return timelineStatus(project.rootPath, timelineProjectId(project));
}

export async function restoreTimelineVersion(
  project: ProjectInspection,
  checkpointId: string,
): Promise<TimelineRestoreResult> {
  activeTimelineProject = project;
  return notifyTimelineRestored(await timelineRestore(project.rootPath, timelineProjectId(project), checkpointId));
}

export async function backTimeline(project: ProjectInspection): Promise<TimelineRestoreResult> {
  activeTimelineProject = project;
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
  return notifyTimelineRestored(result);
}

export async function forwardTimeline(project: ProjectInspection): Promise<TimelineRestoreResult> {
  activeTimelineProject = project;
  return notifyTimelineRestored(await timelineForward(project.rootPath, timelineProjectId(project)));
}

export async function compareTimelineVersions(
  project: ProjectInspection,
  fromCheckpointId: string,
  toCheckpointId: string,
): Promise<TimelineDiff> {
  activeTimelineProject = project;
  return timelineDiff(
    project.rootPath,
    timelineProjectId(project),
    fromCheckpointId,
    toCheckpointId,
  );
}
