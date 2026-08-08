import { useMemo, useState } from 'react';
import {
  requestFreshReviewFindingRepair,
  waiveFreshReviewFinding,
  type FreshReviewFinding,
  type FreshReviewRecord,
} from '../review/controller';

function severityRank(severity: FreshReviewFinding['severity']): number {
  return severity === 'blocker' ? 0 : severity === 'high' ? 1 : severity === 'medium' ? 2 : 3;
}

function severityLabel(severity: FreshReviewFinding['severity']): string {
  return severity === 'blocker' ? 'Blocker' : severity[0].toUpperCase() + severity.slice(1);
}

function durationLabel(durationMs: number | null): string | null {
  if (durationMs == null) return null;
  if (durationMs < 1000) return `${Math.round(durationMs)} ms`;
  return `${(durationMs / 1000).toFixed(durationMs < 10_000 ? 1 : 0)} s`;
}

export function FreshReviewPanel({
  record,
  running,
  onRun,
  onRecordChange,
}: {
  record: FreshReviewRecord | null;
  running: boolean;
  onRun: () => void;
  onRecordChange: (record: FreshReviewRecord) => void;
}) {
  const [waivingId, setWaivingId] = useState<string | null>(null);
  const [waiverReason, setWaiverReason] = useState('');
  const [busyFindingId, setBusyFindingId] = useState<string | null>(null);
  const findings = useMemo(
    () => [...(record?.findings ?? [])].sort((a, b) => severityRank(a.severity) - severityRank(b.severity)),
    [record?.findings],
  );

  const submitWaiver = async (finding: FreshReviewFinding) => {
    if (!record || busyFindingId) return;
    setBusyFindingId(finding.id);
    try {
      const next = await waiveFreshReviewFinding(record.projectId, finding.id, waiverReason);
      onRecordChange(next);
      setWaivingId(null);
      setWaiverReason('');
    } finally {
      setBusyFindingId(null);
    }
  };

  const requestFix = (finding: FreshReviewFinding) => {
    if (!record || finding.waivedAt || busyFindingId) return;
    setBusyFindingId(finding.id);
    const requested = requestFreshReviewFindingRepair(record, finding.id);
    window.setTimeout(() => setBusyFindingId(null), requested ? 900 : 0);
  };

  return (
    <section className="fresh-review-panel">
      <div className="fresh-review-header">
        <div>
          <strong>Fresh Review</strong>
          <span>Independent, ephemeral, read-only review of this exact saved version.</span>
        </div>
        <button type="button" disabled={running} onClick={onRun}>
          {running ? 'Reviewing…' : record ? 'Run again' : 'Run Fresh Review'}
        </button>
      </div>

      {!record ? (
        <div className="fresh-review-empty">
          Fresh Review has not run for this version. It receives the saved Timeline diff and real evidence, not the implementer conversation.
        </div>
      ) : null}

      {record?.status === 'running' ? (
        <div className="fresh-review-running">
          <span className="review-spinner" />
          Reviewing the saved change in a separate read-only Codex process…
        </div>
      ) : null}

      {record?.status === 'error' ? (
        <div className="fresh-review-error">
          <strong>Review could not complete</strong>
          <span>{record.error || 'Unknown Fresh Review error.'}</span>
        </div>
      ) : null}

      {record && record.status !== 'running' && record.status !== 'error' ? (
        <>
          <div className={`fresh-review-summary ${record.findings.length ? 'issues' : 'clean'}`}>
            <div>
              <strong>{record.findings.length ? `${record.findings.length} finding${record.findings.length === 1 ? '' : 's'}` : 'No material findings'}</strong>
              <span>{record.summary}</span>
            </div>
            <div className="fresh-review-meta">
              {durationLabel(record.durationMs) ? <span>{durationLabel(record.durationMs)}</span> : null}
              {record.patchTruncated ? <span title="Reviewer received a bounded diff and was told it was truncated">Diff bounded</span> : null}
            </div>
          </div>

          {findings.length ? (
            <div className="fresh-review-findings">
              {findings.map((finding) => (
                <article className={`review-finding ${finding.severity} ${finding.waivedAt ? 'waived' : ''}`} key={finding.id}>
                  <div className="review-finding-topline">
                    <span className={`review-severity ${finding.severity}`}>{severityLabel(finding.severity)}</span>
                    <span className="review-category">{finding.category}</span>
                    {finding.path ? <code>{finding.path}{finding.line ? `:${finding.line}` : ''}</code> : null}
                    <span className="review-confidence">{Math.round(finding.confidence * 100)}%</span>
                  </div>
                  <strong className="review-finding-title">{finding.title}</strong>
                  {finding.description ? <p>{finding.description}</p> : null}
                  {finding.evidence ? (
                    <details className="review-finding-evidence">
                      <summary>Reviewer evidence</summary>
                      <div>{finding.evidence}</div>
                    </details>
                  ) : null}
                  {finding.suggestedFix ? <div className="review-suggested"><span>Suggested direction</span>{finding.suggestedFix}</div> : null}

                  {finding.waivedAt ? (
                    <div className="review-waived-note">
                      Waived · {finding.waiverReason || 'No reason recorded'}
                    </div>
                  ) : (
                    <div className="review-finding-actions">
                      <button type="button" disabled={Boolean(busyFindingId)} onClick={() => requestFix(finding)}>
                        {busyFindingId === finding.id ? 'Sending…' : 'Fix with Monument'}
                      </button>
                      {finding.severity !== 'blocker' ? (
                        <button type="button" className="secondary" disabled={Boolean(busyFindingId)} onClick={() => {
                          setWaivingId((current) => current === finding.id ? null : finding.id);
                          setWaiverReason('');
                        }}>
                          Waive…
                        </button>
                      ) : <span className="review-blocker-note">Blockers must be fixed.</span>}
                    </div>
                  )}

                  {waivingId === finding.id && !finding.waivedAt ? (
                    <div className="review-waiver-form">
                      <textarea
                        value={waiverReason}
                        maxLength={600}
                        placeholder="Why is it acceptable to ship with this finding?"
                        onChange={(event) => setWaiverReason(event.target.value)}
                      />
                      <div>
                        <button type="button" className="secondary" onClick={() => { setWaivingId(null); setWaiverReason(''); }}>Cancel</button>
                        <button type="button" disabled={waiverReason.trim().length < 5 || Boolean(busyFindingId)} onClick={() => void submitWaiver(finding)}>
                          Record waiver
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      <div className="fresh-review-footnote">
        Review is one evidence lane. A clean review does not replace build/tests/browser evidence, and stale review never satisfies Ship.
      </div>
    </section>
  );
}
