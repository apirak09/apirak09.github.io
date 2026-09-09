(function () {
  'use strict';
  const { Flight, DIFFICULTIES, MEDALS, NIGHTMARE, WIDTH, HEIGHT, FLOOR, BIRD_X, PIPE_WIDTH, safeSave, clamp } = window.FlappyCore;
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) { $('menuTitle').textContent = 'Canvas unavailable'; $('playButton').disabled = true; return; }
  const SAVE_KEY = 'flappy-bird-sky-club-v1';
  let canSave = true, rawSave = null;
  try { rawSave = localStorage.getItem(SAVE_KEY); } catch (_) { canSave = false; }
  const reducedQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const settings = safeSave(rawSave, !!reducedQuery?.matches);
  const audio = new window.FlightAudio(settings), flight = new Flight(settings.difficulty);
  const birdImage = new Image(); birdImage.src = 'assets/bird.png';
  const batImage = new Image(); batImage.src = 'assets/bat.png';
  let screen = 'menu', lastTime = null, animationTime = 0, deadTime = 0, deathY = 0, deathV = 0;
  let resumeTime = 0, lastCount = 0, shake = 0, flash = 0, wing = 0, scoreTime = 0;
  let particles = [], trail = [], lastTrail = 0, milestoneTimer = 0, noticeTimer = 0, openDialog = null, dialogOpener = null;
  let newRecord = false, recordBeforeRun = 0, inputTime = -Infinity;
  let pixelRatio = 1;

  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(settings)); canSave = true; } catch (_) { canSave = false; }
    $('saveNote').textContent = canSave ? 'Best scores saved on this device' : 'Scores saved for this session only';
  }
  function announce(message) { $('announcer').textContent = message; }
  function notice(message) {
    $('notice').textContent = message; $('notice').hidden = false;
    clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { $('notice').hidden = true; }, 3500);
  }
  function syncSettings() {
    document.documentElement.classList.toggle('reduced-motion', settings.reducedMotion);
    $('effectsSetting').checked = settings.effects; $('musicSetting').checked = settings.music;
    $('motionSetting').checked = settings.reducedMotion; $('volumeSetting').value = Math.round(settings.volume * 100);
    $('volumeValue').value = `${Math.round(settings.volume * 100)}%`;
    $('soundButton').setAttribute('aria-label', settings.muted ? 'Unmute sound' : 'Mute sound');
    $('soundButton').setAttribute('aria-pressed', String(settings.muted));
    $('soundButton').title = `${settings.muted ? 'Unmute' : 'Mute'} sound (M)`;
    $('soundButton').querySelector('use').setAttribute('href', settings.muted ? '#i-muted' : '#i-sound');
    audio.update(settings);
  }
  function syncDifficulty() {
    const c = DIFFICULTIES[settings.difficulty];
    const nightmare = settings.difficulty === 'nightmare';
    document.documentElement.classList.toggle('nightmare-theme', nightmare);
    $('menuDescription').textContent = nightmare ? 'Keep your nerve. Watch the warning lines.' : 'Find your rhythm. Keep flying.';
    $('playButtonText').textContent = nightmare ? 'Enter the nightmare' : "Let's fly";
    audio.update(settings);
    document.querySelectorAll('input[name="difficulty"]').forEach(input => { input.checked = input.value === settings.difficulty; });
    $('difficultyDescription').textContent = c.description;
    $('sideDifficulty').textContent = c.name.toUpperCase(); $('footerDifficulty').textContent = c.name;
    $('sideBest').textContent = settings.best[settings.difficulty];
    $('playButton').setAttribute('aria-label', `Play ${c.name}`);
    updateMedal(0);
  }
  function updateMedal(score) {
    const next = MEDALS.find(medal => medal.score > score);
    $('nextMedalTitle').textContent = next ? (score < 5 ? 'FIRST MEDAL' : `NEXT: ${next.name.toUpperCase()}`) : 'SKY LEGEND';
    const unit = settings.difficulty === 'nightmare' ? 'point' : 'pipe';
    $('nextMedalScore').textContent = next ? `${next.score - score} ${unit}${next.score - score === 1 ? '' : 's'}` : 'Keep soaring';
    $('medalHint').textContent = score ? 'One gap at a time.' : 'Small wings. Big possibilities.';
  }
  function showScreen(next) {
    screen = next; $('stage').dataset.state = next;
    $('menuOverlay').hidden = next !== 'menu'; $('pauseOverlay').hidden = next !== 'paused'; $('resultOverlay').hidden = next !== 'result';
    $('flightHud').hidden = next === 'menu' || next === 'result';
    $('pauseButton').hidden = next !== 'playing'; $('countdown').hidden = next !== 'countdown';
    $('nightmareHud').hidden = !flight.nightmare || ['menu', 'result', 'dying'].includes(next);
    canvas.tabIndex = next === 'playing' ? 0 : -1;
    audio.setActive(next === 'playing');
  }
  function startRun() {
    if (openDialog) return;
    audio.unlock().then(() => { if (screen === 'playing') audio.effect('start'); }); clearTimeout(milestoneTimer); $('milestone').hidden = true;
    flight.reset(settings.difficulty); recordBeforeRun = settings.best[settings.difficulty]; newRecord = false;
    particles = []; trail = []; shake = 0; flash = 0; wing = 1; deadTime = 0;
    $('score').textContent = '0'; $('scorePop').classList.remove('animate');
    showScreen('playing'); flight.flap(); flight.drainEvents();
    updateMedal(0); updateNightmareHud(); canvas.focus({ preventScroll: true });
    lastTime = null; announce(`${DIFFICULTIES[settings.difficulty].name} flight started. Tap or press Space to flap.`);
  }
  function flap() {
    const now = performance.now();
    // Ignore duplicate synthesized input; still permit deliberate rapid taps.
    if (now - inputTime < 45) return; inputTime = now;
    if (screen !== 'playing' || openDialog) return;
    audio.unlock(); flight.flap();
  }
  function pause() {
    if (screen !== 'playing' && screen !== 'countdown') return;
    if (screen === 'playing') flight.pause();
    showScreen('paused'); $('resumeButton').focus({ preventScroll: true }); announce('Flight paused.');
  }
  function resume() {
    if (screen !== 'paused' || openDialog || document.hidden) return;
    audio.unlock(); resumeTime = .99; lastCount = 3;
    $('countdown').textContent = '3'; showScreen('countdown'); audio.effect('tick');
    canvas.focus({ preventScroll: true }); lastTime = null;
  }
  function toMenu() {
    flight.reset(settings.difficulty); showScreen('menu'); particles = []; trail = [];
    clearTimeout(milestoneTimer); $('milestone').hidden = true;
    syncDifficulty(); $('playButton').focus({ preventScroll: true });
  }
  function finishRun() {
    if (screen !== 'playing') return;
    settings.runs[settings.difficulty]++;
    newRecord = flight.score > recordBeforeRun;
    settings.best[settings.difficulty] = Math.max(settings.best[settings.difficulty], flight.score);
    persist(); $('sideBest').textContent = settings.best[settings.difficulty];
    deathY = flight.y; deathV = Math.max(0, flight.vy); deadTime = 0;
    showScreen('dying'); audio.effect('crash');
    if (!settings.reducedMotion) { shake = 7; flash = .1; burst(BIRD_X, flight.y, '#ffde6d', 13); }
    clearTimeout(milestoneTimer); $('milestone').hidden = true;
  }
  function showResults() {
    $('resultScore').textContent = flight.score; $('resultBest').textContent = settings.best[settings.difficulty];
    $('resultKicker').textContent = newRecord ? 'A NEW PERSONAL BEST!' : 'EVERY FLIGHT COUNTS';
    $('resultTitle').textContent = newRecord ? 'Look at you fly.' : 'One more try?';
    const earned = [...MEDALS].reverse().find(medal => flight.score >= medal.score);
    $('resultMedal').dataset.earned = String(!!earned);
    const unit = flight.nightmare ? 'point' : 'pipe';
    $('resultMedal').querySelector('span').textContent = earned ? `${earned.name} flight · ${DIFFICULTIES[settings.difficulty].name}` : `${5 - flight.score} more ${unit}${5 - flight.score === 1 ? '' : 's'} to your first medal`;
    $('resultTip').textContent = flight.reason === 'ceiling' ? 'Give your wings a rest before the ceiling.' : flight.reason === 'ground' ? 'A little tap before you fall too far.' : 'Aim for the middle. Keep your taps steady.';
    if (flight.nightmare) {
      $('resultKicker').textContent = newRecord ? 'NIGHTMARE · NEW RECORD' : `BLOOD MOON · ROUND ${flight.round}`;
      $('resultTitle').textContent = newRecord ? 'You defied the night.' : 'The night wins.';
      if (flight.reason === 'laser') $('resultTip').textContent = 'The dashed line locks first. Change height before the beam fires.';
      if (flight.reason === 'bolt') $('resultTip').textContent = 'Move into the marked open lane, then keep a steady rhythm.';
      if (flight.reason === 'pipe') $('resultTip').textContent = 'Read each gap. The distance between gates changes.';
    }
    showScreen('result'); $('retryButton').focus({ preventScroll: true });
    if (newRecord && flight.score >= 5) audio.effect('medal');
    announce(`Flight over. Score ${flight.score}. ${newRecord ? 'New personal best!' : `Best ${settings.best[settings.difficulty]}.`} Press R to fly again.`);
  }
  function handleEvents() {
    for (const event of flight.drainEvents()) {
      if (event.type === 'flap') {
        wing = 1; audio.effect('flap');
        if (!settings.reducedMotion) burst(BIRD_X - 18, flight.y + 5, '#fff7cf', 3);
      }
      if (event.type === 'score') {
        $('score').textContent = event.score; scoreTime = .2; audio.effect('score', event.score); updateMedal(event.score);
        if (event.score > settings.best[settings.difficulty]) {
          settings.best[settings.difficulty] = event.score; $('sideBest').textContent = event.score; persist();
        }
        if (!settings.reducedMotion) {
          $('scorePop').classList.remove('animate'); void $('scorePop').offsetWidth; $('scorePop').classList.add('animate');
          burst(BIRD_X + 8, flight.y, '#ffe07b', 7);
        }
        const medal = MEDALS.find(item => item.score === event.score);
        if (medal) {
          $('milestone').textContent = `${medal.name} flight!`; $('milestone').hidden = false;
          audio.effect('medal'); announce(`${medal.name} medal. ${event.score} points.`);
          clearTimeout(milestoneTimer); milestoneTimer = setTimeout(() => { $('milestone').hidden = true; }, 1900);
        }
      }
      if (event.type === 'crash') finishRun();
      if (event.type === 'phase') {
        if (event.phase === 'arrival') { banner('DEMON BATS · OPEN SKY', 1600); audio.effect('bat'); }
        if (event.phase === 'recovery') { banner('HUNT SURVIVED · GATES RETURN', 1500); audio.effect('clear'); }
        if (event.phase === 'gates') banner(`BLOOD GATES · ROUND ${event.round}`, 1300);
      }
      if (event.type === 'warning') { audio.effect('warning'); announce(event.kind === 'laser' ? 'Laser sightline locked. Change height now.' : 'Blood volley. Fly into the marked open lane.'); }
      if (event.type === 'fire') audio.effect(event.kind);
    }
    updateNightmareHud();
  }

  function banner(text, duration) {
    $('milestone').textContent = text; $('milestone').hidden = false; announce(text);
    clearTimeout(milestoneTimer); milestoneTimer = setTimeout(() => { $('milestone').hidden = true; }, duration);
  }
  function updateNightmareHud() {
    if (!flight.nightmare) return;
    const labels = { gates: `GATES · ${flight.cleared} / ${NIGHTMARE.pipesPerRound}`, arrival: 'BATS APPROACHING', recovery: 'HUNT SURVIVED',
      hunt: flight.attack ? `${flight.attack.kind === 'laser' ? 'LASER' : 'VOLLEY'} · ${flight.attack.index} / ${NIGHTMARE.attacksPerRound}` : `EVADED · ${flight.attacksCleared} / ${NIGHTMARE.attacksPerRound}` };
    const round = `BLOOD MOON · ${flight.round}`, phase = labels[flight.phase];
    if ($('roundLabel').textContent !== round) $('roundLabel').textContent = round;
    if ($('phaseLabel').textContent !== phase) $('phaseLabel').textContent = phase;
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) particles.push({ x, y, vx: Math.random() * 150 - 115, vy: Math.random() * 110 - 55, life: .25 + Math.random() * .3, size: 2 + Math.random() * 3, color });
    if (particles.length > 90) particles.splice(0, particles.length - 90);
  }
  function fitCanvas() {
    const bounds = $('stage').getBoundingClientRect();
    const width = Math.min(bounds.width - 2, bounds.height * WIDTH / HEIGHT), height = width * HEIGHT / WIDTH;
    $('arena').style.width = `${width}px`; $('arena').style.height = `${height}px`;
    $('stage').style.setProperty('--floor-size', `${height * (HEIGHT - FLOOR) / HEIGHT}px`);
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(width * pixelRatio)); canvas.height = Math.max(1, Math.round(height * pixelRatio));
  }
  function roundedRect(x, y, w, h, radius) {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function drawPipe(x, y, h, upper) {
    if (h <= 0) return;
    const gradient = ctx.createLinearGradient(x, 0, x + PIPE_WIDTH, 0);
    const colors = flight.nightmare ? ['#311a32', '#774150', '#9c5160', '#5b293e', '#341a30'] : ['#167a69', '#5dbe86', '#6fca91', '#34a47c', '#248b6b'];
    [0, .15, .35, .8, 1].forEach((stop, i) => gradient.addColorStop(stop, colors[i]));
    ctx.fillStyle = '#144c5530'; ctx.fillRect(x + 6, y + 4, PIPE_WIDTH + 3, h);
    ctx.fillStyle = gradient; ctx.fillRect(x, y, PIPE_WIDTH, h); ctx.strokeStyle = flight.nightmare ? '#d46476' : '#1b675b'; ctx.lineWidth = 2.5; ctx.strokeRect(x, y - (upper ? 3 : 0), PIPE_WIDTH, h + 3);
    ctx.fillStyle = flight.nightmare ? '#ffb4bb35' : '#e3ffb63c'; ctx.fillRect(x + 10, y, 7, h); ctx.fillStyle = '#00031c26'; ctx.fillRect(x + PIPE_WIDTH - 12, y, 5, h);
    const capY = upper ? y + h - 25 : y;
    ctx.fillStyle = gradient; roundedRect(x - 5, capY, PIPE_WIDTH + 10, 25, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = flight.nightmare ? '#ffb6af75' : '#d6fca965'; ctx.fillRect(x - 1, capY + 4, PIPE_WIDTH + 2, 4);
    ctx.fillStyle = flight.nightmare ? '#490c2855' : '#0e715337'; ctx.fillRect(x, capY + 20, PIPE_WIDTH, 3);
    if (flight.nightmare) {
      // Blood-stained metal; all marks stay inside the existing collision shape.
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, PIPE_WIDTH, h); ctx.clip();
      ctx.fillStyle = '#970d35';
      for (let i = 0; i < 4; i++) {
        const dx = x + 6 + i * 17, length = 17 + (i * 23) % 46;
        const start = upper ? Math.max(y, capY - length + 15) : y + 12;
        roundedRect(dx, start, 5 + i % 2 * 3, length, 3); ctx.fill();
      }
      ctx.strokeStyle = '#e96b7850'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 23, upper ? h - 72 : y + 78); ctx.lineTo(x + 40, upper ? h - 47 : y + 52); ctx.lineTo(x + 34, upper ? h - 31 : y + 35); ctx.stroke(); ctx.restore();
    }
  }
  function drawNightmareEncounter() {
    if (!flight.nightmare) return;
    const a = flight.attack;
    const showBat = flight.phase !== 'gates';
    if (a) {
      ctx.save();
      if (a.kind === 'laser' && a.age < a.warning + NIGHTMARE.laserTime) {
        const warm = Math.min(1, a.age / a.warning), active = a.fired;
        ctx.fillStyle = active ? '#fd28433d' : '#fd284316'; ctx.fillRect(0, a.aimY - NIGHTMARE.laserHalfWidth, NIGHTMARE.enemyX - 10, NIGHTMARE.laserHalfWidth * 2);
        ctx.strokeStyle = active ? '#ff4266' : '#ffc0c5'; ctx.lineWidth = active ? NIGHTMARE.laserHalfWidth * 2 : 2;
        ctx.setLineDash(active ? [] : [9, 8]); ctx.shadowColor = '#ff244f'; ctx.shadowBlur = settings.reducedMotion ? 0 : active ? 18 : 5;
        ctx.beginPath(); ctx.moveTo(0, a.aimY); ctx.lineTo(NIGHTMARE.enemyX - 15, a.aimY); ctx.stroke(); ctx.setLineDash([]);
        if (active) { ctx.strokeStyle = '#fff7e9'; ctx.lineWidth = 4; ctx.stroke(); }
        else {
          ctx.shadowBlur = 0; ctx.fillStyle = '#ffd1d5'; ctx.font = '800 12px system-ui'; ctx.textAlign = 'center';
          ctx.fillText('LOCKED · CHANGE HEIGHT', 260, a.aimY - 18);
          ctx.strokeStyle = '#ff7792'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(NIGHTMARE.enemyX - 18, a.aimY, 19, -Math.PI / 2, -Math.PI / 2 + warm * Math.PI * 2); ctx.stroke();
        }
      }
      if (a.kind === 'volley') {
        const half = NIGHTMARE.corridorHalfWidth;
        ctx.fillStyle = '#ffd19912'; ctx.fillRect(0, a.safeY - half, WIDTH, half * 2);
        ctx.setLineDash([7, 9]); ctx.lineWidth = 1.5; ctx.strokeStyle = '#fcd6a982';
        for (const y of [a.safeY - half, a.safeY + half]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke(); }
        ctx.setLineDash([]); ctx.fillStyle = '#ffe2b9'; ctx.font = '800 12px system-ui'; ctx.textAlign = 'center'; ctx.fillText('OPEN LANE', 276, a.safeY + 4);
        if (!a.fired) {
          for (let y = 62; y < FLOOR - 35; y += 68) {
            if (Math.abs(y - a.safeY) < half + NIGHTMARE.boltRadius) continue;
            ctx.strokeStyle = '#fd698b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(NIGHTMARE.enemyX - 22, y, 6 + a.age / a.warning * 8, 0, Math.PI * 2); ctx.stroke();
          }
        }
      }
      ctx.restore();
    }
    for (const bolt of flight.projectiles) {
      ctx.save(); ctx.strokeStyle = '#ff326dbb'; ctx.lineWidth = 6; ctx.shadowColor = '#ff2455'; ctx.shadowBlur = settings.reducedMotion ? 0 : 13;
      ctx.beginPath(); ctx.moveTo(bolt.x, bolt.y); ctx.lineTo(bolt.x + 24, bolt.y); ctx.stroke();
      ctx.fillStyle = '#ff6683'; ctx.beginPath(); ctx.arc(bolt.x, bolt.y, bolt.radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff4db'; ctx.beginPath(); ctx.arc(bolt.x - 1, bolt.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (showBat) {
      const entrance = flight.phase === 'arrival' ? clamp(flight.phaseTime / NIGHTMARE.entryTime, 0, 1) : 1;
      const exit = flight.phase === 'recovery' ? clamp(flight.phaseTime / NIGHTMARE.recoveryTime, 0, 1) : 0;
      const x = NIGHTMARE.enemyX + 140 * ((1 - entrance) ** 2 + exit ** 2);
      const travel = a ? clamp(a.age / .65, 0, 1) : 1;
      const y = a ? a.fromY + (a.enemyY - a.fromY) * (1 - (1 - travel) ** 3) : flight.enemyY;
      ctx.save(); ctx.translate(x, y); ctx.scale(1, settings.reducedMotion ? 1 : .91 + Math.sin(flight.elapsed * 11) * .09);
      ctx.shadowColor = '#df275c'; ctx.shadowBlur = settings.reducedMotion ? 0 : 12;
      if (batImage.complete && batImage.naturalWidth) ctx.drawImage(batImage, -58, -40, 116, 80);
      else { ctx.fillStyle = '#ed4d78'; ctx.font = '48px system-ui'; ctx.textAlign = 'center'; ctx.fillText('🦇', 0, 10); }
      ctx.restore();
    }
  }
  function drawBird(y, angle, time) {
    ctx.save(); ctx.translate(BIRD_X, y); ctx.rotate(angle);
    const s = 1 + wing * .035; ctx.scale(s, 1 / s);
    if (birdImage.complete && birdImage.naturalWidth) ctx.drawImage(birdImage, -28, -28, 56, 56);
    else { ctx.font = '46px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🐤', 0, 0); }
    ctx.restore();
  }
  function render() {
    ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0); ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.save();
    if (shake > .05 && !settings.reducedMotion) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
    const ambient = screen === 'menu';
    const pipes = ambient ? [{ x: 350, center: 290 }, { x: 630, center: 340 }] : flight.pipes;
    if (ambient) ctx.globalAlpha = .55;
    for (const pipe of pipes) {
      const top = pipe.center - (pipe.gap || flight.config.gap) / 2, bottom = pipe.center + (pipe.gap || flight.config.gap) / 2;
      drawPipe(pipe.x, 0, top, true); drawPipe(pipe.x, bottom, FLOOR - bottom, false);
    }
    ctx.globalAlpha = 1;
    drawNightmareEncounter();
    if (!settings.reducedMotion) {
      for (let i = 0; i < trail.length; i++) {
        const t = trail[i]; ctx.globalAlpha = t.life * .2; ctx.fillStyle = '#fffbea'; ctx.beginPath(); ctx.arc(t.x, t.y, t.life * 5, 0, Math.PI * 2); ctx.fill();
      }
      for (const p of particles) { ctx.globalAlpha = Math.min(1, p.life * 3); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    if (screen !== 'result') {
      const y = ambient ? 275 + (settings.reducedMotion ? 0 : Math.sin(animationTime * 2.8) * 9) : screen === 'dying' ? deathY : flight.y;
      const angle = ambient ? -.08 : screen === 'dying' ? Math.min(1.4, deadTime * 4) : clamp(flight.vy / 570, -.4, 1.15);
      drawBird(y, angle, animationTime);
    }
    ctx.fillStyle = flight.nightmare ? '#662137' : '#236958'; ctx.fillRect(0, FLOOR, WIDTH, 3);
    ctx.fillStyle = flight.nightmare ? '#e96575' : '#cfefa5'; ctx.fillRect(0, FLOOR + 3, WIDTH, 5);
    ctx.fillStyle = flight.nightmare ? '#8b2b45' : '#4b9e7d'; ctx.fillRect(0, FLOOR + 8, WIDTH, 7);
    ctx.fillStyle = flight.nightmare ? '#32192a' : '#eacb93'; ctx.fillRect(0, FLOOR + 15, WIDTH, HEIGHT - FLOOR - 15);
    ctx.fillStyle = flight.nightmare ? '#4c2537' : '#dcb77e';
    const offset = (ambient ? (settings.reducedMotion ? 0 : animationTime * 24) : flight.distance) % 28;
    for (let x = -28 - offset; x < WIDTH; x += 28) {
      ctx.beginPath(); ctx.moveTo(x, FLOOR + 16); ctx.lineTo(x + 12, FLOOR + 16); ctx.lineTo(x - 6, HEIGHT); ctx.lineTo(x - 18, HEIGHT); ctx.closePath(); ctx.fill();
    }
    if (flash > 0 && !settings.reducedMotion) { ctx.fillStyle = `rgba(255,255,255,${flash * 2})`; ctx.fillRect(0, 0, WIDTH, HEIGHT); }
    ctx.restore();
  }
  function frame(timestamp) {
    const dt = lastTime === null ? 0 : Math.min((timestamp - lastTime) / 1000, .05); lastTime = timestamp;
    if (!document.hidden) {
      animationTime += dt;
      if (screen === 'playing') { flight.step(dt); handleEvents(); }
      if (screen === 'countdown') {
        resumeTime -= dt; const count = Math.max(1, Math.ceil(resumeTime * 3));
        if (count !== lastCount) { lastCount = count; $('countdown').textContent = count; audio.effect('tick'); }
        if (resumeTime <= 0) { flight.resume(); showScreen('playing'); announce('Keep flying.'); }
      }
      if (screen === 'dying') { deadTime += dt; deathV += 1600 * dt; deathY = Math.min(FLOOR - 20, deathY + deathV * dt); if (deadTime >= .6) showResults(); }
      if (screen !== 'paused' && screen !== 'countdown' && !openDialog) {
        wing = Math.max(0, wing - dt * 5); shake *= Math.exp(-dt * 14); flash = Math.max(0, flash - dt); scoreTime = Math.max(0, scoreTime - dt);
        for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 90 * dt; p.life -= dt; }
        particles = particles.filter(p => p.life > 0);
        for (const t of trail) { t.x -= flight.config.speed * dt; t.life -= dt * 2.5; }
        trail = trail.filter(t => t.life > 0);
        if (screen === 'playing' && !settings.reducedMotion && animationTime - lastTrail > .04) { trail.push({ x: BIRD_X - 18, y: flight.y + 3, life: .8 }); lastTrail = animationTime; }
      }
      render();
    }
    requestAnimationFrame(frame);
  }

  async function toggleSound() {
    settings.muted = !settings.muted; await audio.unlock(); syncSettings(); persist(); if (!settings.muted) audio.effect('select');
  }
  function showDialog(dialog, opener) {
    if (openDialog) return; if (screen === 'playing' || screen === 'countdown') pause();
    dialogOpener = opener; openDialog = dialog;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else { dialog.setAttribute('open', ''); dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.classList.add('dialog-fallback'); }
    $('app').inert = true; dialog.querySelector('button').focus();
  }
  function closeDialog() {
    if (!openDialog) return;
    const dialog = openDialog; openDialog = null;
    if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
    $('app').inert = false; dialogOpener?.focus({ preventScroll: true });
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else notice('Use your browser menu to add this game to your Home Screen.');
    } catch (_) { notice('Fullscreen is unavailable in this browser. You can keep playing here.'); }
  }

  $('playButton').addEventListener('click', startRun); $('retryButton').addEventListener('click', startRun);
  $('resumeButton').addEventListener('click', resume); $('pauseButton').addEventListener('click', pause);
  $('pauseMenuButton').addEventListener('click', toMenu); $('resultMenuButton').addEventListener('click', toMenu);
  $('soundButton').addEventListener('click', toggleSound); $('fullscreenButton').addEventListener('click', fullscreen);
  $('settingsButton').addEventListener('click', () => showDialog($('settingsDialog'), $('settingsButton')));
  $('helpButton').addEventListener('click', () => showDialog($('helpDialog'), $('helpButton')));
  document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', closeDialog));
  for (const id of ['settingsDialog', 'helpDialog']) {
    $(id).addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
    $(id).addEventListener('click', event => { if (event.target === $(id)) { const r = $(id).getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeDialog(); } });
  }
  document.querySelectorAll('input[name="difficulty"]').forEach(input => input.addEventListener('change', () => {
    if (screen !== 'menu') return; settings.difficulty = input.value; flight.reset(settings.difficulty); syncDifficulty(); persist(); audio.unlock().then(() => audio.effect('select'));
  }));
  for (const [id, key] of [['effectsSetting', 'effects'], ['musicSetting', 'music'], ['motionSetting', 'reducedMotion']]) {
    $(id).addEventListener('change', () => { settings[key] = $(id).checked; audio.unlock(); syncSettings(); persist(); if (key === 'effects' && settings.effects) audio.effect('select'); });
  }
  $('volumeSetting').addEventListener('input', () => { settings.volume = Number($('volumeSetting').value) / 100; syncSettings(); persist(); });
  $('volumeSetting').addEventListener('change', () => { audio.unlock().then(() => audio.effect('score')); });
  const pointerFlap = event => {
    if (event.target.closest('button, a, input, .overlay') || screen !== 'playing' || openDialog) return;
    if (event.button !== undefined && event.button !== 0) return;
    if (event.isPrimary === false) return;
    if (event.cancelable) event.preventDefault(); flap(); canvas.focus({ preventScroll: true });
  };
  if (window.PointerEvent) $('stage').addEventListener('pointerdown', pointerFlap);
  else { $('stage').addEventListener('touchstart', pointerFlap, { passive: false }); $('stage').addEventListener('mousedown', pointerFlap); }
  document.addEventListener('keydown', event => {
    if (openDialog) {
      if (event.key === 'Escape') { event.preventDefault(); closeDialog(); }
      if (event.key === 'Tab') {
        const all = [...openDialog.querySelectorAll('button, input, a[href], [tabindex="0"]')].filter(el => !el.disabled);
        if (event.shiftKey && document.activeElement === all[0]) { event.preventDefault(); all.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement === all.at(-1)) { event.preventDefault(); all[0].focus(); }
      }
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || event.target.isContentEditable) return;
    const key = event.key.toLowerCase(), form = /input|textarea|select/i.test(event.target.tagName);
    if (form) return;
    if (event.repeat && [' ', 'arrowup', 'p', 'r', 'm', 'f', 'escape'].includes(key)) { event.preventDefault(); return; }
    if (key === 'm') { event.preventDefault(); toggleSound(); }
    else if (key === 'f') { event.preventDefault(); fullscreen(); }
    else if (key === 'p' || key === 'escape') { event.preventDefault(); if (screen === 'paused') resume(); else pause(); }
    else if (key === 'r' && screen === 'result') { event.preventDefault(); startRun(); }
    else if (key === ' ' || key === 'arrowup') {
      // Space on a focused button keeps native button activation.
      if (key === ' ' && event.target.closest('button, a')) return;
      event.preventDefault();
      if (screen === 'menu' || screen === 'result') startRun(); else if (screen === 'paused') resume(); else if (screen === 'playing') flap();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pause(); audio.suspend(); persist(); } lastTime = null;
  });
  window.addEventListener('blur', () => { pause(); audio.setActive(false); });
  window.addEventListener('pagehide', () => { pause(); audio.suspend(); persist(); });
  window.addEventListener('resize', () => { fitCanvas(); });
  window.addEventListener('orientationchange', () => { pause(); });
  if (window.ResizeObserver) new ResizeObserver(fitCanvas).observe($('stage'));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fitCanvas);
  document.addEventListener('fullscreenchange', () => {
    $('fullscreenButton').setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'); fitCanvas();
  });
  syncSettings(); syncDifficulty(); showScreen('menu'); fitCanvas(); persist(); requestAnimationFrame(frame);
  // Scope offline caching to this game, leaving other games on the domain alone.
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
})();
