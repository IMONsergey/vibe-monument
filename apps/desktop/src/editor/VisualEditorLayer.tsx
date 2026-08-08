import { useCallback, useEffect, useMemo, useState } from 'react';
import { isNativeHost } from '../host/native';
import { subscribePreviewSelection } from '../preview/selection';
import {
  getVisualEditorState,
  hoverEditorNode,
  requestEditorTree,
  selectEditorNode,
  setVisualEditorActive,
  startVisualEditorBridge,
  subscribeVisualEditor,
  syncEditorSelectionFromPreview,
} from './controller';
import { LayersPanel } from './LayersPanel';
import { PropertiesPanel } from './PropertiesPanel';
import type { VisualEditorState } from './types';

export function VisualEditorLayer() {
  const native = isNativeHost();
  const [editor, setEditor] = useState<VisualEditorState>(() => getVisualEditorState());
  const selectedLayer = useMemo(
    () => editor.tree?.nodes.find((node) => node.id === editor.selectedNodeId) ?? null,
    [editor.selectedNodeId, editor.tree],
  );

  useEffect(() => subscribeVisualEditor(setEditor), []);
  useEffect(() => subscribePreviewSelection(syncEditorSelectionFromPreview), []);

  useEffect(() => {
    if (!native) return;
    let disposed = false;
    let stop: (() => void) | null = null;
    void startVisualEditorBridge().then((unlisten) => {
      if (disposed) unlisten();
      else stop = unlisten;
    });
    return () => {
      disposed = true;
      stop?.();
      document.documentElement.classList.remove('visual-editor-active');
      if (getVisualEditorState().active) void setVisualEditorActive(false).catch(() => undefined);
    };
  }, [native]);

  useEffect(() => {
    document.documentElement.classList.toggle('visual-editor-active', editor.active);
    return () => document.documentElement.classList.remove('visual-editor-active');
  }, [editor.active]);

  const toggle = useCallback(async () => {
    if (!editor.ready && !editor.active) return;
    await setVisualEditorActive(!editor.active).catch(() => undefined);
  }, [editor.active, editor.ready]);

  const close = useCallback(() => {
    void setVisualEditorActive(false).catch(() => undefined);
  }, []);

  if (!native) return null;

  return (
    <div className={`visual-editor-layer ${editor.active ? 'active' : ''}`}>
      {!editor.active && editor.ready ? (
        <button type="button" className="visual-editor-launcher" onClick={() => void toggle()} title="Open visual editor">
          <span>✦</span> Edit
        </button>
      ) : null}

      {editor.active ? (
        <>
          <LayersPanel
            tree={editor.tree}
            selectedNodeId={editor.selectedNodeId}
            onSelect={(nodeId) => void selectEditorNode(nodeId)}
            onHover={(nodeId) => void hoverEditorNode(nodeId)}
            onRefresh={() => void requestEditorTree()}
            onClose={close}
          />
          <PropertiesPanel selection={editor.selection} layer={selectedLayer} />
        </>
      ) : null}
    </div>
  );
}
