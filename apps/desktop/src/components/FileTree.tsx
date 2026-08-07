import type { FileNode } from '../types';

export function FileTree({ nodes, depth = 0 }: { nodes: FileNode[]; depth?: number }) {
  return (
    <div className="file-tree">
      {nodes.map((node) => (
        <div key={node.path}>
          <div className="file-row" style={{ paddingLeft: 10 + depth * 14 }} title={node.path}>
            <span className="file-symbol">{node.kind === 'directory' ? '⌄' : '·'}</span>
            <span className="file-name">{node.name}</span>
          </div>
          {node.kind === 'directory' && node.children?.length ? <FileTree nodes={node.children} depth={depth + 1} /> : null}
        </div>
      ))}
    </div>
  );
}
