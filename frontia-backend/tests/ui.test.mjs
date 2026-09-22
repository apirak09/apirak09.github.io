import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';
import { build } from 'esbuild';

const html = await fs.readFile(new URL('../../frontia/index.html', import.meta.url), 'utf8');
const bundled = (await build({ entryPoints: [fileURLToPath(new URL('../../frontia/app.js', import.meta.url))], bundle: true, format: 'iife', write: false })).outputFiles[0].text;
async function until(condition, label = 'UI update') {
  const deadline = Date.now() + 1500;
  while (!condition()) { if (Date.now() > deadline) throw new Error(`Timed out: ${label}`); await new Promise(resolve => setTimeout(resolve, 5)); }
}
async function app(t, { factory = new IDBFactory(), hash = '', fetch } = {}) {
  const dom = new JSDOM(html, { url: `https://apirak09.github.io/frontia/${hash}`, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.indexedDB = factory; w.structuredClone = structuredClone;
  Object.defineProperty(w.crypto, 'randomUUID', { value: randomUUID });
  w.BroadcastChannel = undefined; w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {};
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.confirm = () => true;
  w.fetch = fetch || (async () => { throw new w.TypeError('Network unavailable'); });
  t.after(() => w.close()); w.eval(bundled); await until(() => w.document.querySelector('#main'), 'application boot');
  return { w, doc: w.document, factory, dom };
}
async function navigate(a, hash, selector) { a.w.location.hash = hash; await until(() => a.doc.querySelector(selector), hash); }
async function start(a, id) {
  await navigate(a, `episode/${id}`, '[data-action="start"]'); a.doc.querySelector('[data-action="start"]').click();
  await until(() => a.doc.querySelector('#freeText'), 'player start');
}
async function saved(factory) {
  const db = await new Promise(resolve => { const r = factory.open('cinematic-play', 1); r.onsuccess = () => resolve(r.result); });
  const value = await new Promise(resolve => { const r = db.transaction('app').objectStore('app').get('state'); r.onsuccess = () => resolve(r.result); });
  db.close(); return value;
}
test('UI keeps different Thai story scenes after navigation and reload', async t => {
  const a = await app(t); await start(a, 'ep-summer'); assert.match(a.doc.querySelector('.location').textContent, /ทะเล/);
  await start(a, 'ep-orbit'); assert.match(a.doc.querySelector('.location').textContent, /วงโคจร/);
  a.w.close(); const b = await app(t, { factory: a.factory, hash: '#player/ep-summer' });
  assert.match(b.doc.querySelector('.location').textContent, /ทะเล/);
  assert.equal(Object.keys((await saved(a.factory)).save.stories).length, 2);
});
test('rapid repeated choice clicks create only one next scene', async t => {
  const a = await app(t); await start(a, 'ep-midnight'); const choice = a.doc.querySelector('[data-choice="0"]');
  choice.click(); choice.click(); choice.click(); await until(() => a.doc.querySelector('.preview-end'));
  assert.equal((await saved(a.factory)).save.stories['ep-midnight'].history.length, 2);
  assert.match(a.doc.body.textContent, /ฉากตัวอย่าง/);
});
test('multiline Thai drafts survive reload and journal/location controls show real data', async t => {
  const a = await app(t); await start(a, 'ep-house'); const text = 'ฉันเดินไปเคาะประตู\n“มีใครอยู่ไหม?”';
  const field = a.doc.querySelector('#freeText'); field.value = text; field.dispatchEvent(new a.w.Event('input', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 400)); a.w.close();
  const b = await app(t, { factory: a.factory, hash: '#player/ep-house' }); assert.equal(b.doc.querySelector('#freeText').value, text);
  b.doc.querySelector('[data-action="journal"]').click(); await until(() => b.doc.querySelector('.journal-entry'));
  assert.equal(b.doc.querySelectorAll('.journal-entry').length, 1); b.doc.querySelector('[data-action="close-dialog"]').click();
  b.doc.querySelector('[data-action="locations"]').click(); await until(() => b.doc.querySelector('#dialog').textContent.includes('รั้วบ้าน'));
});
test('configured backend failure never substitutes a demo or deletes the typed action', async t => {
  const a = await app(t); await start(a, 'ep-midnight'); await navigate(a, 'settings', '#settingsForm');
  a.doc.querySelector('#backendUrl').value = 'https://backend.example'; a.doc.querySelector('#appPassword').value = 'test-password-123456';
  a.doc.querySelector('#settingsForm').dispatchEvent(new a.w.Event('submit', { bubbles: true, cancelable: true }));
  await until(() => a.doc.body.textContent.includes('บันทึกการตั้งค่าแล้ว'));
  await navigate(a, 'player/ep-midnight', '#freeText'); const field = a.doc.querySelector('#freeText'); field.value = 'ถามมีนาว่าเกิดอะไรขึ้น'; field.dispatchEvent(new a.w.Event('input', { bubbles: true }));
  a.doc.querySelector('[data-action="send"]').click(); await until(() => a.doc.body.textContent.includes('ติดต่อ Backend ไม่ได้'));
  assert.equal((await saved(a.factory)).save.stories['ep-midnight'].history.length, 1);
  assert.equal(a.doc.querySelector('#freeText').value, 'ถามมีนาว่าเกิดอะไรขึ้น');
});
test('reset creates a tombstone and a recoverable backup', async t => {
  const a = await app(t); await start(a, 'ep-summer'); await navigate(a, 'settings', '#settingsForm');
  a.doc.querySelector('[data-action="reset-all"]').click(); await until(() => a.w.location.hash === '#home');
  assert.equal((await saved(a.factory)).save.stories['ep-summer'].deleted, true);
  await navigate(a, 'settings', '#settingsForm'); a.doc.querySelector('[data-action="backups"]').click(); await until(() => a.doc.querySelector('[data-backup]'));
  a.doc.querySelector('[data-backup]').click(); await until(() => !a.doc.querySelector('#dialog').open);
  assert.equal((await saved(a.factory)).save.stories['ep-summer'].scene.location, 'บ้านพักริมทะเล');
});
test('backend model discovery selects an available default instead of a stale hardcoded model', async t => {
  const a = await app(t, { fetch: async url => new Response(JSON.stringify(url.endsWith('/api/models')
    ? { models: [{ model: 'available-model', displayName: 'Available', isDefault: true }] }
    : url.endsWith('/api/save/get') ? { protocol: 2, revision: null, save: null } : { connected: true }), { status: 200 }) });
  await navigate(a, 'settings', '#settingsForm');
  a.doc.querySelector('#backendUrl').value = 'https://backend.example'; a.doc.querySelector('#appPassword').value = 'test-password-123456';
  a.doc.querySelector('[data-action="test-backend"]').click();
  await until(() => a.doc.querySelector('#model').value === 'available-model');
  assert.equal((await saved(a.factory)).settings.model, 'available-model');
});
test('service worker cleanup is scoped and never caches backend or neighboring projects', async () => {
  const listeners = {}, removed = [], claimed = [];
  const context = { URL, Request, Response, fetch, self: { registration: { scope: 'https://apirak09.github.io/frontia/' }, location: new URL('https://apirak09.github.io/frontia/sw.js'), clients: { claim: async () => claimed.push(true) }, addEventListener: (name, callback) => { listeners[name] = callback; } }, caches: { keys: async () => ['cinematic-play-v5', 'cinematic-play-shell-v5', 'cinematic-play-shell-v6.0.0', 'another-app-v1'], delete: async key => removed.push(key) } };
  vm.runInNewContext(await fs.readFile(new URL('../../frontia/sw.js', import.meta.url), 'utf8'), context);
  let completion; listeners.activate({ waitUntil: p => { completion = p; } }); await completion;
  assert.deepEqual(removed.sort(), ['cinematic-play-shell-v5', 'cinematic-play-v5']); assert.equal(claimed.length, 1);
  for (const url of ['https://backend.example/api/save/get', 'https://apirak09.github.io/other/app.js']) listeners.fetch({ request: new Request(url), respondWith: () => assert.fail('must not intercept unrelated traffic') });
});
