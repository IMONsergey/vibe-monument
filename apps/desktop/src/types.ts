export type FileNodeKind = 'file' | 'directory';

export interface FileNode {
  name: string;
  path: string;
  kind: FileNodeKind;
  children?: FileNode[];
}

export interface GitSnapshot {
  repositoryRoot: string | null;
  branch: string | null;
  remote: string | null;
  changedFiles: number;
}

export interface ProjectInspection {
  id: string;
  name: string;
  rootPath: string;
  packageManager: string | null;
  framework: string | null;
  scripts: Record<string, string>;
  suggestedDevCommand: string | null;
  git: GitSnapshot;
  files: FileNode[];
}

export type CodexConnectionState =
  | 'idle'
  | 'starting'
  | 'ready'
  | 'busy'
  | 'approval'
  | 'reconnecting'
  | 'error';

export interface CodexThreadSummary {
  id: string;
  title?: string;
  cwd?: string;
  status?: string;
}

export interface ApprovalRequest {
  id: string | number;
  method: string;
  params: unknown;
}

export type ActivityKind = 'system' | 'thinking' | 'edit' | 'command' | 'review' | 'error';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  detail?: string;
  timestamp: number;
}

export interface WorkspaceState {
  project: ProjectInspection | null;
  activeThreadId: string | null;
  threads: CodexThreadSummary[];
  codexState: CodexConnectionState;
  codexMessage: string;
  approval: ApprovalRequest | null;
  activity: ActivityItem[];
}
