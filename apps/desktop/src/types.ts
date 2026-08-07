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
  | 'auth-required'
  | 'reconnecting'
  | 'error';

export interface CodexRuntimeInfo {
  running: boolean;
  command: string;
  pid?: number | null;
  version?: string | null;
}

export interface CodexProtocolProbe {
  command: string;
  version: string | null;
  schemaSupported: boolean;
  generatedFiles: number;
  schemaDirectory: string | null;
  error: string | null;
}

export interface CodexAccountSnapshot {
  accountType: string | null;
  email: string | null;
  planType: string | null;
  requiresOpenaiAuth: boolean;
  readyForTurns: boolean;
}

export interface CodexLoginStart {
  type: string;
  loginId: string | null;
  authUrl: string | null;
  verificationUrl: string | null;
  userCode: string | null;
}

export interface CodexThreadSummary {
  id: string;
  title?: string;
  cwd?: string;
  status?: string;
}

export type ApprovalKind = 'command' | 'file-change' | 'permissions' | 'elicitation' | 'user-input' | 'unknown';
export type SimpleApprovalDecision = 'accept' | 'acceptForSession' | 'decline' | 'cancel';

export interface UserInputQuestionOption {
  label: string;
  description?: string;
}

export interface UserInputQuestion {
  id: string;
  header?: string;
  question: string;
  isOther?: boolean;
  isSecret?: boolean;
  options?: UserInputQuestionOption[];
}

export interface ApprovalRequest {
  id: string | number;
  method: string;
  kind: ApprovalKind;
  params: Record<string, unknown>;
  reason?: string;
  command?: string;
  cwd?: string;
  changedPaths?: string[];
  availableDecisions: SimpleApprovalDecision[];
  questions?: UserInputQuestion[];
  isBlocking?: boolean;
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
  turnSerial: number;
  completionSerial: number;
  account: CodexAccountSnapshot | null;
  approval: ApprovalRequest | null;
  activity: ActivityItem[];
}
