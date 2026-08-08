import { useState } from 'react';
import { FreshReviewPanel } from './FreshReviewPanel';
import { invokeNative } from '../host/native';
import type { FreshReviewRecord } from '../review/controller';
import type { ShipGateResult } from '../ship/controller';

interface GitShipPlan {
  branch: string;
  remote: string | null;
  changedFiles: string[];
  stagedFiles: string[];
  canCommit: boolean;
  reason: string | null;
}

interface GitShipCommitResult {
  commitSha: string;
  branch: string;
  changedFiles: number;
  remainingFiles: string[];
}

function gateIcon(status: 'pass' | 'block' | 'warn'): string {
  return status === 'pass' ? '✓' : status === 'block' ? '!' : '·';
}

function defaultCommitMessage(review: FreshReviewRecord | null): string {
  const summary = review?.summary.replace(/\s+/g, ' ').trim() ?? '';
  if (!summary) return 'Update product with Monument';
  const sentence = summary.split(/[.!?]\s/)[0]?.trim() || summary;
  return sentence.length <= 72 ? sentence : `${sentence.slice(0, 69)}…`;
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
  const [gitPlan, setGitPlan] = useState<GitShipPlan | null>(null);
  const [gitBusy, setGitBusy] = useState(false);
  const [commitMessage, setCommitMessage] = useState(() => defaultCommitMessage(review));
  const [commitResult, setCommitResult] = useState<GitShipCommitResult | null>(null);
  const [gitError, setGitError] = useState<string | null>(null);

  const prepareCommit = async () => {
    if (!gate.ready || !review?.projectRoot || gitBusy) return;
    setGitBusy(true);
    setGitError(null);
    setCommitResult(null);
    try {
      const plan = await invokeNative<GitShipPlan>('git_ship_plan', { projectPath: review.projectRoot });
      setGitPlan(plan);
      if (!commitMessage.trim()) setCommitMessage(defaultCommitMessage(review));
    } catch (error) {
      setGitError(error instanceof Error ? error.message : String(error));
    } finally {
      setGitBusy(false);
    }
  };

  const commitLocally = async () => {
    if (!gate.ready || !review?.projectRoot || !gitPlan?.canCommit || gitBusy) return;
    setGitBusy(true);
    setGitError(null);
    try {
      const result = await invokeNative<GitShipCommitResult>('git_ship_commit', {
        projectPath: review.projectRoot,
        message: commitMessage,
      });
      setCommitResult(result);
      setGitPlan(null);
    } catch (error) {
      setGitError(error instanceof Error ? error.message : String(error));
      try {
        setGitPlan(await invokeNative<GitShipPlan>('git_ship_plan', { projectPath: review.projectRoot }));
      } catch {
        // Keep the original commit error visible.
      }
    } finally {
      setGitBusy(false);
    }
  };

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
              ? 'This exact saved generation passed the current evidence/review contract. You can now create an explicit local Git commit.'
              : 'Monument will not label this version Ready while a blocking requirement is missing, stale or failing.'}
          </span>
        </div>
        <button type="button" disabled={!gate.ready || gitBusy} onClick={() => void prepareCommit()}>
          {gitBusy ? 'Checking…' : 'Prepare commit'}
        </button>
      </div>

      {gate.ready && gitPlan ? (
        <div className="ship-commit-panel">
          <div className="ship-commit-heading">
            <div>
              <strong>Local commit · {gitPlan.branch || 'detached HEAD'}</strong>
              <span>{gitPlan.changedFiles.length} changed file{gitPlan.changedFiles.length === 1 ? '' : 's'} · push is intentionally separate.</span>
            </div>
            {gitPlan.remote ? <span className="ship-remote" title={gitPlan.remote}>origin</span> : null}
          </div>

          {gitPlan.reason ? <div className="ship-commit-warning">{gitPlan.reason}</div> : null}
          {gitPlan.stagedFiles.length ? (
            <div className="ship-commit-warning">Existing staged files: {gitPlan.stagedFiles.slice(0, 8).join(' · ')}</div>
          ) : null}

          {gitPlan.changedFiles.length ? (
            <details className="ship-file-list">
              <summary>Review files being committed</summary>
              <div>{gitPlan.changedFiles.map((path) => <code key={path}>{path}</code>)}</div>
            </details>
          ) : null}

          <label className="ship-commit-message">
            <span>Commit message</span>
            <input
              value={commitMessage}
              maxLength={180}
              onChange={(event) => setCommitMessage(event.target.value)}
              placeholder="Describe this version"
            />
          </label>

          <div className="ship-commit-actions">
            <button type="button" className="secondary" disabled={gitBusy} onClick={() => setGitPlan(null)}>Cancel</button>
            <button type="button" disabled={!gitPlan.canCommit || commitMessage.trim().length < 3 || gitBusy} onClick={() => void commitLocally()}>
              {gitBusy ? 'Committing…' : 'Commit locally'}
            </button>
          </div>
          <div className="ship-commit-footnote">Monument refuses to mix pre-staged changes into this commit and respects repository commit hooks. Push/PR will require a separate explicit network action.</div>
        </div>
      ) : null}

      {gitError ? <div className="ship-git-error">{gitError}</div> : null}
      {commitResult ? (
        <div className={`ship-commit-success ${commitResult.remainingFiles.length ? 'with-remainder' : ''}`}>
          <strong>{commitResult.remainingFiles.length ? 'Committed, but new changes remain' : 'Committed locally'}</strong>
          <span>{commitResult.commitSha.slice(0, 12)} · {commitResult.branch} · {commitResult.changedFiles} file{commitResult.changedFiles === 1 ? '' : 's'}</span>
          {commitResult.remainingFiles.length ? <small>Commit hooks or concurrent edits left {commitResult.remainingFiles.length} working-tree change{commitResult.remainingFiles.length === 1 ? '' : 's'}: {commitResult.remainingFiles.slice(0, 6).join(' · ')}</small> : <small>Working tree is clean for the shipped files. No push was performed.</small>}
        </div>
      ) : null}
    </aside>
  );
}
