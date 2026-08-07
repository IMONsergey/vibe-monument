import type { CodexReviewState } from '../codex/review';

export function ReviewCard({
  state,
  busy,
  onFix,
  onDismiss,
}: {
  state: CodexReviewState;
  busy: boolean;
  onFix: () => void;
  onDismiss: () => void;
}) {
  if (state.status === 'idle') return null;

  return (
    <section className={`review-card ${state.status}`}>
      <div className="review-card-header">
        <div>
          <strong>{state.status === 'working' ? 'Fresh Review…' : state.status === 'error' ? 'Review failed' : 'Fresh Review'}</strong>
          <span>Detached Codex review · independent from the implementation turn.</span>
        </div>
        <button type="button" className="review-dismiss" disabled={busy} onClick={onDismiss}>×</button>
      </div>

      {state.status === 'working' && !state.text ? (
        <div className="review-loading">Reviewing the current uncommitted changes in a detached Codex thread…</div>
      ) : null}

      {state.error ? <div className="review-error">{state.error}</div> : null}
      {state.text ? <div className="review-content">{state.text}</div> : null}

      {state.status === 'ready' ? (
        <div className="review-actions">
          <button type="button" className="review-secondary" disabled={busy} onClick={onDismiss}>Dismiss</button>
          <button type="button" className="review-fix" disabled={busy || !state.text.trim()} onClick={onFix}>Fix findings</button>
        </div>
      ) : null}
    </section>
  );
}
