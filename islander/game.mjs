import { PEOPLE, MAX_WEIGHINGS, OUTCOME_LABELS, REFERENCE, createGame, emptyPositions, movePerson, validatePositions, weigh, accuse, possibilitiesFor } from './core.mjs';
import { IslandAudio } from './audio.mjs';

const $ = id => document.getElementById(id);
const audio = new IslandAudio();
const preferencesKey = '12-islander-preferences-v1';
let game = createGame();
let selected = null, busy = false, dirty = true, drag = null, suppressClickUntil = 0;
let generation = 0, toastTimer = null, presentation = 0;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const personById = Object.fromEntries(PEOPLE.map(person => [person.id, person]));
const zones = { L: 'left platform', R: 'right platform', '-': 'ground' };
const dialogs = [...document.querySelectorAll('dialog')];
const pendingTimers = new Map();

function readPreferences() {
  try { return JSON.parse(localStorage.getItem(preferencesKey)) || {}; } catch { return {}; }
}
const preferences = readPreferences();
$('assistToggle').checked = preferences.hints !== false;
audio.enabled = preferences.sound === true;

function savePreferences() {
  try { localStorage.setItem(preferencesKey, JSON.stringify({ hints: $('assistToggle').checked, sound: audio.enabled })); } catch { /* Private storage can be unavailable; the game still works. */ }
}
function updateSoundControl() {
  $('soundLabel').textContent = audio.enabled ? 'Sound on' : 'Sound off';
  $('soundButton').setAttribute('aria-pressed', String(audio.enabled));
}
function announce(message) { $('announcement').textContent = message; }
function toast(message) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3200);
}
function delay(ms) {
  return new Promise(resolve => { const timer = setTimeout(() => { pendingTimers.delete(timer); resolve(); }, ms); pendingTimers.set(timer, resolve); });
}
function cancelDelays() { for (const [timer, resolve] of pendingTimers) { clearTimeout(timer); resolve(); } pendingTimers.clear(); }
function tieChoice() {
  // Accept a multiple-of-six range so both two-way and three-way ties are unbiased.
  try { let value; const values = new Uint32Array(1); do { crypto.getRandomValues(values); value = values[0]; } while (value >= 4294967292); return value; }
  catch { return Math.floor(Math.random() * 6); }
}
function openDialog(dialog) {
  if (dialog.open) return;
  cleanupDrag();
  for (const other of dialogs) if (other.open) other.close();
  dialog.showModal();
}

function hintState(id) {
  const candidates = possibilitiesFor(game.truths, id);
  return { ...candidates, label: candidates.heavy && candidates.light ? 'could be heavier or lighter' : candidates.heavy ? 'could be heavier' : candidates.light ? 'could be lighter' : 'proved normal', className: candidates.heavy && candidates.light ? 'both' : candidates.heavy ? 'heavy' : candidates.light ? 'light' : 'normal' };
}
function doll(person) {
  const index = PEOPLE.indexOf(person), hint = hintState(person.id);
  const button = document.createElement('button');
  button.type = 'button'; button.className = `doll hint-${hint.className}${selected === person.id ? ' selected' : ''}`;
  button.dataset.person = person.id;
  button.style.setProperty('--sprite-x', `${(index % 6) * 20}%`);
  button.style.setProperty('--sprite-y', `${Math.floor(index / 6) * 100}%`);
  button.disabled = busy || game.phase !== 'arranging';
  button.setAttribute('aria-pressed', String(selected === person.id));
  button.setAttribute('aria-label', `${person.id}, ${person.name}, ${zones[game.positions[person.id]]}${$('assistToggle').checked ? `, ${hint.label}` : ''}. ${person.description}. Select to move.`);
  button.title = `${person.id} · ${person.name}\n${person.description}${$('assistToggle').checked ? `\n${hint.label}` : ''}`;
  const arrows = `${hint.heavy ? '<span class="heavy-arrow">↑</span>' : ''}${hint.light ? '<span class="light-arrow">↓</span>' : ''}${!hint.heavy && !hint.light ? '<span class="normal-label">○</span>' : ''}`;
  button.innerHTML = `<span class="doll-id" aria-hidden="true">${person.id}</span><span class="sprite" role="img" aria-label="${person.name}: ${person.description}"></span><span class="doll-name">${person.name}</span><span class="doll-hint" aria-hidden="true">${arrows}</span>`;
  return button;
}

