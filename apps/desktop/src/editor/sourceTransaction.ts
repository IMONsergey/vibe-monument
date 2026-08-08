import type { VisualPropertyChange } from './intent';
import type { EditorSelection } from './types';

export interface VisualSourceCandidate {
  sourcePath: string;
  selector: string;
  cssProperty: string;
  line: number;
  sourceValue: string;
  score: number;
}

export interface VisualSourcePlan {
  sourcePath: string;
  selector: string;
  requestedProperty: string;
  cssProperty: string;
  line: number;
  valueStart: number;
  valueEnd: number;
  beforeSource: string;
  afterSource: string;
  fileFingerprint: string;
  previewBefore: string;
  previewAfter: string;
  confidence: number;
}

export interface VisualSourcePlanResponse {
  status: 'deterministic' | 'unsupported' | 'not-found' | 'ambiguous' | string;
  reason: string;
  candidateCount: number;
  plan: VisualSourcePlan | null;
  candidates: VisualSourceCandidate[];
}

export interface VisualSourcePlanInput {
  projectPath: string;
  elementId: string | null;
  property: string;
  before: string;
  after: string;
}

export interface PreparedVisualSourceEdit {
  projectId: string;
  projectRoot: string;
  baseCheckpointId: string;
  selectionNodeId: string;
  change: VisualPropertyChange;
  request: VisualSourcePlanInput;
  plan: VisualSourcePlan;
}

export interface VisualSourceApplyResult {
  sourcePath: string;
  cssProperty: string;
  line: number;
  previousFingerprint: string;
  nextFingerprint: string;
  bytesWritten: number;
  plan: VisualSourcePlan;
}

export type VisualSourcePlanDecision =
  | { kind: 'deterministic'; prepared: PreparedVisualSourceEdit }
  | { kind: 'fallback'; reason: string };

export interface VisualSourceCommitResult {
  checkpointId: string;
  sourcePath: string;
  cssProperty: string;
  line: number;
}

export interface VisualSourceCoordinator {
  plan(selection: EditorSelection, changes: VisualPropertyChange[]): Promise<VisualSourcePlanDecision>;
  commit(prepared: PreparedVisualSourceEdit): Promise<VisualSourceCommitResult>;
}

let coordinator: VisualSourceCoordinator | null = null;

export function registerVisualSourceCoordinator(next: VisualSourceCoordinator): () => void {
  coordinator = next;
  return () => {
    if (coordinator === next) coordinator = null;
  };
}

export async function planVisualSourceEdit(
  selection: EditorSelection,
  changes: VisualPropertyChange[],
): Promise<VisualSourcePlanDecision> {
  if (!coordinator) return { kind: 'fallback', reason: 'Direct source editing is not ready in this workspace.' };
  return coordinator.plan(selection, changes);
}

export async function commitVisualSourceEdit(prepared: PreparedVisualSourceEdit): Promise<VisualSourceCommitResult> {
  if (!coordinator) throw new Error('Direct source editing is no longer available. Re-plan the edit.');
  return coordinator.commit(prepared);
}
