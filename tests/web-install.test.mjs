import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync('src/js/pwa.js', 'utf8').replaceAll('export ', '')
  .replaceAll('import.meta.env.PROD', 'false').replaceAll('import.meta.env.BASE_URL', "'./'");
const translations = await import(`data:text/javascript;base64,${Buffer.from(readFileSync('src/data/translations.js')).toString('base64')}`);
function setup(search = '?install=web', { standalone = false, ios = false, legacy = false } = {}) {
  const elements = Object.fromEntries(['webInstallBanner', 'webInstallTitle', 'webInstallDescription',
    'webInstallStatus', 'installWebAppButton', 'continueWebButton', 'language'].map(id => [id, { hidden: true, focus() {} }]));
  const listeners = {};
  let timeout, modeChange, language = 'en';
  const media = { matches: standalone, [legacy ? 'addListener' : 'addEventListener']: (...args) => { modeChange = args.at(-1); } };
  const history = { state: { retained: true }, replaceState(state, _, url) { this.url = url; assert.equal(state, this.state); } };
  const context = vm.createContext({ URL, URLSearchParams, navigator: { standalone: ios },
    window: { location: { search, href: `https://lotto.appsandgames.org/${search}#keep` }, history,
      matchMedia: () => media, addEventListener: (type, fn) => { listeners[type] = fn; } },
    setTimeout: fn => { timeout = fn; return 1; }, clearTimeout: () => { timeout = undefined; },
    $: id => elements[id], getText: () => translations.WEB_INSTALL_T[language] });
  const api = vm.runInContext(source + '\ninitializeWebInstall({ $, getText });', context);
  return { elements, listeners, history, media, api, modeChange: () => modeChange(),
    expire: () => timeout?.(), status: () => elements.webInstallStatus.textContent,
    language: value => { language = value; api.applyLanguage(); } };
}
function offer(app, outcome = 'accepted') {
  const event = { prevented: 0, prompted: 0, preventDefault() { this.prevented++; },
    prompt() { this.prompted++; return Promise.resolve(); }, userChoice: Promise.resolve({ outcome }) };
  app.listeners.beforeinstallprompt(event);
  return event;
}

