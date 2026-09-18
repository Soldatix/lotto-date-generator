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
const { INFO_T } = await load(read('src/data/translations.js'));

function modalFixture() {
  const document = { body: { style: {} }, listeners: {},
    addEventListener(type, handler) { this.listeners[type] = handler; } };
  const element = (attributes = '') => ({
    dataset: { infoI18n: attributes.match(/data-info-i18n="([^"]+)"/)?.[1] },
    isConnected: true, tabIndex: 0, disabled: false, visible: true,
    textContent: '', listeners: {},
    focus() { if (this.isConnected && !this.disabled && this.visible) document.activeElement = this; },
    matches() { return this.disabled; },
    getClientRects() { return this.visible ? [{}] : []; },
    setAttribute(key, value) { this[key] = value; },
    addEventListener(type, handler) { this.listeners[type] = handler; }
  });
  const markup = html.slice(html.indexOf('<div class="info-overlay"'));
  const controls = [...markup.matchAll(/<(button|a)\b([^>]*)>/g)].map(([, tag, attributes]) =>
    Object.assign(element(attributes), { tag, attributes }));
  const elements = { infoBtn: element(), language: { value: 'en' } };
  for (const control of controls) {
    const id = control.attributes.match(/id="([^"]+)"/)?.[1];
    if (id) elements[id] = control;
  }
  const classes = new Set();
  elements.infoOverlay = Object.assign(element(), {
    classList: { add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value) },
    querySelectorAll: () => controls
  });
  document.querySelectorAll = selector => selector === '.copy-wallet'
    ? controls.filter(control => control.attributes.includes('copy-wallet'))
    : controls.filter(control => control.dataset.infoI18n);
  const context = vm.createContext({ document, INFO_T, $: id => elements[id],
    getComputedStyle: () => ({ visibility: 'visible' }), copyWallet() {} });
  vm.runInContext(read('src/js/info-modal.js').replace(/^import .*\r?\n/, '').replace('export function', 'function'), context);
  vm.runInContext('var { openInfo, closeInfo, applyInfoLanguage, handleInfoKeydown, handleInfoOverlayClick } = createInfoModalHandlers({ $ });', context);
  vm.runInContext(main.split('\n').find(line => line.startsWith("$('infoBtn').onclick=")), context);
  elements.infoBtn.focus();
  const key = (key, shiftKey = false) => {
    const event = { key, shiftKey, prevented: false, preventDefault() { this.prevented = true; } };
    document.listeners.keydown(event);
    return event;
  };
  // Model native sequential navigation only when the handler does not intercept Tab.
  const tab = (shift = false) => {
    const event = key('Tab', shift);
    if (!event.prevented) {
      const next = controls.indexOf(document.activeElement) + (shift ? -1 : 1);
      (controls[next] || elements.infoBtn).focus();
    }
  };
  return { document, elements, controls, context, key, tab };
}

test('Info dialog semantics, initial focus and keyboard access to every payment and Copy control', () => {
  assert.match(html, /role="dialog" aria-modal="true" aria-labelledby="infoTitle"/);
  assert.match(html, /<h2[^>]*id="infoTitle"/);
  const f = modalFixture();
  assert.equal(f.document.activeElement, f.elements.infoBtn);
  f.elements.infoBtn.onclick();
  assert.equal(f.document.activeElement, f.elements.infoX);
  assert.equal(f.elements.infoOverlay['aria-hidden'], 'false');
  assert.equal(f.document.body.style.overflow, 'hidden');
  assert.equal(f.controls.filter(c => c.tag === 'a').length, 3);
  assert.equal(f.controls.filter(c => c.attributes.includes('copy-wallet')).length, 8);
  const visited = new Set();
  for (let i = 0; i < f.controls.length * 3; i++) {
    visited.add(f.document.activeElement);
    f.tab();
    assert.ok(f.controls.includes(f.document.activeElement));
  }
  assert.equal(visited.size, f.controls.length);
  f.elements.infoX.focus();
  f.tab(true);
  assert.equal(f.document.activeElement, f.elements.infoClose);
  f.tab();
  assert.equal(f.document.activeElement, f.elements.infoX);
});

