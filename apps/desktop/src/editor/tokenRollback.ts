import { invokeNative } from '../host/native';
import type {
  VisualSourceApplyResult,
  VisualSourcePlanInput,
  VisualSourcePlanResponse,
} from './sourceTransaction';
import type {
  PreparedVisualTokenEdit,
  VisualTokenApplyResult,
  VisualTokenPlanInput,
  VisualTokenPlanResponse,
  VisualTokenScope,
} from './tokenTransaction';

async function verifyOriginalTokenPlan(prepared: PreparedVisualTokenEdit): Promise<boolean> {
  const verification = await invokeNative<VisualTokenPlanResponse>('visual_token_plan', { input: prepared.request }).catch(() => null);
  return Boolean(
    verification
    && verification.status === 'scope-choice'
    && verification.tokenName === prepared.tokenName
    && verification.elementPlan?.sourcePath === prepared.elementPlan.sourcePath
    && verification.elementPlan?.beforeSource === prepared.elementPlan.beforeSource
    && verification.tokenPlan?.sourcePath === prepared.tokenPlan.sourcePath
    && verification.tokenPlan?.beforeSource === prepared.tokenPlan.beforeSource
  );
}

async function rollbackElementDetach(
  prepared: PreparedVisualTokenEdit,
  applied: VisualTokenApplyResult,
): Promise<boolean> {
  const reverseRequest: VisualSourcePlanInput = {
    projectPath: prepared.projectRoot,
    elementId: prepared.request.elementId,
    property: prepared.change.property,
    before: prepared.change.after,
    after: prepared.elementPlan.beforeSource,
  };
  const reverse = await invokeNative<VisualSourcePlanResponse>('visual_source_plan', { input: reverseRequest }).catch(() => null);
  const plan = reverse?.status === 'deterministic' ? reverse.plan : null;
  if (
    !plan
    || plan.sourcePath !== applied.sourcePath
    || plan.fileFingerprint !== applied.nextFingerprint
    || plan.beforeSource !== prepared.change.after
    || plan.afterSource !== prepared.elementPlan.beforeSource
  ) return false;

  const reverted = await invokeNative<VisualSourceApplyResult>('visual_source_apply', {
    input: {
      request: reverseRequest,
      expectedSourcePath: plan.sourcePath,
      expectedFileFingerprint: plan.fileFingerprint,
      expectedValueStart: plan.valueStart,
      expectedValueEnd: plan.valueEnd,
    },
  }).catch(() => null);
  if (!reverted || reverted.sourcePath !== applied.sourcePath) return false;
  return verifyOriginalTokenPlan(prepared);
}

async function rollbackGlobalToken(
  prepared: PreparedVisualTokenEdit,
  applied: VisualTokenApplyResult,
): Promise<boolean> {
  const reverseRequest: VisualTokenPlanInput = {
    ...prepared.request,
    before: prepared.change.after,
    after: prepared.change.before,
  };
  const reverse = await invokeNative<VisualTokenPlanResponse>('visual_token_plan', { input: reverseRequest }).catch(() => null);
  const plan = reverse?.status === 'scope-choice' ? reverse.tokenPlan : null;
  if (
    !plan
    || reverse?.tokenName !== prepared.tokenName
    || plan.sourcePath !== applied.sourcePath
    || plan.fileFingerprint !== applied.nextFingerprint
    || plan.beforeSource !== prepared.change.after
    || plan.afterSource !== prepared.change.before
  ) return false;

  const reverted = await invokeNative<VisualTokenApplyResult>('visual_token_apply', {
    input: {
      request: reverseRequest,
      scope: 'token',
      expectedSourcePath: plan.sourcePath,
      expectedFileFingerprint: plan.fileFingerprint,
      expectedValueStart: plan.valueStart,
      expectedValueEnd: plan.valueEnd,
    },
  }).catch(() => null);
  if (!reverted || reverted.sourcePath !== applied.sourcePath) return false;
  return verifyOriginalTokenPlan(prepared);
}

export async function rollbackVisualTokenTransaction(
  prepared: PreparedVisualTokenEdit,
  applied: VisualTokenApplyResult,
  scope: VisualTokenScope,
): Promise<boolean> {
  if (applied.scope !== scope || applied.tokenName !== prepared.tokenName) return false;
  return scope === 'element'
    ? rollbackElementDetach(prepared, applied)
    : rollbackGlobalToken(prepared, applied);
}
