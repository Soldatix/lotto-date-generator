import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const read = path => readFileSync(path, 'utf8');
const load = source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const { createLiveStatus } = await load(read('src/js/accessibility.js'));
const { T } = await load(read('src/data/translations.js'));
const { presets } = await load(read('src/data/presets.js'));
const generator = await load(read('src/js/generator.js'));
const main = read('src/main.js');
const html = read('index.html');
const runFunction = (context, name) => vm.runInContext(main.split('\n').find(line => line.startsWith(`function ${name}(`)), context);

test('all input labels and persistent polite status regions are connected', () => {
  for (const id of ['dateInput', 'mainCount', 'mainMax', 'extraCount', 'extraMax', 'salt']) {
    assert.match(html, new RegExp(`<label for="${id}"[^>]*>`));
    assert.equal([...html.matchAll(new RegExp(`id="${id}"`, 'g'))].length, 1);
  }
  assert.doesNotMatch(html, /aria-label="Date in/);
  for (const id of ['liveStatus', 'infoLiveStatus']) {
    assert.match(html, new RegExp(`id="${id}"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"`));
  }
  assert.ok(html.indexOf('id="infoLiveStatus"') > html.indexOf('role="dialog"'));
});

test('preset selection and every numeric input keep pressed state synchronized', () => {
  const elements = new Map();
  const element = () => ({ children: [], attributes: {}, listeners: {},
    set innerHTML(value) { this.children = []; },
    setAttribute(key, value) { this.attributes[key] = value; },
    appendChild(child) { this.children.push(child); },
    addEventListener(event, callback) { this.listeners[event] = callback; } });
  const $ = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
  const context = vm.createContext({ $, presets, currentPreset: '6', tr: key => key,
    document: { createElement: element } });
  for (const name of ['renderPresets', 'selectPreset']) runFunction(context, name);
  const check = id => {
    assert.equal($('presets').children.length, presets.length);
    $('presets').children.forEach((button, i) => {
      assert.equal(button.attributes['aria-pressed'], String(presets[i].id === id));
      assert.equal(button.className.includes('active'), presets[i].id === id);
    });
  };
  for (const preset of presets) { context.selectPreset(preset.id); check(preset.id); }
  vm.runInContext(main.split('\n').find(line => line.startsWith("['mainCount'")), context);
  for (const id of ['mainCount', 'mainMax', 'extraCount', 'extraMax']) {
    context.selectPreset('6');
    $(id).listeners.input();
    check('custom');
  }
});

test('language change updates all four toolbar names and titles without announcing results', () => {
  const controls = [...html.matchAll(/data-i18n-name="([^"]+)"/g)].map(match => ({
    dataset: { i18nName: match[1] }, setAttribute(key, value) { this[key] = value; }
  }));
  assert.equal(controls.length, 4);
  const language = { value: 'en' };
  let clears = 0;
  const context = vm.createContext({ $: () => language, lastResult: {},
    tr: key => T[language.value][key], announce: { clear() { clears++; } },
    document: { documentElement: {}, querySelectorAll: selector => selector === '[data-i18n-name]' ? controls : [] },
    renderPresets() {}, renderResult() {}, renderHistory() {}, applyInfoLanguage() {}, setLanguage() {} });
  runFunction(context, 'applyLanguage');
  for (const lang of ['en', 'hr', 'de', 'it', 'es']) {
    language.value = lang;
    context.applyLanguage();
    assert.equal(context.document.documentElement.lang, lang);
    for (const control of controls) {
      const text = T[lang][control.dataset.i18nName];
      assert.ok(text);
      assert.equal(control['aria-label'], text);
      assert.equal(control.title, text);
    }
    assert.ok(T[lang].saveFailed);
  }
  assert.equal(clears, 5);
});

test('generation announces the actual result, including repeated draws, but rejects invalid input', () => {
  const elements = Object.fromEntries(Object.entries({ dateInput: '17/09/2026', mainCount: '6', mainMax: '49', extraCount: '0', extraMax: '12', salt: '' }).map(([id, value]) => [id, { value }]));
  const messages = [];
  const context = vm.createContext({ ...generator, $: id => elements[id], tr: key => T.en[key],
    announce: text => messages.push(text), renderResult() {}, alert() {} });
  for (const name of ['validate', 'generate', 'resultString']) runFunction(context, name);
  context.generate();
  assert.equal(messages[0], `${T.en.result}: ${context.resultString(context.lastResult)}`);
  context.generate();
  assert.equal(messages[1], messages[0]);
  elements.mainCount.value = '0';
  context.generate();
  assert.equal(messages.length, 2);
});

test('live status repeats identical messages, coalesces rapid updates and cancels on clear', async () => {
  const regions = { liveStatus: { textContent: '' }, infoLiveStatus: { textContent: '' } };
  const announce = createLiveStatus({ $: id => regions[id] });
  const settle = () => new Promise(resolve => setTimeout(resolve, 130));
  announce('Copied!');
  await settle();
  assert.equal(regions.liveStatus.textContent, 'Copied!');
  announce('Copied!');
  assert.equal(regions.liveStatus.textContent, '');
  await settle();
  assert.equal(regions.liveStatus.textContent, 'Copied!');
  announce('Saved');
  announce('Save failed');
  announce('Wallet copied', 'infoLiveStatus');
  await settle();
  assert.equal(regions.liveStatus.textContent, 'Save failed');
  assert.equal(regions.infoLiveStatus.textContent, 'Wallet copied');
  announce('Pending');
  announce.clear();
  await settle();
  assert.equal(regions.liveStatus.textContent, '');
  assert.equal(regions.infoLiveStatus.textContent, '');
});

test('Light info-kicker contrast exceeds 4.5:1 on its actual mixed background', () => {
  const css = read('src/styles/main.css');
  const hex = value => value.match(/../g).map(channel => parseInt(channel, 16));
  const color = css.match(/html\[data-theme="light"\] \.info-kicker\{color:#([\da-f]{6})/)[1];
  const root = css.slice(0, css.indexOf('html[data-theme="dark"]'));
  const input = hex(root.match(/--input:#([\da-f]{6})/)[1]);
  const panel = hex(root.match(/--panel:#([\da-f]{6})/)[1]);
  assert.match(css, /background:color-mix\(in srgb,var\(--input\) 65%,var\(--panel\)\)/);
  const background = input.map((channel, i) => channel * .65 + panel[i] * .35);
  const luminance = rgb => rgb.map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
  const ratio = foreground => (luminance(background) + .05) / (luminance(foreground) + .05);
  assert.ok(ratio(hex(color)) >= 4.5);
  assert.ok(ratio(hex(color)) > ratio(hex('1fdba5')));
  console.log(`info-kicker contrast: ${ratio(hex('1fdba5')).toFixed(2)} -> ${ratio(hex(color)).toFixed(2)}:1`);
});
