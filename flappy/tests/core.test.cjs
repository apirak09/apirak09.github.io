'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Flight, DIFFICULTIES, WIDTH, HEIGHT, FLOOR, BIRD_X, RADIUS, PIPE_WIDTH, circleRect, safeSave } = require('../core.js');

function seeded(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
function pilot(flight, seconds = 180, fps = 120, goal = 60) {
  flight.flap();
  let scores = 0, maxPipes = 0;
  for (let frame = 0; frame < seconds * fps && flight.state === 'playing' && flight.score < goal; frame++) {
    const pipe = flight.pipes.find(item => item.x + PIPE_WIDTH + 5 >= BIRD_X - RADIUS);
    const target = pipe ? pipe.center : 305;
    if (flight.y > target + 20 && flight.vy > -250) flight.flap();
    flight.step(1 / fps);
    scores += flight.drainEvents().filter(event => event.type === 'score').length;
    maxPipes = Math.max(maxPipes, flight.pipes.length);
    for (const p of flight.pipes) {
      assert.ok(p.center - flight.config.gap / 2 >= 65.99);
      assert.ok(p.center + flight.config.gap / 2 <= FLOOR - 63.99);
    }
  }
  return { scores, maxPipes };
}

test('three distinct difficulties become progressively faster and tighter', () => {
  const [easy, normal, hard] = Object.values(DIFFICULTIES);
  assert.equal(Object.keys(DIFFICULTIES).length, 3);
  assert.ok(easy.speed < normal.speed && normal.speed < hard.speed);
  assert.ok(easy.gap > normal.gap && normal.gap > hard.gap);
  assert.equal(new Flight('unrecognized').difficulty, 'normal');
});

test('all modes have playable, bounded endless obstacle sequences', () => {
  for (const mode of Object.keys(DIFFICULTIES)) for (const seed of [1, 42, 100, 98765]) {
    const flight = new Flight(mode, seeded(seed));
    const result = pilot(flight);
    assert.equal(flight.score, 60, `${mode}, seed ${seed}: ${flight.reason} at ${flight.score}`);
    assert.equal(result.scores, flight.score, 'each obstacle emits exactly one score');
    assert.ok(result.maxPipes <= 4, 'offscreen obstacles are removed');
  }
});

test('30, 60, and 120 FPS remain playable with the same obstacle generation', () => {
  for (const fps of [30, 60, 120]) for (const mode of Object.keys(DIFFICULTIES)) {
    const flight = new Flight(mode, seeded(77)); pilot(flight, 180, fps, 40);
    assert.equal(flight.score, 40, `${mode} at ${fps} FPS should remain playable`);
  }
});

test('a paused flight cannot move, score, or accept flaps; resume continues safely', () => {
  const flight = new Flight(); flight.flap(); flight.step(.1); flight.drainEvents();
  assert.equal(flight.pause(), true);
  const before = JSON.stringify({ y: flight.y, vy: flight.vy, pipes: flight.pipes, elapsed: flight.elapsed, score: flight.score });
  for (let i = 0; i < 100; i++) { flight.step(.1); assert.equal(flight.flap(), false); }
  assert.equal(JSON.stringify({ y: flight.y, vy: flight.vy, pipes: flight.pipes, elapsed: flight.elapsed, score: flight.score }), before);
  assert.equal(flight.resume(), true); flight.step(.02); assert.notEqual(flight.y, JSON.parse(before).y);
});

test('pipe lips and boundaries crash once, with no post-crash scoring', () => {
  const flight = new Flight('hard'); flight.flap(); flight.nextPipe = 9999;
  const top = 300 - flight.config.gap / 2;
  flight.y = top + 10; flight.vy = 0;
  // Center is left of the pipe body, but inside the protruding lip's hit circle.
  flight.pipes = [{ x: BIRD_X + RADIUS + 2, center: 300, scored: false }];
  flight.step(1 / 120); assert.equal(flight.state, 'dead'); assert.equal(flight.reason, 'pipe');
  assert.equal(flight.drainEvents().filter(e => e.type === 'crash').length, 1);
  flight.step(1); assert.equal(flight.score, 0); assert.equal(flight.flap(), false);
  assert.equal(flight.drainEvents().length, 0);
  for (const [y, vy, reason] of [[FLOOR - RADIUS - 1, 500, 'ground'], [RADIUS + 1, -400, 'ceiling']]) {
    flight.reset(); flight.flap(); flight.y = y; flight.vy = vy; flight.step(.02); assert.equal(flight.reason, reason);
  }
});

test('a missed-input flight reaches results and a reset fully restores the run', () => {
  const flight = new Flight('easy'); flight.flap();
  for (let i = 0; i < 500 && flight.state === 'playing'; i++) flight.step(1 / 60);
  assert.equal(flight.state, 'dead'); assert.equal(flight.reason, 'ground');
  flight.reset('hard'); assert.equal(flight.state, 'ready'); assert.equal(flight.score, 0);
  assert.equal(flight.pipes.length, 0); assert.equal(flight.elapsed, 0); assert.equal(flight.reason, '');
  assert.equal(flight.flap(), true); assert.equal(flight.vy, DIFFICULTIES.hard.flap);
});

test('invalid timing inputs cannot corrupt physics or teleport the bird', () => {
  const flight = new Flight(); flight.flap(); const before = flight.y;
  for (const dt of [NaN, Infinity, -1, 0]) flight.step(dt);
  assert.equal(flight.y, before); flight.step(500);
  assert.ok(flight.elapsed <= .100001); assert.ok(Number.isFinite(flight.y));
  assert.equal(circleRect(0, 0, 1, 2, 2, 1, 1), false);
});

test('corrupt, hostile, and old saves recover with isolated valid defaults', () => {
  for (const value of ['invalid', 'null', '42', '"text"', '[]', null]) {
    const save = safeSave(value, true); assert.deepEqual(save.best, { easy: 0, normal: 0, hard: 0 });
    assert.equal(save.difficulty, 'normal'); assert.equal(save.reducedMotion, true);
  }
  const save = safeSave({ difficulty: '__proto__', best: { easy: -3, normal: Infinity, hard: 45 }, volume: 99, effects: false, music: true, runs: { hard: 2.5 } });
  assert.equal(save.difficulty, 'normal'); assert.deepEqual(save.best, { easy: 0, normal: 0, hard: 45 });
  assert.equal(save.volume, 1); assert.equal(save.effects, false); assert.equal(save.music, true); assert.equal(save.runs.hard, 0);
  assert.deepEqual(safeSave(JSON.stringify(save)), save);
});

test('every local HTML, stylesheet, manifest, and offline-cache asset exists', () => {
  const root = path.resolve(__dirname, '..'), html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"#][^"]*)"/g)].map(m => m[1]);
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  refs.push(...[...css.matchAll(/url\("([^\"]+)"\)/g)].map(m => m[1]));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  refs.push(...manifest.icons.map(icon => icon.src));
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const cached = sw.match(/const FILES = \[([^\]]+)\]/)[1];
  refs.push(...[...cached.matchAll(/'([^']+)'/g)].map(m => m[1]));
  for (const ref of refs) if (!/^(https?:|data:)/.test(ref)) assert.ok(fs.existsSync(path.resolve(root, ref)), `Missing ${ref}`);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'element IDs must be unique');
  const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
  for (const [, id] of game.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(id), `UI references missing #${id}`);
  assert.ok(html.includes('viewport-fit=cover')); assert.ok(css.includes('max-height:600px'));
  assert.equal(manifest.scope, './'); assert.equal(manifest.start_url, './');
  assert.ok(WIDTH > 0 && HEIGHT > FLOOR);
});

test('audio gracefully tolerates missing or interrupted Web Audio support', async () => {
  const context = { window: {}, setInterval, clearInterval }; vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../audio.js'), 'utf8'), context);
  const audio = new context.window.FlightAudio(safeSave(null));
  assert.equal(await audio.unlock(), false);
  for (const name of ['flap', 'score', 'crash', 'start', 'medal', 'tick', 'select']) assert.doesNotThrow(() => audio.effect(name));
  assert.doesNotThrow(() => audio.suspend());
  context.window.AudioContext = class { constructor() { throw new Error('audio blocked'); } };
  assert.equal(await audio.unlock(), false);
});
