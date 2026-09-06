const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame } = require('./harness.cjs');
const solutions = require('./winning-shots.json');
const saveKey = 'mini-angry-birds-reforged-save-v1';

function finite(game) {
  for (const b of game.sandbox.Matter.Composite.allBodies(game.game.engine.world)) {
    assert.ok([b.position.x, b.position.y, b.velocity.x, b.velocity.y, b.angle].every(Number.isFinite));
  }
}

for (let level = 0; level < 10; level++) {
  test(`level ${level + 1}: layout remains supported under ten seconds of gravity`, () => {
    const h = createGame(); h.start(level);
    const bodies = [...h.game.blocks, ...h.game.pigs];
    const initial = bodies.map(b => ({ ...b.position }));
    // Advance Matter directly: this checks structural stability independently of
    // the game's pre-launch freeze and its damage immunity.
    for (let i = 0; i < 1200; i++) h.sandbox.Matter.Engine.update(h.game.engine, 1000 / 120);
    bodies.forEach((b, i) => assert.ok(Math.hypot(b.position.x - initial[i].x, b.position.y - initial[i].y) < 2, `body ${i} drifted`));
    assert.equal(h.game.pigs.length, h.game.levels[level].pigs.length);
    assert.equal(h.game.state.score, 0);
    finite(h);
  });
  test(`level ${level + 1}: winning sequence is repeatable with three visual random seeds`, () => {
    for (const seed of [1, 42, 918]) {
      const h = createGame({ seed }); h.start(level);
      for (const shot of solutions[level].sequence) {
        const result = h.playShot(...shot);
        assert.ok(result.frames < 930, 'turn must resolve');
        finite(h);
      }
      assert.equal(h.game.state.mode, 'won');
      assert.equal(h.game.pigs.length, 0);
      const { pigs, blocks, bonus } = h.game.state.scoreParts;
      assert.equal(h.game.state.score, pigs + blocks + bonus);
      assert.equal(h.game.state.save.bestStars[level + 1], 3);
      h.wallTime(700);
      assert.equal(h.elements.get('resultOverlay').classList.contains('hidden'), false);
    }
  });
  test(`level ${level + 1}: missing all shots reaches a retry screen`, () => {
    const h = createGame(); h.start(level);
    for (let i = 0; i < h.game.levels[level].birds.length; i++) {
      const result = h.playShot(65, .2, null, 930);
      assert.ok(result.frames < 930, 'debris cannot strand the turn');
      finite(h);
    }
    assert.equal(h.game.state.mode, 'lost');
    h.wallTime(600);
    assert.equal(h.elements.get('resultOverlay').classList.contains('hidden'), false);
    h.elements.get('retryBtn').dispatch('click');
    assert.equal(h.game.state.mode, 'ready');
    assert.equal(h.game.state.shotsUsed, 0);
  });
}

test('trajectory uses the same start point, drag and substeps as every bird', () => {
  const h = createGame();
  for (const level of [0, 1, 3, 6]) {
    h.start(level);
    h.elements.get('aimAngle').value = 45;
    h.elements.get('aimPower').value = 75;
    h.elements.get('aimAngle').dispatch('input');
    const trajectory = h.game.predictTrajectory(80);
    h.elements.get('launchBtn').dispatch('click');
    for (let i = 0; i < 40; i++) {
      h.step();
      const p = trajectory[i * 2 + 1], actual = h.game.currentBird.position;
      assert.ok(Math.hypot(p.x - actual.x, p.y - actual.y) < .01);
    }
  }
});

test('pointer cancellation, another finger and duplicate release do not spend birds', () => {
  const h = createGame(), c = h.elements.get('game');
  const begin = () => { c.dispatch('pointerdown', { pointerId: 7, button: 0, clientX: 188, clientY: 526 }); c.dispatch('pointermove', { pointerId: 7, clientX: 80, clientY: 550 }); };
  begin(); c.dispatch('pointercancel', { pointerId: 8 });
  assert.equal(h.game.state.dragging, true);
  c.dispatch('pointercancel', { pointerId: 7 });
  assert.equal(h.game.state.shotsUsed, 0); assert.equal(h.game.state.mode, 'ready');
  begin(); h.window.dispatch('pointerup', { pointerId: 7 }); c.dispatch('pointerup', { pointerId: 7 });
  assert.equal(h.game.state.shotsUsed, 1); assert.equal(h.game.state.mode, 'flying');
});

