import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { test } from 'node:test';

const load = source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const storage = await load(readFileSync('src/js/storage.js', 'utf8'));
const generator = await load(readFileSync('src/js/generator.js', 'utf8'));
const valid = { date: '17/09/2026', m: 6, mm: 49, e: 0, em: 12, salt: '',
  main: [1, 2, 3, 4, 5, 6], extra: [], created: '2026-09-17T12:00:00.000Z' };
let data;
function reset(raw) {
  data = new Map(raw === undefined ? [] : [['lottoHistory', raw]]);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value)
  } });
}

test('empty, malformed and wrong-shaped storage', () => {
  for (const raw of [undefined, '', '{', '{}', 'null', '[{}]', '[null,1,"x",[]]']) {
    reset(raw);
    assert.deepEqual(storage.getHistory(), []);
  }
});

test('existing records retain fields, order and both date formats; filter before limit', () => {
  const records = Array.from({ length: 35 }, (_, i) => ({ ...valid, salt: String(i),
    date: i % 2 ? '2026-09-17' : valid.date, customField: i }));
  reset(JSON.stringify([{}, ...records]));
  assert.deepEqual(storage.getHistory(), records.slice(0, 30));
  assert.equal(storage.addHistory(valid), true);
  assert.deepEqual(storage.getHistory(), [valid, ...records.slice(0, 29)]);
});

test('reject incomplete, nonnumeric, out-of-range and duplicate records', () => {
  const invalid = [null, {}, { ...valid, date: 42 }, { ...valid, main: null },
    { ...valid, main: [1, 2, 3, 4, 5, '6'] }, { ...valid, main: [0, 2, 3, 4, 5, 6] },
    { ...valid, main: [1, 1, 3, 4, 5, 6] }, { ...valid, main: [1, 2, 3, 4, 5, 50] },
    { ...valid, m: 0 }, { ...valid, m: 21 }, { ...valid, mm: 100 },
    { ...valid, e: -1 }, { ...valid, e: 11 }, { ...valid, em: 0 },
    { ...valid, extra: {} }, { ...valid, salt: null }, { ...valid, created: null }];
  reset(JSON.stringify([...invalid, valid, ...invalid, valid]));
  assert.deepEqual(storage.getHistory(), [valid, valid]);
});

test('normal Save/Delete and theme/language round trips', () => {
  reset();
  assert.equal(storage.getTheme(), 'system');
  assert.equal(storage.getLanguage(), 'en');
  assert.equal(storage.addHistory(valid), true);
  const history = storage.getHistory();
  assert.deepEqual(history, [valid]);
  assert.equal(storage.deleteHistory(history, 0), true);
  assert.deepEqual(storage.getHistory(), []);
  assert.equal(storage.setTheme('light'), true);
  assert.equal(storage.setLanguage('hr'), true);
  assert.equal(storage.getTheme(), 'light');
  assert.equal(storage.getLanguage(), 'hr');
  assert.deepEqual([...data.keys()], ['lottoHistory', 'lottoTheme', 'lottoLang']);
});

test('language storage accepts only the five supported values', () => {
  for (const language of ['en', 'hr', 'de', 'it', 'es', 'fr', '', 'HR', ' hr', 'hr ', 'constructor']) {
    reset();
    data.set('lottoLang', language);
    assert.equal(storage.getLanguage(), ['en', 'hr', 'de', 'it', 'es'].includes(language) ? language : 'en');
    assert.equal(data.get('lottoLang'), language, 'reading must not write');
  }
});

test('actual language initialization and change handler restore and persist the selection', () => {
  const source = readFileSync('src/main.js', 'utf8');
  const lines = source.split('\n');
  const elements = new Map();
  const context = vm.createContext({ ...storage, lastResult: null, announce: { clear() {} },
    $: id => { if (!elements.has(id)) elements.set(id, { value: '' }); return elements.get(id); },
    document: { documentElement: {}, querySelectorAll: () => [] },
    applyTheme() {}, renderPresets() {}, renderHistory() {}, applyInfoLanguage() {},
    selectPreset() {}, generate() {}, reset() {}, selectTheme() {}, toggleFullscreen() {} });
  vm.runInContext(lines.find(line => line.startsWith('function applyLanguage(')), context);
  vm.runInContext(lines.find(line => line.startsWith("$('generateBtn').onclick=")), context);
  const init = lines.find(line => line.startsWith('(function init()'));
  for (const saved of [undefined, 'hr', 'de', 'it', 'es', 'en', 'fr']) {
    reset();
    if (saved !== undefined) data.set('lottoLang', saved);
    const operations = [];
    localStorage.getItem = key => { operations.push(`read:${key}`); return data.get(key) ?? null; };
    localStorage.setItem = (key, value) => { operations.push(`write:${key}`); data.set(key, value); };
    vm.runInContext(init, context);
    const expected = saved === undefined || saved === 'fr' ? 'en' : saved;
    assert.equal(elements.get('language').value, expected);
    assert.equal(context.document.documentElement.lang, expected);
    assert.equal(data.get('lottoLang'), expected);
    assert.deepEqual(operations, ['read:lottoLang', 'write:lottoLang']);
  }
  reset();
  localStorage.getItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
  assert.doesNotThrow(() => vm.runInContext(init, context));
  assert.equal(elements.get('language').value, 'en');
  assert.equal(context.document.documentElement.lang, 'en');
  reset();
  for (const language of ['hr', 'de', 'it', 'es', 'en']) {
    elements.get('language').value = language;
    elements.get('language').onchange();
    assert.equal(data.get('lottoLang'), language);
    elements.get('language').value = '';
    vm.runInContext(init, context);
    assert.equal(elements.get('language').value, language);
    assert.equal(context.document.documentElement.lang, language);
  }
});

