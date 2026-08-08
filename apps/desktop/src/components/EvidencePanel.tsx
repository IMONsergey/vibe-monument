import { useEffect, useMemo, useState } from 'react';
import { isAutoRepairEnabled, requestVerificationRepair, setAutoRepairEnabled } from '../repair/controller';
import {
  isAutoVerificationEnabled,
  runVerification,
  setAutoVerificationEnabled,
  type VerificationProgress,
  type VerificationResult,
} from '../verification/controller';

function statusLabel(progress: VerificationProgress | null, stale: boolean): string {
  if (!progress) return 'No evidence yet';
  if (stale) return 'Previous checks stale';
  if (progress.evidence.permissionRequired) return 'Auto checks are off';
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
  const automaticPlan = useMemo(() => plan.filter((item) => item.automatic), [plan]);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [repairEnabled, setRepairEnabled] = useState(false);
  const [repairBusy, setRepairBusy] = useState(false);
  const [explicitRepairRequested, setExplicitRepairRequested] = useState(false);

  useEffect(() => {
    let disposed = false;
    setExplicitRepairRequested(false);
    const projectId = evidence?.projectId;
    if (!projectId) {
      setAutoEnabled(false);
      setRepairEnabled(false);
      return () => { disposed = true; };
    }
    void Promise.all([
      isAutoVerificationEnabled(projectId),
      isAutoRepairEnabled(projectId),
    ]).then(([checks, repair]) => {
      if (disposed) return;
      setAutoEnabled(checks);
      setRepairEnabled(repair);
    });
    return () => { disposed = true; };
  }, [evidence?.projectId, evidence?.id]);

  const enableAuto = async () => {
    if (!evidence || autoBusy) return;
    setAutoBusy(true);
    try {
      await setAutoVerificationEnabled(evidence.projectId, true);
      setAutoEnabled(true);
      if (evidence.projectRoot && automaticPlan.length) {
        await runVerification({
          projectId: evidence.projectId,
          projectRoot: evidence.projectRoot,
          trigger: evidence.trigger === 'visual-edit' ? 'visual-edit' : 'codex-turn',
          turnSerial: evidence.turnSerial,
        });
      }
    } finally {
      setAutoBusy(false);
    }
  };

  const disableAuto = async () => {
    if (!evidence || autoBusy || evidence.status === 'running') return;
    setAutoBusy(true);
    try {
      await setAutoVerificationEnabled(evidence.projectId, false);
      await setAutoRepairEnabled(evidence.projectId, false).catch(() => undefined);
      setAutoEnabled(false);
      setRepairEnabled(false);
    } finally {
      setAutoBusy(false);
    }
  };

  const enableRepair = async () => {
    if (!evidence || repairBusy || !autoEnabled) return;
    setRepairBusy(true);
    try {
      await setAutoRepairEnabled(evidence.projectId, true);
      setRepairEnabled(true);
    } finally {
      setRepairBusy(false);
    }
  };

  const disableRepair = async () => {
    if (!evidence || repairBusy) return;
    setRepairBusy(true);
    try {
      await setAutoRepairEnabled(evidence.projectId, false);
      setRepairEnabled(false);
    } finally {
      setRepairBusy(false);
    }
  };

  const fixFailedChecks = () => {
    if (!evidence || stale || evidence.status !== 'failed' || explicitRepairRequested) return;
    if (requestVerificationRepair(evidence)) setExplicitRepairRequested(true);
  };

  const visualGeneration = evidence?.trigger === 'visual-edit';

  return (
    <div className={`evidence-panel ${stale ? 'stale' : ''}`}>
      <div className="evidence-header">
        <div>
          <strong>{statusLabel(progress, stale)}</strong>
          <span>Deterministic project checks, not agent confidence.</span>
        </div>
        <div className="evidence-header-actions">
          {evidence?.status === 'failed' ? (
            <button type="button" className="fix-evidence-button" disabled={stale || explicitRepairRequested || manualRunning} onClick={fixFailedChecks}>
              {explicitRepairRequested ? 'Repair requested' : 'Fix with Monument'}
            </button>
          ) : null}
          <button type="button" disabled={manualRunning || autoBusy || evidence?.status === 'running'} onClick={onRunAll}>
            {manualRunning ? 'Running…' : 'Run all checks'}
          </button>
        </div>
      </div>

      {!evidence ? (
        <div className="evidence-empty">
          Monument detects project checks but never runs repository scripts automatically until you explicitly allow Auto checks for that project.
        </div>
      ) : null}

      {automaticPlan.length ? (
        <div className={`auto-checks-row ${autoEnabled ? 'enabled' : ''}`}>
          <div>
            <strong>Auto checks · {autoEnabled ? 'On' : 'Off'}</strong>
            <span>
              {autoEnabled
                ? `After supported Codex and direct visual code generations Monument may run: ${automaticPlan.map((item) => item.script).join(', ')}.`
                : `Detected ${automaticPlan.map((item) => item.script).join(', ')}. These are project scripts and require your permission.`}
            </span>
          </div>
          <button
            type="button"
            disabled={autoBusy || evidence?.status === 'running' || (!evidence?.projectRoot && !autoEnabled)}
            onClick={() => void (autoEnabled ? disableAuto() : enableAuto())}
          >
            {autoBusy ? 'Saving…' : autoEnabled ? 'Disable' : 'Enable for this project'}
          </button>
        </div>
      ) : null}

      {automaticPlan.length ? (
        <div className={`auto-repair-row ${repairEnabled ? 'enabled' : ''}`}>
          <div>
            <strong>Auto repair · {repairEnabled ? 'On' : 'Off'}</strong>
            <span>
              {visualGeneration
                ? 'Direct visual generations keep repair explicit for now. If checks fail, use Fix with Monument; automatic repair budgets remain scoped to Codex repair chains.'
                : repairEnabled
                  ? 'If permitted automatic checks fail after a Codex generation, Codex may make up to 2 bounded repair attempts. Permissions are never auto-approved.'
                  : autoEnabled
                    ? 'Optional for Codex generations: let Monument attempt up to 2 bounded fixes after automatic checks fail.'
                    : 'Enable Auto checks first. Auto repair never grants permission to run project scripts by itself.'}
            </span>
          </div>
          <button
            type="button"
            disabled={repairBusy || autoBusy || !autoEnabled || evidence?.status === 'running' || visualGeneration}
            onClick={() => void (repairEnabled ? disableRepair() : enableRepair())}
          >
            {visualGeneration ? 'Codex generations only' : repairBusy ? 'Saving…' : repairEnabled ? 'Disable' : autoEnabled ? 'Enable auto repair' : 'Enable checks first'}
          </button>
        </div>
      ) : null}

      {evidence?.permissionRequired ? (
        <div className="evidence-note">
          Monument detected automatic checks but did not execute them. Enable Auto checks above, or use “Run all checks” for a one-time manual verification.
        </div>
      ) : null}

      {stale && evidence ? (
        <div className="evidence-stale">
          These checks belong to an older code generation. Run or wait for current verification before treating them as evidence.
        </div>
      ) : null}

      {evidence?.status === 'no-checks' && !evidence.permissionRequired ? (
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
            const awaitingPermission = Boolean(evidence?.permissionRequired && item.automatic && !result);
            return (
              <details className={`evidence-check ${result?.success ? 'passed' : result ? 'failed' : running ? 'running' : ''}`} key={item.script} open={Boolean(result && !result.success)}>
                <summary>
                  <span className="evidence-check-dot" />
                  <div className="evidence-check-copy">
                    <strong>{item.script}</strong>
                    <small>{item.command}</small>
                  </div>
                  <div className="evidence-check-meta">
                    <span>{running ? 'Running…' : result ? resultStatus(result) : awaitingPermission ? 'Needs permission' : item.automatic ? 'Automatic' : 'Manual'}</span>
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
