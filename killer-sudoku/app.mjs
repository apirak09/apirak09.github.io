import { DIGITS, LEVELS, rowOf, colOf, boxOf, cageMap, cageCombinations, findConflicts, logicalHint } from './core.mjs';
import { createGame, enterNumber, undo, redo, restoreGame } from './state.mjs';

const $ = id => document.getElementById(id);
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .2c0 1.8-2.5 2-2.5 3.8M12 16.5h.01"/>',
  moon: '<path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  play: '<path d="m8 5 11 7-11 7Z"/>',
  pencil: '<path d="m15 4 5 5M4 20l1-5L16 4a2 2 0 0 1 4 4L9 19Z"/>',
  erase: '<path d="m14 4 6 6a2 2 0 0 1 0 3l-7 7H7l-4-4a2 2 0 0 1 0-3l8-9a2 2 0 0 1 3 0ZM7 10l8 8M13 20h8"/>',
  undo: '<path d="M8 4 3 9l5 5M3 9h10a7 7 0 0 1 0 14" transform="translate(0 -2)"/>',
  bulb: '<path d="M9 18v-2a6 6 0 1 1 6 0v2M9 18h6M10 21h4"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  cloud: '<path d="M7 18a5 5 0 1 1 0-10 6 6 0 0 1 11-1 5 5 0 0 1 0 11M9 15l2 2 4-4"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  keyboard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.1M10 9h.1M14 9h.1M18 9h.1M6 12h.1M10 12h.1M14 12h.1M18 12h.1M7 15h10"/>',
};
function icon(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] ?? ''}</svg>`; }
function paintIcons() { document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
paintIcons();

const STORAGE_KEY = 'jack-killer-sudoku-v1', SETTINGS_KEY = 'jack-killer-sudoku-settings-v1', RECENT_KEY = 'jack-killer-sudoku-seeds-v1';
let game = null, map = null, worker = null, workerTimeout = null, busy = false, hint = null, checked = new Set(), toastTimeout = null;
let lastTick = performance.now(), saveTick = 0, currentDifficulty = 'medium', cells = [], cagePaths = [], storageWorking = true;
function readStorage(key) { try { return localStorage.getItem(key); } catch { storageWorking = false; return null; } }
function writeStorage(key, value) { try { localStorage.setItem(key, value); storageWorking = true; } catch { storageWorking = false; } }
let settings = {};
try { settings = JSON.parse(readStorage(SETTINGS_KEY) || '{}') || {}; } catch { /* Ignore corrupt preferences. */ }
if (typeof settings !== 'object' || Array.isArray(settings)) settings = {};
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('theme-button').innerHTML = `<span class="icon">${icon(theme === 'dark' ? 'sun' : 'moon')}</span>`;
  $('theme-button').setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#151922' : '#f7f8fa';
}
setTheme(settings.theme === 'dark' ? 'dark' : 'light');
$('theme-button').onclick = () => { settings.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; setTheme(settings.theme); writeStorage(SETTINGS_KEY, JSON.stringify(settings)); };

function formatTime(ms) { const s = Math.floor(ms / 1000); return s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
function hasDialog() { return !!document.querySelector('dialog[open]'); }
function tick() {
  const now = performance.now();
  if (game && !game.paused && !game.completed && !busy && !document.hidden && !hasDialog()) game.elapsed += Math.max(0, now - lastTick);
  lastTick = now;
  $('timer').textContent = formatTime(game?.elapsed || 0);
}
function save() {
  if (game) writeStorage(STORAGE_KEY, JSON.stringify(game));
  $('save-status').textContent = storageWorking ? 'Progress saved on this device' : 'Saving unavailable in this browser';
}
setInterval(() => { tick(); if (++saveTick % 10 === 0 && game && !busy) save(); }, 1000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game && !game.paused && !game.completed && !busy) { tick(); game.paused = true; render(); save(); }
  lastTick = performance.now();
});
window.addEventListener('pagehide', save);

function toast(message) { clearTimeout(toastTimeout); $('toast').textContent = message; $('toast').hidden = false; toastTimeout = setTimeout(() => { $('toast').hidden = true; }, 4200); }
function showDialog(id) { tick(); $(id).showModal(); lastTick = performance.now(); }
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('close', () => { lastTick = performance.now(); });
document.querySelectorAll('[data-close]').forEach(el => { el.onclick = () => $(el.dataset.close).close(); });
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', e => { if (e.target === dialog) { const rect = dialog.getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) dialog.close(); } }));
$('how-to').onclick = () => showDialog('help-dialog');
$('shortcuts-button').onclick = () => showDialog('shortcuts-dialog');
function openNew() {
  if (busy) return;
  document.querySelector(`input[name="difficulty"][value="${game?.puzzle.difficulty || currentDifficulty}"]`).checked = true;
  $('replace-note').textContent = game && !game.completed && game.values.some(Boolean) ? 'This will replace your current puzzle and its progress.' : 'Fresh cages. Fresh numbers. A fresh challenge.';
  showDialog('new-dialog');
}
$('new-game').onclick = openNew;
$('win-new').onclick = () => { $('win-dialog').close(); openNew(); };
$('start-puzzle').onclick = () => { const difficulty = document.querySelector('input[name="difficulty"]:checked').value; $('new-dialog').close(); newPuzzle(difficulty); };

function buildBoard() {
  const board = $('board'); board.replaceChildren(); cells = []; cagePaths = [];
  for (let r = 0; r < 9; r++) {
    const row = document.createElement('div'); row.className = `board-row${r === 2 || r === 5 ? ' box-bottom' : ''}`; row.setAttribute('role', 'row');
    for (let c = 0; c < 9; c++) {
      const i = r * 9 + c, cell = document.createElement('button');
      cell.type = 'button'; cell.className = 'cell'; cell.dataset.cell = i; cell.setAttribute('role', 'gridcell'); cell.setAttribute('aria-rowindex', r + 1); cell.setAttribute('aria-colindex', c + 1); cell.tabIndex = -1;
      cell.innerHTML = '<span class="cage-total"></span><span class="cell-value"></span><span class="cell-notes" aria-hidden="true"></span>';
      cell.onclick = () => selectCell(i); row.append(cell); cells.push(cell);
    }
    board.append(row);
  }
  $('cage-lines').replaceChildren();
  for (const [k, cage] of game.puzzle.cages.entries()) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const contains = new Set(cage.cells), parts = [];
    for (const i of cage.cells) {
      const r = rowOf(i), c = colOf(i), x = c * 100, y = r * 100;
      const t = r === 0 || !contains.has(i - 9), b = r === 8 || !contains.has(i + 9), l = c === 0 || !contains.has(i - 1), rt = c === 8 || !contains.has(i + 1);
      if (t) parts.push(`M${x + (l ? 7 : -7)},${y + 7}H${x + (rt ? 93 : 107)}`);
      if (b) parts.push(`M${x + (l ? 7 : -7)},${y + 93}H${x + (rt ? 93 : 107)}`);
      if (l) parts.push(`M${x + 7},${y + (t ? 7 : -7)}V${y + (b ? 93 : 107)}`);
      if (rt) parts.push(`M${x + 93},${y + (t ? 7 : -7)}V${y + (b ? 93 : 107)}`);
    }
    path.setAttribute('d', parts.join(' ')); path.dataset.cage = k; $('cage-lines').append(path); cagePaths.push(path);
  }
}
function makeKeypads() {
  for (const target of ['desktop-keypad', 'mobile-keypad']) {
    const keypad = document.createElement('div'); keypad.className = 'keypad'; keypad.setAttribute('role', 'group'); keypad.setAttribute('aria-label', 'Number pad');
    for (const n of DIGITS) {
      const button = document.createElement('button'); button.className = 'number-key'; button.dataset.number = n; button.innerHTML = `<span>${n}</span><small>9 left</small>`; button.onclick = () => input(n); keypad.append(button);
    }
    $(target).append(keypad);
  }
}
makeKeypads();
function overlay(title, description, label, action, loading = false) {
  $('board-overlay').hidden = false; $('board').setAttribute('aria-hidden', 'true');
  $('overlay-title').textContent = title; $('overlay-description').textContent = description;
  $('overlay-action').hidden = !label; $('overlay-action').textContent = label || ''; $('overlay-action').onclick = action || null;
  document.querySelector('.loading-mark').classList.toggle('paused-mark', !loading);
}
function nextSeed() {
  let recent;
  try { recent = JSON.parse(readStorage(RECENT_KEY) || '[]'); if (!Array.isArray(recent)) recent = []; } catch { recent = []; }
  let seed;
  do { seed = crypto.getRandomValues(new Uint32Array(1))[0]; } while (recent.includes(seed));
  writeStorage(RECENT_KEY, JSON.stringify([...recent.slice(-99), seed])); return seed;
}
function endWorker() { clearTimeout(workerTimeout); worker?.terminate(); worker = null; busy = false; $('new-game').disabled = false; $('board').setAttribute('aria-busy', 'false'); }
function failGeneration() {
  endWorker(); renderButtons();
  overlay('A little interruption', 'We couldn’t finish this puzzle. Please try again.', game ? 'Return to puzzle' : 'Try again', () => game ? render() : newPuzzle(currentDifficulty));
  $('board-status').textContent = 'Puzzle generation interrupted';
}
function newPuzzle(difficulty) {
  if (!LEVELS[difficulty] || busy) return;
  tick(); currentDifficulty = difficulty; busy = true; hint = null; $('hint-card').hidden = true; checked.clear();
  $('new-game').disabled = true; $('board').setAttribute('aria-busy', 'true'); renderButtons();
  overlay('Making your puzzle', 'Finding one perfect solution…', game ? 'Cancel' : '', () => { endWorker(); render(); }, true);
  $('board-status').textContent = 'Creating a fresh challenge';
  try {
    worker = new Worker(new URL('./generator.worker.mjs', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') $('overlay-description').textContent = data.progress > 85 ? 'Checking the final cages…' : `Shaping the cages · ${data.progress}%`;
      if (data.type === 'error') failGeneration();
      if (data.type === 'puzzle') {
        endWorker(); game = createGame(data.puzzle); map = cageMap(game.puzzle.cages); buildBoard(); lastTick = performance.now(); render(); save();
      }
    };
    worker.onerror = failGeneration;
    workerTimeout = setTimeout(failGeneration, 45000);
    worker.postMessage({ difficulty, seed: nextSeed() });
  } catch { failGeneration(); }
}

function selectCell(i, focus = false) {
  if (!game || busy || game.paused) return;
  game.selected = i; render(); if (focus) cells[i].focus({ preventScroll: true });
}
function renderButtons() {
  const blocked = !game || busy || game.paused;
  for (const id of ['notes-button', 'erase-button', 'hint-button', 'check-button']) $(id).disabled = blocked || !!game?.completed;
  $('undo-button').disabled = blocked || !game?.history.length;
  $('pause-button').disabled = !game || busy || !!game.completed;
  document.querySelectorAll('.number-key').forEach(el => { el.disabled = blocked || !!game?.completed; });
}
function render() {
  if (!game || busy) return;
  const { values, notes, selected, puzzle } = game, selectedCage = map[selected], selectedNumber = values[selected], bad = findConflicts(puzzle.cages, values);
  for (let i = 0; i < 81; i++) {
    const cage = puzzle.cages[map[i]], cell = cells[i];
    const peer = rowOf(i) === rowOf(selected) || colOf(i) === colOf(selected) || boxOf(i) === boxOf(selected);
    cell.className = ['cell', [2, 5].includes(colOf(i)) ? 'box-right' : '', peer ? 'peer' : '', map[i] === selectedCage ? 'active-cage' : '', selectedNumber && values[i] === selectedNumber ? 'same-number' : '', i === selected ? 'selected' : '', bad.has(i) || checked.has(i) ? 'conflict' : '', checked.has(i) ? 'checked-error' : '', hint?.cell === i ? 'hint-target' : '', cage.cells.every(j => values[j]) && cage.cells.reduce((s, j) => s + values[j], 0) === cage.sum ? 'cage-done' : ''].filter(Boolean).join(' ');
    const total = cell.querySelector('.cage-total'); total.textContent = i === Math.min(...cage.cells) ? cage.sum : ''; total.hidden = !total.textContent;
    cell.querySelector('.cell-value').textContent = values[i] || '';
    const pencil = cell.querySelector('.cell-notes'); pencil.innerHTML = values[i] || !notes[i] ? '' : DIGITS.map(n => `<span class="${n === selectedNumber ? 'note-match' : ''}">${notes[i] & (1 << (n - 1)) ? n : ''}</span>`).join('');
    cell.tabIndex = i === selected && !game.paused ? 0 : -1;
    cell.disabled = game.paused;
    cell.setAttribute('aria-selected', String(i === selected)); cell.setAttribute('aria-invalid', String(bad.has(i) || checked.has(i)));
    const noteText = notes[i] ? `, notes ${DIGITS.filter(n => notes[i] & (1 << (n - 1))).join(', ')}` : '';
    cell.setAttribute('aria-label', `Row ${rowOf(i) + 1}, column ${colOf(i) + 1}, ${values[i] || 'empty'}${noteText}, cage total ${cage.sum}${bad.has(i) || checked.has(i) ? ', error' : ''}`);
  }
  cagePaths.forEach((path, k) => path.classList.toggle('selected-cage', k === selectedCage));
  $('level-label').textContent = LEVELS[puzzle.difficulty].label; $('puzzle-id').textContent = `№ ${puzzle.id}`;
  $('filled-label').textContent = `${values.filter(Boolean).length} / 81`;
  $('board-status').textContent = game.completed ? 'Every number in its place. Well played.' : game.paused ? 'Take your time. Your puzzle is waiting.' : bad.size ? `${bad.size} cells need another look` : game.notesMode ? 'Pencil mode · tap numbers to add possibilities' : 'One cell at a time.';
  $('notes-button').setAttribute('aria-pressed', String(game.notesMode)); $('notes-state').textContent = game.notesMode ? 'ON' : 'OFF'; document.body.classList.toggle('notes-mode', game.notesMode);
  $('pause-button').innerHTML = `<span class="icon">${icon(game.paused ? 'play' : 'pause')}</span>`; $('pause-button').setAttribute('aria-label', game.paused ? 'Resume game' : 'Pause game');
  $('timer').textContent = formatTime(game.elapsed);
  document.querySelectorAll('.number-key').forEach(el => {
    const n = Number(el.dataset.number), count = values.filter(v => v === n).length;
    el.querySelector('small').textContent = `${Math.max(0, 9 - count)} left`;
    el.setAttribute('aria-label', `${game.notesMode ? 'Pencil in' : 'Enter'} ${n}, ${Math.max(0, 9 - count)} remaining`);
    el.classList.toggle('exhausted', count >= 9); el.classList.toggle('key-active', selectedNumber === n || !!(game.notesMode && notes[selected] & (1 << (n - 1))));
  });
  renderSelection(); renderButtons();
  if (game.paused) {
    overlay('A moment to pause.', 'Your progress is right here when you’re ready.', 'Resume game', togglePause);
    $('selection-panel').style.visibility = 'hidden'; $('hint-card').hidden = true;
  } else {
    $('board-overlay').hidden = true; $('board').removeAttribute('aria-hidden'); $('selection-panel').style.visibility = '';
    if (hint) $('hint-card').hidden = false;
  }
}
function renderSelection() {
  const cage = game.puzzle.cages[map[game.selected]], filled = cage.cells.filter(i => game.values[i]), total = filled.reduce((s, i) => s + game.values[i], 0), left = cage.cells.length - filled.length;
  $('selection-title').textContent = `${cage.cells.length}-cell cage`; $('selection-coordinate').textContent = `R${rowOf(game.selected) + 1} · C${colOf(game.selected) + 1}`;
  $('cage-entered').textContent = total; $('cage-target').textContent = cage.sum;
  $('sum-progress').style.width = `${Math.min(100, total / cage.sum * 100)}%`; $('sum-progress').style.background = total > cage.sum ? 'var(--danger)' : '';
  $('cage-description').textContent = !left ? total === cage.sum ? new Set(filled.map(i => game.values[i])).size === filled.length ? 'Cage complete.' : 'The sum fits, but numbers repeat.' : `The sum should be ${cage.sum}.` : `${cage.sum - total} left across ${left} empty ${left === 1 ? 'cell' : 'cells'}`;
  const entered = filled.map(i => game.values[i]);
  const options = new Set(entered).size === entered.length ? cageCombinations(cage.cells.length, cage.sum).filter(combo => entered.every(n => combo.includes(n))) : [];
  $('combinations').innerHTML = options.length ? options.map(combo => `<span class="combination-chip">${combo.join(' + ')}</span>`).join('') : '<span class="no-combos">No combinations fit these entries.</span>';
}
function afterMove() {
  checked.clear(); hint = null; $('hint-card').hidden = true; render(); save();
  if (game.completed) {
    $('win-level').textContent = LEVELS[game.puzzle.difficulty].label; $('win-time').textContent = formatTime(game.elapsed); $('win-hints').textContent = game.hints;
    if (!hasDialog()) showDialog('win-dialog');
  }
}
function input(number) {
  if (!game || busy || game.paused || game.completed) return false;
  if (game.notesMode && number && game.values[game.selected]) { toast('Erase the number first to add pencil notes.'); return false; }
  tick(); const changed = enterNumber(game, game.selected, number); if (changed) afterMove(); return changed;
}
function toggleNotes() { if (!game || busy || game.paused || game.completed) return; game.notesMode = !game.notesMode; render(); save(); }
function togglePause() { if (!game || busy || game.completed) return; tick(); game.paused = !game.paused; lastTick = performance.now(); render(); save(); if (!game.paused) cells[game.selected].focus({ preventScroll: true }); }
$('notes-button').onclick = toggleNotes;
$('erase-button').onclick = () => input(0);
$('undo-button').onclick = () => { if (game && !busy && undo(game)) afterMove(); };
$('pause-button').onclick = togglePause;
$('combination-toggle').onclick = () => { const open = $('combinations').hidden; $('combinations').hidden = !open; $('combination-toggle').setAttribute('aria-expanded', String(open)); };
function getHint() {
  if (!game || busy || game.paused || game.completed) return;
  hint = logicalHint(game.puzzle, game.values); if (!hint) return;
  game.selected = hint.cell; $('hint-text').textContent = hint.text;
  $('apply-hint').textContent = hint.kind === 'correction' ? 'Erase this cell' : hint.kind === 'reveal' ? 'Reveal this cell' : `Fill in ${hint.value}`;
  $('hint-card').hidden = false; render();
}
$('hint-button').onclick = getHint;
$('dismiss-hint').onclick = () => { hint = null; $('hint-card').hidden = true; render(); };
$('apply-hint').onclick = () => {
  if (!hint || !game || game.paused || busy) return;
  tick(); if (enterNumber(game, hint.cell, hint.value, false)) { game.hints++; afterMove(); }
};
$('check-button').onclick = () => {
  if (!game || busy || game.paused) return;
  checked = new Set(game.values.map((n, i) => n && n !== game.puzzle.solution[i] ? i : -1).filter(i => i >= 0));
  const count = game.values.filter(Boolean).length;
  toast(checked.size ? `${checked.size} ${checked.size === 1 ? 'entry needs' : 'entries need'} another look. Marked with ! on the grid.` : count ? 'All your entries are correct so far.' : 'Your grid is ready. Select a cell and enter a number.'); render();
};
document.addEventListener('keydown', e => {
  if (hasDialog() || e.altKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
  if (!game || busy) return;
  if (e.code === 'Space' && (e.target === document.body || e.target.closest('#board') || e.target.closest('#pause-button'))) { e.preventDefault(); togglePause(); return; }
  if (game.paused) return;
  const key = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && key === 'z') { e.preventDefault(); if (e.shiftKey ? redo(game) : undo(game)) afterMove(); return; }
  if ((e.ctrlKey || e.metaKey) && key === 'y') { e.preventDefault(); if (redo(game)) afterMove(); return; }
  if (e.ctrlKey || e.metaKey) return;
  if (/^[1-9]$/.test(key)) { e.preventDefault(); input(Number(key)); }
  else if (['backspace', 'delete', '0'].includes(key)) { e.preventDefault(); input(0); }
  else if (key === 'n') { e.preventDefault(); toggleNotes(); }
  else if (key === 'h') { e.preventDefault(); getHint(); }
  else if (key.startsWith('arrow')) {
    e.preventDefault(); const i = game.selected;
    const next = key === 'arrowup' ? (i + 72) % 81 : key === 'arrowdown' ? (i + 9) % 81 : key === 'arrowleft' ? rowOf(i) * 9 + (colOf(i) + 8) % 9 : rowOf(i) * 9 + (colOf(i) + 1) % 9;
    selectCell(next, true);
  }
});

// Optional structured access shares the visible game's state; it never returns the hidden solution.
const modelContext = document.modelContext;
if (modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const registrations = [
    { name: 'read_killer_sudoku', title: 'Read the puzzle', description: 'Read the visible cage clues, entries, notes, and current game status. Does not reveal the solution.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: () => game ? { difficulty: game.puzzle.difficulty, id: game.puzzle.id, cages: game.puzzle.cages, values: game.values, notes: game.notes, selected: game.selected, paused: game.paused, generating: busy, completed: game.completed } : { generating: busy } },
    { name: 'enter_killer_sudoku_numbers', title: 'Enter puzzle numbers', description: 'Enter or erase numbers using one-based row and column coordinates. Updates the current visible game. Use 0 to erase.', inputSchema: { type: 'object', properties: { entries: { type: 'array', minItems: 1, maxItems: 81, items: { type: 'object', properties: { row: { type: 'integer', minimum: 1, maximum: 9 }, column: { type: 'integer', minimum: 1, maximum: 9 }, value: { type: 'integer', minimum: 0, maximum: 9 } }, required: ['row', 'column', 'value'], additionalProperties: false } } }, required: ['entries'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: input => {
      if (!game || busy || game.paused || game.completed || hasDialog()) throw new Error('The game is not ready for entries.');
      if (!Array.isArray(input?.entries) || !input.entries.length || input.entries.length > 81 || input.entries.some(e => !e || !Number.isInteger(e.row) || e.row < 1 || e.row > 9 || !Number.isInteger(e.column) || e.column < 1 || e.column > 9 || !Number.isInteger(e.value) || e.value < 0 || e.value > 9)) throw new Error('Provide valid row, column, and value for every entry.');
      tick(); let changed = 0;
      for (const e of input.entries) if (enterNumber(game, (e.row - 1) * 9 + e.column - 1, e.value, false)) changed++;
      afterMove(); return { changed, completed: game.completed, filled: game.values.filter(Boolean).length };
    } },
  ];
  for (const tool of registrations) try { Promise.resolve(modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch { /* Unsupported draft API does not affect play. */ }
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}

game = restoreGame(readStorage(STORAGE_KEY));
if (game) { currentDifficulty = game.puzzle.difficulty; map = cageMap(game.puzzle.cages); buildBoard(); render(); save(); }
else { if (readStorage(STORAGE_KEY)) toast('That saved puzzle couldn’t be restored. Starting a fresh one.'); newPuzzle('medium'); }
