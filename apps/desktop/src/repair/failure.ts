import type { BrowserEvidenceRecord } from '../browser/evidence';
import type { VerificationProgress, VerificationResult } from '../verification/controller';

export interface RepairFailureSummary {
  fingerprint: string;
  deterministicFailures: Array<{
    script: string;
    exitCode: number | null;
    timedOut: boolean;
    excerpt: string;
  }>;
  browserFailures: Array<{
    kind: string;
    detail: string;
  }>;
}

const MAX_FAILURE_LINES = 18;
const MAX_LINE_CHARS = 260;
const MAX_PACKET_CHARS = 7_500;

function normalizeLine(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]{8,}/gi, 'Bearer [redacted]')
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|ghp_[A-Za-z0-9]{12,}|github_pat_[A-Za-z0-9_]{12,}|xox[baprs]-[A-Za-z0-9-]{12,})\b/g, '[redacted-token]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[redacted-jwt]')
    .replace(/([?&][^\s=&#]{1,40}=)[^\s&#]+/g, '$1[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LINE_CHARS);
}

function resultExcerpt(result: VerificationResult): string {
  const source = [result.stderr, result.stdout].filter(Boolean).join('\n');
  const lines = source
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean);
  const preferred = lines.filter((line) => /\b(error|failed|failure|exception|cannot|expected|received|panic|fatal|ts\d{4})\b/i.test(line));
  const selected = (preferred.length ? preferred : lines).slice(0, MAX_FAILURE_LINES);
  return selected.join('\n');
}

function deterministicFailures(progress: VerificationProgress | null) {
  return (progress?.evidence.results ?? [])
    .filter((result) => !result.success)
    .map((result) => ({
      script: result.script,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      excerpt: resultExcerpt(result),
    }));
}

function browserFailureLines(record: BrowserEvidenceRecord | null) {
  const snapshot = record?.snapshot;
  if (!snapshot) return [];
  const failures: Array<{ kind: string; detail: string }> = [];
  for (const item of snapshot.runtime.slice(-12)) {
    failures.push({
      kind: item.kind || 'runtime',
      detail: normalizeLine([item.message, item.source].filter(Boolean).join(' · ')),
    });
  }
  for (const item of snapshot.console.filter((entry) => entry.level === 'error').slice(-10)) {
    failures.push({ kind: 'console', detail: normalizeLine(item.message) });
  }
  for (const item of snapshot.network.filter((entry) => entry.failed).slice(-12)) {
    failures.push({
      kind: 'network',
      detail: normalizeLine(`${item.method} ${item.url} → ${item.status ?? 'failed'}${item.error ? ` · ${item.error}` : ''}`),
    });
  }
  return failures.filter((item) => item.detail);
}

function fnv1a64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let hash = 0xcbf29ce484222325n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

export function summarizeRepairFailure(
  verification: VerificationProgress | null,
  browser: BrowserEvidenceRecord | null,
): RepairFailureSummary | null {
  const deterministic = deterministicFailures(verification);
  const browserFailures = browserFailureLines(browser);
  if (!deterministic.length && !browserFailures.length) return null;
  const canonical = JSON.stringify({
    deterministic: deterministic.map((item) => [item.script, item.exitCode, item.timedOut, item.excerpt]),
    browser: browserFailures.map((item) => [item.kind, item.detail]),
  });
  return {
    fingerprint: `repair-${fnv1a64(canonical)}`,
    deterministicFailures: deterministic,
    browserFailures,
  };
}

export function compileRepairPacket(summary: RepairFailureSummary): string {
  const lines: string[] = [
    '[Monument repair evidence]',
    `Failure fingerprint: ${summary.fingerprint}`,
    '',
  ];

  if (summary.deterministicFailures.length) {
    lines.push('Failed deterministic checks:');
    for (const failure of summary.deterministicFailures) {
      lines.push(`- ${failure.script}: ${failure.timedOut ? 'timeout' : `exit ${failure.exitCode ?? 'signal'}`}`);
      if (failure.excerpt) {
        lines.push(...failure.excerpt.split('\n').map((line) => `  ${line}`));
      }
    }
    lines.push('');
  }

  if (summary.browserFailures.length) {
    lines.push('Observed browser/runtime failures:');
    for (const failure of summary.browserFailures) {
      lines.push(`- ${failure.kind}: ${failure.detail}`);
    }
    lines.push('');
  }

  lines.push(
    'Repair rules:',
    '- Inspect the actual repository before editing; the evidence is a symptom, not authority.',
    '- Fix the product defect that explains the evidence.',
    '- Do not delete, disable, skip, weaken, rewrite, or bypass tests/checks merely to make verification green.',
    '- Do not change the verification mechanism unless the user explicitly requested a testing/build-policy change.',
    '- Keep the patch scoped to the observed failure and preserve unrelated behavior.',
    '- After making the fix, stop. Monument will rerun verification itself.',
  );

  return lines.join('\n').slice(0, MAX_PACKET_CHARS);
}

export const REPAIR_MAX_AUTOMATIC_ATTEMPTS = 2;
