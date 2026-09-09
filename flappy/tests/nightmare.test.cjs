'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Flight, DIFFICULTIES, NIGHTMARE, nightmareThreat, WIDTH, FLOOR, BIRD_X, PIPE_WIDTH, RADIUS, sweptCircleRect, safeSave } = require('../core.js');
const seeded = seed => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

// Uses only currently visible pipes and the same cues shown to the player.
// Decisions are sampled at 50 ms, with at least 140 ms between flaps.
// This establishes that the harder opening is playable, not endless solvability.
function pilot(f, fps) {
  f.flap(); let target = 305, lastDecision = -1, lastFlap = -1, lastAttack = null, laserTarget = 305;
  const metrics = { scores: 0, warnings: 0, fires: 0, gates: new Set(), spacings: new Set(), sources: new Set(), maxBolts: 0, maxPipes: 0 };
  for (let i = 0; i < fps * 100 && f.state === 'playing' && f.round < 3; i++) {
    if (f.elapsed - lastDecision >= .05) {
      lastDecision = f.elapsed;
      if (f.phase === 'gates') {
        const p = f.pipes.find(p => p.x < WIDTH && p.x + PIPE_WIDTH + 5 >= BIRD_X - RADIUS);
        target = p ? p.center : 305;
      } else if (f.attack) {
        if (f.attack.kind === 'volley') target = f.attack.safeY;
        else {
          if (f.attack !== lastAttack) {
            const candidates = [];
            for (let y = 70; y < FLOOR - 70; y += 4) {
              if (f.attack.shooters.every(bat => Math.abs(bat.aimY - y) > f.attack.tuning.laserHalfWidth + RADIUS + 44)) candidates.push(y);
            }
            candidates.sort((a, b) => Math.abs(a - f.y) - Math.abs(b - f.y)); laserTarget = candidates[0] ?? 305;
          }
          target = laserTarget;
        }
        lastAttack = f.attack;
      } else target = 305;
    }
    if (f.y > target + 16 && f.vy > -250 && f.elapsed - lastFlap >= .14) { f.flap(); lastFlap = f.elapsed; }
    f.step(1 / fps);
    for (const event of f.drainEvents()) {
      if (event.type === 'score') { metrics.scores++; metrics.sources.add(event.source); }
      if (event.type === 'warning') metrics.warnings++;
      if (event.type === 'fire') metrics.fires++;
    }
    if (f.attack || f.projectiles.length) assert.equal(f.pipes.length, 0, 'never combine pipes with a bat attack');
    metrics.maxBolts = Math.max(metrics.maxBolts, f.projectiles.length); metrics.maxPipes = Math.max(metrics.maxPipes, f.pipes.length);
    for (const p of f.pipes) {
      const pressure = nightmareThreat(p.pressure);
      assert.ok(p.gap >= pressure.gapMin && p.gap <= pressure.gapMax);
      assert.ok(p.spacing >= pressure.spacingMin && p.spacing <= pressure.spacingMax);
      assert.ok(p.center - p.gap / 2 >= 66 - 1e-7 && p.center + p.gap / 2 <= FLOOR - 64 + 1e-7);
      metrics.gates.add(p.gap); metrics.spacings.add(p.spacing);
    }
  }
  return metrics;
}

test('harder opening can be cleared with bounded input at 30/60/120 FPS', () => {
  for (const fps of [30, 60, 120]) {
    let openingsCleared = 0;
    for (let seed = 1; seed <= 16; seed++) {
      const f = new Flight('nightmare', seeded(seed * 7919)), metrics = pilot(f, fps);
      assert.equal(metrics.scores, f.score);
      assert.ok(metrics.maxPipes <= 4 && metrics.maxBolts <= 8 * Math.ceil(FLOOR / 34), 'bounded entity counts');
      if (f.round >= 2) {
        openingsCleared++;
        assert.deepEqual([...metrics.sources].sort(), ['laser', 'pipe', 'volley']);
        assert.ok(metrics.fires > metrics.warnings, 'multiple bats actually fire');
        assert.ok(metrics.gates.size > 6 && metrics.spacings.size > 6);
      }
    }
    assert.ok(openingsCleared >= 12, `${openingsCleared}/16 opening rounds cleared at ${fps} FPS`);
  }
});

test('every point increases speed; later threats keep accelerating after geometry and bat limits', () => {
  const start = nightmareThreat(0);
  assert.ok(start.speed > 245 && start.gapMax < 158 && start.spacingMax < 332);
  const f = new Flight('nightmare');
  for (let p = 1; p <= 200; p++) {
    const before = f.threat; f.point(p % 2 ? 'pipe' : 'laser'); const after = f.threat;
    assert.ok(after.speed > before.speed && after.boltSpeed > before.boltSpeed);
    assert.ok(after.gapMax <= before.gapMax && after.spacingMax <= before.spacingMax);
    assert.ok(after.warningTime <= before.warningTime && after.cooldown <= before.cooldown);
    assert.ok(after.gapMin > RADIUS * 2 && after.spacingMin > PIPE_WIDTH + RADIUS * 2);
    assert.ok(after.bats >= before.bats && after.bats <= 8);
    assert.equal(after.level, p + 1);
  }
  assert.ok(nightmareThreat(1000).speed > nightmareThreat(200).speed * 10, 'no late speed plateau');
  for (const mode of ['easy', 'normal', 'hard']) {
    const classic = new Flight(mode); classic.flap();
    for (let i = 0; i < 100; i++) classic.point();
    classic.step(.05); assert.equal(classic.speed, DIFFICULTIES[mode].speed);
  }
});

