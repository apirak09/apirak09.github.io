'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SKINS, SAVE_KEY, MODES, safeProfile, completeRun, purchase, equip, ProfileStore } = require('../club.js');
const storage = () => {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};

test('existing completed runs become deaths, without inventing historical coins', () => {
  const profile = safeProfile(null, { easy: 9, normal: 15, hard: 3, nightmare: 7 });
  assert.equal(Object.values(profile.deaths).reduce((a, b) => a + b), 34);
  assert.equal(profile.coins, 0); assert.equal(profile.earned, 0);
  assert.deepEqual(profile.owned, ['classic']); assert.equal(profile.equipped, 'classic');
  assert.deepEqual(safeProfile(JSON.stringify(profile)), profile);
});

test('one point banks one coin only at completion, once per run, in every mode', () => {
  let profile = safeProfile(null);
  for (const [i, mode] of MODES.entries()) {
    const run = { id: `flight-${mode}`, mode, score: i * 7 };
    const before = JSON.stringify(profile), result = completeRun(profile, run);
    assert.equal(JSON.stringify(profile), before, 'old state is not mutated');
    assert.equal(result.earned, run.score); assert.equal(result.profile.deaths[mode], 1);
    const again = completeRun(result.profile, run);
    assert.equal(again.earned, 0); assert.equal(again.duplicate, true); assert.deepEqual(again.profile, result.profile);
    profile = again.profile;
  }
  assert.equal(profile.coins, 42); assert.equal(profile.earned, 42);
  assert.equal(Object.values(profile.deaths).reduce((a, b) => a + b), 4);
});

test('malformed saves and unknown or unowned skins cannot corrupt the collection', () => {
  for (const raw of ['bad', 'null', '3', '[]', '"abc"']) assert.equal(safeProfile(raw).equipped, 'classic');
  const profile = safeProfile({ coins: -2, earned: Infinity, owned: ['mint', 'mint', '__proto__', 'unknown'], equipped: 'ironman', deaths: { easy: -1, normal: 5.5, hard: 10 } });
  assert.deepEqual(profile.owned, ['classic', 'mint']); assert.equal(profile.equipped, 'classic');
  assert.equal(profile.coins, 0); assert.equal(profile.earned, 0); assert.equal(profile.deaths.hard, 10);
  assert.equal(purchase(profile, '__proto__').ok, false); assert.equal(equip(profile, 'ironman').ok, false);
  for (const score of [-1, 2.5, Infinity, NaN, 1000000]) assert.equal(completeRun(profile, { id: 'x', mode: 'easy', score }).ok, false);
});

test('buying equips a skin and charges once; switching owned skins is free', () => {
  const start = safeProfile({ coins: 1500 });
  const first = purchase(start, 'ironman');
  assert.equal(first.profile.coins, 500); assert.equal(first.profile.equipped, 'ironman');
  const repeated = purchase(first.profile, 'ironman');
  assert.equal(repeated.profile.coins, 500); assert.equal(repeated.profile.owned.filter(id => id === 'ironman').length, 1);
  const classic = equip(repeated.profile, 'classic');
  assert.equal(classic.profile.coins, 500); assert.equal(classic.profile.equipped, 'classic');
  assert.equal(equip(classic.profile, 'ironman').profile.equipped, 'ironman');
  const blocked = purchase(classic.profile, 'strange');
  assert.equal(blocked.reason, 'insufficient'); assert.deepEqual(blocked.profile, classic.profile);
});

test('wallet, selection, deaths and owned skins survive reload without touching the old save', async () => {
  const local = storage(); local.setItem('flappy-bird-sky-club-v1', 'original scores and settings');
  const first = new ProfileStore({ storage: local, legacyRuns: { normal: 8 } });
  await first.complete({ id: 'new-run', score: 350, mode: 'normal' }); await first.buy('prism');
  const reloaded = new ProfileStore({ storage: local, legacyRuns: { normal: 9 } });
  assert.equal(reloaded.read().coins, 100); assert.equal(reloaded.read().equipped, 'prism');
  assert.equal(reloaded.read().deaths.normal, 9);
  assert.equal(local.getItem('flappy-bird-sky-club-v1'), 'original scores and settings');
  assert.equal((await reloaded.complete({ id: 'new-run', score: 350, mode: 'normal' })).earned, 0);
});

