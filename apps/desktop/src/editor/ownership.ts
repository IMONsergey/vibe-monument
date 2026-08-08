import { invokeNative, isNativeHost } from '../host/native';
import type { EditorSelection } from './types';

export interface EditorSourceHint {
  path: string;
  line: number;
  score: number;
  excerpt: string;
}

export interface EditorSourceOwnership {
  level: 'likely' | 'possible' | 'weak' | 'unknown';
  primary: EditorSourceHint | null;
  alternatives: EditorSourceHint[];
  detail: string;
}

function normalizedHint(value: unknown): EditorSourceHint | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  if (typeof source.path !== 'string' || !source.path.trim()) return null;
  return {
    path: source.path.replace(/\\/g, '/').slice(0, 800),
    line: typeof source.line === 'number' && Number.isFinite(source.line) ? Math.max(1, Math.trunc(source.line)) : 1,
    score: typeof source.score === 'number' && Number.isFinite(source.score) ? Math.max(0, Math.trunc(source.score)) : 0,
    excerpt: typeof source.excerpt === 'string' ? source.excerpt.trim().slice(0, 320) : '',
  };
}

function classify(hints: EditorSourceHint[]): EditorSourceOwnership {
  const primary = hints[0] ?? null;
  if (!primary) return { level: 'unknown', primary: null, alternatives: [], detail: 'No deterministic source candidate found yet.' };
  const second = hints[1]?.score ?? 0;
  const delta = primary.score - second;
  const level: EditorSourceOwnership['level'] = primary.score >= 52 && delta >= 10
    ? 'likely'
    : primary.score >= 28 && delta >= 5
      ? 'possible'
      : 'weak';
  const detail = level === 'likely'
    ? 'Strong search-ranked source candidate. Monument still verifies ownership before editing.'
    : level === 'possible'
      ? 'Plausible source candidate; multiple ownership paths may exist.'
      : 'Weak source signal. The edit should be resolved through code investigation before changing source.';
  return { level, primary, alternatives: hints.slice(1, 4), detail };
}

export async function locateEditorSource(projectRoot: string, selection: EditorSelection): Promise<EditorSourceOwnership> {
  if (!isNativeHost()) return classify([]);
  const raw = await invokeNative<unknown[]>('project_source_hints', {
    projectPath: projectRoot,
    query: {
      text: selection.text || selection.accessibleName || null,
      id: selection.id || null,
      classes: selection.classes,
      selector: selection.selector,
    },
  }).catch(() => []);
  const hints = raw.map(normalizedHint).filter((hint): hint is EditorSourceHint => Boolean(hint)).slice(0, 8);
  return classify(hints);
}
