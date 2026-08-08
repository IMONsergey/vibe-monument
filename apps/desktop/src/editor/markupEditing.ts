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

interface MarkupConflictGuardResult {
  safe: boolean;
  reason: string;
  conflicts: string[];
}

const MAX_VALUE = 300;
const NO_STATIC_MARKUP_OWNER = 'no deterministic jsx inline-style or tailwind utility owner';

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

function guardSelection(selection: EditorSelection) {
  return {
    id: selection.id || null,
    idUnique: selection.idUnique === true,
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

function guardChange(change: VisualPropertyChange) {
  return { property: clean(change.property, 80) };
}

async function nativeMarkupProbe(
  projectPath: string,
  selection: EditorSelection,
  change: VisualPropertyChange,
): Promise<VisualMarkupEditProbe> {
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

async function nativeTailwindConflictGuard(
  projectPath: string,
  selection: EditorSelection,
  change: VisualPropertyChange,
): Promise<MarkupConflictGuardResult> {
  return invokeNative<MarkupConflictGuardResult>('project_markup_conflict_guard', {
    projectPath,
    selection: guardSelection(selection),
    change: guardChange(change),
  }).catch((error) => ({
    safe: false,
    reason: `Tailwind conflict guard unavailable: ${error instanceof Error ? error.message : String(error)}`,
    conflicts: [],
  }));
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

function inlineStyleBlocksStylesheetFallback(probe: VisualMarkupEditProbe): boolean {
  if (probe.mode !== 'codex') return false;
  const reason = probe.reason.toLowerCase();
  if (reason.includes(NO_STATIC_MARKUP_OWNER)) return false;
  return reason.includes('inline style')
    || reason.includes('inline-style')
    || reason.includes('jsx style')
    || reason.includes('style={{');
}

async function validateTailwindDirectLane(
  projectPath: string,
  selection: EditorSelection,
  change: VisualPropertyChange,
): Promise<VisualMarkupEditProbe> {
  const cssPlan = await competingCssOwnership(projectPath, selection, change);
  if (cssPlan.mode !== 'codex') {
    return {
      mode: 'codex',
      reason: cssPlan.reason || 'CSS ownership is present or could not be excluded safely.',
      operation: null,
    };
  }
  const guard = await nativeTailwindConflictGuard(projectPath, selection, change);
  if (!guard.safe) {
    const conflicts = guard.conflicts.length ? ` · ${guard.conflicts.join(', ')}` : '';
    return {
      mode: 'codex',
      reason: `${guard.reason}${conflicts}`,
      operation: null,
    };
  }
  return nativeMarkupProbe(projectPath, selection, change);
}

async function exactDirectProbe(
  projectPath: string,
  selection: EditorSelection,
  change: VisualPropertyChange,
): Promise<VisualMarkupEditProbe> {
  const markup = await nativeMarkupProbe(projectPath, selection, change);
  if (markup.mode !== 'deterministic' || !markup.operation) return markup;
  if (markup.operation.lane === 'jsx-style') return markup;
  return validateTailwindDirectLane(projectPath, selection, change);
}

export async function probeVisualMarkupEdit(
  selection: EditorSelection,
  change: VisualPropertyChange,
): Promise<VisualMarkupEditProbe | null> {
  if (!change.property || change.property === 'textContent' || !selection.id || !selection.idUnique) return null;
  const projectPath = await stateGet<string>('lastProjectPath').catch(() => null);
  if (!projectPath) return null;

  // First establish cascade safety. A proven JSX inline-style literal owns the property above the
  // normal stylesheet/Tailwind lane. A dynamic inline-style candidate is a hard Codex boundary.
  const markup = await nativeMarkupProbe(projectPath, selection, change);
  if (markup.mode === 'deterministic' && markup.operation?.lane === 'jsx-style') return markup;
  if (inlineStyleBlocksStylesheetFallback(markup)) return markup;

  if (markup.mode === 'deterministic' && markup.operation?.lane === 'tailwind') {
    return validateTailwindDirectLane(projectPath, selection, change);
  }

  // Even when the first markup probe did not find a static owner, a proven/assisted CSS owner still
  // outranks the class lane. Unknown CSS ownership fails closed.
  const cssPlan = await competingCssOwnership(projectPath, selection, change);
  if (cssPlan.mode !== 'codex') {
    return {
      mode: 'codex',
      reason: cssPlan.reason || 'CSS ownership is present or could not be excluded safely.',
      operation: null,
    };
  }
  return markup;
}

export async function previewVisualMarkupTransaction(
  projectPath: string,
  selection: EditorSelection,
  change: VisualPropertyChange,
): Promise<VisualMarkupTransactionPlan> {
  // Re-run the complete direct proof immediately before dry-run. This prevents a stale Properties
  // probe from carrying authority across source/HMR changes.
  const exact = await exactDirectProbe(projectPath, selection, change);
  if (exact.mode !== 'deterministic' || !exact.operation) {
    return { safe: false, reason: exact.reason, operation: null };
  }
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
  // The normal commit path re-runs both native ownership and the independent Tailwind conflict guard
  // again immediately before invoking the atomic writer.
  const exact = await exactDirectProbe(projectPath, selection, change);
  if (exact.mode !== 'deterministic' || !exact.operation) {
    throw new Error(`Markup source transaction is no longer deterministic: ${exact.reason}`);
  }
  return invokeNative<VisualMarkupTransactionCommit>('project_markup_transaction_commit', {
    projectPath,
    selection: markupSelection(selection),
    change: markupChange(change),
  });
}
