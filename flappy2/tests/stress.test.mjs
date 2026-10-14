import test from 'node:test';
import assert from 'node:assert/strict';
import { Flight, FLOOR, SINS, seeded } from '../engine.mjs';
test('long randomized Hell runs keep finite geometry, bounded actors, all seven sins, and real overlap', () => {
  const seen = new Set(); let pairs = 0, warnings = 0;
  for (const width of [280, 333, 540, 1280, 2160]) for (let seed = 1; seed <= 5; seed++) {
    const f = new Flight('hell', width, seeded(seed * 9991)); f.flap();
    // Diagnostic invulnerability exercises the director well beyond human survival.
    // Gameplay collision behavior is tested separately in engine.test.mjs.
    f.crash = () => {};
    for (let i = 0; i < 120 * 180; i++) {
      if (f.y > 335 && f.vy > -220) f.flap(); f.step(1 / 120);
      for (const event of f.drainEvents()) if (event.type === 'sin') warnings++;
      for (const e of f.hazards) { seen.add(e.sin); for (const n of [e.x, e.y, e.gap, e.age]) assert.ok(Number.isFinite(n)); }
      assert.ok(f.hazards.length <= 10, `actors bounded at ${width} wide`); assert.ok(f.history.length <= 184);
      if (i % 120 === 0) { const active = f.hazards.filter(e => (e.x - f.birdX) / f.speed < .5 && e.x + Math.max(e.w, 80) > f.birdX - 80); assert.ok(active.length <= 2, 'no more than two immediate threats'); }
    }
    pairs += f.overlaps; assert.ok(f.score > 20); assert.ok(f.elapsed > 179);
  }
  assert.equal(seen.size, Object.keys(SINS).length); assert.ok(pairs > 100 && warnings > 500);
});
test('high-speed Nightmare volley uses swept collisions and bounded projectile count', () => {
  const f = new Flight('nightmare', 400, seeded(10)); f.flap(); f.phase = 'swarm'; f.round = 2; f.score = 200;
  f.step(1 / 120); f.gates = []; f.attack = null; f.beginBatAttack(); const a = f.attack; f.y = a.safeY; f.previousY = f.y;
  f.advanceNightmare(1 / 120); assert.ok(f.bolts.length <= 8 * Math.ceil(FLOOR / 53));
  f.bolts = [{ x: f.birdX + 80, y: f.y, r: 8, speed: 50000 }]; f.advanceNightmare(1 / 120); assert.equal(f.reason, 'bolt');
});
