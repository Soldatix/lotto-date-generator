import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless: true });

async function ready(page) {
  await page.waitForFunction(() => typeof document.getElementById('settingsBtn')?.onclick === 'function');
}

try {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto(url, { waitUntil: 'load' });
  await ready(page);
  assert.equal(await page.locator('#settingsOverlay').getAttribute('aria-hidden'), 'true');
  await page.locator('#settingsBtn').click();
  assert.equal(await page.locator('#settingsOverlay').getAttribute('aria-hidden'), 'false');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'settingsX');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'settingsClose');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'settingsX');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#settingsOverlay').getAttribute('aria-hidden'), 'true');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'settingsBtn');

  await page.evaluate(() => {
    const select = document.getElementById('language');
    select.value = 'hr';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.locator('#settingsBtn').click();
  assert.equal((await page.locator('#settingsTitle').innerText()).includes('Postavke'), true);
  assert.equal(await page.locator('#exportBackup').count(), 1);
  assert.equal(await page.locator('#infoOverlay #exportBackup').count(), 0);
  await page.locator('#settingsClose').click();
  await page.locator('#dateInput').fill('04/10/2026');
  await page.locator('#generateBtn').click();
  await page.locator('#saveBtn').click();
  await page.locator('#settingsBtn').click();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#exportBackup').click()
  ]);
  assert.match(download.suggestedFilename(), /^date-lotto-generator-backup-\\d{4}-\\d{2}-\\d{2}\\.json$/);
  const backup = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(backup.app, 'date-lotto-generator');
  assert.equal(backup.data.history.length, 1);
  assert.equal(backup.data.language, 'hr');

  page.on('dialog', dialog => dialog.accept());
  await page.locator('#resetStoredData').click();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('lottoHistory') || '[]').length), 0);
  assert.equal(await page.locator('#language').inputValue(), 'en');
  await page.locator('#backupFile').setInputFiles({
    name: 'lotto-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup))
  });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('lottoHistory') || '[]').length === 1);
  assert.equal(await page.locator('#language').inputValue(), 'hr');
  assert.equal(await page.locator('#historyWrap').isVisible(), true);
  await page.locator('#settingsClose').click();
  await page.locator('#infoBtn').click();
  assert.equal(await page.locator('#infoOverlay').getAttribute('aria-hidden'), 'false');
  assert.equal(await page.locator('#settingsOverlay').getAttribute('aria-hidden'), 'true');
  await page.locator('#infoX').click();
  assert.deepEqual(errors, []);
  console.log('PASS: browser Settings, keyboard, five-language wiring, export/import/reset, Info separation');

  await page.goto(url + '?install=web', { waitUntil: 'load' });
  await ready(page);
  assert.equal(await page.locator('#webInstallBanner').isVisible(), true);
  await page.locator('#continueWebButton').click();
  assert.equal(await page.locator('#webInstallBanner').isVisible(), false);
  assert.equal(new URL(page.url()).searchParams.has('install'), false);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller));
  await context.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  await ready(page);
  await page.locator('#settingsBtn').click();
  assert.equal(await page.locator('#settingsOverlay').getAttribute('aria-hidden'), 'false');
  await page.locator('#settingsX').click();
  await context.setOffline(false);
  assert.deepEqual(errors, []);
  console.log('PASS: Web App install banner, PWA registration and offline Settings');

  const standalone = await browser.newContext({ acceptDownloads: true });
  await standalone.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = query => query === '(display-mode: standalone)'
      ? { matches: true, addEventListener() {}, addListener() {} }
      : original(query);
  });
  const app = await standalone.newPage();
  await app.goto(url, { waitUntil: 'load' });
  await ready(app);
  assert.equal(await app.title(), 'Date Lotto Generator');
  await app.locator('#settingsBtn').click();
  assert.equal(await app.locator('#settingsOverlay').getAttribute('aria-hidden'), 'false');
  await standalone.close();
  await context.close();
  console.log('PASS: simulated PWA standalone title and Settings');
} finally {
  await browser.close();
}
