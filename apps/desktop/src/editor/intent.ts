import { markBrowserEvidenceStale } from '../browser/evidence';
import { inspectProject, invokeNative, stateGet } from '../host/native';
import {
  enqueuePrompt,
  loadPromptQueue,
  setPromptQueuePaused,
} from '../queue/controller';
import { checkpointVisualSourceTransaction } from '../timeline/controller';
import {
  isSourceTransactionValidationBusy,
  markSourceTransactionDirty,
  recordSourceTransactionCheckpoint,
} from './transactionState';
import type { EditorSelection } from './types';

export interface VisualPropertyChange {
  property: string;
  before: string;
  after: string;
}

export interface VisualEditQueuedResult {
  projectId: string;
  queuedCount: number;
  paused: boolean;
}

export interface VisualEditApplyResult {
  projectId: string;
  mode: 'direct' | 'codex';
  queuedCount: number;
  paused: boolean;
  appliedCount: number;
  sourcePath: string | null;
  checkpointId: string | null;
  turnSerial: number | null;
  reason: string;
}

interface SourceTransactionPlan {
  mode: 'deterministic' | 'assisted' | 'codex';
  reason: string;
  operations: Array<{
    path: string;
    line: number;
    selector: string;
    property: string;
    sourceBefore: string;
    sourceAfter: string;
    ownerKind: string;
  }>;
}

interface SourceTransactionCommit {
  path: string;
  appliedCount: number;
  bytesWritten: number;
}

const MAX_CHANGES = 24;
const MAX_VALUE = 300;