function renderPeople() {
  const focusedId = document.activeElement?.dataset.person;
  const roster = $('roster'); roster.replaceChildren(); $('leftPeople').replaceChildren(); $('rightPeople').replaceChildren();
  for (const person of PEOPLE) {
    const position = game.positions[person.id];
    if (position === '-') roster.append(doll(person));
    else {
      $(position === 'L' ? 'leftPeople' : 'rightPeople').append(doll(person));
      const vacancy = document.createElement('button');
      vacancy.className = 'roster-vacancy'; vacancy.type = 'button'; vacancy.dataset.recall = person.id;
      vacancy.disabled = busy || game.phase !== 'arranging';
      vacancy.setAttribute('aria-label', `Return ${person.name} from the ${zones[position]} to the ground`);
      vacancy.innerHTML = `<strong>${person.id}</strong><span>${person.name}</span><small>${position === 'L' ? '← LEFT' : 'RIGHT →'}</small>`;
      roster.append(vacancy);
    }
  }
  for (const side of ['L', 'R']) {
    const count = PEOPLE.filter(p => game.positions[p.id] === side).length;
    $(side === 'L' ? 'leftCount' : 'rightCount').textContent = `${count} islander${count === 1 ? '' : 's'}`;
    const zone = document.querySelector(`.platform[data-zone="${side}"]`);
    zone.classList.toggle('has-people', count > 0);
    zone.querySelector('.platform-label').disabled = busy || game.phase !== 'arranging';
  }
  const onGround = PEOPLE.filter(p => game.positions[p.id] === '-').length;
  $('groundCount').textContent = `${onGround} on shore`;
  $('moveBar').hidden = !selected || busy || game.phase !== 'arranging';
  if (selected) $('selectedName').textContent = `${selected} · ${personById[selected].name}`;
  document.body.classList.toggle('hints-off', !$('assistToggle').checked);
  $('legend').hidden = !$('assistToggle').checked;
  if (focusedId && !busy) document.querySelector(`.doll[data-person="${focusedId}"]`)?.focus({ preventScroll: true });
}

function renderJournal() {
  const journal = $('history');
  const openRounds = new Set([...journal.querySelectorAll('details[open]')].map(d => d.dataset.round));
  journal.replaceChildren();
  for (let i = 0; i < MAX_WEIGHINGS; i++) {
    const item = document.createElement('li'), entry = game.history[i];
    item.className = entry ? 'done' : 'pending';
    if (entry) {
      const side = value => PEOPLE.filter(person => entry.positions[person.id] === value).map(p => p.id).join(', ') || 'None';
      item.innerHTML = `<span class="history-number">${i + 1}</span><div class="history-title">${OUTCOME_LABELS[entry.result]}<span class="history-count">${entry.after} left</span></div><p>${side('L').replaceAll(', ', '')} vs ${side('R').replaceAll(', ', '')} · ${entry.before} → ${entry.after} truths</p><details data-round="${i}"${openRounds.has(String(i)) ? ' open' : ''}><summary>Inspect evidence</summary><div class="history-detail"><b>Left:</b> ${side('L')}<br><b>Right:</b> ${side('R')}<br><b>Ground:</b> ${side('-')}<br>Possible truths per outcome:<br>Left ${entry.counts.L} · Balance ${entry.counts['-']} · Right ${entry.counts.R}<br>The largest group was retained.</div></details>`;
    } else {
      item.innerHTML = `<span class="history-number">${i + 1}</span><div class="history-title">Weighing ${i + 1}</div><p>${i === game.history.length ? 'Waiting for your arrangement' : 'Still unwritten'}</p>`;
    }
    journal.append(item);
  }
  $('journalCount').textContent = `${game.history.length} / 3`;
}

