import { useEffect, useState } from 'react';
import type { BrowserEvidenceRecord } from '../browser/evidence';
import { requestBrowserRepair } from '../repair/controller';

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function viewportLabel(record: BrowserEvidenceRecord): string {
  const viewport = record.snapshot.page.viewport;
  if (!viewport?.width || !viewport?.height) return 'Current viewport';
  return `${Math.round(viewport.width)}×${Math.round(viewport.height)}`;
}

export function BrowserEvidencePanel({
  record,
  running,
  previewAvailable,
  onCapture,
}: {
  record: BrowserEvidenceRecord | null;
  running: boolean;
  previewAvailable: boolean;
  onCapture: () => void;
}) {
  const snapshot = record?.snapshot ?? null;
  const failedRequests = snapshot?.network.filter((event) => event.failed) ?? [];
  const slowRequests = snapshot?.network.filter((event) => !event.failed) ?? [];
  const consoleErrors = snapshot?.console.filter((event) => event.level === 'error') ?? [];
  const consoleWarnings = snapshot?.console.filter((event) => event.level === 'warn') ?? [];
  const hasRepairableIssues = Boolean(record && !record.stale && ((snapshot?.runtime.length ?? 0) > 0 || consoleErrors.length > 0 || failedRequests.length > 0));
  const [repairRequested, setRepairRequested] = useState(false);

  useEffect(() => setRepairRequested(false), [record?.snapshot.requestId]);

  const fixBrowserIssues = async () => {
    if (!record || !hasRepairableIssues || repairRequested) return;
    if (await requestBrowserRepair(record)) setRepairRequested(true);
  };

  return (
    <section className={`browser-evidence ${record?.stale ? 'stale' : ''}`}>
      <div className="browser-evidence-header">
        <div>
          <strong>Browser evidence</strong>
          <span>{record?.stale ? 'Previous capture is stale after newer work.' : 'Observed from the real live preview.'}</span>
        </div>
        <div className="browser-evidence-actions">
          {hasRepairableIssues ? (
            <button type="button" className="fix-evidence-button" disabled={running || repairRequested} onClick={() => void fixBrowserIssues()}>
              {repairRequested ? 'Repair requested' : 'Fix with Monument'}
            </button>
          ) : null}
          <button type="button" disabled={!previewAvailable || running} onClick={onCapture}>
            {running ? 'Capturing…' : 'Capture now'}
          </button>
        </div>
      </div>

      {!previewAvailable ? <div className="browser-evidence-empty">Start the live preview to collect runtime/browser evidence.</div> : null}
      {previewAvailable && !record ? <div className="browser-evidence-empty">No browser evidence captured yet.</div> : null}

      {record ? (
        <>
          <div className="browser-evidence-summary">
            <div><span>Viewport</span><strong>{viewportLabel(record)}</strong></div>
            <div><span>Runtime</span><strong>{countLabel(snapshot?.runtime.length ?? 0, 'error', 'errors')}</strong></div>
            <div><span>Console</span><strong>{(consoleErrors.length + consoleWarnings.length)} signals</strong></div>
            <div><span>Network</span><strong>{failedRequests.length ? `${failedRequests.length} failed` : `${slowRequests.length} slow`}</strong></div>
          </div>

          {record.stale ? <div className="browser-evidence-stale">This capture belongs to an older code state. Capture again before treating it as current evidence.</div> : null}

          {snapshot?.runtime.length ? (
            <details className="browser-evidence-group" open={!record.stale}>
              <summary><strong>Runtime errors</strong><span>{snapshot.runtime.length}</span></summary>
              <div className="browser-evidence-events">
                {snapshot.runtime.map((event, index) => (
                  <div className="browser-event error" key={`${event.at}-${index}`}>
                    <strong>{event.kind}</strong><span>{event.message}</span>
                    {event.source ? <code>{event.source}{event.line ? `:${event.line}` : ''}</code> : null}
                  </div>
                ))}
              </div>
            </details>
          ) : null}

          {(consoleErrors.length || consoleWarnings.length) ? (
            <details className="browser-evidence-group">
              <summary><strong>Console</strong><span>{consoleErrors.length + consoleWarnings.length}</span></summary>
              <div className="browser-evidence-events">
                {[...consoleErrors, ...consoleWarnings].map((event, index) => (
                  <div className={`browser-event ${event.level}`} key={`${event.at}-${index}`}>
                    <strong>{event.level}</strong><span>{event.message}</span>
                  </div>
                ))}
              </div>
            </details>
          ) : null}

          {snapshot?.network.length ? (
            <details className="browser-evidence-group">
              <summary><strong>Network</strong><span>{snapshot.network.length}</span></summary>
              <div className="browser-evidence-events">
                {snapshot.network.map((event, index) => (
                  <div className={`browser-event ${event.failed ? 'error' : 'slow'}`} key={`${event.at}-${index}`}>
                    <div className="browser-network-line"><strong>{event.method}</strong><code>{event.url}</code></div>
                    <span>{event.failed ? `Failed${event.status ? ` · ${event.status}` : ''}` : 'Slow request'} · {event.durationMs} ms</span>
                    {event.error ? <small>{event.error}</small> : null}
                  </div>
                ))}
              </div>
            </details>
          ) : null}

          {!record.stale && !snapshot?.runtime.length && !snapshot?.console.length && !snapshot?.network.length ? (
            <div className="browser-evidence-clean">No captured runtime errors, console warnings/errors, failed requests, or slow requests in this observation window.</div>
          ) : null}

          <div className="browser-evidence-footnote">
            Request headers, request/response bodies, query strings and URL fragments are intentionally not captured.
          </div>
        </>
      ) : null}
    </section>
  );
}
