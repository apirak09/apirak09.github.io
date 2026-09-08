import test from 'node:test';
import assert from 'node:assert/strict';
import { PEOPLE, OUTCOMES, REFERENCE, createGame, initialTruths, emptyPositions, validatePositions, movePerson, simulate, partition, worstCase, weigh, accuse, possibilitiesFor, referencePositions, signature, decodeReference } from '../core.mjs';

test('starts with 24 distinct truths, every person on shore, and no hidden impostor', () => {
  const game = createGame();
  assert.equal(game.truths.length, 24);
  assert.equal(new Set(game.truths.map(t => t.id + t.kind)).size, 24);
  assert.ok(Object.values(game.positions).every(p => p === '-'));
  assert.deepEqual(Object.keys(game).sort(), ['history', 'phase', 'positions', 'truths']);
  for (const person of PEOPLE) assert.deepEqual(possibilitiesFor(game.truths, person.id), { heavy: true, light: true });
});

test('the supplied reference uses four versus four and has 24 unique signed columns', () => {
  assert.deepEqual(REFERENCE, ['LLLLRRRR----', 'LLRRR---LRL-', 'LRR--LR-LL-R']);
  for (let round = 0; round < 3; round++) {
    const positions = referencePositions(round);
    assert.equal(validatePositions(positions), null);
    assert.equal(Object.values(positions).filter(p => p === 'L').length, 4);
    assert.equal(Object.values(positions).filter(p => p === 'R').length, 4);
  }
  const signatures = initialTruths().map(t => signature(t.id, t.kind));
  assert.equal(new Set(signatures).size, 24);
  assert.ok(!signatures.includes('---'));
  for (const truth of initialTruths()) assert.deepEqual(decodeReference(signature(truth.id, truth.kind)), truth);
  assert.equal(decodeReference('---'), null);
});

test('every actual heavier/lighter truth is uniquely decoded by all three reference weighings', () => {
  for (const actual of initialTruths()) {
    let possible = initialTruths();
    for (let round = 0; round < 3; round++) {
      const positions = referencePositions(round);
      const result = simulate(actual, positions);
      possible = possible.filter(t => simulate(t, positions) === result);
    }
    assert.deepEqual(possible, [actual]);
  }
});

test('every largest-group tie branch of the reference guarantees a unique truth and victory', () => {
  let leaves = 0;
  function explore(game, round) {
    if (round === 3) {
      assert.equal(game.truths.length, 1); assert.equal(game.phase, 'accusing');
      const truth = game.truths[0]; assert.equal(accuse(game, truth.id, truth.kind).phase, 'won');
      leaves++; return;
    }
    game = { ...game, positions: referencePositions(round) };
    const ties = worstCase(game.truths, game.positions).ties;
    for (let choice = 0; choice < ties.length; choice++) {
      const next = weigh(game, choice);
      assert.equal(next.truths.length, [8, 3, 1][round]);
      explore(next, round + 1);
    }
  }
  explore(createGame(), 0);
  assert.equal(leaves, 18);
});

test('physical mass oracle agrees with simulation across randomized legal arrangements', () => {
  let seed = 9012;
  const rng = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let trial = 0; trial < 180; trial++) {
    const order = PEOPLE.map(p => p.id);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const count = 1 + trial % 6, positions = emptyPositions();
    order.slice(0, count).forEach(id => { positions[id] = 'L'; });
    order.slice(count, count * 2).forEach(id => { positions[id] = 'R'; });
    for (const truth of initialTruths()) {
      let left = 0, right = 0;
      for (const id of order) {
        const weight = 1000 + (id === truth.id ? (truth.kind === 'heavy' ? 1 : -1) : 0);
        if (positions[id] === 'L') left += weight;
        if (positions[id] === 'R') right += weight;
      }
      assert.equal(simulate(truth, positions), left === right ? '-' : left > right ? 'L' : 'R');
    }
  }
});

