'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Flight, DIFFICULTIES, NIGHTMARE, WIDTH, FLOOR, BIRD_X, PIPE_WIDTH, RADIUS, safeSave } = require('../core.js');
const seeded = seed => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

// Uses only currently visible pipes and the same cues shown to the player.
// Decisions are sampled at 100 ms, with at least 160 ms between flaps.
function pilot(f, fps, rounds = 5) {
  f.flap(); let target = 305, lastDecision = -1, lastFlap = -1, lastAttack = null, laserTarget = 305;
  const metrics = { scores: 0, warnings: 0, fires: 0, gates: new Set(), spacings: new Set(), sources: new Set(), maxBolts: 0, maxPipes: 0 };
  for (let i = 0; i < fps * rounds * 30 && f.state === 'playing' && f.round <= rounds; i++) {
    if (f.elapsed - lastDecision >= .1) {
      lastDecision = f.elapsed;
      if (f.phase === 'gates') {
        const p = f.pipes.find(p => p.x < WIDTH && p.x + PIPE_WIDTH + 5 >= BIRD_X - RADIUS);
        target = p ? p.center : 305;
      } else if (f.attack) {
        if (f.attack.kind === 'volley') target = f.attack.safeY;
        else { if (f.attack !== lastAttack) laserTarget = f.attack.aimY + (f.attack.aimY > FLOOR / 2 ? -88 : 88); target = laserTarget; }
        lastAttack = f.attack;
      } else target = 305;
    }
    if (f.y > target + 13 && f.vy > -250 && f.elapsed - lastFlap >= .16) { f.flap(); lastFlap = f.elapsed; }
    f.step(1 / fps);
    for (const event of f.drainEvents()) {
      if (event.type === 'score') { metrics.scores++; metrics.sources.add(event.source); }
      if (event.type === 'warning') metrics.warnings++;
      if (event.type === 'fire') metrics.fires++;
    }
    if (f.attack || f.projectiles.length) assert.equal(f.pipes.length, 0, 'never combine pipes with a bat attack');
    metrics.maxBolts = Math.max(metrics.maxBolts, f.projectiles.length); metrics.maxPipes = Math.max(metrics.maxPipes, f.pipes.length);
    for (const p of f.pipes) {
      assert.ok(p.gap >= NIGHTMARE.gapMin && p.gap <= NIGHTMARE.gapMax);
      assert.ok(p.spacing >= NIGHTMARE.spacingMin && p.spacing <= NIGHTMARE.spacingMax);
      assert.ok(p.center - p.gap / 2 >= 66 - 1e-7 && p.center + p.gap / 2 <= FLOOR - 64 + 1e-7);
      metrics.gates.add(p.gap); metrics.spacings.add(p.spacing);
    }
  }
  return metrics;
}

test('Nightmare has survivable five-round runs across 32 seeds and 30/60/120 FPS', () => {
  for (const fps of [30, 60, 120]) for (let seed = 1; seed <= 32; seed++) {
    const f = new Flight('nightmare', seeded(seed * 7919)), metrics = pilot(f, fps);
    assert.equal(f.state, 'playing', `seed ${seed} at ${fps} FPS: ${f.reason}, round ${f.round}, ${f.score} points`);
    assert.equal(f.round, 6); assert.equal(f.score, 45); assert.equal(metrics.scores, 45);
    assert.equal(metrics.warnings, 15); assert.equal(metrics.fires, 15);
    assert.deepEqual([...metrics.sources].sort(), ['laser', 'pipe', 'volley']);
    assert.ok(metrics.gates.size > 8 && metrics.spacings.size > 8, 'difficulty varies materially within the safe bounds');
    assert.ok(metrics.maxPipes <= 4 && metrics.maxBolts <= 8, 'endless play has bounded entity counts');
  }
});

test('laser sightline is fixed, harmless during warning, lethal only when firing', () => {
  const f = new Flight('nightmare', seeded(12)); f.flap(); f.phase = 'hunt'; f.beginAttack();
  assert.equal(f.attack.kind, 'laser'); const aim = f.attack.aimY;
  f.y = aim + 150; f.vy = 0; f.step(.05); assert.equal(f.attack.aimY, aim, 'no homing after the visible lock');
  f.y = aim; f.vy = 0; f.attack.age = f.attack.warning - .04; f.step(.01);
  assert.equal(f.state, 'playing', 'the dashed warning itself cannot kill');
  f.y = aim; f.vy = 0; f.attack.age = f.attack.warning - .003; f.step(1 / 120);
  assert.equal(f.reason, 'laser'); assert.equal(f.score, 0);
});

