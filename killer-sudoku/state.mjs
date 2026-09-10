import { HOUSES, rowOf, colOf, boxOf, cageMap, neighbors, isComplete, LEVELS } from './core.mjs';
export function createGame(puzzle) {
  return { version: 1, puzzle, values: Array(81).fill(0), notes: Array(81).fill(0), selected: 0, notesMode: false,
    elapsed: 0, paused: false, completed: false, hints: 0, history: [], future: [] };
}
const snapshot = game => ({ values: [...game.values], notes: [...game.notes], selected: game.selected });
export function enterNumber(game, cell, number, asNote = game.notesMode) {
  if (!Number.isInteger(cell) || cell < 0 || cell > 80 || !Number.isInteger(number) || number < 0 || number > 9 || game.paused || game.completed) return false;
  if (asNote && number && game.values[cell]) return false;
  if (!number && !game.values[cell] && !game.notes[cell]) return false;
  if (!asNote && number && game.values[cell] === number) return false;
  game.history.push(snapshot(game)); if (game.history.length > 250) game.history.shift(); game.future = [];
  game.selected = cell;
  if (asNote && number) game.notes[cell] ^= 1 << (number - 1);
  else {
    game.values[cell] = number; game.notes[cell] = 0;
    if (number) {
      const cage = game.puzzle.cages[cageMap(game.puzzle.cages)[cell]];
      const peers = new Set([...HOUSES[rowOf(cell)], ...HOUSES[9 + colOf(cell)], ...HOUSES[18 + boxOf(cell)], ...cage.cells]);
      for (const i of peers) game.notes[i] &= ~(1 << (number - 1));
    }
  }
  game.completed = isComplete(game.puzzle.cages, game.values);
  return true;
}
export function undo(game) {
  if (!game.history.length || game.paused) return false;
  game.future.push(snapshot(game)); Object.assign(game, game.history.pop()); game.completed = isComplete(game.puzzle.cages, game.values); return true;
}
export function redo(game) {
  if (!game.future.length || game.paused) return false;
  game.history.push(snapshot(game)); Object.assign(game, game.future.pop()); game.completed = isComplete(game.puzzle.cages, game.values); return true;
}
function validNumbers(a, max) { return Array.isArray(a) && a.length === 81 && a.every(n => Number.isInteger(n) && n >= 0 && n <= max); }
export function restoreGame(raw) {
  try {
    const g = typeof raw === 'string' ? JSON.parse(raw) : raw, p = g.puzzle;
    if (g.version !== 1 || p?.version !== 1 || !LEVELS[p.difficulty] || !Number.isInteger(p.seed) || p.seed < 0 || p.seed > 0xffffffff || !validNumbers(p.solution, 9) || !Array.isArray(p.cages) || p.cages.length < 1 || p.cages.length > 81) return null;
    if (p.id !== p.seed.toString(36).toUpperCase().padStart(7, '0')) return null;
    const all = [];
    for (const c of p.cages) {
      if (!Array.isArray(c.cells) || c.cells.length < 1 || c.cells.length > 9 || !Number.isInteger(c.sum) || c.sum < 1 || c.sum > 45 || c.cells.some(i => !Number.isInteger(i) || i < 0 || i > 80)) return null;
      const connected = new Set([c.cells[0]]), queue = [c.cells[0]];
      while (queue.length) for (const j of neighbors(queue.pop())) if (c.cells.includes(j) && !connected.has(j)) { connected.add(j); queue.push(j); }
      if (connected.size !== c.cells.length) return null;
      all.push(...c.cells);
    }
    if (all.length !== 81 || new Set(all).size !== 81 || !isComplete(p.cages, p.solution) || !validNumbers(g.values, 9) || !validNumbers(g.notes, 511)) return null;
    const clean = createGame(p);
    Object.assign(clean, { values: [...g.values], notes: g.notes.map((n, i) => g.values[i] ? 0 : n),
      elapsed: Number.isFinite(g.elapsed) ? Math.max(0, g.elapsed) : 0, selected: Number.isInteger(g.selected) && g.selected >= 0 && g.selected < 81 ? g.selected : 0,
      notesMode: !!g.notesMode, paused: !!g.paused, hints: Number.isInteger(g.hints) ? Math.max(0, g.hints) : 0 });
    for (const key of ['history', 'future']) clean[key] = Array.isArray(g[key]) ? g[key].slice(-250).filter(s => validNumbers(s.values, 9) && validNumbers(s.notes, 511) && Number.isInteger(s.selected) && s.selected >= 0 && s.selected < 81) : [];
    clean.completed = isComplete(p.cages, clean.values); return clean;
  } catch { return null; }
}
