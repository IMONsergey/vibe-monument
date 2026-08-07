import type { CodexPlanState } from '../codex/plan';

export function PlanCard({
  state,
  busy,
  onBuild,
  onDismiss,
}: {
  state: CodexPlanState;
  busy: boolean;
  onBuild: () => void;
  onDismiss: () => void;
}) {
  if (state.status === 'idle') return null;

  return (
    <section className={`plan-card ${state.status}`}>
      <div className="plan-card-header">
        <div>
          <strong>{state.status === 'working' ? 'Planning…' : state.status === 'error' ? 'Plan failed' : 'Plan ready'}</strong>
          <span>Codex Plan mode · no product files are changed by this turn.</span>
        </div>
        <button type="button" className="plan-dismiss" disabled={busy} onClick={onDismiss}>×</button>
      </div>

      {state.userText ? <div className="plan-goal"><span>Goal</span><strong>{state.userText}</strong></div> : null}

      {state.error ? <div className="plan-error">{state.error}</div> : null}

      {state.status === 'working' && !state.text ? (
        <div className="plan-loading">Understanding the project and preparing an implementation plan…</div>
      ) : null}

      {state.text ? <div className="plan-content">{state.text}</div> : null}

      {state.status === 'ready' ? (
        <div className="plan-actions">
          <button type="button" className="plan-secondary" disabled={busy} onClick={onDismiss}>Dismiss</button>
          <button type="button" className="plan-build" disabled={busy || !state.text.trim()} onClick={onBuild}>Build this</button>
        </div>
      ) : null}
    </section>
  );
}