test('only exact install=web requests show the banner and capture prompts', () => {
  for (const query of ['', '?install=no', '?install=WEB', '?other=web', '?install=web', '?_gl=x&install=web']) {
    const app = setup(query), active = new URLSearchParams(query).get('install') === 'web';
    assert.equal(app.elements.webInstallBanner.hidden, !active);
    const event = offer(app);
    assert.equal(event.prevented, Number(active));
    assert.equal(event.prompted, 0);
  }
});
test('waiting disables install; readiness enables it without prompting', () => {
  const app = setup();
  assert.equal(app.status(), translations.WEB_INSTALL_T.en.waiting);
  assert.equal(app.elements.installWebAppButton.disabled, true);
  const event = offer(app);
  app.expire();
  assert.equal(app.status(), translations.WEB_INSTALL_T.en.ready);
  assert.equal(app.elements.installWebAppButton.disabled, false);
  assert.equal(event.prompted, 0);
});
for (const outcome of ['accepted', 'dismissed']) test(`explicit click handles ${outcome} and consumes prompt once`, async () => {
  const app = setup(), event = offer(app, outcome);
  const pending = app.elements.installWebAppButton.onclick();
  assert.equal(app.status(), translations.WEB_INSTALL_T.en.installing);
  assert.equal(app.elements.installWebAppButton.disabled, true);
  await app.elements.installWebAppButton.onclick();
  await pending;
  assert.equal(event.prompted, 1);
  assert.equal(app.status(), translations.WEB_INSTALL_T.en[outcome === 'accepted' ? 'installing' : 'dismissed']);
  assert.notEqual(app.status(), translations.WEB_INSTALL_T.en.installed);
  assert.equal(app.elements.installWebAppButton.disabled, true);
  await app.elements.installWebAppButton.onclick();
  assert.equal(event.prompted, 1);
});
test('accepted stays installing until appinstalled confirms installation', async () => {
  const app = setup();
  offer(app, 'accepted');
  await app.elements.installWebAppButton.onclick();
  assert.equal(app.status(), translations.WEB_INSTALL_T.en.installing);
  app.listeners.appinstalled();
  assert.equal(app.status(), translations.WEB_INSTALL_T.en.installed);
  assert.equal(app.elements.installWebAppButton.disabled, true);
});
test('appinstalled clears prompt and remains installed despite a pending dismissal', async () => {
  const app = setup(), event = offer(app, 'dismissed');
  const pending = app.elements.installWebAppButton.onclick();
  app.listeners.appinstalled();
  await pending;
  assert.equal(app.status(), translations.WEB_INSTALL_T.en.installed);
  await app.elements.installWebAppButton.onclick();
  assert.equal(event.prompted, 1);
});
test('standalone and iOS standalone never offer another installation', () => {
  for (const options of [{ standalone: true }, { ios: true }]) {
    const app = setup('?install=web', options);
    offer(app); app.expire();
    assert.equal(app.status(), translations.WEB_INSTALL_T.en.installed);
    assert.equal(app.elements.installWebAppButton.disabled, true);
  }
});
test('modern and legacy standalone changes update banner', () => {
  for (const legacy of [false, true]) {
    const app = setup('?install=web', { legacy });
    app.media.matches = true; app.modeChange();
    assert.equal(app.status(), translations.WEB_INSTALL_T.en.installed);
  }
});
test('unsupported browsers get fallback guidance and late availability still works', () => {
  const app = setup(); app.expire();
  assert.equal(app.status(), translations.WEB_INSTALL_T.en.unavailable);
  assert.equal(app.elements.installWebAppButton.disabled, true);
  offer(app);
  assert.equal(app.status(), translations.WEB_INSTALL_T.en.ready);
});
test('missing prompt and rejected prompt fail gracefully', async () => {
  const app = setup();
  await app.elements.installWebAppButton.onclick();
  assert.equal(app.status(), translations.WEB_INSTALL_T.en.unavailable);
  app.listeners.beforeinstallprompt({ preventDefault() {} });
  assert.equal(app.elements.installWebAppButton.disabled, true);
  const event = offer(app);
  event.prompt = () => Promise.reject(new Error('unsupported'));
  await app.elements.installWebAppButton.onclick();
  assert.equal(app.status(), translations.WEB_INSTALL_T.en.unavailable);
});
test('Continue removes only install, preserving analytics, duplicates, hash and history state', async () => {
  const app = setup('?install=web&_gl=abc%2B123&x=one&x=two');
  const event = offer(app);
  app.elements.continueWebButton.onclick();
  assert.equal(app.elements.webInstallBanner.hidden, true);
  assert.equal(app.history.url.searchParams.has('install'), false);
  assert.equal(app.history.url.searchParams.get('_gl'), 'abc+123');
  assert.deepEqual(app.history.url.searchParams.getAll('x'), ['one', 'two']);
  assert.equal(app.history.url.hash, '#keep');
  assert.equal(offer(app).prevented, 0);
  await app.elements.installWebAppButton.onclick();
  assert.equal(event.prompted, 0);
});
test('all five languages contain every label and state and update the active banner', () => {
  const app = setup(); offer(app);
  for (const language of ['en', 'hr', 'de', 'it', 'es']) {
    const text = translations.WEB_INSTALL_T[language];
    for (const key of ['title', 'description', 'install', 'continue', 'waiting', 'ready', 'unavailable', 'installing', 'dismissed', 'installed']) assert.ok(text[key]?.trim(), `${language}.${key}`);
    app.language(language);
    assert.equal(app.status(), text.ready);
    assert.equal(app.elements.continueWebButton.textContent, text.continue);
  }
});