test('rapid repeated purchase taps cannot charge twice or overspend', async () => {
  const local = storage(), club = new ProfileStore({ storage: local });
  await club.complete({ id: 'fund', score: 250, mode: 'easy' });
  const results = await Promise.all([club.buy('prism'), club.buy('prism'), club.buy('mint')]);
  assert.equal(results[0].ok, true); assert.equal(results[1].ok, true); assert.equal(results[2].ok, false);
  assert.equal(club.read().coins, 0); assert.deepEqual(club.read().owned, ['classic', 'prism']);
});

test('multiple tabs serialize purchases and rewards using the shared wallet lock', async () => {
  const local = storage(); let queue = Promise.resolve(), locksUsed = 0;
  const locks = { request: (name, action) => { assert.equal(name, SAVE_KEY); locksUsed++; const task = queue.then(action); queue = task; return task; } };
  const a = new ProfileStore({ storage: local, locks }), b = new ProfileStore({ storage: local, locks });
  await Promise.all([a.complete({ id: 'tab-a', score: 300, mode: 'easy' }), b.complete({ id: 'tab-b', score: 200, mode: 'nightmare' })]);
  await Promise.all([a.buy('mint'), b.buy('prism')]);
  assert.equal(a.read().coins, 150); assert.deepEqual(a.read(), b.read());
  assert.equal(a.read().deaths.easy, 1); assert.equal(a.read().deaths.nightmare, 1); assert.equal(locksUsed, 4);
});

test('blocked or full storage retains consistent session progress and reports the limit', async () => {
  let warnings = 0;
  const old = JSON.stringify(safeProfile({ coins: 120 }));
  const club = new ProfileStore({ storage: { getItem: () => old, setItem: () => { throw new Error('quota'); } }, onStorageError: () => warnings++ });
  await club.buy('mint'); assert.equal(club.read().coins, 20); assert.equal(club.read().equipped, 'mint');
  await club.complete({ id: 'offline-run', score: 10, mode: 'hard' });
  assert.equal(club.read().coins, 30); assert.equal(club.canSave, false); assert.ok(warnings > 0);
  const blocked = new ProfileStore({ storage: { getItem: () => { throw new Error('blocked'); } } });
  await blocked.complete({ id: 'session', score: 100, mode: 'normal' }); await blocked.buy('ice');
  assert.equal(blocked.read().equipped, 'ice'); assert.equal(blocked.read().coins, 0);
});

test('a blocked Web Locks API gracefully uses the local transaction queue', async () => {
  const club = new ProfileStore({ storage: storage(), locks: { request: () => Promise.reject(new Error('not allowed')) } });
  await club.complete({ id: 'lockless', score: 100, mode: 'easy' }); await club.buy('rose');
  assert.equal(club.read().equipped, 'rose'); assert.equal(club.read().coins, 0);
});

test('all 14 paid costumes are local, round-priced, and preloaded for offline play', () => {
  const root = path.resolve(__dirname, '..'), sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.equal(SKINS.length, 15); assert.equal(new Set(SKINS.map(skin => skin.id)).size, 15);
  for (const skin of SKINS.filter(skin => skin.price)) {
    assert.ok([100, 250, 500, 750, 1000].includes(skin.price));
    const svg = fs.readFileSync(path.join(root, skin.src), 'utf8');
    assert.ok(svg.includes('<svg')); assert.ok(svg.includes(`<title>${skin.name}</title>`));
    assert.ok(!/<script|foreignObject|https?:\/\//.test(svg.replace('http://www.w3.org/2000/svg', '')));
    assert.ok(sw.includes(`./${skin.src}`));
  }
});
