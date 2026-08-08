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

interface CompetingCssPlan {
  mode: 'deterministic' | 'assisted' | 'codex';
  reason: string;
  operations: unknown[];
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

function cssSelection(selection: EditorSelection) {
  return {
    id: selection.id || null,
    classes: selection.classes.slice(0, 16),
    selector: selection.selector.slice(0, 220),
  };
}

function markupChange(change: VisualPropertyChange) {
  return {
    property: clean(change.property, 80),
    before: clean(change.before),
    after: clean(change.after),
  };
}

async function competingCssOwnership(
  projectPath: string,
  selection: EditorSelection,
  change: VisualPropertyChange,
): Promise<CompetingCssPlan> {
  return invokeNative<CompetingCssPlan>('project_source_transaction_preview', {
    projectPath,
    selection: cssSelection(selection),
    changes: [markupChange(change)],
  }).catch((error) => ({
    mode: 'assisted' as const,
    reason: `CSS ownership preflight unavailable: ${error instanceof Error ? error.message : String(error)}`,
    operations: [],
  }));
}

export async function probeVisualMarkupEdit(
  selection: EditorSelection,
  change: VisualPropertyChange,
): Promise<VisualMarkupEditProbe | null> {
  if (!change.property || change.property === 'textContent' || !selection.id || !selection.idUnique) return null;
  const projectPath = await stateGet<string>('lastProjectPath').catch(() => null);
  if (!projectPath) return null;

  // CSS ownership outranks markup ownership. Unknown CSS ownership also fails closed: a native
  // preflight error must never be interpreted as proof that no CSS owner exists.
  const cssPlan = await competingCssOwnership(projectPath, selection, change);
  if (cssPlan.mode !== 'codex') return {
    mode: 'codex',
    reason: cssPlan.reason || 'CSS ownership is present or could not be excluded safely.',
    operation: null,
  };

  return invokeNative<VisualMarkupEditProbe>('project_markup_edit_probe', {
    projectPath,
    selection: markupSelection(selection),
    change: markupChange(change),
  }).catch((error) => ({
    mode: 'codex' as const,
    reason: `JSX/Tailwind ownership preflight unavailable: ${error instanceof Error ? error.message : String(error)}`,
    operation: null,
  }));
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