function renderControls() {
  const count = side => PEOPLE.filter(p => game.positions[p.id] === side).length;
  const error = validatePositions(game.positions), rounds = game.history.length;
  $('placementCount').textContent = `${count('L')} on the left · ${count('R')} on the right`;
  const active = !busy && game.phase === 'arranging';
  $('weighButton').disabled = !active || Boolean(error);
  $('clearButton').disabled = !active || count('L') + count('R') === 0;
  $('usesLeft').textContent = `${3 - rounds} left`;
  $('placementHint').textContent = busy ? 'Listen. The old wood is giving way…' : rounds === 3 ? 'The seesaw is broken. No uses remain.' : error || `Ready. This will use weighing ${rounds + 1} of 3.`;
  $('roundLabel').innerHTML = `${String(Math.min(3, rounds + 1)).padStart(2, '0')} <span>/ 03</span>`;
  const integrity = ['Fragile, but holding', 'Small cracks appear', 'One last chance', 'Broken beyond repair'];
  $('integrityLabel').textContent = integrity[rounds];
  [...$('integrityBars').children].forEach((bar, i) => bar.classList.toggle('used', i < rounds));
  $('integrityBars').setAttribute('aria-label', `${3 - rounds} uses remaining`);
  $('scene').dataset.damage = String(rounds);
  $('scene').classList.toggle('is-weighing', busy && presentation === 0);
  $('truthCount').textContent = String(game.truths.length);
  $('uncertaintyFill').style.width = `${(game.truths.length / 24) * 100}%`;
  const message = $('evidenceMessage'); message.className = '';
  const remaining = 3 - rounds;
  if (rounds === 0) message.textContent = '12 people. Each could be heavier or lighter. Your first weighing changes that.';
  else if (game.truths.length === 1) { message.textContent = 'One explanation fits every result. You have enough evidence to name the impostor.'; message.className = 'solved'; }
  else if (game.truths.length > 3 ** remaining) {
    message.textContent = remaining ? `${game.truths.length} truths, but only ${3 ** remaining} result patterns remain. Certainty is now impossible.` : `${game.truths.length} explanations still fit. The seesaw broke before you could prove one.`;
    message.className = 'warning';
  } else message.textContent = `${new Set(game.truths.map(t => t.id)).size} islanders are still suspects. ${game.truths.length} explanations fit the evidence. ${remaining} weighing${remaining === 1 ? '' : 's'} remain.`;
  $('accuseButton').disabled = busy || game.phase !== 'accusing';
  $('accuseHint').textContent = game.phase === 'won' ? 'Case closed. The impostor is proved.' : game.phase === 'lost' ? 'Investigation ended. Review the journal or restart.' : game.phase === 'accusing' ? 'The evidence is complete. Make your deduction.' : 'One person. One weight difference. No guesses.';
}

function showBanner(title, subtitle, symbol = '◇') {
  $('outcomeText').textContent = title; $('outcomeSub').textContent = subtitle;
  $('outcomeBanner').querySelector('.outcome-symbol').textContent = symbol;
}
function neutralize() {
  $('scene').style.setProperty('--tilt', '0deg');
  $('scene').style.setProperty('--left-tilt', '0px'); $('scene').style.setProperty('--right-tilt', '0px');
}
function tilt(result) {
  const angle = result === 'L' ? -4.5 : result === 'R' ? 4.5 : 0;
  const offset = $('scene').clientWidth * 0.31 * Math.sin(angle * Math.PI / 180);
  $('scene').style.setProperty('--tilt', `${angle}deg`);
  $('scene').style.setProperty('--left-tilt', `${-offset}px`); $('scene').style.setProperty('--right-tilt', `${offset}px`);
}
function layoutSeesaw() {
  const scene = $('scene'), spriteHeight = scene.clientWidth * 0.94 * (941 / 1672);
  const deckY = scene.clientHeight - 23 - spriteHeight * ((791 - 470) / 941);
  scene.style.setProperty('--deck-y', `${deckY}px`);
  $('seesawAssembly').style.top = `${deckY - spriteHeight * (470 / 941)}px`;
  if (!dirty && game.history.length && !busy) tilt(game.history.at(-1).result);
}
function render() { renderPeople(); renderControls(); renderJournal(); }

