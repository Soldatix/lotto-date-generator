import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const native = JSON.parse(
  readFileSync('src-tauri/tauri.conf.json', 'utf8')
);
const store = JSON.parse(
  readFileSync('src-tauri/tauri.store.conf.json', 'utf8')
);
const csp = native.app.security.csp;

test('Native CSP restricts scripts, connections and embedded content', () => {
  assert.equal(csp['default-src'], "'self'");
  assert.equal(csp['script-src'], "'self'");
  assert.equal(csp['connect-src'],
    "'self' ipc: http://ipc.localhost");
  assert.equal(csp['object-src'], "'none'");
  assert.equal(csp['base-uri'], "'none'");
  assert.equal(csp['form-action'], "'none'");
  assert.equal(csp['frame-src'], "'none'");
  assert.doesNotMatch(csp['script-src'], /unsafe-inline|unsafe-eval/);
  assert.doesNotMatch(csp['connect-src'], /https?:\/\/\*/);
});

test('CSP retains required local styles and image sources', () => {
  assert.equal(csp['style-src'], "'self' 'unsafe-inline'");
  assert.equal(csp['img-src'], "'self' data: blob:");
  assert.equal(csp['font-src'], "'self' data:");
  assert.match(
    readFileSync('src/js/ag-language-menu.js', 'utf8'),
    /style\.textContent/
  );
});

test('Store edition inherits the native CSP', () => {
  assert.equal(store.app?.security?.csp, undefined);
  assert.equal(
    store.build.beforeBuildCommand,
    'npm run build:store'
  );
});