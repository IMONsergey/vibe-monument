import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CodexRuntime } from './codex/runtime';
import {
  inspectProject,
  isNativeHost,
  listenNative,
  openProject,
  runtimeStatus,
  startRuntime,
  stateGet,
  stateSet,
  stopRuntime,
  type RuntimeOutput,
} from './host/native';
import type { FileNode, ProjectInspection, WorkspaceState } from './types';

type Viewport = 'desktop' | 'mobile';
type DeveloperTab = 'activity' | 'files' | 'runtime';

const INITIAL_WORKSPACE: WorkspaceState = {
  project: null,
  activeThreadId: null,
  threads: [],
  codexState: 'idle',
  codexMessage: '',
  approval: null,
  activity: [],
};

function projectScript(project: ProjectInspection | null): string | null {
  if (!project) return null;
  if (project.scripts.dev) return 'dev';
  if (project.scripts.start) return 'start';
  if (project.scripts.preview) return 'preview';
  return null;
}

function basename(path: string): string {
  return path.split('/').filter(Boolean).at(-1) ?? path;
}

function FileTree({ nodes, depth = 0 }: { nodes: FileNode[]; depth?: number }) {
  return (
    <div className="file-tree">
      {nodes.map((node) => (
        <div key={node.path}>
          <div className="file-row" style={{ paddingLeft: 10 + depth * 14 }} title={node.path}>
            <span className="file-symbol">{node.kind === 'directory' ? '⌄' : '·'}</span>
            <span className="file-name">{node.name}</span>
          </div>
          {node.kind === 'directory' && node.children?.length ? <FileTree nodes={node.children} depth={depth + 1} /> : null}
        </div>
      ))}
    </div>
  );
}

function statusText(state: WorkspaceState['codexState']): string {
  switch (state) {
    case 'ready': return 'Codex ready';
    case 'busy': return 'Codex working';
    case 'approval': return 'Needs attention';
    case 'starting': return 'Connecting Codex';
    case 'reconnecting': return 'Reconnecting';
    case 'error': return 'Codex unavailable';
    default: return 'Codex offline';
  }
}

