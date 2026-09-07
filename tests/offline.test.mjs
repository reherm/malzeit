import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const origin = 'https://atelier.test/';
async function worker({ failAsset = false } = {}) {
  const code = await readFile('dist/client/sw.js', 'utf8');
  const handlers = {};
  const stores = new Map();
  let online = true;
  let claims = 0;
  const key = (r) => (typeof r === 'string' ? r : r.url);
  const caches = {
    open: async (name) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const data = stores.get(name);
      return {
        put: async (req, response) => data.set(key(req), response.clone()),
        match: async (req) => data.get(key(req))?.clone(),
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
  };
  const context = vm.createContext({
    URL,
    Request,
    Response,
    console,
    caches,
    fetch: async (req) => {
      if (!online) throw new Error('Offline');
      const url = new URL(key(req));
      if (failAsset && url.pathname.endsWith('.js'))
        return new Response('', { status: 503 });
      const path = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      return new Response(await readFile('dist/client/' + path));
    },
    self: {
      location: { href: origin + 'sw.js', origin: new URL(origin).origin },
      addEventListener: (name, handler) => {
        handlers[name] = handler;
      },
      clients: {
        claim: async () => {
          claims++;
        },
        matchAll: async () => [],
      },
    },
  });
  vm.runInContext(code, context);
  return {
    stores,
    claims: () => claims,
    offline: () => {
      online = false;
    },
    event: async (name, extra = {}) => {
      let result;
      handlers[name]({
        ...extra,
        waitUntil: (p) => {
          result = p;
        },
        respondWith: (p) => {
          result = p;
        },
      });
      return result;
    },
    assets: vm.runInContext('ASSETS', context),
  };
}
void test('Installation caches every compiled asset; cold navigation and scripts work offline', async () => {
  const w = await worker();
  await w.event('install');
  await w.event('activate');
  assert.equal(w.claims(), 1);
  w.offline();
  const shell = await w.event('fetch', {
    request: { url: origin, method: 'GET', mode: 'navigate' },
  });
  assert.match(await shell.text(), /Malzeit/);
  const scripts = w.assets.filter((a) => a.endsWith('.js'));
  assert.ok(scripts.length > 0);
  for (const path of scripts) {
    const response = await w.event('fetch', {
      request: new Request(new URL(path, origin)),
    });
    assert.ok((await response.text()).length > 0);
  }
  const query = await w.event('fetch', {
    request: { url: origin + '?from=home', method: 'GET', mode: 'navigate' },
  });
  assert.equal(query.status, 200);
});
void test('A failed installation removes its partial cache and does not activate', async () => {
  const w = await worker({ failAsset: true });
  await assert.rejects(() => w.event('install'));
  assert.equal(w.stores.size, 0);
  assert.equal(w.claims(), 0);
});
void test('Service worker does not intercept writes or other origins', async () => {
  const w = await worker();
  assert.equal(
    await w.event('fetch', { request: new Request('https://other.test/') }),
    undefined,
  );
  assert.equal(
    await w.event('fetch', {
      request: new Request(origin, { method: 'POST', body: 'a' }),
    }),
    undefined,
  );
});
