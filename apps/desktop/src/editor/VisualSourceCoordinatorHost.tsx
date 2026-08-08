import { useEffect } from 'react';
import { markBrowserEvidenceStale, clearBrowserEvidenceBuffer, captureBrowserEvidence } from '../browser/evidence';
import { getCodexRuntimeSnapshot } from '../codex/runtime';
import { inspectProject, invokeNative, isNativeHost, stateGet } from '../host/native';
import { loadPromptQueue } from '../queue/controller';
import { restoreFreshReview } from '../review/controller';
import { prepareTimeline, saveTimelineVersion } from '../timeline/controller';
import { restoreVerification, runVerification } from '../verification/controller';
import {
  registerVisualSourceCoordinator,
  type PreparedVisualSourceEdit,
  type VisualSourceApplyResult,
  type VisualSourceCoordinator,
  type VisualSourcePlanInput,
  type VisualSourcePlanResponse,
} from './sourceTransaction';
import type { VisualPropertyChange } from './intent';
import type { EditorSelection } from './types';

export const VISUAL_SOURCE_COMMITTED_EVENT = 'monument:visual-source-committed';

function fallback(reason: string) {
  return { kind: 'fallback' as const, reason };
}

function directRuntimeReason(): string | null {
  const runtime = getCodexRuntimeSnapshot();
  if (!runtime) return 'Codex runtime state is not ready for a direct transaction';
  if (runtime.state !== 'ready' || runtime.activeTurnId || runtime.approval) return 'Codex or an approval is active';
  return null;
}

async function openCurrentProject() {
  const projectPath = await stateGet<string>('lastProjectPath').catch(() => null);
  if (!projectPath) throw new Error('Open a project before applying visual changes.');
  return inspectProject(projectPath);
}

async function sourceTransactionBlockReason(projectId: string): Promise<string | null> {
  const queue = await loadPromptQueue(projectId, false);
  if (queue.items.length > 0) return 'Prompt Queue already contains requested work';

  const verification = await restoreVerification(projectId).catch(() => null);
  if (verification?.evidence.status === 'running') return 'Deterministic verification is still running';

  const review = await restoreFreshReview(projectId).catch(() => null);
  if (review?.status === 'running') return 'Fresh Review is still running';

  return null;
}

function eligibleChange(selection: EditorSelection, changes: VisualPropertyChange[]): VisualPropertyChange | null {
  if (!selection.id || changes.length !== 1) return null;
  const change = changes[0];
  if (!change || change.property === 'textContent' || !change.before.trim() || !change.after.trim()) return null;
  return change;
}

async function planRequest(input: VisualSourcePlanInput): Promise<VisualSourcePlanResponse> {
  return invokeNative<VisualSourcePlanResponse>('visual_source_plan', { input });
}

async function applyPrepared(prepared: PreparedVisualSourceEdit): Promise<VisualSourceApplyResult> {
  return invokeNative<VisualSourceApplyResult>('visual_source_apply', {
    input: {
      request: prepared.request,
      expectedSourcePath: prepared.plan.sourcePath,
      expectedFileFingerprint: prepared.plan.fileFingerprint,
      expectedValueStart: prepared.plan.valueStart,
      expectedValueEnd: prepared.plan.valueEnd,
    },
  });
}

async function rollbackApplied(prepared: PreparedVisualSourceEdit, applied: VisualSourceApplyResult): Promise<boolean> {
  const request: VisualSourcePlanInput = {
    ...prepared.request,
    before: prepared.change.after,
    after: prepared.change.before,
  };
  const response = await planRequest(request).catch(() => null);
  const plan = response?.status === 'deterministic' ? response.plan : null;
  if (!plan || plan.sourcePath !== applied.sourcePath) return false;
  await invokeNative<VisualSourceApplyResult>('visual_source_apply', {
    input: {
      request,
      expectedSourcePath: plan.sourcePath,
      expectedFileFingerprint: plan.fileFingerprint,
      expectedValueStart: plan.valueStart,
      expectedValueEnd: plan.valueEnd,
    },
  }).catch(() => null);
  const verify = await planRequest(prepared.request).catch(() => null);
  return verify?.status === 'deterministic'
    && verify.plan?.sourcePath === prepared.plan.sourcePath
    && verify.plan?.beforeSource === prepared.plan.beforeSource;
}

function visualCheckpointTitle(change: VisualPropertyChange): string {
  const property = change.property.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return `Visual · ${property}`.slice(0, 76);
}

