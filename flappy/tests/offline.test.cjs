'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { SKINS } = require('../club.js');
const { VERSION } = require('../updates.js');
const source = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');
function worker() {
  const scope = 'https://example.com/flappy/', handlers = {}, stores = new Map(), requests = [], deleted = [];
  let online = true, skipped = 0, claimed = 0;
  const key = request => new URL(typeof request === 'string' ? request : request.url, scope).href;
  class Request {
    constructor(request, options = {}) { this.url = key(request); this.method = request.method || 'GET'; this.mode = request.mode || 'cors'; this.cache = options.cache || request.cache || 'default'; }
  }
  const network = async request => {
    requests.push(request); if (!online) throw new Error('offline');
    const response = new Response(`online:${request.url}`); Object.defineProperty(response, 'type', { value: 'basic' }); return response;
  };
  const cache = name => {
    if (!stores.has(name)) stores.set(name, new Map());
    const values = stores.get(name);
    return {
      addAll: async files => { for (const file of files) values.set(key(file), await network(file)); },
      put: async (request, response) => values.set(key(request), response),
      match: async request => values.get(key(request))?.clone()
    };
  };
  const self = { location: { origin: 'https://example.com' }, registration: { scope }, clients: { claim: async () => { claimed++; } }, skipWaiting: async () => { skipped++; }, addEventListener: (type, fn) => { handlers[type] = fn; } };
  vm.runInNewContext(source, { self, Request, Response, URL, fetch: network, caches: { open: async name => cache(name), keys: async () => [...stores.keys()], delete: async name => { deleted.push(name); return stores.delete(name); } } });
  const lifecycle = async (type, detail = {}) => { const waits = []; handlers[type]({ ...detail, waitUntil: promise => waits.push(promise) }); await Promise.all(waits); };
  const fetch = async (url, mode = 'cors', method = 'GET') => {
    const waits = []; let result;
    handlers.fetch({ request: { url: new URL(url, scope).href, method, mode }, waitUntil: promise => waits.push(promise), respondWith: promise => { result = promise; } });
    const response = await result; await Promise.all(waits); return response;
  };
  return { stores, requests, deleted, lifecycle, fetch, setOnline: value => { online = value; }, get skipped() { return skipped; }, get claimed() { return claimed; } };
}

test('installation fetches the full fresh release but does not activate over open games', async () => {
  const w = worker(); await w.lifecycle('install');
  assert.equal(w.skipped, 0);
  assert.ok(w.requests.every(request => request.cache === 'reload'));
  for (const skin of SKINS) assert.ok(w.requests.some(request => request.url.endsWith(`/flappy/${skin.src}`)));
});

test('all costumes, scripts and the game remain available offline after installation', async () => {
  const w = worker(); await w.lifecycle('install'); w.setOnline(false);
  for (const skin of SKINS) assert.equal((await w.fetch(skin.src)).ok, true);
  for (const script of ['core', 'audio', 'club', 'updates', 'game']) assert.equal((await w.fetch(`${script}.js?v=club-${VERSION}`)).ok, true);
  const page = await w.fetch('./?v=old-bookmark', 'navigate'); assert.equal(page.ok, true); assert.match(await page.text(), /index\.html/);
});

test('release metadata and HTML bypass caches while offline metadata fails honestly', async () => {
  const w = worker(); await w.lifecycle('install'); const before = w.requests.length;
  await w.fetch('version.json?check=123'); await w.fetch('./?update=123', 'navigate');
  assert.equal(w.requests.length, before + 2); assert.ok(w.requests.slice(-2).every(request => request.cache === 'no-store'));
  assert.ok(![...w.stores.values()].some(cache => [...cache.keys()].some(key => key.includes('version.json'))));
  w.setOnline(false); assert.equal((await w.fetch('version.json?check=124')).type, 'error');
});

test('activation deletes only old Flappy caches and responds only to the explicit update message', async () => {
  const w = worker(); await w.lifecycle('install');
  w.stores.set('flappy-sky-club-nightmare-2', new Map()); w.stores.set('frontia-v9', new Map()); w.stores.set('flappy2-v1', new Map());
  await w.lifecycle('message', { data: { type: 'something-else' } }); assert.equal(w.skipped, 0);
  await w.lifecycle('message', { data: { type: 'SKIP_WAITING' } }); assert.equal(w.skipped, 1);
  await w.lifecycle('activate'); assert.deepEqual(w.deleted, ['flappy-sky-club-nightmare-2']); assert.equal(w.claimed, 1);
  assert.ok(w.stores.has('frontia-v9')); assert.ok(w.stores.has('flappy2-v1'));
});

test('the worker never intercepts other games, external requests, or non-GET requests', async () => {
  const w = worker();
  for (const url of ['https://example.com/flappy2/', 'https://example.com/frontia/', 'https://elsewhere.com/flappy/']) assert.equal(await w.fetch(url), undefined);
  assert.equal(await w.fetch('version.json', 'cors', 'POST'), undefined);
});
