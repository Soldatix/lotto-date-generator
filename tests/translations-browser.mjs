// Uses the same optional Playwright installation as test:pwa and test:history.
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const expected = {
  en: ['Choose a date and generate your combination.', 'e.g. name, city, lucky word', 'Close', 'Apps & Games • Local data • Free to use'],
  hr: ['Odaberi datum i generiraj kombinaciju.', 'npr. ime, grad, sretna riječ', 'Zatvori', 'Apps & Games • Lokalni podaci • Besplatno korištenje'],
  de: ['Datum wählen und Kombination generieren.', 'z. B. Name, Stadt, Glückswort', 'Schließen', 'Apps & Games • Lokale Daten • Kostenlos nutzbar'],
  it: ['Scegli una data e genera la combinazione.', 'es. nome, città, parola fortunata', 'Chiudi', 'Apps & Games • Dati locali • Uso gratuito'],
  es: ['Elige una fecha y genera tu combinación.', 'p. ej., nombre, ciudad, palabra de la suerte', 'Cerrar', 'Apps & Games • Datos locales • Uso gratuito']
};
let server, browser;
before(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  browser = await chromium.launch({ channel: process.env.PWA_BROWSER || 'chrome', headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });

async function withPage(run) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(server.resolvedUrls.local[0]);
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
}

for (const [lang, [empty, placeholder, close, footer]] of Object.entries(expected)) {
  test(`${lang}: initial empty state, placeholder, Info X name/title and footer update immediately`, () => withPage(async page => {
    // Start with a different language so every case verifies a real transition.
    await page.selectOption('#language', lang === 'en' ? 'hr' : 'en');
    await page.selectOption('#language', lang);
    assert.equal(await page.locator('#resultArea p').textContent(), empty);
    assert.equal(await page.getAttribute('#resultArea p', 'data-i18n'), 'empty');
    assert.equal(await page.getAttribute('#salt', 'placeholder'), placeholder);
    assert.equal(await page.getAttribute('#infoX', 'aria-label'), close);
    assert.equal(await page.getAttribute('#infoX', 'title'), close);
    assert.equal(await page.locator('.footer').textContent(), footer);
    assert.ok(!(await page.locator('body').innerText()).includes('Standalone HTML'));
    await page.click('#infoBtn');
    assert.equal(await page.locator('#infoX').textContent(), '×');
    assert.equal(await page.getByRole('button', { name: close, exact: true }).count(), 2);
    await page.click('#infoX');
    assert.equal(await page.getAttribute('#infoOverlay', 'aria-hidden'), 'true');
  }));
}

for (const [from, to] of [['hr', 'de'], ['en', 'it']]) {
  test(`${from} → Generate → Reset → ${to}: empty state stays translatable across repeated resets`, () => withPage(async page => {
    await page.selectOption('#language', from);
    await page.fill('#dateInput', '18092026');
    await page.click('#generateBtn');
    assert.ok(await page.locator('.ball').count());
    await page.click('#resetBtn');
    assert.equal(await page.locator('#resultArea p').textContent(), expected[from][0]);
    await page.selectOption('#language', to);
    assert.equal(await page.locator('#resultArea p').textContent(), expected[to][0]);
    for (const lang of Object.keys(expected)) {
      await page.selectOption('#language', lang);
      assert.equal(await page.locator('#resultArea p').textContent(), expected[lang][0]);
      await page.click('#resetBtn');
      assert.equal(await page.getAttribute('#resultArea p', 'data-i18n'), 'empty');
      assert.equal(await page.locator('#resultArea p').textContent(), expected[lang][0]);
    }
  }));
}

test('source HTML contains no obsolete Standalone HTML footer', () => {
  assert.ok(!readFileSync('index.html', 'utf8').includes('Standalone HTML'));
});