function selectPerson(id) {
  if (busy || game.phase !== 'arranging') return;
  selected = selected === id ? null : id;
  renderPeople();
  if (selected) announce(`${personById[id].name} selected. Use left, right, or ground to move.`);
}
function place(id, position) {
  if (busy || game.phase !== 'arranging' || !id) return;
  if (game.positions[id] === position) { selected = null; renderPeople(); return; }
  game = movePerson(game, id, position); selected = null; dirty = true;
  neutralize();
  showBanner(`Arrange weighing ${game.history.length + 1}`, game.history.length === 2 ? 'The next weighing will break the seesaw.' : 'Equal numbers. Different answers.');
  audio.unlock().then(() => audio.move());
  announce(`${personById[id].name} moved to the ${zones[position]}.`);
  renderPeople(); renderControls();
}

async function useSeesaw() {
  if (busy || game.phase !== 'arranging') return;
  const error = validatePositions(game.positions);
  if (error) { toast(error); return; }
  const token = generation;
  const next = weigh(game, tieChoice()); // Immutable snapshot: each use commits exactly one outcome.
  busy = true; selected = null; presentation = 0; dirty = false; cleanupDrag();
  neutralize(); renderPeople(); renderControls();
  showBanner('The wood begins to creak…', `Weighing ${next.history.length} of 3`, '⋮');
  audio.unlock().then(() => { if (token === generation) audio.creak(next.history.length); });
  await delay(reducedMotion.matches ? 250 : 1050);
  if (token !== generation) return;
  game = next; presentation = 1;
  const entry = game.history.at(-1);
  render(); tilt(entry.result);
  showBanner(OUTCOME_LABELS[entry.result], `${entry.before} → ${entry.after} possible truths`, entry.result === '-' ? '—' : entry.result === 'L' ? '↙' : '↘');
  audio.reveal(entry.result);
  announce(`Weighing ${entry.round}: ${OUTCOME_LABELS[entry.result]}. ${entry.after} possible truths remain. ${3 - entry.round} uses left.`);
  await delay(reducedMotion.matches ? 350 : 1100);
  if (token !== generation) return;
  if (game.history.length === 3) {
    $('scene').classList.add('is-broken');
    audio.break();
    showBanner('The seesaw is broken.', game.truths.length === 1 ? 'One truth survived. Name the impostor.' : `${game.truths.length} truths survived. Certainty did not.`, '⨯');
    await delay(reducedMotion.matches ? 200 : 850);
    if (token !== generation) return;
  }
  busy = false; presentation = 0; renderPeople(); renderControls();
  if (game.phase === 'lost') showResult();
  else if (game.phase === 'accusing') { $('accusationForm').reset(); openDialog($('accuseDialog')); }
  else $('weighButton').focus({ preventScroll: true });
}

function showResult() {
  const won = game.phase === 'won', ambiguous = game.truths.length > 1;
  $('resultKicker').textContent = won ? 'CASE CLOSED / LOGIC PREVAILS' : 'INVESTIGATION FAILED';
  $('resultSymbol').textContent = won ? '✦' : '⨯';
  $('resultTitle').textContent = won ? 'The truth holds.' : ambiguous ? 'The island keeps its secret.' : 'The evidence says otherwise.';
  const truth = game.truths[0];
  $('resultDescription').textContent = won ? `${personById[truth.id].name} is the impostor, and is ${truth.kind === 'heavy' ? 'heavier' : 'lighter'}. Three weighings. One unavoidable conclusion.` : ambiguous ? `The seesaw is gone, and ${game.truths.length} truths still explain every weighing. There is no single impostor to reveal. Every possibility below is consistent with your evidence.` : `Your deduction does not match the evidence. ${personById[truth.id].name} is the only possible impostor, and is ${truth.kind === 'heavy' ? 'heavier' : 'lighter'}.`;
  const trace = game.history.map(entry => `<span title="${OUTCOME_LABELS[entry.result]}">${entry.result === '-' ? '–' : entry.result}</span>`).join('');
  const truths = game.truths.map(t => `<span class="truth-item ${t.kind}">${t.id} · ${personById[t.id].name} ${t.kind === 'heavy' ? '↑ heavier' : '↓ lighter'}</span>`).join('');
  $('resultEvidence').innerHTML = `<div class="result-trace" aria-label="Your three outcomes">${trace}</div>${truths}`;
  audio.finish(won); openDialog($('resultDialog'));
  announce(won ? `Victory. ${personById[truth.id].name}, ${truth.kind === 'heavy' ? 'heavier' : 'lighter'}, proved.` : 'Investigation failed. Review your evidence or start again.');
}