function scheduleCheckpointEvidence(projectId: string, projectRoot: string, checkpointId: string): void {
  void (async () => {
    await runVerification({
      projectId,
      projectRoot,
      trigger: 'source-transaction',
      checkpointId,
      turnSerial: 0,
    }).catch(() => null);

    await new Promise((resolve) => window.setTimeout(resolve, 650));
    await captureBrowserEvidence(projectId, 0, checkpointId).catch(() => null);
  })();
}

function coordinator(): VisualSourceCoordinator {
  return {
    async plan(selection, changes) {
      if (!isNativeHost()) return fallback('Direct source transactions require the Monument desktop host');
      const change = eligibleChange(selection, changes);
      if (!change) return fallback('Direct CSS v1 supports one non-text property on an element with a stable id');

      const runtimeReason = directRuntimeReason();
      if (runtimeReason) return fallback(runtimeReason);

      const project = await openCurrentProject();
      const activityReason = await sourceTransactionBlockReason(project.id);
      if (activityReason) return fallback(activityReason);

      const timeline = await prepareTimeline(project);
      if (timeline.dirty) return fallback('Current project files contain unsaved changes');
      const base = timeline.checkpoints.find((checkpoint) => checkpoint.id === timeline.currentCheckpointId) ?? null;
      if (!base) return fallback('Current Timeline checkpoint is unavailable');

      const request: VisualSourcePlanInput = {
        projectPath: project.rootPath,
        elementId: selection.id,
        property: change.property,
        before: change.before,
        after: change.after,
      };
      const response = await planRequest(request);
      if (response.status !== 'deterministic' || !response.plan) return fallback(response.reason || 'Direct source owner is not deterministic');

      return {
        kind: 'deterministic',
        prepared: {
          projectId: project.id,
          projectRoot: project.rootPath,
          baseCheckpointId: base.id,
          selectionNodeId: selection.nodeId,
          change,
          request,
          plan: response.plan,
        },
      };
    },

    async commit(prepared) {
      if (!isNativeHost()) throw new Error('Direct source transactions require the Monument desktop host.');
      const runtimeReason = directRuntimeReason();
      if (runtimeReason) throw new Error(runtimeReason);

      const project = await openCurrentProject();
      if (project.id !== prepared.projectId || project.rootPath !== prepared.projectRoot) {
        throw new Error('The open project changed after the dry-run. Re-plan this edit.');
      }
      const activityReason = await sourceTransactionBlockReason(project.id);
      if (activityReason) throw new Error(activityReason);

      const timeline = await prepareTimeline(project);
      if (timeline.dirty || timeline.currentCheckpointId !== prepared.baseCheckpointId) {
        throw new Error('Source or Timeline changed after the dry-run. Re-plan this edit.');
      }

      const applied = await applyPrepared(prepared);
      let checkpoint;
      try {
        checkpoint = await saveTimelineVersion(project, visualCheckpointTitle(prepared.change));
      } catch (error) {
        const rolledBack = await rollbackApplied(prepared, applied);
        if (!rolledBack) {
          throw new Error(`Version checkpoint failed and the automatic source rollback could not be proven. Review ${applied.sourcePath} before continuing. Original error: ${error instanceof Error ? error.message : String(error)}`);
        }
        throw new Error(`Version checkpoint failed; Monument restored the original CSS value. ${error instanceof Error ? error.message : String(error)}`);
      }

      await markBrowserEvidenceStale(project.id).catch(() => undefined);
      await clearBrowserEvidenceBuffer().catch(() => undefined);
      window.dispatchEvent(new CustomEvent(VISUAL_SOURCE_COMMITTED_EVENT, {
        detail: {
          projectId: project.id,
          projectRoot: project.rootPath,
          checkpointId: checkpoint.id,
          sourcePath: applied.sourcePath,
          property: prepared.change.property,
        },
      }));
      scheduleCheckpointEvidence(project.id, project.rootPath, checkpoint.id);

      return {
        checkpointId: checkpoint.id,
        sourcePath: applied.sourcePath,
        cssProperty: applied.cssProperty,
        line: applied.line,
      };
    },
  };
}

export function VisualSourceCoordinatorHost() {
  useEffect(() => {
    if (!isNativeHost()) return;
    return registerVisualSourceCoordinator(coordinator());
  }, []);
  return null;
}