for (const method of ['X', 'Close', 'Escape', 'overlay']) {
  test(`Info ${method} closes and restores the opener's focus`, () => {
    const f = modalFixture();
    f.elements.infoBtn.onclick();
    f.context.openInfo(); // Repeated opening must preserve the original focus.
    if (method === 'X') f.elements.infoX.onclick();
    if (method === 'Close') f.elements.infoClose.onclick();
    if (method === 'Escape') f.key('Escape');
    if (method === 'overlay') f.elements.infoOverlay.listeners.click({ target: f.elements.infoOverlay });
    assert.equal(f.document.activeElement, f.elements.infoBtn);
    assert.equal(f.elements.infoOverlay.classList.contains('open'), false);
    assert.equal(f.elements.infoOverlay['aria-hidden'], 'true');
    assert.equal(f.document.body.style.overflow, '');
    assert.equal(f.key('Tab').prevented, false);
  });
}

test('Info language changes preserve focus and both trap boundaries in every language', () => {
  const f = modalFixture();
  f.context.openInfo();
  for (const lang of Object.keys(INFO_T)) {
    f.elements.language.value = lang;
    f.context.applyInfoLanguage();
    assert.equal(f.document.activeElement, f.elements.infoX);
    assert.equal(f.elements.infoClose.textContent, INFO_T[lang].close);
    f.tab(true);
    assert.equal(f.document.activeElement, f.elements.infoClose);
    f.tab();
    assert.equal(f.document.activeElement, f.elements.infoX);
  }
});

test('Info handles unavailable opener, changed controls, outside focus and clicks inside the modal', () => {
  const f = modalFixture();
  f.context.openInfo();
  f.elements.infoOverlay.listeners.click({ target: f.elements.infoX });
  assert.equal(f.elements.infoOverlay.classList.contains('open'), true);
  f.elements.infoClose.disabled = true;
  f.elements.infoX.focus();
  f.tab(true);
  assert.equal(f.document.activeElement, f.controls.at(-2));
  f.controls.at(-2).visible = false;
  f.elements.infoX.focus();
  f.tab(true);
  assert.equal(f.document.activeElement, f.controls.at(-3));
  f.elements.infoBtn.focus();
  f.tab();
  assert.equal(f.document.activeElement, f.elements.infoX);
  f.elements.infoBtn.isConnected = false;
  assert.doesNotThrow(() => f.context.closeInfo());
  assert.equal(f.elements.infoOverlay.classList.contains('open'), false);
  assert.doesNotThrow(() => f.context.closeInfo());
});
const runFunction = (context, name) => vm.runInContext(main.split('\n').find(line => line.startsWith(`function ${name}(`)), context);

test('manual and OS theme changes preserve the open Info modal, focus and form state', () => {
  const f = modalFixture();
  let listener;
  const media = { matches: false, addEventListener(type, fn) { listener = fn; } };
  Object.assign(f.context, { getTheme: () => 'system', setTheme() {}, window: { matchMedia: () => media } });
  f.elements.themeSelect = { value: '' };
  f.elements.dateInput = { value: '18/09/2026' };
  f.elements.salt = { value: 'personal key' };
  f.document.documentElement = { dataset: {} };
  f.document.getElementById = id => f.elements[id];
  vm.runInContext(read('src/js/theme.js').replace(/^import .*\r?\n/, '').replaceAll('export ', ''), f.context);
  f.context.applyTheme();
  f.context.openInfo();
  for (const mode of ['light', 'dark', 'system']) {
    f.context.selectTheme(mode);
    for (const dark of [true, false]) {
      media.matches = dark;
      listener();
      assert.equal(f.document.documentElement.dataset.theme, mode === 'system' ? (dark ? 'dark' : 'light') : mode);
      assert.equal(f.elements.infoOverlay.classList.contains('open'), true);
      assert.equal(f.elements.infoOverlay['aria-hidden'], 'false');
      assert.equal(f.document.body.style.overflow, 'hidden');
      assert.equal(f.document.activeElement, f.elements.infoX);
      assert.equal(f.elements.dateInput.value, '18/09/2026');
      assert.equal(f.elements.salt.value, 'personal key');
    }
  }
});

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


