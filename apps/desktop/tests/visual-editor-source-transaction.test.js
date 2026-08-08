import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const sourceTransaction = await readFile(new URL('../src-tauri/src/source_transaction.rs', import.meta.url), 'utf8');
const tauriLib = await readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8');
const tauriBuild = await readFile(new URL('../src-tauri/build.rs', import.meta.url), 'utf8');
const capability = await readFile(new URL('../src-tauri/capabilities/main-capability.json', import.meta.url), 'utf8');
const intent = await readFile(new URL('../src/editor/intent.ts', import.meta.url), 'utf8');
const transactionState = await readFile(new URL('../src/editor/transactionState.ts', import.meta.url), 'utf8');
const timeline = await readFile(new URL('../src/timeline/controller.ts', import.meta.url), 'utf8');
const timelineTypes = await readFile(new URL('../src/timeline/types.ts', import.meta.url), 'utf8');
const timelineQuality = await readFile(new URL('../src/timeline/quality.ts', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
const ship = await readFile(new URL('../src/ship/controller.ts', import.meta.url), 'utf8');
const verification = await readFile(new URL('../src/verification/controller.ts', import.meta.url), 'utf8');
const browserEvidence = await readFile(new URL('../src/browser/evidence.ts', import.meta.url), 'utf8');
const repair = await readFile(new URL('../src/repair/controller.ts', import.meta.url), 'utf8');
const review = await readFile(new URL('../src/review/controller.ts', import.meta.url), 'utf8');

test('native source transaction is bounded, revalidated and atomically written', () => {
  for (const token of [
    'MAX_CSS_FILES',
    'MAX_FILE_BYTES',
    'MAX_TOTAL_BYTES',
    'MAX_CHANGES',
    'MAX_VALUE_BYTES',
    'literal-css-declaration',
    'SourceTransactionMode::Deterministic',
    'SourceTransactionMode::Assisted',
    'SourceTransactionMode::Codex',
    'fs::symlink_metadata',
    'canonical.starts_with(&root)',
    '.create_new(true)',
    'file.sync_all()',
    'fs::rename(&temp, path)',
    'rule_blocks(&content)',
    'Source changed after transaction resolution',
  ]) assert.ok(sourceTransaction.includes(token), `native source transaction contract missing ${token}`);

  assert.ok(sourceTransaction.includes('let resolved = resolve(&root, &selection, &changes)?;'));
  assert.ok(sourceTransaction.includes('project_source_transaction_preview'));
  assert.ok(sourceTransaction.includes('project_source_transaction_commit'));
  assert.ok(!sourceTransaction.includes('Regex'));
  assert.ok(!sourceTransaction.includes('sh -c'));
  assert.ok(!sourceTransaction.includes('bash -c'));
});

test('direct transaction commands are registered and scoped to the trusted main webview', () => {
  for (const command of ['project_source_transaction_preview', 'project_source_transaction_commit']) {
    assert.ok(tauriLib.includes(command), `lib.rs missing ${command}`);
    assert.ok(tauriBuild.includes(`"${command}"`), `build.rs missing ${command}`);
    assert.ok(capability.includes(`allow-${command.replaceAll('_', '-')}`), `main capability missing ${command}`);
  }
  assert.ok(capability.includes('"webviews": ["main"]'));
});

test('direct Apply is generation-bound and cannot overlap other source mutation', () => {
  assert.ok(intent.indexOf("project_source_transaction_preview") < intent.indexOf("project_source_transaction_commit"));
  assert.ok(intent.indexOf("project_source_transaction_commit") < intent.indexOf('checkpointVisualSourceTransaction'));
  assert.ok(intent.includes('isSourceTransactionOrchestrationBlocked'));
  assert.ok(intent.includes('isSourceTransactionValidationBusy'));
  assert.ok(intent.includes('recordSourceTransactionCheckpoint'));
  assert.ok(intent.includes("window.dispatchEvent(new CustomEvent('monument:source-transaction'"));
  assert.ok(intent.includes('queueVisualPropertyEdit(selection, bounded)'));

  assert.ok(transactionState.includes('orchestrationBlockedProjects'));
  assert.ok(transactionState.includes('validatingSourceTransactions'));
  assert.ok(transactionState.includes('unacknowledgedCheckpoints'));
});

test('visual generations use an isolated serial namespace and flow through evidence and repair', () => {
  assert.ok(timelineTypes.includes("'visual'"));
  assert.ok(timeline.includes("kind: 'visual'"));
  assert.ok(timeline.includes('return -(Date.now() * 1000 + visualGenerationCounter)'));
  assert.ok(timeline.includes('acknowledgeSourceTransactionCheckpoint'));
  assert.ok(timelineQuality.includes('negative ids are direct Visual Editor generations'));
  assert.ok(verification.includes("'visual-edit'"));
  assert.ok(verification.includes('evidence.turnSerial !== 0'));
  assert.ok(browserEvidence.includes('resolvedTurnSerial !== 0'));
  assert.ok(app.includes("window.addEventListener('monument:source-transaction'"));
  assert.ok(app.includes("trigger: 'visual-edit'"));
  assert.ok(app.includes('beginSourceTransactionValidation'));
  assert.ok(app.includes('endSourceTransactionValidation'));
  assert.ok(app.includes('setSourceTransactionOrchestrationBlocked'));

  assert.ok(repair.includes("evidence.trigger !== 'visual-edit'"));
  assert.ok(repair.includes('evidence.turnSerial === 0'));
  assert.ok(!repair.includes('evidence.turnSerial <= 0'));
  assert.ok(review.includes('record.turnSerial !== 0'));
  assert.ok(review.includes('record.turnSerial === 0'));
  assert.ok(!review.includes('record.turnSerial > 0'));
  assert.ok(!review.includes('record.turnSerial <= 0'));
});

test('Ship treats negative visual generations as valid but blocks transaction handoff races', () => {
  assert.ok(ship.includes('turnSerial === 0'));
  assert.ok(!ship.includes('turnSerial <= 0'));
  assert.ok(ship.includes('hasPendingSourceTransaction'));
  assert.ok(ship.includes('hasUnacknowledgedSourceTransaction'));
  assert.ok(ship.includes('isSourceTransactionValidationBusy'));
  assert.ok(ship.includes('evidence.turnSerial !== turnSerial'));
  assert.ok(ship.includes('input.browser.capturedForTurnSerial !== turnSerial'));
});
