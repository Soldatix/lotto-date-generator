// Uses the same optional Playwright installation as the other browser checks.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';

const load = path => import(`data:text/javascript;base64,${Buffer.from(readFileSync(path, 'utf8')).toString('base64')}`);
const { presets } = await load('src/data/presets.js');
const { T, INFO_T } = await load('src/data/translations.js');

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
let server, browser;

before(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  browser = await chromium.launch({ channel: process.env.PWA_BROWSER || 'chrome', headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });

async function withPage(run, permissions = []) {
  const context = await browser.newContext({ permissions });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(server.resolvedUrls.local[0]);
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
}

async function createCopies(page) {
  await page.fill('#dateInput', '18092026');
  await page.click('#generateBtn');
  await page.click('#saveBtn');
}

async function assertPressedAndFocused(page, index) {
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.preset), presets[index].id);
  assert.deepEqual(await page.locator('#presets button').evaluateAll(buttons =>
    buttons.map(button => button.getAttribute('aria-pressed'))),
  presets.map((_, i) => String(i === index)));
}

test('Enter and Space preserve focus and exact pressed state for all standard presets and Custom', () => withPage(async page => {
  const buttons = page.locator('#presets button');
  assert.equal(await buttons.count(), presets.length);
  for (const key of ['Enter', 'Space']) {
    for (let i = 0; i < presets.length; i++) {
      const button = buttons.nth(i);
      await button.focus();
      await button.press(key);
      await assertPressedAndFocused(page, i);
    }
  }
}));

test('native Clipboard API succeeds for Current Result, History and Crypto Copy', () => withPage(async page => {
  await createCopies(page);
  const copies = [
    ['#copyBtn', await page.locator('#resultText').textContent(), T.en.copied],
    ['[data-copy="0"]', await page.locator('.histText').first().textContent(), T.en.copied]
  ];
  for (const [selector, expected, feedback] of copies) {
    await page.locator(selector).click();
    await page.waitForFunction(({ selector, feedback }) => document.querySelector(selector).textContent === feedback, { selector, feedback });
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), expected);
  }
  await page.click('#infoBtn');
  const wallet = page.locator('.copy-wallet').first();
  const expectedWallet = await wallet.getAttribute('data-wallet');
  await wallet.click();
  await page.waitForFunction(feedback => document.querySelector('.copy-wallet').textContent === feedback, INFO_T.en.copied);
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), expectedWallet);
}, ['clipboard-read', 'clipboard-write']));

for (const [name, fallbackResult, feedback, walletFeedback] of [
  ['success', true, T.en.copied, INFO_T.en.copied],
  ['failure', false, T.en.copyFailed, INFO_T.en.copyFailed]
]) {
  test(`clipboard fallback ${name} restores focus for Current Result, History and Crypto Copy`, () => withPage(async page => {
    await createCopies(page);
    await page.evaluate(result => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
      window.__fallbackCopies = [];
      document.execCommand = command => {
        window.__fallbackCopies.push({ command, text: document.querySelector('textarea')?.value });
        return result;
      };
    }, fallbackResult);
    const copies = [
      ['#copyBtn', await page.locator('#resultText').textContent(), feedback],
      ['[data-copy="0"]', await page.locator('.histText').first().textContent(), feedback]
    ];
    for (const [selector, expected, expectedFeedback] of copies) {
      const button = page.locator(selector);
      await button.focus();
      await button.press('Enter');
      await page.waitForFunction(({ selector, expectedFeedback }) => document.querySelector(selector).textContent === expectedFeedback,
        { selector, expectedFeedback });
      assert.equal(await page.evaluate(selector => document.activeElement === document.querySelector(selector), selector), true);
      assert.equal((await page.evaluate(() => window.__fallbackCopies.at(-1))).text, expected);
    }
    await page.click('#infoBtn');
    const wallet = page.locator('.copy-wallet').first();
    const expectedWallet = await wallet.getAttribute('data-wallet');
    await wallet.focus();
    await wallet.press('Enter');
    await page.waitForFunction(expected => document.querySelector('.copy-wallet').textContent === expected, walletFeedback);
    assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('.copy-wallet')), true);
    const last = await page.evaluate(() => window.__fallbackCopies.at(-1));
    assert.deepEqual(last, { command: 'copy', text: expectedWallet });
  }));
}
