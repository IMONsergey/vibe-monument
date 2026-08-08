import { inspectProject, stateGet } from '../host/native';
import {
  enqueuePrompt,
  loadPromptQueue,
  setPromptQueuePaused,
} from '../queue/controller';
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

const MAX_CHANGES = 24;
const MAX_VALUE = 300;

function clean(value: string, limit = MAX_VALUE): string {
  return value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function instruction(selection: EditorSelection, changes: VisualPropertyChange[]): string {
  const safe = changes.slice(0, MAX_CHANGES).map((change) => ({
    property: clean(change.property, 80),
    before: clean(change.before),
    after: clean(change.after),
  })).filter((change) => change.property && change.after && change.before !== change.after);

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
