import { useCallback, useEffect, useState } from 'react';
import {
  codexStatus,
  inspectProject,
  isNativeHost,
  openProject,
  runtimeStatus,
  stateGet,
  stateSet,
} from '../host/native';
import { MONUMENT_VERSION } from '../version';

type Health = {
  checked: boolean;
  projectPath: string | null;
  projectName: string | null;
  projectValid: boolean;
  codexRunning: boolean;
  codexVersion: string | null;
  runtimeRunning: boolean;
  runtimeCommand: string | null;
};

const EMPTY_HEALTH: Health = {
  checked: false,
  projectPath: null,
  projectName: null,
  projectValid: false,
  codexRunning: false,
  codexVersion: null,
  runtimeRunning: false,
  runtimeCommand: null,
};

function shortPath(path: string | null): string {
  if (!path) return 'No project selected';
  const parts = path.split('/').filter(Boolean);
  return parts.length > 3 ? `…/${parts.slice(-3).join('/')}` : path;
}

export function AlphaPreviewShell() {
  const native = isNativeHost();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<Health>(EMPTY_HEALTH);
  const [message, setMessage] = useState<string | null>(null);

  const refreshHealth = useCallback(async (revealIfMissing = false) => {
    if (!native) {
      setHealth({ ...EMPTY_HEALTH, checked: true });
      if (revealIfMissing) setOpen(true);
      return;
    }
    const lastProjectPath = await stateGet<string>('lastProjectPath').catch(() => null);
    const project = lastProjectPath ? await inspectProject(lastProjectPath).catch(() => null) : null;
    const [codex, runtime] = await Promise.all([
      codexStatus().catch(() => null),
      runtimeStatus().catch(() => null),
    ]);
    setHealth({
      checked: true,
      projectPath: lastProjectPath,
      projectName: project?.name ?? null,
      projectValid: Boolean(project),
      codexRunning: Boolean(codex?.running),
      codexVersion: codex?.version ?? null,
      runtimeRunning: Boolean(runtime?.running),
      runtimeCommand: runtime?.command ?? null,
    });
    if (revealIfMissing && !project) setOpen(true);
  }, [native]);

  useEffect(() => {
    void refreshHealth(true);
  }, [refreshHealth]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      setOpen((value) => !value);
      if (!open) void refreshHealth(false);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, refreshHealth]);

  const chooseProject = useCallback(async () => {
    if (!native || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const project = await openProject();
      if (!project) return;
      await stateSet('lastProjectPath', project.rootPath);
      setMessage(`Opening ${project.name}…`);
      window.setTimeout(() => window.location.reload(), 120);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }, [busy, native]);

  const recheck = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await refreshHealth(false);
      setMessage('Environment rechecked.');
    } finally {
      setBusy(false);
    }
  }, [busy, refreshHealth]);

  if (!open) {
    return (
      <button
        type="button"
        className="alpha-preview-command-trigger"
        onClick={() => { setOpen(true); void refreshHealth(false); }}
        title="Open Alpha Preview Command Center (⌘K)"
      >
        <span>Alpha {MONUMENT_VERSION.replace('0.2.0-alpha.', '')}</span>
        <kbd>⌘K</kbd>
      </button>
    );
  }

  return (
    <div className="alpha-preview-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && health.projectValid) setOpen(false);
    }}>
      <section className="alpha-preview-panel" role="dialog" aria-modal="true" aria-label="Monument Alpha Preview Command Center">
        <header className="alpha-preview-header">
          <div>
            <span className="alpha-preview-eyebrow">MONUMENT · INTEL PREVIEW</span>
            <h1>{health.projectValid ? 'Command Center' : 'Open your first project'}</h1>
            <p>{health.projectValid
              ? 'A compact status surface for the current local workspace and native runtime.'
              : 'Choose a local project. Monument will reopen into the real product workspace and keep repository source as the only durable truth.'}</p>
          </div>
          {health.projectValid ? <button type="button" className="alpha-preview-close" onClick={() => setOpen(false)} aria-label="Close Command Center">×</button> : null}
        </header>

        <div className="alpha-preview-primary-actions">
          <button type="button" className="alpha-preview-open-project" disabled={!native || busy} onClick={() => void chooseProject()}>
            <strong>{health.projectValid ? 'Open / switch project' : 'Open local project'}</strong>
            <span>{native ? 'Choose a folder on this Mac' : 'Launch the installed Monument app to open local projects'}</span>
          </button>
          <button type="button" className="alpha-preview-recheck" disabled={!native || busy} onClick={() => void recheck()}>
            Recheck environment
          </button>
        </div>

        <div className="alpha-preview-health-grid">
          <article className={health.projectValid ? 'ready' : 'attention'}>
            <div><span className="alpha-preview-health-dot" /><strong>Project</strong></div>
            <b>{health.projectValid ? health.projectName : 'Not selected'}</b>
            <small title={health.projectPath ?? undefined}>{shortPath(health.projectPath)}</small>
          </article>
          <article className={health.codexRunning ? 'ready' : 'neutral'}>
            <div><span className="alpha-preview-health-dot" /><strong>Codex host</strong></div>
            <b>{health.codexRunning ? 'Connected' : 'Not running yet'}</b>
            <small>{health.codexVersion ? `CLI ${health.codexVersion}` : 'Monument starts the managed Codex host with the workspace'}</small>
          </article>
          <article className={health.runtimeRunning ? 'ready' : 'neutral'}>
            <div><span className="alpha-preview-health-dot" /><strong>Live runtime</strong></div>
            <b>{health.runtimeRunning ? 'Running' : 'Stopped'}</b>
            <small>{health.runtimeCommand || 'Start the project preview from the main workspace'}</small>
          </article>
          <article className="ready">
            <div><span className="alpha-preview-health-dot" /><strong>Build</strong></div>
            <b>{MONUMENT_VERSION}</b>
            <small>Intel x86_64 · macOS 13+</small>
          </article>
        </div>

        <div className="alpha-preview-flow">
          <span>Prompt</span><i>→</i><span>Source</span><i>→</i><span>Runtime</span><i>→</i><span>Evidence</span><i>→</i><span>Ship</span>
        </div>

        <footer className="alpha-preview-footer">
          <div className="alpha-preview-shortcuts">
            <span><kbd>⌘K</kbd> Command Center</span>
            <span><kbd>⌘Z</kbd> Previous version</span>
            <span><kbd>⇧⌘Z</kbd> Next version</span>
            <span><kbd>✦ Edit</kbd> Visual Editor</span>
          </div>
          <p>Dynamic or ambiguous source ownership stays Codex-backed. Direct edits are source-native and enter the same Timeline → checks → Browser Evidence → Fresh Review → Ship chain.</p>
          {message ? <div className="alpha-preview-message">{message}</div> : null}
        </footer>
      </section>
    </div>
  );
}
