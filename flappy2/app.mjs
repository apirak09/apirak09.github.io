import { Flight, MODES, SINS, H, validateSave, clamp } from './engine.mjs';
import { Renderer } from './renderer.mjs';
import { FlightAudio } from './audio.mjs';
const $ = id => document.getElementById(id), root = document.documentElement;
const SAVE_KEY = 'apirak-flappy2-v1';
let save, persistent = true;
try { save = validateSave(localStorage.getItem(SAVE_KEY), matchMedia('(prefers-reduced-motion: reduce)').matches); }
catch { save = validateSave(null, matchMedia('(prefers-reduced-motion: reduce)').matches); persistent = false; }
let screen = 'menu', renderer, flight, lastFrame = 0, hudAt = 0, countdown = 0, countMark = 0, deathAt = 0, counted = false, initialBest = 0, cueUntil = 0, toastUntil = 0, lastFocus = null;
const audio = new FlightAudio();
const facts = {
  moon: { fact: '0.16 G', title: 'A softer fall.<br>A longer flight.', description: 'Drift over lunar ridges beneath an Earth-lit sky.', action: 'Launch on the Moon', tip: 'Low gravity carries every flap farther. Leave room above.' },
  nightmare: { fact: 'ENDLESS ESCALATION', title: 'The dark has wings.<br>So do you.', description: 'Six blood gates. Then the bats come. Every point feeds the nightmare.', action: 'Enter the Nightmare', tip: 'Clear six gates. Then dodge the bats’ sightlines and volleys.' },
  hell: { fact: 'SEVEN SINS', title: 'Every sin is different.<br>Every second is harder.', description: 'Random encounters. Rising pressure. Survive long enough, and the sins unite.', action: 'Descend into Hell', tip: 'Read each warning. The sins arrive randomly; attacks overlap after 45 seconds.' }
};
function persist() {
  if (!persistent) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }
  catch { persistent = false; storageStatus(); }
}
function storageStatus() {
  $('saveNotice').textContent = persistent ? 'Records saved on this device' : 'Records kept for this visit';
  $('storageNote').textContent = persistent ? 'Your records and preferences stay on this device.' : 'Browser storage is unavailable. Your records and preferences last for this visit.';
}
function announce(message) { $('announcer').textContent = message; }
function toast(message, seconds = 3.5) { $('toast').textContent = message; $('toast').hidden = false; toastUntil = performance.now() + seconds * 1000; }
function setScreen(value) {
  screen = value; root.dataset.screen = value;
  $('menu').hidden = value !== 'menu'; $('menuFooter').hidden = value !== 'menu';
  $('hud').hidden = value === 'menu'; $('ready').hidden = value !== 'ready';
  $('pausePanel').hidden = value !== 'paused'; $('results').hidden = value !== 'dead';
  $('pause').hidden = value !== 'playing';
  $('world').tabIndex = value === 'menu' || value === 'dead' || value === 'paused' ? -1 : 0;
  $('world').setAttribute('aria-hidden', ['dead', 'paused', 'menu'].includes(value) ? 'true' : 'false');
  $('menu').inert = value !== 'menu';
  $('topbar').inert = ['dead', 'paused'].includes(value);
}
function updateBests() { for (const mode of Object.keys(MODES)) $(`best-${mode}`).textContent = save.records[mode].best; }
function selectMode(mode, focus = false) {
  if (!(mode in MODES)) return;
  save.mode = mode; root.dataset.mode = mode; audio.mode = mode;
  if (renderer) renderer.particles = [];
  flight = new Flight(mode, renderer?.width || 1200);
  const fact = facts[mode]; $('worldFact').textContent = fact.fact; $('worldNote').innerHTML = fact.title; $('worldDetail').textContent = fact.description;
  $('launchText').textContent = fact.action; $('readyTip').textContent = fact.tip;
  for (const choice of document.querySelectorAll('[data-choice]')) { const selected = choice.dataset.choice === mode; choice.setAttribute('aria-checked', String(selected)); choice.tabIndex = selected ? 0 : -1; if (selected && focus) choice.focus(); }
  $('world').setAttribute('aria-label', `${MODES[mode].name} playfield. Space or Up Arrow to flap. P to pause.`);
  updateBests(); persist();
}
function applySettings() {
  audio.apply(save.settings); if (renderer) { renderer.motion = save.settings.motion; if (renderer.motion) { renderer.particles = []; renderer.shake = 0; renderer.flash = 0; } }
  root.dataset.motion = save.settings.motion ? 'reduce' : 'full';
  $('sound').setAttribute('aria-label', save.settings.sound ? 'Mute sound' : 'Enable sound'); $('sound').setAttribute('aria-pressed', String(save.settings.sound));
  $('soundIcon').setAttribute('href', save.settings.sound ? '#i-sound' : '#i-muted');
  $('soundSetting').checked = save.settings.sound; $('musicSetting').checked = save.settings.music; $('motionSetting').checked = save.settings.motion;
  $('volume').value = Math.round(save.settings.volume * 100); $('volumeOutput').value = `${$('volume').value}%`; $('quality').value = save.settings.quality;
}
function updateRecord() {
  if (!counted) return;
  const r = save.records[flight.mode]; r.best = Math.max(r.best, flight.score); r.time = Math.max(r.time, flight.elapsed); persist();
}
function prepare() {
  updateRecord();
  countdown = 0; $('countdown').hidden = true; cueUntil = 0; $('danger').hidden = true;
  initialBest = save.records[save.mode].best; counted = false;
  flight = new Flight(save.mode, renderer.width); renderer.particles = []; renderer.flash = 0; renderer.shake = 0;
  setScreen('ready'); updateHUD(); $('world').focus({ preventScroll: true }); audio.unlock(); announce(`${MODES[save.mode].name}. Tap or press Space to begin.`);
}
function showMenu() {
  updateRecord(); countdown = 0; $('countdown').hidden = true; $('danger').hidden = true; setScreen('menu');
  selectMode(save.mode); $('launch').focus({ preventScroll: true });
}
function flap() {
  if (countdown > 0 || document.querySelector('dialog[open]')) return;
  if (screen === 'ready') { setScreen('playing'); counted = true; save.records[flight.mode].runs++; persist(); }
  if (screen === 'playing') { audio.unlock(); flight.flap(); }
}
function pauseFlight(reason = 'Your flight is right where you left it.') {
  if (countdown > 0) { countdown = 0; $('countdown').hidden = true; $('pausePanel').hidden = false; $('resume').focus({ preventScroll: true }); }
  if (screen === 'playing') {
    flight.pause(); updateRecord(); setScreen('paused'); $('pauseReason').textContent = reason; $('resume').focus({ preventScroll: true }); announce('Flight paused.');
  }
}
function resumeFlight() {
  if (screen !== 'paused' || countdown > 0 || document.querySelector('dialog[open]')) return;
  $('pausePanel').hidden = true; $('countdown').hidden = false; countdown = save.settings.motion ? .85 : 2.4; countMark = Math.ceil(countdown);
  $('countdown').textContent = save.settings.motion ? 'Ready' : countMark; $('world').focus({ preventScroll: true }); audio.unlock(); audio.effect('tick');
}
const crashMessages = {
  ground: 'You met the ground. Flap a little sooner.', ceiling: 'You ran out of sky. Wait longer before the next flap.', gate: 'The opening was just out of reach. Aim for its center.',
  laser: 'The dashed sightline was a warning. Move clear before it turns solid.', bolt: 'Follow the marked open corridor through the volley.'
};
function finishRun() {
  deathAt = performance.now(); updateRecord(); updateBests(); setScreen('dead'); $('danger').hidden = true;
  const r = save.records[flight.mode], record = flight.score > initialBest;
  $('resultTitle').textContent = flight.mode === 'moon' ? 'Back to moon dust.' : flight.mode === 'nightmare' ? 'The dark caught up.' : 'Hell wants a rematch.';
  $('recordMessage').textContent = record ? 'A NEW PERSONAL BEST.' : 'There is always another flight.'; $('recordMessage').classList.toggle('new', record);
  $('finalScore').textContent = flight.score; $('finalBest').textContent = r.best; $('finalTime').textContent = formatTime(flight.elapsed);
  $('thirdStatName').textContent = flight.mode === 'hell' ? 'Gold' : 'Flights'; $('thirdStat').textContent = flight.mode === 'hell' ? flight.coins : r.runs;
  $('crashTip').textContent = SINS[flight.reason]?.hint || crashMessages[flight.reason] || facts[flight.mode].tip;
  $('retry').disabled = true; $('resultMenu').focus({ preventScroll: true });
  announce(`${MODES[flight.mode].name} flight ended. ${flight.score} points. ${record ? 'New personal best.' : `Best ${r.best}.`}`);
}
function formatTime(seconds) { const whole = Math.floor(seconds); return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`; }
function updateHUD() {
  $('score').textContent = flight.score; $('modeLabel').textContent = MODES[flight.mode].name.toUpperCase();
  $('runTime').textContent = formatTime(flight.elapsed); $('flightBest').textContent = `BEST ${Math.max(save.records[flight.mode].best, flight.score)}`;
  const ratio = flight.speed / MODES[flight.mode].speed;
  if (flight.mode === 'moon') { $('phaseLabel').textContent = 'LOW GRAVITY'; $('pressureLabel').textContent = `${ratio.toFixed(1)}× FLIGHT SPEED`; }
  else if (flight.mode === 'nightmare') {
    const passed = flight.spawned - flight.gates.filter(e => !e.scored).length;
    $('phaseLabel').textContent = flight.phase === 'gates' ? `BLOOD GATES · ${passed} / 6` : flight.phase === 'arrival' ? 'THE SWARM APPROACHES' : flight.phase === 'swarm' ? `BAT SWARM · ${flight.wave} / ${flight.waveTarget}` : 'A MOMENT TO BREATHE';
    $('pressureLabel').textContent = `${ratio.toFixed(1)}× SPEED · ${flight.threat.bats} ${flight.threat.bats === 1 ? 'BAT' : 'BATS'} · ROUND ${flight.round}`;
  } else {
    $('phaseLabel').textContent = flight.heavy ? 'HEAVY AIR · TAP SOONER' : `PRESSURE ${flight.threat.level}`;
    $('pressureLabel').textContent = `${ratio.toFixed(1)}× SPEED${flight.elapsed >= 45 ? ' · SINS CAN OVERLAP' : ' · OVERLAP AT 00:45'}`;
  }
}
function events() {
  for (const event of flight.drainEvents()) {
    if (event.type === 'flap') audio.effect('flap');
    if (event.type === 'score') {
      audio.effect('score'); renderer.burst(flight.birdX + 8, flight.y, MODES[flight.mode].color, 7);
      $('scoreAdd').textContent = `+${event.amount || 1}`; $('scoreAdd').classList.remove('pop'); void $('scoreAdd').offsetWidth; $('scoreAdd').classList.add('pop');
      updateRecord();
    }
    if (event.type === 'coin') audio.effect('coin');
    if (event.type === 'sin') {
      $('dangerName').textContent = SINS[event.sin].name.toUpperCase(); $('dangerName').style.color = SINS[event.sin].color; $('dangerHint').textContent = SINS[event.sin].title;
      $('danger').hidden = false; cueUntil = performance.now() + 2300; audio.effect('warning'); announce(`${SINS[event.sin].name}. ${SINS[event.sin].hint}`);
    }
    if (event.type === 'warning') {
      audio.effect('warning');
      if (event.kind === 'laser' || event.kind === 'volley') {
        $('dangerName').textContent = event.kind === 'laser' ? 'SIGHTLINES LOCKED' : 'FIND THE OPEN LANE'; $('dangerName').style.color = '';
        $('dangerHint').textContent = event.kind === 'laser' ? 'Leave the dashed lines before the lasers fire.' : 'Stay between the marked corridor lines.';
        $('danger').hidden = false; cueUntil = performance.now() + 1900;
      }
    }
    if (event.type === 'fire') audio.effect('fire');
    if (event.type === 'crash') { audio.effect('crash'); renderer.burst(flight.birdX, flight.y, MODES[flight.mode].color, 25); renderer.shake = save.settings.motion ? 0 : 5; renderer.flash = save.settings.motion ? 0 : 1; finishRun(); }
  }
}
function resize() {
  if (screen === 'playing') pauseFlight('Screen size changed. Resume when you are ready.');
  const rect = $('app').getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  renderer.resize(rect.width, rect.height, save.settings.quality); flight.resize(renderer.width);
}
function openDialog(id) {
  pauseFlight(); lastFocus = document.activeElement; $(id).showModal(); audio.unlock();
}
async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ($('app').requestFullscreen) await $('app').requestFullscreen();
    else { toast('This browser uses its own full-screen controls. You can also add Flappy 2 to your Home Screen.'); return; }
  } catch { toast('Fullscreen is unavailable here. The game still fills this browser window.'); }
}
function toggleSound() { save.settings.sound = !save.settings.sound; audio.unlock(); applySettings(); persist(); }
function handleKey(event) {
  if (document.querySelector('dialog[open]') || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.code === 'Tab' && ['paused', 'dead'].includes(screen)) {
    const panel = $(screen === 'paused' ? 'pausePanel' : 'results');
    const buttons = [...panel.querySelectorAll('button')].filter(b => !b.disabled);
    if (countdown > 0) { event.preventDefault(); return; }
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    return;
  }
  if (event.repeat) { if (['Space', 'ArrowUp'].includes(event.code)) event.preventDefault(); return; }
  const control = event.target.closest?.('button,input,select,textarea,a');
  if (control && ['Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) return;
  if (event.code === 'Space' || event.code === 'ArrowUp') { event.preventDefault(); if (screen === 'menu') prepare(); else if (screen === 'dead' && performance.now() - deathAt > 450) prepare(); else flap(); }
  else if (event.code === 'KeyP' || event.code === 'Escape') { event.preventDefault(); if (screen === 'playing' || countdown > 0) pauseFlight(); else if (screen === 'paused') resumeFlight(); else if (screen === 'ready') showMenu(); }
  else if (event.code === 'KeyR' && screen === 'dead' && performance.now() - deathAt > 450) prepare();
  else if (event.code === 'KeyM') toggleSound();
  else if (event.code === 'KeyF') fullscreen();
}
function frame(now) {
  const raw = lastFrame ? (now - lastFrame) / 1000 : 1 / 60; lastFrame = now;
  if (raw > .65 && screen === 'playing') pauseFlight('The flight paused while the page was away.');
  const dt = Math.min(raw, .1);
  if (countdown > 0) {
    countdown = Math.max(0, countdown - dt);
    if (!save.settings.motion && Math.ceil(countdown) !== countMark) { countMark = Math.ceil(countdown); if (countMark) { $('countdown').textContent = countMark; audio.effect('tick'); } }
    if (countdown === 0) { $('countdown').hidden = true; setScreen('playing'); flight.resume(); $('world').focus({ preventScroll: true }); announce('Flight resumed.'); }
  }
  if (screen === 'playing') { flight.step(dt); events(); }
  renderer.draw(flight, dt, screen === 'menu', screen === 'paused' || screen === 'dead' || document.hidden);
  if (now > hudAt && screen !== 'menu') { updateHUD(); hudAt = now + 100; }
  if (screen === 'dead' && $('retry').disabled && now - deathAt > 450) $('retry').disabled = false;
  if (cueUntil && now > cueUntil) { $('danger').hidden = true; cueUntil = 0; }
  if (toastUntil && now > toastUntil) { $('toast').hidden = true; toastUntil = 0; }
  audio.tick(screen === 'paused' || screen === 'dead' || document.hidden || !!document.querySelector('dialog[open]'));
  requestAnimationFrame(frame);
}
try {
  renderer = new Renderer($('world')); flight = new Flight(save.mode); selectMode(save.mode); applySettings(); storageStatus(); resize(); setScreen('menu');
  for (const choice of document.querySelectorAll('[data-choice]')) {
    choice.addEventListener('click', () => { audio.unlock(); selectMode(choice.dataset.choice); audio.effect('select'); });
    choice.addEventListener('keydown', event => { const keys = ['moon', 'nightmare', 'hell']; let index = keys.indexOf(save.mode); if (['ArrowDown', 'ArrowRight'].includes(event.key)) index = (index + 1) % 3; else if (['ArrowUp', 'ArrowLeft'].includes(event.key)) index = (index + 2) % 3; else if (event.key === 'Home') index = 0; else if (event.key === 'End') index = 2; else return; event.preventDefault(); selectMode(keys[index], true); });
  }
  $('launch').addEventListener('click', prepare); $('home').addEventListener('click', showMenu);
  $('retry').addEventListener('click', () => { if (performance.now() - deathAt > 450) prepare(); });
  $('resultMenu').addEventListener('click', showMenu); $('pauseMenu').addEventListener('click', showMenu); $('resume').addEventListener('click', resumeFlight);
  $('pause').addEventListener('click', () => screen === 'ready' ? showMenu() : pauseFlight());
  $('sound').addEventListener('click', toggleSound); $('settings').addEventListener('click', () => openDialog('settingsDialog'));
  $('help').addEventListener('click', () => openDialog('helpDialog')); $('guideLink').addEventListener('click', () => openDialog('helpDialog'));
  $('fullscreen').addEventListener('click', fullscreen); $('reload').addEventListener('click', () => location.reload());
  for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => button.closest('dialog').close());
  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.addEventListener('close', () => lastFocus?.focus({ preventScroll: true }));
    dialog.addEventListener('click', e => { if (e.target !== dialog) return; const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); });
  }
  for (const [id, key] of [['soundSetting', 'sound'], ['musicSetting', 'music'], ['motionSetting', 'motion']]) $(id).addEventListener('change', () => { save.settings[key] = $(id).checked; audio.unlock(); applySettings(); persist(); });
  $('volume').addEventListener('input', () => { save.settings.volume = Number($('volume').value) / 100; applySettings(); persist(); });
  $('quality').addEventListener('change', () => { save.settings.quality = $('quality').value; resize(); applySettings(); persist(); });
  $('world').addEventListener('pointerdown', event => { if (event.pointerType === 'mouse' && event.button !== 0) return; event.preventDefault(); if (screen === 'playing' || screen === 'ready') { $('world').focus({ preventScroll: true }); flap(); } });
  $('world').addEventListener('contextmenu', event => event.preventDefault());
  document.addEventListener('keydown', handleKey);
  window.addEventListener('resize', resize); window.visualViewport?.addEventListener('resize', resize);
  window.addEventListener('blur', () => { if (screen === 'paused' && countdown > 0) { countdown = 0; $('countdown').hidden = true; $('pausePanel').hidden = false; } pauseFlight('You left the game. Your flight is safe.'); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (countdown > 0) { countdown = 0; $('countdown').hidden = true; $('pausePanel').hidden = false; } pauseFlight('You left the game. Your flight is safe.'); updateRecord(); } lastFrame = 0; });
  window.addEventListener('pagehide', updateRecord);
  document.addEventListener('fullscreenchange', () => { $('fullscreen').setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'); resize(); });
  requestAnimationFrame(frame);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', { scope: './' }).then(reg => {
    reg.addEventListener('updatefound', () => { const worker = reg.installing; worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) toast('A new version is ready. Reopen Flappy 2 after this flight to update.'); }); });
  }).catch(() => {});
} catch (error) {
  console.error(error); $('fatal').hidden = false; $('fatalMessage').textContent = 'The game could not initialize. Reload this page in a current Safari, Chrome, Firefox, or Edge.';
  $('reload').onclick = () => location.reload();
}
