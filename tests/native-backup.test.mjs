
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const backup = readFileSync('src/js/backup.js', 'utf8');
const bridge = readFileSync('src/js/native-backup.js', 'utf8');
const main = readFileSync('src/main.js', 'utf8');
const capability = JSON.parse(readFileSync('src-tauri/capabilities/default.json', 'utf8'));

test('native bridge uses user-picked JSON paths and only native read/write text permissions', () => {
  for (const identifier of ['dialog:allow-open', 'dialog:allow-save', 'dialog:allow-message', 'fs:allow-read-text-file',
    'fs:allow-write-text-file']) assert.ok(capability.permissions.includes(identifier));
  assert.deepEqual(capability.windows, ['main']);
  assert.equal(capability.permissions.some(p => typeof p === 'string' &&
    /fs:write-all|fs:read-all|fs:scope|fs:default/.test(p)), false);
  assert.match(bridge, /await save\(/);
  assert.match(bridge, /return confirm\(message, \{ title: 'Date Lotto Generator', kind: 'warning' \}\)/);
  assert.match(bridge, /await open\(/);
  assert.match(bridge, /await writeTextFile\(path, content\)/);
  assert.match(bridge, /await readTextFile\(path\)/);
  assert.match(backup, /isNative\(\)/);
  assert.match(main, /return importBackup\(\)/);
});