function clean(value: string, limit = MAX_VALUE): string {
  return value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function safeChanges(changes: VisualPropertyChange[]): VisualPropertyChange[] {
  return changes.slice(0, MAX_CHANGES).map((change) => ({
    property: clean(change.property, 80),
    before: clean(change.before),
    after: clean(change.after),
  })).filter((change) => change.property && change.after && change.before !== change.after);
}

function instruction(selection: EditorSelection, changes: VisualPropertyChange[]): string {
  const safe = safeChanges(changes);

  if (!safe.length) throw new Error('No visual property changes to apply.');

  return [
    '[Monument Visual Editor property edit]',
    '',
    `Update the selected live <${selection.tag}> element in the real project source.`,
    'Requested property changes:',
    ...safe.map((change) => `- ${change.property}: ${change.before || '[unset]'} → ${change.after}`),
    '',
    'Editing contract:',
    '- Source code is authoritative. Do not solve this by injecting temporary runtime styles or editor-only overrides.',
    '- Inspect the owning source/component and preserve the project’s existing styling system, tokens and abstractions.',
    '- Prefer an existing design token, CSS variable, utility/class convention or component prop when it represents the requested value correctly.',
    '- Keep the edit scoped to the selected element and avoid unrelated refactors.',
    '- Preserve responsive behavior unless the requested property explicitly requires changing it.',
    '- If the runtime element maps ambiguously to source, investigate before editing rather than guessing.',
    '- Normal Codex approvals remain authoritative.',
  ].join('\n');
}

function transactionSelection(selection: EditorSelection): { id: string | null; classes: string[]; selector: string } {
  return {
    id: selection.id || null,
    classes: selection.classes.slice(0, 16),
    selector: selection.selector.slice(0, 220),
  };
}

function directTransactionTitle(selection: EditorSelection, changes: VisualPropertyChange[]): string {
  const target = selection.accessibleName || selection.text || selection.tag;
  const properties = changes.slice(0, 3).map((change) => change.property).join(', ');
  return `Visual edit · ${target}${properties ? ` · ${properties}` : ''}`;
}

function directTransactionDetail(path: string, changes: VisualPropertyChange[]): string {
  return [
    `Direct deterministic source transaction in ${path}.`,
    ...changes.slice(0, MAX_CHANGES).map((change) => `${change.property}: ${change.before || '[unset]'} → ${change.after}`),
  ].join(' · ');
}

async function directSourcePlan(
  projectPath: string,
  selection: EditorSelection,
  changes: VisualPropertyChange[],
): Promise<SourceTransactionPlan> {
  return invokeNative<SourceTransactionPlan>('project_source_transaction_preview', {
    projectPath,
    selection: transactionSelection(selection),
    changes: safeChanges(changes),
  });
}

async function commitDirectSourceEdit(
  projectPath: string,
  selection: EditorSelection,
  changes: VisualPropertyChange[],
): Promise<SourceTransactionCommit> {
  return invokeNative<SourceTransactionCommit>('project_source_transaction_commit', {
    projectPath,
    selection: transactionSelection(selection),
    changes: safeChanges(changes),
  });
}

export async function queueVisualPropertyEdit(
  selection: EditorSelection,
  changes: VisualPropertyChange[],
): Promise<VisualEditQueuedResult> {
  const projectPath = await stateGet<string>('lastProjectPath').catch(() => null);
  if (!projectPath) throw new Error('Open a project before applying visual changes.');
  const project = await inspectProject(projectPath);
  const before = await loadPromptQueue(project.id, false);
  await enqueuePrompt(project.id, instruction(selection, changes), selection, null);

  // A user-initiated Apply should run immediately when there was no deliberately-paused backlog.
  // If the user paused an existing queue, preserve that decision and add this edit to the backlog.
  const shouldResume = !before.paused || before.items.length === 0;
  const after = shouldResume ? await setPromptQueuePaused(project.id, false) : await loadPromptQueue(project.id, false);
  return { projectId: project.id, queuedCount: after.items.length, paused: after.paused };
}

export async function applyVisualPropertyEdit(
  selection: EditorSelection,
  changes: VisualPropertyChange[],
): Promise<VisualEditApplyResult> {
  const projectPath = await stateGet<string>('lastProjectPath').catch(() => null);
  if (!projectPath) throw new Error('Open a project before applying visual changes.');
  const project = await inspectProject(projectPath);
  if (isSourceTransactionValidationBusy(project.id)) {
    throw new Error('The previous direct visual edit is still being verified. Apply the next source transaction after its evidence settles.');
  }
  const bounded = safeChanges(changes);
  if (!bounded.length) throw new Error('No visual property changes to apply.');

  const plan = await directSourcePlan(project.rootPath, selection, bounded).catch((error) => ({
    mode: 'codex' as const,
    reason: `Deterministic source resolution unavailable: ${error instanceof Error ? error.message : String(error)}`,
    operations: [],
  }));

  if (plan.mode === 'deterministic' && plan.operations.length === bounded.length) {
    // Commit re-runs the resolver natively. The dry-run is never trusted as authority.
    const committed = await commitDirectSourceEdit(project.rootPath, selection, bounded);
    markSourceTransactionDirty(project.id);
    await markBrowserEvidenceStale(project.id).catch(() => undefined);
    const checkpoint = await checkpointVisualSourceTransaction({
      project,
      title: directTransactionTitle(selection, bounded),
      detail: directTransactionDetail(committed.path, bounded),
    });
    if (checkpoint.turnSerial == null || checkpoint.turnSerial === 0) {
      throw new Error('Visual source transaction was written but could not be bound to a Timeline generation. Ship remains blocked until the history state is resolved.');
    }
    recordSourceTransactionCheckpoint(project.id, checkpoint.id, checkpoint.turnSerial);
    window.dispatchEvent(new CustomEvent('monument:source-transaction', {
      detail: {
        projectId: project.id,
        path: committed.path,
        appliedCount: committed.appliedCount,
        checkpointId: checkpoint.id,
        turnSerial: checkpoint.turnSerial,
      },
    }));
    return {
      projectId: project.id,
      mode: 'direct',
      queuedCount: 0,
      paused: false,
      appliedCount: committed.appliedCount,
      sourcePath: committed.path,
      checkpointId: checkpoint.id,
      turnSerial: checkpoint.turnSerial,
      reason: plan.reason,
    };
  }

  const queued = await queueVisualPropertyEdit(selection, bounded);
  return {
    projectId: queued.projectId,
    mode: 'codex',
    queuedCount: queued.queuedCount,
    paused: queued.paused,
    appliedCount: 0,
    sourcePath: null,
    checkpointId: null,
    turnSerial: null,
    reason: plan.reason,
  };
}
