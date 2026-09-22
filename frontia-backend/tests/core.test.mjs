import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import { mergeSaves, migrateLegacy, normalizeBackendUrl, revisions, validateSave } from '../../frontia/shared.mjs';
import { startStory } from '../../frontia/stories.mjs';
import { AppStorage, StorageConflict, blankRecord } from '../../frontia/storage.mjs';
import { SaveSync } from '../../frontia/sync.mjs';
import { SaveStore } from '../save-store.mjs';
import { createApp } from '../server.mjs';

const save = (...ids) => ({ version: 2, stories: Object.fromEntries(ids.map(id => [id, startStory(id)])) });
const copy = value => structuredClone(value);
const edited = (value, id) => { const result = copy(value); result.stories[id].revision += '-edit'; result.stories[id].scene.body += ' ฉากถัดไป'; return result; };
async function temp(t) { const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cinematic-test-')); t.after(() => fs.rm(dir, { recursive: true, force: true })); return dir; }

test('four story openings and save slots are independent', () => {
  const all = save('ep-midnight', 'ep-summer', 'ep-orbit', 'ep-house');
  assert.equal(new Set(Object.values(all.stories).map(x => x.scene.body)).size, 4);
  assert.deepEqual(edited(all, 'ep-summer').stories['ep-midnight'], all.stories['ep-midnight']);
});
test('legacy migration preserves available history without copying scenes into other stories', () => {
  const scene = startStory('ep-orbit').scene;
  const result = migrateLegacy({ episodeId: 'ep-orbit', scene, recent: [{ player: 'ถาม', scene: scene.body }], progress: { 'ep-orbit': .2, 'ep-midnight': .6 }, progressUpdatedAt: 123 });
  assert.deepEqual(Object.keys(result.stories), ['ep-orbit']);
  assert.equal(result.stories['ep-orbit'].history.length, 1);
  assert.equal(result.stories['ep-orbit'].scene.body, scene.body);
  const other = migrateLegacy({ episodeId: 'ep-orbit', scene: { ...scene, body: 'เรื่องคนละเส้นทาง' }, progressUpdatedAt: 123 });
  assert.notEqual(other.stories['ep-orbit'].revision, result.stories['ep-orbit'].revision);
});
test('three-way merge combines different stories regardless of device clock skew', () => {
  const base = save('ep-midnight', 'ep-summer'), local = edited(base, 'ep-midnight'), remote = edited(base, 'ep-summer');
  local.stories['ep-midnight'].updatedAt = 1; remote.stories['ep-summer'].updatedAt = 9999999999999;
  const result = mergeSaves(local, remote, revisions(base));
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.save.stories['ep-midnight'].revision, local.stories['ep-midnight'].revision);
  assert.equal(result.save.stories['ep-summer'].revision, remote.stories['ep-summer'].revision);
});
test('same-story edits and reset conflicts are never silently resolved', () => {
  const base = save('ep-midnight'), local = edited(base, 'ep-midnight'), remote = edited(base, 'ep-midnight');
  remote.stories['ep-midnight'].revision += '-remote';
  assert.deepEqual(mergeSaves(local, remote, revisions(base)).conflicts, ['ep-midnight']);
  local.stories['ep-midnight'] = { revision: 'reset', deleted: true, updatedAt: 1 };
  assert.deepEqual(mergeSaves(local, remote, revisions(base)).conflicts, ['ep-midnight']);
  assert.equal(mergeSaves(local, base, revisions(base)).save.stories['ep-midnight'].deleted, true);
});
test('validation rejects malformed saves, strips credentials, and enforces safe backend URLs', () => {
  assert.throws(() => validateSave({ version: 2, stories: [] }));
  assert.throws(() => validateSave({ version: 2, stories: { '__proto__bad': {} } }));
  const value = save('ep-midnight'); value.password = 'must-not-sync'; assert.equal(validateSave(value).password, undefined);
  assert.equal(normalizeBackendUrl('https://example.com/api/'), 'https://example.com/api');
  for (const url of ['http://example.com', 'javascript:alert(1)', 'https://user:pass@example.com', 'https://example.com/?key=secret']) assert.throws(() => normalizeBackendUrl(url));
  assert.throws(() => normalizeBackendUrl('http://localhost:8000', 'https:'));
  assert.equal(normalizeBackendUrl('http://localhost:8000', 'http:'), 'http://localhost:8000');
});
test('disk saves use CAS and atomic backup, refusing to overwrite corrupt data', async t => {
  const file = path.join(await temp(t), 'save.json'), store = new SaveStore(file), value = save('ep-midnight');
  const first = await store.set(value, null);
  const attempts = await Promise.allSettled([store.set(edited(value, 'ep-midnight'), first.revision), store.set(value, first.revision)]);
  assert.equal(attempts.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(attempts.find(x => x.status === 'rejected').reason.status, 409);
  assert.equal(JSON.parse(await fs.readFile(file + '.bak', 'utf8')).revision, first.revision);
  assert.throws(() => store.set(value, undefined), { status: 428 });
  await fs.writeFile(file, '{corrupt'); await assert.rejects(store.read(), { status: 503 });
  await assert.rejects(store.set(value, null), { status: 503 }); assert.equal(await fs.readFile(file, 'utf8'), '{corrupt');
});
test('IndexedDB survives reopening, rejects stale tabs, and retains recovery copies', async () => {
  globalThis.indexedDB = new IDBFactory(); const map = new Map();
  globalThis.localStorage = { getItem: k => map.get(k) || null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) };
  const first = new AppStorage(), second = new AppStorage();
  const a = await first.open(), b = await second.open(); a.save = save('ep-summer'); await first.commit(a);
  b.save = save('ep-orbit'); await assert.rejects(second.commit(b), StorageConflict);
  const reloaded = await second.load(); assert.equal(reloaded.save.stories['ep-summer'].scene.location, 'บ้านพักริมทะเล');
  await first.backup(reloaded.save, 'before reset');
  const current = await first.load(); current.save = { version: 2, stories: {} }; await first.commit(current);
  assert.equal((await first.backups())[0].save.stories['ep-summer'].scene.location, 'บ้านพักริมทะเล'); first.db.close(); second.db.close();
});
function syncHarness(initial, remote = null) {
  let state = copy(initial), cloud = remote ? copy(remote) : { protocol: 2, revision: null, save: null };
  const statuses = [], conflicts = [];
  const h = { state: () => state, cloud: () => cloud, statuses, conflicts, update: fn => { const next = copy(state); if (fn(next) !== false) state = next; }, transport: async (route, data) => {
    if (route.endsWith('/get')) return copy(cloud);
    if (data.expectedRevision !== cloud.revision) throw Object.assign(new Error('conflict'), { status: 409 });
    cloud = { protocol: 2, revision: `${cloud.revision || 'initial'}-next`, save: copy(data.save) };
    return { ok: true, protocol: 2, revision: cloud.revision };
  } };
  h.engine = new SaveSync({ getState: h.state, updateState: async fn => h.update(fn), request: (...args) => h.transport(...args), onStatus: (...status) => statuses.push(status), onConflict: value => conflicts.push(value) }); return h;
}
test('autosave drains progress changed during an in-flight upload', async () => {
  const initial = blankRecord(); initial.save = save('ep-midnight'); const h = syncHarness(initial), original = h.transport; let changed = false;
  h.transport = async (route, data) => { if (route.endsWith('/set') && !changed) { changed = true; h.update(s => { s.save = edited(s.save, 'ep-midnight'); }); } return original(route, data); };
  await h.engine.run(); assert.deepEqual(h.cloud().save, h.state().save); assert.deepEqual(h.state().sync.base, revisions(h.state().save)); assert.equal(h.statuses.at(-1)[0], 'synced');
});
test('failed uploads and legacy backend never report successful sync', async () => {
  const initial = blankRecord(); initial.save = save('ep-midnight'); const h = syncHarness(initial), original = h.transport;
  h.transport = (route, data) => route.endsWith('/set') ? Promise.reject(new Error('offline')) : original(route, data);
  await assert.rejects(h.engine.run(), /offline/); assert.equal(h.state().sync.lastSync, 0); assert.equal(h.statuses.at(-1)[0], 'error');
  h.transport = async () => ({ save: null }); await assert.rejects(h.engine.run(), /อัปเดต Backend/);
});
test('cloud conflict preserves both versions; backend changes cancel late sync application', async () => {
  const initial = blankRecord(); initial.save = save('ep-midnight'); const remote = edited(initial.save, 'ep-midnight');
  const h = syncHarness(initial, { protocol: 2, revision: 'remote', save: remote }); await h.engine.run(); assert.equal(h.conflicts.length, 1); assert.deepEqual(h.state().save, initial.save);
  let release; const pending = new Promise(resolve => { release = resolve; }), stopped = syncHarness(initial); stopped.transport = () => pending;
  const running = stopped.engine.run(); stopped.engine.stop(); release({ protocol: 2, revision: 'x', save: remote }); await running; assert.deepEqual(stopped.state().save, initial.save);
});
async function server(t, overrides = {}) {
  const dir = await temp(t); let calls = 0;
  const codex = { account: async () => ({ connected: true }), models: async () => [], roleplay: async () => { calls++; return { scene: startStory('ep-midnight').scene, memory: '' }; }, ...overrides };
  const app = createApp({ appPassword: 'test-password-123456', store: new SaveStore(path.join(dir, 'save.json')), codex });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(async () => { app.closeAllConnections(); await new Promise(resolve => app.close(resolve)); });
  const base = `http://127.0.0.1:${app.address().port}`;
  return { base, calls: () => calls, post: (route, value = {}, headers = {}) => fetch(base + route, { method: 'POST', headers: { 'content-type': 'application/json', 'x-app-password': 'test-password-123456', ...headers }, body: JSON.stringify(value) }) };
}
test('HTTP auth, CORS and JSON checks precede state changes', async t => {
  const s = await server(t);
  assert.equal((await s.post('/api/save/get', {}, { 'x-app-password': 'wrong' })).status, 401);
  const denied = await s.post('/api/save/get', {}, { origin: 'https://other.example' }); assert.equal(denied.status, 403); assert.equal(denied.headers.get('access-control-allow-origin'), null);
  const allowed = await s.post('/api/save/get', {}, { origin: 'https://apirak09.github.io' }); assert.equal(allowed.status, 200); assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://apirak09.github.io');
  assert.equal((await s.post('/api/save/get', {}, { 'content-type': 'text/plain' })).status, 415);
  assert.equal((await fetch(s.base + '/api/save/get', { method: 'POST', headers: { 'content-type': 'application/json', 'x-app-password': 'test-password-123456' }, body: '{' })).status, 400);
});
test('HTTP save rejects stale clients and round-trips Thai scenes', async t => {
  const s = await server(t), data = save('ep-midnight');
  assert.equal((await s.post('/api/save/set', { save: data })).status, 428);
  const written = await (await s.post('/api/save/set', { save: data, expectedRevision: null })).json(); assert.equal(written.ok, true);
  assert.equal((await s.post('/api/save/set', { save: data, expectedRevision: null })).status, 409);
  const read = await (await s.post('/api/save/get')).json(); assert.deepEqual(read.save, data); assert.equal(read.revision, written.revision);
});
test('HTTP invalid or oversized roleplay input never reaches Codex', async t => {
  const s = await server(t); assert.equal((await s.post('/api/roleplay', {})).status, 400);
  assert.equal((await s.post('/api/roleplay', { huge: 'x'.repeat(310000) })).status, 413); assert.equal(s.calls(), 0);
});
test('completed generation retries are idempotent and cannot change request data', async t => {
  const s = await server(t), data = { requestId: randomUUID(), model: 'test-model', episode: { id: 'ep-midnight' }, scene: startStory('ep-midnight').scene, input: 'ถามมีนา', recent: [] };
  const first = await (await s.post('/api/roleplay', data)).json(); assert.deepEqual(await (await s.post('/api/roleplay', data)).json(), first); assert.equal(s.calls(), 1);
  assert.equal((await s.post('/api/roleplay', { ...data, input: 'เดินออกไป' })).status, 409);
});
test('HTTP disconnect cancels generation and releases the single-turn lock', async t => {
  let began, cancelled, turns = 0;
  const started = new Promise(resolve => { began = resolve; }), aborted = new Promise(resolve => { cancelled = resolve; });
  const s = await server(t, { roleplay: async (_, signal) => {
    if (++turns > 1) return { scene: startStory('ep-midnight').scene, memory: '' };
    began(); return new Promise((_, reject) => signal.addEventListener('abort', () => { cancelled(); reject(Object.assign(new Error('cancelled'), { status: 499 })); }, { once: true }));
  } });
  const data = { requestId: randomUUID(), model: 'test-model', episode: { id: 'ep-midnight' }, scene: startStory('ep-midnight').scene, input: 'รอสักครู่', recent: [] }, controller = new AbortController();
  const request = fetch(s.base + '/api/roleplay', { method: 'POST', headers: { 'content-type': 'application/json', 'x-app-password': 'test-password-123456' }, body: JSON.stringify(data), signal: controller.signal }).catch(error => error.name);
  await started; assert.equal((await s.post('/api/roleplay', { ...data, requestId: randomUUID() })).status, 429);
  controller.abort(); await aborted; assert.equal(await request, 'AbortError');
  assert.equal((await s.post('/api/roleplay', { ...data, requestId: randomUUID() })).status, 200);
});
