// Uses the same optional Playwright installation as test:pwa.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: process.env.PWA_BROWSER || 'chrome', headless: true });
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [320, 360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const language of ['en', 'hr', 'de', 'it', 'es']) {
      await page.goto(server.resolvedUrls.local[0]);
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.selectOption('#language', language);
      await page.fill('#dateInput', '18092026');
      for (let count = 1; count <= 3; count++) {
        if (count > 1) {
          await page.fill('#salt', 'LongPersonalKey'.repeat(100) + count);
          for (const [id, value] of Object.entries({ mainCount: '20', mainMax: '99', extraCount: '10', extraMax: '99' })) {
            await page.fill(`#${id}`, value);
          }
        }
        await page.click('#generateBtn');
        await page.click('#saveBtn');
        assert.equal(await page.locator('.histItem').count(), count);
        const layout = await page.evaluate(() => {
          const elements = [...document.querySelectorAll('.grid, .card, .history, .historyList, .histItem, .histText, .histItem > div:last-child, .histItem button')];
          return {
            client: document.documentElement.clientWidth,
            scroll: document.documentElement.scrollWidth,
            boxes: elements.map(el => {
              const box = el.getBoundingClientRect();
              return { name: el.className, left: box.left, right: box.right, client: el.clientWidth, scroll: el.scrollWidth };
            })
          };
        });
        const label = `${width}px ${language} ${count} entries`;
        assert.equal(layout.scroll, layout.client, `${label}: ${JSON.stringify(layout)}`);
        for (const box of layout.boxes) {
          assert.ok(box.left >= 0 && box.right <= width, `${label}: outside viewport ${JSON.stringify(box)}`);
          assert.ok(box.scroll <= box.client + 1, `${label}: clipped/scrolling content ${JSON.stringify(box)}`);
        }
        const buttons = page.locator('.histItem button');
        for (const button of await buttons.all()) {
          assert.ok((await button.textContent()).trim());
          if (width <= 600) {
            const box = await button.boundingBox();
            assert.ok(box.width >= 44 && box.height >= 44, `${label}: touch target`);
          }
        }
      }
      const expected = await page.locator('.histText').first().textContent();
      await page.locator('[data-copy="0"]').click();
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), expected);
      await page.locator('[data-del="0"]').click();
      assert.equal(await page.locator('.histItem').count(), 2);
      console.log(`PASS ${width}px ${language}: 1/2/3 entries, long key + 20+10 result, full text, Copy/Delete; scrollWidth=clientWidth=${width}`);
    }
  }
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  await server.close();
}
