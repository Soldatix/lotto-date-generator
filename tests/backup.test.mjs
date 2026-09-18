import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const read = path => readFileSync(path, 'utf8');
const main = read('src/main.js');
const html = read('index.html');
const entry = { date: '18/09/2026', m: 2, mm: 49, e: 1, em: 12,
  salt: 'Personal <img src=x onerror=alert(1)> Č🎱', main: [1, 49], extra: [12], created: '2026-09-18T12:00:00.000Z' };
const backup = () => ({ app: 'date-lotto-generator', version: 1, exportedAt: '2026-09-18T12:00:00.000Z',
  data: { history: [structuredClone(entry)], language: 'hr', theme: 'dark' } });
const plain = value => JSON.parse(JSON.stringify(value));
function fixture(initial = [['lottoHistory', '[]'], ['lottoLang', 'en'], ['lottoTheme', 'light'], ['otherApp', 'unchanged']]) {
  const data = new Map(initial), nodes = new Map(), calls = [], links = [];
  const $ = id => {
    if (!nodes.has(id)) nodes.set(id, { value: '', dataset: {}, textContent: '', innerHTML: '', rows: [],
      appendChild(row) { this.rows.push(row); }, querySelectorAll: () => [],
      click() { calls.push(id); }, setAttribute(key, value) { this[key] = value; } });
    return nodes.get(id);
  };
  const document = { documentElement: { dataset: {} }, getElementById: $, querySelectorAll: () => [],
    body: { appendChild(link) { links.push(link); } },
    createElement: () => ({ click() { calls.push('download'); }, remove() { calls.push('remove'); } }) };
  const context = vm.createContext({ $, document, Blob, URL: {
    createObjectURL(blob) { context.blob = blob; return 'blob:test'; }, revokeObjectURL(url) { calls.push(url); }
  }, setTimeout(fn) { fn(); }, window: { confirm(message) { calls.push(message); return context.confirmed; },
    matchMedia: () => ({ matches: true, addEventListener() {} }) },
    localStorage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) },
    confirmed: true, announce: { clear() {} }, lastResult: null,
    renderPresets() {}, applyInfoLanguage() {} });
  for (const path of ['src/js/storage.js', 'src/js/generator.js', 'src/js/theme.js', 'src/data/translations.js', 'src/js/backup.js']) {
    vm.runInContext(read(path).replace(/^import .*\r?\n/gm, '').replaceAll('export ', ''), context);
  }
  for (const name of ['tr', 'resultString', 'renderHistory', 'applyLanguage']) {
    vm.runInContext(main.split('\n').find(line => line.startsWith(`function ${name}(`)), context);
  }
  context.infoTr = key => vm.runInContext('INFO_T', context)[$('language').value || 'en'][key];
  for (const line of main.split('\n').filter(line => line.startsWith('const { exportBackup, importBackup }=') || /^\$\('(exportBackup|importBackup|backupFile)'\)/.test(line))) vm.runInContext(line, context);
  const importFile = async (text, name = 'backup.json') => {
    $('backupFile').files = [{ name, text: async () => text }];
    await $('backupFile').onchange();
  };
  return { context, data, $, calls, links, importFile, status: () => $('backupStatus').dataset.infoI18n };
}

test('empty export: defaults, exact schema, dated JSON download and no storage writes', async () => {
  const f = fixture([]);
  f.$('exportBackup').onclick();
  assert.equal(f.context.blob.type, 'application/json');
  const result = JSON.parse(await f.context.blob.text());
  assert.deepEqual(result.data, { history: [], language: 'en', theme: 'system' });
  assert.deepEqual(Object.keys(result), ['app', 'version', 'exportedAt', 'data']);
  assert.equal(result.app, 'date-lotto-generator');
  assert.equal(result.version, 1);
  assert.equal(new Date(result.exportedAt).toISOString(), result.exportedAt);
  assert.match(f.links[0].download, /^date-lotto-generator-backup-\d{4}-\d{2}-\d{2}\.json$/);
  assert.deepEqual([...f.data], []);
  assert.deepEqual(f.calls, ['download', 'remove', 'blob:test']);
});

test('History, language, theme and Personal Key round trip; exports only app fields', async () => {
  const f = fixture([['lottoHistory', JSON.stringify([{ ...entry, arbitrary: 'omit' }])], ['lottoLang', 'it'], ['lottoTheme', 'system'], ['other', 'private']]);
  const before = [...f.data];
  f.$('exportBackup').onclick();
  const text = await f.context.blob.text();
  assert.deepEqual(JSON.parse(text).data, { history: [entry], language: 'it', theme: 'system' });
  assert.deepEqual([...f.data], before);
  const restored = fixture();
  await restored.importFile(text);
  assert.deepEqual(plain(restored.context.getHistory()), [entry]);
  assert.equal(restored.context.getLanguage(), 'it');
  assert.equal(restored.context.getTheme(), 'system');
  assert.equal(restored.data.get('otherApp'), 'unchanged');
});

test('successful restore immediately runs actual History/Language/Theme integration without reload', async () => {
  const f = fixture();
  await f.importFile(JSON.stringify(backup()));
  assert.equal(f.status(), 'backupRestored');
  assert.equal(f.$('language').value, 'hr');
  assert.equal(f.context.document.documentElement.lang, 'hr');
  assert.equal(f.$('themeSelect').value, 'dark');
  assert.equal(f.context.document.documentElement.dataset.theme, 'dark');
  assert.equal(f.$('historyWrap').hidden, false);
  assert.match(f.$('historyList').rows[0].innerHTML, /1, 49/);
  assert.doesNotMatch(f.$('historyList').rows[0].innerHTML, /onerror/);
  assert.equal(f.$('backupStatus').textContent, 'Sigurnosna kopija je vraćena.');
  assert.equal(f.$('backupFile').value, '');
});