function restart() {
  generation++; cancelDelays(); cleanupDrag(); audio.reset();
  clearTimeout(toastTimer); $('toast').hidden = true;
  for (const dialog of dialogs) if (dialog.open) dialog.close();
  game = createGame(); selected = null; busy = false; dirty = true; presentation = 0;
  $('scene').classList.remove('is-broken', 'is-weighing'); neutralize();
  $('accusationForm').reset();
  showBanner('Arrange your first weighing', 'Equal numbers. Different answers.');
  render(); layoutSeesaw();
  announce('New investigation. All 24 truths are possible. Three uses remain.');
  document.querySelector('.doll[data-person="A"]')?.focus({ preventScroll: true });
}

function cleanupDrag() {
  if (drag?.active) suppressClickUntil = performance.now() + 450;
  drag?.ghost?.remove(); drag?.source?.classList.remove('drag-source'); drag = null;
  document.body.classList.remove('is-dragging');
  document.querySelectorAll('.drop-hover').forEach(zone => zone.classList.remove('drop-hover'));
}
document.addEventListener('pointerdown', event => {
  const target = event.target.closest('.doll[data-person]');
  if (!target || busy || game.phase !== 'arranging' || event.button !== 0 || !event.isPrimary) return;
  cleanupDrag();
  drag = { id: target.dataset.person, x: event.clientX, y: event.clientY, pointerId: event.pointerId, source: target, active: false, ghost: null };
  // Pointer capture keeps a touch release reliable when the pointer leaves the original doll.
  try { target.setPointerCapture(event.pointerId); } catch {}
  audio.unlock();
});
document.addEventListener('pointermove', event => {
  if (!drag || drag.pointerId !== event.pointerId) return;
  if (!drag.active && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 7) return;
  if (!drag.active) {
    drag.active = true; drag.ghost = drag.source.cloneNode(true);
    drag.ghost.removeAttribute('data-person'); drag.ghost.removeAttribute('aria-pressed'); drag.ghost.setAttribute('aria-hidden', 'true'); drag.ghost.tabIndex = -1;
    drag.ghost.classList.add('drag-ghost'); document.body.append(drag.ghost);
    drag.source.classList.add('drag-source'); document.body.classList.add('is-dragging');
  }
  event.preventDefault();
  drag.ghost.style.left = `${event.clientX}px`; drag.ghost.style.top = `${event.clientY}px`;
  const hover = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-zone]');
  document.querySelectorAll('[data-zone]').forEach(zone => zone.classList.toggle('drop-hover', zone === hover));
  // Allow dragging between the shore and platforms on short mobile screens.
  if (event.clientY < 70) window.scrollBy(0, -12);
  else if (event.clientY > window.innerHeight - 70) window.scrollBy(0, 12);
}, { passive: false });
document.addEventListener('pointerup', event => {
  if (!drag || drag.pointerId !== event.pointerId) return;
  const current = drag;
  if (current.active) {
    const zone = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-zone]')?.dataset.zone;
    cleanupDrag();
    if (zone) place(current.id, zone);
    else announce('Drop cancelled. The islander stayed in place.');
  } else cleanupDrag();
});
document.addEventListener('pointercancel', cleanupDrag);
window.addEventListener('blur', cleanupDrag);

