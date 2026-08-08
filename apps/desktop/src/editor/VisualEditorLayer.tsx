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
import { queueVisualPropertyEdit, type VisualPropertyChange } from './intent';
import { LayersPanel } from './LayersPanel';
import { locateEditorSource, type EditorSourceOwnership } from './ownership';
import { PropertiesPanel } from './PropertiesPanel';
import {
  commitVisualSourceEdit,
  planVisualSourceEdit,
  type PreparedVisualSourceEdit,
} from './sourceTransaction';
import {
  commitVisualTokenEdit,
  planVisualTokenEdit,
  type PreparedVisualTokenEdit,
  type VisualTokenScope,
} from './tokenTransaction';
import type { VisualEditorState } from './types';

function queuedMessage(result: { paused: boolean; queuedCount: number }, reason?: string): string {
  const prefix = reason ? `Codex fallback · ${reason} · ` : '';
  if (result.paused) return `${prefix}queued · ${result.queuedCount} pending · queue is paused`;
  if (result.queuedCount > 1) return `${prefix}queued · ${result.queuedCount} pending`;
  return `${prefix}queued for source update`;
}

export function VisualEditorLayer() {
  const native = isNativeHost();
  const [editor, setEditor] = useState<VisualEditorState>(() => getVisualEditorState());
  const [ownership, setOwnership] = useState<EditorSourceOwnership | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [preparedSourceEdit, setPreparedSourceEdit] = useState<PreparedVisualSourceEdit | null>(null);
  const [preparedTokenEdit, setPreparedTokenEdit] = useState<PreparedVisualTokenEdit | null>(null);
  const [tokenScope, setTokenScope] = useState<VisualTokenScope>('element');
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
    setPreparedSourceEdit(null);
    setPreparedTokenEdit(null);
    setTokenScope('element');
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

  const dismissPrepared = useCallback(() => {
    setPreparedSourceEdit(null);
    setPreparedTokenEdit(null);
    setTokenScope('element');
  }, []);

  const queueWithCodex = useCallback(async (
    changes: VisualPropertyChange[],
    reason?: string,
  ): Promise<boolean> => {
    if (!editor.selection) return false;
    const result = await queueVisualPropertyEdit(editor.selection, changes);
    dismissPrepared();
    setApplyMessage(queuedMessage(result, reason));
    return true;
  }, [dismissPrepared, editor.selection]);

  const applyProperties = useCallback(async (changes: VisualPropertyChange[]): Promise<boolean> => {
    if (!editor.selection || applying) return false;
    setApplying(true);
    setApplyMessage(null);
    dismissPrepared();
    try {
      const literalDecision = await planVisualSourceEdit(editor.selection, changes);
      if (literalDecision.kind === 'deterministic') {
        setPreparedSourceEdit(literalDecision.prepared);
        setApplyMessage(`Direct source edit ready · ${literalDecision.prepared.plan.sourcePath}:${literalDecision.prepared.plan.line}`);
        return false;
      }

      const tokenDecision = await planVisualTokenEdit(editor.selection, changes);
      if (tokenDecision.kind === 'scope-choice') {
        setPreparedTokenEdit(tokenDecision.prepared);
        setTokenScope('element');
        setApplyMessage(`Design token ${tokenDecision.prepared.tokenName} · choose source scope`);
        return false;
      }

      const reason = tokenDecision.reason.includes('not ready') ? literalDecision.reason : tokenDecision.reason;
      return await queueWithCodex(changes, reason);
    } catch (error) {
      setApplyMessage(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setApplying(false);
    }
  }, [applying, dismissPrepared, editor.selection, queueWithCodex]);

  const confirmSourceEdit = useCallback(async (): Promise<boolean> => {
    if (!preparedSourceEdit || applying) return false;
    setApplying(true);
    setApplyMessage(null);
    try {
      const result = await commitVisualSourceEdit(preparedSourceEdit);
      dismissPrepared();
      setApplyMessage(`Applied directly · ${result.sourcePath}:${result.line} · saved to Versions`);
      window.setTimeout(() => { void requestEditorTree().catch(() => undefined); }, 220);
      return true;
    } catch (error) {
      dismissPrepared();
      setApplyMessage(`Direct edit needs attention · ${error instanceof Error ? error.message : String(error)}`);
      window.setTimeout(() => { void requestEditorTree().catch(() => undefined); }, 220);
      return false;
    } finally {
      setApplying(false);
    }
  }, [applying, dismissPrepared, preparedSourceEdit]);

  const confirmTokenEdit = useCallback(async (): Promise<boolean> => {
    if (!preparedTokenEdit || applying) return false;
    setApplying(true);
    setApplyMessage(null);
    try {
      const result = await commitVisualTokenEdit(preparedTokenEdit, tokenScope);
      dismissPrepared();
      setApplyMessage(`Applied ${result.scope === 'token' ? `global ${result.tokenName}` : 'to this element'} · ${result.sourcePath}:${result.line} · saved to Versions`);
      window.setTimeout(() => { void requestEditorTree().catch(() => undefined); }, 220);
      return true;
    } catch (error) {
      dismissPrepared();
      setApplyMessage(`Token edit needs attention · ${error instanceof Error ? error.message : String(error)}`);
      window.setTimeout(() => { void requestEditorTree().catch(() => undefined); }, 220);
      return false;
    } finally {
      setApplying(false);
    }
  }, [applying, dismissPrepared, preparedTokenEdit, tokenScope]);

  const useCodexForPrepared = useCallback(async (): Promise<boolean> => {
    const change = preparedSourceEdit?.change ?? preparedTokenEdit?.change ?? null;
    if (!change || applying) return false;
    setApplying(true);
    setApplyMessage(null);
    try {
      return await queueWithCodex([change], preparedTokenEdit ? 'design-token scope left to Codex' : 'direct edit was not chosen');
    } catch (error) {
      setApplyMessage(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setApplying(false);
    }
  }, [applying, preparedSourceEdit, preparedTokenEdit, queueWithCodex]);

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
            sourcePreview={preparedSourceEdit}
            tokenPreview={preparedTokenEdit}
            tokenScope={tokenScope}
            onTokenScope={setTokenScope}
            onApply={applyProperties}
            onConfirmSource={confirmSourceEdit}
            onConfirmToken={confirmTokenEdit}
            onUseCodex={useCodexForPrepared}
            onDismissPrepared={dismissPrepared}
          />
        </>
      ) : null}
    </div>
  );
}