const invalid = {
  'malformed JSON': () => '{',
  'wrong app': b => { b.app = 'other'; },
  'unsupported version': b => { b.version = 2; },
  'string version': b => { b.version = '1'; },
  'invalid history entry': b => { b.data.history[0].main = [1, 1]; },
  'mixed valid and invalid history': b => { b.data.history.push({}); },
  'history is not array': b => { b.data.history = {}; },
  'over history limit': b => { b.data.history = Array(31).fill(entry); },
  'invalid language': b => { b.data.language = 'fr'; },
  'invalid theme': b => { b.data.theme = 'auto'; },
  'extra state': b => { b.data.personalKey = 'not allowed'; },
  'extra envelope field': b => { b.unknown = true; },
  'extra history field': b => { b.data.history[0].unknown = true; },
  'missing field': b => { delete b.data.history[0].salt; },
  'invalid timestamp': b => { b.exportedAt = '2026-02-30T12:00:00.000Z'; },
  'null root': () => 'null'
};
for (const [name, mutate] of Object.entries(invalid)) test(`reject ${name} before confirmation or any writes`, async () => {
  const f = fixture(), before = [...f.data], b = backup();
  const text = mutate(b);
  await f.importFile(typeof text === 'string' ? text : JSON.stringify(b));
  assert.equal(f.status(), 'backupInvalid');
  assert.deepEqual([...f.data], before);
  assert.deepEqual(f.calls, []);
});

test('reject non-JSON filename and unreadable file; no changes', async () => {
  const f = fixture(), before = [...f.data];
  await f.importFile(JSON.stringify(backup()), 'backup.txt');
  assert.equal(f.status(), 'backupInvalid');
  f.$('backupFile').files = [{ name: 'backup.json', text: async () => { throw Error('read'); } }];
  await f.$('backupFile').onchange();
  assert.equal(f.status(), 'backupInvalid');
  assert.deepEqual([...f.data], before);
});

test('cancel confirmation or file picker without changing data', async () => {
  const f = fixture(), before = [...f.data];
  f.context.confirmed = false;
  await f.importFile(JSON.stringify(backup()));
  assert.equal(f.status(), 'backupCancelled');
  assert.deepEqual([...f.data], before);
  f.$('backupFile').files = [];
  await f.$('backupFile').onchange();
  assert.deepEqual([...f.data], before);
  assert.equal(f.calls.length, 1);
});

for (const absent of [false, true]) for (const failAt of [1, 2, 3]) test(`write ${failAt} fails: rollback preserves ${absent ? 'absent' : 'existing'} keys`, async () => {
  const f = fixture(absent ? [] : undefined), before = [...f.data];
  let writes = 0;
  f.context.localStorage.setItem = (key, value) => { if (++writes === failAt) throw Error('quota'); f.data.set(key, value); };
  await f.importFile(JSON.stringify(backup()));
  assert.equal(f.status(), 'restoreFailed');
  assert.deepEqual([...f.data], before);
  assert.equal(f.$('language').value, '');
});

test('snapshot read failure writes nothing; persistent rollback failure is reported honestly', async () => {
  const f = fixture(), before = [...f.data];
  f.context.localStorage.getItem = () => { throw Error('blocked'); };
  await f.importFile(JSON.stringify(backup()));
  assert.equal(f.status(), 'restoreFailed');
  assert.deepEqual([...f.data], before);
  const g = fixture();
  let writes = 0;
  g.context.localStorage.setItem = (key, value) => { if (++writes > 1) throw Error('blocked'); g.data.set(key, value); };
  await g.importFile(JSON.stringify(backup()));
  assert.equal(g.status(), 'rollbackFailed');
});

test('empty restore clears history and all supported language/theme values restore', async () => {
  for (const language of ['en', 'hr', 'de', 'it', 'es']) for (const theme of ['light', 'dark', 'system']) {
    const f = fixture(), b = backup();
    b.data = { history: [], language, theme };
    await f.importFile(JSON.stringify(b));
    assert.equal(f.status(), 'backupRestored');
    assert.equal(f.$('historyWrap').hidden, true);
    assert.equal(f.context.document.documentElement.lang, language);
    assert.equal(f.$('themeSelect').value, theme);
  }
});

test('all five languages have every UI, confirmation and status message', () => {
  const f = fixture();
  const translations = vm.runInContext('BACKUP_T', f.context);
  const keys = Object.keys(translations.en);
  assert.equal(keys.length, 12);
  for (const lang of ['en', 'hr', 'de', 'it', 'es']) {
    assert.deepEqual(Object.keys(translations[lang]), keys);
    for (const key of keys) assert.ok(translations[lang][key].trim());
  }
  assert.doesNotMatch(read('src/js/backup.js'), /innerHTML/);
});

test('native keyboard controls keep visible names and activate named hidden JSON input', () => {
  for (const id of ['exportBackup', 'importBackup']) {
    const button = html.match(new RegExp(`<button[^>]*id="${id}"[^>]*>[^<]+<\\/button>`))[0];
    assert.match(button, /type="button"/);
    assert.match(button, /data-info-i18n=/);
    assert.doesNotMatch(button, /tabindex="-1"|disabled|hidden/);
  }
  assert.match(html, /<input type="file" id="backupFile" accept="\.json,application\/json" hidden aria-labelledby="importBackup">/);
  const f = fixture();
  f.$('importBackup').onclick();
  assert.deepEqual(f.calls, ['backupFile']);
});
