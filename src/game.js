(() => {
  'use strict';

  const {
    Engine, World, Bodies, Body, Composite, Constraint, Events, Vector, Sleeping, Query
  } = Matter;

  const W = 1280;
  const H = 720;
  const GROUND_Y = 650;
  const SLING = { x: 188, y: 526 };
  const MAX_DRAG = 138;
  const STEP = 1000 / 60;
  const SAVE_KEY = 'mini-angry-birds-reforged-save-v1';
  const LEGACY_SAVE_KEY = 'mini-angry-birds-save-v1';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const stageWrap = document.getElementById('stageWrap');
  const introCanvas = document.getElementById('introCanvas');
  const introCtx = introCanvas.getContext('2d');
  const levels = window.GAME_LEVELS || [];

  if (!levels.length) throw new Error('No levels loaded.');

  const ui = Object.fromEntries([
    'statusText', 'levelText', 'scoreText', 'birdsText', 'pigsText', 'levelName', 'levelGoal',
    'birdQueue', 'toast', 'powerWrap', 'powerFill', 'abilityBtn', 'abilityIcon', 'abilityText',
    'tutorialCard', 'tutorialStep', 'tutorialTitle', 'tutorialText', 'tutorialClose',
    'pauseOverlay', 'resultOverlay', 'levelOverlay', 'helpOverlay', 'levelGrid',
    'resultKicker', 'resultTitle', 'resultStars', 'resultScore', 'scoreBreakdown', 'resultMessage',
    'pauseBtn', 'guideBtn', 'muteBtn', 'fullscreenBtn', 'resumeBtn', 'pauseRestartBtn',
    'introOverlay', 'introSkipBtn', 'introCaption', 'introProgressFill', 'replayIntroBtn',
    'pauseLevelsBtn', 'nextBtn', 'retryBtn', 'resultLevelsBtn', 'closeLevelsBtn',
    'closeHelpBtn', 'resetSaveBtn', 'restartBtn', 'levelsBtn', 'helpBtn'
  ].map(id => [id, document.getElementById(id)]));

  const MATERIALS = {
    wood: {
      hp: 150, density: 0.00125, friction: 0.44, restitution: 0.08,
      damageScale: 1.0, breakScore: 350, name: 'ไม้'
    },
    glass: {
      hp: 68, density: 0.00078, friction: 0.1, restitution: 0.06,
      damageScale: 1.72, breakScore: 450, name: 'กระจก'
    },
    stone: {
      hp: 380, density: 0.0037, friction: 0.62, restitution: 0.02,
      damageScale: 0.37, breakScore: 700, name: 'หิน'
    },
    tnt: {
      hp: 45, density: 0.00115, friction: 0.36, restitution: 0.05,
      damageScale: 1.7, breakScore: 900, name: 'TNT'
    }
  };

  const BIRDS = {
    red: {
      name: 'แดง', queue: 'R', radius: 20, density: 0.0042, power: 1.34,
      restitution: 0.28, frictionAir: 0.006, ability: null,
      hint: 'นกแดงหนักและให้แรงกระแทกสูง เหมาะกับไม้และการผลักโครงสร้าง'
    },
    yellow: {
      name: 'เหลือง', queue: 'Y', radius: 18, density: 0.0025, power: 1.05,
      restitution: 0.22, frictionAir: 0.004, ability: 'boost', abilityLabel: 'BOOST', abilityIcon: '⚡',
      hint: 'กด Space ระหว่างบินเพื่อเร่งความเร็วตามทิศทางปัจจุบัน'
    },
    blue: {
      name: 'ฟ้า', queue: 'B', radius: 16, density: 0.00175, power: 0.72,
      restitution: 0.31, frictionAir: 0.004, ability: 'split', abilityLabel: 'SPLIT', abilityIcon: '✦',
      hint: 'กด Space เพื่อแยกร่างเป็นสามตัว เหมาะกับกระจกและเป้าหมายหลายระดับ'
    },
    bomb: {
      name: 'ระเบิด', queue: '●', radius: 22, density: 0.0048, power: 1.25,
      restitution: 0.16, frictionAir: 0.008, ability: 'explode', abilityLabel: 'DETONATE', abilityIcon: '✹',
      hint: 'กด Space เมื่ออยู่ใกล้เป้าหมายเพื่อระเบิดเป็นวงกว้าง'
    }
  };

  const BACKDROPS = {
    meadow: { skyTop: '#63c9ef', skyBottom: '#d8f4f8', far: '#8ed28a', near: '#5aa85a', ground: '#7c5837' },
    coast: { skyTop: '#58c3ea', skyBottom: '#e5f7f7', far: '#77bed1', near: '#4d94a6', ground: '#8d673f' },
    canyon: { skyTop: '#71c7ec', skyBottom: '#ffe8bc', far: '#d59d67', near: '#a96d47', ground: '#7f5334' },
    sunset: { skyTop: '#6e8ed5', skyBottom: '#ffd5a5', far: '#a87378', near: '#68566c', ground: '#654536' },
    finale: { skyTop: '#4d93cc', skyBottom: '#f5d3a2', far: '#6e8d83', near: '#49695c', ground: '#624633' }
  };

  const engine = Engine.create({ enableSleeping: false });
  engine.gravity.y = 1.05;
  engine.gravity.scale = 0.001;
  engine.positionIterations = 12;
  engine.velocityIterations = 10;
  engine.constraintIterations = 6;
  const world = engine.world;

  const state = {
    levelIndex: 0,
    mode: 'ready',
    paused: false,
    aimGuide: true,
    muted: false,
    dragging: false,
    pointerId: null,
    shotsUsed: 0,
    score: 0,
    scoreVisual: 0,
    combo: 0,
    lastDestroyAt: 0,
    levelStartAt: 0,
    shotStartedAt: 0,
    settleSince: 0,
    toastUntil: 0,
    accumulator: 0,
    lastFrame: performance.now(),
    shake: 0,
    flash: 0,
    save: loadSave(),
    scoreParts: { pigs: 0, blocks: 0, bonus: 0 },
    uiCache: Object.create(null),
    introActive: false,
    introStartedAt: 0,
    introDuration: 16600,
    introScene: -1,
    physicsArmed: false
  };

  let currentBird = null;
  let pigs = [];
  let blocks = [];
  let terrain = [];
  let fragments = [];
  let particles = [];
  let shockwaves = [];
  let floaters = [];
  let pendingRemovals = [];
  let pendingExplosions = [];
  let clouds = [];
  let audioCtx = null;
  let noiseBuffer = null;
  let dpr = 1;

  function defaultSave() {
    return { schema: 1, unlocked: 1, bestStars: {}, bestScore: {}, tutorialSeen: {}, settings: { muted: false, guide: true } };
  }

  function loadSave() {
    const base = defaultSave();
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        Object.assign(base, saved);
        base.bestStars = saved.bestStars || {};
        base.bestScore = saved.bestScore || {};
        base.tutorialSeen = saved.tutorialSeen || {};
        base.settings = { ...base.settings, ...(saved.settings || {}) };
      } else {
        const legacy = JSON.parse(localStorage.getItem(LEGACY_SAVE_KEY) || 'null');
        if (legacy && typeof legacy === 'object') {
          for (let i = 1; i <= 10; i++) {
            if (legacy.best?.[String(i)]) base.bestStars[String(i)] = legacy.best[String(i)];
            if (legacy.bestScore?.[String(i)]) base.bestScore[String(i)] = legacy.bestScore[String(i)];
          }
          const cleared = Object.keys(base.bestStars).filter(k => base.bestStars[k] > 0).length;
          base.unlocked = Math.min(10, Math.max(1, cleared + 1));
        }
      }
    } catch { /* localStorage can be unavailable */ }
    base.unlocked = clamp(Number(base.unlocked) || 1, 1, levels.length);
    return base;
  }

  function saveGame() {
    state.save.settings = { muted: state.muted, guide: state.aimGuide };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state.save)); } catch { /* ignore */ }
  }

  function resetProgress() {
    state.save = defaultSave();
    state.muted = false;
    state.aimGuide = true;
    saveGame();
    ui.helpOverlay.classList.add('hidden');
    startLevel(0);
    toast('ล้างความคืบหน้าแล้ว');
  }

  function resizeCanvas() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    introCanvas.width = Math.round(W * dpr);
    introCanvas.height = Math.round(H * dpr);
    introCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function initClouds() {
    clouds = Array.from({ length: 8 }, (_, i) => ({
      x: (i * 187 + 70) % W,
      y: 70 + (i % 4) * 55,
      scale: 0.62 + (i % 3) * 0.22,
      speed: 0.08 + (i % 4) * 0.025
    }));
  }

  function clearWorld() {
    Composite.clear(world, false, true);
    pigs = [];
    blocks = [];
    terrain = [];
    fragments = [];
    particles = [];
    shockwaves = [];
    floaters = [];
    pendingRemovals = [];
    pendingExplosions = [];
    currentBird = null;
  }

  function createBounds() {
    const ground = Bodies.rectangle(W / 2, GROUND_Y + 80, W + 400, 160, {
      isStatic: true, friction: 0.96, restitution: 0.02, label: 'ground'
    });
    ground.game = { type: 'ground' };
    const left = Bodies.rectangle(-80, H / 2, 160, H * 2, { isStatic: true, label: 'wall' });
    const right = Bodies.rectangle(W + 120, H / 2, 160, H * 2, { isStatic: true, label: 'wall' });
    left.game = right.game = { type: 'wall' };
    World.add(world, [ground, left, right]);
  }

  function createTerrain(def) {
    const body = Bodies.rectangle(def.x, def.y, def.w, def.h, {
      isStatic: true,
      angle: def.angle || 0,
      friction: 0.95,
      restitution: 0.02,
      chamfer: { radius: Math.min(8, def.h * 0.25) },
      label: 'terrain'
    });
    body.game = { type: 'terrain', def };
    terrain.push(body);
    World.add(world, body);
  }

  function createBlock(def) {
    const mat = MATERIALS[def.material] || MATERIALS.wood;
    const body = Bodies.rectangle(def.x, def.y, def.w, def.h, {
      angle: def.angle || 0,
      density: mat.density,
      friction: mat.friction,
      frictionStatic: Math.min(0.8, mat.friction + 0.08),
      restitution: mat.restitution,
      frictionAir: 0.0035,
      slop: 0.02,
      chamfer: { radius: def.material === 'stone' ? 3 : 2 },
      label: `block:${def.material}`
    });
    body.game = {
      type: 'block', material: def.material, hp: def.hp || mat.hp, maxHp: def.hp || mat.hp,
      w: def.w, h: def.h, destroyed: false, flash: 0, crackSeed: Math.random() * 1000,
      spawnX: def.x, spawnY: def.y, spawnAngle: def.angle || 0
    };
    blocks.push(body);
    World.add(world, body);
  }

  function createPig(def) {
    const body = Bodies.circle(def.x, def.y, def.r || 18, {
      density: 0.00145,
      friction: 0.42,
      frictionStatic: 0.56,
      restitution: 0.16,
      frictionAir: 0.005,
      slop: 0.02,
      label: 'pig'
    });
    body.game = {
      type: 'pig', radius: def.r || 18, hp: def.hp || 100, maxHp: def.hp || 100,
      dead: false, flash: 0, faceSeed: Math.random() * 10,
      spawnX: def.x, spawnY: def.y
    };
    pigs.push(body);
    World.add(world, body);
  }

  function createBird(type, x = SLING.x, y = SLING.y, fragment = false) {
    const spec = BIRDS[type] || BIRDS.red;
    const radius = fragment ? Math.round(spec.radius * 0.72) : spec.radius;
    const body = Bodies.circle(x, y, radius, {
      density: fragment ? spec.density * 0.74 : spec.density,
      friction: 0.38,
      restitution: spec.restitution,
      frictionAir: spec.frictionAir,
      slop: 0.01,
      label: fragment ? 'fragment' : `bird:${type}`
    });
    body.game = {
      type: fragment ? 'fragment' : 'bird', birdType: type, radius, launched: fragment,
      abilityUsed: fragment, power: fragment ? spec.power * 0.62 : spec.power,
      trail: [], trailTick: 0, bornAt: performance.now(), dead: false, boostGlow: 0
    };
    if (!fragment) Body.setStatic(body, true);
    World.add(world, body);
    return body;
  }

  function startLevel(index) {
    index = clamp(index, 0, levels.length - 1);
    if (index + 1 > state.save.unlocked) index = state.save.unlocked - 1;
    closeOverlays();
    clearWorld();
    Engine.clear(engine);
    createBounds();
    const level = levels[index];
    (level.terrain || []).forEach(createTerrain);
    level.blocks.forEach(createBlock);
    level.pigs.forEach(createPig);

    state.levelIndex = index;
    state.mode = 'ready';
    state.paused = false;
    state.dragging = false;
    state.pointerId = null;
    state.shotsUsed = 0;
    state.score = 0;
    state.scoreVisual = 0;
    state.combo = 0;
    state.levelStartAt = performance.now();
    state.shotStartedAt = 0;
    state.settleSince = 0;
    state.shake = 0;
    state.flash = 0;
    state.physicsArmed = false;
    state.scoreParts = { pigs: 0, blocks: 0, bonus: 0 };
    engine.timing.timestamp = 0;

    spawnBird();
    showTutorial(level);
    updateUI();
    renderLevelGrid();
    toast(`ด่าน ${index + 1}: ${level.name}`);
  }

  function spawnBird() {
    const level = levels[state.levelIndex];
    if (alivePigs() === 0) return finishLevel();
    if (state.shotsUsed >= level.birds.length) return failLevel();
    if (currentBird && Composite.get(world, currentBird.id, 'body')) World.remove(world, currentBird);
    currentBird = createBird(level.birds[state.shotsUsed]);
    state.mode = 'ready';
    state.settleSince = 0;
    state.uiCache = Object.create(null);
    ui.abilityBtn.classList.remove('show', 'used');
    const spec = BIRDS[currentBird.game.birdType];
    toast(spec.hint);
    updateUI();
  }

  function showTutorial(level) {
    const key = String(state.levelIndex + 1);
    if (!level.tutorial || state.save.tutorialSeen[key]) {
      ui.tutorialCard.classList.remove('show');
      return;
    }
    ui.tutorialStep.textContent = level.tutorial.step;
    ui.tutorialTitle.textContent = level.tutorial.title;
    ui.tutorialText.textContent = level.tutorial.text;
    ui.tutorialCard.classList.add('show');
  }

  function closeTutorial() {
    ui.tutorialCard.classList.remove('show');
    state.save.tutorialSeen[String(state.levelIndex + 1)] = true;
    saveGame();
  }

  function alivePigs() { return pigs.filter(p => !p.game.dead).length; }

  function birdsRemaining() {
    return Math.max(0, levels[state.levelIndex].birds.length - state.shotsUsed);
  }

  function setTextCached(key, value) {
    const textValue = String(value);
    if (state.uiCache[key] === textValue) return;
    state.uiCache[key] = textValue;
    ui[key].textContent = textValue;
  }

  function setHTMLCached(key, value) {
    if (state.uiCache[key] === value) return;
    state.uiCache[key] = value;
    ui[key].innerHTML = value;
  }

  function updateUI(force = false) {
    const level = levels[state.levelIndex];
    state.scoreVisual += (state.score - state.scoreVisual) * 0.22;
    if (Math.abs(state.score - state.scoreVisual) < 1) state.scoreVisual = state.score;
    if (force) state.uiCache = Object.create(null);

    setTextCached('levelText', `${state.levelIndex + 1} / ${levels.length}`);
    setTextCached('scoreText', Math.round(state.scoreVisual).toLocaleString('th-TH'));
    setTextCached('birdsText', birdsRemaining());
    setTextCached('pigsText', alivePigs());
    setTextCached('levelName', level.name);
    setTextCached('levelGoal', `${level.subtitle} • พาร์ ${level.par} นัด`);

    let status = 'ลากนกถอยหลังจากหนังสติ๊ก แล้วปล่อยเพื่อยิง';
    if (state.paused) status = 'หยุดชั่วคราว';
    else if (state.mode === 'aiming') status = 'ปล่อยเพื่อยิง • แถบพลังแสดงแรงยิง';
    else if (state.mode === 'flying') {
      const spec = currentBird ? BIRDS[currentBird.game.birdType] : null;
      status = spec?.ability && !currentBird.game.abilityUsed ? 'คลิกสนามหรือกด Space เพื่อใช้สกิล' : 'รอดูผลของแรงกระแทกและการถล่ม';
    } else if (state.mode === 'settling') status = 'โครงสร้างกำลังหยุดนิ่ง เตรียมนกตัวถัดไป';
    else if (state.mode === 'won') status = 'ผ่านด่านแล้ว';
    else if (state.mode === 'lost') status = 'นกหมดก่อนกำจัดหมูทั้งหมด';
    setTextCached('statusText', status);

    ui.guideBtn.classList.toggle('active', state.aimGuide);
    const muteLabel = state.muted ? '×' : '♪';
    if (state.uiCache.muteLabel !== muteLabel) {
      state.uiCache.muteLabel = muteLabel;
      ui.muteBtn.textContent = muteLabel;
    }
    renderBirdQueue();
  }

  function renderBirdQueue() {
    const queue = levels[state.levelIndex].birds;
    const html = queue.map((type, i) => {
      const classes = ['queue-bird', type];
      if (i < state.shotsUsed) classes.push('used');
      if (i === state.shotsUsed && state.mode === 'ready') classes.push('current');
      return `<div class="${classes.join(' ')}" title="${BIRDS[type].name}">${BIRDS[type].queue}</div>`;
    }).join('');
    setHTMLCached('birdQueue', html);
  }

  function renderLevelGrid() {
    ui.levelGrid.innerHTML = '';
    levels.forEach((level, i) => {
      const unlocked = i + 1 <= state.save.unlocked;
      const stars = Number(state.save.bestStars[String(i + 1)]) || 0;
      const best = Number(state.save.bestScore[String(i + 1)]) || 0;
      const btn = document.createElement('button');
      btn.className = `level-card ${i === state.levelIndex ? 'active' : ''}`;
      btn.disabled = !unlocked;
      btn.innerHTML = `
        <span class="level-number">LEVEL ${String(i + 1).padStart(2, '0')}</span>
        <b>${unlocked ? level.name : 'ล็อกอยู่'}</b>
        <span class="level-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>
        <span class="level-best">${unlocked ? (best ? `ดีที่สุด ${best.toLocaleString('th-TH')}` : level.subtitle) : 'ผ่านด่านก่อนหน้าเพื่อปลดล็อก'}</span>`;
      btn.addEventListener('click', () => startLevel(i));
      ui.levelGrid.appendChild(btn);
    });
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * W / rect.width,
      y: (event.clientY - rect.top) * H / rect.height
    };
  }

  function onPointerDown(event) {
    ensureAudio();
    if (state.paused || anyOverlayOpen()) return;
    const p = pointerPosition(event);

    if (state.mode === 'flying') {
      useAbility();
      return;
    }
    if (state.mode !== 'ready' || !currentBird) return;
    if (Vector.magnitude(Vector.sub(p, currentBird.position)) > currentBird.game.radius + 28) return;

    state.dragging = true;
    state.pointerId = event.pointerId;
    state.mode = 'aiming';
    canvas.setPointerCapture?.(event.pointerId);
    ui.powerWrap.classList.add('show');
    closeTutorial();
    sfx('grab');
    moveAim(p);
  }

  function onPointerMove(event) {
    if (!state.dragging || event.pointerId !== state.pointerId || !currentBird) return;
    moveAim(pointerPosition(event));
  }

  function moveAim(p) {
    let delta = Vector.sub(p, SLING);
    if (delta.x > 20) delta.x = 20;
    const mag = Vector.magnitude(delta);
    if (mag > MAX_DRAG) delta = Vector.mult(Vector.normalise(delta), MAX_DRAG);
    Body.setPosition(currentBird, Vector.add(SLING, delta));
    Body.setVelocity(currentBird, { x: 0, y: 0 });
    const power = clamp(Vector.magnitude(delta) / MAX_DRAG, 0, 1);
    ui.powerFill.style.width = `${Math.round(power * 100)}%`;
  }

  function armPhysicsDamage() {
    if (state.physicsArmed) return;
    state.physicsArmed = true;
    blocks.forEach(block => {
      block.game.armX = block.position.x;
      block.game.armY = block.position.y;
      block.game.armAngle = block.angle;
    });
    pigs.forEach(pig => {
      pig.game.armX = pig.position.x;
      pig.game.armY = pig.position.y;
    });
  }

  function onPointerUp(event) {
    if (!state.dragging || event.pointerId !== state.pointerId || !currentBird) return;
    state.dragging = false;
    state.pointerId = null;
    canvas.releasePointerCapture?.(event.pointerId);
    ui.powerWrap.classList.remove('show');

    if (!isFiniteBody(currentBird)) {
      if (Composite.get(world, currentBird.id, 'body')) World.remove(world, currentBird);
      currentBird = createBird(levels[state.levelIndex].birds[state.shotsUsed]);
      state.mode = 'ready';
      updateUI(true);
      return;
    }

    const pull = Vector.sub(SLING, currentBird.position);
    const power = Vector.magnitude(pull);
    if (power < 14) {
      Body.setPosition(currentBird, SLING);
      state.mode = 'ready';
      updateUI();
      return;
    }

    const launchVelocity = Vector.mult(pull, 0.178);
    armPhysicsDamage();
    Body.setStatic(currentBird, false);
    Sleeping.set(currentBird, false);
    Body.setAngle(currentBird, 0);
    Body.setAngularVelocity(currentBird, launchVelocity.x * 0.004);
    Body.setVelocity(currentBird, launchVelocity);
    currentBird.game.launched = true;
    currentBird.game.bornAt = performance.now();
    currentBird.game.trail = [];
    state.shotsUsed += 1;
    state.mode = 'flying';
    state.shotStartedAt = performance.now();
    state.settleSince = 0;
    const spec = BIRDS[currentBird.game.birdType];
    if (spec.ability) {
      ui.abilityIcon.textContent = spec.abilityIcon;
      ui.abilityText.textContent = spec.abilityLabel;
      ui.abilityBtn.classList.add('show');
    }
    sfx('launch');
    updateUI();
  }

  function useAbility() {
    if (state.mode !== 'flying' || !currentBird || currentBird.game.abilityUsed || currentBird.game.dead) return;
    const type = currentBird.game.birdType;
    const spec = BIRDS[type];
    if (!spec.ability) return;
    currentBird.game.abilityUsed = true;
    ui.abilityBtn.classList.add('used');

    if (spec.ability === 'boost') {
      const v = currentBird.velocity;
      const speed = Math.max(6, Vector.magnitude(v));
      const dir = speed > 0 ? Vector.normalise(v) : { x: 1, y: 0 };
      Body.setVelocity(currentBird, Vector.mult(dir, Math.min(32, speed * 1.72)));
      currentBird.game.power = 1.78;
      currentBird.game.boostGlow = 28;
      state.shake = Math.max(state.shake, 4);
      burst(currentBird.position.x, currentBird.position.y, 18, '#ffd844', 5, 'spark');
      sfx('boost');
    } else if (spec.ability === 'split') {
      splitBlueBird();
      sfx('split');
    } else if (spec.ability === 'explode') {
      explodeAt(currentBird.position.x, currentBird.position.y, 142, 430, currentBird);
      currentBird.game.dead = true;
      pendingRemovals.push(currentBird);
      sfx('boom');
    }
  }

  function splitBlueBird() {
    const baseV = currentBird.velocity;
    const speed = Math.max(8, Vector.magnitude(baseV));
    const angle = Math.atan2(baseV.y, baseV.x);
    [-0.22, 0.22].forEach(offset => {
      const f = createBird('blue', currentBird.position.x, currentBird.position.y, true);
      const a = angle + offset;
      Body.setVelocity(f, { x: Math.cos(a) * speed * 1.04, y: Math.sin(a) * speed * 1.04 });
      Body.setAngularVelocity(f, offset * 0.1);
      f.game.power = 0.64;
      fragments.push(f);
    });
    currentBird.game.power = 0.68;
    burst(currentBird.position.x, currentBird.position.y, 12, '#b9ecff', 3.8, 'spark');
  }

  function relativeImpact(a, b, normal) {
    const rv = Vector.sub(a.velocity, b.velocity);
    return Math.abs(Vector.dot(rv, normal || { x: 0, y: 1 }));
  }

  function collisionKind(body) { return body?.game?.type || 'other'; }

  Events.on(engine, 'collisionStart', event => {
    const now = performance.now();
    for (const pair of event.pairs) {
      const a = pair.bodyA;
      const b = pair.bodyB;
      const ka = collisionKind(a);
      const kb = collisionKind(b);
      const impact = relativeImpact(a, b, pair.collision.normal);
      if (impact < 0.7 || state.shotsUsed === 0) continue;

      handleCollisionDamage(a, b, impact, now);
      handleCollisionDamage(b, a, impact, now);

      if ((ka === 'bird' || ka === 'fragment') && impact > 4.5) markImpact(a.position.x, a.position.y);
      if ((kb === 'bird' || kb === 'fragment') && impact > 4.5) markImpact(b.position.x, b.position.y);

      if (impact > 7) {
        const hit = pair.collision.supports?.[0] || Vector.mult(Vector.add(a.position, b.position), 0.5);
        burst(hit.x, hit.y, Math.min(14, Math.floor(impact)), '#fff1c2', 2.7, 'dust');
        state.shake = Math.max(state.shake, Math.min(8, impact * 0.38));
        sfx('impact', Math.min(1, impact / 18));
      }
    }
  });

  function handleCollisionDamage(target, source, impact, now) {
    const targetType = collisionKind(target);
    const sourceType = collisionKind(source);
    if (targetType === 'block') {
      let raw = 0;
      if (sourceType === 'bird' || sourceType === 'fragment') {
        raw = Math.max(0, impact - 1.5) * 28 * (source.game.power || 1);
        if (source.game.birdType === 'blue' && target.game.material === 'glass') raw *= 1.7;
        if (source.game.birdType === 'yellow' && target.game.material === 'wood') raw *= 1.22;
        if (source.game.birdType === 'bomb' && target.game.material === 'stone') raw *= 1.32;
      } else if (sourceType === 'block') {
        const reducedMass = (target.mass * source.mass) / Math.max(0.001, target.mass + source.mass);
        raw = Math.max(0, impact - 2.2) * reducedMass * 5.2;
      } else if (sourceType === 'ground' || sourceType === 'terrain') {
        raw = Math.max(0, impact - 5.2) * target.mass * 3.6;
      }
      if (raw > 0) damageBlock(target, raw, source.position, now);
    } else if (targetType === 'pig') {
      let raw = 0;
      if (sourceType === 'bird' || sourceType === 'fragment') {
        raw = Math.max(0, impact - 1.1) * 25 * (source.game.power || 1) + (impact > 5 ? 38 : 0);
      } else if (sourceType === 'block') {
        const above = source.position.y < target.position.y + target.game.radius * 0.15;
        const downwardSpeed = Math.max(0, source.velocity.y - target.velocity.y);
        const massImpulse = Math.max(0, downwardSpeed - 0.25) * Math.max(1, source.mass);
        raw = Math.max(0, impact - 0.65) * (9 + Math.min(52, source.mass * 5.6));
        if (above && massImpulse > 2.2) raw += 28 + massImpulse * 4.8;
      } else if (sourceType === 'ground' || sourceType === 'terrain') {
        raw = Math.max(0, impact - 5.4) * 18;
      }
      if (raw > 0) damagePig(target, raw, source.position, now);
    }
  }

  function damageBlock(block, rawDamage, sourcePos, now = performance.now()) {
    if (!block || block.game.destroyed) return;
    const mat = MATERIALS[block.game.material];
    const cooldown = block.game.lastDamageAt || 0;
    if (now - cooldown < 55) rawDamage *= 0.36;
    block.game.lastDamageAt = now;
    const damage = rawDamage * mat.damageScale;
    if (damage < 2.2) return;
    block.game.hp -= damage;
    block.game.flash = Math.min(1, block.game.flash + damage / 90);

    if (block.game.material === 'tnt' && (block.game.hp <= 0 || damage > 28)) {
      queueExplosion(block.position.x, block.position.y, block, 80);
      return;
    }
    if (block.game.hp <= 0) breakBlock(block, sourcePos);
    else if (damage > 24) sfx('crack', Math.min(1, damage / 90));
  }

  function damagePig(pig, amount, sourcePos, now = performance.now()) {
    if (!pig || pig.game.dead) return;
    if (now - (pig.game.lastDamageAt || 0) < 65) amount *= 0.42;
    pig.game.lastDamageAt = now;
    if (amount < 4) return;
    pig.game.hp -= amount;
    pig.game.flash = Math.min(1, pig.game.flash + amount / 90);
    if (pig.game.hp <= 0) killPig(pig, sourcePos);
    else if (amount > 18) {
      floatText(`-${Math.round(amount)}`, pig.position.x, pig.position.y - 28, '#fff5a8');
      sfx('pigHit');
    }
  }

  function comboMultiplier() {
    const now = performance.now();
    if (now - state.lastDestroyAt < 900) state.combo = Math.min(5, state.combo + 1);
    else state.combo = 1;
    state.lastDestroyAt = now;
    return 1 + (state.combo - 1) * 0.2;
  }

  function breakBlock(block, sourcePos) {
    if (!block || block.game.destroyed) return;
    block.game.destroyed = true;
    const mat = MATERIALS[block.game.material];
    const multiplier = comboMultiplier();
    const points = Math.round(mat.breakScore * multiplier);
    addScore(points, 'blocks');
    floatText(state.combo > 1 ? `+${points}  x${state.combo}` : `+${points}`, block.position.x, block.position.y - 12, '#fff2a3');
    debrisForBlock(block);
    pendingRemovals.push(block);
    if (block.game.material === 'glass') sfx('glass'); else sfx('break');
  }

  function killPig(pig) {
    if (!pig || pig.game.dead) return;
    pig.game.dead = true;
    const multiplier = comboMultiplier();
    const points = Math.round(5000 * multiplier);
    addScore(points, 'pigs');
    floatText(state.combo > 1 ? `+${points}  x${state.combo}` : `+${points}`, pig.position.x, pig.position.y - 28, '#fff2a3');
    burst(pig.position.x, pig.position.y, 28, '#75d45e', 5.4, 'pig');
    burst(pig.position.x, pig.position.y, 10, '#eaffd8', 3.8, 'spark');
    pendingRemovals.push(pig);
    state.shake = Math.max(state.shake, 7);
    sfx('pigPop');
  }

  function queueExplosion(x, y, source, delay = 0) {
    if (source?.game?.explosionQueued) return;
    if (source?.game) source.game.explosionQueued = true;
    pendingExplosions.push({ x, y, source, at: performance.now() + delay });
  }

  function explodeAt(x, y, radius = 138, maxDamage = 430, source = null) {
    if (source && source.game?.type === 'block') {
      source.game.destroyed = true;
      pendingRemovals.push(source);
      addScore(MATERIALS.tnt.breakScore, 'blocks');
    }
    shockwaves.push({ x, y, r: 8, max: radius, life: 28, maxLife: 28 });
    shockwaves.push({ x, y, r: 4, max: radius * 0.64, life: 18, maxLife: 18, hot: true });
    burst(x, y, 56, '#ff8b3d', 9.5, 'fire');
    burst(x, y, 28, '#ffdc58', 7.5, 'spark');
    burst(x, y, 22, '#403932', 5.4, 'smoke');
    state.shake = Math.max(state.shake, 18);
    state.flash = Math.max(state.flash, 0.65);

    const affected = [...blocks, ...pigs, ...fragments, ...(currentBird ? [currentBird] : [])];
    affected.forEach(body => {
      if (!body || body === source || body.game?.dead || body.game?.destroyed) return;
      const delta = Vector.sub(body.position, { x, y });
      const distance = Math.max(1, Vector.magnitude(delta));
      if (distance > radius + (body.circleRadius || 20)) return;
      const falloff = Math.pow(clamp(1 - distance / radius, 0, 1), 0.92);
      const dir = Vector.normalise(delta);
      Body.applyForce(body, body.position, Vector.mult(dir, 0.04 * body.mass * falloff));
      Body.setAngularVelocity(body, body.angularVelocity + (Math.random() - 0.5) * 0.16 * falloff);
      Sleeping.set(body, false);
      if (body.game.type === 'block') {
        const damage = maxDamage * Math.pow(falloff, 1.15);
        if (body.game.material === 'tnt' && damage > 18) queueExplosion(body.position.x, body.position.y, body, 120 + Math.random() * 90);
        else damageBlock(body, damage, { x, y });
      } else if (body.game.type === 'pig') {
        damagePig(body, maxDamage * 0.48 * falloff + (falloff > 0.45 ? 45 : 0), { x, y });
      }
    });
  }

  function processPending() {
    if (pendingRemovals.length) {
      const unique = [...new Set(pendingRemovals)];
      pendingRemovals = [];
      unique.forEach(body => {
        if (Composite.get(world, body.id, 'body')) World.remove(world, body);
      });
      blocks = blocks.filter(b => !b.game.destroyed);
      pigs = pigs.filter(p => !p.game.dead);
      fragments = fragments.filter(f => !f.game.dead && Composite.get(world, f.id, 'body'));
    }
    const now = performance.now();
    const due = pendingExplosions.filter(e => e.at <= now);
    pendingExplosions = pendingExplosions.filter(e => e.at > now);
    due.forEach(e => {
      explodeAt(e.x, e.y, 138, 430, e.source);
      sfx('boom');
    });
  }

  function addScore(value, bucket) {
    state.score += Math.round(value);
    if (bucket && state.scoreParts[bucket] != null) state.scoreParts[bucket] += Math.round(value);
  }

  function markImpact(x, y) {
    particles.push({ x, y, vx: 0, vy: 0, life: 24, maxLife: 24, size: 15, color: '#fff', type: 'ring', gravity: 0 });
  }

  function finishLevel() {
    if (state.mode === 'won') return;
    state.mode = 'won';
    ui.abilityBtn.classList.remove('show');
    const level = levels[state.levelIndex];
    const unused = Math.max(0, level.birds.length - state.shotsUsed);
    const birdBonus = unused * 10000;
    const parBonus = Math.max(0, (level.par + 1 - state.shotsUsed)) * 3500;
    const timeSeconds = (performance.now() - state.levelStartAt) / 1000;
    const speedBonus = Math.max(0, Math.round(3500 - timeSeconds * 35));
    const bonus = birdBonus + parBonus + speedBonus;
    addScore(bonus, 'bonus');

    const stars = state.shotsUsed <= level.par ? 3 : state.shotsUsed <= level.par + 1 ? 2 : 1;
    const key = String(state.levelIndex + 1);
    state.save.bestStars[key] = Math.max(Number(state.save.bestStars[key]) || 0, stars);
    state.save.bestScore[key] = Math.max(Number(state.save.bestScore[key]) || 0, Math.round(state.score));
    state.save.unlocked = Math.min(levels.length, Math.max(state.save.unlocked, state.levelIndex + 2));
    saveGame();
    renderLevelGrid();
    updateUI();

    const finishedIndex = state.levelIndex;
    setTimeout(() => {
      if (state.mode !== 'won' || state.levelIndex !== finishedIndex) return;
      ui.resultKicker.textContent = 'LEVEL CLEARED';
      ui.resultTitle.textContent = 'ผ่านด่าน';
      ui.resultStars.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      ui.resultScore.textContent = Math.round(state.score).toLocaleString('th-TH');
      ui.scoreBreakdown.innerHTML = `
        <div><span>กำจัดหมู</span><b>${state.scoreParts.pigs.toLocaleString('th-TH')}</b></div>
        <div><span>ทำลายวัสดุ</span><b>${state.scoreParts.blocks.toLocaleString('th-TH')}</b></div>
        <div><span>โบนัสนก/เวลา</span><b>${state.scoreParts.bonus.toLocaleString('th-TH')}</b></div>`;
      ui.resultMessage.textContent = stars === 3 ? 'แก้โครงสร้างได้อย่างมีประสิทธิภาพ' : 'ผ่านแล้ว แต่ยังลดจำนวนนกเพื่อเพิ่มดาวได้';
      ui.nextBtn.style.display = state.levelIndex < levels.length - 1 ? '' : 'none';
      ui.resultOverlay.classList.remove('hidden');
      sfx('win');
    }, 650);
  }

  function failLevel() {
    if (state.mode === 'lost') return;
    state.mode = 'lost';
    ui.abilityBtn.classList.remove('show');
    updateUI();
    const failedIndex = state.levelIndex;
    setTimeout(() => {
      if (state.mode !== 'lost' || state.levelIndex !== failedIndex) return;
      ui.resultKicker.textContent = 'OUT OF BIRDS';
      ui.resultTitle.textContent = 'ยังไม่ผ่าน';
      ui.resultStars.textContent = '☆☆☆';
      ui.resultScore.textContent = Math.round(state.score).toLocaleString('th-TH');
      ui.scoreBreakdown.innerHTML = `
        <div><span>กำจัดหมู</span><b>${state.scoreParts.pigs.toLocaleString('th-TH')}</b></div>
        <div><span>ทำลายวัสดุ</span><b>${state.scoreParts.blocks.toLocaleString('th-TH')}</b></div>
        <div><span>หมูเหลือ</span><b>${alivePigs()}</b></div>`;
      ui.resultMessage.textContent = levelFailureTip();
      ui.nextBtn.style.display = 'none';
      ui.resultOverlay.classList.remove('hidden');
      sfx('fail');
    }, 500);
  }

  function levelFailureTip() {
    const tips = [
      'เล็งเสารับน้ำหนักด้านล่าง แทนการยิงส่วนบนของหอ',
      'ใช้นกฟ้าแยกร่างก่อนชนกระจกเล็กน้อย',
      'กระจายร่างนกฟ้าให้ครอบคลุมทั้งสามห้อง',
      'ใช้นกเหลืองเร่งความเร็วหลังวิถีเริ่มลดระดับ',
      'พยายามจุด TNT ด้วยนัดแรกเพื่อให้เกิดลูกโซ่',
      'ยิงปลายคานเพื่อเพิ่มโมเมนต์หมุน',
      'นกระเบิดมีประสิทธิภาพที่สุดเมื่อระเบิดกลางบังเกอร์',
      'เริ่มการถล่มจากหอซ้ายให้ล้มเข้าหาอีกหอ',
      'ลดแรงยิงเพื่อลอดช่อง แล้วค่อยใช้ Boost',
      'เปิดกระจกหรือ TNT ก่อน แล้วเก็บแกนหินด้วยนกระเบิด'
    ];
    return tips[state.levelIndex] || 'ลองเปลี่ยนจุดรับแรงของโครงสร้าง';
  }

  function isFiniteBody(body) {
    return !!body && Number.isFinite(body.position?.x) && Number.isFinite(body.position?.y) &&
      Number.isFinite(body.velocity?.x) && Number.isFinite(body.velocity?.y) && Number.isFinite(body.angle);
  }

  function isBodyStill(body, speedLimit = 0.18, angularLimit = 0.02) {
    return !!body && isFiniteBody(body) && body.speed < speedLimit && Math.abs(body.angularSpeed) < angularLimit;
  }

  function activeDynamicBodies() {
    return [...blocks, ...pigs, ...fragments].filter(b => Composite.get(world, b.id, 'body') && !b.game?.dead && !b.game?.destroyed);
  }

  function updateTurnFlow(now) {
    if ((state.mode !== 'flying' && state.mode !== 'settling') || !currentBird) return;
    const age = now - state.shotStartedAt;
    const bodyExists = !!Composite.get(world, currentBird.id, 'body');
    const validBody = bodyExists && isFiniteBody(currentBird);
    const offscreen = !validBody || currentBird.position.x > W + 130 || currentBird.position.x < -120 || currentBird.position.y > H + 170;
    const birdSlow = validBody && isBodyStill(currentBird, 0.22, 0.03) && age > 1500;
    const birdDone = currentBird.game.dead || offscreen || birdSlow || age > 10000;

    const dynamicBodies = activeDynamicBodies();
    const moving = dynamicBodies.some(b => !isBodyStill(b, 0.22, 0.025));

    if (birdDone && !moving && pendingExplosions.length === 0) {
      if (!state.settleSince) state.settleSince = now;
      state.mode = 'settling';
      if (now - state.settleSince > 720) {
        if (alivePigs() === 0) finishLevel();
        else if (state.shotsUsed >= levels[state.levelIndex].birds.length) failLevel();
        else spawnBird();
      }
    } else {
      state.settleSince = 0;
      state.mode = 'flying';
    }
  }

  function updateCrushDamage(now = performance.now()) {
    if (!state.physicsArmed || state.shotsUsed === 0 || state.mode === 'ready' || state.mode === 'aiming') return;

    pigs.forEach(pig => {
      if (!pig || pig.game.dead || !Composite.get(world, pig.id, 'body')) return;
      let supportedMass = 0;
      let strongestImpact = 0;
      let sourcePos = null;

      const contacts = Query.collides(pig, blocks.filter(block =>
        block && !block.game.destroyed && Composite.get(world, block.id, 'body')
      ));

      contacts.forEach(contact => {
        const block = contact.bodyA === pig ? contact.bodyB : contact.bodyA;
        if (!block?.game || block.game.type !== 'block') return;

        const radius = pig.game.radius;
        const blockAbove = block.position.y < pig.position.y + radius * 0.18;
        const horizontalOverlap = Math.min(block.bounds.max.x, pig.bounds.max.x) - Math.max(block.bounds.min.x, pig.bounds.min.x);
        const blockMoved = Vector.magnitude(Vector.sub(block.position, {
          x: block.game.armX ?? block.game.spawnX,
          y: block.game.armY ?? block.game.spawnY
        })) > 4 || Math.abs(block.angle - (block.game.armAngle ?? block.game.spawnAngle)) > 0.045 ||
          block.speed > 0.2 || Math.abs(block.angularSpeed) > 0.018;
        const pigMoved = Vector.magnitude(Vector.sub(pig.position, {
          x: pig.game.armX ?? pig.game.spawnX,
          y: pig.game.armY ?? pig.game.spawnY
        })) > 3;
        const depth = Math.max(0, contact.depth || 0);
        if (!blockAbove || horizontalOverlap < radius * 0.28 || (!blockMoved && !pigMoved && depth < 1.5)) return;

        const downwardSpeed = Math.max(0, block.velocity.y - pig.velocity.y);
        const relativeSpeed = Vector.magnitude(Vector.sub(block.velocity, pig.velocity));
        const contactFactor = clamp(horizontalOverlap / (radius * 1.5), 0.25, 1.4);
        supportedMass += block.mass * contactFactor * (1 + Math.min(1.2, depth / 8));

        const impactScore = block.mass * (downwardSpeed * 1.4 + relativeSpeed * 0.35);
        if (impactScore > strongestImpact) {
          strongestImpact = impactScore;
          sourcePos = block.position;
        }
      });

      pig.game.crushImpactCooldown = Math.max(0, (pig.game.crushImpactCooldown || 0) - 1);
      if (strongestImpact > 3.2 && pig.game.crushImpactCooldown <= 0) {
        pig.game.crushImpactCooldown = 6;
        const impactDamage = 34 + strongestImpact * 5.4;
        const wasDead = pig.game.dead;
        damagePig(pig, impactDamage, sourcePos, now);
        if (!wasDead && pig.game.dead) {
          floatText('CRUSH!', pig.position.x, pig.position.y - 42, '#ffd75a');
          burst(pig.position.x, pig.position.y + pig.game.radius * .45, 12, '#d8c39a', 3.1, 'dust');
        }
      }

      if (supportedMass > 3.1) {
        pig.game.crushFrames = (pig.game.crushFrames || 0) + 1;
        pig.game.crushTickFrames = (pig.game.crushTickFrames || 0) + 1;
        if (pig.game.crushFrames >= 7 && pig.game.crushTickFrames >= 6) {
          pig.game.crushTickFrames = 0;
          const sustainedDamage = 6 + Math.pow(supportedMass - 2.6, 1.08) * 2.4;
          const wasDead = pig.game.dead;
          damagePig(pig, sustainedDamage, sourcePos, now);
          if (!wasDead && pig.game.dead) {
            floatText('CRUSH!', pig.position.x, pig.position.y - 42, '#ffd75a');
            burst(pig.position.x, pig.position.y + pig.game.radius * .45, 12, '#d8c39a', 3.1, 'dust');
          }
          Body.setVelocity(pig, {
            x: pig.velocity.x * 0.72,
            y: Math.max(pig.velocity.y, 0.35)
          });
          if (supportedMass > 8) {
            burst(pig.position.x, pig.position.y + pig.game.radius * 0.55, 3, '#d8c39a', 1.4, 'dust');
          }
        }
      } else {
        pig.game.crushFrames = Math.max(0, (pig.game.crushFrames || 0) - 2);
        pig.game.crushTickFrames = 0;
      }
    });
  }

  function updateBodies() {
    const allProjectiles = [...fragments, ...(currentBird ? [currentBird] : [])];
    allProjectiles.forEach(body => {
      if (!Composite.get(world, body.id, 'body')) return;
      if (!isFiniteBody(body)) {
        body.game.dead = true;
        pendingRemovals.push(body);
        return;
      }
      body.game.trailTick = (body.game.trailTick || 0) + 1;
      if (body.game.trailTick % 2 === 0 && body.game.launched) {
        body.game.trail.push({ x: body.position.x, y: body.position.y, life: 24 });
        if (body.game.trail.length > 34) body.game.trail.shift();
      }
      body.game.trail.forEach(p => p.life--);
      body.game.trail = body.game.trail.filter(p => p.life > 0);
      if (body.game.boostGlow > 0) body.game.boostGlow--;
      if (body.position.y > H + 180 || body.position.x > W + 220 || body.position.x < -220) {
        body.game.dead = true;
        pendingRemovals.push(body);
      }
    });

    activeDynamicBodies().forEach(body => {
      if (!isFiniteBody(body)) {
        body.game.dead = true;
        body.game.destroyed = true;
        pendingRemovals.push(body);
        return;
      }
      if (body.speed > 0.02) Sleeping.set(body, false);
    });

    blocks.forEach(b => { b.game.flash *= 0.86; });
    pigs.forEach(p => { p.game.flash *= 0.84; });
  }

  function fixedUpdate() {
    if (state.paused || anyOverlayOpen() || state.mode === 'won' || state.mode === 'lost') return;
    Engine.update(engine, STEP / 2);
    Engine.update(engine, STEP / 2);
    updateCrushDamage(performance.now());
    processPending();
    updateBodies();
    updateParticles();
    if (alivePigs() === 0 && state.shotsUsed > 0) finishLevel();
  }

  function frame(now) {
    const elapsed = Math.min(50, now - state.lastFrame);
    state.lastFrame = now;
    if (state.introActive) updateIntro(now);
    if (!state.paused && !anyOverlayOpen()) {
      state.accumulator += elapsed;
      let loops = 0;
      while (state.accumulator >= STEP && loops < 4) {
        fixedUpdate();
        state.accumulator -= STEP;
        loops++;
      }
      updateTurnFlow(now);
    }
    updateVisualEffects(elapsed / 16.667);
    updateUI();
    draw(now);
    requestAnimationFrame(frame);
  }

  function updateParticles(dt = 1) {
    particles.forEach(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.gravity ?? 0.2) * dt;
      p.vx *= Math.pow(0.985, dt);
      p.rot = (p.rot || 0) + (p.vr || 0) * dt;
      p.life -= dt;
    });
    particles = particles.filter(p => p.life > 0).slice(-500);
  }

  function updateVisualEffects(dt) {
    shockwaves.forEach(s => { s.life -= dt; s.r += (s.max - s.r) * 0.18 * dt; });
    shockwaves = shockwaves.filter(s => s.life > 0);
    floaters.forEach(f => { f.life -= dt; f.y -= 0.72 * dt; f.x += f.vx * dt; });
    floaters = floaters.filter(f => f.life > 0);
    if (state.shake > 0) state.shake *= Math.pow(0.82, dt);
    if (state.flash > 0) state.flash *= Math.pow(0.8, dt);
    clouds.forEach(c => { c.x += c.speed * dt; if (c.x > W + 160) c.x = -180; });
  }

  function burst(x, y, count, color, speed = 4, type = 'debris') {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.25 + Math.random() * 0.9);
      particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - Math.random() * 1.2,
        life: 22 + Math.random() * 28, maxLife: 50, size: 2 + Math.random() * 5,
        color, type, gravity: type === 'smoke' ? -0.035 : type === 'spark' ? 0.08 : 0.22,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.25
      });
    }
  }

  function debrisForBlock(block) {
    const material = block.game.material;
    const colors = {
      wood: ['#d99045', '#8b4f25', '#f0bd72'],
      glass: ['#9cecff', '#dffbff', '#58b7d5'],
      stone: ['#9ba4aa', '#626d75', '#c8ced1'],
      tnt: ['#e84d3d', '#852923', '#f4d27f']
    }[material];
    const count = material === 'stone' ? 13 : 20;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1.5 + Math.random() * (material === 'stone' ? 3.3 : 5.2);
      particles.push({
        x: block.position.x + (Math.random() - 0.5) * block.game.w * 0.6,
        y: block.position.y + (Math.random() - 0.5) * block.game.h * 0.6,
        vx: Math.cos(a) * s + block.velocity.x * 0.25,
        vy: Math.sin(a) * s + block.velocity.y * 0.25 - 1,
        life: 42 + Math.random() * 38, maxLife: 80,
        size: 3 + Math.random() * 7, color: colors[i % colors.length], type: material,
        gravity: 0.24, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.22
      });
    }
  }

  function floatText(text, x, y, color = '#fff') {
    floaters.push({ text, x, y, color, life: 72, maxLife: 72, vx: (Math.random() - 0.5) * 0.25 });
  }

  const INTRO_SCENES = [
    { end: 3200, caption: 'เช้าวันหนึ่ง รังของฝูงนกยังสงบและปลอดภัย...' },
    { end: 6200, caption: 'แต่ในพุ่มไม้ มีแขกที่ไม่ได้รับเชิญกำลังวางแผนบางอย่าง' },
    { end: 9100, caption: 'เพียงชั่วพริบตา ไข่ก็หายไป เหลือไว้แค่รอยเท้า' },
    { end: 12800, caption: 'หัวขโมยหนีไปพร้อมไข่—และการไล่ล่าก็เริ่มขึ้น' },
    { end: 16600, caption: 'ภารกิจแรก: ทำลายป้อมหมูและนำไข่กลับคืนมา' }
  ];

  function playIntro() {
    closeOverlays();
    state.introActive = true;
    state.introStartedAt = performance.now();
    state.introScene = -1;
    state.accumulator = 0;
    ui.introOverlay.classList.remove('hidden');
    ui.introProgressFill.style.width = '0%';
    drawIntroFrame(0);
  }

  function endIntro(skipped = false) {
    if (!state.introActive && ui.introOverlay.classList.contains('hidden')) return;
    state.introActive = false;
    ui.introOverlay.classList.add('hidden');
    state.lastFrame = performance.now();
    state.accumulator = 0;
    updateUI(true);
    if (!skipped) toast('นำไข่กลับคืนมาให้ได้');
  }

  function updateIntro(now) {
    if (!state.introActive) return;
    const elapsed = Math.max(0, now - state.introStartedAt);
    drawIntroFrame(elapsed);
    ui.introProgressFill.style.width = `${clamp(elapsed / state.introDuration, 0, 1) * 100}%`;
    if (elapsed >= state.introDuration) endIntro(false);
  }

  function introSceneIndex(elapsed) {
    return INTRO_SCENES.findIndex(scene => elapsed < scene.end);
  }

  function introEase(t) {
    const v = clamp(t, 0, 1);
    return v * v * (3 - 2 * v);
  }

  function introFade(local, duration) {
    const fadeIn = introEase(local / 360);
    const fadeOut = introEase((duration - local) / 360);
    return Math.min(fadeIn, fadeOut, 1);
  }

  function introRoundRect(c, x, y, w, h, r) {
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  function drawIntroBackdrop(c, skyA = '#7bcff0', skyB = '#eaf7df', shift = 0) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, skyA);
    g.addColorStop(1, skyB);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    c.fillStyle = '#fff2a6';
    c.beginPath(); c.arc(1050 - shift * 0.12, 115, 56, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 0.45;
    c.fillStyle = '#87c985';
    c.beginPath();
    c.moveTo(0, 430);
    for (let x = 0; x <= W + 100; x += 100) {
      const y = 400 + Math.sin((x + shift) * 0.007) * 34;
      c.quadraticCurveTo(x + 50, y - 28, x + 100, y);
    }
    c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();
    c.globalAlpha = 1;

    c.fillStyle = '#5eaa58';
    c.beginPath();
    c.moveTo(0, 520);
    for (let x = 0; x <= W + 80; x += 80) {
      const y = 500 + Math.sin((x + shift * 1.3) * 0.009 + 0.8) * 42;
      c.quadraticCurveTo(x + 40, y - 26, x + 80, y);
    }
    c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();

    c.fillStyle = '#79bd52'; c.fillRect(0, 605, W, 45);
    c.fillStyle = '#704c34'; c.fillRect(0, 650, W, 70);
  }

  function drawIntroNest(c, x, y, scale = 1, empty = false) {
    c.save(); c.translate(x, y); c.scale(scale, scale);
    c.strokeStyle = '#744521'; c.lineWidth = 8; c.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const a = -1.15 + i * 0.17;
      c.beginPath();
      c.moveTo(Math.cos(a) * 66, Math.sin(a) * 20);
      c.quadraticCurveTo(0, 35 + (i % 3) * 5, Math.cos(a + 1.4) * 68, Math.sin(a + 1.4) * 20);
      c.stroke();
    }
    c.fillStyle = '#9b602d';
    c.beginPath(); c.ellipse(0, 8, 76, 30, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#57331c';
    c.beginPath(); c.ellipse(0, 2, 58, 18, 0, 0, Math.PI * 2); c.fill();
    if (!empty) {
      drawIntroEgg(c, -24, -17, 0.88, -0.1);
      drawIntroEgg(c, 7, -23, 0.96, 0.05);
      drawIntroEgg(c, 34, -14, 0.82, 0.14);
    }
    c.restore();
  }

  function drawIntroEgg(c, x, y, scale = 1, angle = 0) {
    c.save(); c.translate(x, y); c.rotate(angle); c.scale(scale, scale);
    const g = c.createRadialGradient(-8, -12, 3, 0, 0, 28);
    g.addColorStop(0, '#fffdf1'); g.addColorStop(1, '#d9e7df');
    c.fillStyle = g; c.strokeStyle = '#a7b6ae'; c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, -33);
    c.bezierCurveTo(22, -28, 27, -3, 23, 15);
    c.bezierCurveTo(18, 35, -18, 35, -23, 15);
    c.bezierCurveTo(-27, -3, -22, -28, 0, -33);
    c.fill(); c.stroke();
    c.restore();
  }

  function drawIntroBird(c, x, y, r, type = 'red', expression = 'calm', angle = 0) {
    const palette = {
      red: ['#f25b4d', '#aa2330'], yellow: ['#ffe55d', '#e3a727'], blue: ['#74cefa', '#2d82c5']
    }[type];
    c.save(); c.translate(x, y); c.rotate(angle);
    const g = c.createRadialGradient(-r * 0.35, -r * 0.4, 2, 0, 0, r * 1.2);
    g.addColorStop(0, palette[0]); g.addColorStop(1, palette[1]);
    c.fillStyle = g; c.strokeStyle = '#273039'; c.lineWidth = Math.max(2, r * 0.08);
    if (type === 'yellow') {
      c.beginPath(); c.moveTo(0, -r * 1.28); c.lineTo(r, r * 0.82); c.quadraticCurveTo(0, r * 1.08, -r, r * 0.82); c.closePath();
    } else {
      c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2);
    }
    c.fill(); c.stroke();
    c.fillStyle = '#f5e8d2';
    c.beginPath(); c.ellipse(r * 0.1, r * 0.42, r * 0.66, r * 0.43, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff';
    c.beginPath(); c.ellipse(-r * .24, -r * .18, r * .23, r * .29, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(r * .26, -r * .18, r * .23, r * .29, 0, 0, Math.PI * 2); c.fill();
    const pupilX = expression === 'lookRight' ? r * .08 : expression === 'lookLeft' ? -r * .08 : 0;
    c.fillStyle = '#21272b';
    c.beginPath(); c.arc(-r * .22 + pupilX, -r * .15, r * .075, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(r * .22 + pupilX, -r * .15, r * .075, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#30262a'; c.lineWidth = Math.max(2, r * .1); c.lineCap = 'round';
    c.beginPath();
    if (expression === 'angry' || expression === 'shocked') {
      c.moveTo(-r * .52, -r * .5); c.lineTo(-r * .05, -r * .32);
    } else { c.moveTo(-r * .48, -r * .42); c.lineTo(-r * .08, -r * .42); }
    c.stroke();
    c.beginPath();
    if (expression === 'angry' || expression === 'shocked') {
      c.moveTo(r * .52, -r * .5); c.lineTo(r * .05, -r * .32);
    } else { c.moveTo(r * .48, -r * .42); c.lineTo(r * .08, -r * .42); }
    c.stroke();
    c.fillStyle = type === 'blue' ? '#efb23e' : '#f29a31';
    c.beginPath(); c.moveTo(r * .02, -r * .02); c.lineTo(r * .82, r * .16); c.lineTo(r * .02, r * .34); c.closePath(); c.fill();
    if (expression === 'shocked') {
      c.fillStyle = '#4c2721'; c.beginPath(); c.ellipse(-r * .02, r * .5, r * .15, r * .22, 0, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  function drawIntroPig(c, x, y, r, expression = 'sneaky', angle = 0) {
    c.save(); c.translate(x, y); c.rotate(angle);
    const g = c.createRadialGradient(-r * .3, -r * .4, 2, 0, 0, r * 1.2);
    g.addColorStop(0, '#a9eb72'); g.addColorStop(1, '#3f9f43');
    c.fillStyle = g; c.strokeStyle = '#275f32'; c.lineWidth = Math.max(2, r * .08);
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#6ec653';
    c.beginPath(); c.arc(-r * .5, -r * .62, r * .29, Math.PI, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(r * .5, -r * .62, r * .29, Math.PI, Math.PI * 2); c.fill();
    c.fillStyle = '#fff';
    c.beginPath(); c.ellipse(-r * .28, -r * .22, r * .23, r * .27, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(r * .28, -r * .22, r * .23, r * .27, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#26372b';
    const look = expression === 'run' ? -r * .07 : r * .06;
    c.beginPath(); c.arc(-r * .25 + look, -r * .19, r * .075, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(r * .25 + look, -r * .19, r * .075, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#8add65'; c.strokeStyle = '#33743b'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(0, r * .18, r * .52, r * .36, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#39753e';
    c.beginPath(); c.ellipse(-r * .17, r * .18, r * .08, r * .12, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(r * .17, r * .18, r * .08, r * .12, 0, 0, Math.PI * 2); c.fill();
    if (expression === 'sneaky') {
      c.strokeStyle = '#23542e'; c.lineWidth = 3;
      c.beginPath(); c.arc(0, r * .4, r * .32, .15, Math.PI - .15); c.stroke();
    }
    c.restore();
  }

  function drawIntroBush(c, x, y, scale = 1) {
    c.save(); c.translate(x, y); c.scale(scale, scale);
    c.fillStyle = '#388744';
    [[-45, 0, 48], [0, -18, 62], [55, 5, 48], [15, 22, 58]].forEach(([bx, by, br]) => {
      c.beginPath(); c.arc(bx, by, br, 0, Math.PI * 2); c.fill();
    });
    c.fillStyle = '#62a94f';
    for (let i = 0; i < 18; i++) {
      const a = i * 1.7;
      c.beginPath(); c.arc(Math.sin(a) * 68, Math.cos(a * 1.2) * 35, 9, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  function drawIntroFootprints(c, startX, startY, count = 7, spacing = 52) {
    c.fillStyle = 'rgba(50,77,45,.55)';
    for (let i = 0; i < count; i++) {
      const x = startX + i * spacing;
      const y = startY + Math.sin(i * 1.8) * 10;
      c.save(); c.translate(x, y); c.rotate(-0.25 + Math.sin(i) * 0.18);
      c.beginPath(); c.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(-8, -9, 4, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(0, -12, 4, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(8, -8, 4, 0, Math.PI * 2); c.fill();
      c.restore();
    }
  }

  function drawIntroFilm(c, elapsed) {
    c.save();
    c.fillStyle = 'rgba(10,12,13,.92)';
    c.fillRect(0, 0, W, 38); c.fillRect(0, H - 38, W, 38);
    c.fillStyle = 'rgba(238,225,184,.72)';
    const offset = (elapsed * .04) % 46;
    for (let x = -46 + offset; x < W + 46; x += 46) {
      introRoundRect(c, x, 10, 24, 12, 3); c.fill();
      introRoundRect(c, x, H - 22, 24, 12, 3); c.fill();
    }
    c.globalAlpha = .08;
    c.fillStyle = '#fff';
    for (let i = 0; i < 44; i++) {
      const x = (i * 97 + Math.sin(elapsed * .001 + i) * 61) % W;
      const y = (i * 53 + Math.cos(elapsed * .0014 + i) * 31) % H;
      c.fillRect(x, y, 1 + (i % 2), 1 + (i % 3));
    }
    c.restore();
  }

  function drawIntroFrame(elapsed) {
    const c = introCtx;
    c.save();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);

    const scene = Math.max(0, introSceneIndex(elapsed));
    if (scene !== state.introScene) {
      state.introScene = scene;
      ui.introCaption.textContent = INTRO_SCENES[scene]?.caption || INTRO_SCENES.at(-1).caption;
    }
    const sceneStart = scene === 0 ? 0 : INTRO_SCENES[scene - 1].end;
    const sceneEnd = INTRO_SCENES[scene]?.end || state.introDuration;
    const local = elapsed - sceneStart;
    const duration = sceneEnd - sceneStart;
    const p = clamp(local / duration, 0, 1);

    if (scene === 0) {
      drawIntroBackdrop(c, '#78cef0', '#e7f5d9', p * 30);
      drawIntroNest(c, 665, 530, 1.15, false);
      const bob = Math.sin(elapsed * .003) * 4;
      drawIntroBird(c, 480, 510 + bob, 48, 'red', 'calm', -.04);
      drawIntroBird(c, 845, 520 - bob * .5, 43, 'yellow', 'lookLeft', .04);
      drawIntroBird(c, 555, 585, 35, 'blue', 'lookRight', -.02);
      c.fillStyle = 'rgba(255,255,255,.34)'; c.beginPath(); c.ellipse(665, 640, 180, 18, 0, 0, Math.PI * 2); c.fill();
    } else if (scene === 1) {
      drawIntroBackdrop(c, '#69bfe4', '#dcefcf', 80 + p * 45);
      drawIntroNest(c, 420, 548, 1.02, false);
      drawIntroBird(c, 285, 540, 43, 'red', 'lookRight');
      drawIntroBird(c, 540, 565, 34, 'blue', 'lookRight');
      drawIntroBush(c, 1010, 565, 1.25);
      const peek = introEase(clamp((p - .12) / .45, 0, 1));
      drawIntroPig(c, 947, 500 + (1 - peek) * 90, 42, 'sneaky', -.04);
      drawIntroPig(c, 1065, 520 + (1 - peek) * 85, 35, 'sneaky', .05);
      c.fillStyle = '#8a5a31'; c.strokeStyle = '#50341f'; c.lineWidth = 3;
      c.beginPath(); c.ellipse(1005, 575, 62, 46, -.08, 0, Math.PI * 2); c.fill(); c.stroke();
      c.strokeStyle = '#50341f'; c.beginPath(); c.arc(1005, 543, 32, Math.PI, Math.PI * 2); c.stroke();
    } else if (scene === 2) {
      drawIntroBackdrop(c, '#75c4df', '#e8efd0', 140);
      drawIntroNest(c, 650, 545, 1.18, true);
      drawIntroFootprints(c, 710, 602, 8, 57);
      const shock = introEase(clamp((p - .1) / .35, 0, 1));
      drawIntroBird(c, 450 - (1 - shock) * 80, 535, 49, 'red', 'shocked', -.05);
      drawIntroBird(c, 380 - (1 - shock) * 90, 600, 35, 'blue', 'shocked', -.06);
      drawIntroBird(c, 500 - (1 - shock) * 70, 620, 42, 'yellow', 'shocked', .05);
      c.fillStyle = '#2e3338'; c.font = '900 84px system-ui'; c.textAlign = 'center'; c.fillText('!', 542, 425);
      const shake = Math.sin(elapsed * .035) * (1 - p) * 5;
      c.translate(shake, 0);
    } else if (scene === 3) {
      drawIntroBackdrop(c, '#70b9de', '#e2efcb', 220 + p * 320);
      const travel = introEase(p) * 900;
      for (let i = 0; i < 12; i++) {
        const x = 1180 - travel - i * 38;
        c.fillStyle = `rgba(210,186,132,${0.35 - i * .02})`;
        c.beginPath(); c.arc(x, 610 + Math.sin(i) * 6, 10 + i * .4, 0, Math.PI * 2); c.fill();
      }
      drawIntroPig(c, 1110 - travel, 560 + Math.sin(elapsed * .014) * 8, 43, 'run', -.1);
      drawIntroPig(c, 1005 - travel, 590 + Math.sin(elapsed * .015 + 2) * 7, 36, 'run', .08);
      drawIntroEgg(c, 1090 - travel, 510, .78, -.1);
      drawIntroEgg(c, 1020 - travel, 538, .68, .14);
      const chase = Math.max(-120, 250 - travel * .8);
      drawIntroBird(c, chase, 555, 46, 'red', 'angry', -.08);
      drawIntroBird(c, chase - 105, 595, 34, 'blue', 'angry', -.04);
      drawIntroBird(c, chase - 190, 545, 41, 'yellow', 'angry', .05);
    } else {
      const zoom = 1 + introEase(p) * .14;
      c.save(); c.translate(W / 2, H / 2); c.scale(zoom, zoom); c.translate(-W / 2, -H / 2);
      drawIntroBackdrop(c, '#527eab', '#edc08a', 470);
      c.fillStyle = 'rgba(27,38,44,.52)'; c.fillRect(0, 0, W, H);
      drawIntroBird(c, 415, 435, 118, 'red', 'angry', -.05);
      c.strokeStyle = '#5b3219'; c.lineWidth = 24; c.lineCap = 'round';
      c.beginPath(); c.moveTo(910, 620); c.lineTo(910, 410); c.stroke();
      c.beginPath(); c.moveTo(910, 445); c.lineTo(850, 330); c.stroke();
      c.beginPath(); c.moveTo(910, 445); c.lineTo(970, 325); c.stroke();
      c.strokeStyle = '#2c1b16'; c.lineWidth = 9;
      c.beginPath(); c.moveTo(852, 332); c.lineTo(970, 327); c.stroke();
      c.restore();
      c.textAlign = 'center';
      c.fillStyle = '#fff7df'; c.strokeStyle = 'rgba(28,35,38,.7)'; c.lineWidth = 9;
      c.font = '950 68px system-ui'; c.strokeText('THE EGG HEIST', 790, 235); c.fillText('THE EGG HEIST', 790, 235);
      c.fillStyle = '#ffd047'; c.font = '950 25px system-ui'; c.fillText('MINI ANGRY BIRDS: REFORGED', 790, 278);
    }

    const fade = introFade(local, duration);
    c.fillStyle = `rgba(8,10,11,${1 - fade})`; c.fillRect(0, 0, W, H);
    drawIntroFilm(c, elapsed);
    c.restore();
  }

  function draw(now) {
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    const shakeX = state.shake > 0.15 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0.15 ? (Math.random() - 0.5) * state.shake * 0.65 : 0;
    ctx.translate(shakeX, shakeY);

    drawBackground(now);
    drawGround();
    terrain.forEach(drawTerrain);
    drawTrajectory();
    drawSlingshotBack();
    blocks.forEach(drawBlock);
    pigs.forEach(drawPig);
    drawProjectileTrails();
    if (currentBird && Composite.get(world, currentBird.id, 'body')) drawBird(currentBird);
    fragments.forEach(drawBird);
    drawSlingshotFront();
    drawShockwaves();
    drawParticles();
    drawFloaters();

    ctx.restore();
    if (state.flash > 0.015) {
      ctx.fillStyle = `rgba(255,246,201,${state.flash * 0.42})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawBackground(now) {
    const level = levels[state.levelIndex];
    const theme = BACKDROPS[level.backdrop] || BACKDROPS.meadow;
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, theme.skyTop);
    gradient.addColorStop(0.72, theme.skyBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    const sunX = level.backdrop === 'sunset' ? 1060 : 1050;
    const sunY = level.backdrop === 'sunset' ? 140 : 105;
    const sunR = level.backdrop === 'sunset' ? 72 : 54;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 5, sunX, sunY, sunR * 2.2);
    sunGlow.addColorStop(0, 'rgba(255,246,185,.95)');
    sunGlow.addColorStop(.4, 'rgba(255,218,111,.38)');
    sunGlow.addColorStop(1, 'rgba(255,218,111,0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath(); ctx.arc(sunX, sunY, sunR * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff3b3';
    ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2); ctx.fill();

    clouds.forEach(drawCloud);
    drawHills(theme.far, 0.34, 382, 92, 0.000035 * now);
    drawHills(theme.near, 0.62, 495, 118, 0.000055 * now + 1.3);

    ctx.fillStyle = 'rgba(255,255,255,.14)';
    for (let i = 0; i < 4; i++) {
      const x = 340 + i * 230;
      ctx.beginPath();
      ctx.ellipse(x, 608, 130, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCloud(c) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(c.scale, c.scale);
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.beginPath();
    ctx.arc(-36, 5, 25, 0, Math.PI * 2);
    ctx.arc(-8, -8, 34, 0, Math.PI * 2);
    ctx.arc(26, 2, 28, 0, Math.PI * 2);
    ctx.arc(52, 10, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHills(color, alpha, baseY, amplitude, phase) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, baseY);
    for (let x = 0; x <= W + 80; x += 80) {
      const y = baseY - Math.sin(x * 0.006 + phase) * amplitude * 0.25 - Math.sin(x * 0.0022 + phase * 0.7) * amplitude * 0.55;
      ctx.quadraticCurveTo(x + 40, y - 18, x + 80, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawGround() {
    const theme = BACKDROPS[levels[state.levelIndex].backdrop] || BACKDROPS.meadow;
    ctx.fillStyle = '#6bb34d';
    ctx.fillRect(0, GROUND_Y - 8, W, 14);
    const dirt = ctx.createLinearGradient(0, GROUND_Y, 0, H);
    dirt.addColorStop(0, theme.ground);
    dirt.addColorStop(1, '#3e2d25');
    ctx.fillStyle = dirt;
    ctx.fillRect(0, GROUND_Y + 4, W, H - GROUND_Y);
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    for (let x = 0; x < W; x += 38) {
      ctx.beginPath();
      ctx.arc(x + (x % 3) * 8, GROUND_Y + 24 + (x % 5) * 8, 3 + (x % 4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#3f8b3c';
    ctx.lineWidth = 2;
    for (let x = 0; x < W; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y - 1);
      ctx.lineTo(x + ((x / 12) % 2 ? -3 : 3), GROUND_Y - 9 - (x % 4));
      ctx.stroke();
    }
  }

  function drawTerrain(body) {
    const { w, h } = body.game.def;
    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(body.angle);
    ctx.fillStyle = 'rgba(32,48,39,.18)';
    roundedRect(-w / 2 + 5, -h / 2 + 8, w, h, 7); ctx.fill();
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, '#8fbd59');
    g.addColorStop(0.26, '#6f9547');
    g.addColorStop(0.28, '#8b6944');
    g.addColorStop(1, '#5b422e');
    ctx.fillStyle = g;
    roundedRect(-w / 2, -h / 2, w, h, 7); ctx.fill();
    ctx.restore();
  }

  function drawSlingshotBack() {
    const birdPos = currentBird && (state.mode === 'aiming' || state.mode === 'ready') ? currentBird.position : SLING;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#3a1f16';
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(163, 518); ctx.lineTo(birdPos.x, birdPos.y); ctx.stroke();
    drawSlingWood();
  }

  function drawSlingshotFront() {
    const birdPos = currentBird && (state.mode === 'aiming' || state.mode === 'ready') ? currentBird.position : SLING;
    ctx.strokeStyle = '#5a2d1c';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(212, 516); ctx.lineTo(birdPos.x, birdPos.y); ctx.stroke();
    ctx.fillStyle = '#2d1b16';
    ctx.save();
    ctx.translate(birdPos.x, birdPos.y);
    ctx.rotate(Math.atan2(SLING.y - birdPos.y, SLING.x - birdPos.x));
    roundedRect(-12, -18, 24, 36, 7); ctx.fill();
    ctx.restore();
  }

  function drawSlingWood() {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#663719';
    ctx.lineWidth = 28;
    ctx.beginPath(); ctx.moveTo(188, 646); ctx.lineTo(188, 535); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(188, 553); ctx.lineTo(162, 502); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(188, 553); ctx.lineTo(215, 500); ctx.stroke();
    ctx.strokeStyle = '#9b5d2b';
    ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(183, 637); ctx.lineTo(183, 548); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(183, 548); ctx.lineTo(163, 507); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(193, 548); ctx.lineTo(213, 505); ctx.stroke();
    ctx.restore();
  }

  function drawTrajectory() {
    if (!state.aimGuide || state.mode !== 'aiming' || !currentBird) return;
    const pull = Vector.sub(SLING, currentBird.position);
    let vx = pull.x * 0.178;
    let vy = pull.y * 0.178;
    let x = SLING.x;
    let y = SLING.y;
    const air = 1 - BIRDS[currentBird.game.birdType].frictionAir;
    for (let i = 0; i < 90; i++) {
      x += vx;
      y += vy;
      vy += 0.292;
      vx *= air;
      vy *= air;
      if (i % 5 === 0) {
        const alpha = 0.88 * (1 - i / 95);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, 5 - i * 0.022, 0, Math.PI * 2);
        ctx.fill();
      }
      if (y > GROUND_Y || x > W) break;
    }
  }

  function drawProjectileTrails() {
    const bodies = [...fragments, ...(currentBird ? [currentBird] : [])];
    bodies.forEach(body => {
      if (!body?.game?.trail) return;
      const color = body.game.birdType === 'yellow' ? '#ffe55d' : body.game.birdType === 'blue' ? '#c5f0ff' : body.game.birdType === 'bomb' ? '#6c7780' : '#ffb2a3';
      body.game.trail.forEach((p, i) => {
        ctx.globalAlpha = clamp(p.life / 24, 0, 1) * 0.36;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2 + i * 0.08, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (body.game.boostGlow > 0) {
        const v = Vector.normalise(body.velocity);
        for (let j = 0; j < 4; j++) {
          ctx.strokeStyle = `rgba(255,226,73,${0.55 - j * 0.1})`;
          ctx.lineWidth = 5 - j;
          ctx.beginPath();
          ctx.moveTo(body.position.x - v.x * (24 + j * 10), body.position.y - v.y * (24 + j * 10));
          ctx.lineTo(body.position.x - v.x * (45 + j * 15), body.position.y - v.y * (45 + j * 15));
          ctx.stroke();
        }
      }
    });
  }

  function drawBlock(body) {
    if (!body || body.game.destroyed) return;
    const g = body.game;
    const w = g.w, h = g.h;
    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(body.angle);

    ctx.fillStyle = 'rgba(20,34,41,.18)';
    roundedRect(-w / 2 + 5, -h / 2 + 7, w, h, Math.min(7, Math.min(w, h) * 0.18)); ctx.fill();

    if (g.material === 'wood') drawWoodBlock(w, h, g);
    else if (g.material === 'glass') drawGlassBlock(w, h, g);
    else if (g.material === 'stone') drawStoneBlock(w, h, g);
    else if (g.material === 'tnt') drawTntBlock(w, h, g);

    if (g.flash > 0.02) {
      ctx.globalAlpha = g.flash * 0.5;
      ctx.fillStyle = '#fff7b5';
      roundedRect(-w / 2, -h / 2, w, h, 3); ctx.fill();
    }
    ctx.restore();
  }

  function drawWoodBlock(w, h, g) {
    const grad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    grad.addColorStop(0, '#edb76f'); grad.addColorStop(.48, '#c77b35'); grad.addColorStop(1, '#9b5928');
    ctx.fillStyle = grad;
    roundedRect(-w / 2, -h / 2, w, h, 3); ctx.fill();
    ctx.strokeStyle = '#70401f'; ctx.lineWidth = 2; roundedRect(-w / 2, -h / 2, w, h, 3); ctx.stroke();
    ctx.strokeStyle = 'rgba(102,52,20,.28)'; ctx.lineWidth = 1.5;
    const horizontal = w >= h;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      if (horizontal) {
        const y = i * h / 6;
        ctx.moveTo(-w / 2 + 7, y);
        ctx.bezierCurveTo(-w / 5, y - 4, w / 6, y + 4, w / 2 - 7, y - 1);
      } else {
        const x = i * w / 6;
        ctx.moveTo(x, -h / 2 + 7);
        ctx.bezierCurveTo(x - 4, -h / 5, x + 4, h / 6, x - 1, h / 2 - 7);
      }
      ctx.stroke();
    }
    ctx.fillStyle = '#65401f';
    [[-w / 2 + 7, -h / 2 + 7], [w / 2 - 7, h / 2 - 7]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill(); });
    drawCracks(w, h, g, '#70401f');
  }

  function drawGlassBlock(w, h, g) {
    const grad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    grad.addColorStop(0, 'rgba(225,253,255,.94)'); grad.addColorStop(.45, 'rgba(105,211,238,.78)'); grad.addColorStop(1, 'rgba(50,151,193,.8)');
    ctx.fillStyle = grad;
    roundedRect(-w / 2, -h / 2, w, h, 3); ctx.fill();
    ctx.strokeStyle = '#2f8fb7'; ctx.lineWidth = 2; roundedRect(-w / 2, -h / 2, w, h, 3); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.82)'; ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.1);
    ctx.beginPath(); ctx.moveTo(-w / 2 + 5, -h / 2 + 6); ctx.lineTo(w / 2 - 8, h / 2 - 8); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.38)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-w / 2 + 8, h / 2 - 8); ctx.lineTo(w / 2 - 8, -h / 2 + 8); ctx.stroke();
    drawCracks(w, h, g, '#e7fbff');
  }

  function drawStoneBlock(w, h, g) {
    const grad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    grad.addColorStop(0, '#bac2c5'); grad.addColorStop(.5, '#8b969c'); grad.addColorStop(1, '#657279');
    ctx.fillStyle = grad;
    roundedRect(-w / 2, -h / 2, w, h, 4); ctx.fill();
    ctx.strokeStyle = '#505d63'; ctx.lineWidth = 2.5; roundedRect(-w / 2, -h / 2, w, h, 4); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1.2;
    for (let y = -h / 2 + 13; y < h / 2; y += 22) {
      ctx.beginPath(); ctx.moveTo(-w / 2 + 3, y); ctx.lineTo(w / 2 - 3, y); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(47,58,64,.2)';
    for (let i = 0; i < Math.min(8, Math.floor(w * h / 1700)); i++) {
      const x = ((Math.sin(g.crackSeed + i * 12.4) + 1) * 0.5 - 0.5) * (w - 10);
      const y = ((Math.cos(g.crackSeed + i * 9.1) + 1) * 0.5 - 0.5) * (h - 10);
      ctx.beginPath(); ctx.arc(x, y, 1.2 + (i % 3), 0, Math.PI * 2); ctx.fill();
    }
    drawCracks(w, h, g, '#454f54');
  }

  function drawTntBlock(w, h, g) {
    const grad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    grad.addColorStop(0, '#f06450'); grad.addColorStop(1, '#aa2f2b');
    ctx.fillStyle = grad;
    roundedRect(-w / 2, -h / 2, w, h, 4); ctx.fill();
    ctx.strokeStyle = '#74201f'; ctx.lineWidth = 3; roundedRect(-w / 2, -h / 2, w, h, 4); ctx.stroke();
    ctx.fillStyle = '#f7d788';
    ctx.fillRect(-w / 2 + 5, -7, w - 10, 14);
    ctx.fillStyle = '#7b2a24';
    ctx.font = `900 ${Math.min(16, w * 0.32)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('TNT', 0, 0);
    ctx.strokeStyle = '#5f231f'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -h / 2); ctx.quadraticCurveTo(8, -h / 2 - 11, 13, -h / 2 - 6); ctx.stroke();
  }

  function drawCracks(w, h, g, color) {
    const damage = 1 - clamp(g.hp / g.maxHp, 0, 1);
    if (damage < 0.28) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.45 + damage * 0.45;
    ctx.lineWidth = 1.3;
    const branches = damage > 0.68 ? 5 : damage > 0.45 ? 3 : 2;
    for (let i = 0; i < branches; i++) {
      const sx = (Math.sin(g.crackSeed + i * 2.7) * 0.3) * w;
      const sy = (Math.cos(g.crackSeed + i * 3.1) * 0.3) * h;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      let x = sx, y = sy;
      for (let j = 0; j < 3; j++) {
        x += (Math.sin(g.crackSeed + i * 5 + j) * 0.18) * w;
        y += (Math.cos(g.crackSeed + i * 7 + j) * 0.18) * h;
        x = clamp(x, -w / 2 + 3, w / 2 - 3);
        y = clamp(y, -h / 2 + 3, h / 2 - 3);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPig(body) {
    if (!body || body.game.dead) return;
    const r = body.game.radius;
    const hp = clamp(body.game.hp / body.game.maxHp, 0, 1);
    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(body.angle * 0.22);

    ctx.fillStyle = 'rgba(24,45,38,.18)';
    ctx.beginPath(); ctx.ellipse(5, r * 0.82, r * 0.9, r * 0.28, 0, 0, Math.PI * 2); ctx.fill();

    const grad = ctx.createRadialGradient(-r * .35, -r * .45, 2, 0, 0, r * 1.2);
    grad.addColorStop(0, '#a7ec72'); grad.addColorStop(.56, '#69c94f'); grad.addColorStop(1, '#318c3e');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#27733a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#68c94d';
    ctx.strokeStyle = '#27733a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-r * .52, -r * .65, r * .34, Math.PI * .9, Math.PI * 2.2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(r * .52, -r * .65, r * .34, Math.PI * .8, Math.PI * 2.1); ctx.fill(); ctx.stroke();

    const blink = Math.sin(performance.now() * .003 + body.game.faceSeed) > .985 ? .15 : 1;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-r * .33, -r * .25, r * .27, r * .31 * blink, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r * .33, -r * .25, r * .27, r * .31 * blink, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#26382c';
    ctx.beginPath(); ctx.arc(-r * .25, -r * .24, r * .09, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * .25, -r * .24, r * .09, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#8be166';
    ctx.strokeStyle = '#347f3d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, r * .18, r * .55, r * .38, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#387b3d';
    ctx.beginPath(); ctx.ellipse(-r * .19, r * .17, r * .09, r * .14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r * .19, r * .17, r * .09, r * .14, 0, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = '#285f32'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-r * .55, -r * .54); ctx.lineTo(-r * .12, -r * .43); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * .55, -r * .54); ctx.lineTo(r * .12, -r * .43); ctx.stroke();

    if (hp < .62) {
      ctx.fillStyle = `rgba(83,65,110,${(1 - hp) * .7})`;
      ctx.beginPath(); ctx.ellipse(r * .48, r * .45, r * .24, r * .15, -.4, 0, Math.PI * 2); ctx.fill();
    }
    if (body.game.flash > .02) {
      ctx.globalAlpha = body.game.flash * .55; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawBird(body) {
    if (!body || body.game.dead) return;
    const type = body.game.birdType;
    const r = body.game.radius;
    const angle = Math.atan2(body.velocity.y, body.velocity.x || 1) * 0.18 + body.angle * 0.12;
    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(angle);

    ctx.fillStyle = 'rgba(23,39,48,.18)';
    ctx.beginPath(); ctx.ellipse(4, r * .82, r * .85, r * .26, 0, 0, Math.PI * 2); ctx.fill();

    if (type === 'yellow') drawYellowBird(r);
    else if (type === 'blue') drawBlueBird(r);
    else if (type === 'bomb') drawBombBird(r, body);
    else drawRedBird(r);
    ctx.restore();
  }

  function drawRedBird(r) {
    const grad = ctx.createRadialGradient(-r * .35, -r * .45, 2, 0, 0, r * 1.2);
    grad.addColorStop(0, '#ff7662'); grad.addColorStop(.55, '#e54539'); grad.addColorStop(1, '#a91f29');
    ctx.fillStyle = grad; ctx.strokeStyle = '#8f2027'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    drawBirdFace(r, '#f6d8be', '#f5b73c');
    ctx.fillStyle = '#8e1d27';
    ctx.beginPath(); ctx.moveTo(-r * .25, -r * .84); ctx.lineTo(-r * .02, -r * 1.35); ctx.lineTo(r * .12, -r * .86); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-r * .02, -r * .88); ctx.lineTo(r * .35, -r * 1.25); ctx.lineTo(r * .32, -r * .76); ctx.fill();
    ctx.fillStyle = '#221f25';
    ctx.beginPath(); ctx.moveTo(-r * .86, r * .03); ctx.lineTo(-r * 1.35, -r * .22); ctx.lineTo(-r * 1.22, r * .25); ctx.closePath(); ctx.fill();
  }

  function drawYellowBird(r) {
    const grad = ctx.createLinearGradient(0, -r, 0, r);
    grad.addColorStop(0, '#ffe865'); grad.addColorStop(.65, '#f5c82f'); grad.addColorStop(1, '#d69519');
    ctx.fillStyle = grad; ctx.strokeStyle = '#a86e15'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.34); ctx.lineTo(r * 1.06, r * .88); ctx.quadraticCurveTo(0, r * 1.18, -r * 1.06, r * .88); ctx.closePath();
    ctx.fill(); ctx.stroke();
    drawBirdFace(r * .93, '#fff0bd', '#f29628', 2);
    ctx.fillStyle = '#26252a';
    ctx.beginPath(); ctx.moveTo(-r * .76, r * .2); ctx.lineTo(-r * 1.3, -.05 * r); ctx.lineTo(-r * 1.12, r * .46); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-r * .1, -r * 1.22); ctx.lineTo(-r * .18, -r * 1.62); ctx.lineTo(r * .05, -r * 1.28); ctx.fill();
  }

  function drawBlueBird(r) {
    const grad = ctx.createRadialGradient(-r * .3, -r * .45, 1, 0, 0, r * 1.2);
    grad.addColorStop(0, '#89d9ff'); grad.addColorStop(.58, '#3ba5e6'); grad.addColorStop(1, '#2474b9');
    ctx.fillStyle = grad; ctx.strokeStyle = '#23679d'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    drawBirdFace(r, '#e5f7ff', '#edb139');
    ctx.fillStyle = '#2b6fa4';
    ctx.beginPath(); ctx.moveTo(-r * .24, -r * .84); ctx.lineTo(0, -r * 1.35); ctx.lineTo(r * .13, -r * .82); ctx.fill();
    ctx.fillStyle = '#285572';
    ctx.beginPath(); ctx.moveTo(-r * .85, r * .08); ctx.lineTo(-r * 1.35, -r * .14); ctx.lineTo(-r * 1.2, r * .3); ctx.closePath(); ctx.fill();
  }

  function drawBombBird(r, body) {
    const grad = ctx.createRadialGradient(-r * .35, -r * .45, 2, 0, 0, r * 1.2);
    grad.addColorStop(0, '#59636b'); grad.addColorStop(.52, '#30353b'); grad.addColorStop(1, '#14181c');
    ctx.fillStyle = grad; ctx.strokeStyle = '#111519'; ctx.lineWidth = 2.8;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    drawBirdFace(r, '#686f72', '#ef8e35', 1.8);
    ctx.strokeStyle = '#493827'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(r * .1, -r * .9); ctx.quadraticCurveTo(r * .3, -r * 1.45, r * .56, -r * 1.25); ctx.stroke();
    const pulse = 3 + Math.sin(performance.now() * .012) * 2;
    ctx.fillStyle = body.game.abilityUsed ? '#777' : '#ffd348';
    ctx.beginPath(); ctx.arc(r * .58, -r * 1.27, pulse, 0, Math.PI * 2); ctx.fill();
  }

  function drawBirdFace(r, belly, beak, eyeGap = 1.7) {
    ctx.fillStyle = belly;
    ctx.beginPath(); ctx.ellipse(r * .12, r * .45, r * .7, r * .48, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-r * .25, -r * .17, r * .25, r * .31, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r * .27, -r * .17, r * .25, r * .31, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#24262a';
    ctx.beginPath(); ctx.arc(-r * .18, -r * .15, r * .085, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * .2, -r * .15, r * .085, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#32252a'; ctx.lineWidth = Math.max(2, r * .12); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-r * .58, -r * .52); ctx.lineTo(-r * .05, -r * .34); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * .58, -r * .52); ctx.lineTo(r * .05, -r * .34); ctx.stroke();
    ctx.fillStyle = beak;
    ctx.beginPath(); ctx.moveTo(r * .05, -r * .01); ctx.lineTo(r * .82, r * .16); ctx.lineTo(r * .02, r * .34); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#a9681e'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(r * .08, r * .17); ctx.lineTo(r * .66, r * .17); ctx.stroke();
  }

  function drawShockwaves() {
    shockwaves.forEach(s => {
      const alpha = clamp(s.life / s.maxLife, 0, 1);
      ctx.strokeStyle = s.hot ? `rgba(255,123,55,${alpha * .68})` : `rgba(255,244,172,${alpha * .76})`;
      ctx.lineWidth = s.hot ? 9 * alpha : 5 * alpha;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.stroke();
    });
  }

  function drawParticles() {
    particles.forEach(p => {
      const alpha = clamp(p.life / (p.maxLife || 50), 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot || 0);
      if (p.type === 'ring') {
        ctx.strokeStyle = p.color; ctx.lineWidth = 2 * alpha;
        ctx.beginPath(); ctx.arc(0, 0, p.size * (1.6 - alpha * .5), 0, Math.PI * 2); ctx.stroke();
      } else if (p.type === 'smoke') {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(0, 0, p.size * (1.6 - alpha * .5), 0, Math.PI * 2); ctx.fill();
      } else if (p.type === 'spark' || p.type === 'fire') {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(0, 0, p.size * alpha, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        const sy = p.type === 'glass' ? p.size * 1.5 : p.size;
        ctx.fillRect(-p.size / 2, -sy / 2, p.size, sy);
      }
      ctx.restore();
    });
  }

  function drawFloaters() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    floaters.forEach(f => {
      const alpha = clamp(f.life / f.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${15 + (1 - alpha) * 3}px system-ui`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(31,43,50,.55)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;
  }

  function roundedRect(x, y, w, h, r) {
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function toast(text, duration = 2200) {
    ui.toast.textContent = text;
    ui.toast.classList.add('show');
    state.toastUntil = performance.now() + duration;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => ui.toast.classList.remove('show'), duration);
  }

  function openPause() {
    if (state.mode === 'won' || state.mode === 'lost') return;
    state.paused = true;
    ui.pauseOverlay.classList.remove('hidden');
    updateUI();
  }

  function resume() {
    state.paused = false;
    state.lastFrame = performance.now();
    ui.pauseOverlay.classList.add('hidden');
    updateUI();
  }

  function togglePause() {
    if (!ui.pauseOverlay.classList.contains('hidden')) resume();
    else openPause();
  }

  function closeOverlays() {
    ui.pauseOverlay.classList.add('hidden');
    ui.resultOverlay.classList.add('hidden');
    ui.levelOverlay.classList.add('hidden');
    ui.helpOverlay.classList.add('hidden');
  }

  function anyOverlayOpen() {
    return !ui.pauseOverlay.classList.contains('hidden') ||
      !ui.resultOverlay.classList.contains('hidden') ||
      !ui.levelOverlay.classList.contains('hidden') ||
      !ui.helpOverlay.classList.contains('hidden') ||
      !ui.introOverlay.classList.contains('hidden');
  }

  function openLevels() {
    renderLevelGrid();
    ui.levelOverlay.classList.remove('hidden');
  }

  function openHelp() { ui.helpOverlay.classList.remove('hidden'); }

  function toggleGuide() {
    state.aimGuide = !state.aimGuide;
    saveGame();
    updateUI();
    toast(state.aimGuide ? 'เปิดเส้นเล็ง' : 'ปิดเส้นเล็ง');
  }

  function toggleMute() {
    state.muted = !state.muted;
    saveGame();
    updateUI();
    toast(state.muted ? 'ปิดเสียง' : 'เปิดเสียง');
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) stageWrap.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  function ensureAudio() {
    if (audioCtx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    audioCtx = new AudioContext();
    const length = Math.floor(audioCtx.sampleRate * 0.45);
    noiseBuffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }

  function tone(freq, duration, type = 'sine', gain = 0.06, endFreq = null, delay = 0) {
    if (state.muted || !audioCtx) return;
    const t = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t); osc.stop(t + duration + 0.02);
  }

  function noise(duration = 0.12, gain = 0.05, filterFreq = 900) {
    if (state.muted || !audioCtx || !noiseBuffer) return;
    const src = audioCtx.createBufferSource();
    const filter = audioCtx.createBiquadFilter();
    const g = audioCtx.createGain();
    src.buffer = noiseBuffer;
    filter.type = 'lowpass'; filter.frequency.value = filterFreq;
    const t = audioCtx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter).connect(g).connect(audioCtx.destination);
    src.start(t); src.stop(t + duration);
  }

  function sfx(type, strength = 1) {
    if (state.muted) return;
    ensureAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const s = clamp(strength, 0.2, 1.2);
    if (type === 'grab') tone(180, .05, 'sine', .025);
    else if (type === 'launch') { tone(230, .16, 'triangle', .07, 520); tone(120, .11, 'sine', .035, 80); }
    else if (type === 'impact') { noise(.05 + .06 * s, .025 * s, 700); tone(90, .08, 'sine', .025 * s, 55); }
    else if (type === 'crack') { noise(.07, .035, 1800); tone(420, .05, 'square', .018, 250); }
    else if (type === 'glass') { noise(.16, .05, 3500); tone(1100, .17, 'sine', .035, 420); }
    else if (type === 'break') { noise(.13, .055, 1100); tone(150, .11, 'triangle', .04, 80); }
    else if (type === 'pigHit') tone(310, .08, 'square', .028, 230);
    else if (type === 'pigPop') { tone(520, .1, 'square', .055, 760); tone(760, .12, 'sine', .035, 950, .06); }
    else if (type === 'boost') { tone(240, .22, 'sawtooth', .05, 980); noise(.16, .02, 2600); }
    else if (type === 'split') { tone(620, .12, 'triangle', .04, 980); tone(760, .12, 'triangle', .035, 1180, .04); }
    else if (type === 'boom') { noise(.42, .12, 520); tone(78, .4, 'sine', .12, 35); }
    else if (type === 'win') { [523, 659, 784, 1047].forEach((f, i) => tone(f, .22, 'triangle', .045, f * 1.02, i * .09)); }
    else if (type === 'fail') { tone(270, .25, 'sawtooth', .045, 170); tone(180, .3, 'triangle', .04, 110, .18); }
  }

  function onKeyDown(event) {
    if (event.repeat) return;
    const key = event.key.toLowerCase();
    if (event.code === 'Space') { event.preventDefault(); useAbility(); }
    else if (key === 'r') startLevel(state.levelIndex);
    else if (key === 'g') toggleGuide();
    else if (event.key === 'Escape') {
      if (!ui.helpOverlay.classList.contains('hidden')) ui.helpOverlay.classList.add('hidden');
      else if (!ui.levelOverlay.classList.contains('hidden')) ui.levelOverlay.classList.add('hidden');
      else togglePause();
    }
    else if (key === 'p') togglePause();
    else if (key === 'm') toggleMute();
  }

  ui.tutorialClose.addEventListener('click', closeTutorial);
  ui.pauseBtn.addEventListener('click', togglePause);
  ui.guideBtn.addEventListener('click', toggleGuide);
  ui.muteBtn.addEventListener('click', toggleMute);
  ui.fullscreenBtn.addEventListener('click', toggleFullscreen);
  ui.abilityBtn.addEventListener('click', useAbility);
  ui.resumeBtn.addEventListener('click', resume);
  ui.pauseRestartBtn.addEventListener('click', () => startLevel(state.levelIndex));
  ui.pauseLevelsBtn.addEventListener('click', () => { state.paused = false; ui.pauseOverlay.classList.add('hidden'); openLevels(); });
  ui.nextBtn.addEventListener('click', () => startLevel(state.levelIndex + 1));
  ui.retryBtn.addEventListener('click', () => startLevel(state.levelIndex));
  ui.resultLevelsBtn.addEventListener('click', () => { ui.resultOverlay.classList.add('hidden'); openLevels(); });
  ui.closeLevelsBtn.addEventListener('click', () => ui.levelOverlay.classList.add('hidden'));
  ui.closeHelpBtn.addEventListener('click', () => ui.helpOverlay.classList.add('hidden'));
  ui.resetSaveBtn.addEventListener('click', resetProgress);
  ui.introSkipBtn.addEventListener('click', () => { ensureAudio(); endIntro(true); });
  ui.replayIntroBtn.addEventListener('click', playIntro);
  ui.restartBtn.addEventListener('click', () => startLevel(state.levelIndex));
  ui.levelsBtn.addEventListener('click', openLevels);
  ui.helpBtn.addEventListener('click', openHelp);

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('lostpointercapture', () => {
    if (!state.dragging || !currentBird) return;
    state.dragging = false;
    state.pointerId = null;
    Body.setPosition(currentBird, SLING);
    Body.setVelocity(currentBird, { x: 0, y: 0 });
    state.mode = 'ready';
    ui.powerWrap.classList.remove('show');
    updateUI(true);
  });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', resizeCanvas);
  document.addEventListener('visibilitychange', () => { if (document.hidden && state.mode !== 'won' && state.mode !== 'lost') openPause(); });

  state.muted = !!state.save.settings?.muted;
  state.aimGuide = state.save.settings?.guide !== false;
  resizeCanvas();
  initClouds();
  startLevel(Math.min(state.save.unlocked - 1, levels.length - 1));
  playIntro();
  window.__GAME_DEBUG__ = {
    state, engine, levels,
    get currentBird() { return currentBird; },
    get pigs() { return pigs; },
    get blocks() { return blocks; },
    get fragments() { return fragments; },
    startLevel, useAbility, fixedUpdate, updateTurnFlow, armPhysicsDamage
  };
  requestAnimationFrame(frame);

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
})();
