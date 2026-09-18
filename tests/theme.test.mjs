import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const read = path => readFileSync(path, 'utf8');
const main = read('src/main.js');
const html = read('index.html');
function fixture(saved, dark = false, data = new Map(saved === undefined ? [] : [['lottoTheme', saved]])) {
  const listeners = [];
  const media = { matches: dark, addEventListener(type, fn) { assert.equal(type, 'change'); listeners.push(fn); } };
  const elements = new Map();
  const $ = id => { if (!elements.has(id)) elements.set(id, { value: '' }); return elements.get(id); };
  const context = vm.createContext({ $, document: { documentElement: { dataset: {} }, getElementById: $ },
    window: { matchMedia(query) { assert.equal(query, '(prefers-color-scheme: dark)'); return media; } },
    localStorage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) },
    generate() {}, reset() {}, applyLanguage() {}, toggleFullscreen() {} });
  vm.runInContext(read('src/js/storage.js').replace(/^import .*\r?\n/gm, '').replaceAll('export ', ''), context);
  vm.runInContext(read('src/js/theme.js').replace(/^import .*\r?\n/, '').replaceAll('export ', ''), context);
  vm.runInContext(main.split('\n').find(line => line.startsWith("$('generateBtn').onclick=")), context);
  context.applyTheme();
  return { context, data, listeners, $, appearance: () => context.document.documentElement.dataset.theme,
    os(value) { media.matches = value; listeners.forEach(fn => fn({ matches: value })); },
    choose(value) { $('themeSelect').value = value; $('themeSelect').onchange({ target: $('themeSelect') }); } };
}

for (const saved of [undefined, 'light', 'dark', 'system', 'invalid', '', 'DARK', ' light', 'constructor']) {
  for (const dark of [false, true]) test(`theme initialization: saved=${JSON.stringify(saved)}, OS=${dark ? 'dark' : 'light'}`, () => {
    const f = fixture(saved, dark);
    const mode = ['light', 'dark'].includes(saved) ? saved : 'system';
    assert.equal(f.$('themeSelect').value, mode);
    assert.equal(f.appearance(), mode === 'system' ? (dark ? 'dark' : 'light') : mode);
    assert.equal(f.data.get('lottoTheme'), saved, 'initialization does not overwrite existing storage');
  });
}

test('System responds immediately in both directions; manual modes ignore OS changes', () => {
  const f = fixture();
  for (const mode of ['system', 'light', 'dark', 'system']) {
    f.choose(mode);
    for (const dark of [true, false, true, false]) {
      f.os(dark);
      assert.equal(f.appearance(), mode === 'system' ? (dark ? 'dark' : 'light') : mode);
      assert.equal(f.$('themeSelect').value, mode);
      assert.equal(f.data.get('lottoTheme'), mode);
    }
  }
});

test('every mode persists through a fresh module/document initialization', () => {
  const f = fixture();
  for (const mode of ['light', 'dark', 'system']) {
    f.choose(mode);
    const reloaded = fixture(undefined, true, f.data);
    assert.equal(reloaded.$('themeSelect').value, mode);
    assert.equal(reloaded.appearance(), mode === 'light' ? 'light' : 'dark');
  }
});

test('repeated initialization and mode changes never duplicate OS listeners', () => {
  const f = fixture();
  for (let i = 0; i < 20; i++) {
    f.context.applyTheme();
    f.choose(i % 2 ? 'system' : 'light');
  }
  assert.equal(f.listeners.length, 1);
  f.os(true);
  assert.equal(f.appearance(), 'dark');
});

test('failed persistence still applies the current user choice and follows OS in System', () => {
  const f = fixture();
  f.context.localStorage.setItem = () => { throw new Error('blocked'); };
  f.choose('dark');
  assert.equal(f.appearance(), 'dark');
  f.choose('system');
  f.os(true);
  assert.equal(f.appearance(), 'dark');
  f.os(false);
  assert.equal(f.appearance(), 'light');
});

test('native theme select translates its visible options, accessible name and title in all five languages', () => {
  const f = fixture();
  vm.runInContext(read('src/data/translations.js').replaceAll('export ', ''), f.context);
  const markup = html.match(/<select id="themeSelect"[^>]*>(.*?)<\/select>/s)[0];
  assert.match(markup, /data-i18n-name="themeLabel"/);
  assert.match(markup, /aria-label="Theme"/);
  const options = [...markup.matchAll(/<option value="([^"]+)" data-i18n="([^"]+)"/g)]
    .map(([, value, key]) => ({ value, dataset: { i18n: key } }));
  assert.deepEqual(options.map(o => o.value), ['light', 'dark', 'system']);
  const select = f.$('themeSelect');
  select.dataset = { i18nName: 'themeLabel' };
  select.setAttribute = (key, value) => { select[key] = value; };
  f.context.document.querySelectorAll = selector => selector === '[data-i18n]' ? options : selector === '[data-i18n-name]' ? [select] : [];
  Object.assign(f.context, { announce: { clear() {} }, lastResult: null,
    renderPresets() {}, renderHistory() {}, applyInfoLanguage() {}, webInstall: { applyLanguage() {} } });
  for (const name of ['tr', 'applyLanguage']) vm.runInContext(main.split('\n').find(line => line.startsWith(`function ${name}(`)), f.context);
  const expected = { en: ['Theme', 'Light', 'Dark', 'System'], hr: ['Tema', 'Svijetla', 'Tamna', 'Sustav'],
    de: ['Design', 'Hell', 'Dunkel', 'System'], it: ['Tema', 'Chiaro', 'Scuro', 'Sistema'], es: ['Tema', 'Claro', 'Oscuro', 'Sistema'] };
  for (const [language, texts] of Object.entries(expected)) {
    f.$('language').value = language;
    f.context.applyLanguage();
    assert.equal(select['aria-label'], texts[0]);
    assert.equal(select.title, texts[0]);
    assert.deepEqual(options.map(o => o.textContent), texts.slice(1));
    assert.equal(select.value, 'system');
  }
});
