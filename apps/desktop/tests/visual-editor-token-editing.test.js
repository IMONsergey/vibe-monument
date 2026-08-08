import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const tokenTransaction = await readFile(new URL('../src-tauri/src/token_transaction.rs', import.meta.url), 'utf8');
const tokenScope = await readFile(new URL('../src-tauri/src/token_scope.rs', import.meta.url), 'utf8');
const tauriLib = await readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8');
const tauriBuild = await readFile(new URL('../src-tauri/build.rs', import.meta.url), 'utf8');
const capability = await readFile(new URL('../src-tauri/capabilities/main-capability.json', import.meta.url), 'utf8');
const tokenClient = await readFile(new URL('../src/editor/tokenEditing.ts', import.meta.url), 'utf8');
const properties = await readFile(new URL('../src/editor/PropertiesPanel.tsx', import.meta.url), 'utf8');
const intent = await readFile(new URL('../src/editor/intent.ts', import.meta.url), 'utf8');
const visualLayer = await readFile(new URL('../src/editor/VisualEditorLayer.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/styles/visual-editor-editing.css', import.meta.url), 'utf8');

test('token transaction engine proves ownership and keeps writes bounded and atomic', () => {
  for (const token of [
    'MAX_CSS_FILES',
    'MAX_FILE_BYTES',
    'MAX_TOTAL_BYTES',
    'MAX_VALUE_BYTES',
    'TokenEditMode::Instance',
    'TokenEditMode::Token',
    'simple_var_token',
    'selector_score',
    'selected_scope',
    'confirm_shared_global',
    'fs::symlink_metadata',
    'canonical.starts_with(&root)',
    '.create_new(true)',
    'file.sync_all()',
    'fs::rename(&temp, path)',
    'rule_blocks(&content)',
    'Source changed after token transaction resolution',
  ]) assert.ok(tokenTransaction.includes(token), `token transaction contract missing ${token}`);

  assert.ok(tokenTransaction.includes('property_candidates.len() != 1'));
  assert.ok(tokenTransaction.includes('usage_count > 1 && !decision.confirm_shared_global'));
  assert.ok(tokenTransaction.includes('!definition.public.selected_scope'));
  assert.ok(!tokenTransaction.includes('Regex'));
  assert.ok(!tokenTransaction.includes('sh -c'));
  assert.ok(!tokenTransaction.includes('bash -c'));
});

test('token editing commands are main-webview only and separately previewed before commit', () => {
  for (const command of [
    'project_token_edit_probe',
    'project_token_transaction_preview',
    'project_token_transaction_commit',
  ]) {
    assert.ok(tauriLib.includes(command), `lib.rs missing ${command}`);
    assert.ok(tauriBuild.includes(`"${command}"`), `build.rs missing ${command}`);
    assert.ok(capability.includes(`allow-${command.replaceAll('_', '-')}`), `main capability missing ${command}`);
  }
  assert.ok(capability.includes('"webviews": ["main"]'));
  assert.ok(tokenClient.indexOf("'project_token_edit_probe'") < tokenClient.indexOf("'project_token_transaction_preview'"));
  assert.ok(tokenClient.indexOf("'project_token_transaction_preview'") < tokenClient.indexOf("'project_token_transaction_commit'"));
});

test('token scope discovery protects exact token names and exposes bounded blast radius', () => {
  assert.ok(tokenScope.includes('exact_usage_offsets'));
  assert.ok(tokenScope.includes('token_boundary'));
  assert.ok(tokenScope.includes('definition_count'));
  assert.ok(tokenScope.includes('usage_count'));
  assert.ok(tokenScope.includes('Never mutate it implicitly'));
});

test('Properties exposes explicit instance local global and Codex choices', () => {
  for (const token of [
    'Token-backed',
    'Change scope',
    'This element',
    'Local scope',
    'Global token',
    'Use Codex',
    'I understand this changes the shared token',
    'property-token-diff',
    'Inspecting token ownership',
  ]) assert.ok(properties.includes(token), `Properties token UX missing ${token}`);

  assert.ok(properties.includes('probeVisualTokenEdit'));
  assert.ok(properties.includes('defaultTokenDecision'));
  assert.ok(properties.includes('tokenDecisionRequiresGlobalConfirmation'));
  assert.ok(properties.includes('disabled={!changes.length || applying || tokenLoading || globalConfirmationRequired}'));
  assert.ok(styles.includes('.property-token-card'));
  assert.ok(styles.includes('.property-token-confirm.required'));
});

test('token source mutations enter the same Timeline evidence chain as literal direct edits', () => {
  const previewCall = intent.indexOf('const plan = await previewVisualTokenTransaction');
  const commitCall = intent.indexOf('const committed = await commitVisualTokenTransaction');
  const finishCall = intent.indexOf('return finishDirectVisualEdit', commitCall);
  const checkpointCall = intent.indexOf('const checkpoint = await checkpointVisualSourceTransaction');
  const eventCall = intent.indexOf("window.dispatchEvent(new CustomEvent('monument:source-transaction'");
  assert.ok(previewCall >= 0 && commitCall > previewCall);
  assert.ok(finishCall > commitCall);
  assert.ok(checkpointCall >= 0 && eventCall > checkpointCall);
  assert.ok(intent.includes('markBrowserEvidenceStale'));
  assert.ok(intent.includes('recordSourceTransactionCheckpoint'));
  assert.ok(intent.includes("tokenDecision?.mode === 'codex'"));
  assert.ok(visualLayer.includes('affectedUsageCount'));
  assert.ok(visualLayer.includes("result.scope === 'global-token'"));
});

test('literal source transactions and Codex fallback remain intact beside token editing', () => {
  assert.ok(intent.includes("'project_source_transaction_preview'"));
  assert.ok(intent.includes("'project_source_transaction_commit'"));
  assert.ok(intent.includes('queueVisualPropertyEdit'));
  assert.ok(intent.includes('Current source differs from the active Timeline generation'));
});
