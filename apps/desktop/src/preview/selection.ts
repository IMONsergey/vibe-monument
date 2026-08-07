export interface PreviewSelection {
  url: string;
  viewport: { width?: number; height?: number; dpr?: number };
  tag: string;
  id?: string | null;
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

export function getPreviewSelection(): PreviewSelection | null {
  return currentSelection;
}

export function setPreviewSelection(selection: PreviewSelection | null): void {
  currentSelection = selection;
  for (const listener of listeners) listener(selection);
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
  const styleEntries = Object.entries(selection.styles)
    .filter(([, value]) => typeof value === 'string' && value.length > 0)
    .slice(0, 24)
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ');

  return [
    '[Monument live element context]',
    `URL: ${selection.url}`,
    `Viewport: ${finite(selection.viewport.width)}×${finite(selection.viewport.height)} @ ${finite(selection.viewport.dpr)}x`,
    `Element: <${selection.tag}>${selection.role ? ` role=${selection.role}` : ''}`,
    selection.id ? `ID: ${selection.id}` : '',
    selection.classes.length ? `Classes: ${selection.classes.join(' ')}` : '',
    selection.accessibleName ? `Accessible name: ${selection.accessibleName}` : '',
    selection.text ? `Rendered text: ${selection.text}` : '',
    `Selector: ${selection.selector}`,
    selection.parent?.selector ? `Parent: ${selection.parent.selector}` : '',
    `Rect: x=${finite(selection.rect.x)}, y=${finite(selection.rect.y)}, w=${finite(selection.rect.width)}, h=${finite(selection.rect.height)}`,
    styleEntries ? `Computed styles: ${styleEntries}` : '',
    'Treat this as observed runtime context. Locate the owning source/component in the current repository before editing; do not invent a source file from the selector alone.',
  ].filter(Boolean).join('\n');
}
