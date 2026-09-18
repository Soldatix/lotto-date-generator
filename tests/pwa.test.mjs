import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync('src/js/pwa.js', 'utf8');
test('PWA registration requires production, secure HTTP(S), and browser support', async () => {
  for (const prod of [false, true]) for (const secure of [false, true])
    for (const protocol of ['file:', 'http:', 'https:']) for (const supported of [false, true]) {
      const calls = [];
      const context = vm.createContext({
        window: { isSecureContext: secure, location: { protocol } },
        document: { readyState: 'complete' },
        navigator: supported ? { serviceWorker: { register: (...args) => { calls.push(args); return Promise.resolve(); } } } : {},
        console,
      });
      vm.runInContext(source.replace('export ', '').replaceAll('import.meta.env.PROD', String(prod))
        .replaceAll('import.meta.env.BASE_URL', "'./'") + '\nregisterPwa();', context);
      assert.equal(calls.length, Number(prod && secure && protocol !== 'file:' && supported));
      if (calls.length) {
        assert.equal(calls[0][0], './sw.js');
        assert.equal(calls[0][1].updateViaCache, 'none');
      }
    }
});

test('registration waits for load and handles failure without affecting app', async () => {
  let listener, warning;
  const context = vm.createContext({
    window: { isSecureContext: true, location: { protocol: 'https:' }, addEventListener(type, fn, options) {
      assert.equal(type, 'load'); assert.equal(options.once, true); listener = fn;
    } }, document: { readyState: 'loading' },
    navigator: { serviceWorker: { register: () => Promise.reject(new Error('offline')) } },
    console: { warn: (...args) => { warning = args; } },
  });
  vm.runInContext(source.replace('export ', '').replaceAll('import.meta.env.PROD', 'true')
    .replaceAll('import.meta.env.BASE_URL', "'./'") + '\nregisterPwa();', context);
  assert.ok(listener); listener();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(warning[1].message, 'offline');
});

test('production precache includes every final asset, manifest and valid PNG icons', () => {
  const sw = readFileSync('dist/sw.js', 'utf8');
  const assets = readdirSync('dist/assets').filter(name => /\.(js|css)$/.test(name));
  assert.ok(assets.some(name => name.endsWith('.js')));
  assert.ok(assets.some(name => name.endsWith('.css')));
  for (const path of ['index.html', 'manifest.webmanifest', ...assets.map(name => `assets/${name}`),
    'icons/icon-192.png', 'icons/icon-512.png']) assert.ok(sw.includes(`"${path}"`), path);
  assert.match(sw, /cleanupOutdatedCaches/);
  assert.match(sw, /createHandlerBoundToURL\("index.html"\)/);
  assert.doesNotMatch(sw, /clientsClaim\(/);
  assert.doesNotMatch(readFileSync('vite.config.mjs', 'utf8') + source, /assets\/[\w-]+\.(js|css)/);
  const manifest = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8'));
  assert.deepEqual(manifest, JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8')));
  for (const icon of manifest.icons) {
    const png = readFileSync(`dist/${icon.src}`);
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
});

