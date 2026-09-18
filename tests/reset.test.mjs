import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
const read = path => readFileSync(path, 'utf8');
const main = read('src/main.js');
const entry = { date: '18/09/2026', m: 2, mm: 49, e: 1, em: 12, salt: 'Č🎱', main: [1, 49], extra: [12], created: '2026-09-18T12:00:00.000Z' };
const initial = () => [['lottoHistory', JSON.stringify([entry])], ['lottoLang', 'hr'], ['lottoTheme', 'light'], ['otherApp', 'untouched']];
function fixture(values = initial()) {
  const data = new Map(values), nodes = new Map(), messages = [], confirmations = [], removals = [];
  const $ = id => {
    if (!nodes.has(id)) nodes.set(id, { value: '', dataset: {}, textContent: '', innerHTML: '', hidden: false,
      appendChild() {}, querySelectorAll: () => [], setAttribute(key, value) { this[key] = value; } });
    return nodes.get(id);
  };
  const announce = (...args) => { messages.push(args); $(args[1]).textContent = args[0]; };
  announce.clear = () => {};
  const context = vm.createContext({ $, announce, confirmed: true, lastResult: structuredClone(entry), currentPreset: 'custom',
    copyResult() {}, saveResult() {}, renderPresets() {},
    document: { documentElement: { dataset: {} }, getElementById: $, querySelectorAll: () => [], createElement: () => ({}) },
    window: { confirm(message) { confirmations.push(message); return context.confirmed; }, matchMedia: () => ({ matches: true, addEventListener() {} }) },
    localStorage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem(key) { removals.push(key); data.delete(key); } }
  });
  for (const path of ['src/js/storage.js', 'src/js/generator.js', 'src/js/theme.js', 'src/data/translations.js', 'src/js/backup.js', 'src/js/info-modal.js']) {
    vm.runInContext(read(path).replace(/^import .*\r?\n/gm, '').replaceAll('export ', ''), context);
  }
  vm.runInContext('var { infoTr, applyInfoLanguage } = createInfoModalHandlers({ $ });', context);
  for (const name of ['tr', 'resultString', 'renderResult', 'renderHistory', 'applyLanguage']) vm.runInContext(main.split('\n').find(line => line.startsWith(`function ${name}(`)), context);
  vm.runInContext(main.split('\n').find(line => line.startsWith("$('resetStoredData').onclick=")), context);
  $('language').value = 'hr'; context.applyTheme(); context.applyLanguage(false);
  for (const [id, value] of Object.entries({ dateInput: 'unfinished date', salt: ' personal key ', mainCount: '7', mainMax: '55', extraCount: '2', extraMax: '13' })) $(id).value = value;
  const state = () => JSON.stringify({ nodes: [...nodes], result: context.lastResult, preset: context.currentPreset, document: context.document.documentElement });
  return { context, data, $, messages, confirmations, removals, state, run: () => $('resetStoredData').onclick(), status: () => $('backupStatus').dataset.infoI18n };
}
for (const empty of [true, false]) test(`Reset ${empty ? 'empty' : 'populated'} storage: only three keys, immediate defaults, unchanged unsaved input/result`, () => {
  const f = fixture(empty ? [] : initial());
  const result = JSON.stringify(f.context.lastResult);
  const ids = ['dateInput', 'salt', 'mainCount', 'mainMax', 'extraCount', 'extraMax'];
  const inputs = ids.map(id => f.$(id).value);
  f.run();
  assert.equal(f.status(), 'resetSucceeded');
  assert.deepEqual(f.removals, ['lottoHistory', 'lottoLang', 'lottoTheme']);
  assert.deepEqual([...f.data], empty ? [] : [['otherApp', 'untouched']]);
  assert.equal(f.$('historyWrap').hidden, true);
  assert.equal(f.$('historyList').innerHTML, '');
  assert.equal(f.$('language').value, 'en');
  assert.equal(f.context.document.documentElement.lang, 'en');
  assert.equal(f.$('themeSelect').value, 'system');
  assert.equal(f.context.document.documentElement.dataset.theme, 'dark');
  assert.equal(f.context.getLanguage(), 'en');
  assert.equal(f.context.getTheme(), 'system');
  assert.deepEqual(ids.map(id => f.$(id).value), inputs);
  assert.equal(JSON.stringify(f.context.lastResult), result);
  assert.equal(f.context.currentPreset, 'custom');
  assert.match(f.$('resultArea').innerHTML, /1, 49/);
  assert.match(f.$('resultArea').innerHTML, />Save</);
  assert.equal(f.messages.at(-1)[1], 'backupStatus');
});
test('Cancel preserves all storage, UI, inputs, result and status without announcements', () => {
  const f = fixture(), before = f.state(), stored = [...f.data];
  f.context.confirmed = false; f.run();
  assert.equal(f.state(), before);
  assert.deepEqual([...f.data], stored);
  assert.deepEqual(f.removals, []);
  assert.deepEqual(f.messages, []);
  assert.equal(f.confirmations.length, 1);
});
for (const failAt of [1, 2, 3]) test(`SecurityError at removal ${failAt}: successful rollback and no false success`, () => {
  const f = fixture(), before = new Map(f.data);
  let count = 0;
  f.context.localStorage.removeItem = key => { if (++count === failAt) throw new DOMException('Blocked', 'SecurityError'); f.data.delete(key); };
  f.run();
  assert.deepEqual(f.data, before);
  assert.equal(f.status(), 'resetFailed');
  assert.equal(f.$('language').value, 'hr');
  assert.equal(f.$('themeSelect').value, 'light');
  assert.ok(f.messages.every(([text]) => !text.includes('Stored data deleted')));
});
for (const missing of ['removeItem', 'storage', 'snapshot']) test(`Unavailable ${missing} is contained without success`, () => {
  const f = fixture(), before = new Map(f.data);
  if (missing === 'removeItem') delete f.context.localStorage.removeItem;
  if (missing === 'storage') delete f.context.localStorage;
  if (missing === 'snapshot') f.context.localStorage.getItem = () => { throw Error('read'); };
  assert.doesNotThrow(f.run);
  assert.deepEqual(f.data, before);
  assert.equal(f.status(), 'resetFailed');
});
test('Partial reset and failed rollback: distinct localized failure; attempt remaining rollback entries', () => {
  const f = fixture();
  f.context.localStorage.removeItem = key => { if (key === 'lottoTheme') throw Error('remove'); f.data.delete(key); };
  f.context.localStorage.setItem = (key, value) => { if (key === 'lottoLang') throw Error('rollback'); f.data.set(key, value); };
  f.run();
  assert.equal(f.status(), 'resetRollbackFailed');
  assert.equal(f.data.get('lottoHistory'), initial()[0][1]);
  assert.equal(f.data.has('lottoLang'), false);
  assert.equal(f.data.get('otherApp'), 'untouched');
  assert.equal(f.messages[0][0], vm.runInContext('RESET_T.hr.resetRollbackFailed', f.context));
});
test('Rollback preserves exact malformed, empty and absent values', () => {
  for (const history of [null, '', '{bad']) {
    const f = fixture(history === null ? [['lottoLang', '']] : [['lottoHistory', history], ['lottoLang', '']]);
    const before = new Map(f.data);
    f.context.localStorage.removeItem = key => { if (key === 'lottoTheme') throw Error('remove'); f.data.delete(key); };
    f.run(); assert.deepEqual(f.data, before); assert.equal(f.status(), 'resetFailed');
  }
});
test('All five languages provide all reset messages and confirmation uses current language', () => {
  const f = fixture(), translations = vm.runInContext('RESET_T', f.context);
  for (const lang of ['en', 'hr', 'de', 'it', 'es']) {
    assert.deepEqual(Object.keys(translations[lang]), Object.keys(translations.en));
    for (const value of Object.values(translations[lang])) assert.ok(value.trim());
    assert.equal(translations[lang].resetConfirm.split('•').length, 4);
    f.$('language').value = lang; f.context.confirmed = false; f.run();
    assert.equal(f.confirmations.at(-1), translations[lang].resetConfirm);
  }
});
test('Keyboard-accessible named native button and native confirmation; existing live status', () => {
  const html = read('index.html');
  assert.match(html, /<button type="button" class="btn secondary" id="resetStoredData" data-info-i18n="resetStoredData">Reset stored data<\/button>/);
  assert.match(read('src/js/backup.js'), /confirmReset = message => window.confirm\(message\)/);
  assert.match(html, /id="infoLiveStatus"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.doesNotMatch(read('src/js/storage.js'), /localStorage\.clear\(/);
});
