// Optional browser validation: same PLAYWRIGHT_MODULE/PWA_BROWSER convention as existing checks.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: process.env.PWA_BROWSER || 'chrome', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const base = server.resolvedUrls.local[0];
  await page.goto(base);
  assert.equal(await page.locator('#webInstallBanner').isVisible(), false);
  await page.goto(`${base}?install=web&_gl=keep&other=yes#anchor`);
  await page.locator('#webInstallBanner').waitFor({ state: 'visible' });
  for (const width of [320, 360, 390, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    for (const theme of ['light', 'dark', 'system']) {
      await page.selectOption('#themeSelect', { value: theme }, { force: true });
      for (const scheme of theme === 'system' ? ['light', 'dark'] : [theme]) {
        await page.emulateMedia({ colorScheme: scheme });
        for (const language of ['en', 'hr', 'de', 'it', 'es']) {
          await page.selectOption('#language', language, { force: true });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          assert.equal(await page.locator('#webInstallBanner').evaluate(el => el.scrollWidth <= el.clientWidth), true);
          for (const id of ['installWebAppButton', 'continueWebButton']) {
            const rect = await page.locator(`#${id}`).boundingBox();
            assert.ok(rect.x >= 0 && rect.x + rect.width <= width && rect.height >= 44);
            assert.ok((await page.locator(`#${id}`).textContent()).trim());
          }
        }
      }
    }
  }
  await page.selectOption('#language', 'en', { force: true });
  await page.evaluate(() => {
    window.promptCalls = 0;
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = async () => { window.promptCalls++; };
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(event);
    window.promptPrevented = event.defaultPrevented;
  });
  assert.equal(await page.evaluate(() => window.promptCalls), 0);
  assert.equal(await page.evaluate(() => window.promptPrevented), true);
  await page.locator('#installWebAppButton').focus();
  assert.equal(await page.locator('#installWebAppButton').evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('webInstallStatus').textContent === 'Installation started…');
  assert.equal(await page.locator('#installWebAppButton').isDisabled(), true);
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await page.waitForFunction(() => document.getElementById('webInstallStatus').textContent === 'Date Lotto Generator is installed.');
  assert.equal(await page.evaluate(() => window.promptCalls), 1);
  await page.click('#continueWebButton');
  assert.equal(await page.locator('#webInstallBanner').isVisible(), false);
  const url = new URL(page.url());
  assert.equal(url.search, '?_gl=keep&other=yes');
  assert.equal(url.hash, '#anchor');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'language');
  assert.deepEqual(errors, []);
  console.log('PASS: 80 viewport/theme/language combinations, keyboard install, URL preservation, no page errors.');
} finally { await browser?.close(); await server.close(); }
