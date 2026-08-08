import type { BrowserEvidenceRecord } from '../browser/evidence';
import type { VerificationProgress } from '../verification/controller';
import { summarizeRepairFailure, type RepairFailureSummary } from './failure';

function browserHasFailure(record: BrowserEvidenceRecord | null): boolean {
  const snapshot = record?.snapshot;
  if (!snapshot) return false;
  return Boolean(
    snapshot.runtime.length
      || snapshot.console.some((item) => item.level === 'error')
      || snapshot.network.some((item) => item.failed),
  );
}

export function currentRepairFailure({
  verification,
  browser,
  currentTurnSerial,
}: {
  verification: VerificationProgress | null;
  browser: BrowserEvidenceRecord | null;
  currentTurnSerial: number | null;
}): RepairFailureSummary | null {
  if (currentTurnSerial == null) return null;

  const currentVerification = verification?.evidence.status === 'failed'
    && verification.evidence.turnSerial === currentTurnSerial
    ? verification
    : null;

  const currentBrowser = browser
    && !browser.stale
    && browser.capturedForTurnSerial === currentTurnSerial
    && browserHasFailure(browser)
    ? browser
    : null;

  return summarizeRepairFailure(currentVerification, currentBrowser);
}
