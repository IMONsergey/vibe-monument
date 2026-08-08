import { browserEvidenceHasIssues, type BrowserEvidenceRecord } from '../browser/evidence';
import type { FreshReviewRecord } from '../review/controller';
import { unresolvedFindings } from '../review/controller';
import type { PromptQueueState } from '../queue/controller';
import type { TimelineState } from '../timeline/types';
import type { ProjectInspection, WorkspaceState } from '../types';
import type { VerificationProgress } from '../verification/controller';

export type ShipGateStatus = 'pass' | 'block' | 'warn';

export interface ShipGateItem {
  id: string;
  label: string;
  status: ShipGateStatus;
  detail: string;
  action?: 'checks' | 'browser' | 'review' | 'queue' | 'findings';
}

export interface ShipGateResult {
  ready: boolean;
  checkpointId: string | null;
  turnSerial: number | null;
  items: ShipGateItem[];
  blockingCount: number;
  warningCount: number;
}

export interface ShipGateInput {
  project: ProjectInspection | null;
  timeline: TimelineState | null;
  verification: VerificationProgress | null;
  browser: BrowserEvidenceRecord | null;
  review: FreshReviewRecord | null;
  queue: PromptQueueState | null;
  workspace: Pick<WorkspaceState, 'codexState' | 'approval'>;
  browserRequired: boolean;
  runtimeAvailable: boolean;
  postTurnPending: boolean;
  verificationBusy: boolean;
  browserBusy: boolean;
  timelineBusy: boolean;
  reviewBusy: boolean;
}

function item(id: string, label: string, status: ShipGateStatus, detail: string, action?: ShipGateItem['action']): ShipGateItem {
  return { id, label, status, detail, action };
}

