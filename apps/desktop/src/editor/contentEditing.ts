import { invokeNative, stateGet } from '../host/native';
import type { VisualPropertyChange } from './intent';
import type { EditorSelection } from './types';

export type VisualContentDecision = 'direct' | 'codex';
export type VisualContentKind = 'text' | 'attribute';

export interface VisualContentOperation {
  kind: VisualContentKind;
  path: string;
  line: number;
  tag: string;
  property: string;
  sourceBefore: string;
  sourceAfter: string;
  ownerKind: string;
}

export interface VisualContentProbe {
  mode: 'deterministic' | 'codex';
  reason: string;
  operations: VisualContentOperation[];
}

export interface VisualContentCommit {
  path: string;
  appliedCount: number;
  bytesWritten: number;
  kinds: VisualContentKind[];
}

const CONTENT_PROPERTIES = new Set(['textContent', 'ariaLabel', 'title', 'alt', 'placeholder']);
const MAX_CONTENT_CHANGES = 8;
const MAX_TEXT = 4_800;
const MAX_ATTRIBUTE = 800;

function clean(value: string, limit: number): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .slice(0, limit);
}

export function isVisualContentChange(change: VisualPropertyChange): boolean {
  return CONTENT_PROPERTIES.has(change.property);
}

export function isVisualContentBatch(changes: VisualPropertyChange[]): boolean {
  return changes.length > 0
    && changes.length <= MAX_CONTENT_CHANGES
    && changes.every(isVisualContentChange);
}

function nativeSelection(selection: EditorSelection) {
  return {
    id: selection.id || null,
    idUnique: selection.idUnique === true,
    tag: selection.tag.slice(0, 32),
    directText: clean(selection.directText, MAX_TEXT),
    attributes: {
      ariaLabel: clean(selection.contentAttributes.ariaLabel, MAX_ATTRIBUTE),
      title: clean(selection.contentAttributes.title, MAX_ATTRIBUTE),
      alt: clean(selection.contentAttributes.alt, MAX_ATTRIBUTE),
      placeholder: clean(selection.contentAttributes.placeholder, MAX_ATTRIBUTE),
    },
  };
}

function nativeChanges(changes: VisualPropertyChange[]) {
  return changes.slice(0, MAX_CONTENT_CHANGES).map((change) => ({
    property: change.property,
    before: clean(change.before, change.property === 'textContent' ? MAX_TEXT : MAX_ATTRIBUTE),
    after: clean(change.after, change.property === 'textContent' ? MAX_TEXT : MAX_ATTRIBUTE),
  }));
}

export async function probeVisualContentEdit(
  selection: EditorSelection,
  changes: VisualPropertyChange[],
): Promise<VisualContentProbe | null> {
  if (!isVisualContentBatch(changes) || !selection.id || !selection.idUnique) return null;
  if (changes.some((change) => change.property !== 'textContent') && !selection.contentReady) return null;
  const projectPath = await stateGet<string>('lastProjectPath').catch(() => null);
  if (!projectPath) return null;
  return invokeNative<VisualContentProbe>('project_content_edit_probe', {
    projectPath,
    selection: nativeSelection(selection),
    changes: nativeChanges(changes),
  }).catch((error) => ({
    mode: 'codex',
    reason: `Content ownership preflight unavailable: ${error instanceof Error ? error.message : String(error)}`,
    operations: [],
  }));
}

export async function previewVisualContentTransaction(
  projectPath: string,
  selection: EditorSelection,
  changes: VisualPropertyChange[],
): Promise<VisualContentProbe> {
  return invokeNative<VisualContentProbe>('project_content_transaction_preview', {
    projectPath,
    selection: nativeSelection(selection),
    changes: nativeChanges(changes),
  });
}

export async function commitVisualContentTransaction(
  projectPath: string,
  selection: EditorSelection,
  changes: VisualPropertyChange[],
): Promise<VisualContentCommit> {
  return invokeNative<VisualContentCommit>('project_content_transaction_commit', {
    projectPath,
    selection: nativeSelection(selection),
    changes: nativeChanges(changes),
  });
}
