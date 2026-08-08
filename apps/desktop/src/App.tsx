import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApprovalCard, type UserAnswers } from './components/ApprovalCard';
import { BrowserEvidencePanel } from './components/BrowserEvidencePanel';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';
import { EvidencePanel } from './components/EvidencePanel';
import { FileTree } from './components/FileTree';
import { PromptQueue } from './components/PromptQueue';
import { ShipPanel } from './components/ShipPanel';
import { VersionTimelinePanel } from './components/VersionTimelinePanel';
import { CodexRuntime } from './codex/runtime';
import { compileTurnText } from './context/turn';
import {
  browserEvidenceHasIssues,
  captureBrowserEvidence,
  clearBrowserEvidenceBuffer,
  markBrowserEvidenceStale,
  restoreBrowserEvidence,
  subscribeBrowserEvidence,
  type BrowserEvidenceRecord,
} from './browser/evidence';
import {
  beginSourceTransactionValidation,
  endSourceTransactionValidation,
  setSourceTransactionOrchestrationBlocked,
} from './editor/transactionState';
import {
  codexStatus,
  inspectProject,
  invokeNative,
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
import { NativePreview } from './preview/NativePreview';
import {
  getPreviewSelection,
  selectionLabel,
  setPreviewSelection,
  subscribePreviewSelection,
  type PreviewSelection,
} from './preview/selection';
import {
  detachPromptQueueThreads,
  enqueuePrompt,
  loadPromptQueue,
  moveQueuedPrompt,
  removeQueuedPrompt,
  restoreQueuedPromptToFront,
  setPromptQueuePaused,
  subscribePromptQueue,
  takeNextPrompt,
  type PromptQueueState,
  type QueuedPrompt,
} from './queue/controller';
import {
  restoreFreshReview,
  runFreshReview,
  subscribeFreshReview,
  type FreshReviewRecord,
} from './review/controller';
import { evaluateShipGate } from './ship/controller';
import {
  backTimeline,
  checkpointCompletedTurn,
  compareTimelineVersions,
  forgetTimelinePrompt,
  forwardTimeline,
  prepareTimeline,
  rememberTimelinePrompt,
  restoreTimelineVersion,
  saveTimelineVersion,
} from './timeline/controller';
import type { TimelineDiff, TimelineRestoreResult, TimelineState } from './timeline/types';
import type {
  CodexProtocolProbe,
  CodexRuntimeInfo,
  ProjectInspection,
  SimpleApprovalDecision,
  WorkspaceState,
} from './types';
import {
  restoreVerification,
  runVerification,
  subscribeVerification,
  type VerificationProgress,
} from './verification/controller';

type Viewport = 'desktop' | 'mobile';
type DeveloperTab = 'activity' | 'files' | 'runtime' | 'evidence' | 'diagnostics';

type SourceTransactionEventDetail = {
  projectId: string;
  path: string;
  appliedCount: number;
  checkpointId: string;
  turnSerial: number;
};

const INITIAL_WORKSPACE: WorkspaceState = {
  project: null,
  activeThreadId: null,
  threads: [],
  codexState: 'idle',
  codexMessage: '',
  turnSerial: 0,
  completionSerial: 0,
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

function verificationLabel(progress: VerificationProgress | null): string | null {
  if (!progress) return null;
  switch (progress.evidence.status) {
    case 'running': return progress.currentScript ? `Checking ${progress.currentScript}` : 'Verifying';
    case 'passed': return 'Checks passed';
    case 'failed': return 'Checks failed';
    case 'no-checks': return 'No checks detected';
    case 'error': return 'Verification error';
  }
}

function editableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(
    target.closest('input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]'),
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
  const [selection, setSelection] = useState<PreviewSelection | null>(null);
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
  const [verificationProgress, setVerificationProgress] = useState<VerificationProgress | null>(null);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [browserEvidence, setBrowserEvidence] = useState<BrowserEvidenceRecord | null>(null);
  const [browserEvidenceBusy, setBrowserEvidenceBusy] = useState(false);
  const [timelineState, setTimelineState] = useState<TimelineState | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineBusy, setTimelineBusy] = useState(false);
  const [timelineDiff, setTimelineDiff] = useState<TimelineDiff | null>(null);
  const [promptQueueState, setPromptQueueState] = useState<PromptQueueState | null>(null);
  const [queueDispatching, setQueueDispatching] = useState(false);
  const [queueFailureOverride, setQueueFailureOverride] = useState<number | null>(null);
  const [freshReview, setFreshReview] = useState<FreshReviewRecord | null>(null);
  const [freshReviewRunning, setFreshReviewRunning] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const handledCompletionSerial = useRef(0);
  const handledTurnSerial = useRef(0);
  const verificationProjectId = useRef<string | null>(null);
  const timelineProjectId = useRef<string | null>(null);
  const activeProjectIdRef = useRef<string | null>(null);

  const project = workspace.project;
  const selectedScript = projectScript(project);

  useEffect(() => subscribePreviewSelection(setSelection), []);
  useEffect(() => subscribeVerification(setVerificationProgress), []);
  useEffect(() => subscribeBrowserEvidence(setBrowserEvidence), []);

  useEffect(() => {
    activeProjectIdRef.current = project?.id ?? null;
  }, [project?.id]);

  useEffect(() => {
    if (!project) return;
    const blocked = sending
      || queueDispatching
      || verificationBusy
      || timelineBusy
      || browserEvidenceBusy
      || freshReviewRunning
      || workspace.codexState === 'busy'
      || workspace.codexState === 'approval';
    setSourceTransactionOrchestrationBlocked(project.id, blocked);
    return () => setSourceTransactionOrchestrationBlocked(project.id, false);
  }, [browserEvidenceBusy, freshReviewRunning, project?.id, queueDispatching, sending, timelineBusy, verificationBusy, workspace.codexState]);

  useEffect(() => {
    if (!project) {
      setPromptQueueState(null);
      return;
    }
    const unsubscribe = subscribePromptQueue(project.id, setPromptQueueState);
    void loadPromptQueue(project.id, true).catch((error) => {
      setNotice(`Prompt queue unavailable: ${error instanceof Error ? error.message : String(error)}`);
    });
    return unsubscribe;
  }, [project?.id]);

  useEffect(() => {
    if (!project) {
      setFreshReview(null);
      return;
    }
    const unsubscribe = subscribeFreshReview(project.id, setFreshReview);
    void restoreFreshReview(project.id);
    return unsubscribe;
  }, [project?.id]);

  const clearSelection = useCallback(() => setPreviewSelection(null), []);

  const refreshProjectSnapshot = useCallback(async (rootPath: string, projectId: string) => {
    const refreshed = await inspectProject(rootPath).catch(() => null);
    if (!refreshed) return;
    setWorkspace((current) => current.project?.id === projectId ? { ...current, project: refreshed } : current);
  }, []);

  const refreshTimeline = useCallback(async (target: ProjectInspection) => {
    const next = await prepareTimeline(target);
    setTimelineState(next);
    return next;
  }, []);

  const applyProject = useCallback(async (next: ProjectInspection) => {
    clearSelection();
    setTimelineOpen(false);
    setShipOpen(false);
    setTimelineDiff(null);
    setTimelineState(null);
    setPromptQueueState(null);
    setFreshReview(null);
    setQueueFailureOverride(null);
    setWorkspace((current) => ({ ...current, project: next }));
    setRuntimeUrl(null);
    setRuntimeLines([]);
    setRuntimeRunning(false);
    await stateSet('lastProjectPath', next.rootPath).catch(() => undefined);
    await codex.refreshThreads(next.rootPath).catch(() => undefined);
    void refreshTimeline(next).catch((error) => {
      setNotice(`Version history unavailable: ${error instanceof Error ? error.message : String(error)}`);
    });
  }, [clearSelection, codex, refreshTimeline]);

  useEffect(() => codex.subscribe((snapshot) => {
    setWorkspace((current) => ({
      ...current,
      activeThreadId: snapshot.activeThreadId,
      threads: snapshot.threads,
      codexState: snapshot.state,
      codexMessage: snapshot.message,
      turnSerial: snapshot.turnSerial,
      completionSerial: snapshot.completionSerial,
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
    if (!project) {
      verificationProjectId.current = null;
      timelineProjectId.current = null;
      setVerificationProgress(null);
      setBrowserEvidence(null);
      setTimelineState(null);
      setTimelineDiff(null);
      setFreshReview(null);
      return;
    }
    verificationProjectId.current = project.id;
    timelineProjectId.current = project.id;
    handledCompletionSerial.current = workspace.completionSerial;
    handledTurnSerial.current = workspace.turnSerial;
    void restoreVerification(project.id);
    void restoreBrowserEvidence(project.id);
    void restoreFreshReview(project.id);
    void refreshTimeline(project).catch((error) => {
      setNotice(`Version history unavailable: ${error instanceof Error ? error.message : String(error)}`);
    });
  }, [project?.id, project?.rootPath, refreshTimeline]);

  useEffect(() => {
    if (!project || workspace.turnSerial <= handledTurnSerial.current) return;
    handledTurnSerial.current = workspace.turnSerial;
    void markBrowserEvidenceStale(project.id);
    if (runtimeUrl) void clearBrowserEvidenceBuffer().catch(() => undefined);
  }, [project?.id, runtimeUrl, workspace.turnSerial]);

  useEffect(() => {
    if (!project || verificationProjectId.current !== project.id || verificationBusy || timelineBusy) return;
    if (workspace.completionSerial <= handledCompletionSerial.current) return;
    const targetSerial = workspace.completionSerial;
    const projectId = project.id;
    const projectRoot = project.rootPath;
    const turnSerial = workspace.turnSerial;
    const threadId = workspace.activeThreadId;
    const timer = window.setTimeout(() => {
      setVerificationBusy(true);
      setTimelineBusy(true);
      void (async () => {
        try {
          try {
            await checkpointCompletedTurn({
              project,
              codexThreadId: threadId,
              codexTurnId: null,
              turnSerial,
            });
            if (timelineProjectId.current === projectId) {
              await refreshTimeline(project);
            }
          } catch (error) {
            setNotice(`Could not save this version: ${error instanceof Error ? error.message : String(error)}`);
          } finally {
            setTimelineBusy(false);
          }

          await runVerification({ projectId, projectRoot, trigger: 'codex-turn', turnSerial });
          await refreshProjectSnapshot(projectRoot, projectId);
          if (runtimeUrl) {
            await new Promise((resolve) => window.setTimeout(resolve, 650));
            setBrowserEvidenceBusy(true);
            try {
              await captureBrowserEvidence(projectId, turnSerial);
            } catch {
              // Browser evidence is an independent evidence class; deterministic checks remain valid.
            } finally {
              setBrowserEvidenceBusy(false);
            }
          }
        } finally {
          handledCompletionSerial.current = Math.max(handledCompletionSerial.current, targetSerial);
          setVerificationBusy(false);
          setTimelineBusy(false);
        }
      })();
    }, 220);
    return () => window.clearTimeout(timer);
  }, [project, refreshProjectSnapshot, refreshTimeline, runtimeUrl, timelineBusy, verificationBusy, workspace.activeThreadId, workspace.completionSerial, workspace.turnSerial]);

  useEffect(() => {
    if (!project) return;
    const onSourceTransaction = (event: Event) => {
      const detail = (event as CustomEvent<SourceTransactionEventDetail>).detail;
      if (!detail || detail.projectId !== project.id || !Number.isFinite(detail.turnSerial) || detail.turnSerial === 0) return;
      const projectId = project.id;
      const projectRoot = project.rootPath;
      const turnSerial = Math.trunc(detail.turnSerial);
      beginSourceTransactionValidation(projectId);
      setShipOpen(false);
      setFreshReview(null);
      setQueueFailureOverride(null);
      setTimelineBusy(true);
      setVerificationBusy(true);
      void (async () => {
        try {
          await refreshTimeline(project);
          setTimelineBusy(false);
          await runVerification({ projectId, projectRoot, trigger: 'visual-edit', turnSerial });
          await refreshProjectSnapshot(projectRoot, projectId);
          if (runtimeUrl && activeProjectIdRef.current === projectId) {
            await clearBrowserEvidenceBuffer().catch(() => undefined);
            await new Promise((resolve) => window.setTimeout(resolve, 650));
            setBrowserEvidenceBusy(true);
            try {
              await captureBrowserEvidence(projectId, turnSerial);
            } catch {
              // Browser evidence remains independently stale/absent if the live capture fails.
            } finally {
              setBrowserEvidenceBusy(false);
            }
          }
        } catch (error) {
          setNotice(`Visual edit post-check failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
          endSourceTransactionValidation(projectId);
          setVerificationBusy(false);
          setTimelineBusy(false);
        }
      })();
    };
    window.addEventListener('monument:source-transaction', onSourceTransaction);
    return () => window.removeEventListener('monument:source-transaction', onSourceTransaction);
  }, [project, refreshProjectSnapshot, refreshTimeline, runtimeUrl]);

  useEffect(() => {
    if (!native) return;
    let disposed = false;
    const disposers: Array<() => void> = [];

    void (async () => {
      disposers.push(await listenNative<RuntimeOutput>('monument://runtime-output', (line) => {
        if (!disposed) setRuntimeLines((current) => [...current, line].slice(-180));
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
    if (!native || opening || sending || queueDispatching || verificationBusy || timelineBusy || freshReviewRunning || workspace.codexState === 'busy' || workspace.codexState === 'approval') return;
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
  }, [applyProject, freshReviewRunning, native, opening, queueDispatching, runtimeRunning, sending, timelineBusy, verificationBusy, workspace.codexState]);

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
    clearSelection();
    await invokeNative<void>('preview_close').catch(() => undefined);
    await stopRuntime().catch(() => undefined);
    setRuntimeRunning(false);
    setRuntimeStarting(false);
    setRuntimeUrl(null);
  }, [clearSelection]);

  const refreshPreview = useCallback(async () => {
    if (!runtimeUrl) return;
    clearSelection();
    if (native) {
      try {
        await invokeNative<void>('preview_reload');
      } catch {
        setPreviewKey((value) => value + 1);
      }
    } else {
      setPreviewKey((value) => value + 1);
    }
  }, [clearSelection, native, runtimeUrl]);

  const postTurnPending = workspace.completionSerial > handledCompletionSerial.current;
  const canExecutePromptNow = Boolean(
    project
    && workspace.codexState === 'ready'
    && !sending
    && !timelineBusy
    && !verificationBusy
    && !browserEvidenceBusy
    && !freshReviewRunning
    && !postTurnPending,
  );

  const executePrompt = useCallback(async (
    text: string,
    capturedSelection: PreviewSelection | null,
    clearLiveSelection: boolean,
  ): Promise<boolean> => {
    if (!project || workspace.codexState !== 'ready' || sending) return false;
    setSending(true);
    setTimelineBusy(true);
    setShipOpen(false);
    setNotice(null);
    try {
      const prepared = await prepareTimeline(project);
      setTimelineState(prepared);
      rememberTimelinePrompt(project.id, text);
      const turnText = await compileTurnText(text, project.rootPath, capturedSelection);
      await codex.send(turnText, project.rootPath);
      if (clearLiveSelection) clearSelection();
      return true;
    } catch (error) {
      forgetTimelinePrompt(project.id);
      setNotice(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setSending(false);
      setTimelineBusy(false);
    }
  }, [clearSelection, codex, project, sending, workspace.codexState]);

  const submitPrompt = useCallback(async () => {
    const text = prompt.trim();
    if (!text || !project) return;
    setShipOpen(false);
    if (workspace.codexState === 'auth-required' || workspace.codexState === 'approval') return;
    if (workspace.codexState === 'error' || workspace.codexState === 'idle') {
      setNotice('Codex is not ready. Resolve the connection before adding work.');
      return;
    }

    const capturedSelection = getPreviewSelection();
    const hasPendingQueue = Boolean(promptQueueState?.items.length || queueDispatching);
    const shouldQueue = !canExecutePromptNow || hasPendingQueue;
    if (shouldQueue) {
      try {
        await enqueuePrompt(project.id, text, capturedSelection, workspace.activeThreadId);
        setPrompt('');
        clearSelection();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : String(error));
      }
      return;
    }

    setPrompt('');
    if (!(await executePrompt(text, capturedSelection, true))) setPrompt(text);
  }, [canExecutePromptNow, clearSelection, executePrompt, project, prompt, promptQueueState?.items.length, queueDispatching, workspace.activeThreadId, workspace.codexState]);

  const startNewTask = useCallback(() => {
    codex.newTask();
    setPrompt('');
    setShipOpen(false);
    clearSelection();
    if (project) void detachPromptQueueThreads(project.id);
  }, [clearSelection, codex, project]);

  const selectTask = useCallback((threadId: string) => {
    codex.selectThread(threadId);
    setShipOpen(false);
    if (project && promptQueueState?.items.length) void setPromptQueuePaused(project.id, true);
  }, [codex, project, promptQueueState?.items.length]);

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

  const runAllChecks = useCallback(async () => {
    if (!project || verificationBusy) return;
    setVerificationBusy(true);
    setShipOpen(false);
    setDeveloperOpen(true);
    setTimelineOpen(false);
    setDeveloperTab('evidence');
    try {
      await runVerification({ projectId: project.id, projectRoot: project.rootPath, trigger: 'manual', includeManual: true, turnSerial: workspace.turnSerial });
      await refreshProjectSnapshot(project.rootPath, project.id);
    } finally {
      setVerificationBusy(false);
    }
  }, [project, refreshProjectSnapshot, verificationBusy, workspace.turnSerial]);

  const captureBrowserNow = useCallback(async () => {
    if (!project || !runtimeUrl || browserEvidenceBusy) return;
    setBrowserEvidenceBusy(true);
    setShipOpen(false);
    setDeveloperOpen(true);
    setTimelineOpen(false);
    setDeveloperTab('evidence');
    try {
      await captureBrowserEvidence(project.id, workspace.turnSerial);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBrowserEvidenceBusy(false);
    }
  }, [browserEvidenceBusy, project, runtimeUrl, workspace.turnSerial]);

  const runFreshReviewNow = useCallback(async () => {
    if (!project || freshReviewRunning || timelineBusy || verificationBusy || browserEvidenceBusy || postTurnPending || workspace.codexState !== 'ready') return;
    setFreshReviewRunning(true);
    setDeveloperOpen(false);
    setTimelineOpen(false);
    setShipOpen(true);
    setNotice(null);
    try {
      const record = await runFreshReview(project);
      setFreshReview(record);
      if (record.status === 'error') setNotice(record.error || 'Fresh Review could not complete.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setFreshReviewRunning(false);
    }
  }, [browserEvidenceBusy, freshReviewRunning, postTurnPending, project, timelineBusy, verificationBusy, workspace.codexState]);

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

  const applyTimelineRestore = useCallback(async (result: TimelineRestoreResult) => {
    if (!project) return;
    setTimelineState(result.state);
    setTimelineDiff(null);
    setShipOpen(false);
    clearSelection();
    setQueueFailureOverride(null);
    await detachPromptQueueThreads(project.id).catch(() => undefined);
    await markBrowserEvidenceStale(project.id).catch(() => undefined);
    if (runtimeUrl) await clearBrowserEvidenceBuffer().catch(() => undefined);
    await refreshProjectSnapshot(project.rootPath, project.id);
    if (runtimeUrl) await refreshPreview().catch(() => undefined);
    setNotice(result.safetyCheckpoint
      ? 'Current changes were saved as a safety version before restoring. Pending prompts were paused and detached from the old task.'
      : `Restored ${result.target.title}. Later versions are still available; pending prompts are paused until you resume them.`);
  }, [clearSelection, project, refreshPreview, refreshProjectSnapshot, runtimeUrl]);

  const restoreVersion = useCallback(async (checkpointId: string) => {
    if (!project || timelineBusy || verificationBusy || freshReviewRunning || sending || workspace.codexState === 'busy' || workspace.codexState === 'approval') return;
    setTimelineBusy(true);
    setNotice(null);
    try {
      await applyTimelineRestore(await restoreTimelineVersion(project, checkpointId));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setTimelineBusy(false);
    }
  }, [applyTimelineRestore, freshReviewRunning, project, sending, timelineBusy, verificationBusy, workspace.codexState]);

  const goTimelineBack = useCallback(async () => {
    if (!project || !timelineState?.canBack || timelineBusy || verificationBusy || freshReviewRunning || sending || workspace.codexState !== 'ready') return;
    setTimelineBusy(true);
    setNotice(null);
    try {
      await applyTimelineRestore(await backTimeline(project));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setTimelineBusy(false);
    }
  }, [applyTimelineRestore, freshReviewRunning, project, sending, timelineBusy, timelineState?.canBack, verificationBusy, workspace.codexState]);

  const goTimelineForward = useCallback(async () => {
    if (!project || !timelineState?.forwardCheckpointId || timelineBusy || verificationBusy || freshReviewRunning || sending || workspace.codexState !== 'ready') return;
    setTimelineBusy(true);
    setNotice(null);
    try {
      await applyTimelineRestore(await forwardTimeline(project));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setTimelineBusy(false);
    }
  }, [applyTimelineRestore, freshReviewRunning, project, sending, timelineBusy, timelineState?.forwardCheckpointId, verificationBusy, workspace.codexState]);

  const saveVersion = useCallback(async () => {
    if (!project || timelineBusy || verificationBusy || freshReviewRunning || sending || workspace.codexState !== 'ready') return;
    setTimelineBusy(true);
    setNotice(null);
    try {
      await saveTimelineVersion(project);
      await refreshTimeline(project);
      setNotice('Version saved.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setTimelineBusy(false);
    }
  }, [freshReviewRunning, project, refreshTimeline, sending, timelineBusy, verificationBusy, workspace.codexState]);

  const compareVersion = useCallback(async (checkpointId: string) => {
    if (!project || !timelineState || timelineBusy) return;
    setTimelineBusy(true);
    try {
      setTimelineDiff(await compareTimelineVersions(project, checkpointId, timelineState.currentCheckpointId));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setTimelineBusy(false);
    }
  }, [project, timelineBusy, timelineState]);

  const openTimeline = useCallback(async () => {
    if (!project) return;
    setDeveloperOpen(false);
    setShipOpen(false);
    setTimelineOpen(true);
    setTimelineDiff(null);
    try {
      await refreshTimeline(project);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }, [project, refreshTimeline]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey || event.key.toLowerCase() !== 'z' || editableTarget(event.target)) return;
      if (!project || sending || timelineBusy || verificationBusy || freshReviewRunning || workspace.codexState !== 'ready') return;
      event.preventDefault();
      if (event.shiftKey) void goTimelineForward();
      else void goTimelineBack();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [freshReviewRunning, goTimelineBack, goTimelineForward, project, sending, timelineBusy, verificationBusy, workspace.codexState]);

  const currentTimelineCheckpoint = timelineState?.checkpoints.find((checkpoint) => checkpoint.id === timelineState.currentCheckpointId) ?? null;
  const currentCodeTurnSerial = timelineState
    ? (timelineState.dirty ? null : currentTimelineCheckpoint?.turnSerial ?? null)
    : workspace.turnSerial;
  const deterministicEvidenceStale = Boolean(verificationProgress && (
    currentCodeTurnSerial == null
    || verificationProgress.evidence.turnSerial !== currentCodeTurnSerial
    || timelineBusy
    || workspace.codexState === 'busy'
    || workspace.codexState === 'approval'
  ));
  const browserEvidenceStale = Boolean(browserEvidence && (
    browserEvidence.stale
    || currentCodeTurnSerial == null
    || browserEvidence.capturedForTurnSerial !== currentCodeTurnSerial
    || timelineBusy
    || workspace.codexState === 'busy'
    || workspace.codexState === 'approval'
  ));
  const verificationStatus = deterministicEvidenceStale && verificationProgress ? 'Checks stale' : verificationLabel(verificationProgress);
  const timelineInteractionBusy = timelineBusy || verificationBusy || freshReviewRunning || sending || queueDispatching || workspace.codexState === 'busy' || workspace.codexState === 'approval';
  const currentVersionLabel = currentTimelineCheckpoint
    ? (currentTimelineCheckpoint.kind === 'baseline' ? 'Original' : `V${currentTimelineCheckpoint.sequence}`)
    : null;
  const deterministicQueueBlock = Boolean(
    verificationProgress
    && !deterministicEvidenceStale
    && (verificationProgress.evidence.status === 'failed' || verificationProgress.evidence.status === 'error'),
  );
  const browserQueueBlock = Boolean(browserEvidence && !browserEvidenceStale && browserEvidenceHasIssues(browserEvidence));
  const queueFailureBypassed = currentCodeTurnSerial != null && queueFailureOverride === currentCodeTurnSerial;
  const queueBlockedByEvidence = (deterministicQueueBlock || browserQueueBlock) && !queueFailureBypassed;
  const promptWillQueue = Boolean(
    project
    && prompt.trim()
    && (!canExecutePromptNow || queueDispatching || (promptQueueState?.items.length ?? 0) > 0),
  );
  const shipGate = useMemo(() => evaluateShipGate({
    project,
    timeline: timelineState,
    verification: verificationProgress,
    browser: browserEvidence,
    review: freshReview,
    queue: promptQueueState,
    workspace,
    browserRequired: Boolean(selectedScript),
    runtimeAvailable: Boolean(runtimeUrl),
    postTurnPending,
    verificationBusy,
    browserBusy: browserEvidenceBusy,
    timelineBusy,
    reviewBusy: freshReviewRunning,
  }), [
    browserEvidence,
    browserEvidenceBusy,
    freshReview,
    freshReviewRunning,
    postTurnPending,
    project,
    promptQueueState,
    runtimeUrl,
    selectedScript,
    timelineBusy,
    timelineState,
    verificationBusy,
    verificationProgress,
    workspace,
  ]);

  useEffect(() => {
    setQueueFailureOverride(null);
  }, [currentCodeTurnSerial]);

  useEffect(() => {
    if (!project || !promptQueueState?.items.length || promptQueueState.paused || queueDispatching) return;
    if (queueBlockedByEvidence || !canExecutePromptNow || postTurnPending) return;
    const projectId = project.id;
    setQueueDispatching(true);
    void (async () => {
      let item: QueuedPrompt | null = null;
      try {
        const taken = await takeNextPrompt(projectId);
        item = taken.item;
        if (!item) return;
        if (activeProjectIdRef.current !== projectId) {
          await restoreQueuedPromptToFront(projectId, item);
          return;
        }
        if (item.threadId) codex.selectThread(item.threadId);
        const success = await executePrompt(item.text, item.selection, false);
        if (!success) await restoreQueuedPromptToFront(projectId, item);
      } catch (error) {
        if (item) await restoreQueuedPromptToFront(projectId, item).catch(() => undefined);
        setNotice(error instanceof Error ? error.message : String(error));
      } finally {
        setQueueDispatching(false);
      }
    })();
  }, [canExecutePromptNow, codex, executePrompt, postTurnPending, project, promptQueueState?.items.length, promptQueueState?.paused, queueBlockedByEvidence, queueDispatching]);

  const toggleQueuePause = useCallback(() => {
    if (!project || !promptQueueState) return;
    void setPromptQueuePaused(project.id, !promptQueueState.paused);
  }, [project, promptQueueState]);

  const continueQueueAnyway = useCallback(() => {
    if (!project || currentCodeTurnSerial == null) return;
    setQueueFailureOverride(currentCodeTurnSerial);
    void setPromptQueuePaused(project.id, false);
  }, [currentCodeTurnSerial, project]);

  const moveQueueItem = useCallback((itemId: string, direction: -1 | 1) => {
    if (!project) return;
    void moveQueuedPrompt(project.id, itemId, direction);
  }, [project]);

  const removeQueueItem = useCallback((itemId: string) => {
    if (!project) return;
    void removeQueuedPrompt(project.id, itemId);
  }, [project]);

  return (
    <div className="monument-app">
      <header className="topbar" data-tauri-drag-region>
        <div className="window-space" data-tauri-drag-region />
        <button className="brand-button" type="button" onClick={() => { setDeveloperOpen(false); setTimelineOpen(false); setShipOpen(false); }}>Monument</button>
        <button className="project-switcher" type="button" onClick={chooseProject} disabled={!native || opening || sending || queueDispatching || timelineBusy || verificationBusy || freshReviewRunning || workspace.codexState === 'busy' || workspace.codexState === 'approval'}>
          <span className="project-indicator" /><span>{project?.name ?? 'Open project'}</span><span className="chevron">⌄</span>
        </button>
        {project?.git.branch ? <span className="branch-label">{project.git.branch}</span> : null}
        {project ? (
          <div className="history-controls">
            <button type="button" disabled={timelineInteractionBusy || !timelineState?.canBack} onClick={() => void goTimelineBack()} title="Previous version (⌘Z)">←</button>
            <button type="button" disabled={timelineInteractionBusy || !timelineState?.forwardCheckpointId} onClick={() => void goTimelineForward()} title="Next version (⇧⌘Z)">→</button>
            <button type="button" className={timelineOpen ? 'active' : ''} onClick={() => void openTimeline()}>{currentVersionLabel ? `Versions · ${currentVersionLabel}` : 'Versions'}</button>
          </div>
        ) : null}
        <div className="topbar-spacer" />
        {verificationStatus ? <button className={`verification-chip ${deterministicEvidenceStale ? 'stale' : verificationProgress?.evidence.status ?? ''}`} type="button" onClick={() => { setTimelineOpen(false); setShipOpen(false); setDeveloperOpen(true); setDeveloperTab('evidence'); }}>{verificationStatus}</button> : null}
        <div className={`codex-status ${workspace.codexState}`}><span />{statusText(workspace.codexState)}</div>
        {workspace.codexState === 'auth-required' ? <button className="auth-button" type="button" disabled={authStarting} onClick={() => void startSignIn()}>{authStarting ? 'Opening…' : 'Sign in'}</button> : null}
        <button className="quiet-button" type="button" onClick={() => { setTimelineOpen(false); setShipOpen(false); setDeveloperOpen((value) => !value); }}>Under the hood</button>
        <button className={`ship-button ${shipGate.ready ? 'ready' : ''}`} type="button" onClick={() => { setTimelineOpen(false); setDeveloperOpen(false); setShipOpen((value) => !value); }} title={shipGate.ready ? 'Current version passed the Ship gate' : `${shipGate.blockingCount} Ship gate${shipGate.blockingCount === 1 ? '' : 's'} remaining`}>
          {shipGate.ready ? 'Ship ✓' : 'Ship'}
        </button>
      </header>

      <div className="product-layout">
        <aside className="task-rail">
          <div className="rail-heading"><span>Tasks</span><button type="button" className="mini-button" onClick={startNewTask}>＋</button></div>
          <div className="task-list">
            <button type="button" className={`task-item ${workspace.activeThreadId === null ? 'active' : ''}`} onClick={startNewTask}>
              <span className="task-dot new" /><span><strong>New task</strong><small>Describe what should change</small></span>
            </button>
            {workspace.threads.map((thread) => (
              <button type="button" className={`task-item ${workspace.activeThreadId === thread.id ? 'active' : ''}`} key={thread.id} onClick={() => selectTask(thread.id)}>
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
            {runtimeUrl ? <button type="button" className="icon-text" onClick={() => void refreshPreview()}>↻ Refresh</button> : null}
            {runtimeRunning ? <button type="button" className="icon-text" onClick={() => void stopPreview()}>Stop</button> : null}
          </div>

          <div className="canvas-stage">
            {!project ? (
              <div className="empty-product">
                <div className="empty-mark">M</div><h1>Build by describing.</h1>
                <p>Open a real project. Monument will understand the repository, connect Codex, run the product and keep the engineering machinery out of your way.</p>
                <button type="button" className="primary-action" onClick={chooseProject} disabled={!native || opening}>{opening ? 'Opening…' : 'Open project'}</button>
                {!native ? <small>Launch the native Monument app to access local projects.</small> : null}
              </div>
            ) : runtimeUrl ? (
              <div className={`preview-shell ${viewport}`}>
                <NativePreview key={previewKey} url={runtimeUrl} viewport={viewport} onError={setNotice} />
              </div>
            ) : (
              <div className="runtime-ready">
                <div className="project-avatar">{project.name.slice(0, 1).toUpperCase()}</div><h2>{project.name}</h2>
                <p>{project.framework || 'Project'} is ready. Start its real local runtime to work directly on the live product.</p>
                <div className="fact-pills">
                  {project.framework ? <span>{project.framework}</span> : null}{project.packageManager ? <span>{project.packageManager}</span> : null}{project.git.branch ? <span>{project.git.branch}</span> : null}
                </div>
                {selectedScript ? <button type="button" className="primary-action" onClick={launchPreview} disabled={runtimeStarting}>{runtimeStarting ? 'Starting preview…' : `Start ${project.suggestedDevCommand || selectedScript}`}</button> : <div className="soft-warning">No dev/start/preview script was detected. You can still use Codex and inspect the repository.</div>}
              </div>
            )}
            {notice ? <div className="notice"><strong>Monument</strong><span>{notice}</span><button type="button" onClick={() => setNotice(null)}>×</button></div> : null}
          </div>

          <div className="prompt-dock">
            {workspace.codexState === 'auth-required' ? (
              <div className="auth-card"><div><strong>Connect Codex</strong><span>{workspace.account?.email || 'ChatGPT sign-in is required before Monument can build.'}</span></div><button type="button" disabled={authStarting} onClick={() => void startSignIn()}>{authStarting ? 'Opening…' : 'Sign in with ChatGPT'}</button></div>
            ) : null}
            {workspace.approval ? <ApprovalCard approval={workspace.approval} answers={userAnswers} busy={approvalBusy} onAnswers={setUserAnswers} onDecision={(decision) => void resolveApproval(decision)} onSubmitAnswers={() => void submitAnswers()} /> : null}
            {workspace.codexMessage ? <div className="codex-live"><span>Codex</span><p>{workspace.codexMessage}</p></div> : null}
            <PromptQueue
              state={promptQueueState}
              dispatching={queueDispatching}
              blockedByEvidence={queueBlockedByEvidence}
              onTogglePause={toggleQueuePause}
              onContinueAnyway={continueQueueAnyway}
              onMove={moveQueueItem}
              onRemove={removeQueueItem}
            />
            <div className="composer">
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && project && workspace.codexState !== 'approval' && workspace.codexState !== 'auth-required') {
                    event.preventDefault(); void submitPrompt();
                  }
                }}
                placeholder={project ? (workspace.codexState === 'auth-required' ? 'Sign in to Codex to start building…' : workspace.approval ? 'Resolve the request above to continue…' : workspace.codexState === 'busy' || postTurnPending || verificationBusy || timelineBusy || browserEvidenceBusy || freshReviewRunning ? (selection ? 'Describe the next change for the selected element…' : 'Add the next change…') : selection ? 'Tell Monument what to change about the selected element…' : 'Tell Monument what to build or change…') : 'Open a project to start building…'}
                disabled={!project || workspace.codexState === 'approval' || workspace.codexState === 'auth-required'}
              />
              <div className="composer-footer">
                <div className="context-row">
                  {project ? <span className="context-chip">◎ {project.name}</span> : null}
                  {runtimeUrl ? <span className="context-chip">● Live preview</span> : null}
                  {selection ? <span className="context-chip selected-context" title={selection.selector}>⌖ {selectionLabel(selection)} <button type="button" onClick={clearSelection}>×</button></span> : null}
                  {currentVersionLabel ? <span className="context-chip">History · {currentVersionLabel}</span> : null}
                  {(promptQueueState?.items.length ?? 0) > 0 ? <span className="context-chip">Next · {promptQueueState?.items.length}</span> : null}
                  {verificationStatus ? <span className={`context-chip verification-context ${deterministicEvidenceStale ? 'stale' : verificationProgress?.evidence.status ?? ''}`}>{verificationStatus}</span> : null}
                  {freshReview && freshReview.checkpointId === currentTimelineCheckpoint?.id ? <span className={`context-chip review-context ${freshReview.status}`}>Review · {freshReview.status}</span> : null}
                  {workspace.account?.planType ? <span className="context-chip">Codex · {workspace.account.planType}</span> : null}
                </div>
                <div className="composer-actions">
                  {promptWillQueue ? <button type="button" className="queue-button" onClick={() => void submitPrompt()}>＋ Queue</button> : null}
                  {workspace.codexState === 'busy' ? <button type="button" className="send-button stop-button" onClick={() => void codex.interrupt()} title="Stop Codex">■</button> : !promptWillQueue ? <button type="button" className="send-button" onClick={() => void submitPrompt()} disabled={!project || !prompt.trim() || sending || !canExecutePromptNow}>{sending ? '…' : '↑'}</button> : null}
                </div>
              </div>
            </div>
          </div>
        </main>

        {developerOpen ? (
          <aside className="developer-panel">
            <div className="developer-tabs">
              {(['activity', 'files', 'runtime', 'evidence', 'diagnostics'] as DeveloperTab[]).map((tab) => <button type="button" key={tab} className={developerTab === tab ? 'active' : ''} onClick={() => setDeveloperTab(tab)}>{tab}</button>)}
              <button type="button" className="close-dev" onClick={() => setDeveloperOpen(false)}>×</button>
            </div>
            <div className="developer-body">
              {developerTab === 'activity' ? (workspace.activity.length ? workspace.activity.slice().reverse().map((item) => <div className={`activity-item ${item.kind}`} key={item.id}><strong>{item.title}</strong>{item.detail ? <span>{item.detail}</span> : null}</div>) : <div className="panel-empty">Real Codex activity will appear here.</div>) : null}
              {developerTab === 'files' ? (project ? <FileTree nodes={project.files} /> : <div className="panel-empty">Open a project to inspect real files.</div>) : null}
              {developerTab === 'runtime' ? (runtimeLines.length ? runtimeLines.map((line, index) => <div className={`runtime-line ${line.stream}`} key={`${index}-${line.line}`}><span>{line.stream === 'stderr' ? '!' : '›'}</span>{line.line}</div>) : <div className="panel-empty">Runtime output will appear after the local preview starts.</div>) : null}
              {developerTab === 'evidence' ? <>
                <EvidencePanel progress={verificationProgress} manualRunning={verificationBusy} stale={deterministicEvidenceStale} onRunAll={() => void runAllChecks()} />
                <BrowserEvidencePanel record={browserEvidence ? { ...browserEvidence, stale: browserEvidenceStale } : null} running={browserEvidenceBusy} previewAvailable={Boolean(runtimeUrl)} onCapture={() => void captureBrowserNow()} />
              </> : null}
              {developerTab === 'diagnostics' ? <DiagnosticsPanel running={diagnosticsRunning} runtimeInfo={codexRuntimeInfo} protocol={protocolProbe} account={workspace.account} onRun={() => void runDiagnostics()} /> : null}
            </div>
          </aside>
        ) : null}

        {timelineOpen && project ? (
          <VersionTimelinePanel
            state={timelineState}
            busy={timelineInteractionBusy}
            diff={timelineDiff}
            onClose={() => setTimelineOpen(false)}
            onBack={() => void goTimelineBack()}
            onForward={() => void goTimelineForward()}
            onSave={() => void saveVersion()}
            onRestore={(checkpointId) => void restoreVersion(checkpointId)}
            onCompare={(checkpointId) => void compareVersion(checkpointId)}
          />
        ) : null}

        {shipOpen ? (
          <ShipPanel
            gate={shipGate}
            review={freshReview}
            reviewRunning={freshReviewRunning}
            onClose={() => setShipOpen(false)}
            onRunChecks={() => { setShipOpen(false); void runAllChecks(); }}
            onCaptureBrowser={() => { setShipOpen(false); void captureBrowserNow(); }}
            onRunReview={() => void runFreshReviewNow()}
            onOpenQueue={() => setShipOpen(false)}
            onReviewChange={setFreshReview}
          />
        ) : null}
      </div>
    </div>
  );
}
