import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const source = readFileSync('src/js/clipboard.js', 'utf8').replace(/export /g, '');
const translations = readFileSync('src/data/translations.js', 'utf8');
const { T, INFO_T } = await import(`data:text/javascript;base64,${Buffer.from(translations).toString('base64')}`);
const fail = () => { throw new Error('Copy blocked'); };
const scenarios = [
  ['API succeeds', 'success', true, true],
  ['API rejects, fallback true', 'reject', true, true],
  ['API rejects, fallback false', 'reject', false, false],
  ['API unavailable, fallback true', 'missing', true, true],
  ['API unavailable, fallback false', 'missing', false, false],
  ['both throw', 'throw', fail, false],
  ['fallback truthy non-boolean is failure', 'missing', 1, false]
];

function setup(kind, language, api, fallback) {
  const dictionary = kind === 'wallet' ? INFO_T : T;
  let lang = language;
  const writes = [];
  const announcements = [];
  const button = { dataset: { wallet: 'wallet-address' },
    get textContent() { return writes.at(-1); },
    set textContent(value) { writes.push(value); } };
  const timers = new Map();
  const calls = { api: [], fallback: [], removed: 0, selected: 0, appended: [] };
  let timerId = 0;
  const context = vm.createContext({ navigator: {},
    document: {
      createElement(tag) {
        assert.equal(tag, 'textarea');
        return { value: '', select() { calls.selected++; }, remove() { calls.removed++; } };
      },
      body: { appendChild(element) { calls.appended.push(element); } },
      execCommand(command) {
        calls.fallback.push(command);
        return typeof fallback === 'function' ? fallback() : fallback;
      }
    },
    setTimeout(callback, delay) { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); }
  });
  if (api !== 'missing') context.navigator.clipboard = { writeText(text) {
    calls.api.push(text);
    if (api === 'throw') fail();
    return api === 'reject' ? Promise.reject(new Error('Denied')) : Promise.resolve();
  } };
  vm.runInContext(source, context);
  const result = { text: '17/09/2026 • 6 • 1, 2, 3, 4, 5, 6' };
  const handlers = context.createClipboardHandlers({ $: () => button,
    getLastResult: () => result, resultString: r => r.text,
    announce: (text, region) => announcements.push({ text, region }),
    tr: key => T[lang][key], infoTr: key => INFO_T[lang][key] });
  const invoke = () => kind === 'current' ? handlers.copyResult()
    : kind === 'history' ? handlers.copyHistory(result, button) : handlers.copyWallet(button);
  return { button, writes, announcements, calls, timers, context, invoke, dictionary,
    expectedText: kind === 'wallet' ? button.dataset.wallet : result.text,
    setLanguage(value) { lang = value; },
    expire() { const pending = [...timers.values()]; timers.clear(); pending.forEach(t => t.callback()); } };
}

for (const lang of ['en', 'hr', 'de', 'it', 'es']) {
  test(`${lang}: complete Copy translations in both dictionaries`, () => {
    for (const dict of [T, INFO_T]) {
      for (const key of ['copy', 'copied', 'copyFailed']) assert.ok(dict[lang][key]);
      assert.notEqual(dict[lang].copyFailed, dict[lang].copied);
    }
  });
  for (const kind of ['current', 'history', 'wallet']) {
    for (const [name, api, fallback, expected] of scenarios) {
      test(`${lang} / ${kind} / ${name}`, async () => {
        const h = setup(kind, lang, api, fallback);
        assert.equal(await h.invoke(), expected);
        const labels = h.dictionary[lang];
        assert.deepEqual(h.announcements, [{ text: expected ? labels.copied : labels.copyFailed, region: kind === 'wallet' ? 'infoLiveStatus' : 'liveStatus' }]);
        assert.equal(h.button.textContent, expected ? labels.copied : labels.copyFailed);
        if (!expected) assert.ok(!h.writes.includes(labels.copied), 'never display false success');
        assert.equal(h.button.dataset.copied, kind === 'wallet' && expected ? '1' : undefined);
        assert.deepEqual(h.calls.api, api === 'missing' ? [] : [h.expectedText]);
        const usedFallback = api !== 'success';
        assert.deepEqual(h.calls.fallback, usedFallback ? ['copy'] : []);
        assert.equal(h.calls.selected, usedFallback ? 1 : 0);
        assert.equal(h.calls.removed, usedFallback ? 1 : 0);
        if (usedFallback) assert.equal(h.calls.appended[0].value, h.expectedText);
        assert.equal(h.timers.size, 1);
        assert.equal([...h.timers.values()][0].delay, kind === 'history' ? 900 : 1200);
        h.expire();
        assert.equal(h.button.textContent, labels.copy);
        assert.equal(h.announcements.length, 1, 'reset feedback must not announce');
        assert.equal(h.button.dataset.copied, undefined);
      });
    }
  }
}

for (const kind of ['current', 'history', 'wallet']) {
  test(`${kind}: repeat failure replaces success and resets to current language`, async () => {
    const h = setup(kind, 'en', 'success', false);
    assert.equal(await h.invoke(), true);
    h.context.navigator.clipboard.writeText = fail;
    h.writes.length = 0;
    assert.equal(await h.invoke(), false);
    assert.ok(!h.writes.includes(T.en.copied));
    assert.equal(h.timers.size, 1);
    h.setLanguage('hr');
    h.expire();
    assert.equal(h.button.textContent, T.hr.copy);
    assert.equal(h.button.dataset.copied, undefined);
  });

  test(`${kind}: late earlier success cannot overwrite newer failure`, async () => {
    const h = setup(kind, 'en', 'success', false);
    let resolve;
    h.context.navigator.clipboard.writeText = () => new Promise(done => { resolve = done; });
    const earlier = h.invoke();
    h.context.navigator.clipboard.writeText = fail;
    assert.equal(await h.invoke(), false);
    resolve();
    assert.equal(await earlier, true);
    assert.equal(h.button.textContent, T.en.copyFailed);
    assert.equal(h.announcements.length, 1, 'stale requests must not announce');
    assert.ok(!h.writes.includes(T.en.copied));
    h.expire();
    assert.equal(h.button.textContent, T.en.copy);
  });
}
