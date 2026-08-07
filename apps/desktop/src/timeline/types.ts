export type TimelineCheckpointKind = 'baseline' | 'prompt' | 'manual' | 'restore-safety' | 'external';

export interface TimelineCheckpoint {
  id: string;
  projectId: string;
  parentId: string | null;
  pathId: string;
  commitSha: string;
  treeSha: string;
  kind: TimelineCheckpointKind;
  sequence: number;
  title: string;
  promptExcerpt: string | null;
  createdAt: number;
  codexThreadId: string | null;
  codexTurnId: string | null;
  turnSerial: number | null;
}

export interface TimelineSnapshotMetadata {
  kind: Exclude<TimelineCheckpointKind, 'baseline'>;
  title?: string | null;
  promptExcerpt?: string | null;
  codexThreadId?: string | null;
  codexTurnId?: string | null;
  turnSerial?: number | null;
}

export interface TimelineStatus {
  currentCheckpointId: string;
  activePathId: string;
  dirty: boolean;
  currentTreeSha: string;
  checkpointTreeSha: string;
  canBack: boolean;
  forwardCheckpointId: string | null;
}

export interface TimelineState {
  currentCheckpointId: string;
  activePathId: string;
  dirty: boolean;
  canBack: boolean;
  forwardCheckpointId: string | null;
  checkpoints: TimelineCheckpoint[];
}

export interface TimelineRestoreResult {
  target: TimelineCheckpoint;
  safetyCheckpoint: TimelineCheckpoint | null;
  state: TimelineState;
}

export interface TimelineDiffFile {
  status: string;
  path: string;
}

export interface TimelineDiff {
  fromCheckpointId: string;
  toCheckpointId: string;
  files: TimelineDiffFile[];
}
