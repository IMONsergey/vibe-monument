import { invokeNative, stateGet } from '../host/native';
import type { VisualPropertyChange } from './intent';
import type { EditorSelection } from './types';

export type TokenDefinitionScope = 'global' | 'scoped';

export interface VisualTokenDefinition {
  path: string;
  line: number;
  selector: string;
  value: string;
  scope: TokenDefinitionScope;
  selectedScope: boolean;
  conditional: boolean;
}

export interface VisualTokenEditSource {
  path: string;
  line: number;
  selector: string;
  property: string;
  sourceValue: string;
  conditional: boolean;
}

export interface VisualTokenEditProbe {
  eligible: boolean;
  reason: string;
  token: string | null;
  source: VisualTokenEditSource | null;
  definitions: VisualTokenDefinition[];
  definitionCount: number;
  usageCount: number;
  truncated: boolean;
  instanceEligible: boolean;
}

export type VisualTokenEditDecision =
  | { mode: 'instance' }
  | { mode: 'token'; definition: VisualTokenDefinition; confirmSharedGlobal: boolean }
  | { mode: 'codex' };

export interface VisualTokenTransactionPlan {
  safe: boolean;
  reason: string;
  mode: 'instance' | 'token';
  token: string | null;
  scope: 'instance' | 'local-token' | 'global-token' | 'codex';
  path: string | null;
  line: number | null;
  selector: string | null;
  sourceBefore: string | null;
  sourceAfter: string | null;
  affectedUsageCount: number;
}

export interface VisualTokenTransactionCommit {
  path: string;
  appliedCount: number;
  bytesWritten: number;
  token: string;
  scope: 'instance' | 'local-token' | 'global-token';
  affectedUsageCount: number;
}

const MAX_VALUE = 300;

function clean(value: string, limit = MAX_VALUE): string {
  return value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function transactionSelection(selection: EditorSelection) {
  return {
    id: selection.id || null,
    classes: selection.classes.slice(0, 16),
    selector: selection.selector.slice(0, 220),
  };
}

function tokenChange(change: VisualPropertyChange) {
  return {
    property: clean(change.property, 80),
    before: clean(change.before),
    after: clean(change.after),
  };
}

function nativeDecision(decision: Exclude<VisualTokenEditDecision, { mode: 'codex' }>) {
  if (decision.mode === 'instance') {
    return {
      mode: 'instance',
      targetPath: null,
      targetLine: null,
      targetSelector: null,
      expectedValue: null,
      confirmSharedGlobal: false,
    };
  }
  return {
    mode: 'token',
    targetPath: decision.definition.path,
    targetLine: decision.definition.line,
    targetSelector: decision.definition.selector,
    expectedValue: decision.definition.value,
    confirmSharedGlobal: decision.confirmSharedGlobal,
  };
}

export function tokenDecisionKey(decision: VisualTokenEditDecision): string {
  if (decision.mode === 'instance' || decision.mode === 'codex') return decision.mode;
  return `token:${decision.definition.path}:${decision.definition.line}:${decision.definition.selector}`;
}

export function defaultTokenDecision(probe: VisualTokenEditProbe): VisualTokenEditDecision {
  if (probe.truncated) return { mode: 'codex' };
  if (probe.instanceEligible) return { mode: 'instance' };
  const local = probe.definitions.find((definition) =>
    !definition.conditional && definition.scope === 'scoped' && definition.selectedScope,
  );
  if (local) return { mode: 'token', definition: local, confirmSharedGlobal: false };
  return { mode: 'codex' };
}

export function tokenDecisionRequiresGlobalConfirmation(
  probe: VisualTokenEditProbe,
  decision: VisualTokenEditDecision,
): boolean {
  return decision.mode === 'token'
    && decision.definition.scope === 'global'
    && probe.usageCount > 1
    && !decision.confirmSharedGlobal;
}

export async function probeVisualTokenEdit(
  selection: EditorSelection,
  change: VisualPropertyChange,
): Promise<VisualTokenEditProbe | null> {
  if (!change.property || change.property === 'textContent') return null;
  const projectPath = await stateGet<string>('lastProjectPath').catch(() => null);
  if (!projectPath) return null;
  return invokeNative<VisualTokenEditProbe>('project_token_edit_probe', {
    projectPath,
    selection: transactionSelection(selection),
    change: tokenChange(change),
  }).catch(() => null);
}

export async function previewVisualTokenTransaction(
  projectPath: string,
  selection: EditorSelection,
  change: VisualPropertyChange,
  decision: Exclude<VisualTokenEditDecision, { mode: 'codex' }>,
): Promise<VisualTokenTransactionPlan> {
  return invokeNative<VisualTokenTransactionPlan>('project_token_transaction_preview', {
    projectPath,
    selection: transactionSelection(selection),
    change: tokenChange(change),
    decision: nativeDecision(decision),
  });
}

export async function commitVisualTokenTransaction(
  projectPath: string,
  selection: EditorSelection,
  change: VisualPropertyChange,
  decision: Exclude<VisualTokenEditDecision, { mode: 'codex' }>,
): Promise<VisualTokenTransactionCommit> {
  return invokeNative<VisualTokenTransactionCommit>('project_token_transaction_commit', {
    projectPath,
    selection: transactionSelection(selection),
    change: tokenChange(change),
    decision: nativeDecision(decision),
  });
}
