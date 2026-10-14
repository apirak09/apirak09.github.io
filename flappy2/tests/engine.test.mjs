import test from 'node:test';
import assert from 'node:assert/strict';
import { Flight, H, FLOOR, R, MODES, SINS, seeded, tuning, validateSave, sweptCircle, sweptRect } from '../engine.mjs';
const start = (mode = 'hell', seed = 41, width = 1000) => { const f = new Flight(mode, width, seeded(seed)); f.flap(); f.director = 1e6; f.nextGate = 1e6; return f; };
function hold(f, target, dt = 1 / 120) { if (f.y > target + 12 && f.vy > -220) f.flap(); f.step(dt); f.drainEvents(); }
function pilot(f, fps, seconds = 70) {
  f.flap(); let attack = null, laserY = 320, decision = -1, flapAt = -1, target = 320;
  for (let n = 0; n < seconds * fps && f.state === 'playing' && f.round < 2; n++) {
    if (f.elapsed - decision >= .045) {
      decision = f.elapsed;
      if (f.mode === 'moon' || f.phase === 'gates') {
        const gate = f.gates.find(g => g.x + g.w + 5 > f.birdX - R && g.x < f.width);
        target = gate?.center ?? 320;
      } else if (f.attack) {
        const a = f.attack;
        if (a.kind === 'volley') target = a.safeY;
        else {
          if (a !== attack) {
            const candidates = [];
            for (let y = 75; y < FLOOR - 65; y += 5) if (a.shooters.every(b => Math.abs(b.aim - y) > a.tuning.beam + R + 44)) candidates.push(y);
            candidates.sort((x, y) => Math.abs(x - f.y) - Math.abs(y - f.y)); laserY = candidates[0] ?? 320;
          }
          target = laserY;
        }
        attack = a;
      } else target = 320;
    }
    if (f.y > target + (f.mode === 'moon' ? 5 : 14) && f.vy > (f.mode === 'moon' ? -85 : -230) && f.elapsed - flapAt >= .14) { f.flap(); flapAt = f.elapsed; }
    f.step(1 / fps); f.drainEvents();
    assert.ok(f.gates.length <= Math.ceil(f.width / 190) + 4);
    if (f.attack) assert.equal(f.gates.length, 0, 'bat attacks have an empty gate field');
  }
  return f;
}
test('only Moon, Nightmare, and Hell exist; invalid choices use Moon', () => {
  assert.deepEqual(Object.keys(MODES), ['moon', 'nightmare', 'hell']);
  for (const mode of ['easy', 'normal', 'hard', '__proto__']) assert.equal(new Flight(mode).mode, 'moon');
});
test('Moon has exactly one-sixth Nightmare gravity and longer hang time', () => {
  assert.equal(MODES.moon.gravity * 6, MODES.nightmare.gravity);
  const moon = start('moon'), nightmare = start('nightmare'); moon.step(.1); nightmare.step(.1);
  assert.ok(moon.vy < 0 && nightmare.vy < 0);
  assert.ok(-MODES.moon.flap / MODES.moon.gravity > -MODES.nightmare.flap / MODES.nightmare.gravity * 2);
});
test('same physics across 30, 60, and 120 FPS', () => {
  const positions = [30, 60, 120].map(fps => { const f = start('moon'); for (let i = 0; i < fps * 1.5; i++) { if (i % Math.round(fps * .5) === 0) f.flap(); f.step(1 / fps); } return [f.y, f.elapsed, f.distance]; });
  for (let j = 1; j < positions.length; j++) positions[0].forEach((n, i) => assert.ok(Math.abs(n - positions[j][i]) < .0001));
});
test('non-finite and negative dt are ignored; a suspended frame cannot fast-forward', () => {
  const f = start(); const y = f.y; for (const d of [NaN, Infinity, -1, 0]) f.step(d); assert.equal(f.y, y);
  f.step(99); assert.ok(f.elapsed <= .10000001);
});
test('pause freezes physics, encounter timers, history, and warning locks', () => {
  const f = start(); f.spawnSin('wrath', f.birdX + 220); f.step(.05); f.drainEvents(); assert.ok(f.pause());
  const snapshot = JSON.stringify(f); for (let i = 0; i < 60; i++) { f.step(.1); f.flap(); }
  assert.equal(JSON.stringify(f), snapshot); assert.ok(f.resume()); f.step(.01); assert.ok(f.elapsed > .05);
});
test('resize preserves hazard-to-bird distance and all active bolt distances', () => {
  const f = start(); f.spawnSin('greed', 600); f.gates.push({ x: 700 }); f.bolts.push({ x: 400 });
  const before = [...f.hazards, ...f.gates, ...f.bolts].map(e => e.x - f.birdX);
  const bladeBefore = f.hazards[0].blades.map(e => e.x - f.birdX);
  f.resize(320); [...f.hazards, ...f.gates, ...f.bolts].forEach((e, i) => assert.ok(Math.abs(e.x - f.birdX - before[i]) < 1e-8));
  f.hazards[0].blades.forEach((e, i) => assert.ok(Math.abs(e.x - f.birdX - bladeBefore[i]) < 1e-8));
});
test('swept geometry catches objects crossing the whole bird in one step', () => {
  assert.ok(sweptCircle(1000, 100, -1000, 100, 8, 0, 100, R));
  assert.ok(sweptRect(-1000, 100, 1000, 100, R, 0, 80, 70, 40));
  assert.ok(!sweptRect(-1000, 160, 1000, 160, R, 0, 80, 70, 40));
});
test('gates score once after full clearance, and swept gates cannot tunnel', () => {
  const f = start('nightmare'); f.gates = [{ x: f.birdX - 100, center: f.y, base: f.y, gap: 200, w: 70, drift: 0, age: 0, scored: false }];
  f.step(.01); assert.equal(f.score, 1); f.step(.01); assert.equal(f.score, 1);
  const hit = start('nightmare'); hit.speed = 1e6; hit.gates = [{ x: hit.birdX + 200, center: 500, base: 500, gap: 130, w: 70, drift: 0, age: 0, scored: false }]; hit.step(1 / 120); assert.equal(hit.reason, 'gate');
});
test('Nightmare keeps scaling after geometry and bat count stop shrinking', () => {
  for (let score = 0; score < 500; score++) { const a = tuning('nightmare', 0, score), b = tuning('nightmare', 0, score + 1); assert.ok(b.speed > a.speed && b.boltSpeed > a.boltSpeed); assert.ok(b.gap <= a.gap && b.gap > R * 2); assert.ok(b.bats >= a.bats && b.bats <= 8); }
});
test('a laser warning locks its line, is harmless before firing, then lethal', () => {
  const f = start('nightmare'); f.phase = 'swarm'; f.beginBatAttack(); const a = f.attack, y = a.shooters[0].aim;
  f.y = y + 110; f.vy = 0; f.step(.01); assert.equal(a.shooters[0].aim, y);
  a.age = a.shooters[0].fireAt - .03; f.y = y; f.vy = 0; f.step(.01); assert.equal(f.state, 'playing');
  a.age = a.shooters[0].fireAt - .001; f.y = y; f.vy = 0; f.step(.01); assert.equal(f.reason, 'laser');
});
test('multiple bats have independent fixed lines and snapshot tuning', () => {
  const f = start('nightmare'); f.score = 17; f.threat = tuning('nightmare', 0, f.score); f.phase = 'swarm'; f.beginBatAttack();
  const a = f.attack; assert.equal(a.shooters.length, 4); assert.equal(new Set(a.shooters.map(b => b.aim)).size, 4);
  const copy = JSON.stringify(a.tuning); f.score = 100; f.threat = tuning('nightmare', 0, 100); assert.equal(JSON.stringify(a.tuning), copy);
});
test('volley leaves a shared open corridor, including every projectile radius', () => {
  const f = start('nightmare'); f.round = 2; f.phase = 'swarm'; f.score = 21; f.threat = tuning('nightmare', 0, f.score); f.beginBatAttack();
  const a = f.attack; f.y = a.safeY; f.previousY = f.y; let maxBolts = 0;
  while (f.attack === a) {
    f.advanceNightmare(1 / 120); maxBolts = Math.max(maxBolts, f.bolts.length);
    for (const b of f.bolts) assert.ok(Math.abs(b.y - a.safeY) > a.tuning.corridor + b.r);
  }
  assert.ok(maxBolts > 15);
});
test('seven sins are sampled without a fixed rotation; repeats and combinations vary', () => {
  const sequences = [], all = new Set();
  for (let seed = 1; seed <= 4; seed++) { const f = start('hell', seed); const sequence = []; for (let n = 0; n < 100; n++) { f.hazards = []; f.scheduleHell(); sequence.push(f.hazards[0].sin); all.add(f.hazards[0].sin); } sequences.push(sequence.join(',')); }
  assert.equal(all.size, 7); assert.equal(new Set(sequences).size, 4); assert.ok(sequences.some(s => s.split(',').some((v, i, a) => i && v === a[i - 1])));
});
test('Hell scales by time even without any score', () => {
  for (let seconds = 1; seconds < 1800; seconds++) { const a = tuning('hell', seconds - 1), b = tuning('hell', seconds); assert.ok(b.speed > a.speed); assert.ok(b.interval <= a.interval && b.warning <= a.warning && b.gap <= a.gap); }
});
test('overlap starts only after 45 seconds and never queues more than a pair', () => {
  const f = start('hell', 2);
  for (let i = 0; i < 100; i++) { f.hazards = []; f.scheduleHell(); assert.equal(f.hazards.length, 1); }
  f.elapsed = 100; f.threat = tuning('hell', 100); let pairs = 0;
  for (let i = 0; i < 100; i++) { f.hazards = []; f.scheduleHell(); assert.ok(f.hazards.length <= 2); if (f.hazards.length === 2) { pairs++; assert.ok(f.hazards[1].x > f.hazards[0].x); if (['pride', 'gluttony'].includes(f.hazards[0].sin)) assert.equal(f.hazards[1].sin, 'greed'); } }
  assert.ok(pairs >= 20);
});
test('Pride moves its aperture; the opening remains wider than the bird', () => {
  const f = start(); const e = f.spawnSin('pride', f.birdX + 800), y = e.y;
  f.advanceHell(.15); assert.notEqual(e.y, y); assert.ok(e.opening > R * 2);
});
test('Greed: optional coin scores once; rotating blades remain lethal', () => {
  const f = start(); f.y = 320; f.previousY = 320; const e = f.spawnSin('greed', f.birdX); e.y = 320; f.updateBlades(e); f.advanceHell(0); assert.equal(f.coins, 1); assert.equal(f.score, 2); f.advanceHell(0); assert.equal(f.score, 2);
  const hit = start(); const trap = hit.spawnSin('greed', hit.birdX - 59); trap.y = hit.y; trap.age = 0; hit.updateBlades(trap); hit.advanceHell(0); assert.equal(hit.reason, 'greed');
});
test('Envy follows history, then locks before entering the bird’s space', () => {
  const f = start(); const e = f.spawnSin('envy', f.birdX + 300); e.y = 100; f.history = [{ t: -.9, y: 410 }, { t: -.8, y: 410 }]; f.advanceHell(.1); assert.ok(e.y > 100);
  e.x = f.birdX + 140; f.advanceHell(0); assert.equal(e.locked, true); const locked = e.y; f.y = 150; f.history = [{ t: 0, y: 150 }]; f.advanceHell(.1); assert.equal(e.y, locked);
});
test('Wrath cannot hurt during a warning, locks its target, then strikes', () => {
  const f = start(); const e = f.spawnSin('wrath', f.birdX + 250); f.advanceHell(.01); assert.ok(e.triggered); const lock = e.y;
  f.y = lock + 100; f.previousY = f.y; f.advanceHell(.01); assert.equal(e.y, lock); assert.equal(f.state, 'playing');
  f.y = lock; f.previousY = lock; e.timer = e.warning - .05; f.advanceHell(.01); assert.equal(f.state, 'playing'); e.timer = e.warning - .001; f.advanceHell(.005); assert.equal(f.reason, 'wrath');
});
test('Lust changes acceleration toward the rose without disabling flap input', () => {
  const plain = start(), pulled = start(); plain.y = pulled.y = 300; plain.vy = pulled.vy = 0;
  const e = pulled.spawnSin('lust', pulled.birdX + 70); e.y = e.base = 500;
  plain.step(.01); pulled.step(.01); assert.ok(pulled.vy > plain.vy); assert.ok(pulled.attraction > 0); assert.ok(pulled.flap()); assert.equal(pulled.vy, MODES.hell.flap);
});
test('Gluttony breathes instead of changing the opening instantaneously', () => {
  const f = start(); const e = f.spawnSin('gluttony', f.birdX + 800); const openings = [];
  for (let i = 0; i < 50; i++) { f.advanceHell(.02); openings.push(e.opening); }
  assert.ok(Math.max(...openings) - Math.min(...openings) > 50); assert.ok(Math.min(...openings) > 100);
});
test('Sloth weakens flaps and increases gravity only while inside fog', () => {
  const f = start(); const e = f.spawnSin('sloth', f.birdX - 40); f.step(.01); assert.equal(f.heavy, true); f.flap(); assert.equal(f.vy, MODES.hell.flap * .86);
  e.x = f.birdX - e.w - 100; f.step(.01); assert.equal(f.heavy, false); f.flap(); assert.equal(f.vy, MODES.hell.flap);
});
test('retry clears every encounter, projectile, modifier, score, and old warning', () => {
  const f = start(); for (const sin of Object.keys(SINS)) f.spawnSin(sin, 900); f.heavy = true; f.coins = 9; f.score = 99; f.bolts.push({ x: 600 }); f.reset('moon');
  assert.equal(f.state, 'ready'); for (const key of ['gates', 'hazards', 'bolts', 'history', 'events']) assert.equal(f[key].length, 0); assert.equal(f.heavy, false); assert.equal(f.score, 0); assert.equal(f.coins, 0);
});
test('save input is validated without importing or mutating old Flappy storage', () => {
  for (const raw of [null, 'bad-json', [], 'null', '5']) assert.equal(validateSave(raw).mode, 'moon');
  const s = validateSave({ mode: 'hard', records: { moon: { best: -7, time: Infinity, runs: 1.7 }, hell: { best: 12.5 } }, settings: { volume: 99, sound: 'false', quality: 'extreme' } });
  assert.equal(s.mode, 'moon'); assert.equal(s.records.moon.best, 0); assert.equal(s.records.moon.time, 0); assert.equal(s.records.moon.runs, 1); assert.equal(s.records.hell.best, 12); assert.equal(s.settings.volume, 1); assert.equal(s.settings.sound, true); assert.equal(s.settings.quality, 'auto');
});
test('Moon openings remain playable across phone, tablet, and wide desktop at 30/60/120 FPS', () => {
  for (const width of [333, 540, 1280]) for (const fps of [30, 60, 120]) {
    let clears = 0;
    for (let seed = 1; seed <= 8; seed++) { const f = pilot(new Flight('moon', width, seeded(seed * 7919)), fps, 35); if (f.score >= 8) clears++; }
    assert.ok(clears >= 6, `Moon ${width} wide, ${fps}fps: ${clears}/8`);
  }
});
test('Nightmare’s opening round is survivable with sampled input on phone, tablet, and desktop', () => {
  for (const width of [333, 540, 1280]) for (const fps of [30, 60, 120]) {
    let clears = 0;
    for (let seed = 1; seed <= 8; seed++) { const f = pilot(new Flight('nightmare', width, seeded(seed * 7919)), fps); if (f.round >= 2) clears++; }
    assert.ok(clears >= 5, `Nightmare ${width} wide, ${fps}fps: ${clears}/8`);
  }
});

test('death-count migration keeps existing scores and never guesses deaths from attempts', () => {
  const legacy = validateSave({ mode: 'nightmare', records: { moon: { best: 11, time: 25.5, runs: 22 }, nightmare: { best: 7, runs: 9 } } });
  assert.equal(legacy.records.moon.deaths, 0); assert.equal(legacy.records.moon.runs, 22); assert.equal(legacy.records.moon.best, 11); assert.equal(legacy.records.nightmare.deaths, 0);
  const current = validateSave({ records: { moon: { deaths: 3 }, nightmare: { deaths: 7.9 }, hell: { deaths: -2 } } });
  assert.equal(current.records.moon.deaths, 3); assert.equal(current.records.nightmare.deaths, 7); assert.equal(current.records.hell.deaths, 0);
  for (const value of [NaN, Infinity, '4', null]) assert.equal(validateSave({records:{moon:{deaths:value}}}).records.moon.deaths, 0);
});
test('multiple collisions in a physics slice emit exactly one death signal', () => {
  const f = start(); f.drainEvents(); f.crash('ground'); f.crash('wrath'); f.crash('envy');
  assert.equal(f.drainEvents().filter(e => e.type === 'crash').length, 1); assert.equal(f.reason, 'ground');
});
