import { useEffect } from 'react';
import { getCodexRuntimeSnapshot } from '../codex/runtime';
import { inspectProject, invokeNative, isNativeHost, stateGet } from '../host/native';
import { loadPromptQueue } from '../queue/controller';
import { restoreFreshReview } from '../review/controller';
import { prepareTimeline } from '../timeline/controller';
import { restoreVerification } from '../verification/controller';
import {
  commitVisualSourceEdit,
  type PreparedVisualSourceEdit,
  type VisualSourcePlan,
} from './sourceTransaction';
import {
  registerVisualTokenCoordinator,
  type PreparedVisualTokenEdit,
  type VisualTokenCoordinator,
  type VisualTokenPlanInput,
  type VisualTokenPlanResponse,
  type VisualTokenScope,
  type VisualTokenScopePlan,
} from './tokenTransaction';
import type { VisualPropertyChange } from './intent';
import type { EditorSelection } from './types';

function fallback(reason: string) {
  return { kind: 'fallback' as const, reason };
}

function runtimeBlockReason(): string | null {
  const runtime = getCodexRuntimeSnapshot();
  if (!runtime) return 'Codex runtime state is not ready for token planning';
  if (runtime.state !== 'ready' || runtime.activeTurnId || runtime.approval) return 'Codex or an approval is active';
  return null;
}

async function openCurrentProject() {
  const projectPath = await stateGet<string>('lastProjectPath').catch(() => null);
  if (!projectPath) throw new Error('Open a project before applying visual changes.');
  return inspectProject(projectPath);
}

async function tokenPlanBlockReason(projectId: string): Promise<string | null> {
  const queue = await loadPromptQueue(projectId, false);
  if (queue.items.length > 0 || queue.dispatchingId) return 'Prompt Queue already contains requested work';
  const verification = await restoreVerification(projectId).catch(() => null);
  if (verification?.evidence.status === 'running') return 'Deterministic verification is still running';
  const review = await restoreFreshReview(projectId).catch(() => null);
  if (review?.status === 'running') return 'Fresh Review is still running';
  return null;
}

function eligibleChange(selection: EditorSelection, changes: VisualPropertyChange[]): VisualPropertyChange | null {
  if (!selection.id || selection.idUnique !== true || changes.length !== 1) return null;
  const change = changes[0];
  if (!change || change.property === 'textContent' || !change.before.trim() || !change.after.trim()) return null;
  return change;
}

function operationLabel(change: VisualPropertyChange, tokenName: string, scope: VisualTokenScope): string {
  return `${change.property} · ${scope === 'element' ? 'detach' : 'token'} ${tokenName}`;
}

function sourcePlan(scopePlan: VisualTokenScopePlan, requestedProperty: string): VisualSourcePlan {
  return {
    sourcePath: scopePlan.sourcePath,
    selector: scopePlan.selector,
    requestedProperty,
    cssProperty: scopePlan.cssProperty,
    line: scopePlan.line,
    valueStart: scopePlan.valueStart,
    valueEnd: scopePlan.valueEnd,
    beforeSource: scopePlan.beforeSource,
    afterSource: scopePlan.afterSource,
    fileFingerprint: scopePlan.fileFingerprint,
    previewBefore: scopePlan.previewBefore,
    previewAfter: scopePlan.previewAfter,
    confidence: scopePlan.confidence,
  };
}

function asSourceTransaction(prepared: PreparedVisualTokenEdit, scope: VisualTokenScope): PreparedVisualSourceEdit {
  const selected = scope === 'element' ? prepared.elementPlan : prepared.tokenPlan;
  const label = operationLabel(prepared.change, prepared.tokenName, scope);
  return {
    projectId: prepared.projectId,
    projectRoot: prepared.projectRoot,
    baseCheckpointId: prepared.baseCheckpointId,
    selectionNodeId: prepared.selectionNodeId,
    change: {
      property: label,
      before: selected.beforeSource,
      after: selected.afterSource,
    },
    request: {
      projectPath: prepared.projectRoot,
      elementId: prepared.request.elementId,
      property: label,
      // Forward token proof still uses the live computed before value. Rollback uses
      // PreparedVisualSourceEdit.change, whose element scope keeps the original var(--token).
      before: prepared.change.before,
      after: prepared.change.after,
    },
    plan: sourcePlan(selected, label),
  };
}

function coordinator(): VisualTokenCoordinator {
  return {
    async plan(selection, changes) {
      if (!isNativeHost()) return fallback('Direct design-token editing requires the Monument desktop host');
      const change = eligibleChange(selection, changes);
      if (!change) return fallback('Token v1 requires one non-text property on a unique live DOM id');
      const runtimeReason = runtimeBlockReason();
      if (runtimeReason) return fallback(runtimeReason);

      const project = await openCurrentProject();
      const activityReason = await tokenPlanBlockReason(project.id);
      if (activityReason) return fallback(activityReason);
      const timeline = await prepareTimeline(project);
      if (timeline.dirty) return fallback('Current project files contain unsaved changes');
      const base = timeline.checkpoints.find((checkpoint) => checkpoint.id === timeline.currentCheckpointId) ?? null;
      if (!base) return fallback('Current Timeline checkpoint is unavailable');

      const request: VisualTokenPlanInput = {
        projectPath: project.rootPath,
        elementId: selection.id,
        property: change.property,
        before: change.before,
        after: change.after,
      };
      const response = await invokeNative<VisualTokenPlanResponse>('visual_token_plan', { input: request });
      if (
        response.status !== 'scope-choice'
        || !response.tokenName
        || !response.elementPlan
        || !response.tokenPlan
      ) return fallback(response.reason || 'Design-token source scope is not deterministic');

      return {
        kind: 'scope-choice',
        prepared: {
          projectId: project.id,
          projectRoot: project.rootPath,
          baseCheckpointId: base.id,
          selectionNodeId: selection.nodeId,
          change,
          request,
          tokenName: response.tokenName,
          usageCount: response.usageCount,
          elementPlan: response.elementPlan,
          tokenPlan: response.tokenPlan,
        },
      };
    },

    async commit(prepared, scope) {
      const sourceResult = await commitVisualSourceEdit(asSourceTransaction(prepared, scope));
      return {
        ...sourceResult,
        scope,
        tokenName: prepared.tokenName,
      };
    },
  };
}

export function VisualTokenCoordinatorHost() {
  useEffect(() => {
    if (!isNativeHost()) return;
    return registerVisualTokenCoordinator(coordinator());
  }, []);
  return null;
}
