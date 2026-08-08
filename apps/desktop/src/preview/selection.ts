export interface PreviewSelection {
  url: string;
  viewport: { width?: number; height?: number; dpr?: number };
  tag: string;
  id?: string | null;
  idUnique?: boolean | null;
  classes: string[];
  role?: string | null;
  accessibleName?: string | null;
  text: string;
  selector: string;
  rect: { x?: number; y?: number; width?: number; height?: number };
  parent?: { tag?: string; selector?: string } | null;
  styles: Record<string, string>;
}

type Listener = (selection: PreviewSelection | null) => void;
let currentSelection: PreviewSelection | null = null;
const listeners = new Set<Listener>();

function clipped(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, limit) : '';
}

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function normalizePreviewSelection(selection: PreviewSelection): PreviewSelection {
  const viewport = selection.viewport || {};
  const rect = selection.rect || {};
  const parent = selection.parent || null;
  return {
    url: clipped(selection.url, 2048),
    viewport: { width: number(viewport.width), height: number(viewport.height), dpr: number(viewport.dpr) },
    tag: clipped(selection.tag, 32).toLowerCase() || 'element',
    id: clipped(selection.id, 180) || null,
    idUnique: selection.idUnique === true ? true : selection.idUnique === false ? false : null,
    classes: Array.isArray(selection.classes)
      ? selection.classes.filter((value): value is string => typeof value === 'string').slice(0, 12).map((value) => clipped(value, 80))
      : [],
    role: clipped(selection.role, 80) || null,
    accessibleName: clipped(selection.accessibleName, 180) || null,
    text: clipped(selection.text, 480),
    selector: clipped(selection.selector, 1200),
    rect: { x: number(rect.x), y: number(rect.y), width: number(rect.width), height: number(rect.height) },
    parent: parent ? { tag: clipped(parent.tag, 32), selector: clipped(parent.selector, 1200) } : null,
    styles: Object.fromEntries(
      Object.entries(selection.styles || {})
        .filter(([, value]) => typeof value === 'string')
        .slice(0, 48)
        .map(([key, value]) => [clipped(key, 80), clipped(value, 500)]),
    ),
  };
}

export function getPreviewSelection(): PreviewSelection | null { return currentSelection; }
export function setPreviewSelection(selection: PreviewSelection | null): void {
  currentSelection = selection ? normalizePreviewSelection(selection) : null;
  for (const listener of listeners) listener(currentSelection);
}
export function subscribePreviewSelection(listener: Listener): () => void {
  listeners.add(listener);
  listener(currentSelection);
  return () => listeners.delete(listener);
}

function finite(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '—';
}

export function selectionLabel(selection: PreviewSelection): string {
  const name = selection.accessibleName || selection.text || selection.selector || selection.tag;
  const compact = name.replace(/\s+/g, ' ').trim();
  return `${selection.tag}${compact ? ` · ${compact.slice(0, 64)}` : ''}`;
}

export function selectionContext(selection: PreviewSelection): string {
  const normalized = normalizePreviewSelection(selection);
  const styleEntries = Object.entries(normalized.styles)
    .filter(([, value]) => value.length > 0)
    .slice(0, 24)
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ');
  return [
    '[Monument live element context]',
    `URL: ${normalized.url}`,
    `Viewport: ${finite(normalized.viewport.width)}×${finite(normalized.viewport.height)} @ ${finite(normalized.viewport.dpr)}x`,
    `Element: <${normalized.tag}>${normalized.role ? ` role=${normalized.role}` : ''}`,
    normalized.id ? `ID: ${normalized.id}${normalized.idUnique === true ? ' (unique in DOM)' : normalized.idUnique === false ? ' (duplicated in DOM)' : ''}` : '',
    normalized.classes.length ? `Classes: ${normalized.classes.join(' ')}` : '',
    normalized.accessibleName ? `Accessible name: ${normalized.accessibleName}` : '',
    normalized.text ? `Rendered text: ${normalized.text}` : '',
    `Selector: ${normalized.selector}`,
    normalized.parent?.selector ? `Parent: ${normalized.parent.selector}` : '',
    `Rect: x=${finite(normalized.rect.x)}, y=${finite(normalized.rect.y)}, w=${finite(normalized.rect.width)}, h=${finite(normalized.rect.height)}`,
    styleEntries ? `Computed styles: ${styleEntries}` : '',
    'Treat this as observed runtime context. Locate the owning source/component in the current repository before editing; do not invent a source file from the selector alone.',
  ].filter(Boolean).join('\n');
}
