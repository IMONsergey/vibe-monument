import { invokeNative, listenNative } from '../host/native';
import type { PreviewSelection } from '../preview/selection';
import type {
  EditorBridgeMessage,
  EditorLayer,
  EditorLayerKind,
  EditorSelection,
  EditorTreeSnapshot,
  VisualEditorState,
} from './types';

const MAX_LAYERS = 600;
const MAX_TEXT = 220;
const MAX_SELECTOR = 1200;
const NODE_ID = /^m-\d{1,12}$/;
const LAYER_KINDS = new Set<EditorLayerKind>(['container', 'text', 'media', 'control', 'element']);

type Listener = (state: VisualEditorState) => void;

let state: VisualEditorState = {
  active: false,
  ready: false,
  tree: null,
  selection: null,
  selectedNodeId: null,
  hoveredNodeId: null,
};
const listeners = new Set<Listener>();

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function clipped(value: unknown, limit = MAX_TEXT): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, limit) : '';
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function validNodeId(value: unknown): string | null {
  return typeof value === 'string' && NODE_ID.test(value) ? value : null;
}

function normalizeRect(value: unknown): EditorLayer['rect'] {
  const source = record(value);
  return {
    x: finite(source.x),
    y: finite(source.y),
    width: Math.max(0, finite(source.width)),
    height: Math.max(0, finite(source.height)),
  };
}

function normalizeLayer(value: unknown): EditorLayer | null {
  const source = record(value);
  const id = validNodeId(source.id);
  if (!id) return null;
  const rawKind = clipped(source.kind, 24) as EditorLayerKind;
  const editable = record(source.editable);
  return {
    id,
    parentId: validNodeId(source.parentId),
    depth: Math.max(0, Math.min(18, Math.trunc(finite(source.depth)))),
    tag: clipped(source.tag, 32).toLowerCase() || 'element',
    kind: LAYER_KINDS.has(rawKind) ? rawKind : 'element',
    role: clipped(source.role, 80) || null,
    name: clipped(source.name),
    text: clipped(source.text),
    selector: clipped(source.selector, MAX_SELECTOR),
    classes: Array.isArray(source.classes)
      ? source.classes.filter((item): item is string => typeof item === 'string').slice(0, 8).map((item) => item.slice(0, 80))
      : [],
    rect: normalizeRect(source.rect),
    visible: source.visible !== false,
    display: clipped(source.display, 64),
    position: clipped(source.position, 64),
    editable: {
      text: editable.text === true,
      media: editable.media === true,
      layout: editable.layout === true,
      style: editable.style === true,
    },
  };
}

function normalizeTree(value: unknown): EditorTreeSnapshot | null {
  const source = record(value);
  if (!Array.isArray(source.nodes)) return null;
  const nodes = source.nodes.slice(0, MAX_LAYERS).map(normalizeLayer).filter((node): node is EditorLayer => Boolean(node));
  const ids = new Set(nodes.map((node) => node.id));
  const normalized = nodes.map((node) => node.parentId && !ids.has(node.parentId) ? { ...node, parentId: null } : node);
  return {
    url: clipped(source.url, 2048),
    capturedAt: Math.max(0, finite(source.capturedAt, Date.now())),
    viewport: {
      width: Math.max(0, finite(record(source.viewport).width)),
      height: Math.max(0, finite(record(source.viewport).height)),
      dpr: Math.max(0, finite(record(source.viewport).dpr, 1)),
    },
    nodes: normalized,
    rootIds: Array.isArray(source.rootIds)
      ? source.rootIds.flatMap((value) => {
          const id = validNodeId(value);
          return id && ids.has(id) ? [id] : [];
        }).slice(0, MAX_LAYERS)
      : normalized.filter((node) => !node.parentId).map((node) => node.id),
    truncated: source.truncated === true || source.nodes.length > MAX_LAYERS,
  };
}

