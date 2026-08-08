import { FreshReviewPanel } from './FreshReviewPanel';
import type { FreshReviewRecord } from '../review/controller';
import type { ShipGateResult } from '../ship/controller';

function gateIcon(status: 'pass' | 'block' | 'warn'): string {
  return status === 'pass' ? '✓' : status === 'block' ? '!' : '·';
}

export function ShipPanel({
  gate,
  review,
  reviewRunning,
  onClose,
  onRunChecks,
  onCaptureBrowser,
  onRunReview,
  onOpenQueue,
  onReviewChange,
}: {
  gate: ShipGateResult;
  review: FreshReviewRecord | null;
  reviewRunning: boolean;
  onClose: () => void;
  onRunChecks: () => void;
  onCaptureBrowser: () => void;
  onRunReview: () => void;
  onOpenQueue: () => void;
  onReviewChange: (record: FreshReviewRecord) => void;
}) {
  return (
    <aside className="ship-panel" aria-label="Ship readiness">
      <div className="ship-panel-header">
        <div>
          <strong>{gate.ready ? 'Ready to ship' : 'Ship gate'}</strong>
          <span>
            {gate.ready
              ? gate.warningCount ? `All blocking gates passed · ${gate.warningCount} warning${gate.warningCount === 1 ? '' : 's'}` : 'All required gates passed for this saved version.'
              : `${gate.blockingCount} blocking gate${gate.blockingCount === 1 ? '' : 's'} remain.`}
          </span>
        </div>
        <button type="button" onClick={onClose}>×</button>
      </div>

      <div className="ship-gate-list">
        {gate.items.map((entry) => (
          <div className={`ship-gate-item ${entry.status}`} key={entry.id}>
            <span className="ship-gate-icon">{gateIcon(entry.status)}</span>
            <div>
              <strong>{entry.label}</strong>
              <span>{entry.detail}</span>
            </div>
            {entry.status === 'block' && entry.action === 'checks' ? <button type="button" onClick={onRunChecks}>Run</button> : null}
            {entry.status === 'block' && entry.action === 'browser' ? <button type="button" onClick={onCaptureBrowser}>Capture</button> : null}
            {entry.status === 'block' && entry.action === 'review' ? <button type="button" onClick={onRunReview}>Review</button> : null}
            {entry.status === 'block' && entry.action === 'queue' ? <button type="button" onClick={onOpenQueue}>Queue</button> : null}
          </div>
        ))}
      </div>

      <FreshReviewPanel
        record={review}
        running={reviewRunning}
        onRun={onRunReview}
        onRecordChange={onReviewChange}
      />

      <div className={`ship-final ${gate.ready ? 'ready' : 'blocked'}`}>
        <div>
          <strong>{gate.ready ? 'Engineering gate passed' : 'Not ready yet'}</strong>
          <span>
            {gate.ready
              ? 'This exact saved generation has passed the current Monument evidence/review contract. Git commit/push handoff is the next action in this gate.'
              : 'Monument will not label this version Ready while a blocking requirement is missing, stale or failing.'}
          </span>
        </div>
        <button type="button" disabled={!gate.ready} title={gate.ready ? 'Git handoff is being wired in this gate' : 'Resolve blocking gates first'}>
          {gate.ready ? 'Ready' : 'Blocked'}
        </button>
      </div>
    </aside>
  );
}