export function App() {
  const native = isNativeHost();
  const codex = useMemo(() => new CodexRuntime(), []);
  const [workspace, setWorkspace] = useState<WorkspaceState>(INITIAL_WORKSPACE);
  const [opening, setOpening] = useState(false);
  const [runtimeStarting, setRuntimeStarting] = useState(false);
  const [runtimeRunning, setRuntimeRunning] = useState(false);
  const [runtimeUrl, setRuntimeUrl] = useState<string | null>(null);
  const [runtimeLines, setRuntimeLines] = useState<RuntimeOutput[]>([]);
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [previewKey, setPreviewKey] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [sending, setSending] = useState(false);
  const [developerOpen, setDeveloperOpen] = useState(false);
  const [developerTab, setDeveloperTab] = useState<DeveloperTab>('activity');
  const [notice, setNotice] = useState<string | null>(null);
  const connectedRef = useRef(false);

  const project = workspace.project;
  const selectedScript = projectScript(project);

  const applyProject = useCallback(async (next: ProjectInspection) => {
    setWorkspace((current) => ({ ...current, project: next }));
    setRuntimeUrl(null);
    setRuntimeLines([]);
    setRuntimeRunning(false);
    await stateSet('lastProjectPath', next.rootPath).catch(() => undefined);
    await codex.refreshThreads(next.rootPath).catch(() => undefined);
  }, [codex]);

  useEffect(() => codex.subscribe((snapshot) => {
    setWorkspace((current) => ({
      ...current,
      activeThreadId: snapshot.activeThreadId,
      threads: snapshot.threads,
      codexState: snapshot.state,
      codexMessage: snapshot.message,
      approval: snapshot.approval,
      activity: snapshot.activity,
    }));
  }), [codex]);

  useEffect(() => {
    if (!native) return;
    let disposed = false;
    const disposers: Array<() => void> = [];

    void (async () => {
      disposers.push(await listenNative<RuntimeOutput>('monument://runtime-output', (line) => {
        if (disposed) return;
        setRuntimeLines((current) => [...current, line].slice(-180));
      }));
      disposers.push(await listenNative<string>('monument://runtime-url', (url) => {
        if (disposed) return;
        setRuntimeUrl(url);
        setRuntimeRunning(true);
        setRuntimeStarting(false);
      }));

      const status = await runtimeStatus().catch(() => null);
      if (!disposed && status?.running) setRuntimeRunning(true);

      const lastProjectPath = await stateGet<string>('lastProjectPath').catch(() => null);
      if (!disposed && lastProjectPath) {
        const restored = await inspectProject(lastProjectPath).catch(() => null);
        if (restored && !disposed) await applyProject(restored);
      }

      if (!connectedRef.current) {
        connectedRef.current = true;
        await codex.connect().catch(() => undefined);
      }
    })();

    return () => {
      disposed = true;
      for (const dispose of disposers) dispose();
    };
  }, [applyProject, codex, native]);

  const chooseProject = useCallback(async () => {
    if (!native || opening) return;
    setOpening(true);
    setNotice(null);
    try {
      if (runtimeRunning) {
        await stopRuntime().catch(() => undefined);
        setRuntimeRunning(false);
        setRuntimeUrl(null);
      }
      const next = await openProject();
      if (next) await applyProject(next);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setOpening(false);
    }
  }, [applyProject, native, opening, runtimeRunning]);

  const launchPreview = useCallback(async () => {
    if (!project || !selectedScript || runtimeStarting) return;
    setRuntimeStarting(true);
    setRuntimeLines([]);
    setNotice(null);
    try {
      const info = await startRuntime(project.rootPath, selectedScript);
      setRuntimeRunning(info.running);
    } catch (error) {
      setRuntimeStarting(false);
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }, [project, runtimeStarting, selectedScript]);

  const stopPreview = useCallback(async () => {
    await stopRuntime().catch(() => undefined);
    setRuntimeRunning(false);
    setRuntimeStarting(false);
    setRuntimeUrl(null);
  }, []);

  const sendPrompt = useCallback(async () => {
    const text = prompt.trim();
    if (!text || !project || sending) return;
    setSending(true);
    setNotice(null);
    try {
      await codex.send(text, project.rootPath);
      setPrompt('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setSending(false);
    }
  }, [codex, project, prompt, sending]);

  return (
    <div className="monument-app">
      <header className="topbar" data-tauri-drag-region>
        <div className="window-space" data-tauri-drag-region />
        <button className="brand-button" type="button" onClick={() => setDeveloperOpen(false)}>Monument</button>
        <button className="project-switcher" type="button" onClick={chooseProject} disabled={!native || opening}>
          <span className="project-indicator" />
          <span>{project?.name ?? 'Open project'}</span>
          <span className="chevron">⌄</span>
        </button>
        {project?.git.branch ? <span className="branch-label">{project.git.branch}</span> : null}
        <div className="topbar-spacer" />
        <div className={`codex-status ${workspace.codexState}`}><span />{statusText(workspace.codexState)}</div>
        <button className="quiet-button" type="button" onClick={() => setDeveloperOpen((value) => !value)}>Under the hood</button>
        <button className="ship-button" type="button" disabled title="Ship gates come after deterministic verification">Ship</button>
      </header>

      <div className="product-layout">
        <aside className="task-rail">
          <div className="rail-heading">
            <span>Tasks</span>
            <button type="button" className="mini-button" onClick={() => codex.selectThread('')}>＋</button>
          </div>
          <div className="task-list">
            <button
              type="button"
              className={`task-item ${workspace.activeThreadId === null ? 'active' : ''}`}
              onClick={() => setWorkspace((current) => ({ ...current, activeThreadId: null }))}
            >
              <span className="task-dot new" />
              <span><strong>New task</strong><small>Describe what should change</small></span>
            </button>
            {workspace.threads.map((thread) => (
              <button
                type="button"
                className={`task-item ${workspace.activeThreadId === thread.id ? 'active' : ''}`}
                key={thread.id}
                onClick={() => codex.selectThread(thread.id)}
              >
                <span className="task-dot" />
                <span><strong>{thread.title || 'Codex task'}</strong><small>{thread.status || basename(thread.cwd || project?.rootPath || '')}</small></span>
              </button>
            ))}
          </div>
          {project ? (
            <div className="project-facts">
              <div><span>Project</span><strong>{project.framework || 'Detected locally'}</strong></div>
              <div><span>Runtime</span><strong>{project.packageManager || '—'}</strong></div>
              <div><span>Changes</span><strong>{project.git.changedFiles}</strong></div>
            </div>
          ) : null}
        </aside>

        <main className="canvas-area">
          <div className="canvas-toolbar">
            <div className="segmented">
              <button type="button" className={viewport === 'desktop' ? 'active' : ''} onClick={() => setViewport('desktop')}>Desktop</button>
              <button type="button" className={viewport === 'mobile' ? 'active' : ''} onClick={() => setViewport('mobile')}>Mobile</button>
            </div>
            {runtimeUrl ? <span className="url-label">{runtimeUrl}</span> : <span className="url-label muted">Live preview</span>}
            <div className="toolbar-spacer" />
            {runtimeUrl ? <button type="button" className="icon-text" onClick={() => setPreviewKey((value) => value + 1)}>↻ Refresh</button> : null}
            {runtimeRunning ? <button type="button" className="icon-text" onClick={stopPreview}>Stop</button> : null}
          </div>

          <div className="canvas-stage">
            {!project ? (
              <div className="empty-product">
                <div className="empty-mark">M</div>
                <h1>Build by describing.</h1>
                <p>Open a real project. Monument will understand the repository, connect Codex, run the product and keep the engineering machinery out of your way.</p>
                <button type="button" className="primary-action" onClick={chooseProject} disabled={!native || opening}>{opening ? 'Opening…' : 'Open project'}</button>
                {!native ? <small>Launch the native Monument app to access local projects.</small> : null}
              </div>
            ) : runtimeUrl ? (
              <div className={`preview-shell ${viewport}`}>
                <iframe key={previewKey} src={runtimeUrl} title={`${project.name} preview`} allow="clipboard-read; clipboard-write" />
              </div>
            ) : (
              <div className="runtime-ready">
                <div className="project-avatar">{project.name.slice(0, 1).toUpperCase()}</div>
                <h2>{project.name}</h2>
                <p>{project.framework || 'Project'} is ready. Start its real local runtime to work directly on the live product.</p>
                <div className="fact-pills">
                  {project.framework ? <span>{project.framework}</span> : null}
                  {project.packageManager ? <span>{project.packageManager}</span> : null}
                  {project.git.branch ? <span>{project.git.branch}</span> : null}
                </div>
                {selectedScript ? (
                  <button type="button" className="primary-action" onClick={launchPreview} disabled={runtimeStarting}>
                    {runtimeStarting ? 'Starting preview…' : `Start ${project.suggestedDevCommand || selectedScript}`}
                  </button>
                ) : (
                  <div className="soft-warning">No dev/start/preview script was detected. You can still use Codex and inspect the repository.</div>
                )}
              </div>
            )}
            {notice ? <div className="notice"><strong>Monument</strong><span>{notice}</span><button type="button" onClick={() => setNotice(null)}>×</button></div> : null}
          </div>

          <div className="prompt-dock">
            {workspace.approval ? (
              <div className="approval-card">
                <div><strong>Codex needs attention</strong><span>{workspace.approval.method}</span></div>
                <small>Monument has paused rather than guessing approval semantics. Generated protocol bindings are the next safety gate.</small>
              </div>
            ) : null}
            {workspace.codexMessage ? <div className="codex-live"><span>Codex</span><p>{workspace.codexMessage}</p></div> : null}
            <div className="composer">
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendPrompt();
                  }
                }}
                placeholder={project ? 'Tell Monument what to build or change…' : 'Open a project to start building…'}
                disabled={!project}
              />
              <div className="composer-footer">
                <div className="context-row">
                  {project ? <span className="context-chip">◎ {project.name}</span> : null}
                  {runtimeUrl ? <span className="context-chip">● Live preview</span> : null}
                </div>
                <button type="button" className="send-button" onClick={sendPrompt} disabled={!project || !prompt.trim() || sending || workspace.codexState === 'error'}>{sending ? '…' : '↑'}</button>
              </div>
            </div>
          </div>
        </main>

        {developerOpen ? (
          <aside className="developer-panel">
            <div className="developer-tabs">
              {(['activity', 'files', 'runtime'] as DeveloperTab[]).map((tab) => (
                <button type="button" key={tab} className={developerTab === tab ? 'active' : ''} onClick={() => setDeveloperTab(tab)}>{tab}</button>
              ))}
              <button type="button" className="close-dev" onClick={() => setDeveloperOpen(false)}>×</button>
            </div>
            <div className="developer-body">
              {developerTab === 'activity' ? (
                workspace.activity.length ? workspace.activity.slice().reverse().map((item) => (
                  <div className={`activity-item ${item.kind}`} key={item.id}><strong>{item.title}</strong>{item.detail ? <span>{item.detail}</span> : null}</div>
                )) : <div className="panel-empty">Real Codex activity will appear here.</div>
              ) : null}
              {developerTab === 'files' ? (
                project ? <FileTree nodes={project.files} /> : <div className="panel-empty">Open a project to inspect real files.</div>
              ) : null}
              {developerTab === 'runtime' ? (
                runtimeLines.length ? runtimeLines.map((line, index) => (
                  <div className={`runtime-line ${line.stream}`} key={`${index}-${line.line}`}><span>{line.stream === 'stderr' ? '!' : '›'}</span>{line.line}</div>
                )) : <div className="panel-empty">Runtime output will appear after the local preview starts.</div>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
