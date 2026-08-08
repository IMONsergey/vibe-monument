import { markBrowserEvidenceStale } from '../browser/evidence';
import { inspectProject, invokeNative, stateGet } from '../host/native';
import {
  enqueuePrompt,
  loadPromptQueue,
  setPromptQueuePaused,
} from '../queue/controller';
import { checkpointVisualSourceTransaction, readTimelineStatus } from '../timeline/controller';
import {
  commitVisualContentTransaction,
  isVisualContentChange,
  previewVisualContentTransaction,
  type VisualContentCommit,
  type VisualContentDecision,
} from './contentEditing';
import {
  commitVisualMarkupTransaction,
  previewVisualMarkupTransaction,
  type VisualMarkupDecision,
  type VisualMarkupTransactionCommit,
} from './markupEditing';
import {
  commitVisualTokenTransaction,
  previewVisualTokenTransaction,
  type VisualTokenEditDecision,
  type VisualTokenTransactionCommit,
} from './tokenEditing';
import {
  isSourceTransactionOrchestrationBlocked,
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

export type VisualSourceLane = 'tailwind' | 'jsx-style' | 'jsx-content' | null;

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
  token: string | null;
  scope: string | null;
  affectedUsageCount: number;
  sourceLane: VisualSourceLane;
  ownerKind: string | null;
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
const MAX_STYLE_VALUE = 300;
const MAX_CONTENT_TEXT = 4_800;
const MAX_CONTENT_ATTRIBUTE = 800;

function cleanStyle(value: string, limit = MAX_STYLE_VALUE): string {
  return value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function cleanContent(value: string, limit: number): string {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, limit);
}

function boundedValue(property: string, value: string): string {
  if (property === 'textContent') return cleanContent(value, MAX_CONTENT_TEXT);
  if (isVisualContentChange({ property, before: '', after: value })) return cleanContent(value, MAX_CONTENT_ATTRIBUTE);
  return cleanStyle(value);
}

function safeChanges(changes: VisualPropertyChange[]): VisualPropertyChange[] {
  return changes.slice(0, MAX_CHANGES).map((change) => ({
    property: cleanStyle(change.property, 80),
    before: boundedValue(change.property, change.before),
    after: boundedValue(change.property, change.after),
  })).filter((change) => change.property && change.after !== change.before);
}

function instruction(selection: EditorSelection, changes: VisualPropertyChange[]): string {
  const safe = safeChanges(changes);
  if (!safe.length) throw new Error('No visual property changes to apply.');
  return [
    '[Monument Visual Editor property edit]',
    '',
    `Update the selected live <${selection.tag}> element in the real project source.`,
    'Requested property changes:',
    ...safe.map((change) => `- ${change.property}: ${change.before || '[unset]'} → ${change.after || '[empty]'}`),
    '',
    'Editing contract:',
    '- Source code is authoritative. Do not solve this by injecting temporary runtime styles or editor-only overrides.',
    '- Inspect the owning source/component and preserve the project’s existing styling/content abstractions.',
    '- Prefer existing design tokens, utility conventions and semantic DOM ownership when they are actually proven.',
    '- Keep the edit scoped to the selected source owner and avoid unrelated refactors.',
    '- Preserve responsive and accessibility behavior unless the request explicitly changes it.',
    '- If runtime-to-source ownership is ambiguous, investigate before editing rather than guessing.',
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

function directTransactionTitle(selection: EditorSelection, changes: VisualPropertyChange[], suffix?: string | null): string {
  const target = selection.accessibleName || selection.text || selection.tag;
  const properties = changes.slice(0, 3).map((change) => change.property).join(', ');
  const label = suffix ? ` · ${suffix}` : '';
  return `Visual edit · ${target}${properties ? ` · ${properties}` : ''}${label}`;
}

function directTransactionDetail(path: string, changes: VisualPropertyChange[], prefix = 'Direct deterministic source transaction'): string {
  return [
    `${prefix} in ${path}.`,
    ...changes.slice(0, MAX_CHANGES).map((change) => `${change.property}: ${change.before || '[unset]'} → ${change.after || '[empty]'}`),
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

async function finishDirectVisualEdit(input: {
  project: Awaited<ReturnType<typeof inspectProject>>;
  selection: EditorSelection;
  changes: VisualPropertyChange[];
  commit: SourceTransactionCommit | VisualTokenTransactionCommit | VisualMarkupTransactionCommit | VisualContentCommit;
  reason: string;
  token?: string | null;
  scope?: string | null;
  affectedUsageCount?: number;
  sourceLane?: VisualSourceLane;
  ownerKind?: string | null;
}): Promise<VisualEditApplyResult> {
  const { project, selection, changes, commit, reason } = input;
  markSourceTransactionDirty(project.id);
  await markBrowserEvidenceStale(project.id).catch(() => undefined);
  const token = input.token ?? ('token' in commit ? commit.token : null);
  const scope = input.scope ?? ('scope' in commit ? commit.scope : null);
  const affectedUsageCount = input.affectedUsageCount ?? ('affectedUsageCount' in commit ? commit.affectedUsageCount : 1);
  const sourceLane = input.sourceLane ?? ('lane' in commit ? commit.lane : null);
  const ownerKind = input.ownerKind ?? ('ownerKind' in commit ? commit.ownerKind : null);
  const detailPrefix = token
    ? `Direct ${scope || 'token'} source transaction for ${token}; source refs ${affectedUsageCount}`
    : sourceLane === 'jsx-content'
      ? `Direct JSX content transaction · ${ownerKind || 'static content owner'}`
      : sourceLane
        ? `Direct ${sourceLane} transaction · ${ownerKind || 'static source owner'}`
        : 'Direct deterministic source transaction';
  const checkpoint = await checkpointVisualSourceTransaction({
    project,
    title: directTransactionTitle(selection, changes, token || sourceLane),
    detail: directTransactionDetail(commit.path, changes, detailPrefix),
  });
  if (checkpoint.turnSerial == null || checkpoint.turnSerial === 0) {
    throw new Error('Visual source transaction was written but could not be bound to a Timeline generation. Ship remains blocked until the history state is resolved.');
  }
  recordSourceTransactionCheckpoint(project.id, checkpoint.id, checkpoint.turnSerial);
  window.dispatchEvent(new CustomEvent('monument:source-transaction', {
    detail: {
      projectId: project.id,
      path: commit.path,
      appliedCount: commit.appliedCount,
      checkpointId: checkpoint.id,
      turnSerial: checkpoint.turnSerial,
      token,
      scope,
      affectedUsageCount,
      sourceLane,
      ownerKind,
    },
  }));
  return {
    projectId: project.id,
    mode: 'direct',
    queuedCount: 0,
    paused: false,
    appliedCount: commit.appliedCount,
    sourcePath: commit.path,
    checkpointId: checkpoint.id,
    turnSerial: checkpoint.turnSerial,
    reason,
    token,
    scope,
    affectedUsageCount,
    sourceLane,
    ownerKind,
  };
}

async function codexResult(
  selection: EditorSelection,
  changes: VisualPropertyChange[],
  reason: string,
): Promise<VisualEditApplyResult> {
  const queued = await queueVisualPropertyEdit(selection, changes);
  return {
    projectId: queued.projectId,
    mode: 'codex',
    queuedCount: queued.queuedCount,
    paused: queued.paused,
    appliedCount: 0,
    sourcePath: null,
    checkpointId: null,
    turnSerial: null,
    reason,
    token: null,
    scope: null,
    affectedUsageCount: 0,
    sourceLane: null,
    ownerKind: null,
  };
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
  const shouldResume = !before.paused || before.items.length === 0;
  const after = shouldResume ? await setPromptQueuePaused(project.id, false) : await loadPromptQueue(project.id, false);
  return { projectId: project.id, queuedCount: after.items.length, paused: after.paused };
}

export async function applyVisualPropertyEdit(
  selection: EditorSelection,
  changes: VisualPropertyChange[],
  tokenDecision?: VisualTokenEditDecision,
  markupDecision?: VisualMarkupDecision,
  contentDecision?: VisualContentDecision,
): Promise<VisualEditApplyResult> {
  const projectPath = await stateGet<string>('lastProjectPath').catch(() => null);
  if (!projectPath) throw new Error('Open a project before applying visual changes.');
  const project = await inspectProject(projectPath);
  if (isSourceTransactionOrchestrationBlocked(project.id)) {
    throw new Error('Direct source editing is temporarily locked while Monument is changing or verifying this project.');
  }
  if (isSourceTransactionValidationBusy(project.id)) {
    throw new Error('The previous direct visual edit is still being verified. Apply the next source transaction after its evidence settles.');
  }
  const bounded = safeChanges(changes);
  if (!bounded.length) throw new Error('No visual property changes to apply.');

  if (contentDecision === 'codex') {
    return codexResult(selection, bounded, 'Static JSX content ownership was not selected or could not be proven.');
  }
  if (tokenDecision?.mode === 'codex') {
    return codexResult(selection, bounded, 'User selected the source-aware Codex route for this token-backed edit.');
  }
  if (markupDecision === 'codex') {
    return codexResult(selection, bounded, 'JSX/Tailwind ownership requires the source-aware Codex route for this edit.');
  }

  const timelineStatus = await readTimelineStatus(project).catch(() => null);
  if (!timelineStatus) {
    return codexResult(selection, bounded, 'Version Timeline preflight is unavailable; direct source mutation cannot prove generation ownership.');
  }
  if (timelineStatus.dirty) {
    return codexResult(selection, bounded, 'Current source differs from the active Timeline generation; direct editing is disabled until provenance is resolved.');
  }

  if (contentDecision === 'direct') {
    const plan = await previewVisualContentTransaction(project.rootPath, selection, bounded).catch((error) => ({
      mode: 'codex' as const,
      reason: `Content transaction preflight unavailable: ${error instanceof Error ? error.message : String(error)}`,
      operations: [],
    }));
    if (plan.mode === 'deterministic' && plan.operations.length === bounded.length) {
      const committed = await commitVisualContentTransaction(project.rootPath, selection, bounded);
      const ownerKinds = [...new Set(plan.operations.map((operation) => operation.ownerKind))];
      return finishDirectVisualEdit({
        project,
        selection,
        changes: bounded,
        commit: committed,
        reason: plan.reason,
        sourceLane: 'jsx-content',
        ownerKind: ownerKinds.join(' + '),
      });
    }
    return codexResult(selection, bounded, plan.reason);
  }

  if (tokenDecision && bounded.length === 1) {
    const plan = await previewVisualTokenTransaction(project.rootPath, selection, bounded[0], tokenDecision).catch((error) => ({
      safe: false,
      reason: `Token transaction preflight unavailable: ${error instanceof Error ? error.message : String(error)}`,
      mode: tokenDecision.mode,
      token: null,
      scope: 'codex' as const,
      path: null,
      line: null,
      selector: null,
      sourceBefore: null,
      sourceAfter: null,
      affectedUsageCount: 0,
    }));
    if (plan.safe) {
      const committed = await commitVisualTokenTransaction(project.rootPath, selection, bounded[0], tokenDecision);
      return finishDirectVisualEdit({
        project,
        selection,
        changes: bounded,
        commit: committed,
        reason: plan.reason,
        token: committed.token,
        scope: committed.scope,
        affectedUsageCount: committed.affectedUsageCount,
      });
    }
    return codexResult(selection, bounded, plan.reason);
  }

  if (markupDecision === 'direct' && bounded.length === 1) {
    const plan = await previewVisualMarkupTransaction(project.rootPath, selection, bounded[0]).catch((error) => ({
      safe: false,
      reason: `JSX/Tailwind transaction preflight unavailable: ${error instanceof Error ? error.message : String(error)}`,
      operation: null,
    }));
    if (plan.safe && plan.operation) {
      const committed = await commitVisualMarkupTransaction(project.rootPath, selection, bounded[0]);
      return finishDirectVisualEdit({
        project,
        selection,
        changes: bounded,
        commit: committed,
        reason: plan.reason,
        sourceLane: committed.lane,
        ownerKind: committed.ownerKind,
      });
    }
    return codexResult(selection, bounded, plan.reason);
  }

  const plan: SourceTransactionPlan = await directSourcePlan(project.rootPath, selection, bounded).catch((error) => ({
    mode: 'codex' as const,
    reason: `Deterministic source resolution unavailable: ${error instanceof Error ? error.message : String(error)}`,
    operations: [],
  }));

  if (plan.mode === 'deterministic' && plan.operations.length === bounded.length) {
    const committed = await commitDirectSourceEdit(project.rootPath, selection, bounded);
    return finishDirectVisualEdit({ project, selection, changes: bounded, commit: committed, reason: plan.reason });
  }

  return codexResult(selection, bounded, plan.reason);
}
