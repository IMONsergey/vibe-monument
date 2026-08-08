import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserEvidencePanel } from '../components/BrowserEvidencePanel';
import { ShipPanel } from '../components/ShipPanel';
import {
  captureBrowserEvidence,
  restoreBrowserEvidence,
  subscribeBrowserEvidence,
  type BrowserEvidenceRecord,
} from '../browser/evidence';
import {
  inspectProject,
  isNativeHost,
  listenNative,
  runtimeStatus,
  stateGet,
} from '../host/native';
import {
  loadPromptQueue,
  subscribePromptQueue,
  type PromptQueueState,
} from '../queue/controller';
import {
  restoreFreshReview,
  runFreshReview,
  subscribeFreshReview,
  type FreshReviewRecord,
} from './controller';
import { evaluateShipGate } from '../ship/controller';
import { prepareTimeline } from '../timeline/controller';
import type { TimelineState } from '../timeline/types';
import type {
  ApprovalRequest,
  CodexConnectionState,
  ProjectInspection,
} from '../types';
import {
  restoreVerification,
  runVerification,
  subscribeVerification,
  type VerificationProgress,
} from '../verification/controller';

type CodexMessage = {
  id?: string | number;
  method?: string;
  params?: unknown;
};

const EMPTY_QUEUE: PromptQueueState = { projectId: '', paused: false, items: [] };

function shellCodexState(): CodexConnectionState {
  if (typeof document === 'undefined') return 'idle';
  const element = document.querySelector('.codex-status');
  if (!(element instanceof HTMLElement)) return 'idle';
  for (const state of ['approval', 'busy', 'ready', 'auth-required', 'starting', 'reconnecting', 'error', 'idle'] as CodexConnectionState[]) {
    if (element.classList.contains(state)) return state;
  }
  return 'idle';
}

function approvalPlaceholder(message: CodexMessage): ApprovalRequest {
  return {
    id: message.id ?? 'ship-layer-approval',
    method: message.method ?? 'approval',
    kind: 'unknown',
    params: {},
    availableDecisions: [],
  };
}