document.addEventListener('click', event => {
  if (performance.now() < suppressClickUntil && (event.target.closest('.doll') || event.target.closest('[data-zone]'))) { event.preventDefault(); return; }
  const dollButton = event.target.closest('.doll[data-person]');
  if (dollButton) { selectPerson(dollButton.dataset.person); return; }
  const recall = event.target.closest('[data-recall]');
  if (recall) { place(recall.dataset.recall, '-'); return; }
  const move = event.target.closest('[data-move]');
  if (move) { place(selected, move.dataset.move); return; }
  const platform = event.target.closest('.platform');
  if (platform && selected) { place(selected, platform.dataset.zone); return; }
  if (platform && !busy && game.phase === 'arranging') toast('Select an islander first, or drag one onto this platform.');
  if (event.target.closest('.close-dialog')) event.target.closest('dialog')?.close();
});
document.addEventListener('keydown', event => {
  if (dialogs.some(dialog => dialog.open) || event.altKey || event.ctrlKey || event.metaKey) return;
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return;
  if (event.key === 'Escape') { cleanupDrag(); selected = null; renderPeople(); return; }
  if (selected && ['ArrowLeft', 'ArrowRight', 'ArrowDown'].includes(event.key)) {
    event.preventDefault(); const id = selected;
    place(id, { ArrowLeft: 'L', ArrowRight: 'R', ArrowDown: '-' }[event.key]);
    document.querySelector(`.doll[data-person="${id}"]`)?.focus({ preventScroll: true });
  } else if (event.key.toLowerCase() === 'w' && !event.repeat) { event.preventDefault(); useSeesaw(); }
});

$('weighButton').addEventListener('click', useSeesaw);
$('clearButton').addEventListener('click', () => {
  if (busy || game.phase !== 'arranging') return;
  game = { ...game, positions: emptyPositions() }; dirty = true; selected = null; neutralize();
  showBanner(`Arrange weighing ${game.history.length + 1}`, 'Equal numbers. Different answers.');
  renderPeople(); renderControls(); announce('All islanders returned to the ground.');
});
$('deselectButton').addEventListener('click', () => { selected = null; renderPeople(); });
$('guideButton').addEventListener('click', () => openDialog($('guideDialog')));
document.querySelector('.close-guide').addEventListener('click', () => $('guideDialog').close());
$('soundButton').addEventListener('click', async () => { await audio.setEnabled(!audio.enabled); updateSoundControl(); savePreferences(); if (!audio.enabled && !window.AudioContext && !window.webkitAudioContext) toast('Sound is unavailable in this browser.'); });
$('assistToggle').addEventListener('change', () => { renderPeople(); savePreferences(); announce(`Visual hints ${$('assistToggle').checked ? 'on' : 'off'}.`); });
$('restartButton').addEventListener('click', () => {
  if (game.history.length || PEOPLE.some(p => game.positions[p.id] !== '-') || busy) openDialog($('restartDialog'));
  else restart();
});
$('confirmRestartButton').addEventListener('click', restart);
$('playAgainButton').addEventListener('click', restart);
$('accuseButton').addEventListener('click', () => { if (game.phase === 'accusing' && !busy) openDialog($('accuseDialog')); });
$('accusationForm').addEventListener('submit', event => {
  event.preventDefault();
  if (game.phase !== 'accusing' || busy || !$('accusationForm').reportValidity()) return;
  const data = new FormData($('accusationForm'));
  game = accuse(game, $('suspectSelect').value, data.get('kind'));
  renderControls(); showResult();
});
document.addEventListener('visibilitychange', () => { cleanupDrag(); audio.visibility(); });

const table = $('referenceTable');
table.querySelector('thead').innerHTML = `<tr><th scope="col">Round</th>${PEOPLE.map(p => `<th scope="col" title="${p.name}">${p.id}</th>`).join('')}</tr>`;
table.querySelector('tbody').innerHTML = REFERENCE.map((row, i) => `<tr><th scope="row">${i + 1}</th>${[...row].map(side => `<td data-side="${side}">${side === '-' ? '–' : side}</td>`).join('')}</tr>`).join('');
for (const person of PEOPLE) { const option = document.createElement('option'); option.value = person.id; option.textContent = `${person.id} · ${person.name}`; $('suspectSelect').append(option); }
if ('ResizeObserver' in window) new ResizeObserver(layoutSeesaw).observe($('scene'));
else window.addEventListener('resize', layoutSeesaw);
updateSoundControl(); render(); layoutSeesaw();
