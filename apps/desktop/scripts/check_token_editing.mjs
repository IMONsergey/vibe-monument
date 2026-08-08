import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const tokenTransaction = await readFile(join(root, 'src-tauri/src/token_transaction.rs'), 'utf8');
const tauriLib = await readFile(join(root, 'src-tauri/src/lib.rs'), 'utf8');
const tauriBuild = await readFile(join(root, 'src-tauri/build.rs'), 'utf8');
const capability = JSON.parse(await readFile(join(root, 'src-tauri/capabilities/main-capability.json'), 'utf8'));
const tokenClient = await readFile(join(root, 'src/editor/tokenEditing.ts'), 'utf8');
const properties = await readFile(join(root, 'src/editor/PropertiesPanel.tsx'), 'utf8');
const intent = await readFile(join(root, 'src/editor/intent.ts'), 'utf8');
const styles = await readFile(join(root, 'src/styles/visual-editor-editing.css'), 'utf8');

for (const command of [
  'project_token_edit_probe',
  'project_token_transaction_preview',
  'project_token_transaction_commit',
]) {
  if (!tauriLib.includes(command)) throw new Error(`Token runtime registration missing ${command}`);
  if (!tauriBuild.includes(`"${command}"`)) throw new Error(`Tauri app manifest missing ${command}`);
  const permission = `allow-${command.replaceAll('_', '-')}`;
  if (!capability.permissions?.includes(permission)) throw new Error(`Trusted main capability missing ${permission}`);
}
if (JSON.stringify(capability.webviews) !== JSON.stringify(['main'])) {
  throw new Error('Token source-write permissions must remain scoped to the trusted main webview');
}

for (const token of [
  'MAX_CSS_FILES', 'MAX_FILE_BYTES', 'MAX_TOTAL_BYTES', 'MAX_VALUE_BYTES',
  'TokenEditMode::Instance', 'TokenEditMode::Token', 'simple_var_token', 'selector_score',
  'property_candidates.len() != 1', 'selected_scope', 'confirm_shared_global',
  'conditional: bool', 'parent_conditional', 'property_candidates.iter().any(|candidate| candidate.conditional)',
  'Responsive/conditional CSS ownership', 'if definition.public.conditional',
  'breakpoint-aware token authoring is not deterministic in M2.2',
  'fs::symlink_metadata', 'canonical.starts_with(&root)', '.create_new(true)', 'file.sync_all()',
  'fs::rename(&temp, path)', 'rule_blocks(&content)', 'Source changed after token transaction resolution',
]) {
  if (!tokenTransaction.includes(token)) throw new Error(`Native token transaction missing ${token}`);
}
if (tokenTransaction.includes('Regex') || tokenTransaction.includes('sh -c') || tokenTransaction.includes('bash -c')) {
  throw new Error('Token editing must not use blind regex or interpolated shell mutation');
}

for (const token of [
  "'project_token_edit_probe'",
  "'project_token_transaction_preview'",
  "'project_token_transaction_commit'",
  'defaultTokenDecision',
  'tokenDecisionRequiresGlobalConfirmation',
  'conditional: boolean',
]) {
  if (!tokenClient.includes(token)) throw new Error(`Token client model missing ${token}`);
}

for (const token of [
  'Token-backed', 'Change scope', 'This element', 'Local scope', 'Global token', 'Use Codex',
  'I understand this changes the shared token', 'property-token-diff', 'Inspecting token ownership',
  '!definition.conditional', 'responsive/conditional token definition',
  'They stay read-only here until breakpoint-aware authoring exists',
]) {
  if (!properties.includes(token)) throw new Error(`Properties token UX missing ${token}`);
}
if (!styles.includes('.property-token-card') || !styles.includes('.property-token-confirm.required')) {
  throw new Error('Token scope product styles are missing');
}

for (const token of [
  'previewVisualTokenTransaction', 'commitVisualTokenTransaction', 'finishDirectVisualEdit',
  'checkpointVisualSourceTransaction', 'markBrowserEvidenceStale', 'recordSourceTransactionCheckpoint',
  "window.dispatchEvent(new CustomEvent('monument:source-transaction'", "tokenDecision?.mode === 'codex'",
]) {
  if (!intent.includes(token)) throw new Error(`Token generation/evidence handoff missing ${token}`);
}

console.log('Monument token-aware visual editing contract: PASS');