export function evaluateShipGate(input: ShipGateInput): ShipGateResult {
  const items: ShipGateItem[] = [];
  const current = input.timeline?.checkpoints.find((checkpoint) => checkpoint.id === input.timeline?.currentCheckpointId) ?? null;
  const turnSerial = current?.turnSerial ?? null;

  if (!input.project) {
    items.push(item('project', 'Project', 'block', 'Open a project before shipping.'));
  } else {
    items.push(item('project', 'Project', 'pass', input.project.name));
  }

  if (!input.timeline || !current) {
    items.push(item('version', 'Saved version', 'block', 'Version Timeline is not ready.'));
  } else if (input.timeline.dirty) {
    items.push(item('version', 'Saved version', 'block', 'The current source has uncheckpointed changes. Save a version before review/ship.'));
  } else if (current.kind === 'baseline') {
    items.push(item('version', 'Saved version', 'block', 'Original baseline has no Monument change to ship.'));
  } else if (turnSerial == null || turnSerial <= 0) {
    items.push(item('version', 'Generation binding', 'block', 'This saved version is not bound to a Codex generation yet, so current evidence cannot be proven to match it.'));
  } else {
    items.push(item('version', 'Saved version', 'pass', current.title || `Generation ${turnSerial}`));
  }

  const evidence = input.verification?.evidence ?? null;
  if (turnSerial == null || turnSerial <= 0) {
    items.push(item('checks', 'Deterministic checks', 'block', 'Checks cannot satisfy Ship until the current version has a generation id.', 'checks'));
  } else if (!evidence) {
    items.push(item('checks', 'Deterministic checks', 'block', 'No checks have been captured for the current project.', 'checks'));
  } else if (evidence.turnSerial !== turnSerial) {
    items.push(item('checks', 'Deterministic checks', 'block', 'The latest checks belong to a different code generation.', 'checks'));
  } else if (evidence.permissionRequired) {
    items.push(item('checks', 'Deterministic checks', 'block', 'Supported project checks exist but automatic execution has not been allowed. Run checks explicitly or enable Auto checks.', 'checks'));
  } else if (evidence.status === 'running') {
    items.push(item('checks', 'Deterministic checks', 'block', 'Checks are still running.'));
  } else if (evidence.status === 'failed') {
    items.push(item('checks', 'Deterministic checks', 'block', 'One or more project checks failed.', 'checks'));
  } else if (evidence.status === 'error') {
    items.push(item('checks', 'Deterministic checks', 'block', evidence.error || 'Monument could not complete deterministic verification.', 'checks'));
  } else if (evidence.status === 'no-checks') {
    items.push(item('checks', 'Deterministic checks', 'warn', 'This project exposes no supported deterministic scripts. Ship can continue, but this evidence lane is absent.'));
  } else {
    items.push(item('checks', 'Deterministic checks', 'pass', `${evidence.results.filter((result) => result.success).length} check${evidence.results.length === 1 ? '' : 's'} passed.`));
  }

  if (!input.browserRequired) {
    items.push(item('browser', 'Live product', 'warn', 'No supported live web runtime is required for this project.'));
  } else if (!input.runtimeAvailable) {
    items.push(item('browser', 'Live product', 'block', 'Start the real preview before shipping so Monument can inspect browser/runtime evidence.', 'browser'));
  } else if (turnSerial == null || turnSerial <= 0) {
    items.push(item('browser', 'Browser evidence', 'block', 'Browser evidence cannot satisfy Ship until the current version is generation-bound.', 'browser'));
  } else if (!input.browser) {
    items.push(item('browser', 'Browser evidence', 'block', 'Capture the live product for the current version.', 'browser'));
  } else if (input.browser.stale || input.browser.capturedForTurnSerial !== turnSerial) {
    items.push(item('browser', 'Browser evidence', 'block', 'Browser evidence belongs to an older code generation.', 'browser'));
  } else if (browserEvidenceHasIssues(input.browser)) {
    items.push(item('browser', 'Browser evidence', 'block', 'The live product has runtime, console or failed-network issues.', 'browser'));
  } else {
    items.push(item('browser', 'Browser evidence', 'pass', 'Current live preview is clean for captured runtime/console/network signals.'));
  }

  if (!current || current.kind === 'baseline') {
    items.push(item('review', 'Fresh Review', 'block', 'Save a changed version before running Fresh Review.', 'review'));
  } else if (!input.review) {
    items.push(item('review', 'Fresh Review', 'block', 'Independent review has not run for this version.', 'review'));
  } else if (input.review.checkpointId !== current.id) {
    items.push(item('review', 'Fresh Review', 'block', 'The latest review belongs to another saved version.', 'review'));
  } else if (input.review.status === 'running') {
    items.push(item('review', 'Fresh Review', 'block', 'Independent review is still running.'));
  } else if (input.review.status === 'error') {
    items.push(item('review', 'Fresh Review', 'block', input.review.error || 'Fresh Review could not complete.', 'review'));
  } else {
    const unresolved = unresolvedFindings(input.review);
    const blockers = unresolved.filter((finding) => finding.severity === 'blocker');
    if (blockers.length) {
      items.push(item('review', 'Fresh Review', 'block', `${blockers.length} blocker finding${blockers.length === 1 ? '' : 's'} must be fixed. Blockers cannot be waived.`, 'findings'));
    } else if (unresolved.length) {
      items.push(item('review', 'Review findings', 'block', `${unresolved.length} finding${unresolved.length === 1 ? '' : 's'} still need a fix or explicit waiver.`, 'findings'));
    } else {
      items.push(item('review', 'Fresh Review', 'pass', input.review.findings.length ? 'All review findings were fixed or explicitly waived.' : 'No material findings were reported.'));
    }
  }

  const queued = input.queue?.items.length ?? 0;
  if (queued > 0) {
    items.push(item('queue', 'Pending work', 'block', `${queued} queued prompt${queued === 1 ? '' : 's'} still represent unfinished requested work.`, 'queue'));
  } else {
    items.push(item('queue', 'Pending work', 'pass', 'Prompt Queue is empty.'));
  }

  if (input.workspace.approval) {
    items.push(item('agent', 'Codex state', 'block', 'Codex is waiting for an approval or answer.'));
  } else if (input.workspace.codexState !== 'ready') {
    items.push(item('agent', 'Codex state', 'block', `Codex is ${input.workspace.codexState}; finish or resolve the current agent state before shipping.`));
  } else if (input.postTurnPending || input.verificationBusy || input.browserBusy || input.timelineBusy || input.reviewBusy) {
    items.push(item('agent', 'Post-turn work', 'block', 'Versioning, evidence or review work is still being finalized.'));
  } else {
    items.push(item('agent', 'Post-turn work', 'pass', 'Codex and Monument post-turn work are settled.'));
  }

  const blockingCount = items.filter((entry) => entry.status === 'block').length;
  const warningCount = items.filter((entry) => entry.status === 'warn').length;
  return {
    ready: blockingCount === 0,
    checkpointId: current?.id ?? null,
    turnSerial,
    items,
    blockingCount,
    warningCount,
  };
}
