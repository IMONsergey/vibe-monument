import type { VerificationProgress, VerificationResult } from '../verification/controller';

function statusLabel(progress: VerificationProgress | null, stale: boolean): string {
  if (!progress) return 'No evidence yet';
  if (stale) return 'Previous checks stale';
  switch (progress.evidence.status) {
    case 'running': return progress.currentScript ? `Running ${progress.currentScript}` : 'Verifying';
    case 'passed': return 'Checks passed';
    case 'failed': return 'Checks failed';
    case 'no-checks': return 'No deterministic checks detected';
    case 'error': return 'Verification error';
  }
}

function resultStatus(result: VerificationResult): string {
  if (result.timedOut) return 'Timed out';
  if (result.success) return 'Passed';
  return result.exitCode == null ? 'Failed' : `Exit ${result.exitCode}`;
}

function durationLabel(durationMs: number): string {
  if (durationMs < 1000) return `${Math.round(durationMs)} ms`;
  return `${(durationMs / 1000).toFixed(durationMs < 10_000 ? 1 : 0)} s`;
}

function outputOf(result: VerificationResult): string {
  return [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join('\n\n');
}

export function EvidencePanel({
  progress,
  manualRunning,
  onRunAll,
  stale = false,
}: {
  progress: VerificationProgress | null;
  manualRunning: boolean;
  onRunAll: () => void;
  stale?: boolean;
}) {
  const evidence = progress?.evidence ?? null;
  const resultByScript = new Map((evidence?.results ?? []).map((result) => [result.script, result]));
  const plan = evidence?.plan ?? [];

  return (
    <div className={`evidence-panel ${stale ? 'stale' : ''}`}>
      <div className="evidence-header">
        <div>
          <strong>{statusLabel(progress, stale)}</strong>
          <span>Deterministic project checks, not agent confidence.</span>
        </div>
        <button type="button" disabled={manualRunning || evidence?.status === 'running'} onClick={onRunAll}>
          {manualRunning ? 'Running…' : 'Run all checks'}
        </button>
      </div>

      {!evidence ? (
        <div className="evidence-empty">
          Monument will run safe detected checks after Codex completes a turn. A completed turn alone is not proof that the product works.
        </div>
      ) : null}

      {stale && evidence ? (
        <div className="evidence-stale">
          These checks belong to an older turn. Run or wait for current verification before treating them as evidence.
        </div>
      ) : null}

      {evidence?.status === 'no-checks' ? (
        <div className="evidence-note">
          This project exposes no supported deterministic scripts (`typecheck`, `test`, `build`, `lint`, `check`). Monument therefore does not mark it verified.
        </div>
      ) : null}

      {evidence?.error ? <div className="evidence-error">{evidence.error}</div> : null}

      {plan.length ? (
        <div className="evidence-list">
          {plan.map((item) => {
            const result = resultByScript.get(item.script);
            const running = evidence?.status === 'running' && progress?.currentScript === item.script;
            return (
              <details className={`evidence-check ${result?.success ? 'passed' : result ? 'failed' : running ? 'running' : ''}`} key={item.script} open={Boolean(result && !result.success)}>
                <summary>
                  <span className="evidence-check-dot" />
                  <div className="evidence-check-copy">
                    <strong>{item.script}</strong>
                    <small>{item.command}</small>
                  </div>
                  <div className="evidence-check-meta">
                    <span>{running ? 'Running…' : result ? resultStatus(result) : item.automatic ? 'Automatic' : 'Manual'}</span>
                    {result ? <small>{durationLabel(result.durationMs)}</small> : null}
                  </div>
                </summary>
                {result ? (
                  <div className="evidence-check-detail">
                    <div className="evidence-kv"><span>Command</span><code>{result.command}</code></div>
                    <div className="evidence-kv"><span>Working folder</span><code>{result.cwd}</code></div>
                    <div className="evidence-kv"><span>Exit</span><code>{result.timedOut ? 'timeout' : String(result.exitCode ?? 'signal')}</code></div>
                    {outputOf(result) ? <pre>{outputOf(result)}</pre> : <div className="evidence-no-output">No output captured.</div>}
                  </div>
                ) : null}
              </details>
            );
          })}
        </div>
      ) : null}

      <div className="evidence-footnote">
        A passing build proves bundling. A passing test proves only what that test covers. Browser/runtime/visual evidence and fresh review are separate gates.
      </div>
    </div>
  );
}
