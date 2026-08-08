import { getVisualEditorState } from './controller';
import type { VisualPropertyChange } from './intent';
import type { EditorSelection } from './types';

export type VisualTokenScope = 'element' | 'token';

export interface VisualTokenScopePlan {
  scope: VisualTokenScope;
  tokenName: string;
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

export interface VisualTokenPlanInput {
  projectPath: string;
  elementId: string | null;
  property: string;
  before: string;
  after: string;
}

export interface VisualTokenPlanResponse {
  status: 'scope-choice' | 'unsupported' | 'not-found' | 'ambiguous' | string;
  reason: string;
  tokenName: string | null;
  usageCount: number;
  elementPlan: VisualTokenScopePlan | null;
  tokenPlan: VisualTokenScopePlan | null;
}

export interface PreparedVisualTokenEdit {
  projectId: string;
  projectRoot: string;
  baseCheckpointId: string;
  selectionNodeId: string;
  change: VisualPropertyChange;
  request: VisualTokenPlanInput;
  tokenName: string;
  usageCount: number;
  elementPlan: VisualTokenScopePlan;
  tokenPlan: VisualTokenScopePlan;
}

export interface VisualTokenApplyResult {
  scope: VisualTokenScope;
  tokenName: string;
  sourcePath: string;
  cssProperty: string;
  line: number;
  previousFingerprint: string;
  nextFingerprint: string;
  bytesWritten: number;
  plan: VisualTokenScopePlan;
}

export type VisualTokenPlanDecision =
  | { kind: 'scope-choice'; prepared: PreparedVisualTokenEdit }
  | { kind: 'fallback'; reason: string };

export interface VisualTokenCommitResult {
  checkpointId: string;
  sourcePath: string;
  cssProperty: string;
  line: number;
  scope: VisualTokenScope;
  tokenName: string;
}

export interface VisualTokenCoordinator {
  plan(selection: EditorSelection, changes: VisualPropertyChange[]): Promise<VisualTokenPlanDecision>;
  commit(prepared: PreparedVisualTokenEdit, scope: VisualTokenScope): Promise<VisualTokenCommitResult>;
}

let coordinator: VisualTokenCoordinator | null = null;

export function registerVisualTokenCoordinator(next: VisualTokenCoordinator): () => void {
  coordinator = next;
  return () => {
    if (coordinator === next) coordinator = null;
  };
}

function scopePlanValid(prepared: PreparedVisualTokenEdit): boolean {
  if (!/^--[a-zA-Z0-9_-]{1,118}$/.test(prepared.tokenName)) return false;
  if (prepared.elementPlan.scope !== 'element' || prepared.tokenPlan.scope !== 'token') return false;
  if (prepared.elementPlan.tokenName !== prepared.tokenName || prepared.tokenPlan.tokenName !== prepared.tokenName) return false;
  if (prepared.elementPlan.selector.trim() !== `#${prepared.request.elementId}`) return false;
  if (prepared.tokenPlan.selector.trim() !== ':root') return false;
  return true;
}

export async function planVisualTokenEdit(
  selection: EditorSelection,
  changes: VisualPropertyChange[],
): Promise<VisualTokenPlanDecision> {
  if (!coordinator) return { kind: 'fallback', reason: 'Direct design-token editing is not ready in this workspace.' };
  if (!selection.id || selection.idUnique !== true) {
    return { kind: 'fallback', reason: 'Token editing requires a DOM id proven unique in the current preview.' };
  }
  if (changes.length !== 1 || changes[0]?.property === 'textContent') {
    return { kind: 'fallback', reason: 'Token v1 handles one non-text property at a time.' };
  }
  const decision = await coordinator.plan(selection, changes);
  if (decision.kind === 'scope-choice' && !scopePlanValid(decision.prepared)) {
    return { kind: 'fallback', reason: 'The token source scope needs deeper parsing, so Monument will use Codex.' };
  }
  return decision;
}

export async function commitVisualTokenEdit(
  prepared: PreparedVisualTokenEdit,
  scope: VisualTokenScope,
): Promise<VisualTokenCommitResult> {
  if (!coordinator) throw new Error('Direct design-token editing is no longer available. Re-plan the edit.');
  if (!scopePlanValid(prepared)) throw new Error('The prepared token scope is no longer deterministic. Re-plan with Codex.');
  const liveSelection = getVisualEditorState().selection;
  if (
    !liveSelection
    || liveSelection.nodeId !== prepared.selectionNodeId
    || liveSelection.id !== prepared.request.elementId
    || liveSelection.idUnique !== true
  ) {
    throw new Error('The selected element or unique DOM id scope changed after the token dry-run. Re-plan before applying source.');
  }
  return coordinator.commit(prepared, scope);
}