const expectedPayments = {
  "links": [
    "https://www.paypal.com/ncp/payment/RU2CWCNVQ7XD6",
    "https://buy.stripe.com/7sYeVd7Blfe89cm0k02kw00"
  ],
  "addresses": [
    "bc1qwlrxrh64peukga0fp59m9yg7gpf0yj8q7fxnsc",
    "0xA99A52085c6725854daa46bb302041569c8bA4E3",
    "rP43SsrkhPkxTsFohMAm32sAQg7vqwmDpr",
    "8xkdVTEaDGuWu4aE3HpEx8r9Aux98JZbdsMiDQvJWBWR",
    "DGAT32ku8WmFaTDxCgVuRuVpUFmfdmD5Jb",
    "GCYH4OD4I2GNRKFFOYROE3N3S2HCT5RXIML3TZV5DP3TLTLXPXQXIJZ3",
    "LWtaFniqdYpv2xJtqo9WqDwCsQ2cW6PYWi",
    "RAtXzKZyB3awfq2u2cK8YppC9kJamU5tPQ"
  ],
  "copyValues": [
    "bc1qwlrxrh64peukga0fp59m9yg7gpf0yj8q7fxnsc",
    "0xA99A52085c6725854daa46bb302041569c8bA4E3",
    "rP43SsrkhPkxTsFohMAm32sAQg7vqwmDpr",
    "8xkdVTEaDGuWu4aE3HpEx8r9Aux98JZbdsMiDQvJWBWR",
    "DGAT32ku8WmFaTDxCgVuRuVpUFmfdmD5Jb",
    "GCYH4OD4I2GNRKFFOYROE3N3S2HCT5RXIML3TZV5DP3TLTLXPXQXIJZ3",
    "LWtaFniqdYpv2xJtqo9WqDwCsQ2cW6PYWi",
    "RAtXzKZyB3awfq2u2cK8YppC9kJamU5tPQ"
  ]
};
test('Info preserves exact PayPal, Stripe and all displayed/copied crypto values', () => {
  const actual = {
    links: [...html.matchAll(/href="(https:\/\/(?:www\.paypal\.com|buy\.stripe\.com)[^"]+)"/g)].map(m => m[1]),
    addresses: [...html.matchAll(/class="wallet-address">([^<]+)</g)].map(m => m[1]),
    copyValues: [...html.matchAll(/data-wallet="([^"]+)"/g)].map(m => m[1])
  };
  assert.deepEqual(actual, expectedPayments);
});

test('Info app identity, package version and safe Apps & Games link', () => {
  const markup = html.slice(html.indexOf('<div class="info-overlay"'));
  assert.match(markup, /<strong>Date Lotto Generator<\/strong>/);
  assert.match(markup, /href="https:\/\/appsandgames.org\/" target="_blank" rel="noopener noreferrer"/);
  assert.match(main, /import \{ version \} from '\.\.\/package.json'/);
  const version = JSON.parse(read('package.json')).version;
  const output = {};
  vm.runInNewContext(main.split('\n').find(line => line.startsWith("$('infoVersion').textContent=")), { version, $: () => output });
  assert.equal(output.textContent, version);
  assert.match(markup, /id="infoVersion"><\/span>/);
});

for (const lang of ['en', 'hr', 'de', 'it', 'es']) {
  test('Info complete localized standard content and rendering: ' + lang, () => {
    const keys = [...html.matchAll(/data-info-i18n="([^"]+)"/g)].map(m => m[1]);
    for (const key of ['about','description','features','featureList','version','free','privacy','localData','historyData','themeData','languageData','personalKey','brandText','visit','support','p1']) {
      assert.ok(keys.includes(key), key);
    }
    const nodes = keys.map(key => ({ dataset: { infoI18n: key }, textContent: '' }));
    const context = vm.createContext({ INFO_T, $: () => ({ value: lang }), document: {
      querySelectorAll: selector => selector === '[data-info-i18n]' ? nodes : []
    } });
    vm.runInContext(read('src/js/info-modal.js').replace(/^import .*\r?\n/, '').replace('export function', 'function') + '\ncreateInfoModalHandlers({ $ }).applyInfoLanguage();', context);
    for (const node of nodes) {
      const key = node.dataset.infoI18n;
      assert.ok(Object.hasOwn(INFO_T[lang], key), key);
      assert.ok(INFO_T[lang][key].trim(), key);
      assert.equal(node.textContent, INFO_T[lang][key]);
    }
    assert.match(INFO_T[lang].localData, /localStorage/);
    assert.match(INFO_T[lang].personalKey, /Personal Key/);
    assert.match(INFO_T[lang].personalKey, /localStorage/);
    const terms = { en: ['Save', 'not a password', 'voluntary', 'remains free'], hr: ['Spremi', 'nije lozinka', 'dobrovoljne', 'ostaje besplatna'], de: ['Speichern', 'kein Passwort', 'freiwillig', 'bleibt kostenlos'], it: ['Salva', 'non è una password', 'volontarie', 'rimane gratuita'], es: ['Guardar', 'no es una contraseña', 'voluntarias', 'seguirá siendo gratuita'] }[lang];
    for (const term of terms.slice(0, 2)) assert.ok(INFO_T[lang].personalKey.includes(term));
    for (const term of terms.slice(2)) assert.ok(INFO_T[lang].p1.includes(term));
  });
}
