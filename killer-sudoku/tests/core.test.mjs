import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const source = existsSync(new URL('../dist/core.mjs', import.meta.url)) ? '../dist/' : '../';
const { generatePuzzle, generateSolution, seededRandom, solve, LEVELS, HOUSES, cageMap, findConflicts, isComplete, candidatesFor, logicalHint, neighbors, cageCombinations } = await import(source + 'core.mjs');
const { createGame, enterNumber, undo, redo, restoreGame } = await import(source + 'state.mjs');

// Independent reference counter: direct backtracking + exact remaining sum sets.
// It deliberately does not use the production solver, candidate function, or its tables.
function referenceCount(cages, limit = 2) {
  const board = Array(81).fill(0), index = Array(81), groups = [];
  for (let r = 0; r < 9; r++) groups.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) groups.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  for (let b = 0; b < 9; b++) groups.push(Array.from({ length: 9 }, (_, i) => Math.floor(b / 3) * 27 + b % 3 * 3 + Math.floor(i / 3) * 9 + i % 3));
  const peers = board.map((_, i) => new Set(groups.filter(g => g.includes(i)).flat()));
  cages.forEach((c, k) => c.cells.forEach(i => { index[i] = k; c.cells.forEach(j => peers[i].add(j)); }));
  const possibilities = cages.map(c => {
    const result = [];
    function combinations(next, digits, total) {
      if (digits.length === c.cells.length) { if (total === c.sum) result.push(digits); return; }
      for (let n = next; n <= 9; n++) if (total + n <= c.sum) combinations(n + 1, [...digits, n], total + n);
    }
    combinations(1, [], 0); return result;
  });
  let found = 0, nodes = 0;
  function search() {
    if (++nodes > 2000000) throw new Error('Reference solver exceeded its verification budget');
    let target = -1, choices = null;
    const allowed = cages.map((c, k) => {
      const used = c.cells.map(i => board[i]).filter(Boolean);
      return new Set(possibilities[k].filter(p => used.every(n => p.includes(n))).flat());
    });
    for (let i = 0; i < 81; i++) if (!board[i]) {
      const used = new Set([...peers[i]].map(j => board[j]));
      const valid = [...allowed[index[i]]].filter(n => !used.has(n));
      if (!valid.length) return;
      if (!choices || valid.length < choices.length) { choices = valid; target = i; if (valid.length === 1) break; }
    }
    if (target < 0) { found++; return; }
    for (const n of choices) { board[target] = n; search(); board[target] = 0; if (found >= limit) return; }
  }
  search(); return found;
}

