'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { GameUpdates, VERSION } = require('../updates.js');
const NEXT_VERSION = `${VERSION.split('.')[0]}.${Number(VERSION.split('.')[1]) + 1}.0`;
const tick = () => new Promise(resolve => setImmediate(resolve));
class Worker extends EventTarget {
  constructor(state = 'installed') { super(); this.state = state; this.messages = []; }
  postMessage(message) { this.messages.push(message); }
  setState(state) { this.state = state; this.dispatchEvent(new Event('statechange')); }
}
function setup({ version = NEXT_VERSION, waiting = null, installing = null, online = true, supported = true } = {}) {
  const scheduled = new Map(); let timerId = 0, safe = true, saved = 0, registered;
  const timers = { setTimeout: (fn, ms) => { scheduled.set(++timerId, { fn, ms }); return timerId; }, clearTimeout: id => scheduled.delete(id) };
  const registration = Object.assign(new EventTarget(), { waiting, installing, update: async () => {} });
  const sw = Object.assign(new EventTarget(), { controller: {}, register: async (...args) => { registered = args; return registration; } });
  const reloads = [], requests = [];
  const updates = new GameUpdates({
    serviceWorker: supported ? sw : null, baseURL: 'https://example.com/flappy/', timers, now: () => 12345,
    fetcher: async (url, options) => {
      requests.push({ url, options }); if (!online) throw new Error('offline');
      return { ok: true, json: async () => ({ version }), text: async () => `<meta name="game-version" content="${version}">` };
    },
    canReload: () => safe, beforeReload: async () => { saved++; }, reload: url => reloads.push(url)
  });
  return { updates, sw, registration, reloads, requests, scheduled, setSafe: value => { safe = value; }, get saved() { return saved; }, get registered() { return registered; } };
}

test('release checks bypass HTTP caches and register only this game with updateViaCache none', async () => {
  const s = setup(); await s.updates.start(); await s.updates.check(true);
  assert.deepEqual(s.registered, ['https://example.com/flappy/sw.js', { scope: 'https://example.com/flappy/', updateViaCache: 'none' }]);
  assert.equal(s.requests[0].options.cache, 'no-store'); assert.match(s.requests[0].url, /version\.json\?check=12345/);
  assert.equal(s.updates.available, true); assert.equal(s.updates.latest, NEXT_VERSION);
});

test('checking the current version and offline errors never reload or erase progress', async () => {
  const current = setup({ version: VERSION }); await current.updates.check(true);
  assert.equal(current.updates.available, false); assert.equal(current.updates.message, 'You are up to date.');
  const offline = setup({ online: false }); await offline.updates.check(true);
  assert.match(offline.updates.error, /offline/); assert.equal(offline.updates.busy, false); assert.equal(offline.reloads.length, 0); assert.equal(offline.saved, 0);
});

test('updates cannot activate or reload while a flight or wallet settlement is in progress', async () => {
  const worker = new Worker(), s = setup({ waiting: worker }); await s.updates.start(); s.setSafe(false);
  await s.updates.apply(); assert.equal(worker.messages.length, 0); assert.equal(s.reloads.length, 0); assert.equal(s.saved, 0);
  assert.match(s.updates.error, /Finish this flight/);
});

test('explicit update saves first, activates the waiting worker and reloads exactly once', async () => {
  const worker = new Worker(), s = setup({ waiting: worker }); await s.updates.start(); await s.updates.check(true);
  await s.updates.apply(); assert.equal(s.saved, 1); assert.deepEqual(worker.messages, [{ type: 'SKIP_WAITING' }]);
  assert.equal(s.reloads.length, 0, 'activation must finish before navigation');
  s.sw.dispatchEvent(new Event('controllerchange')); s.sw.dispatchEvent(new Event('controllerchange'));
  assert.equal(s.reloads.length, 1); assert.equal(new URL(s.reloads[0]).searchParams.get('v'), NEXT_VERSION); assert.equal(new URL(s.reloads[0]).searchParams.get('update'), '12345');
});

test('another tab activating its worker does not interrupt the current tab', async () => {
  const s = setup(); await s.updates.start(); s.setSafe(false); s.sw.dispatchEvent(new Event('controllerchange'));
  assert.equal(s.reloads.length, 0); assert.equal(s.saved, 0);
});

test('an installing worker must finish its full cache before it can be activated', async () => {
  const worker = new Worker('installing'), s = setup({ installing: worker });
  await s.updates.start(); s.updates.available = true; const applying = s.updates.apply(); await tick();
  assert.equal(worker.messages.length, 0); assert.equal(s.reloads.length, 0);
  s.registration.waiting = worker; worker.setState('installed'); await applying;
  assert.deepEqual(worker.messages, [{ type: 'SKIP_WAITING' }]);
  s.sw.dispatchEvent(new Event('controllerchange')); assert.equal(s.reloads.length, 1);
});

test('failed worker installation leaves the current game running', async () => {
  const worker = new Worker('installing'), s = setup({ installing: worker });
  await s.updates.start(); s.updates.available = true; const applying = s.updates.apply(); await tick();
  worker.setState('redundant'); await applying;
  assert.equal(s.reloads.length, 0); assert.equal(s.updates.applying, false); assert.ok(s.updates.error);
});

test('without service workers, fresh release HTML is verified before a cache-busting navigation', async () => {
  const s = setup({ supported: false }); await s.updates.check(true); await s.updates.apply();
  assert.equal(s.saved, 1); assert.equal(s.reloads.length, 1); assert.equal(s.requests.at(-1).options.cache, 'no-store');
  const stale = setup({ supported: false }); await stale.updates.check(true);
  stale.updates.fetcher = async () => ({ ok: true, text: async () => `<meta name="game-version" content="${VERSION}">` });
  await stale.updates.apply(); assert.equal(stale.reloads.length, 0); assert.equal(stale.updates.applying, false);
});

test('a stalled network check times out and makes the button usable again', async () => {
  const s = setup(); s.updates.fetcher = () => new Promise(() => {});
  const check = s.updates.check(true); await tick();
  for (const timer of [...s.scheduled.values()]) timer.fn(); await check;
  assert.equal(s.updates.busy, false); assert.ok(s.updates.error); assert.equal(s.reloads.length, 0);
});