export function ReviewShipLayer() {
  const native = isNativeHost();
  const [open, setOpen] = useState(false);
  const [project, setProject] = useState<ProjectInspection | null>(null);
  const [timeline, setTimeline] = useState<TimelineState | null>(null);
  const [verification, setVerification] = useState<VerificationProgress | null>(null);
  const [browser, setBrowser] = useState<BrowserEvidenceRecord | null>(null);
  const [review, setReview] = useState<FreshReviewRecord | null>(null);
  const [queue, setQueue] = useState<PromptQueueState | null>(null);
  const [codexState, setCodexState] = useState<CodexConnectionState>('idle');
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const [runtimeAvailable, setRuntimeAvailable] = useState(false);
  const [timelineBusy, setTimelineBusy] = useState(false);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [browserBusy, setBrowserBusy] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadCurrentProject = useCallback(async () => {
    if (!native) return null;
    const path = await stateGet<string>('lastProjectPath').catch(() => null);
    if (!path) {
      setProject(null);
      setTimeline(null);
      return null;
    }
    const next = await inspectProject(path).catch(() => null);
    setProject(next);
    return next;
  }, [native]);

  const refreshTimeline = useCallback(async (target: ProjectInspection | null = project) => {
    if (!target) {
      setTimeline(null);
      return null;
    }
    setTimelineBusy(true);
    try {
      const next = await prepareTimeline(target);
      setTimeline(next);
      return next;
    } finally {
      setTimelineBusy(false);
    }
  }, [project]);

  const refreshSurface = useCallback(async () => {
    if (!native) return;
    setNotice(null);
    const target = project ?? await loadCurrentProject();
    if (!target) return;
    const [nextTimeline, runtime] = await Promise.all([
      refreshTimeline(target).catch((error) => {
        setNotice(`Version history unavailable: ${error instanceof Error ? error.message : String(error)}`);
        return null;
      }),
      runtimeStatus().catch(() => null),
      restoreVerification(target.id).catch(() => null),
      restoreBrowserEvidence(target.id).catch(() => null),
      restoreFreshReview(target.id).catch(() => null),
      loadPromptQueue(target.id, false).catch(() => EMPTY_QUEUE),
    ]);
    if (nextTimeline) setTimeline(nextTimeline);
    setRuntimeAvailable(Boolean(runtime?.running));
    setCodexState(shellCodexState());
  }, [loadCurrentProject, native, project, refreshTimeline]);

  useEffect(() => subscribeVerification(setVerification), []);
  useEffect(() => subscribeBrowserEvidence(setBrowser), []);

  useEffect(() => {
    if (!project) {
      setReview(null);
      setQueue(null);
      return;
    }
    const unsubscribeReview = subscribeFreshReview(project.id, setReview);
    const unsubscribeQueue = subscribePromptQueue(project.id, setQueue);
    void Promise.all([
      restoreFreshReview(project.id),
      loadPromptQueue(project.id, false),
      restoreVerification(project.id),
      restoreBrowserEvidence(project.id),
    ]).catch(() => undefined);
    return () => {
      unsubscribeReview();
      unsubscribeQueue();
    };
  }, [project?.id]);

  useEffect(() => {
    if (!native) return;
    let disposed = false;
    const disposers: Array<() => void> = [];
    void (async () => {
      disposers.push(await listenNative<string>('monument://state-changed', (key) => {
        if (key !== 'lastProjectPath' || disposed) return;
        void loadCurrentProject().then((next) => {
          if (next && !disposed) void refreshTimeline(next).catch(() => undefined);
        });
      }));
      disposers.push(await listenNative<CodexMessage>('monument://codex-message', (message) => {
        if (disposed || typeof message?.method !== 'string') return;
        const method = message.method;
        if (method === 'turn/started') {
          setCodexState('busy');
          setApproval(null);
        } else if (method === 'turn/completed') {
          setCodexState('ready');
          setApproval(null);
          window.setTimeout(() => void refreshTimeline().catch(() => undefined), 900);
        } else if (method === 'turn/failed' || method === 'error') {
          setCodexState('error');
          setApproval(null);
        } else if (method === 'serverRequest/resolved') {
          setApproval(null);
          setCodexState('busy');
        } else if (method.includes('requestApproval') || method === 'item/tool/requestUserInput' || method === 'mcpServer/elicitation/request') {
          setApproval(approvalPlaceholder(message));
          setCodexState('approval');
        }
      }));
      const initial = await loadCurrentProject();
      if (!disposed && initial) await refreshTimeline(initial).catch(() => undefined);
    })();
    return () => {
      disposed = true;
      for (const dispose of disposers) dispose();
    };
  }, [loadCurrentProject, native, refreshTimeline]);

  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return;
    const sync = () => {
      const next = shellCodexState();
      setCodexState(next);
      if (next !== 'approval') setApproval(null);
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    sync();
    return () => observer.disconnect();
  }, []);

  const currentCheckpoint = timeline?.checkpoints.find((checkpoint) => checkpoint.id === timeline.currentCheckpointId) ?? null;
  const turnSerial = currentCheckpoint?.turnSerial ?? null;
  const browserRequired = Boolean(project?.suggestedDevCommand || project?.framework);
  const gate = useMemo(() => evaluateShipGate({
    project,
    timeline,
    verification,
    browser,
    review,
    queue,
    workspace: { codexState, approval },
    browserRequired,
    runtimeAvailable,
    postTurnPending: false,
    verificationBusy: verificationBusy || verification?.evidence.status === 'running',
    browserBusy,
    timelineBusy,
    reviewBusy: reviewBusy || review?.status === 'running',
  }), [approval, browser, browserBusy, browserRequired, codexState, project, queue, review, reviewBusy, runtimeAvailable, timeline, timelineBusy, verification, verificationBusy]);

  const openShip = useCallback(() => {
    setOpen(true);
    void refreshSurface();
  }, [refreshSurface]);

  const runChecks = useCallback(async () => {
    if (!project || verificationBusy) return;
    setVerificationBusy(true);
    setNotice(null);
    try {
      const nextTimeline = await refreshTimeline(project);
      const checkpoint = nextTimeline?.checkpoints.find((item) => item.id === nextTimeline.currentCheckpointId) ?? null;
      await runVerification({
        projectId: project.id,
        projectRoot: project.rootPath,
        trigger: 'manual',
        includeManual: true,
        turnSerial: checkpoint?.turnSerial ?? 0,
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setVerificationBusy(false);
    }
  }, [project, refreshTimeline, verificationBusy]);

  const captureBrowser = useCallback(async () => {
    if (!project || browserBusy) return;
    setBrowserBusy(true);
    setNotice(null);
    try {
      const runtime = await runtimeStatus();
      setRuntimeAvailable(runtime.running);
      if (!runtime.running) throw new Error('Start the live preview before capturing Browser Evidence.');
      const nextTimeline = await refreshTimeline(project);
      const checkpoint = nextTimeline?.checkpoints.find((item) => item.id === nextTimeline.currentCheckpointId) ?? null;
      if (!checkpoint?.turnSerial) throw new Error('Save a generation-bound version before capturing Browser Evidence.');
      await captureBrowserEvidence(project.id, checkpoint.turnSerial);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBrowserBusy(false);
    }
  }, [browserBusy, project, refreshTimeline]);

  const runReview = useCallback(async () => {
    if (!project || reviewBusy) return;
    setReviewBusy(true);
    setNotice(null);
    try {
      await refreshTimeline(project);
      const next = await runFreshReview(project);
      setReview(next);
      await refreshTimeline(project);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setReviewBusy(false);
    }
  }, [project, refreshTimeline, reviewBusy]);

  const openQueue = useCallback(() => {
    setOpen(false);
    window.setTimeout(() => {
      const target = document.querySelector('.prompt-dock');
      if (target instanceof HTMLElement) target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      const textarea = target?.querySelector('textarea');
      if (textarea instanceof HTMLTextAreaElement) textarea.focus();
    }, 0);
  }, []);

  if (!native) return null;

  return (
    <div className="review-ship-layer">
      <button
        type="button"
        className={`ship-layer-button ${gate.ready ? 'ready' : ''}`}
        onClick={openShip}
        aria-label={gate.ready ? 'Ready to ship' : 'Open Ship gate'}
        title={gate.ready ? 'Current saved version passed all blocking gates' : `${gate.blockingCount} Ship blocker${gate.blockingCount === 1 ? '' : 's'}`}
      >
        {gate.ready ? 'Ready' : 'Ship'}
      </button>

      {open ? (
        <div className="ship-layer-drawer">
          {notice ? <div className="ship-layer-notice"><span>{notice}</span><button type="button" onClick={() => setNotice(null)}>×</button></div> : null}
          <ShipPanel
            gate={gate}
            review={review}
            reviewRunning={reviewBusy || review?.status === 'running'}
            onClose={() => setOpen(false)}
            onRunChecks={() => void runChecks()}
            onCaptureBrowser={() => void captureBrowser()}
            onRunReview={() => void runReview()}
            onOpenQueue={openQueue}
            onReviewChange={setReview}
          />
        </div>
      ) : null}
    </div>
  );
}
