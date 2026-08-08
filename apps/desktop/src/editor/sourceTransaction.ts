import { getVisualEditorState } from './controller';
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

function selectorNeedsDeeperParsing(selector: string): boolean {
  // Direct CSS v1 intentionally accepts only simple, literal selector syntax. Native source
  // ownership already refuses comma/pseudo ambiguity; keep attributes, comments, escapes and
  // function/string syntax on the Codex path until selector ownership is parser-backed end to end.
  return selector.includes('[')
    || selector.includes(']')
    || selector.includes('/*')
    || selector.includes('*/')
    || selector.includes('\\')
    || selector.includes('"')
    || selector.includes("'")
    || selector.includes('(')
    || selector.includes(')');
}

export async function planVisualSourceEdit(
  selection: EditorSelection,
  changes: VisualPropertyChange[],
): Promise<VisualSourcePlanDecision> {
  if (!coordinator) return { kind: 'fallback', reason: 'Direct source editing is not ready in this workspace.' };
  if (!selection.id || selection.idUnique !== true) {
    return { kind: 'fallback', reason: 'Direct CSS v1 requires a DOM id that is proven unique in the current preview.' };
  }
  const decision = await coordinator.plan(selection, changes);
  if (decision.kind === 'deterministic' && selectorNeedsDeeperParsing(decision.prepared.plan.selector)) {
    return { kind: 'fallback', reason: 'This selector needs deeper source parsing, so Monument will use Codex for this edit.' };
  }
  return decision;
}

export async function commitVisualSourceEdit(prepared: PreparedVisualSourceEdit): Promise<VisualSourceCommitResult> {
  if (!coordinator) throw new Error('Direct source editing is no longer available. Re-plan the edit.');
  if (selectorNeedsDeeperParsing(prepared.plan.selector)) {
    throw new Error('This source selector is no longer eligible for deterministic editing. Re-plan with Codex.');
  }
  const liveSelection = getVisualEditorState().selection;
  if (
    !liveSelection
    || liveSelection.nodeId !== prepared.selectionNodeId
    || liveSelection.id !== prepared.request.elementId
    || liveSelection.idUnique !== true
  ) {
    throw new Error('The selected element or DOM id scope changed after the dry-run. Re-plan before applying source.');
  }
  return coordinator.commit(prepared);
}
