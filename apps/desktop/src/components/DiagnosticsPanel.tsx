import type { CodexAccountSnapshot, CodexProtocolProbe, CodexRuntimeInfo } from '../types';
import { MONUMENT_VERSION } from '../version';

export function DiagnosticsPanel({ running, runtimeInfo, protocol, account, onRun }: {
  running: boolean;
  runtimeInfo: CodexRuntimeInfo | null;
  protocol: CodexProtocolProbe | null;
  account: CodexAccountSnapshot | null;
  onRun: () => void;
}) {
  return (
    <div className="diagnostics-panel">
      <div className="diagnostics-header">
        <div><strong>Monument diagnostics</strong><span>Real local runtime checks</span></div>
        <button type="button" onClick={onRun} disabled={running}>{running ? 'Checking…' : 'Run checks'}</button>
      </div>
      <div className="diagnostic-grid">
        <div><span>Monument</span><strong>{MONUMENT_VERSION}</strong></div>
        <div><span>Architecture</span><strong>Native macOS</strong></div>
        <div><span>Codex process</span><strong>{runtimeInfo ? (runtimeInfo.running ? 'Running' : 'Stopped') : 'Not checked'}</strong></div>
        <div><span>Codex version</span><strong>{runtimeInfo?.version || protocol?.version || 'Not checked'}</strong></div>
        <div><span>Codex account</span><strong>{account?.email || account?.accountType || (account?.readyForTurns ? 'External provider' : 'Not signed in')}</strong></div>
        <div><span>ChatGPT plan</span><strong>{account?.planType || '—'}</strong></div>
        <div><span>Protocol schema</span><strong className={protocol?.schemaSupported ? 'diag-good' : protocol ? 'diag-bad' : ''}>{protocol ? (protocol.schemaSupported ? 'Compatible' : 'Unavailable') : 'Not checked'}</strong></div>
        <div><span>Generated schema files</span><strong>{protocol?.generatedFiles ?? '—'}</strong></div>
      </div>
      {protocol?.command ? <div className="diagnostic-detail"><span>Codex binary</span><code>{protocol.command}</code></div> : null}
      {protocol?.schemaDirectory ? <div className="diagnostic-detail"><span>Protocol cache</span><code>{protocol.schemaDirectory}</code></div> : null}
      {protocol?.error ? <div className="diagnostic-error">{protocol.error}</div> : null}
    </div>
  );
}