test('SecurityError from getItem or localStorage getter and unavailable storage', () => {
  for (const mode of ['getItem', 'getter', 'missing']) {
    reset();
    const fail = () => { throw new DOMException('Blocked', 'SecurityError'); };
    if (mode === 'getItem') localStorage.getItem = fail;
    if (mode === 'getter') Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: fail });
    if (mode === 'missing') delete globalThis.localStorage;
    assert.deepEqual(storage.getHistory(), []);
    assert.equal(storage.getTheme(), 'system');
    assert.equal(storage.getLanguage(), 'en');
    if (mode !== 'getItem') assert.equal(storage.addHistory(valid), false);
  }
});

test('write failures report false and preserve persisted and caller history', () => {
  for (const name of ['SecurityError', 'QuotaExceededError']) {
    reset(JSON.stringify([valid]));
    const history = storage.getHistory();
    localStorage.setItem = () => { throw new DOMException('Blocked', name); };
    assert.equal(storage.addHistory(valid), false);
    assert.equal(storage.deleteHistory(history, 0), false);
    assert.equal(storage.setTheme('light'), false);
    assert.equal(storage.setLanguage('hr'), false);
    assert.deepEqual(history, [valid]);
    assert.deepEqual(storage.getHistory(), [valid]);
  }
});

test('actual Save/History handlers: corrupt history renders safely; failed save resets Saved', () => {
  const source = readFileSync('src/main.js', 'utf8');
  const elements = new Map();
  const element = () => ({ textContent: '', innerHTML: '', rows: [],
    appendChild(row) { this.rows.push(row); }, querySelectorAll() { return []; } });
  const announcements = [];
  const context = vm.createContext({ announce: message => announcements.push(message), ...storage, displayDate: generator.displayDate,
    lastResult: valid, tr: key => key,
    $: id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    document: { createElement: element } });
  for (const name of ['resultString', 'saveResult', 'renderHistory']) {
    vm.runInContext(source.split('\n').find(line => line.startsWith(`function ${name}(`)), context);
  }
  for (const raw of ['{', '{}', 'null', '[{}]']) {
    reset(raw);
    vm.runInContext('renderHistory()', context);
    assert.equal(elements.get('historyWrap').hidden, true);
  }
  reset();
  vm.runInContext('saveResult()', context);
  assert.equal(elements.get('saveBtn').textContent, 'saved');
  assert.deepEqual(announcements, ['saved']);
  assert.equal(elements.get('historyWrap').hidden, false);
  assert.match(elements.get('historyList').rows[0].innerHTML, /1, 2, 3, 4, 5, 6/);
  localStorage.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); };
  vm.runInContext('saveResult()', context);
  assert.equal(elements.get('saveBtn').textContent, 'save');
  assert.deepEqual(announcements, ['saved', 'saveFailed']);
  assert.deepEqual(storage.getHistory(), [valid]);
});

test('Lotto regression against branch HEAD: presets, custom boundaries, dates and salts', async () => {
  const baselineSource = execFileSync('git', ['show', 'HEAD:src/js/generator.js'], { encoding: 'utf8' });
  assert.equal(readFileSync('src/js/generator.js', 'utf8').replace(/\r\n/g, '\n'), baselineSource.replace(/\r\n/g, '\n'));
  const baseline = await load(baselineSource);
  const { presets } = await load(readFileSync('src/data/presets.js', 'utf8'));
  const configurations = [...presets, { m: 1, mm: 1, e: 0, em: 1 },
    { m: 20, mm: 99, e: 10, em: 99 }, { m: 20, mm: 20, e: 10, em: 10 }];
  const draw = (g, p, date, salt) => {
    const parsed = g.parseDMY(date);
    const seed = `${parsed.iso}|${p.m}|${p.mm}|${p.e}|${p.em}|${salt}`;
    return [g.uniqueNums(p.m, p.mm, g.mulberry32(g.hash32(seed + '|main'))),
      p.e ? g.uniqueNums(p.e, p.em, g.mulberry32(g.hash32(seed + '|extra'))) : []];
  };
  let count = 0;
  for (const p of configurations) for (const date of ['01/01/1000', '29/02/2024', '17/09/2026', '31/12/9999']) {
    for (const salt of ['', 'test', 'ČćŽž🎱']) {
      assert.deepEqual(draw(generator, p, date, salt), draw(baseline, p, date, salt));
      count++;
    }
  }
  assert.equal(count, 120);
  for (const date of ['29/02/2023', '00/01/2026', '31/04/2026', '01/01/0999']) {
    assert.equal(generator.parseDMY(date), null);
  }
});
