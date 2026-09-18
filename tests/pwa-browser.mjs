// Optional real-browser check: use an installed Playwright module, or set
// PLAYWRIGHT_MODULE to its absolute entry path. No new test framework required.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const temporary = await mkdtemp(join(tmpdir(), 'lotto-pwa-'));
let root = resolve('dist');
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/observer') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Update observer</title>'); return; }
    const relative = pathname.replace(/^\/app\//, '') || 'index.html';
    if (!pathname.startsWith('/app/') || relative.includes('..')) { res.writeHead(404).end(); return; }
    const file = await readFile(join(root, relative));
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html',
      '.webmanifest': 'application/manifest+json', '.png': 'image/png' })[extname(relative)] || 'application/octet-stream');
    res.end(file);
  } catch { res.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const url = `http://127.0.0.1:${server.address().port}/app/`;
let browser;
try {
  browser = await chromium.launch({ channel: process.env.PWA_BROWSER || 'chrome', headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  let page = await context.newPage();
  const errors = [];
  context.on('page', p => p.on('pageerror', error => errors.push(error.message)));
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await context.setOffline(true);
  await page.close();
  page = await context.newPage();
  await page.goto(url);
  await page.reload();
  assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller));
  for (const language of ['en', 'hr', 'de', 'it', 'es']) {
    await page.selectOption('#language', language);
    assert.equal(await page.getAttribute('html', 'lang'), language);
  }
  await page.fill('#dateInput', '18092026');
  for (let i = 0; i < 7; i++) {
    await page.locator('#presets button').nth(i).click();
    await page.click('#generateBtn');
    assert.ok(await page.locator('.ball').count());
  }
  await page.click('#saveBtn');
  await page.selectOption('#themeSelect', 'dark');
  await page.evaluate(() => localStorage.setItem('unrelated', 'preserved'));
  await page.click('#infoBtn');
  const downloadEvent = page.waitForEvent('download');
  await page.click('#exportBackup');
  const download = await downloadEvent;
  const backup = await readFile(await download.path(), 'utf8');
  assert.equal(JSON.parse(backup).version, 1);
  page.on('dialog', dialog => dialog.accept());
  await page.click('#resetStoredData');
  assert.equal(await page.evaluate(() => localStorage.getItem('lottoHistory')), null);
  await page.setInputFiles('#backupFile', { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await page.waitForFunction(() => document.querySelector('#backupStatus').dataset.infoI18n === 'backupRestored');
  assert.equal(await page.inputValue('#language'), 'es');
  assert.equal(await page.inputValue('#themeSelect'), 'dark');
  assert.equal(await page.locator('.histItem').count(), 1);
  await page.click('#infoClose');
  const stored = await page.evaluate(() => ({ ...localStorage }));
  await page.reload();
  assert.deepEqual(await page.evaluate(() => ({ ...localStorage })), stored);
  // Uncached navigation query resolves to the precached HTML as well.
  await page.goto(`${url}?offline-check=1`);
  assert.equal(await page.locator('.histItem').count(), 1);
  for (const path of ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png']) {
    assert.equal(await page.evaluate(path => fetch(path).then(r => r.status), path), 200);
  }
  console.log('PASS offline reopen/reload/navigation, 5 languages, 7 presets, History, Theme, Info, Backup v1/Restore/Reset, manifest/icons');

  await context.setOffline(false);
  const second = join(temporary, 'v2');
  await build({ build: { outDir: second, emptyOutDir: true }, plugins: [{ name: 'pwa-test-version', transform(code, id) {
    if (id.replaceAll('\\', '/').endsWith('/src/main.js')) return `window.__pwaTestVersion = 2;\n${code}`;
  } }] });
  const oldKeys = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async name =>
    (await (await caches.open(name)).keys()).map(r => r.url)))).flat());
  const obsoleteCache = `workbox-precache-v1-${url}`;
  await page.evaluate(async name => { await caches.open(name); await caches.open('unrelated-app-cache'); }, obsoleteCache);
  const other = await context.newPage();
  await other.goto(url);
  let navigations = 0;
  page.on('framenavigated', () => navigations++);
  root = second;
  await page.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration(); await registration.update(); });
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()).waiting);
  assert.equal(await page.evaluate(() => window.__pwaTestVersion), undefined);
  assert.equal(navigations, 0);
  assert.deepEqual(await page.evaluate(() => ({ ...localStorage })), stored);
  await page.fill('#dateInput', '18092026');
  await page.click('#generateBtn');
  assert.ok(await page.locator('.ball').count());
  await page.close();
  assert.ok(await other.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).waiting));
  await other.close();
  // Poll from an out-of-scope page so no old controlled client blocks activation.
  const observer = await context.newPage();
  await observer.goto(url.replace('/app/', '/observer'));
  await observer.waitForFunction(async url => {
    const r = await navigator.serviceWorker.getRegistration(url);
    return r && !r.waiting && r.active?.state === 'activated';
  }, url);
  await context.setOffline(true);
  page = await context.newPage();
  await page.goto(url);
  assert.equal(await page.evaluate(() => window.__pwaTestVersion), 2);
  assert.deepEqual(await page.evaluate(() => ({ ...localStorage })), stored);
  const newKeys = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async name =>
    (await (await caches.open(name)).keys()).map(r => r.url)))).flat());
  const oldJs = oldKeys.filter(key => /\/assets\/.*\.js/.test(key));
  assert.ok(oldJs.length);
  for (const key of oldJs) assert.ok(!newKeys.includes(key), `obsolete asset removed: ${key}`);
  const cacheNames = await page.evaluate(() => caches.keys());
  assert.ok(!cacheNames.includes(obsoleteCache));
  assert.ok(cacheNames.includes('unrelated-app-cache'));
  await page.reload();
  assert.equal(await page.evaluate(() => window.__pwaTestVersion), 2);
  assert.deepEqual(errors, []);
  console.log('PASS two-build update waits for all tabs, no forced reload, old JS/cache removed, unrelated cache preserved, new version reopens offline, localStorage unchanged');
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
  await rm(temporary, { recursive: true, force: true });
}
