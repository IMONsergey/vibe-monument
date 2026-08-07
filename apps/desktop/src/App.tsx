import { useCallback, useEffect, useMemo, useState } from 'react';
import { CodexRuntime } from './codex/runtime';
import {
  codexStatus,
  inspectProject,
  isNativeHost,
  listenNative,
  openExternalUrl,
  openProject,
  probeCodexProtocol,
  runtimeStatus,
  startRuntime,
  stateGet,
  stateSet,
  stopRuntime,
  type RuntimeOutput,
} from './host/native';
import type {
  ApprovalRequest,
  CodexAccountSnapshot,
  CodexProtocolProbe,
  CodexRuntimeInfo,
  FileNode,
  ProjectInspection,
  SimpleApprovalDecision,
  UserInputQuestion,
  WorkspaceState,
} from './types';

type Viewport = 'desktop' | 'mobile';
type DeveloperTab = 'activity' | 'files' | 'runtime' | 'diagnostics';
type UserAnswers = Record<string, string[]>;

const INITIAL_WORKSPACE: WorkspaceState = {
  project: null,
  activeThreadId: null,
  threads: [],
  codexState: 'idle',
  codexMessage: '',
  account: null,
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
    case 'auth-required': return 'Sign in to Codex';
    case 'starting': return 'Connecting Codex';
    case 'reconnecting': return 'Reconnecting';
    case 'error': return 'Codex unavailable';
    default: return 'Codex offline';
  }
}

function approvalTitle(approval: ApprovalRequest): string {
  switch (approval.kind) {
    case 'command': return 'Codex wants to run a command';
    case 'file-change': return 'Codex wants to change files';
    case 'permissions': return 'Codex needs additional access';
    case 'user-input': return 'Codex has a question';
    case 'elicitation': return 'An integration needs your input';
    default: return 'Codex needs attention';
  }
}

function decisionLabel(approval: ApprovalRequest, decision: SimpleApprovalDecision): string {
  if (decision === 'acceptForSession') return 'Allow for session';
  if (decision === 'decline') return 'Decline';
  if (decision === 'cancel') return 'Cancel turn';
  if (approval.kind === 'command') return 'Run once';
  if (approval.kind === 'file-change') return 'Apply';
  if (approval.kind === 'permissions') return 'Allow once';
  return 'Approve';
}

function permissionLines(approval: ApprovalRequest): string[] {
  if (approval.kind !== 'permissions') return [];
  const permissions = approval.params.permissions;
  if (!permissions || typeof permissions !== 'object') return [];
  const record = permissions as Record<string, unknown>;
  const lines: string[] = [];
  const network = record.network;
  if (network && typeof network === 'object' && (network as Record<string, unknown>).enabled === true) lines.push('Network access');
  const fileSystem = record.fileSystem;
  if (fileSystem && typeof fileSystem === 'object') {
    const fs = fileSystem as Record<string, unknown>;
    for (const key of ['read', 'write']) {
      const paths = fs[key];
      if (Array.isArray(paths)) {
        for (const path of paths) if (typeof path === 'string') lines.push(`${key === 'write' ? 'Write' : 'Read'} · ${path}`);
      }
    }
  }
  return lines;
}

function questionComplete(question: UserInputQuestion, answers: UserAnswers): boolean {
  return (answers[question.id] ?? []).some((answer) => answer.trim().length > 0);
}

