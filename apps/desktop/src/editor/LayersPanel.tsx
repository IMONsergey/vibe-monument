import { useEffect, useMemo, useRef, useState } from 'react';
import type { EditorLayer, EditorTreeSnapshot } from './types';

function layerLabel(layer: EditorLayer): string {
  const content = layer.name || layer.text;
  return content ? content.slice(0, 64) : layer.tag;
}

function icon(layer: EditorLayer): string {
  if (layer.kind === 'text') return 'T';
  if (layer.kind === 'media') return '▧';
  if (layer.kind === 'control') return '◇';
  if (layer.kind === 'container') return '□';
  return '·';
}

export function LayersPanel({
  tree,
  selectedNodeId,
  onSelect,
  onHover,
  onRefresh,
  onClose,
}: {
  tree: EditorTreeSnapshot | null;
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
  onHover: (nodeId: string | null) => void;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  const nodes = tree?.nodes ?? [];
  const childCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of nodes) if (node.parentId) counts.set(node.parentId, (counts.get(node.parentId) ?? 0) + 1);
    return counts;
  }, [nodes]);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleNodes = useMemo(() => {
    if (normalizedQuery) {
      return nodes.filter((node) => [node.name, node.text, node.tag, node.role ?? '', node.classes.join(' ')]
        .some((value) => value.toLowerCase().includes(normalizedQuery)));
    }
    const hiddenByAncestor = new Set<string>();
    const result: EditorLayer[] = [];
    for (const node of nodes) {
      if (node.parentId && hiddenByAncestor.has(node.parentId)) {
        hiddenByAncestor.add(node.id);
        continue;
      }
      result.push(node);
      if (collapsed.has(node.id)) hiddenByAncestor.add(node.id);
    }
    return result;
  }, [collapsed, nodes, normalizedQuery]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedNodeId]);

  const toggleCollapsed = (nodeId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  return (
    <aside className="visual-layers-panel" aria-label="Layers">
      <div className="visual-panel-header">
        <div><strong>Layers</strong><span>{nodes.length ? `${nodes.length} live layers` : 'Live DOM'}</span></div>
        <div className="visual-panel-actions">
          <button type="button" onClick={onRefresh} title="Refresh Layers">↻</button>
          <button type="button" onClick={onClose} title="Close visual editor">×</button>
        </div>
      </div>
      <div className="layers-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search layers…" /></div>
      {tree?.truncated ? <div className="layers-warning">Layer projection is bounded to the first 600 meaningful elements.</div> : null}
      <div className="layers-tree" onMouseLeave={() => onHover(null)}>
        {!tree ? <div className="visual-empty">Waiting for the live product…</div> : null}
        {tree && !visibleNodes.length ? <div className="visual-empty">No matching layers.</div> : null}
        {visibleNodes.map((layer) => {
          const hasChildren = (childCount.get(layer.id) ?? 0) > 0;
          const selected = layer.id === selectedNodeId;
          return (
            <div className={`layer-row ${selected ? 'selected' : ''}`} key={layer.id} style={{ '--layer-depth': Math.min(layer.depth, 14) } as React.CSSProperties}>
              <button
                type="button"
                className="layer-disclosure"
                disabled={!hasChildren || Boolean(normalizedQuery)}
                onClick={(event) => { event.stopPropagation(); toggleCollapsed(layer.id); }}
                aria-label={collapsed.has(layer.id) ? 'Expand layer' : 'Collapse layer'}
              >{hasChildren ? (collapsed.has(layer.id) ? '›' : '⌄') : ''}</button>
              <button
                ref={selected ? selectedRef : undefined}
                type="button"
                className="layer-main"
                onMouseEnter={() => onHover(layer.id)}
                onFocus={() => onHover(layer.id)}
                onClick={() => onSelect(layer.id)}
                title={layer.selector}
              >
                <span className={`layer-icon ${layer.kind}`}>{icon(layer)}</span>
                <span className="layer-copy"><strong>{layerLabel(layer)}</strong><small>{layer.tag}{layer.display ? ` · ${layer.display}` : ''}</small></span>
                {layer.editable.text ? <span className="layer-editable-dot" title="Text-editable" /> : null}
              </button>
            </div>
          );
        })}
      </div>
      <div className="layers-footnote">Runtime projection · source remains authoritative</div>
    </aside>
  );
}