test('a paused drag is cancelled; release cannot fire behind a menu', () => {
  const h = createGame(), c = h.elements.get('game');
  c.dispatch('pointerdown', { pointerId: 1, clientX: 188, clientY: 526 });
  c.dispatch('pointermove', { pointerId: 1, clientX: 80, clientY: 540 });
  h.elements.get('pauseBtn').dispatch('click');
  c.dispatch('pointerup', { pointerId: 1 });
  assert.equal(h.game.state.shotsUsed, 0);
  assert.equal(h.game.currentBird.position.x, 188);
  h.elements.get('resumeBtn').dispatch('click');
  assert.equal(h.game.state.mode, 'ready');
});

test('pause and help freeze time, body position and abilities', () => {
  const h = createGame(); h.start(3); h.shot(30, .9); h.step(20);
  const sim = h.game.state.simTime, position = { ...h.game.currentBird.position };
  h.elements.get('pauseBtn').dispatch('click'); h.wallTime(60000); h.step(120); h.game.useAbility();
  assert.equal(h.game.state.simTime, sim);
  assert.equal(h.game.currentBird.position.x, position.x);
  assert.equal(h.game.currentBird.game.abilityUsed, false);
  h.elements.get('resumeBtn').dispatch('click');
  h.elements.get('helpBtn').dispatch('click'); h.wallTime(60000); h.step(60); h.game.useAbility();
  assert.equal(h.game.state.simTime, sim);
  h.elements.get('closeHelpBtn').dispatch('click'); h.step(); h.game.useAbility();
  assert.equal(h.game.currentBird.game.abilityUsed, true);
  assert.ok(h.game.state.simTime - sim < 17);
});

test('explosion fuses do not expire while paused', () => {
  const h = createGame(); h.start(4); h.shot(6, .9);
  for (let i = 0; i < 200 && !h.game.pendingExplosions.length; i++) h.step();
  assert.ok(h.game.pendingExplosions.length);
  const due = h.game.pendingExplosions[0].at, sim = h.game.state.simTime;
  h.elements.get('pauseBtn').dispatch('click'); h.wallTime(90000); h.step(120);
  assert.equal(h.game.pendingExplosions[0].at, due);
  assert.equal(h.game.state.simTime, sim);
  h.elements.get('resumeBtn').dispatch('click'); h.step();
  assert.ok(h.game.state.simTime < due);
});

test('blue fragments spawn apart and abilities only activate once', () => {
  const h = createGame(); h.start(1); h.shot(30, .9); h.step(15); h.game.useAbility();
  assert.equal(h.game.fragments.length, 2);
  assert.equal(h.sandbox.Matter.Query.collides(h.game.currentBird, h.game.fragments).length, 0);
  h.game.useAbility(); assert.equal(h.game.fragments.length, 2);
  h.start(6); h.shot(6, .9);
  for (let i = 0; i < 300 && !h.game.currentBird.game.abilityUsed; i++) h.step();
  assert.equal(h.game.currentBird.game.abilityUsed, true, 'bomb auto-detonates after a collision');
});

test('continuous small debris motion cannot hold a turn forever', () => {
  const h = createGame(); h.shot(65, .2);
  for (let i = 0; i < 930 && h.game.state.mode !== 'ready'; i++) {
    h.sandbox.Matter.Body.setAngularVelocity(h.game.blocks[0], .04);
    h.step();
  }
  assert.ok(['ready', 'won'].includes(h.game.state.mode));
});

test('progress unlocks, survives reload and keeps best scores', () => {
  const h = createGame(); h.playShot(6, .9);
  assert.equal(h.game.state.save.unlocked, 2);
  const firstBest = h.game.state.save.bestScore[1];
  const saved = JSON.parse(h.storage.get(saveKey));
  const loaded = createGame({ saved });
  assert.equal(loaded.game.state.levelIndex, 1);
  loaded.game.startLevel(9); assert.equal(loaded.game.state.levelIndex, 1);
  loaded.game.startLevel(0); loaded.playShot(65, .2); loaded.playShot(6, .9);
  assert.ok(loaded.game.state.save.bestScore[1] >= firstBest);
});

test('corrupt saves cannot crash level cards or inject invalid stars', () => {
  const h = createGame({ saved: { unlocked: 4.8, bestStars: { 1: 999, 2: -7, 3: 'bad' }, bestScore: 'oops', tutorialSeen: [] } });
  assert.equal(h.game.state.save.unlocked, 4);
  assert.equal(h.game.state.save.bestStars[1], 3);
  assert.equal(h.game.state.save.bestStars[2], 0);
  assert.equal(h.game.state.save.bestStars[3], 0);
  assert.equal(h.game.state.mode, 'ready');
});

test('closing level selection after a win returns to the result', () => {
  const h = createGame(); h.playShot(6, .9); h.wallTime(700);
  h.elements.get('resultLevelsBtn').dispatch('click');
  h.elements.get('closeLevelsBtn').dispatch('click');
  assert.equal(h.elements.get('resultOverlay').classList.contains('hidden'), false);
});
