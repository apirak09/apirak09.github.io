import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
function worker() {
  const handlers = {}, stores = new Map(), removed = [], scope = 'https://example.test/flappy2/'; let online = true, claimed = false;
  const href = request => new URL(typeof request === 'string' ? request : request.url, scope).href;
  const caches = { keys: async () => [...stores.keys()], delete: async key => { removed.push(key); return stores.delete(key); }, open: async key => {
    if (!stores.has(key)) stores.set(key, new Map()); const cache = stores.get(key);
    return { addAll: async paths => { for (const entry of paths) { const path = './' + new URL(entry.url).pathname.replace('/flappy2/', ''); assert.equal(entry.cache, 'reload', 'updating worker bypasses stale HTTP assets'); assert.ok(fs.existsSync(new URL(`../${path === './' ? 'index.html' : path}`, import.meta.url)), `precache asset exists: ${path}`); const query = new URL(entry.url).search; cache.set(href(entry), new Response(`cached:${path}${query}`)); } }, put: async (request, response) => cache.set(href(request), response) };
  }, match: async request => { for (const cache of stores.values()) if (cache.has(href(request))) return cache.get(href(request)).clone(); } };
  const self = { location: { origin: 'https://example.test' }, registration: { scope }, clients: { claim: async () => { claimed = true; } }, addEventListener: (name, handler) => handlers[name] = handler };
  vm.runInNewContext(source, { self, caches, URL, Request, Response, fetch: async () => { if (!online) throw Error('offline'); return new Response('network'); } });
  return { handlers, stores, removed, offline() { online = false; }, get claimed() { return claimed; } };
}
async function lifecycle(w, type) { let result; w.handlers[type]({ waitUntil: promise => result = promise }); await result; }
async function request(w, path, mode = 'cors', method = 'GET') { let response; w.handlers.fetch({ request: { url: path, mode, method }, respondWith: promise => response = promise }); return response; }
test('worker installs every asset and cleanup cannot touch the original game or other apps', async () => {
  const w = worker(); w.stores.set('flappy-bird-sky-club-v1', new Map()); w.stores.set('other-app', new Map()); w.stores.set('apirak-flappy2-old', new Map());
  await lifecycle(w, 'install'); await lifecycle(w, 'activate');
  assert.deepEqual(w.removed, ['apirak-flappy2-old']); assert.equal(w.claimed, true); assert.ok(w.stores.has('flappy-bird-sky-club-v1')); assert.ok(w.stores.get('apirak-flappy2-v2').size >= 13);
});
test('offline startup uses cached HTML/modules/fonts, with navigation fallback', async () => {
  const w = worker(); await lifecycle(w, 'install'); w.offline();
  for (const path of ['', 'index.html', 'app.mjs?v=2', 'engine.mjs?v=2', 'assets/fonts/manrope.woff2']) { const response = await request(w, `https://example.test/flappy2/${path}`, path ? 'cors' : 'navigate'); assert.ok((await response.text()).startsWith('cached:')); }
  const fallback = await request(w, 'https://example.test/flappy2/not-a-real-route', 'navigate'); assert.equal(await fallback.text(), 'cached:./index.html');
});
test('worker never intercepts old Flappy, unrelated URLs, cross-origin requests or writes', async () => {
  const w = worker(); await lifecycle(w, 'install');
  for (const [url, method] of [['https://example.test/flappy/core.js','GET'],['https://example.test/tuner/','GET'],['https://elsewhere.test/flappy2/','GET'],['https://example.test/flappy2/','POST']]) assert.equal(await request(w, url, 'cors', method), undefined);
});