function ApprovalCard({
  approval,
  answers,
  busy,
  onAnswers,
  onDecision,
  onSubmitAnswers,
}: {
  approval: ApprovalRequest;
  answers: UserAnswers;
  busy: boolean;
  onAnswers: (answers: UserAnswers) => void;
  onDecision: (decision: SimpleApprovalDecision) => void;
  onSubmitAnswers: () => void;
}) {
  const questions = approval.questions ?? [];
  const permissions = permissionLines(approval);
  const answersReady = questions.length > 0 && questions.every((question) => questionComplete(question, answers));

  return (
    <section className={`approval-card approval-${approval.kind}`}>
      <div className="approval-heading">
        <div><span className="attention-dot" /><strong>{approvalTitle(approval)}</strong></div>
        {approval.isBlocking === false ? <span className="approval-meta">Optional</span> : <span className="approval-meta">Paused</span>}
      </div>

      {approval.reason ? <p className="approval-reason">{approval.reason}</p> : null}
      {approval.command ? <pre className="approval-command"><code>{approval.command}</code></pre> : null}
      {approval.cwd ? <div className="approval-context"><span>Working folder</span><code>{approval.cwd}</code></div> : null}
      {approval.changedPaths?.length ? (
        <div className="approval-paths">
          <span>Files</span>
          {approval.changedPaths.slice(0, 8).map((path) => <code key={path}>{path}</code>)}
          {approval.changedPaths.length > 8 ? <small>+{approval.changedPaths.length - 8} more</small> : null}
        </div>
      ) : null}
      {permissions.length ? <div className="approval-permissions">{permissions.map((line) => <span key={line}>{line}</span>)}</div> : null}

      {approval.kind === 'user-input' ? (
        <div className="question-stack">
          {questions.map((question) => {
            const selected = answers[question.id] ?? [];
            const options = question.options ?? [];
            return (
              <div className="question-card" key={question.id}>
                {question.header ? <span className="question-kicker">{question.header}</span> : null}
                <strong>{question.question}</strong>
                {options.length ? (
                  <div className="question-options">
                    {options.map((option) => {
                      const active = selected.includes(option.label);
                      return (
                        <button type="button" className={active ? 'active' : ''} key={option.label} disabled={busy} onClick={() => onAnswers({ ...answers, [question.id]: [option.label] })}>
                          <span>{option.label}</span>
                          {option.description ? <small>{option.description}</small> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {!options.length || question.isOther ? (
                  <input
                    className="question-input"
                    type={question.isSecret ? 'password' : 'text'}
                    value={selected[0] ?? ''}
                    disabled={busy}
                    placeholder={question.isSecret ? 'Enter securely…' : 'Type your answer…'}
                    onChange={(event) => onAnswers({ ...answers, [question.id]: [event.target.value] })}
                  />
                ) : null}
              </div>
            );
          })}
          <div className="approval-actions">
            <button type="button" className="approval-primary" disabled={!answersReady || busy} onClick={onSubmitAnswers}>{busy ? 'Sending…' : 'Continue'}</button>
          </div>
        </div>
      ) : (
        <div className="approval-actions">
          {approval.availableDecisions.map((decision) => (
            <button
              type="button"
              key={decision}
              disabled={busy}
              className={decision === 'accept' || decision === 'acceptForSession' ? 'approval-primary' : decision === 'cancel' ? 'approval-danger' : 'approval-secondary'}
              onClick={() => onDecision(decision)}
            >
              {decisionLabel(approval, decision)}
            </button>
          ))}
        </div>
      )}

      {approval.kind === 'elicitation' ? <small className="approval-footnote">Structured integration forms are declined safely until Monument can render their exact schema.</small> : null}
    </section>
  );
}

function DiagnosticsPanel({
  running,
  runtimeInfo,
  protocol,
  account,
  onRun,
}: {
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
        <div><span>Monument</span><strong>0.2.0-alpha.1</strong></div>
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
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({});
  const [diagnosticsRunning, setDiagnosticsRunning] = useState(false);
  const [codexRuntimeInfo, setCodexRuntimeInfo] = useState<CodexRuntimeInfo | null>(null);
  const [protocolProbe, setProtocolProbe] = useState<CodexProtocolProbe | null>(null);
  const [authStarting, setAuthStarting] = useState(false);

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
      account: snapshot.account,
      approval: snapshot.approval,
      activity: snapshot.activity,
    }));
  }), [codex]);

  useEffect(() => {
    setApprovalBusy(false);
    setUserAnswers({});
  }, [workspace.approval?.id]);

  useEffect(() => {
    if (workspace.account?.readyForTurns) setAuthStarting(false);
  }, [workspace.account?.readyForTurns]);

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

      let restoredProject: ProjectInspection | null = null;
      const lastProjectPath = await stateGet<string>('lastProjectPath').catch(() => null);
      if (!disposed && lastProjectPath) {
        restoredProject = await inspectProject(lastProjectPath).catch(() => null);
        if (restoredProject && !disposed) setWorkspace((current) => ({ ...current, project: restoredProject }));
      }

      await codex.connect(restoredProject?.rootPath).catch(() => undefined);
    })();

    return () => {
      disposed = true;
      for (const dispose of disposers) dispose();
    };
  }, [codex, native]);

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
    if (!text || !project || sending || workspace.codexState !== 'ready') return;
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
  }, [codex, project, prompt, sending, workspace.codexState]);

  const startNewTask = useCallback(() => {
    codex.newTask();
    setPrompt('');
  }, [codex]);

  const resolveApproval = useCallback(async (decision: SimpleApprovalDecision) => {
    setApprovalBusy(true);
    setNotice(null);
    try {
      await codex.resolveApproval(decision);
    } catch (error) {
      setApprovalBusy(false);
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }, [codex]);

  const submitAnswers = useCallback(async () => {
    setApprovalBusy(true);
    setNotice(null);
    try {
      await codex.answerUserInput(userAnswers);
    } catch (error) {
      setApprovalBusy(false);
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }, [codex, userAnswers]);

  const runDiagnostics = useCallback(async () => {
    if (!native || diagnosticsRunning) return;
    setDiagnosticsRunning(true);
    setNotice(null);
    try {
      const [runtimeInfo, protocol] = await Promise.all([codexStatus(), probeCodexProtocol()]);
      setCodexRuntimeInfo(runtimeInfo);
      setProtocolProbe(protocol);
      await codex.refreshAccount(false).catch(() => undefined);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setDiagnosticsRunning(false);
    }
  }, [codex, diagnosticsRunning, native]);

  const startSignIn = useCallback(async () => {
    if (authStarting) return;
    setAuthStarting(true);
    setNotice(null);
    try {
      const login = await codex.startChatGptLogin();
      const target = login.authUrl || login.verificationUrl;
      if (!target) throw new Error('Codex did not return a sign-in URL');
      await openExternalUrl(target);
      setNotice(login.userCode ? `Browser opened. Enter code ${login.userCode} to finish signing in.` : 'Browser opened. Finish signing in to return to Monument.');
    } catch (error) {
      setAuthStarting(false);
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }, [authStarting, codex]);

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
        {workspace.codexState === 'auth-required' ? <button className="auth-button" type="button" disabled={authStarting} onClick={() => void startSignIn()}>{authStarting ? 'Opening…' : 'Sign in'}</button> : null}
        <button className="quiet-button" type="button" onClick={() => setDeveloperOpen((value) => !value)}>Under the hood</button>
        <button className="ship-button" type="button" disabled title="Ship gates come after deterministic verification">Ship</button>
      </header>

      <div className="product-layout">
        <aside className="task-rail">
          <div className="rail-heading"><span>Tasks</span><button type="button" className="mini-button" onClick={startNewTask}>＋</button></div>
          <div className="task-list">
            <button type="button" className={`task-item ${workspace.activeThreadId === null ? 'active' : ''}`} onClick={startNewTask}>
              <span className="task-dot new" /><span><strong>New task</strong><small>Describe what should change</small></span>
            </button>
            {workspace.threads.map((thread) => (
              <button type="button" className={`task-item ${workspace.activeThreadId === thread.id ? 'active' : ''}`} key={thread.id} onClick={() => codex.selectThread(thread.id)}>
                <span className="task-dot" /><span><strong>{thread.title || 'Codex task'}</strong><small>{thread.status || basename(thread.cwd || project?.rootPath || '')}</small></span>
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
              <div className={`preview-shell ${viewport}`}><iframe key={previewKey} src={runtimeUrl} title={`${project.name} preview`} allow="clipboard-read; clipboard-write" /></div>
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
                  <button type="button" className="primary-action" onClick={launchPreview} disabled={runtimeStarting}>{runtimeStarting ? 'Starting preview…' : `Start ${project.suggestedDevCommand || selectedScript}`}</button>
                ) : <div className="soft-warning">No dev/start/preview script was detected. You can still use Codex and inspect the repository.</div>}
              </div>
            )}
            {notice ? <div className="notice"><strong>Monument</strong><span>{notice}</span><button type="button" onClick={() => setNotice(null)}>×</button></div> : null}
          </div>

          <div className="prompt-dock">
            {workspace.codexState === 'auth-required' ? (
              <div className="auth-card">
                <div><strong>Connect Codex</strong><span>{workspace.account?.email || 'ChatGPT sign-in is required before Monument can build.'}</span></div>
                <button type="button" disabled={authStarting} onClick={() => void startSignIn()}>{authStarting ? 'Opening…' : 'Sign in with ChatGPT'}</button>
              </div>
            ) : null}
            {workspace.approval ? <ApprovalCard approval={workspace.approval} answers={userAnswers} busy={approvalBusy} onAnswers={setUserAnswers} onDecision={(decision) => void resolveApproval(decision)} onSubmitAnswers={() => void submitAnswers()} /> : null}
            {workspace.codexMessage ? <div className="codex-live"><span>Codex</span><p>{workspace.codexMessage}</p></div> : null}
            <div className="composer">
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && workspace.codexState === 'ready') {
                    event.preventDefault();
                    void sendPrompt();
                  }
                }}
                placeholder={project ? (workspace.codexState === 'auth-required' ? 'Sign in to Codex to start building…' : workspace.approval ? 'Resolve the request above to continue…' : 'Tell Monument what to build or change…') : 'Open a project to start building…'}
                disabled={!project || workspace.codexState === 'approval' || workspace.codexState === 'auth-required'}
              />
              <div className="composer-footer">
                <div className="context-row">
                  {project ? <span className="context-chip">◎ {project.name}</span> : null}
                  {runtimeUrl ? <span className="context-chip">● Live preview</span> : null}
                  {workspace.account?.planType ? <span className="context-chip">Codex · {workspace.account.planType}</span> : null}
                </div>
                {workspace.codexState === 'busy' ? (
                  <button type="button" className="send-button stop-button" onClick={() => void codex.interrupt()} title="Stop Codex">■</button>
                ) : (
                  <button type="button" className="send-button" onClick={sendPrompt} disabled={!project || !prompt.trim() || sending || workspace.codexState !== 'ready'}>{sending ? '…' : '↑'}</button>
                )}
              </div>
            </div>
          </div>
        </main>

        {developerOpen ? (
          <aside className="developer-panel">
            <div className="developer-tabs">
              {(['activity', 'files', 'runtime', 'diagnostics'] as DeveloperTab[]).map((tab) => <button type="button" key={tab} className={developerTab === tab ? 'active' : ''} onClick={() => setDeveloperTab(tab)}>{tab}</button>)}
              <button type="button" className="close-dev" onClick={() => setDeveloperOpen(false)}>×</button>
            </div>
            <div className="developer-body">
              {developerTab === 'activity' ? (workspace.activity.length ? workspace.activity.slice().reverse().map((item) => <div className={`activity-item ${item.kind}`} key={item.id}><strong>{item.title}</strong>{item.detail ? <span>{item.detail}</span> : null}</div>) : <div className="panel-empty">Real Codex activity will appear here.</div>) : null}
              {developerTab === 'files' ? (project ? <FileTree nodes={project.files} /> : <div className="panel-empty">Open a project to inspect real files.</div>) : null}
              {developerTab === 'runtime' ? (runtimeLines.length ? runtimeLines.map((line, index) => <div className={`runtime-line ${line.stream}`} key={`${index}-${line.line}`}><span>{line.stream === 'stderr' ? '!' : '›'}</span>{line.line}</div>) : <div className="panel-empty">Runtime output will appear after the local preview starts.</div>) : null}
              {developerTab === 'diagnostics' ? <DiagnosticsPanel running={diagnosticsRunning} runtimeInfo={codexRuntimeInfo} protocol={protocolProbe} account={workspace.account} onRun={() => void runDiagnostics()} /> : null}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
