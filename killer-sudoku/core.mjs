// Pure puzzle engine. No DOM, network, stored puzzle bank, or external dependencies.
export const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
export const LEVELS = Object.freeze({
  easy: { label: 'Easy', cages: 40, maxSize: 3, maxBranches: 0, description: 'Small cages. More places to begin.' },
  medium: { label: 'Medium', cages: 33, maxSize: 4, maxBranches: 12, description: 'A balanced mix of sums and Sudoku.' },
  hard: { label: 'Hard', cages: 28, maxSize: 5, maxBranches: 160, description: 'Larger cages. Fewer obvious answers.' },
  expert: { label: 'Expert', cages: 24, maxSize: 6, maxBranches: 900, description: 'Sparse clues for a longer challenge.' },
});
const FULL = 511;
const bits = DIGITS.map(n => 1 << (n - 1));
const bitCount = Array.from({ length: 512 }, (_, m) => m.toString(2).replaceAll('0', '').length);
const bitSum = Array.from({ length: 512 }, (_, m) => DIGITS.reduce((s, n) => s + ((m & bits[n - 1]) ? n : 0), 0));
const combos = Array.from({ length: 10 }, () => Array.from({ length: 46 }, () => []));
for (let m = 0; m < 512; m++) combos[bitCount[m]][bitSum[m]].push(m);
export const rowOf = i => Math.floor(i / 9);
export const colOf = i => i % 9;
export const boxOf = i => Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3);
export const HOUSES = [
  ...DIGITS.map((_, r) => DIGITS.map((_, c) => r * 9 + c)),
  ...DIGITS.map((_, c) => DIGITS.map((_, r) => r * 9 + c)),
  ...DIGITS.map((_, b) => DIGITS.map((_, k) => Math.floor(b / 3) * 27 + (b % 3) * 3 + Math.floor(k / 3) * 9 + k % 3)),
];
export const neighbors = i => [i - 9, i + 9, ...(i % 9 ? [i - 1] : []), ...(i % 9 < 8 ? [i + 1] : [])].filter(j => j >= 0 && j < 81);
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => { a += 0x6D2B79F5; let t = Math.imul(a ^ a >>> 15, 1 | a); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function shuffle(items, rng) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function cageMap(cages) {
  const map = new Int16Array(81).fill(-1);
  cages.forEach((cage, k) => cage.cells.forEach(i => { map[i] = k; }));
  return map;
}
export function cageCombinations(size, sum) {
  return (combos[size]?.[sum] ?? []).map(m => DIGITS.filter(n => m & bits[n - 1]));
}

function analyze(cages, values, map) {
  const rows = new Uint16Array(9), cols = new Uint16Array(9), boxes = new Uint16Array(9);
  const used = new Uint16Array(cages.length), sums = new Uint16Array(cages.length), remaining = cages.map(c => c.cells.length);
  for (let i = 0; i < 81; i++) {
    const n = values[i]; if (!n) continue;
    const b = bits[n - 1], r = rowOf(i), c = colOf(i), x = boxOf(i), k = map[i];
    if (!b || k < 0 || (rows[r] | cols[c] | boxes[x] | used[k]) & b) return null;
    rows[r] |= b; cols[c] |= b; boxes[x] |= b; used[k] |= b; sums[k] += n; remaining[k]--;
  }
  const unions = new Uint16Array(cages.length);
  for (let k = 0; k < cages.length; k++) {
    const target = cages[k].sum - sums[k], count = remaining[k];
    if (!count) { if (target !== 0) return null; continue; }
    const options = combos[count]?.[target]; if (!options) return null;
    for (const mask of options) if (!(mask & used[k])) unions[k] |= mask;
    if (!unions[k]) return null;
  }
  const candidates = new Uint16Array(81);
  for (let i = 0; i < 81; i++) {
    if (values[i]) continue;
    candidates[i] = unions[map[i]] & ~(rows[rowOf(i)] | cols[colOf(i)] | boxes[boxOf(i)]);
    if (!candidates[i]) return null;
  }
  return { candidates, rows, cols, boxes };
}

// Count, rather than merely find, solutions. A node-budget exit is never proof of uniqueness.
export function solve(cages, values = Array(81).fill(0), { limit = 2, maxNodes = 12000 } = {}) {
  const map = cageMap(cages); let nodes = 0, branches = 0, aborted = false;
  const solutions = [];
  function search(board) {
    if (aborted || solutions.length >= limit) return;
    if (++nodes > maxNodes) { aborted = true; return; }
    let info;
    for (;;) {
      info = analyze(cages, board, map); if (!info) return;
      let changed = false;
      for (let i = 0; i < 81; i++) {
        const m = info.candidates[i];
        if (m && bitCount[m] === 1) { board[i] = Math.log2(m) + 1; changed = true; break; }
      }
      if (changed) continue;
      for (let h = 0; h < 27 && !changed; h++) {
        const occupied = h < 9 ? info.rows[h] : h < 18 ? info.cols[h - 9] : info.boxes[h - 18];
        for (const b of bits) {
          if (occupied & b) continue;
          let location = -1, count = 0;
          for (const i of HOUSES[h]) if (info.candidates[i] & b) { location = i; count++; }
          if (!count) return;
          if (count === 1) { board[location] = Math.log2(b) + 1; changed = true; break; }
        }
      }
      if (!changed) break;
    }
    let cell = -1, best = 10;
    for (let i = 0; i < 81; i++) if (!board[i] && bitCount[info.candidates[i]] < best) { cell = i; best = bitCount[info.candidates[i]]; }
    if (cell < 0) { solutions.push(board); return; }
    branches++;
    for (const n of DIGITS) if (info.candidates[cell] & bits[n - 1]) {
      const next = [...board]; next[cell] = n; search(next);
      if (aborted || solutions.length >= limit) return;
    }
  }
  if (map.some(k => k < 0) || values.length !== 81) return { count: 0, complete: true, solutions, nodes, branches };
  search([...values]);
  return { count: solutions.length, complete: !aborted, solutions, nodes, branches };
}

// Randomized search makes genuinely new completed grids, not just digit swaps of a fixed board.
export function generateSolution(rng) {
  const board = Array(81).fill(0), rows = Array(9).fill(0), cols = Array(9).fill(0), boxes = Array(9).fill(0);
  function fill() {
    let cell = -1, mask = 0, best = 10;
    for (const i of shuffle(Array.from({ length: 81 }, (_, i) => i), rng)) if (!board[i]) {
      const m = FULL & ~(rows[rowOf(i)] | cols[colOf(i)] | boxes[boxOf(i)]), count = bitCount[m];
      if (!count) return false;
      if (count < best) { cell = i; mask = m; best = count; if (count === 1) break; }
    }
    if (cell < 0) return true;
    const r = rowOf(cell), c = colOf(cell), x = boxOf(cell);
    for (const n of shuffle(DIGITS, rng)) if (mask & bits[n - 1]) {
      const b = bits[n - 1]; board[cell] = n; rows[r] |= b; cols[c] |= b; boxes[x] |= b;
      if (fill()) return true;
      board[cell] = 0; rows[r] ^= b; cols[c] ^= b; boxes[x] ^= b;
    }
    return false;
  }
  fill(); return board;
}

export function generatePuzzle(difficulty = 'medium', seed = (Math.random() * 4294967296) >>> 0, onProgress = () => {}) {
  const level = LEVELS[difficulty]; if (!level) throw new Error('Unknown difficulty');
  const rng = seededRandom(seed), solution = generateSolution(rng);
  let cages = solution.map((n, i) => ({ cells: [i], sum: n }));
  const failed = new Set(); let checks = 0, progress = 0;
  for (let pass = 0; pass < 4 && cages.length > level.cages; pass++) {
    let merged = false;
    const map = cageMap(cages), pairs = new Map();
    for (let i = 0; i < 81; i++) for (const j of neighbors(i)) {
      const a = Math.min(map[i], map[j]), b = Math.max(map[i], map[j]);
      if (a === b) continue;
      pairs.set(a + ':' + b, [a, b]);
    }
    const options = shuffle([...pairs.values()], rng).sort(([a, b], [c, d]) =>
      Number(cages[a].cells.length > 1 && cages[b].cells.length > 1) - Number(cages[c].cells.length > 1 && cages[d].cells.length > 1));
    for (const [a, b] of options) {
      const cells = [...cages[a].cells, ...cages[b].cells].sort((x, y) => x - y);
      if (cells.length > level.maxSize || new Set(cells.map(i => solution[i])).size !== cells.length) continue;
      const key = cells.join(','); if (failed.has(key)) continue;
      const next = cages.filter((_, k) => k !== a && k !== b);
      next.push({ cells, sum: cages[a].sum + cages[b].sum });
      const result = solve(next, undefined, { limit: 2, maxNodes: 1800 }); checks++;
      if (result.complete && result.count === 1 && result.branches <= level.maxBranches) {
        cages = next; merged = true; pass = -1;
        const p = Math.round((81 - cages.length) / (81 - level.cages) * 100);
        if (p !== progress) { progress = p; onProgress(Math.min(99, p)); }
        break;
      }
      failed.add(key);
    }
    if (!merged) break;
  }
  cages.sort((a, b) => a.cells[0] - b.cells[0]);
  // Every accepted merge preserves exactly one solution, including when the target is not reachable.
  const rating = solve(cages);
  if (!rating.complete || rating.count !== 1) throw new Error('Puzzle verification failed');
  onProgress(100);
  return { version: 1, seed: seed >>> 0, id: (seed >>> 0).toString(36).toUpperCase().padStart(7, '0'), difficulty, cages, solution,
    generation: { checks, cages: cages.length, branches: rating.branches, nodes: rating.nodes } };
}

export function candidatesFor(cages, values, cell) {
  const board = [...values]; board[cell] = 0;
  const map = cageMap(cages), k = map[cell]; if (k < 0) return [];
  const cage = cages[k], peers = new Set([...HOUSES[rowOf(cell)], ...HOUSES[9 + colOf(cell)], ...HOUSES[18 + boxOf(cell)], ...cage.cells]);
  const used = new Set([...peers].map(i => board[i]).filter(Boolean));
  const filled = cage.cells.filter(i => board[i]), sum = filled.reduce((s, i) => s + board[i], 0), empty = cage.cells.length - filled.length;
  const cageUsed = filled.reduce((m, i) => m | bits[board[i] - 1], 0);
  let union = 0;
  for (const m of combos[empty]?.[cage.sum - sum] ?? []) if (!(m & cageUsed)) union |= m;
  return DIGITS.filter(n => !used.has(n) && (union & bits[n - 1]));
}

export function findConflicts(cages, values) {
  const bad = new Set();
  for (const cells of [...HOUSES, ...cages.map(c => c.cells)]) {
    const seen = new Map();
    for (const i of cells) if (values[i]) { const other = seen.get(values[i]); if (other !== undefined) { bad.add(i); bad.add(other); } seen.set(values[i], i); }
  }
  for (const cage of cages) {
    const filled = cage.cells.filter(i => values[i]), sum = filled.reduce((s, i) => s + values[i], 0);
    const remaining = cage.cells.length - filled.length;
    const used = filled.reduce((m, i) => m | bits[values[i] - 1], 0);
    const feasible = (combos[remaining]?.[cage.sum - sum] ?? []).some(m => !(m & used));
    if (!feasible) filled.forEach(i => bad.add(i));
  }
  return bad;
}

export function isComplete(cages, values) { return values.length === 81 && values.every(n => Number.isInteger(n) && n >= 1 && n <= 9) && findConflicts(cages, values).size === 0; }

export function logicalHint(puzzle, values) {
  const wrong = values.findIndex((n, i) => n && n !== puzzle.solution[i]);
  if (wrong >= 0) return { cell: wrong, value: 0, kind: 'correction', text: `Revisit row ${rowOf(wrong) + 1}, column ${colOf(wrong) + 1}. Its number conflicts with the puzzle’s solution. Erase it and try again.` };
  for (const cage of puzzle.cages) {
    const empty = cage.cells.filter(i => !values[i]);
    if (empty.length === 1) {
      const sum = cage.cells.reduce((s, i) => s + values[i], 0), cell = empty[0], value = cage.sum - sum;
      return { cell, value, kind: 'sum', text: cage.cells.length === 1 ? `A one-cell cage gives its number directly: ${value}.` : `This cage totals ${cage.sum}. The filled cells add to ${sum}, so the last cell is ${cage.sum} − ${sum} = ${value}.` };
    }
  }
  const candidates = values.map((n, i) => n ? [] : candidatesFor(puzzle.cages, values, i));
  for (let i = 0; i < 81; i++) if (candidates[i].length === 1) return { cell: i, value: candidates[i][0], kind: 'single', text: `Only ${candidates[i][0]} fits this cell’s row, column, box, and cage sum.` };
  for (let h = 0; h < HOUSES.length; h++) for (const n of DIGITS) {
    if (HOUSES[h].some(i => values[i] === n)) continue;
    const possible = HOUSES[h].filter(i => candidates[i].includes(n));
    if (possible.length === 1) return { cell: possible[0], value: n, kind: 'hidden', text: `${n} can go in only this cell in its ${h < 9 ? 'row' : h < 18 ? 'column' : '3 × 3 box'}. The cage sums rule out the other positions.` };
  }
  const cell = candidates.reduce((best, list, i) => list.length && (best < 0 || list.length < candidates[best].length) ? i : best, -1);
  if (cell < 0) return null;
  return { cell, value: puzzle.solution[cell], kind: 'reveal', text: `No simple single is available. You can reveal this cell from the verified solution, or keep working with pencil notes.` };
}
