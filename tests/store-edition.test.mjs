import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { storeEditionHtmlPlugin } from '../build/store-edition.mjs';
const { INFO_T } = await import(
  'data:text/javascript;base64,' +
  Buffer.from(readFileSync('src/data/translations.js', 'utf8')).toString('base64')
);

const html = readFileSync('index.html', 'utf8');
const crypto = [
  'bc1qwlrxrh64peukga0fp59m9yg7gpf0yj8q7fxnsc',
  'data-info-i18n="crypto"',
  'data-wallet="'
];
const payments = [
  'https://www.paypal.com/ncp/payment/RU2CWCNVQ7XD6',
  'https://buy.stripe.com/7sYeVd7Blfe89cm0k02kw00'
];

test('Normal Web/PWA HTML keeps crypto donations unchanged', () => {
  const web = storeEditionHtmlPlugin(false).transformIndexHtml(html);
  assert.equal(web, html);
  for (const value of crypto) assert.ok(web.includes(value), value);
});

test('Store HTML excludes crypto donation markup and preserves standard payments', () => {
  const store = storeEditionHtmlPlugin(true).transformIndexHtml(html);
  for (const value of crypto) assert.ok(!store.includes(value), value);
  assert.ok(!store.includes('STORE_CRYPTO_BEGIN'));
  assert.ok(!store.includes('STORE_CRYPTO_END'));
  for (const value of payments) assert.ok(store.includes(value), value);
  assert.ok(store.includes('data-info-i18n="microsoftNotice"'));
});

test('Store build fails closed when crypto boundary markers are missing', () => {
  assert.throws(() => storeEditionHtmlPlugin(true)
    .transformIndexHtml(html.replace('<!-- STORE_CRYPTO_END -->', '')));
});

test('Microsoft fundraiser disclaimer is present in all five languages', () => {
  assert.ok(html.includes('data-info-i18n="microsoftNotice"'));
  for (const lang of ['en', 'hr', 'de', 'it', 'es']) {
    assert.ok(INFO_T[lang].microsoftNotice?.includes('Microsoft'), lang);
  }
});

test('Dedicated MSIX Store build uses the Store Vite mode', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const config = JSON.parse(readFileSync('src-tauri/tauri.store.conf.json', 'utf8'));
  const vite = readFileSync('vite.config.mjs', 'utf8');
  assert.equal(pkg.scripts['build:store'], 'vite build --mode store');
  assert.equal(config.build.beforeBuildCommand, 'npm run build:store');
  assert.ok(vite.includes("storeEditionHtmlPlugin(mode === 'store')"));
});
