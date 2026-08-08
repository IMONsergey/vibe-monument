import { invokeNative, stateGet } from '../host/native';
import type { VisualPropertyChange } from './intent';
import type { EditorSelection } from './types';

export type VisualMarkupLane = 'tailwind' | 'jsx-style';
export type VisualMarkupDecision = 'direct' | 'codex';

export interface VisualMarkupOperation {
  lane: VisualMarkupLane;
  path: string;
  line: number;
  tag: string;
  attribute: string;
  property: string;
  sourceBefore: string;
  sourceAfter: string;
  ownerKind: string;
}

export interface VisualMarkupEditProbe {
  mode: 'deterministic' | 'codex';
  reason: string;
  operation: VisualMarkupOperation | null;
}

export interface VisualMarkupTransactionPlan {
  safe: boolean;
  reason: string;
  operation: VisualMarkupOperation | null;
}

export interface VisualMarkupTransactionCommit {
  path: string;
  appliedCount: number;
  bytesWritten: number;
  lane: VisualMarkupLane;
  ownerKind: string;
}

const MAX_VALUE = 300;

function clean(value: string, limit = MAX_VALUE): string {
  return value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function markupSelection(selection: EditorSelection) {
  return {
    id: selection.id || null,
    idUnique: selection.idUnique === true,
    classes: selection.classes.slice(0, 16),
    tag: selection.tag.slice(0, 32),
  };
}

function markupChange(change: VisualPropertyChange) {
  return {
    property: clean(change.property, 80),
    before: clean(change.before),
    after: clean(change.after),
  };
}

export async function probeVisualMarkupEdit(
  selection: EditorSelection,
  change: VisualPropertyChange,
): Promise<VisualMarkupEditProbe | null> {
  if (!change.property || change.property === 'textContent' || !selection.id || !selection.idUnique) return null;
  const projectPath = await stateGet<string>('lastProjectPath').catch(() => null);
  if (!projectPath) return null;
  return invokeNative<VisualMarkupEditProbe>('project_markup_edit_probe', {
    projectPath,
    selection: markupSelection(selection),
    change: markupChange(change),
  }).catch(() => null);
}

export async function previewVisualMarkupTransaction(
  projectPath: string,
  selection: EditorSelection,
  change: VisualPropertyChange,
): Promise<VisualMarkupTransactionPlan> {
  return invokeNative<VisualMarkupTransactionPlan>('project_markup_transaction_preview', {
    projectPath,
    selection: markupSelection(selection),
    change: markupChange(change),
  });
}

export async function commitVisualMarkupTransaction(
  projectPath: string,
  selection: EditorSelection,
  change: VisualPropertyChange,
): Promise<VisualMarkupTransactionCommit> {
  return invokeNative<VisualMarkupTransactionCommit>('project_markup_transaction_commit', {
    projectPath,
    selection: markupSelection(selection),
    change: markupChange(change),
  });
}
