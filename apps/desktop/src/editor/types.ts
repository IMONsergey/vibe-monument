import type { PreviewSelection } from '../preview/selection';

export type EditorLayerKind = 'container' | 'text' | 'media' | 'control' | 'element';

export interface EditorLayer {
  id: string;
  parentId: string | null;
  depth: number;
  tag: string;
  kind: EditorLayerKind;
  role: string | null;
  name: string;
  text: string;
  selector: string;
  classes: string[];
  rect: { x: number; y: number; width: number; height: number };
  visible: boolean;
  display: string;
  position: string;
  editable: {
    text: boolean;
    media: boolean;
    layout: boolean;
    style: boolean;
  };
}

export interface EditorTreeSnapshot {
  url: string;
  capturedAt: number;
  viewport: { width: number; height: number; dpr: number };
  nodes: EditorLayer[];
  rootIds: string[];
  truncated: boolean;
}

export interface EditorContentAttributes {
  ariaLabel: string;
  title: string;
  alt: string;
  placeholder: string;
}

export interface EditorSelection extends PreviewSelection {
  nodeId: string;
  directText: string;
  directTextTruncated: boolean;
  contentAttributes: EditorContentAttributes;
  contentReady: boolean;
}

export type EditorBridgeMessage =
  | { kind: 'tree'; payload: unknown }
  | { kind: 'selection'; payload: unknown }
  | { kind: 'content'; payload: unknown }
  | { kind: 'hover'; payload: unknown }
  | { kind: 'ready'; payload: unknown };

export interface VisualEditorState {
  active: boolean;
  ready: boolean;
  tree: EditorTreeSnapshot | null;
  selection: EditorSelection | null;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
}