function normalizeSelection(value: unknown): EditorSelection | null {
  const source = record(value);
  const nodeId = validNodeId(source.nodeId);
  if (!nodeId) return null;
  const styles = record(source.styles);
  const viewport = record(source.viewport);
  const parent = record(source.parent);
  const id = clipped(source.id, 180) || null;
  return {
    nodeId,
    directText: clipped(source.directText, 1200),
    directTextTruncated: source.directTextTruncated === true,
    url: clipped(source.url, 2048),
    viewport: {
      width: finite(viewport.width),
      height: finite(viewport.height),
      dpr: finite(viewport.dpr, 1),
    },
    tag: clipped(source.tag, 32).toLowerCase() || 'element',
    id,
    classes: Array.isArray(source.classes)
      ? source.classes.filter((item): item is string => typeof item === 'string').slice(0, 12).map((item) => item.slice(0, 80))
      : [],
    role: clipped(source.role, 80) || null,
    accessibleName: clipped(source.accessibleName, 180) || null,
    text: clipped(source.text, 480),
    selector: clipped(source.selector, MAX_SELECTOR),
    rect: normalizeRect(source.rect),
    parent: clipped(parent.selector, MAX_SELECTOR) ? {
      tag: clipped(parent.tag, 32),
      selector: clipped(parent.selector, MAX_SELECTOR),
    } : null,
    styles: Object.fromEntries(
      Object.entries(styles)
        .filter(([, entry]) => typeof entry === 'string')
        .slice(0, 48)
        .map(([key, entry]) => [key.slice(0, 80), String(entry).slice(0, 500)]),
    ),
  };
}

function publish(patch: Partial<VisualEditorState>): VisualEditorState {
  state = { ...state, ...patch };
  for (const listener of listeners) listener(state);
  return state;
}

export function getVisualEditorState(): VisualEditorState { return state; }

export function subscribeVisualEditor(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export function resetVisualEditorPreview(): void {
  publish({
    active: false,
    ready: false,
    tree: null,
    selection: null,
    selectedNodeId: null,
    hoveredNodeId: null,
  });
}

export async function startVisualEditorBridge(): Promise<() => void> {
  return listenNative<EditorBridgeMessage>('monument://preview-editor', (message) => {
    if (!message || typeof message.kind !== 'string') return;
    if (message.kind === 'ready') {
      publish({ ready: true });
      if (state.active) void requestEditorTree();
      return;
    }
    if (message.kind === 'tree') {
      const tree = normalizeTree(message.payload);
      if (!tree) return;
      let selectedNodeId = state.selectedNodeId;
      if (selectedNodeId && !tree.nodes.some((node) => node.id === selectedNodeId)) selectedNodeId = null;
      publish({ tree, selectedNodeId });
      return;
    }
    if (message.kind === 'selection') {
      const selection = normalizeSelection(message.payload);
      if (!selection) return;
      publish({ selection, selectedNodeId: selection.nodeId });
      return;
    }
    if (message.kind === 'hover') {
      const nodeId = validNodeId(record(message.payload).nodeId);
      publish({ hoveredNodeId: nodeId });
    }
  });
}

export async function setVisualEditorActive(active: boolean): Promise<void> {
  const previous = state.active;
  publish({ active });
  try {
    if (active) await invokeNative<void>('preview_set_inspect', { enabled: false }).catch(() => undefined);
    await invokeNative<void>('preview_editor_set_active', { enabled: active });
    if (active) await requestEditorTree();
    else publish({ hoveredNodeId: null });
  } catch (error) {
    publish({ active: previous });
    throw error;
  }
}

export async function requestEditorTree(): Promise<void> {
  await invokeNative<void>('preview_editor_request_tree');
}

export async function selectEditorNode(nodeId: string): Promise<void> {
  if (!NODE_ID.test(nodeId)) return;
  publish({ selectedNodeId: nodeId });
  try {
    await invokeNative<void>('preview_editor_select', { nodeId });
  } catch (error) {
    publish({ selectedNodeId: state.selection?.nodeId ?? null });
    throw error;
  }
}

export async function hoverEditorNode(nodeId: string | null): Promise<void> {
  if (nodeId && !NODE_ID.test(nodeId)) return;
  publish({ hoveredNodeId: nodeId });
  await invokeNative<void>('preview_editor_hover', { nodeId });
}

export function syncEditorSelectionFromPreview(selection: PreviewSelection | null): void {
  if (!selection) {
    publish({ selection: null, selectedNodeId: null });
    return;
  }
  const match = state.tree?.nodes.find((node) => node.selector && node.selector === selection.selector) ?? null;
  if (match) publish({ selectedNodeId: match.id });
}
