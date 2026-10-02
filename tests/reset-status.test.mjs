import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
const { INFO_T, SETTINGS_T } = await import(
  'data:text/javascript;base64,' +
  Buffer.from(readFileSync('src/data/translations.js', 'utf8')).toString('base64')
);

const backupSource = readFileSync('src/js/backup.js', 'utf8')
  .replace(/^import .*\r?\n/gm, '').replaceAll('export function', 'function');
const settingsSource = readFileSync('src/js/settings-modal.js', 'utf8')
  .replace(/^import .*\r?\n/gm, '').replace('export function', 'function');

test('Reset clears a previous exported backup path', async () => {
  const status = { dataset: { infoI18n: 'backupSaved', backupPath: 'C:\\backup.json' } };
  const ctx = vm.createContext({
    $: () => status,
    resetStoredData: () => 'resetSucceeded',
    window: {},
    onReset() {},
    announce() {}
  });
  vm.runInContext(backupSource, ctx);
  const handler = vm.runInContext(`createResetHandler({
    $, tr: key => key, onReset, announce,
    confirmReset: async () => true
  })`, ctx);
  await handler();
  assert.equal(status.dataset.infoI18n, 'resetSucceeded');
  assert.equal(status.dataset.backupPath, undefined);
});

test('Failed Reset confirmation also clears a previous exported path', async () => {
  const status = { dataset: { infoI18n: 'backupSaved', backupPath: 'C:\\backup.json' } };
  const ctx = vm.createContext({
    $: () => status, window: {}, onReset() {}, announce() {}
  });
  vm.runInContext(backupSource, ctx);
  const handler = vm.runInContext(`createResetHandler({
    $, tr: key => key, onReset, announce,
    confirmReset: async () => { throw new Error('IPC failure'); }
  })`, ctx);
  await handler();
  assert.equal(status.dataset.infoI18n, 'resetConfirmFailed');
  assert.equal(status.dataset.backupPath, undefined);
});

test('Settings displays export path only while backupSaved is active', () => {
  const status = { dataset: { infoI18n: 'resetSucceeded', backupPath: 'C:\\backup.json' }, textContent: '' };
  const nodes = {
    language: { value: 'en' },
    settingsX: { setAttribute() {}, title: '' },
    backupStatus: status
  };
  const ctx = vm.createContext({
    $: id => nodes[id],
    document: { querySelectorAll: () => [] },
    SETTINGS_T, INFO_T
  });
  vm.runInContext(settingsSource, ctx);
  const modal = vm.runInContext('createSettingsModalHandlers({ $ })', ctx);
  modal.applySettingsLanguage();
  assert.equal(status.textContent, INFO_T.en.resetSucceeded);
  status.dataset.infoI18n = 'backupSaved';
  modal.applySettingsLanguage();
  assert.equal(status.textContent, INFO_T.en.backupSaved + ' C:\\backup.json');
});