test('adversarial histories only retain the largest consistent nonempty subset', () => {
  let seed = 17;
  const rng = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed; };
  for (let trial = 0; trial < 200; trial++) {
    let game = createGame();
    for (let round = 0; round < 3; round++) {
      const order = PEOPLE.map(p => p.id);
      for (let i = 11; i > 0; i--) { const j = rng() % (i + 1); [order[i], order[j]] = [order[j], order[i]]; }
      const n = 1 + rng() % 6, positions = emptyPositions();
      order.slice(0, n).forEach(id => { positions[id] = 'L'; });
      order.slice(n, n * 2).forEach(id => { positions[id] = 'R'; });
      game = { ...game, positions };
      const groups = partition(game.truths, positions);
      const next = weigh(game, rng());
      assert.equal(next.truths.length, Math.max(...OUTCOMES.map(r => groups[r].length)));
      assert.ok(next.truths.length > 0 && next.truths.length <= game.truths.length);
      const consistent = initialTruths().filter(t => next.history.every(entry => simulate(t, entry.positions) === entry.result));
      assert.deepEqual(next.truths, consistent);
      game = next;
    }
    assert.equal(game.phase, game.truths.length === 1 ? 'accusing' : 'lost');
    assert.throws(() => weigh(game), /cannot be used/);
  }
});

test('repeated low-information weighings consume uses and fail, with no lucky-guess win', () => {
  let game = movePerson(movePerson(createGame(), 'A', 'L'), 'B', 'R');
  for (let i = 0; i < 3; i++) {
    game = weigh(game); assert.equal(game.truths.length, 20); assert.equal(game.history[i].result, '-');
  }
  assert.equal(game.phase, 'lost');
  assert.throws(() => accuse(game, 'C', 'heavy'), /single truth/);
  assert.throws(() => weigh(game), /cannot be used/);
  assert.throws(() => movePerson(game, 'C', 'L'), /locked/);
});

test('empty, unequal, duplicate-by-shape and malformed arrangements spend no uses', () => {
  const game = createGame(); const before = JSON.stringify(game);
  assert.throws(() => weigh(game), /same number/);
  assert.throws(() => weigh(movePerson(game, 'A', 'L')), /same number/);
  assert.throws(() => movePerson(game, 'Z', 'L'), /Unknown/);
  assert.throws(() => movePerson(game, 'A', 'elsewhere'), /Unknown/);
  assert.ok(validatePositions({ ...referencePositions(0), Z: 'L' }));
  assert.ok(validatePositions({ ...referencePositions(0), A: ['L', 'R'] }));
  assert.equal(JSON.stringify(game), before);
});

test('immutable snapshots preserve evidence when islanders are rearranged', () => {
  const original = { ...createGame(), positions: referencePositions(0) };
  const next = weigh(original);
  const moved = movePerson(next, 'A', '-');
  assert.equal(original.history.length, 0); assert.equal(original.truths.length, 24);
  assert.equal(next.positions.A, 'L'); assert.equal(moved.positions.A, '-');
  assert.equal(moved.history[0].positions.A, 'L');
});

test('accusation needs both the correct person and direction, and cannot be retried', () => {
  let game = createGame();
  assert.throws(() => accuse(game, 'A', 'heavy'), /single truth/);
  for (let i = 0; i < 3; i++) game = weigh({ ...game, positions: referencePositions(i) });
  const truth = game.truths[0];
  const wrongWeight = accuse(game, truth.id, truth.kind === 'heavy' ? 'light' : 'heavy');
  assert.equal(wrongWeight.phase, 'lost');
  assert.throws(() => accuse(wrongWeight, truth.id, truth.kind), /single truth/);
  assert.equal(accuse(game, PEOPLE.find(p => p.id !== truth.id).id, truth.kind).phase, 'lost');
  const won = accuse(game, truth.id, truth.kind); assert.equal(won.phase, 'won');
  assert.throws(() => weigh(won), /cannot be used/);
});

test('a valid alternate strategy works; the game does not require memorizing the matrix', () => {
  // Swap all left/right labels and reverse the identity assignment.
  let game = createGame();
  for (let round = 0; round < 3; round++) {
    const source = referencePositions(round), positions = {};
    PEOPLE.forEach((p, i) => { const side = source[PEOPLE[11 - i].id]; positions[p.id] = side === 'L' ? 'R' : side === 'R' ? 'L' : '-'; });
    game = weigh({ ...game, positions }, round);
  }
  assert.equal(game.truths.length, 1);
  assert.equal(game.phase, 'accusing');
});
