import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const lib = await readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8');
const secure = await readFile(new URL('../src-tauri/src/timeline_secure.rs', import.meta.url), 'utf8');
const host = await readFile(new URL('../src/host/native.ts', import.meta.url), 'utf8');

function handlerBody(source) {
  const match = source.match(/\.invoke_handler\(tauri::generate_handler!\[([\s\S]*?)\]\)/);
  assert.ok(match, 'Tauri invoke handler was not found');
  return match[1];
}

test('Timeline restore is exposed only through symlink-safe commands', () => {
  const handler = handlerBody(lib);
  assert.ok(lib.includes('mod timeline_secure;'));
  for (const command of ['timeline_restore_safe', 'timeline_back_safe', 'timeline_forward_safe']) {
    assert.ok(handler.includes(command), `safe Timeline command missing from invoke surface: ${command}`);
    assert.ok(secure.includes(`pub fn ${command}`), `safe Timeline command implementation missing: ${command}`);
    assert.ok(host.includes(`'${command}'`), `frontend Timeline wrapper does not invoke safe command: ${command}`);
  }
  for (const raw of ["'timeline_restore'", "'timeline_back'", "'timeline_forward'"]) {
    assert.ok(!host.includes(raw), `frontend Timeline wrapper leaked raw command: ${raw}`);
  }
  assert.ok(secure.includes('ensure_no_symlink_escape'));
  assert.ok(secure.includes('preflight'));
  assert.ok(secure.includes('current_id'));
  assert.ok(secure.includes('BTreeSet'));
});
