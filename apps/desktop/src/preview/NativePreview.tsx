import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { invokeNative, isNativeHost, listenNative } from '../host/native';
import { setPreviewSelection, subscribePreviewSelection, selectionLabel, type PreviewSelection } from './selection';

type Viewport = 'desktop' | 'mobile';
type PreviewBounds = { x: number; y: number; width: number; height: number };

function boundsOf(element: HTMLElement): PreviewBounds | null {
  const rect = element.getBoundingClientRect();
  if (rect.width < 120 || rect.height < 120) return null;
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

export function NativePreview({ url, viewport, onError }: { url: string; viewport: Viewport; onError: (message: string) => void }) {
  const native = isNativeHost();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const openedRef = useRef(false);
  const [inspect, setInspectState] = useState(false);
  const [selection, setSelection] = useState<PreviewSelection | null>(null);

  useEffect(() => subscribePreviewSelection(setSelection), []);

  const syncBounds = useCallback(() => {
    const element = mountRef.current;
    if (!element || !native || !openedRef.current) return;
    const bounds = boundsOf(element);
    if (!bounds) return;
    void invokeNative<void>('preview_set_bounds', { bounds }).catch((error) => onError(String(error instanceof Error ? error.message : error)));
  }, [native, onError]);

  useLayoutEffect(() => {
    if (!native) return;
    const element = mountRef.current;
    if (!element) return;
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let frame = 0;
    const disposers: Array<() => void> = [];

    const open = async () => {
      await new Promise<void>((resolve) => { frame = requestAnimationFrame(() => resolve()); });
      if (disposed) return;
      const bounds = boundsOf(element);
      if (!bounds) return;
      try {
        await invokeNative<void>('preview_open', { url, bounds });
        if (disposed) {
          await invokeNative<void>('preview_close').catch(() => undefined);
          return;
        }
        openedRef.current = true;
        resizeObserver = new ResizeObserver(() => syncBounds());
        resizeObserver.observe(element);
        window.addEventListener('resize', syncBounds);
        disposers.push(await listenNative<PreviewSelection>('monument://preview-selection', (next) => {
          setPreviewSelection(next);
          setInspectState(false);
          void invokeNative<void>('preview_set_inspect', { enabled: false }).catch(() => undefined);
        }));
        disposers.push(await listenNative<string>('monument://preview-error', onError));
      } catch (error) {
        onError(String(error instanceof Error ? error.message : error));
      }
    };

    void open();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', syncBounds);
      for (const dispose of disposers) dispose();
      openedRef.current = false;
      void invokeNative<void>('preview_close').catch(() => undefined);
    };
  }, [native, onError, syncBounds, url]);

  useEffect(() => { syncBounds(); }, [syncBounds, viewport]);

  const toggleInspect = useCallback(async () => {
    const next = !inspect;
    try {
      await invokeNative<void>('preview_set_inspect', { enabled: next });
      setInspectState(next);
      if (next) setPreviewSelection(null);
    } catch (error) {
      onError(String(error instanceof Error ? error.message : error));
    }
  }, [inspect, onError]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'i' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, [contenteditable="true"]')) return;
      event.preventDefault();
      void toggleInspect();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleInspect]);

  if (!native) return <iframe src={url} title="Project preview" allow="clipboard-read; clipboard-write" />;

  return (
    <div className="native-preview-wrap">
      <div className="preview-local-toolbar">
        <button type="button" className={inspect ? 'active' : ''} onClick={() => void toggleInspect()}>{inspect ? 'Selecting…' : 'Select'} <kbd>I</kbd></button>
        {selection ? (
          <div className="selected-element-chip" title={selection.selector}>
            <span>Selected</span><strong>{selectionLabel(selection)}</strong>
            <button type="button" aria-label="Clear selected element" onClick={() => setPreviewSelection(null)}>×</button>
          </div>
        ) : <span className="preview-helper">Click an element, then describe what should change.</span>}
      </div>
      <div ref={mountRef} className={`native-preview-host ${viewport}`} />
    </div>
  );
}
