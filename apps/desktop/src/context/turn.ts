import { invokeNative, isNativeHost } from '../host/native';
import { getPreviewSelection, selectionContext, type PreviewSelection } from '../preview/selection';

interface SourceHint {
  path: string;
  line: number;
  score: number;
  excerpt: string;
}

function sourceHintContext(hints: SourceHint[]): string {
  if (!hints.length) return '';
  return [
    '[Monument deterministic source hints]',
    ...hints.slice(0, 8).map((hint, index) => `${index + 1}. ${hint.path}:${hint.line} · score ${hint.score}\n   ${hint.excerpt}`),
    'These are search-ranked hints, not proof of ownership. Inspect the candidate source before editing.',
  ].join('\n');
}

async function locateSourceHints(projectRoot: string, selection: PreviewSelection): Promise<SourceHint[]> {
  if (!isNativeHost()) return [];
  return invokeNative<SourceHint[]>('project_source_hints', {
    projectPath: projectRoot,
    query: {
      text: selection.text || selection.accessibleName || null,
      id: selection.id || null,
      classes: selection.classes,
      selector: selection.selector,
    },
  }).catch(() => []);
}

export async function compileTurnText(userText: string, projectRoot: string): Promise<string> {
  const text = userText.trim();
  const selection = getPreviewSelection();
  if (!selection) return text;
  const hints = await locateSourceHints(projectRoot, selection);
  return [text, selectionContext(selection), sourceHintContext(hints)].filter(Boolean).join('\n\n');
}
