import { useEffect, useState } from 'react';
import {
  subscribeTimelineQuality,
  timelineQualityForTurn,
  type TimelineBrowserStatus,
  type TimelineDeterministicStatus,
  type TimelineQualityMap,
} from '../timeline/quality';
import type { TimelineCheckpoint, TimelineDiff, TimelineState } from '../timeline/types';

function timeLabel(timestamp: number): string {
  if (!timestamp) return '';
  try {
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
  } catch {
    return '';
  }
}

function versionLabel(checkpoint: TimelineCheckpoint, visibleNumber: number | null): string {
  if (checkpoint.kind === 'baseline') return 'Original';
  if (checkpoint.kind === 'restore-safety') return 'Safety';
  if (checkpoint.kind === 'external') return 'External';
  return visibleNumber == null ? 'Version' : `V${visibleNumber}`;
}

function checkpointKindLabel(checkpoint: TimelineCheckpoint): string | null {
  switch (checkpoint.kind) {
    case 'visual': return 'Direct visual edit';
    case 'manual': return 'Saved';
    case 'restore-safety': return 'Before restore';
    case 'external': return 'External changes';
    default: return null;
  }
}

function deterministicBadge(status: TimelineDeterministicStatus): { label: string; tone: string } | null {
  switch (status) {
    case 'passed': return { label: 'Checks ✓', tone: 'good' };
    case 'failed': return { label: 'Checks failed', tone: 'bad' };
    case 'error': return { label: 'Check error', tone: 'bad' };
    case 'permission-required': return { label: 'Checks off', tone: 'muted' };
    case 'no-checks': return { label: 'No checks', tone: 'muted' };
    default: return null;
  }
}

function browserBadge(status: TimelineBrowserStatus): { label: string; tone: string } | null {
  switch (status) {
    case 'clean': return { label: 'Browser ✓', tone: 'good' };
    case 'issues': return { label: 'Browser issues', tone: 'bad' };
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
  const projectId = checkpoints[0]?.projectId ?? null;
  const [quality, setQuality] = useState<TimelineQualityMap>({});

  useEffect(() => {
    setQuality({});
    if (!projectId) return;
    return subscribeTimelineQuality(projectId, setQuality);
  }, [projectId]);

  const byId = new Map(checkpoints.map((checkpoint) => [checkpoint.id, checkpoint]));
  const childCounts = new Map<string, number>();
  const visibleNumberById = new Map<string, number>();
  let visibleNumber = 0;
  for (const checkpoint of checkpoints) {
    if (checkpoint.kind === 'prompt' || checkpoint.kind === 'visual' || checkpoint.kind === 'manual') {
      visibleNumber += 1;
      visibleNumberById.set(checkpoint.id, visibleNumber);
    }
    if (!checkpoint.parentId) continue;
    childCounts.set(checkpoint.parentId, (childCounts.get(checkpoint.parentId) ?? 0) + 1);
  }
  const current = checkpoints.find((checkpoint) => checkpoint.id === state?.currentCheckpointId) ?? null;
  const currentLineage = new Set<string>();
  let cursor = current;
  while (cursor && !currentLineage.has(cursor.id)) {
    currentLineage.add(cursor.id);
    cursor = cursor.parentId ? byId.get(cursor.parentId) ?? null : null;
  }

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
          const alternative = !currentLineage.has(checkpoint.id) && checkpoint.pathId !== state?.activePathId;
          const forked = (childCounts.get(checkpoint.id) ?? 0) > 1;
          const checkpointQuality = timelineQualityForTurn(quality, checkpoint.turnSerial);
          const deterministic = checkpointQuality ? deterministicBadge(checkpointQuality.deterministic) : null;
          const browser = checkpointQuality ? browserBadge(checkpointQuality.browser) : null;
          const unverified = (checkpoint.kind === 'prompt' || checkpoint.kind === 'visual') && checkpoint.turnSerial != null && !checkpointQuality;
          return (
            <article className={`timeline-card ${isCurrent ? 'current' : ''} ${alternative ? 'alternative' : ''}`} key={checkpoint.id}>
              <div className="timeline-card-top">
                <span className="timeline-version">{versionLabel(checkpoint, visibleNumberById.get(checkpoint.id) ?? null)}</span>
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
              {(deterministic || browser || unverified) ? (
                <div className="timeline-quality-row">
                  {deterministic ? <span className={`timeline-quality ${deterministic.tone}`}>{deterministic.label}</span> : null}
                  {browser ? <span className={`timeline-quality ${browser.tone}`}>{browser.label}</span> : null}
                  {unverified ? <span className="timeline-quality muted">Not checked</span> : null}
                </div>
              ) : null}
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
