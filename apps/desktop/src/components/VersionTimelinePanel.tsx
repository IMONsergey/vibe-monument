import type { TimelineCheckpoint, TimelineDiff, TimelineState } from '../timeline/types';

function timeLabel(timestamp: number): string {
  if (!timestamp) return '';
  try {
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
  } catch {
    return '';
  }
}

function versionLabel(checkpoint: TimelineCheckpoint): string {
  if (checkpoint.kind === 'baseline') return 'Original';
  if (checkpoint.kind === 'restore-safety') return 'Safety';
  if (checkpoint.kind === 'external') return 'External';
  return `V${checkpoint.sequence}`;
}

function checkpointKindLabel(checkpoint: TimelineCheckpoint): string | null {
  switch (checkpoint.kind) {
    case 'manual': return 'Saved';
    case 'restore-safety': return 'Before restore';
    case 'external': return 'External changes';
    default: return null;
  }
}

export function VersionTimelinePanel({
  state,
  busy,
  diff,
  onClose,
  onBack,
  onForward,
  onSave,
  onRestore,
  onCompare,
}: {
  state: TimelineState | null;
  busy: boolean;
  diff: TimelineDiff | null;
  onClose: () => void;
  onBack: () => void;
  onForward: () => void;
  onSave: () => void;
  onRestore: (checkpointId: string) => void;
  onCompare: (checkpointId: string) => void;
}) {
  const checkpoints = state?.checkpoints ?? [];
  const childCounts = new Map<string, number>();
  for (const checkpoint of checkpoints) {
    if (!checkpoint.parentId) continue;
    childCounts.set(checkpoint.parentId, (childCounts.get(checkpoint.parentId) ?? 0) + 1);
  }
  const current = checkpoints.find((checkpoint) => checkpoint.id === state?.currentCheckpointId) ?? null;

  return (
    <aside className="timeline-panel">
      <div className="timeline-header">
        <div>
          <strong>Versions</strong>
          <span>{checkpoints.length ? `${checkpoints.length} checkpoints` : 'Preparing history…'}</span>
        </div>
        <button type="button" className="timeline-close" onClick={onClose}>×</button>
      </div>

      <div className="timeline-toolbar">
        <button type="button" disabled={busy || !state?.canBack} onClick={onBack} title="Previous version">←</button>
        <button type="button" disabled={busy || !state?.forwardCheckpointId} onClick={onForward} title="Next version">→</button>
        <button type="button" className="timeline-save" disabled={busy || !state} onClick={onSave}>Save version</button>
      </div>

      {state?.dirty ? (
        <div className="timeline-dirty-note">
          Current files differ from this checkpoint. Monument will save them automatically before any restore.
        </div>
      ) : null}

      <div className="timeline-list">
        {[...checkpoints].reverse().map((checkpoint) => {
          const isCurrent = checkpoint.id === state?.currentCheckpointId;
          const alternative = checkpoint.pathId !== state?.activePathId;
          const forked = (childCounts.get(checkpoint.id) ?? 0) > 1;
          return (
            <article className={`timeline-card ${isCurrent ? 'current' : ''} ${alternative ? 'alternative' : ''}`} key={checkpoint.id}>
              <div className="timeline-card-top">
                <span className="timeline-version">{versionLabel(checkpoint)}</span>
                <span className="timeline-time">{timeLabel(checkpoint.createdAt)}</span>
                {isCurrent ? <span className="timeline-badge current">Current</span> : null}
                {alternative ? <span className="timeline-badge">Alternative</span> : null}
                {forked ? <span className="timeline-badge">Fork</span> : null}
              </div>
              <strong className="timeline-title">{checkpoint.title}</strong>
              {checkpoint.promptExcerpt && checkpoint.promptExcerpt !== checkpoint.title ? (
                <p>{checkpoint.promptExcerpt}</p>
              ) : null}
              {checkpointKindLabel(checkpoint) ? <small>{checkpointKindLabel(checkpoint)}</small> : null}
              <div className="timeline-card-actions">
                {!isCurrent ? <button type="button" disabled={busy} onClick={() => onRestore(checkpoint.id)}>Restore</button> : null}
                {current && current.id !== checkpoint.id ? (
                  <button type="button" disabled={busy} onClick={() => onCompare(checkpoint.id)}>Compare</button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {diff ? (
        <div className="timeline-diff">
          <div className="timeline-diff-heading">
            <strong>Compared with current</strong>
            <span>{diff.files.length} changed files</span>
          </div>
          {diff.files.length ? (
            <div className="timeline-diff-files">
              {diff.files.slice(0, 40).map((file, index) => (
                <div key={`${file.status}-${file.path}-${index}`}><span>{file.status}</span><code>{file.path}</code></div>
              ))}
              {diff.files.length > 40 ? <small>+ {diff.files.length - 40} more</small> : null}
            </div>
          ) : <div className="timeline-no-diff">Same source tree.</div>}
        </div>
      ) : null}

      <div className="timeline-footnote">
        Going back never deletes later versions. If you make a new change from an older checkpoint, Monument creates an alternative history path.
      </div>
    </aside>
  );
}