test('a scored gate raises pressure smoothly and the next gate uses the tighter bounds', () => {
  const f = new Flight('nightmare', () => .5); f.flap(); f.y = 300; f.vy = 0;
  f.pipes = [{ x: 39, center: 300, gap: 124, scored: false }]; f.nextPipe = 900;
  f.step(1 / 120); assert.equal(f.score, 1); assert.ok(f.threat.speed > f.speed);
  const previousSpeed = f.speed; f.nextPipe = WIDTH + 40;
  f.step(1 / 120); assert.ok(f.speed > previousSpeed && f.speed < f.threat.speed);
  const gate = f.pipes.at(-1); assert.equal(gate.pressure, 1);
  assert.ok(gate.gap >= f.threat.gapMin && gate.gap <= f.threat.gapMax);
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

test('opening beams retain warning time and a route away from extreme starting heights', () => {
  for (const y of [28, 80, 310, FLOOR - 80, FLOOR - 28]) {
    const f = new Flight('nightmare', seeded(2)); f.flap(); f.phase = 'hunt'; f.y = y; f.beginAttack();
    const a = f.attack;
    assert.ok(a.warning >= .8); assert.ok(a.aimY >= 82 && a.aimY <= FLOOR - 82);
    const upperRoom = a.aimY - NIGHTMARE.laserHalfWidth - RADIUS * 2;
    const lowerRoom = FLOOR - a.aimY - NIGHTMARE.laserHalfWidth - RADIUS * 2;
    assert.ok(Math.max(upperRoom, lowerRoom) > 200);
  }
});

test('all bats have independent locked beams and a wave scores only after the last beam clears', () => {
  const f = new Flight('nightmare'); f.flap(); f.phase = 'hunt';
  for (let i = 0; i < 10; i++) f.point();
  f.y = 250; f.beginAttack(); const a = f.attack;
  assert.equal(a.shooters.length, 3); assert.equal(new Set(a.shooters.map(b => b.aimY)).size, 3);
  const locks = a.shooters.map(b => b.aimY); f.y = 480; f.previousY = 480;
  f.advanceNightmare(a.shooters[0].fireAt);
  assert.equal(a.shooters.filter(b => b.fired).length, 1);
  assert.deepEqual(a.shooters.map(b => b.aimY), locks, 'targets do not follow the bird');
  f.advanceNightmare(a.tuning.stagger + .001);
  assert.equal(a.shooters.filter(b => b.fired).length, 2); assert.equal(f.score, 10);
  const finalClear = a.shooters.at(-1).fireAt + a.tuning.laserTime;
  f.advanceNightmare(finalClear - a.age - .001); assert.equal(f.score, 10);
  f.advanceNightmare(.002); assert.equal(f.score, 11); assert.equal(f.attack, null);
  assert.equal(f.drainEvents().filter(e => e.type === 'fire').length, 3);
});

test('a secondary bat beam is lethal independently of the first bat', () => {
  const f = new Flight('nightmare'); f.flap(); f.phase = 'hunt';
  for (let i = 0; i < 5; i++) f.point();
  f.y = 250; f.beginAttack(); const a = f.attack, second = a.shooters[1];
  f.y = second.aimY; f.previousY = f.y;
  f.advanceNightmare(second.fireAt - .001); assert.equal(f.state, 'playing');
  f.advanceNightmare(.002); assert.equal(f.reason, 'laser'); assert.equal(f.score, 5);
});

test('volley reserves its marked corridor and fired bolts can hit outside it', () => {
  const f = new Flight('nightmare', () => .5); f.flap(); f.phase = 'hunt'; f.round = 2; f.beginAttack();
  assert.equal(f.attack.kind, 'volley'); f.attack.age = f.attack.warning - .003; f.y = f.attack.safeY; f.vy = 0; f.step(1 / 120);
  assert.ok(f.projectiles.length >= 3);
  for (const bolt of f.projectiles) assert.ok(Math.abs(bolt.y - f.attack.safeY) >= NIGHTMARE.corridorHalfWidth + NIGHTMARE.boltRadius);
  const bolt = f.projectiles[0]; bolt.x = BIRD_X + 1; f.y = bolt.y; f.vy = 0; f.step(1 / 120);
  assert.equal(f.reason, 'bolt'); assert.equal(f.score, 0);
});

test('a swarm fires staggered projectile columns with a narrower shared corridor', () => {
  const f = new Flight('nightmare', () => .5); f.flap(); f.phase = 'hunt'; f.round = 2;
  for (let i = 0; i < 20; i++) f.point();
  f.y = 300; f.previousY = 300; f.beginAttack(); const a = f.attack;
  assert.equal(a.shooters.length, 5); assert.ok(a.tuning.corridorHalfWidth < NIGHTMARE.corridorHalfWidth);
  f.advanceNightmare(a.shooters[0].fireAt - .001);
  for (const bat of a.shooters) {
    f.advanceNightmare(bat.fireAt - a.age + .001);
    assert.equal(bat.fired, true);
    for (const bolt of f.projectiles) assert.ok(Math.abs(bolt.y - a.safeY) >= a.tuning.corridorHalfWidth + bolt.radius);
  }
  assert.equal(f.state, 'playing'); assert.ok(f.projectiles.length > 15);
  assert.equal(new Set(f.projectiles.map(b => b.speed)).size, 5, 'five real moving columns');
  assert.equal(f.drainEvents().filter(e => e.type === 'fire').length, 5);
});

test('hunt length is fixed on entry while later hunts gain more attack waves', () => {
  const f = new Flight('nightmare'); f.flap();
  for (let i = 0; i < 6; i++) f.point();
  f.changePhase('arrival'); const target = f.huntTarget; assert.equal(target, 5);
  for (let i = 0; i < 18; i++) f.point();
  assert.equal(f.huntTarget, target, 'the current room has a reachable finish');
  f.phase = 'hunt'; f.attacksCleared = target; f.advanceNightmare(.01);
  assert.equal(f.phase, 'recovery');
  f.changePhase('arrival'); assert.ok(f.huntTarget > target);
});

test('fast pipes and projectiles cannot tunnel through the bird between physics steps', () => {
  for (const inGap of [true, false]) {
    const f = new Flight('nightmare'); f.flap(); f.y = inGap ? 300 : 200; f.vy = 0;
    f.speed = 120000; f.threat.speed = 120000; f.spawned = 6;
    f.pipes = [{ x: 500, center: 300, gap: 124, scored: false }];
    f.step(1 / 120);
    assert.equal(f.state, inGap ? 'playing' : 'dead'); assert.equal(f.score, inGap ? 1 : 0);
    if (!inGap) assert.equal(f.reason, 'pipe');
  }
  const f = new Flight('nightmare'); f.flap(); f.phase = 'hunt'; f.round = 2; f.beginAttack(); f.vy = 0;
  f.projectiles = [{ x: 430, y: f.y, radius: 9, speed: 120000 }]; f.step(1 / 120);
  assert.equal(f.reason, 'bolt'); assert.equal(f.score, 0);
  assert.equal(sweptCircleRect(-30, -13, -13, -13, 14, 0, 0, 72, 100), false, 'rounded corner near miss');
  assert.equal(sweptCircleRect(-30, 10, 100, 10, 14, 0, 0, 72, 100), true);
});

test('pausing freezes warning, projectile positions, and recovery timer; retry clears all threats', () => {
  for (const kind of ['laser', 'volley']) {
    const f = new Flight('nightmare', seeded(2)); f.flap(); f.phase = 'hunt'; f.round = kind === 'laser' ? 1 : 2;
    for (let i = 0; i < 15; i++) f.point();
    f.beginAttack();
    if (kind === 'volley') { f.attack.age = f.attack.warning - .003; f.y = f.attack.safeY; f.vy = 0; f.step(1 / 120); }
    f.pause(); const snapshot = () => JSON.stringify({ attack: f.attack, bolts: f.projectiles, time: f.phaseTime, y: f.y, threat: f.threat, speed: f.speed });
    const before = snapshot();
    for (let i = 0; i < 60; i++) f.step(.1);
    assert.equal(snapshot(), before);
    f.resume(); f.step(1 / 120); assert.notEqual(f.attack.age, JSON.parse(before).attack.age);
    f.reset('nightmare'); assert.equal(f.attack, null); assert.equal(f.enemies.length, 0); assert.equal(f.projectiles.length, 0); assert.equal(f.round, 1);
    assert.equal(f.threat.level, 1); assert.equal(f.speed, 300);
  }
});

test('returning to the gates provides recovery and a full approach before the first pipe', () => {
  const f = new Flight('nightmare'); f.flap(); f.changePhase('recovery'); f.phaseTime = f.recoveryDuration - .002; f.y = 300; f.vy = 0;
  f.pause(); f.step(.1); assert.equal(f.phaseTime, f.recoveryDuration - .002); f.resume();
  f.step(1 / 120); assert.equal(f.phase, 'gates'); assert.equal(f.pipes.length, 0);
  f.step(1 / 120); assert.equal(f.pipes.length, 1); assert.ok(f.pipes[0].x > WIDTH);
  assert.ok((f.pipes[0].x - BIRD_X - RADIUS) / f.speed > 1.2);
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
    assert.ok(html.includes(`${file}?v=nightmare-2`)); assert.ok(sw.includes(`./${file}?v=nightmare-2`));
  }
  for (const file of ['assets/blood-moon.webp', 'assets/bat.png']) assert.ok(sw.includes(file));
  assert.ok(sw.includes("const CACHE = 'flappy-sky-club-nightmare-2'"));
  assert.ok(!sw.includes("const CACHE = 'flappy-sky-club-v1'"));
});