test('a locked beam leaves an escape route for low and high starting heights', () => {
  for (const y of [28, 80, 310, FLOOR - 80, FLOOR - 28]) {
    const f = new Flight('nightmare', seeded(2)); f.flap(); f.phase = 'hunt'; f.y = y; f.beginAttack();
    const a = f.attack;
    assert.ok(a.warning >= 1.1); assert.ok(a.aimY >= 82 && a.aimY <= FLOOR - 82);
    const upperRoom = a.aimY - NIGHTMARE.laserHalfWidth - RADIUS * 2;
    const lowerRoom = FLOOR - a.aimY - NIGHTMARE.laserHalfWidth - RADIUS * 2;
    assert.ok(Math.max(upperRoom, lowerRoom) > 200);
  }
});

test('volley reserves its marked corridor and fired bolts can hit outside it', () => {
  const f = new Flight('nightmare', () => .5); f.flap(); f.phase = 'hunt'; f.round = 2; f.beginAttack();
  assert.equal(f.attack.kind, 'volley'); f.attack.age = f.attack.warning - .003; f.y = f.attack.safeY; f.vy = 0; f.step(1 / 120);
  assert.ok(f.projectiles.length >= 3);
  for (const bolt of f.projectiles) assert.ok(Math.abs(bolt.y - f.attack.safeY) >= NIGHTMARE.corridorHalfWidth + NIGHTMARE.boltRadius);
  const bolt = f.projectiles[0]; bolt.x = BIRD_X + 1; f.y = bolt.y; f.vy = 0; f.step(1 / 120);
  assert.equal(f.reason, 'bolt'); assert.equal(f.score, 0);
});

test('pausing freezes warning, projectile positions, and recovery timer; retry clears all threats', () => {
  for (const kind of ['laser', 'volley']) {
    const f = new Flight('nightmare', seeded(2)); f.flap(); f.phase = 'hunt'; f.round = kind === 'laser' ? 1 : 2; f.beginAttack();
    if (kind === 'volley') { f.attack.age = f.attack.warning - .003; f.y = f.attack.safeY; f.vy = 0; f.step(1 / 120); }
    f.pause(); const before = JSON.stringify({ attack: f.attack, bolts: f.projectiles, time: f.phaseTime, y: f.y });
    for (let i = 0; i < 60; i++) f.step(.1);
    assert.equal(JSON.stringify({ attack: f.attack, bolts: f.projectiles, time: f.phaseTime, y: f.y }), before);
    f.resume(); f.step(1 / 120); assert.notEqual(f.attack.age, JSON.parse(before).attack.age);
    f.reset('easy'); assert.equal(f.attack, null); assert.equal(f.projectiles.length, 0); assert.equal(f.nightmare, false); assert.equal(f.round, 1);
  }
});

test('returning to the gates provides recovery and a full approach before the first pipe', () => {
  const f = new Flight('nightmare'); f.flap(); f.phase = 'recovery'; f.phaseTime = NIGHTMARE.recoveryTime - .002; f.y = 300; f.vy = 0;
  f.step(1 / 120); assert.equal(f.phase, 'gates'); assert.equal(f.pipes.length, 0);
  f.step(1 / 120); assert.equal(f.pipes.length, 1); assert.ok(f.pipes[0].x > WIDTH);
  assert.ok((f.pipes[0].x - BIRD_X - RADIUS) / f.config.speed > 1.4);
});

test('old saves keep all classic records and add an independent Nightmare record', () => {
  const old = { version: 1, best: { easy: 18, normal: 12, hard: 7 }, runs: { normal: 20 }, difficulty: 'hard', muted: true, volume: .4 };
  const migrated = safeSave(JSON.stringify(old));
  assert.deepEqual(migrated.best, { easy: 18, normal: 12, hard: 7, nightmare: 0 }); assert.equal(migrated.runs.normal, 20);
  assert.equal(migrated.difficulty, 'hard'); assert.equal(migrated.muted, true); assert.equal(migrated.volume, .4);
  migrated.best.nightmare = 45; migrated.difficulty = 'nightmare';
  assert.deepEqual(safeSave(JSON.stringify(migrated)), migrated); assert.equal(migrated.best.hard, 7);
});

test('HTML and offline worker use the same complete versioned code set', () => {
  const root = path.resolve(__dirname, '..'), html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'), sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  for (const file of ['core.js', 'audio.js', 'game.js', 'styles.css']) {
    assert.ok(html.includes(`${file}?v=nightmare-1`)); assert.ok(sw.includes(`./${file}?v=nightmare-1`));
  }
  for (const file of ['assets/blood-moon.webp', 'assets/bat.png']) assert.ok(sw.includes(file));
  assert.ok(sw.includes("const CACHE = 'flappy-sky-club-nightmare-1'"));
  assert.ok(!sw.includes("const CACHE = 'flappy-sky-club-v1'"));
});
