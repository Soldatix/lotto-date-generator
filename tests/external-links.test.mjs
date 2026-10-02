import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const urls = [
  'https://appsandgames.org/',
  'https://www.paypal.com/ncp/payment/RU2CWCNVQ7XD6',
  'https://buy.stripe.com/7sYeVd7Blfe89cm0k02kw00'
];

const source = readFileSync('src/js/external-links.js', 'utf8');

assert.match(source, /export function initializeExternalLinks/);

const executable = source
  .replace(/^import[^\r\n]*\r?\n/, '')
  .replace(
    'export function initializeExternalLinks',
    'function initializeExternalLinks'
  );

const initializeExternalLinks = vm.runInNewContext(
  executable + '\ninitializeExternalLinks;',
  { openUrl: () => Promise.resolve(), Promise, Set }
);

function fixture({
  href = urls[0],
  native = true,
  alreadyPrevented = false,
  hasAnchor = true,
  mode = 'success'
} = {}) {
  let handler;
  let errors = 0;
  const opened = [];

  const container = {
    addEventListener(type, callback) {
      assert.equal(type, 'click');
      handler = callback;
    }
  };

  initializeExternalLinks({
    container,
    isNative: () => native,
    onError: () => { errors++; },
    opener: url => {
      opened.push(url);

      if (mode === 'throw') {
        throw new Error('Native opener unavailable');
      }

      if (mode === 'reject') {
        return Promise.reject(new Error('Permission denied'));
      }

      return Promise.resolve();
    }
  });

  const event = {
    defaultPrevented: alreadyPrevented,
    preventDefault() {
      this.defaultPrevented = true;
    },
    target: {
      closest(selector) {
        assert.equal(selector, 'a[href]');
        return hasAnchor ? { href } : null;
      }
    }
  };

  handler(event);

  return {
    event,
    opened,
    get errors() { return errors; }
  };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

test('Windows opens each approved URL', async () => {
  for (const href of urls) {
    const result = fixture({ href });

    await flush();

    assert.deepEqual(result.opened, [href]);
    assert.equal(result.event.defaultPrevented, true);
    assert.equal(result.errors, 0);
  }
});

test('Web/PWA preserves normal browser navigation', async () => {
  for (const href of urls) {
    const result = fixture({ href, native: false });

    await flush();

    assert.deepEqual(result.opened, []);
    assert.equal(result.event.defaultPrevented, false);
    assert.equal(result.errors, 0);
  }
});

test('Unapproved URLs cannot invoke native Opener', async () => {
  for (const href of [
    'https://example.com/',
    'http://appsandgames.org/',
    'https://appsandgames.org/other',
    'https://www.paypal.com/ncp/payment/OTHER'
  ]) {
    const result = fixture({ href });

    await flush();

    assert.deepEqual(result.opened, []);
    assert.equal(result.event.defaultPrevented, false);
  }
});

test('Previously cancelled clicks do not invoke Opener', async () => {
  const result = fixture({ alreadyPrevented: true });

  await flush();

  assert.deepEqual(result.opened, []);
  assert.equal(result.errors, 0);
});

test('Clicks outside anchors do not invoke Opener', async () => {
  const result = fixture({ hasAnchor: false });

  await flush();

  assert.deepEqual(result.opened, []);
  assert.equal(result.event.defaultPrevented, false);
});

for (const mode of ['reject', 'throw']) {
  test(`Native Opener ${mode} reports one failure`, async () => {
    const result = fixture({ mode });

    await flush();

    assert.deepEqual(result.opened, [urls[0]]);
    assert.equal(result.event.defaultPrevented, true);
    assert.equal(result.errors, 1);
  });
}

test('Tauri capabilities allow exactly the three URLs', () => {
  const acl = JSON.parse(
    readFileSync('src-tauri/capabilities/default.json', 'utf8')
  );

  const permission = acl.permissions.filter(
    entry => entry?.identifier === 'opener:allow-open-url'
  );

  assert.equal(permission.length, 1);
  assert.deepEqual(
    Array.from(permission[0].allow, entry => entry.url).sort(),
    [...urls].sort()
  );

  assert.match(
    readFileSync('src-tauri/src/lib.rs', 'utf8'),
    /tauri_plugin_opener::init\(\)/
  );
});

test('All five languages contain the link failure message', () => {
  const translations = readFileSync(
    'src/data/translations.js',
    'utf8'
  );

  assert.equal(
    [...translations.matchAll(/linkFailed:/g)].length,
    5
  );
});