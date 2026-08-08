import { useCallback, useEffect, useMemo, useState } from 'react';
import { isNativeHost, stateGet } from '../host/native';
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
import { applyVisualPropertyEdit, type VisualPropertyChange } from './intent';
import { LayersPanel } from './LayersPanel';
import { locateEditorSource, type EditorSourceOwnership } from './ownership';
import { PropertiesPanel } from './PropertiesPanel';
import type { VisualEditorState } from './types';

export function VisualEditorLayer() {
  const native = isNativeHost();
  const [editor, setEditor] = useState<VisualEditorState>(() => getVisualEditorState());
  const [ownership, setOwnership] = useState<EditorSourceOwnership | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
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

  useEffect(() => {
    const selection = editor.selection;
    setApplyMessage(null);
    setOwnership(null);
    if (!selection || !native) return;
    let disposed = false;
    void (async () => {
      const projectRoot = await stateGet<string>('lastProjectPath').catch(() => null);
      if (!projectRoot || disposed) return;
      const next = await locateEditorSource(projectRoot, selection);
      if (!disposed) setOwnership(next);
    })();
    return () => { disposed = true; };
  }, [editor.selection?.nodeId, native]);

  const toggle = useCallback(async () => {
    if (!editor.ready && !editor.active) return;
    await setVisualEditorActive(!editor.active).catch(() => undefined);
  }, [editor.active, editor.ready]);

  const close = useCallback(() => {
    void setVisualEditorActive(false).catch(() => undefined);
  }, []);

  const applyProperties = useCallback(async (changes: VisualPropertyChange[]): Promise<boolean> => {
    if (!editor.selection || applying) return false;
    setApplying(true);
    setApplyMessage(null);
    try {
      const result = await applyVisualPropertyEdit(editor.selection, changes);
      if (result.mode === 'direct') {
        setApplyMessage(`Applied directly · ${result.appliedCount} source change${result.appliedCount === 1 ? '' : 's'} · ${result.sourcePath}`);
      } else {
        setApplyMessage(result.paused
          ? `Codex fallback queued · ${result.queuedCount} pending · queue is paused`
          : result.queuedCount > 1
            ? `Codex fallback queued · ${result.queuedCount} pending`
            : 'Codex fallback queued for source update');
      }
      return true;
    } catch (error) {
      setApplyMessage(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setApplying(false);
    }
  }, [applying, editor.selection]);

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
          <PropertiesPanel
            selection={editor.selection}
            layer={selectedLayer}
            ownership={ownership}
            applying={applying}
            applyMessage={applyMessage}
            onApply={applyProperties}
          />
        </>
      ) : null}
    </div>
  );
}