const seeds = [1, 2, 109, 4109, 90347, 0xffffffff];
const samples = [];
test('24 fresh puzzles independently satisfy every rule and have exactly one solution', () => {
  const gridSignatures = new Set();
  for (const difficulty of Object.keys(LEVELS)) for (const seed of seeds) {
    const puzzle = generatePuzzle(difficulty, seed); samples.push(puzzle);
    assert.equal(puzzle.difficulty, difficulty);
    assert.ok(puzzle.generation.branches <= LEVELS[difficulty].maxBranches);
    assert.equal(puzzle.cages.flatMap(c => c.cells).length, 81);
    assert.equal(new Set(puzzle.cages.flatMap(c => c.cells)).size, 81);
    for (const house of HOUSES) assert.deepEqual(house.map(i => puzzle.solution[i]).sort(), [1,2,3,4,5,6,7,8,9]);
    for (const cage of puzzle.cages) {
      assert.ok(cage.cells.length <= LEVELS[difficulty].maxSize);
      assert.equal(cage.cells.reduce((s, i) => s + puzzle.solution[i], 0), cage.sum);
      assert.equal(new Set(cage.cells.map(i => puzzle.solution[i])).size, cage.cells.length);
      const reached = new Set([cage.cells[0]]), queue = [cage.cells[0]];
      while (queue.length) for (const i of neighbors(queue.pop())) if (cage.cells.includes(i) && !reached.has(i)) { reached.add(i); queue.push(i); }
      assert.equal(reached.size, cage.cells.length);
    }
    assert.equal(referenceCount(puzzle.cages), 1, `${difficulty}, seed ${seed}`);
    assert.ok(puzzle.cages.length >= LEVELS[difficulty].cages);
    gridSignatures.add(puzzle.solution.join(''));
  }
  assert.equal(gridSignatures.size, seeds.length);
  const means = Object.keys(LEVELS).map(d => samples.filter(p => p.difficulty === d).reduce((s, p) => s + p.cages.length, 0) / seeds.length);
  assert.ok(means.every((n, i) => !i || n < means[i - 1]), `Cage density should decrease by level: ${means}`);
  console.log('Average cages by level:', means.map(n => n.toFixed(1)).join(', '));
});
test('generation is reproducible and different seeds change both layout and solution', () => {
  const a = generatePuzzle('medium', 492), b = generatePuzzle('medium', 492), c = generatePuzzle('medium', 493);
  assert.deepEqual(a, b); assert.notDeepEqual(a.cages, c.cages); assert.notDeepEqual(a.solution, c.solution);
  assert.throws(() => generatePuzzle('invalid', 1));
  assert.equal(new Set(generateSolution(seededRandom(111))).size, 9);
});
test('solver detects ambiguous and impossible puzzles; budget exits cannot count as uniqueness', () => {
  const rowCages = HOUSES.slice(0, 9).map(cells => ({ cells, sum: 45 }));
  assert.equal(solve(rowCages).count, 2);
  const tiny = solve(rowCages, undefined, { maxNodes: 1 }); assert.equal(tiny.complete, false);
  const impossible = generatePuzzle('easy', 1).cages.map(c => ({ ...c })); impossible[0].sum = 100;
  assert.equal(solve(impossible).count, 0);
  assert.equal(solve([]).count, 0);
});
test('cage arithmetic and ordinary Sudoku conflicts are detected without revealing the solution', () => {
  const p = generatePuzzle('medium', 82), values = Array(81).fill(0);
  assert.equal(findConflicts(p.cages, values).size, 0);
  values[0] = 4; values[1] = 4;
  assert.ok(findConflicts(p.cages, values).has(0)); assert.ok(findConflicts(p.cages, values).has(1));
  assert.ok(isComplete(p.cages, p.solution)); assert.ok(!isComplete(p.cages, Array(81).fill(1)));
  assert.deepEqual(cageCombinations(2, 10), [[4,6],[3,7],[2,8],[1,9]]);
  const partial = [...p.solution]; partial[9] = 0;
  assert.ok(candidatesFor(p.cages, partial, 9).includes(p.solution[9]));
});
test('pencil notes, peer cleanup, undo and redo preserve a complete reversible move', () => {
  const p = generatePuzzle('easy', 11), g = createGame(p), n = p.solution[0];
  assert.ok(enterNumber(g, 1, n, true)); assert.ok(g.notes[1]);
  const before = JSON.stringify(g.notes);
  assert.ok(enterNumber(g, 0, n, false)); assert.equal(g.notes[1], 0);
  assert.ok(undo(g)); assert.equal(JSON.stringify(g.notes), before); assert.equal(g.values[0], 0);
  assert.ok(redo(g)); assert.equal(g.values[0], n); assert.equal(g.notes[1], 0);
  assert.equal(enterNumber(g, 0, 3, true), false);
  g.paused = true; assert.equal(enterNumber(g, 5, 1), false); assert.equal(undo(g), false);
  g.paused = false; assert.equal(enterNumber(g, 81, 1), false); assert.equal(enterNumber(g, 1, 10), false);
});
test('completion, hint explanations, and resumed saved games agree with the verified solution', () => {
  const p = generatePuzzle('medium', 16), g = createGame(p);
  for (let i = 0; i < 80; i++) assert.ok(enterNumber(g, i, p.solution[i], false));
  const h = logicalHint(p, g.values); assert.equal(h.value, p.solution[h.cell]); assert.notEqual(h.kind, 'reveal');
  const restored = restoreGame(JSON.stringify(g)); assert.deepEqual(restored.values, g.values); assert.equal(restored.history.length, 80);
  assert.ok(enterNumber(restored, 80, p.solution[80], false)); assert.ok(restored.completed);
  assert.equal(enterNumber(restored, 0, 0), false);
  assert.ok(undo(restored)); assert.equal(restored.completed, false);
  restored.values[0] = p.solution[0] % 9 + 1; assert.equal(logicalHint(p, restored.values).kind, 'correction');
  assert.equal(restoreGame('{broken'), null);
  const bad = JSON.parse(JSON.stringify(g)); bad.notes[0] = -1; assert.equal(restoreGame(bad), null);
  const badCage = JSON.parse(JSON.stringify(g)); badCage.puzzle.cages[0].cells.push(badCage.puzzle.cages[0].cells[0]); assert.equal(restoreGame(badCage), null);
  const badId = JSON.parse(JSON.stringify(g)); badId.puzzle.id = '<script>'; assert.equal(restoreGame(badId), null);
});
