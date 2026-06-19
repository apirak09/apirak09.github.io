

(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const ui = {
    status: document.getElementById('statusText'),
    level: document.getElementById('levelText'),
    score: document.getElementById('scoreText'),
    birds: document.getElementById('birdsText'),
    pigs: document.getElementById('pigsText'),
    best: document.getElementById('bestText'),
    queue: document.getElementById('queueBar'),
    toast: document.getElementById('toast'),
    resultModal: document.getElementById('resultModal'),
    modalTitle: document.getElementById('modalTitle'),
    modalStars: document.getElementById('modalStars'),
    modalText: document.getElementById('modalText'),
    next: document.getElementById('nextBtn'),
    retry: document.getElementById('retryBtn'),
    closeModal: document.getElementById('closeModalBtn'),
    levelModal: document.getElementById('levelModal'),
    levelGrid: document.getElementById('levelGrid'),
    closeLevel: document.getElementById('closeLevelBtn'),
    helpModal: document.getElementById('helpModal'),
    startHelp: document.getElementById('startHelpBtn'),
    restart: document.getElementById('restartBtn'),
    levels: document.getElementById('levelsBtn'),
    help: document.getElementById('helpBtn')
  };

  const W = canvas.width;
  const H = canvas.height;
  const GROUND = 500;
  const SLING_X = 158;
  const SLING_Y = 404;
  const MAX_DRAG = 115;
  const POWER = 0.23;
  const GRAVITY = 0.34;
  const SAVE_KEY = 'mini-angry-birds-v17-save';
  const HELP_KEY = 'mini-angry-birds-v17-help-seen';

  // v17 damage goal: use calibrated HP/damage numbers instead of over-shielding blocks.
  // Direct bird hits now subtract real HP damage, while sleep/friction still prevents
  // weak accidental taps from collapsing the whole structure.
  const PHYSICS = {
    sleepInvMassScale: 0.10,
    contactPropagationImpulse: 7.2,
    nearWakeRadius: 18,
    pigImpactThreshold: 2.65,
    crushVelocityThreshold: 0.95,
    maxBlockSpeed: 8.2,
    maxAngularSpeed: 0.034,
    leverTorqueScale: 0.28,
    staticBounce: 0.12,
    chipOnlyImpulseScale: 0.15,
    stageWakeMultiplier: 0.78,
    blockBreakWakeRadius: 34,
    fullImpactSpeed: 18.0,
    directHitCooldownFrames: 10,
    explosionDamage: 500,
    explosionRadius: 118
  };

  const materials = {
    // HP follows the requested balance: glass/ice 40, wood 100, stone 250, TNT 10.
    // `damage` is only a secondary threshold for debris/block-block impacts; direct
    // bird and explosion damage subtracts from HP using the calibrated numbers below.
    wood:  { hp: 100, mass: 1.34, fill: '#c78542', edge: '#7b4d23', light: '#e5b66f', name: 'Wood',  restitution: .13, friction: .82, wake: 3.6, damage: 18, crack1: .66, crack2: .34 },
    stone: { hp: 250, mass: 5.65, fill: '#87929a', edge: '#59656f', light: '#bac3c8', name: 'Stone', restitution: .05, friction: .97, wake: 7.8, damage: 58, crack1: .60, crack2: .26 },
    ice:   { hp: 40,  mass: 1.02, fill: '#8edff1', edge: '#3b9dc0', light: '#d7fbff', name: 'Glass', restitution: .22, friction: .24, wake: 2.3, damage: 9,  crack1: .72, crack2: .42 },
    tnt:   { hp: 10,  mass: 1.30, fill: '#df5148', edge: '#8b2923', light: '#ffb0a2', name: 'TNT',   restitution: .14, friction: .72, wake: 2.4, damage: 3,  crack1: .70, crack2: .36 }
  };

  const birds = {
    red:    { label: 'แดง', icon: '🔴', r: 17, mass: 1.08, color: '#e65245', belly: '#ffb19a', beak: '#f5b542', power: 1.08, impactDamage: 300, hint: 'แดง: ชาร์จเต็มชนตรง ๆ ≈ 300 ดาเมจ' },
    yellow: { label: 'เหลือง', icon: '🟡', r: 15, mass: .9,  color: '#ffd34a', belly: '#fff0a6', beak: '#ef8d32', power: .92, impactDamage: 300, boostedDamage: 500, hint: 'เหลือง: ชาร์จเต็ม 300 / กดสกิล ≈ 500 ดาเมจ' },
    bomb:   { label: 'ระเบิด', icon: '⚫', r: 20, mass: 1.35, color: '#2c3338', belly: '#58646c', beak: '#ff8b50', power: 1.2, impactDamage: 300, explosionDamage: 500, hint: 'ดำ: ชน 300 / กดสกิลระเบิด ≈ 500 ดาเมจ' },
    blue:   { label: 'ฟ้า', icon: '🔵', r: 14, mass: .72, color: '#48aeea', belly: '#c9efff', beak: '#f2b84d', power: .82, impactDamage: 150, splitDamage: 150, hint: 'ฟ้า: ตัวหลัก 150 / แยกร่าง 3 ตัว ตัวละ 150' }
  };

  function B(x, y, w, h, material, angle = 0) { return { x, y, w, h, material, angle }; }
  function P(x, y, r = 16, hp = 1) { return { x, y, r, hp }; }

  const levels = (window.LEVEL_PACKS || []).flat();
  if (!levels.length) throw new Error('No levels loaded. Check script order for src/levels/*.js');

  let state = {
    levelIndex: 0,
    score: 0,
    shotsUsed: 0,
    mode: 'ready',
    dragging: false,
    paused: false,
    aimGuide: true,
    lastTime: performance.now(),
    settleFrames: 0,
    turnFrames: 0,
    physicsFrame: 0,
    turnLocked: false,
    turnId: 0,
    toastTimer: 0,
    toastText: '',
    sound: true,
    failCount: 0,
    save: loadSave()
  };

  let bird = null;
  let pigs = [];
  let blocks = [];
  let particles = [];
  let floats = [];
  let trajectory = [];
  let lastShotPath = [];
  let blueFragments = [];
  let shockwaves = [];
  let shake = 0;
  let nextBlockId = 1;
  let audioCtx = null;

  function loadSave() {
    // v16: every stage is selectable from the first load. Best stars are still
    // stored per level, so reloads do not lock content again.
    const allUnlocked = Array.isArray(levels) ? levels.length : 25;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return { unlocked: allUnlocked, best: {} };
      const data = JSON.parse(raw);
      return { unlocked: allUnlocked, best: data.best && typeof data.best === 'object' ? data.best : {} };
    } catch { return { unlocked: allUnlocked, best: {} }; }
  }

  function saveGame() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state.save)); } catch { /* ignore private mode */ }
  }

  function cloneBlock(t) {
    const m = materials[t.material] || materials.wood;
    const areaScale = Math.max(.85, Math.pow((t.w * t.h) / 2500, 0.82));
    const mass = m.mass * areaScale;
    // Keep HP close to the requested game balance. Size affects mass/physics, not HP,
    // otherwise long beams become practically unbreakable. Level data may still
    // override hp for special pieces.
    const maxHp = Math.max(1, Math.round(Number(t.hp) || m.hp));
    return {
      ...t,
      id: nextBlockId++,
      x0: t.x,
      y0: t.y,
      vx: 0,
      vy: 0,
      angle: Number(t.angle) || 0,
      av: 0,
      hp: maxHp,
      maxHp,
      damageStage: 0,
      damageFlash: 0,
      stageAwarded: 0,
      mass,
      inertia: Math.max(120, mass * (t.w * t.w + t.h * t.h) / 12),
      destroyed: false,
      exploded: false,
      sleep: true,
      restFrames: 0,
      initialSupport: 0,
      touched: false
    };
  }

  function clonePig(t) { return { ...t, x0: t.x, y0: t.y, vx: 0, vy: 0, alive: true, hp: t.hp || 1, flash: 0, scored: false }; }

  function blockHpPct(b) {
    if (!b || !b.maxHp) return 1;
    return clamp(b.hp / b.maxHp, 0, 1);
  }

  function blockDamageStage(b) {
    if (!b || b.destroyed) return 3;
    const m = materials[b.material] || materials.wood;
    const pct = blockHpPct(b);
    if (pct <= 0) return 3;          // broken
    if (pct <= (m.crack2 ?? .34)) return 2; // heavy cracks / near break
    if (pct <= (m.crack1 ?? .66)) return 1; // cracked
    return 0;                        // intact
  }

  function setBlockDamageStage(b, stage) {
    b.damageStage = Math.max(b.damageStage || 0, stage);
    b.damageFlash = Math.max(b.damageFlash || 0, stage === 1 ? 12 : 18);
  }

  function damageResistance(b) {
    const stage = blockDamageStage(b);
    const mat = materials[b.material] || materials.wood;
    // Intact/sleeping blocks absorb small impacts as cracks. A badly cracked block
    // becomes easier to wake and finally breaks, so damage is progressive.
    const intactBonus = stage === 0 ? 1.18 : stage === 1 ? 1.0 : .80;
    const sleepBonus = b.sleep ? 1.12 : 1;
    const stoneBonus = b.material === 'stone' ? 1.22 : 1;
    return (mat.damage || 6) * intactBonus * sleepBonus * stoneBonus;
  }


  function startLevel(index, resetScore = false) {
    const i = clamp(index, 0, levels.length - 1);
    state.levelIndex = i;
    state.shotsUsed = 0;
    state.mode = 'ready';
    state.dragging = false;
    state.paused = false;
    state.settleFrames = 0;
    state.turnFrames = 0;
    state.physicsFrame = 0;
    state.turnLocked = false;
    state.turnId = 0;
    if (resetScore) state.score = 0;
    pigs = levels[i].pigs.map(clonePig);
    blocks = levels[i].blocks.map(cloneBlock);
    particles = [];
    floats = [];
    trajectory = [];
    lastShotPath = [];
    blueFragments = [];
    shockwaves = [];
    shake = 0;
    sanitizeLevelObjects();
    captureInitialSupports();
    closeAllModals();
    spawnNextBird(true);
    toast(`ด่าน ${i + 1}: ${levels[i].name}`);
    updateUI();
    renderLevelGrid();
  }

  function spawnNextBird(initial = false) {
    trajectory = [];
    state.dragging = false;
    state.settleFrames = 0;
    state.turnFrames = 0;
    state.physicsFrame = 0;
    state.turnLocked = false;
    state.turnId = 0;
    blueFragments = [];

    if (alivePigs() === 0 && !initial) return finishLevel();
    const level = levels[state.levelIndex];
    if (state.shotsUsed >= level.birds.length) {
      bird = null;
      return failLevel();
    }

    const type = level.birds[state.shotsUsed];
    const spec = birds[type] || birds.red;
    bird = {
      type,
      x: SLING_X,
      y: SLING_Y,
      r: spec.r,
      vx: 0,
      vy: 0,
      mass: spec.mass,
      launched: false,
      abilityUsed: false,
      asleep: false,
      age: 0,
      trail: []
    };
    state.mode = 'ready';
    toast(spec.hint);
    updateUI();
  }

  function alivePigs() { return pigs.filter(p => p.alive).length; }

  function birdsRemaining() {
    const total = levels[state.levelIndex].birds.length;
    return Math.max(0, total - state.shotsUsed);
  }

  function updateUI() {
    const level = levels[state.levelIndex];
    ui.level.textContent = `${state.levelIndex + 1}/${levels.length}`;
    ui.score.textContent = Math.round(state.score).toLocaleString('th-TH');
    ui.birds.textContent = birdsRemaining();
    ui.pigs.textContent = alivePigs();
    const best = state.save.best[String(state.levelIndex + 1)] || 0;
    ui.best.textContent = best ? '★'.repeat(best) + '☆'.repeat(3 - best) : '☆☆☆';

    if (state.paused) ui.status.textContent = 'หยุดชั่วคราว — กด P เพื่อเล่นต่อ';
    else if (state.mode === 'ready') ui.status.textContent = state.shotsUsed > 0 ? `นก${bird ? birds[bird.type].label : ''}พร้อมแล้ว • เส้นจางคือรอยยิงครั้งก่อน` : `ลากนก${bird ? birds[bird.type].label : ''}ไปด้านหลัง แล้วปล่อยเพื่อยิง`;
    else if (state.mode === 'aiming') ui.status.textContent = 'ปล่อยเพื่อยิง • ลากกลับมาใกล้หนังสติ๊กเพื่อยกเลิก';
    else if (state.mode === 'flying') ui.status.textContent = bird && !bird.abilityUsed && bird.type !== 'red' ? 'แตะ/คลิก หรือกด Space เพื่อใช้สกิล' : 'รอดูผลการชน...';
    else if (state.mode === 'settling') ui.status.textContent = 'กำลังเตรียมนกตัวถัดไป...';
    else if (state.mode === 'won') ui.status.textContent = 'ผ่านด่านแล้ว';
    else if (state.mode === 'lost') ui.status.textContent = 'นกหมดแล้ว ลองใหม่อีกครั้ง';

    renderQueue();
  }

  function renderQueue() {
    const q = levels[state.levelIndex].birds;
    ui.queue.innerHTML = '';
    q.forEach((type, i) => {
      const el = document.createElement('div');
      el.className = 'birdToken';
      if (i < state.shotsUsed) el.classList.add('used');
      if (i === state.shotsUsed && bird && !bird.launched) el.classList.add('current');
      el.textContent = birds[type]?.icon || '●';
      el.title = birds[type]?.hint || type;
      ui.queue.appendChild(el);
    });
  }

  function renderLevelGrid() {
    ui.levelGrid.innerHTML = '';
    levels.forEach((level, i) => {
      const btn = document.createElement('button');
      const best = state.save.best[String(i + 1)] || 0;
      const locked = false;
      btn.className = `levelDot ${i === state.levelIndex ? 'active' : ''} ${locked ? 'locked' : ''}`;
      btn.disabled = false;
      btn.textContent = `${i + 1}\n${'★'.repeat(best) || '☆'}`;
      btn.title = `${level.name} — ${best || 0} ดาว`;
      btn.addEventListener('click', () => startLevel(i));
      ui.levelGrid.appendChild(btn);
    });
  }

  function loop(now) {
    const raw = Math.min(2.2, (now - state.lastTime) / 16.6667);
    state.lastTime = now;
    if (!state.paused) update(raw);
    draw();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    if (state.toastTimer > 0) {
      state.toastTimer -= dt;
      if (state.toastTimer <= 0) ui.toast.classList.remove('show');
    }

    updateParticles(dt);
    updateShockwaves(dt);
    updateFloatTexts(dt);
    if (state.mode === 'won' || state.mode === 'lost') return;

    // v11 stable-awake physics:
    // Blocks start asleep. They only become dynamic after a bird/explosion hits them
    // or after a support that existed at level start is removed. This prevents the
    // whole castle from collapsing by itself before the first shot.
    const physicsActive = !!(bird && bird.launched) || blueFragments.some(f => !f.asleep) || state.mode === 'flying' || state.mode === 'settling';
    if (!physicsActive) {
      calmBlocks();
      updateUI();
      return;
    }

    const steps = clamp(Math.ceil(dt * 1.35), 1, 4);
    const stepDt = dt / steps;
    for (let s = 0; s < steps; s++) {
      state.physicsFrame += 1;
      updateBird(stepDt);
      updateBlueFragments(stepDt);
      updateLeverForces(stepDt);
      updateBlocks(stepDt);
      solveBlockCollisions(stepDt);
      birdBlockCollisions();
      blueFragmentBlockCollisions();
      pigCollisions();
      cleanDestroyedBlocks();
      wakeUnsupportedBlocks();
      if (alivePigs() === 0 && state.shotsUsed > 0) break;
    }
    calmBlocks();

    if (alivePigs() === 0 && state.shotsUsed > 0) return finishLevel();
    handleTurnFlow(dt);
    updateUI();
  }

  function calmBlocks() {
    blocks.forEach(b => {
      if (!b || b.destroyed) return;
      if (b.damageFlash > 0) b.damageFlash -= 1;
      if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.vx) || !Number.isFinite(b.vy) || !Number.isFinite(b.angle) || !Number.isFinite(b.av)) {
        b.x = b.x0; b.y = b.y0; b.vx = 0; b.vy = 0; b.angle = 0; b.av = 0;
      }
      const aabb = blockAABB(b);
      if (aabb.minX < 0) b.x += -aabb.minX;
      if (aabb.maxX > W) b.x -= aabb.maxX - W;
      const aabb2 = blockAABB(b);
      if (aabb2.maxY > GROUND) b.y -= aabb2.maxY - GROUND;
      const groundRest = Math.abs(blockAABB(b).maxY - GROUND) < 1.4;
      if (groundRest && Math.hypot(b.vx, b.vy) < .075 && Math.abs(b.av || 0) < .0018) {
        b.vx = 0; b.vy = 0; b.av = 0;
      }
      if (!b.sleep && Math.hypot(b.vx, b.vy) < .09 && Math.abs(b.av || 0) < .0018) {
        b.restFrames = (b.restFrames || 0) + 1;
        if (b.restFrames > 36) { b.sleep = true; b.vx = 0; b.vy = 0; b.av = 0; }
      } else if (!b.sleep) {
        b.restFrames = 0;
      }
      if (Math.abs(b.angle) > 1.20) b.angle = clamp(b.angle, -1.20, 1.20);
    });
  }

  function updateBird(dt) {
    if (!bird || !bird.launched || bird.asleep) return;
    bird.age += dt;
    state.turnFrames += dt;

    bird.trail.push({ x: bird.x, y: bird.y, life: 26 });
    if (bird.trail.length > 16) bird.trail.shift();
    bird.trail.forEach(t => t.life -= dt);
    const ghostLast = lastShotPath[lastShotPath.length - 1];
    if (!ghostLast || Math.hypot(ghostLast.x - bird.x, ghostLast.y - bird.y) > 10) {
      lastShotPath.push({ x: bird.x, y: bird.y });
      if (lastShotPath.length > 160) lastShotPath.shift();
    }

    bird.x += bird.vx * dt;
    bird.y += bird.vy * dt;
    bird.vy += GRAVITY * dt;
    bird.vx *= Math.pow(.997, dt);
    bird.vy *= Math.pow(.999, dt);

    if (bird.y + bird.r > GROUND) {
      bird.y = GROUND - bird.r;
      const impact = Math.abs(bird.vy);
      if (impact > 2) burst(bird.x, GROUND, 8, 'rgba(135,96,48,.25)', 3.2);
      bird.vy *= -0.24;
      bird.vx *= Math.pow(.70, dt);
      if (Math.abs(bird.vy) < .45) bird.vy = 0;
    }
    if (bird.x < -120 || bird.x > W + 140 || bird.y > H + 100 || bird.age > 640) bird.asleep = true;
    if (bird.age > 45 && Math.hypot(bird.vx, bird.vy) < .10 && bird.y >= GROUND - bird.r - 1) bird.asleep = true;
  }

  function updateBlueFragments(dt) {
    if (!blueFragments.length) return;
    blueFragments.forEach(f => {
      if (f.asleep) return;
      f.age += dt;
      f.trail.push({ x: f.x, y: f.y, life: 18 });
      if (f.trail.length > 10) f.trail.shift();
      f.trail.forEach(t => t.life -= dt);

      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += GRAVITY * dt;
      f.vx *= Math.pow(.996, dt);
      f.vy *= Math.pow(.999, dt);

      if (f.y + f.r > GROUND) {
        f.y = GROUND - f.r;
        const impact = Math.abs(f.vy);
        if (impact > 2.2) burst(f.x, GROUND, 5, 'rgba(82,176,220,.28)', 2.8);
        f.vy *= -0.22;
        f.vx *= Math.pow(.70, dt);
        if (Math.abs(f.vy) < .38) f.vy = 0;
      }
      if (f.x < -120 || f.x > W + 140 || f.y > H + 100 || f.age > 360) f.asleep = true;
      if (f.age > 35 && Math.hypot(f.vx, f.vy) < .12 && f.y >= GROUND - f.r - 1) f.asleep = true;
    });
    blueFragments = blueFragments.filter(f => !f.asleep || f.age < 36);
  }

  function updateBlocks(dt) {
    blocks.forEach(b => {
      if (b.destroyed || b.sleep) return;
      b.vx = clamp(b.vx || 0, -PHYSICS.maxBlockSpeed, PHYSICS.maxBlockSpeed);
      b.vy = clamp(b.vy || 0, -PHYSICS.maxBlockSpeed, PHYSICS.maxBlockSpeed);
      b.av = clamp(b.av || 0, -PHYSICS.maxAngularSpeed, PHYSICS.maxAngularSpeed);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.angle += (b.av || 0) * dt;
      b.vy += GRAVITY * dt;
      b.vx *= Math.pow(.976, dt);
      b.vy *= Math.pow(.992, dt);
      b.av = (b.av || 0) * Math.pow(.945, dt);
      b.angle = clamp(b.angle, -1.20, 1.20);

      const corners = blockCorners(b);
      let low = corners[0];
      corners.forEach(c => { if (c.y > low.y) low = c; });
      if (low.y > GROUND) {
        const impact = Math.abs(b.vy);
        b.y -= low.y - GROUND;
        if (impact > 5.2) damageBlock(b, (impact - 5.2) * 1.15, low.x, GROUND);
        const cx = b.x + b.w / 2;
        const torqueArm = (low.x - cx) / Math.max(24, b.w);
        b.av += torqueArm * b.vy * .006;
        b.vy *= -0.10;
        if (Math.abs(b.vy) < .30) b.vy = 0;
        b.vx *= Math.pow(.62, dt);
        b.av *= .50;
      }

      const aabb = blockAABB(b);
      if (aabb.minX < 0) { b.x += -aabb.minX; b.vx = Math.abs(b.vx) * .35; b.av *= .78; }
      if (aabb.maxX > W) { b.x -= aabb.maxX - W; b.vx = -Math.abs(b.vx) * .35; b.av *= .78; }
    });
  }


  function updateLeverForces(dt) {
    // Lightweight rotational model for long beams. It is not a full Box2D solver,
    // but it fixes the biggest visual problem: a beam with one support should tip
    // around that support instead of staying perfectly horizontal.
    blocks.forEach(b => {
      if (!b || b.destroyed || b.sleep || b.material === 'tnt') return;
      const longBeam = b.w > b.h * 2.25;
      if (!longBeam) return;

      const aabb = blockAABB(b);
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const supports = [];
      const addSupport = (wx, wy, width = 1) => {
        const l = worldToLocal(b, wx, wy);
        supports.push({ x: clamp(l.x, -b.w / 2, b.w / 2), width });
      };

      // Ground support from corners touching the floor.
      blockCorners(b).forEach(c => {
        if (Math.abs(c.y - GROUND) < 5) addSupport(c.x, c.y, 18);
      });

      // Support from blocks underneath the beam.
      blocks.forEach(o => {
        if (o === b || o.destroyed) return;
        const oa = blockAABB(o);
        const overlap = Math.min(aabb.maxX, oa.maxX) - Math.max(aabb.minX, oa.minX);
        if (overlap <= 5) return;
        const verticalGap = oa.minY - aabb.maxY;
        const otherIsBelow = (oa.minY + oa.maxY) / 2 > cy - 2;
        if (otherIsBelow && verticalGap > -10 && verticalGap < 18) {
          const wx = (Math.max(aabb.minX, oa.minX) + Math.min(aabb.maxX, oa.maxX)) / 2;
          const wy = Math.min(oa.minY, aabb.maxY);
          addSupport(wx, wy, overlap);
        }
      });

      if (!supports.length) return;
      const minS = Math.min(...supports.map(s => s.x - s.width * .5));
      const maxS = Math.max(...supports.map(s => s.x + s.width * .5));
      const supportCenter = supports.reduce((sum, s) => sum + s.x * Math.max(1, s.width), 0) / supports.reduce((sum, s) => sum + Math.max(1, s.width), 0);

      let massSum = b.mass;
      let weightedX = 0;

      // Load from blocks sitting on top of the beam.
      blocks.forEach(o => {
        if (o === b || o.destroyed) return;
        const oa = blockAABB(o);
        const overlap = Math.min(aabb.maxX, oa.maxX) - Math.max(aabb.minX, oa.minX);
        if (overlap <= 5) return;
        const gap = aabb.minY - oa.maxY;
        const otherAbove = (oa.minY + oa.maxY) / 2 < cy + 4;
        if (otherAbove && gap > -18 && gap < 16) {
          const ocx = (oa.minX + oa.maxX) / 2;
          const ocy = (oa.minY + oa.maxY) / 2;
          const l = worldToLocal(b, ocx, ocy);
          const load = Math.max(.25, o.mass || 1);
          massSum += load;
          weightedX += clamp(l.x, -b.w / 2, b.w / 2) * load;
        }
      });

      // Load from pigs resting on/under the structure. This nudges long platforms
      // toward the side that actually carries weight.
      pigs.forEach(p => {
        if (!p.alive) return;
        const insideX = p.x > aabb.minX - p.r && p.x < aabb.maxX + p.r;
        const closeY = Math.abs((p.y - p.r) - aabb.maxY) < 18 || Math.abs((p.y + p.r) - aabb.minY) < 20;
        if (!insideX || !closeY) return;
        const l = worldToLocal(b, p.x, p.y);
        const load = .42;
        massSum += load;
        weightedX += clamp(l.x, -b.w / 2, b.w / 2) * load;
      });

      const comX = weightedX / Math.max(.001, massSum);
      const margin = Math.max(7, b.w * .035);
      let lever = 0;
      if (comX < minS - margin) lever = comX - minS;
      else if (comX > maxS + margin) lever = comX - maxS;
      else {
        // If the COM is barely inside a very narrow support, allow small rocking
        // instead of snapping to a locked, perfectly flat beam.
        const narrow = Math.max(1, maxS - minS) < b.w * .22;
        if (narrow) lever = (comX - supportCenter) * .35;
      }

      if (lever) {
        const strength = clamp(Math.abs(lever) / Math.max(30, b.w * .5), 0, 1);
        b.av += (lever / Math.max(36, b.w)) * (0.010 + 0.018 * strength) * PHYSICS.leverTorqueScale * dt;
        b.vy += GRAVITY * .018 * strength * dt;
        const px = cx + Math.cos(b.angle) * supportCenter;
        const py = cy + Math.sin(b.angle) * supportCenter;
        if (Math.abs(lever) > b.w * .18 && state.turnFrames % 9 < dt) {
          burst(px, py, 2, 'rgba(255,255,255,.42)', 1.2);
        }
      } else {
        b.av *= Math.pow(.94, dt);
      }
    });
  }


  function blockSupportCount(b) {
    if (!b || b.destroyed) return 0;
    const a = blockAABB(b);
    let count = 0;
    if (a.maxY >= GROUND - 3) count += 2;
    blocks.forEach(o => {
      if (!o || o === b || o.destroyed) return;
      const oa = blockAABB(o);
      const overlap = Math.min(a.maxX, oa.maxX) - Math.max(a.minX, oa.minX);
      if (overlap < 8) return;
      const gap = oa.minY - a.maxY;
      const centerBelow = (oa.minY + oa.maxY) / 2 > (a.minY + a.maxY) / 2;
      if (centerBelow && gap > -8 && gap < 14) count += Math.max(1, Math.round(overlap / 55));
    });
    return count;
  }

  function captureInitialSupports() {
    blocks.forEach(b => {
      b.initialSupport = blockSupportCount(b);
      b.sleep = true;
      b.restFrames = 0;
      b.touched = false;
      b.vx = 0; b.vy = 0; b.av = 0;
    });
  }

  function wakeBlock(b, reason = 'hit') {
    if (!b || b.destroyed || !('w' in b)) return;
    b.sleep = false;
    b.touched = true;
    b.restFrames = 0;
    // v16: do not wake adjacent structure from a light hit. Contact propagation
    // is now impulse-gated inside resolveBodyImpulse; explosions/destruction
    // still wake nearby pieces.
    if (reason === 'explode') wakeNearbyBlocks(b, reason);
  }

  function wakeNearbyBlocks(src, reason = 'contact', radius = PHYSICS.nearWakeRadius) {
    const sa = blockAABB(src);
    blocks.forEach(o => {
      if (!o || o === src || o.destroyed || !o.sleep) return;
      const oa = blockAABB(o);
      const overlapX = Math.min(sa.maxX, oa.maxX) - Math.max(sa.minX, oa.minX);
      const overlapY = Math.min(sa.maxY, oa.maxY) - Math.max(sa.minY, oa.minY);
      const closeX = overlapX > -radius;
      const closeY = overlapY > -radius;
      if (closeX && closeY) {
        // Intact stone neighbors do not wake from a cosmetic crack/break nearby.
        if (reason === 'local-break' && o.material === 'stone' && blockDamageStage(o) === 0) return;
        o.sleep = false;
        o.restFrames = 0;
        if (reason === 'explode') {
          const dx = centerX(o) - centerX(src), dy = centerY(o) - centerY(src);
          const d = Math.hypot(dx, dy) || 1;
          o.vx += (dx / d) * .55;
          o.vy += (dy / d) * .34;
        }
      }
    });
  }

  function wakeUnsupportedBlocks() {
    // Do NOT wake decorative/supportless blocks just because they were designed
    // with an overhang. Only wake bodies when support that existed at level load
    // has actually been lost. This keeps the level stable before and after a weak shot.
    blocks.forEach(b => {
      if (!b || b.destroyed || !b.sleep) return;
      const initial = b.initialSupport || 0;
      if (initial <= 0) return;
      const now = blockSupportCount(b);
      const longBeam = b.w > b.h * 2.25;
      if (now <= 0 || (longBeam && now <= Math.max(0, initial - 2))) {
        wakeBlock(b, 'support');
        b.vy += .12;
        const a = blockAABB(b);
        const supportBias = now <= 0 ? 0 : .004;
        b.av += ((centerX(b) - (a.minX + a.maxX) / 2) >= 0 ? supportBias : -supportBias);
      }
    });
  }

  function solveBlockCollisions(dt) {
    for (let i = 0; i < blocks.length; i++) {
      const a = blocks[i];
      if (!a || a.destroyed) continue;
      for (let j = i + 1; j < blocks.length; j++) {
        const b = blocks[j];
        if (!b || b.destroyed) continue;
        if (a.sleep && b.sleep) continue;
        const hit = rectRectSAT(a, b);
        if (!hit.collided) continue;
        resolveBodyImpulse(a, b, hit.nx, hit.ny, hit.depth, {
          restitution: Math.min(materials[a.material]?.restitution ?? .22, materials[b.material]?.restitution ?? .22),
          friction: Math.max(materials[a.material]?.friction ?? .55, materials[b.material]?.friction ?? .55),
          damageScale: 1.1,
          hitX: hit.x,
          hitY: hit.y
        });
      }
    }
  }

  function birdBlockCollisions() {
    if (!bird || !bird.launched || bird.asleep || bird.hidden) return;
    const spec = birds[bird.type] || birds.red;
    for (const b of blocks) {
      if (b.destroyed) continue;
      applyCircleBlockImpulse(bird, b, {
        restitution: bird.type === 'yellow' ? .22 : bird.type === 'bomb' ? .16 : .28,
        damageScale: 1.0,
        particleCount: 10,
        particleColor: materials[b.material].fill,
        shakeScale: 1.1
      });
    }
  }

  function blueFragmentBlockCollisions() {
    if (!blueFragments.length) return;
    blueFragments.forEach(f => {
      if (f.asleep) return;
      for (const b of blocks) {
        if (b.destroyed) continue;
        applyCircleBlockImpulse(f, b, {
          restitution: .24,
          damageScale: 1.0,
          particleCount: 6,
          particleColor: '#7bd7ff',
          shakeScale: .55
        });
      }
    });
  }

  function wakeImpulseThreshold(b) {
    if (!b || !('w' in b)) return 0;
    const m = materials[b.material] || materials.wood;
    const supportBonus = 1 + Math.min(3, blockSupportCount(b)) * .16;
    const sizeBonus = clamp(Math.sqrt((b.w * b.h) / 2600), .75, 2.2);
    const stoneBonus = b.material === 'stone' ? 1.34 : 1;
    const healthBonus = blockDamageStage(b) === 0 ? 1.18 : blockDamageStage(b) === 1 ? 1.0 : .72;
    return (m.wake || 3.4) * supportBonus * sizeBonus * stoneBonus * healthBonus;
  }

  function damageImpulseThreshold(b) {
    if (!b || !('w' in b)) return 4;
    const m = materials[b.material] || materials.wood;
    const sizeBonus = clamp(Math.sqrt((b.w * b.h) / 2800), .78, 2.0);
    const supportBonus = 1 + Math.min(3, blockSupportCount(b)) * .08;
    return (m.damage || 6) * sizeBonus * supportBonus * damageResistance(b) / Math.max(1, (m.damage || 6));
  }


  function calibratedProjectileDamage(obj, closingSpeed) {
    if (!obj || closingSpeed < 1.2) return 0;
    let maxDamage = obj.impactDamage || 0;
    if (!maxDamage && obj.type) {
      const spec = birds[obj.type] || birds.red;
      maxDamage = spec.impactDamage || 0;
      if (obj.type === 'yellow' && obj.boosted) maxDamage = spec.boostedDamage || maxDamage;
    }
    if (!maxDamage) return 0;
    const charge = clamp(obj.chargePower ?? 1, .25, 1);
    const speedFactor = clamp(closingSpeed / PHYSICS.fullImpactSpeed, .18, 1.08);
    return maxDamage * charge * speedFactor;
  }

  function applyDirectProjectileDamage(obj, b, hit, closingSpeed) {
    if (!obj || !b || b.destroyed) return 0;
    const frame = Math.floor(state.physicsFrame || 0);
    const key = b.id || blocks.indexOf(b);
    if (!obj.hitCooldowns) obj.hitCooldowns = new Map();
    const last = obj.hitCooldowns.get(key) ?? -9999;
    if (frame - last < PHYSICS.directHitCooldownFrames) return 0;
    const damage = calibratedProjectileDamage(obj, closingSpeed);
    if (damage <= 0) return 0;
    obj.hitCooldowns.set(key, frame);
    damageBlock(b, damage, hit.x, hit.y, { force: true, raw: true, direct: true });
    if (damage >= 25) {
      const color = b.material === 'stone' ? '#d4dee4' : b.material === 'ice' ? '#d7fbff' : b.material === 'tnt' ? '#ffb0a2' : '#ffe0a1';
      burst(hit.x, hit.y, Math.min(18, 5 + Math.floor(damage / 42)), color, Math.min(5.4, 1.8 + damage / 140));
      shake = Math.max(shake, Math.min(9, damage / 70));
    }
    return damage;
  }

  function resolveBodyImpulse(a, b, nx, ny, depth, options = {}) {
    const blockA = a && 'w' in a;
    const blockB = b && 'w' in b;
    const aWasSleep = !!(blockA && a.sleep);
    const bWasSleep = !!(blockB && b.sleep);

    const baseInvA = 1 / Math.max(.12, a.mass || 1);
    const baseInvB = 1 / Math.max(.12, b.mass || 1);
    // Sleeping structural blocks act like settled/heavy objects until hit hard.
    const invA = aWasSleep ? baseInvA * PHYSICS.sleepInvMassScale : baseInvA;
    const invB = bWasSleep ? baseInvB * PHYSICS.sleepInvMassScale : baseInvB;
    const invSum = invA + invB;
    if (invSum <= 0) return { impulse: 0, rel: 0 };

    const hitX = options.hitX ?? ((centerX(a) + centerX(b)) / 2);
    const hitY = options.hitY ?? ((centerY(a) + centerY(b)) / 2);
    const slop = .04;
    const percent = options.percent ?? .34;
    const correction = Math.max(depth - slop, 0) / invSum * percent;
    a.x += nx * correction * invA;
    a.y += ny * correction * invA;
    b.x -= nx * correction * invB;
    b.y -= ny * correction * invB;

    const rvx = (a.vx || 0) - (b.vx || 0);
    const rvy = (a.vy || 0) - (b.vy || 0);
    const velAlongNormal = rvx * nx + rvy * ny;
    if (velAlongNormal > 0) return { impulse: 0, rel: velAlongNormal };

    const e = clamp(options.restitution ?? .18, 0, .45);
    const j = -(1 + e) * velAlongNormal / invSum;
    let px = nx * j;
    let py = ny * j;
    a.vx += px * invA;
    a.vy += py * invA;
    b.vx -= px * invB;
    b.vy -= py * invB;

    const rvx2 = (a.vx || 0) - (b.vx || 0);
    const rvy2 = (a.vy || 0) - (b.vy || 0);
    let tx = rvx2 - (rvx2 * nx + rvy2 * ny) * nx;
    let ty = rvy2 - (rvx2 * nx + rvy2 * ny) * ny;
    const tLen = Math.hypot(tx, ty);
    if (tLen > .0001) {
      tx /= tLen; ty /= tLen;
      const mu = clamp(options.friction ?? .62, 0, 1.25);
      let jt = -(rvx2 * tx + rvy2 * ty) / invSum;
      jt = clamp(jt, -Math.abs(j) * mu, Math.abs(j) * mu);
      px += tx * jt;
      py += ty * jt;
      a.vx += tx * jt * invA;
      a.vy += ty * jt * invA;
      b.vx -= tx * jt * invB;
      b.vy -= ty * jt * invB;
    }

    const impulse = Math.abs(j);
    const thresholdA = blockA ? wakeImpulseThreshold(a) : 0;
    const thresholdB = blockB ? wakeImpulseThreshold(b) : 0;

    if (blockA) {
      if (aWasSleep && impulse < thresholdA) { a.vx = 0; a.vy = 0; a.av = 0; }
      else { wakeBlock(a, 'contact'); applyAngularImpulse(a, hitX, hitY, px * .55, py * .55); }
    }
    if (blockB) {
      if (bWasSleep && impulse < thresholdB) { b.vx = 0; b.vy = 0; b.av = 0; }
      else { wakeBlock(b, 'contact'); applyAngularImpulse(b, hitX, hitY, -px * .55, -py * .55); }
    }

    if (impulse > PHYSICS.contactPropagationImpulse) {
      if (blockA) wakeNearbyBlocks(a, 'strong-contact');
      if (blockB) wakeNearbyBlocks(b, 'strong-contact');
    }

    if (impulse > 2.4 && options.damageScale !== 0) {
      if (blockA) {
        const th = damageImpulseThreshold(a);
        if (impulse > th) damageBlock(a, (impulse - th) * .32 * (options.damageScale ?? 1), hitX, hitY);
      }
      if (blockB) {
        const th = damageImpulseThreshold(b);
        if (impulse > th) damageBlock(b, (impulse - th) * .32 * (options.damageScale ?? 1), hitX, hitY);
      }
    }
    return { impulse, rel: velAlongNormal };
  }

  function applyCircleBlockImpulse(obj, b, options = {}) {
    const hit = circleRect(obj.x, obj.y, obj.r, b);
    if (!hit.collided) return null;
    const mat = materials[b.material] || materials.wood;
    const relN = ((obj.vx || 0) - (b.vx || 0)) * hit.nx + ((obj.vy || 0) - (b.vy || 0)) * hit.ny;
    const closingSpeed = Math.max(0, -relN);
    const impactMomentum = closingSpeed * Math.max(.2, obj.mass || 1);
    const wakeThreshold = wakeImpulseThreshold(b);
    const directDamage = applyDirectProjectileDamage(obj, b, hit, closingSpeed);

    // Static-friction gate: tiny bumps against settled/heavy structures bounce or slide,
    // but they do not wake the whole stack. This is the main v16 stability fix.
    if (b.sleep && !b.destroyed && impactMomentum < wakeThreshold && directDamage < Math.max(18, b.maxHp * .28)) {
      obj.x += hit.nx * Math.max(hit.depth, .6);
      obj.y += hit.ny * Math.max(hit.depth, .6);
      const vn = (obj.vx || 0) * hit.nx + (obj.vy || 0) * hit.ny;
      if (vn < 0) {
        obj.vx -= (1 + PHYSICS.staticBounce) * vn * hit.nx;
        obj.vy -= (1 + PHYSICS.staticBounce) * vn * hit.ny;
        // Tangential energy loss: bird scrapes the block instead of injecting chaos.
        const tangentX = -hit.ny, tangentY = hit.nx;
        const vt = obj.vx * tangentX + obj.vy * tangentY;
        obj.vx -= vt * tangentX * .22;
        obj.vy -= vt * tangentY * .22;
      }
      if (directDamage <= 0 && impactMomentum > damageImpulseThreshold(b) * .30) {
        chipBlock(b, Math.max(.35, (impactMomentum - damageImpulseThreshold(b) * .30) * PHYSICS.chipOnlyImpulseScale * (options.damageScale ?? 1)), hit.x, hit.y, { chipOnly: true });
      }
      return { impulse: impactMomentum, rel: -closingSpeed, resisted: true };
    }

    wakeBlock(b, 'direct-hit');
    const result = resolveBodyImpulse(obj, b, hit.nx, hit.ny, hit.depth, {
      restitution: Math.min(options.restitution ?? .20, mat.restitution ?? .18),
      friction: mat.friction ?? .62,
      damageScale: options.damageScale ?? 1,
      hitX: hit.x,
      hitY: hit.y,
      percent: .62
    });

    const speed = Math.hypot(obj.vx || 0, obj.vy || 0);
    const impulse = result?.impulse || 0;
    const dmgThreshold = damageImpulseThreshold(b);
    if (directDamage <= 0 && impulse > Math.max(1.4, dmgThreshold * .72)) {
      const damage = Math.max(0, (impulse - dmgThreshold * .72) * .30 * (options.damageScale ?? 1));
      damageBlock(b, damage, hit.x, hit.y);
      const count = options.particleCount ?? 8;
      if (count > 0) burst(hit.x, hit.y, Math.min(count, 3 + Math.floor(impulse * .45)), options.particleColor || mat.fill, Math.min(4.2, .45 + impulse * .09));
      shake = Math.max(shake, Math.min(7, impulse * (options.shakeScale ?? .55)));
    }

    if (speed < .08 && obj.y + obj.r >= GROUND - 1) obj.asleep = true;
    return result;
  }

  function pigCollisions() {
    pigs.forEach(p => {
      if (!p.alive) return;
      if (p.flash > 0) p.flash -= 1;

      if (bird && bird.launched && !bird.asleep && !bird.hidden) circlePigCollision(bird, p, 1.0);
      blueFragments.forEach(f => { if (!f.asleep) circlePigCollision(f, p, .72); });

      blocks.forEach(b => {
        if (!p.alive || b.destroyed) return;
        const hit = circleRect(p.x, p.y, p.r, b);
        if (!hit.collided) return;
        const speed = Math.hypot(b.vx, b.vy);
        const impactPower = speed * Math.sqrt(Math.max(.6, b.mass || 1));
        const fallingCrush = hit.depth > p.r * .52 && b.y < p.y && Math.abs(b.vy || 0) > PHYSICS.crushVelocityThreshold;
        // A sleeping/static block touching a pig is just structure, not damage.
        if (!b.sleep && (impactPower > PHYSICS.pigImpactThreshold || fallingCrush)) {
          const dmg = Math.max(1, Math.round((impactPower - PHYSICS.pigImpactThreshold) * .55 + (fallingCrush ? 1 : 0)));
          damagePig(p, dmg, p.x, p.y);
          b.vx *= .56;
          b.vy *= .56;
        }
      });
    });
  }

  function circlePigCollision(obj, p, scale = 1) {
    const dx = obj.x - p.x, dy = obj.y - p.y;
    const d = Math.hypot(dx, dy) || .001;
    if (d >= obj.r + p.r) return;
    const nx = dx / d, ny = dy / d;
    const overlap = obj.r + p.r - d;
    obj.x += nx * overlap;
    obj.y += ny * overlap;

    const velAlongNormal = (obj.vx || 0) * nx + (obj.vy || 0) * ny;
    const speed = Math.hypot(obj.vx || 0, obj.vy || 0);
    if (speed > 1.7) damagePig(p, Math.max(1, Math.round((speed - .8) * scale / 3.8)), p.x, p.y);
    if (velAlongNormal < 0) {
      const e = .24;
      obj.vx -= (1 + e) * velAlongNormal * nx;
      obj.vy -= (1 + e) * velAlongNormal * ny;
      obj.vx *= .62;
      obj.vy *= .62;
    }
  }

  function damagePig(p, amount, x, y) {
    if (!p.alive || p.scored) return;
    p.hp -= amount;
    p.flash = 14;
    if (p.hp <= 0) {
      p.alive = false;
      p.scored = true;
      const gained = 1000 + amount * 120;
      state.score += gained;
      floatText(`+${gained}`, x, y - 24, '#2f9e7e');
      popPig(p.x, p.y);
      sfx('pop');
      shake = Math.max(shake, 8);
    } else {
      floatText('hit', x, y - 22, '#fff');
    }
  }

  function chipBlock(b, amount, x, y, options = {}) {
    if (!b || b.destroyed || amount <= 0) return;
    const mat = materials[b.material] || materials.wood;
    const oldStage = blockDamageStage(b);
    const supportShield = b.sleep && !options.force ? .82 : 1;
    const severePenalty = options.raw ? 1 : (oldStage >= 2 ? 1.18 : oldStage === 1 ? 1.0 : .88);
    const finalDamage = Math.max(0, amount * supportShield * severePenalty);
    if (finalDamage <= 0) return;

    b.hp = Math.max(0, b.hp - finalDamage);
    b.touched = true;
    const newStage = blockDamageStage(b);

    if (b.material === 'tnt' && (b.hp <= 0 || finalDamage >= Math.max(8, b.maxHp * .70))) {
      return explode(b.x + b.w / 2, b.y + b.h / 2);
    }

    if (newStage > oldStage && newStage < 3) {
      setBlockDamageStage(b, newStage);
      const label = newStage === 1 ? 'ร้าว' : 'ใกล้แตก';
      floatText(label, x ?? (b.x + b.w / 2), (y ?? b.y) - 10, '#fff1c2');
      const color = newStage === 1 ? mat.light : mat.edge;
      burst(x ?? (b.x + b.w / 2), y ?? (b.y + b.h / 2), newStage === 1 ? 6 : 10, color, newStage === 1 ? 2.0 : 2.8);
      state.score += newStage === 1 ? 20 : 35;
      sfx('crack');
      // Only severe damage wakes the object. Cosmetic cracks stay mostly static.
      if (newStage >= 2 || finalDamage > damageImpulseThreshold(b) * PHYSICS.stageWakeMultiplier) {
        wakeBlock(b, 'severe-crack');
      }
    } else if (newStage < 3) {
      b.damageFlash = Math.max(b.damageFlash || 0, Math.min(8, 3 + finalDamage * .35));
      if (!options.chipOnly && finalDamage > damageImpulseThreshold(b) * .72) wakeBlock(b, 'heavy-chip');
    }

    if (newStage >= 3) {
      breakBlock(b, x, y);
    }
  }

  function breakBlock(b, x, y) {
    if (!b || b.destroyed) return;
    b.destroyed = true;
    state.score += b.material === 'stone' ? 120 : b.material === 'ice' ? 90 : 80;
    const mat = materials[b.material] || materials.wood;
    burst(b.x + b.w / 2, b.y + b.h / 2, b.material === 'stone' ? 12 : 16, mat.fill, b.material === 'stone' ? 2.4 : 3.4);
    floatText('แตก', x ?? (b.x + b.w / 2), (y ?? b.y) - 12, '#fff');
    sfx('break');
    // A broken block can wake immediate unsupported neighbors, but not the whole map.
    wakeNearbyBlocks(b, 'local-break', PHYSICS.blockBreakWakeRadius);
  }

  function damageBlock(b, amount, x, y, options = {}) {
    if (!b || b.destroyed || amount <= 0) return;
    // Damage is the main response; waking is secondary and only for sufficiently
    // strong impacts or blocks already close to breaking.
    if (options.direct || amount > damageImpulseThreshold(b) * .58 || blockDamageStage(b) >= 2) wakeBlock(b, 'damage');
    chipBlock(b, amount, x, y, options);
  }

  function addExplosionEffect(x, y, radius = PHYSICS.explosionRadius) {
    shockwaves.push({ x, y, r: 6, maxR: radius, life: 22, max: 22, color: 'rgba(255,244,177,.72)' });
    shockwaves.push({ x, y, r: 2, maxR: radius * .62, life: 15, max: 15, color: 'rgba(255,116,64,.52)' });
    burst(x, y, 54, '#ff8a4c', 10.5);
    burst(x, y, 22, '#ffe071', 8.0);
    burst(x, y, 14, '#44342d', 5.2);
  }

  function explosionDamageAtDistance(d, radius = PHYSICS.explosionRadius) {
    if (d > radius) return 0;
    const falloff = 1 - d / radius;
    // Strong core, quick falloff: feels like Angry Birds TNT/bomb without deleting the whole map.
    return PHYSICS.explosionDamage * Math.pow(falloff, 1.18);
  }

  function explode(x, y) {
    const source = blocks.find(b => !b.destroyed && b.material === 'tnt' && Math.abs(b.x + b.w / 2 - x) < 8 && Math.abs(b.y + b.h / 2 - y) < 8);
    if (source) { source.destroyed = true; source.exploded = true; }
    shake = Math.max(shake, 20);
    addExplosionEffect(x, y, PHYSICS.explosionRadius);
    floatText('BOOM', x, y - 26, '#e65245');
    sfx('boom');

    blocks.forEach(b => {
      if (b.destroyed) return;
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const dx = cx - x, dy = cy - y;
      const d = Math.hypot(dx, dy) || .001;
      const damage = explosionDamageAtDistance(d, PHYSICS.explosionRadius);
      if (damage <= 0) return;
      wakeBlock(b, 'explode');
      const push = (1 - d / PHYSICS.explosionRadius) * 11.0;
      b.vx += (dx / d) * push / Math.max(1.2, b.mass * 1.15);
      b.vy += (dy / d) * push / Math.max(1.2, b.mass * 1.15) - push * .05;
      damageBlock(b, damage, cx, cy, { force: true, raw: true, explosion: true });
    });

    pigs.forEach(p => {
      if (!p.alive) return;
      const d = Math.hypot(p.x - x, p.y - y);
      const damage = explosionDamageAtDistance(d, PHYSICS.explosionRadius);
      if (damage > 0) damagePig(p, Math.max(1, Math.ceil(damage / 100)), p.x, p.y);
    });

    if (bird && !bird.asleep && !bird.hidden) {
      const dx = bird.x - x, dy = bird.y - y;
      const d = Math.hypot(dx, dy) || .001;
      if (d < PHYSICS.explosionRadius + 16) {
        const power = (1 - Math.min(d, PHYSICS.explosionRadius) / PHYSICS.explosionRadius) * 9.5;
        bird.vx += (dx / d) * power;
        bird.vy += (dy / d) * power;
      }
    }
    blueFragments.forEach(f => {
      if (f.asleep) return;
      const dx = f.x - x, dy = f.y - y;
      const d = Math.hypot(dx, dy) || .001;
      if (d < PHYSICS.explosionRadius + 16) {
        const power = (1 - Math.min(d, PHYSICS.explosionRadius) / PHYSICS.explosionRadius) * 8.5;
        f.vx += (dx / d) * power;
        f.vy += (dy / d) * power;
      }
    });
  }


  function cleanDestroyedBlocks() {
    // v17 freeze fix: v16 called this during the first physics frame after launch,
    // but the function was missing. That ReferenceError stopped requestAnimationFrame,
    // so the screen looked frozen exactly when the mouse was released.
    if (!blocks.length) return;
    const before = blocks.length;
    blocks = blocks.filter(b => b && !b.destroyed && Number.isFinite(b.x) && Number.isFinite(b.y));
    if (blocks.length !== before) {
      // Re-check support counts locally after pieces are removed, but do not wake
      // the whole map. wakeUnsupportedBlocks() will decide what should move.
      blocks.forEach(b => { if (!Number.isFinite(b.initialSupport)) b.initialSupport = blockSupportCount(b); });
    }
  }

  function handleTurnFlow(dt) {
    if (!bird || !bird.launched || state.turnLocked) return;

    // v8: turn resolution is conservative and deterministic.
    // The previous version waited too much on tiny block jitter, so the next bird
    // could appear to never respawn. Here the turn always resolves after a fixed
    // safety window, even if a block keeps vibrating by a few pixels.
    state.turnFrames += dt;

    const birdSpeed = Math.hypot(bird.vx || 0, bird.vy || 0);
    const birdOnGround = bird.y + bird.r >= GROUND - 1;
    const birdOffscreen = bird.x < -130 || bird.x > W + 160 || bird.y > H + 130;
    const birdSlowDone = bird.age > 42 && birdOnGround && birdSpeed < .22;
    const birdTimedOut = state.turnFrames > 300;
    const fragmentsActive = blueFragments.some(f => !f.asleep && Math.hypot(f.vx || 0, f.vy || 0) > .16);
    const fragmentsDone = blueFragments.length === 0 || !fragmentsActive || state.turnFrames > 330;
    const birdDone = (bird.asleep || bird.hidden || birdOffscreen || birdSlowDone || birdTimedOut) && fragmentsDone;

    if (birdTimedOut) { bird.asleep = true; blueFragments.forEach(f => f.asleep = true); }

    const movingBlocks = blocks.some(b => !b.destroyed && (Math.hypot(b.vx, b.vy) > .38 || Math.abs(b.vy) > .28));
    const structureCanKeepMoving = (movingBlocks || fragmentsActive) && state.turnFrames < 360;

    if (birdDone && !structureCanKeepMoving) {
      state.mode = 'settling';
      state.settleFrames += dt;
    } else {
      state.settleFrames = 0;
    }

    if (state.settleFrames > 10 || state.turnFrames > 340) {
      endTurn();
    }
  }

  function endTurn() {
    if (state.turnLocked) return;
    state.turnLocked = true;
    trajectory = [];
    state.dragging = false;

    if (alivePigs() === 0) {
      return finishLevel();
    }

    const totalBirds = levels[state.levelIndex].birds.length;
    if (state.shotsUsed < totalBirds) {
      bird = null;
      spawnNextBird(false);
    } else {
      bird = null;
      failLevel();
    }
  }

  function finishLevel() {
    if (state.mode === 'won') return;
    state.mode = 'won';
    const level = levels[state.levelIndex];
    state.failCount = 0;
    const stars = state.shotsUsed <= level.three ? 3 : state.shotsUsed <= level.two ? 2 : 1;
    const unused = Math.max(0, level.birds.length - state.shotsUsed);
    const bonus = 400 * stars + 450 * unused;
    state.score += bonus;
    const key = String(state.levelIndex + 1);
    state.save.best[key] = Math.max(state.save.best[key] || 0, stars);
    state.save.unlocked = levels.length;
    saveGame();
    updateUI();
    renderLevelGrid();
    ui.modalTitle.textContent = 'ผ่านด่าน';
    ui.modalStars.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    ui.modalText.textContent = `ใช้ ${state.shotsUsed} นัด • โบนัส ${bonus.toLocaleString('th-TH')} • คะแนนรวม ${Math.round(state.score).toLocaleString('th-TH')}`;
    ui.next.style.display = state.levelIndex < levels.length - 1 ? 'inline-block' : 'none';
    ui.resultModal.classList.add('show');
    sfx('win');
  }

  function failLevel() {
    if (state.mode === 'lost' || state.mode === 'won') return;
    state.mode = 'lost';
    updateUI();
    ui.modalTitle.textContent = 'ยังไม่ผ่าน';
    ui.modalStars.textContent = '☆☆☆';
    state.failCount += 1;
    ui.modalText.textContent = `นกหมดแล้ว แต่ยังมีหมูรอดอยู่ • คำใบ้: ${levelTip(levels[state.levelIndex])}`;
    ui.next.style.display = 'none';
    ui.resultModal.classList.add('show');
    sfx('lose');
  }

  function useAbility() {
    if (!bird || !bird.launched || bird.abilityUsed || bird.asleep || state.paused) return;
    if (bird.type === 'red') return;
    bird.abilityUsed = true;
    if (bird.type === 'yellow') {
      const s = Math.hypot(bird.vx, bird.vy) || 1;
      bird.vx += (bird.vx / s) * 7.8;
      bird.vy += (bird.vy / s) * 7.8;
      bird.boosted = true;
      bird.impactDamage = birds.yellow.boostedDamage;
      burst(bird.x, bird.y, 18, '#ffd34a', 4.5);
      floatText('BOOST', bird.x, bird.y - 24, '#ffd34a');
    } else if (bird.type === 'bomb') {
      explode(bird.x, bird.y);
      bird.asleep = true;
    } else if (bird.type === 'blue') {
      splitBlueBird();
    }
    updateUI();
  }

  function splitBlueBird() {
    if (!bird || bird.type !== 'blue') return;
    const speed = Math.max(4.4, Math.hypot(bird.vx, bird.vy));
    const base = Math.atan2(bird.vy, bird.vx);
    const spread = [-0.28, 0, 0.28];
    blueFragments = spread.map((offset, i) => {
      const a = base + offset;
      const s = speed * (i === 1 ? 1.10 : 1.02) + .9;
      return {
        type: 'blueShard',
        x: bird.x + Math.cos(a) * bird.r * .65,
        y: bird.y + Math.sin(a) * bird.r * .65,
        r: 9,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        mass: .34,
        impactDamage: birds.blue.splitDamage,
        chargePower: 1,
        hitCooldowns: new Map(),
        age: 0,
        asleep: false,
        trail: [],
        abilityUsed: true
      };
    });
    bird.hidden = true;
    bird.asleep = true;
    burst(bird.x, bird.y, 26, '#79d5ff', 5.8);
    floatText('SPLIT x3', bird.x, bird.y - 24, '#48aeea');
    sfx('break');
  }

  function predict() {
    trajectory = [];
    if (!state.aimGuide || !bird || !state.dragging) return;
    let x = bird.x, y = bird.y;
    let vx = (SLING_X - bird.x) * POWER, vy = (SLING_Y - bird.y) * POWER;
    for (let i = 0; i < 44; i++) {
      x += vx; y += vy; vy += GRAVITY; vx *= .997;
      if (i % 3 === 0) trajectory.push({ x, y, a: 1 - i / 48 });
      if (y > GROUND) break;
    }
  }

  function draw() {
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    const sx = shake ? (Math.random() - .5) * shake : 0;
    const sy = shake ? (Math.random() - .5) * shake : 0;
    shake *= .88;
    ctx.translate(sx, sy);

    drawWorld();
    drawLastShotPath();
    drawTrajectory();
    drawSlingshot();
    blocks.forEach(drawBlock);
    drawWeakPoints();
    pigs.forEach(drawPig);
    drawBird();
    drawBlueFragments();
    drawShockwaves();
    drawParticles();
    drawFloatTexts();
    drawCanvasHud();
    ctx.restore();
  }

  function drawWorld() {
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, '#a9e8ff');
    sky.addColorStop(.68, '#d8f7fb');
    sky.addColorStop(1, '#f7eed1');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // sun
    const sun = ctx.createRadialGradient(100, 96, 8, 100, 96, 86);
    sun.addColorStop(0, 'rgba(255,245,185,.96)');
    sun.addColorStop(1, 'rgba(255,245,185,0)');
    ctx.fillStyle = sun;
    ctx.beginPath(); ctx.arc(100, 96, 86, 0, Math.PI * 2); ctx.fill();

    drawCloud(238, 88, .9);
    drawCloud(560, 72, .72);
    drawCloud(826, 120, .62);

    // distant hills
    ctx.fillStyle = '#a8d8b4';
    ctx.beginPath(); ctx.moveTo(0, 360); bezierHill(160, 250, 320, 365); bezierHill(520, 292, 740, 360); bezierHill(880, 285, W, 350); ctx.lineTo(W, GROUND); ctx.lineTo(0, GROUND); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#88c796';
    ctx.beginPath(); ctx.moveTo(0, 398); bezierHill(210, 310, 420, 402); bezierHill(640, 332, 850, 398); bezierHill(940, 348, W, 395); ctx.lineTo(W, GROUND); ctx.lineTo(0, GROUND); ctx.closePath(); ctx.fill();

    // ground
    const ground = ctx.createLinearGradient(0, GROUND, 0, H);
    ground.addColorStop(0, '#75bd68');
    ground.addColorStop(.16, '#62ad58');
    ground.addColorStop(1, '#8e6f42');
    ctx.fillStyle = ground;
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    for (let x = 0; x < W; x += 22) {
      ctx.fillRect(x, GROUND + 8 + Math.sin(x) * 2, 10, 2);
    }
  }

  function bezierHill(cx, cy, x, y) { ctx.quadraticCurveTo(cx, cy, x, y); }

  function drawCloud(x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(255,255,255,.74)';
    ctx.beginPath();
    ctx.arc(0, 12, 24, Math.PI, 0);
    ctx.arc(30, 4, 30, Math.PI, 0);
    ctx.arc(68, 13, 22, Math.PI, 0);
    ctx.lineTo(90, 35); ctx.lineTo(-24, 35); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawSlingshot() {
    // shadow
    ctx.fillStyle = 'rgba(42,63,43,.22)';
    ellipse(SLING_X, GROUND + 2, 48, 8);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#7a4a28';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(SLING_X - 8, GROUND); ctx.lineTo(SLING_X - 4, SLING_Y - 12); ctx.lineTo(SLING_X - 34, SLING_Y - 64);
    ctx.moveTo(SLING_X + 8, GROUND); ctx.lineTo(SLING_X + 4, SLING_Y - 12); ctx.lineTo(SLING_X + 36, SLING_Y - 64);
    ctx.stroke();
    ctx.strokeStyle = '#5e351e'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(SLING_X - 2, GROUND); ctx.lineTo(SLING_X, SLING_Y - 4); ctx.stroke();

    if (state.dragging && bird) {
      ctx.strokeStyle = '#4e2a1a'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(SLING_X - 32, SLING_Y - 64); ctx.lineTo(bird.x, bird.y); ctx.lineTo(SLING_X + 34, SLING_Y - 64); ctx.stroke();

      const pull = Math.hypot(SLING_X - bird.x, SLING_Y - bird.y);
      if (pull < 16) {
        ctx.strokeStyle = 'rgba(239,108,79,.45)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(SLING_X, SLING_Y, 22, 0, Math.PI * 2); ctx.stroke();
      }
      drawPowerMeter(pull);
    }
  }

  function drawPowerMeter(pull) {
    const pct = clamp(pull / MAX_DRAG, 0, 1);
    const x = SLING_X - 48, y = SLING_Y + 38, w = 96, h = 9;
    roundRect(x, y, w, h, 10, 'rgba(255,255,255,.58)');
    roundRect(x, y, w * pct, h, 10, pct > .8 ? '#ef6c4f' : '#2f9e7e');
  }


  function drawLastShotPath() {
    if (state.dragging || !lastShotPath.length || state.mode !== 'ready') return;
    ctx.save();
    ctx.globalAlpha = .18;
    ctx.strokeStyle = '#21313c';
    ctx.lineWidth = 2;
    ctx.setLineDash([2, 9]);
    ctx.beginPath();
    lastShotPath.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.stroke();
    ctx.restore();
  }

  function drawWeakPoints() {
    if (state.mode !== 'ready' || state.dragging || state.shotsUsed < 1) return;
    const t = performance.now() / 420;
    blocks.forEach(b => {
      if (b.destroyed) return;
      const isWeak = b.material === 'tnt' || b.hp / b.maxHp < .45 || (b.material === 'ice' && b.h > 40);
      if (!isWeak) return;
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const r = Math.max(16, Math.min(42, Math.max(b.w, b.h) * .42)) + Math.sin(t + cx) * 2;
      ctx.save();
      ctx.strokeStyle = b.material === 'tnt' ? 'rgba(239,108,79,.38)' : 'rgba(255,255,255,.42)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    });
  }

  function drawTrajectory() {
    if (!trajectory.length) return;
    trajectory.forEach((p, i) => {
      ctx.fillStyle = `rgba(255,255,255,${.78 * p.a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(2, 5 - i * .1), 0, Math.PI * 2); ctx.fill();
    });
  }

  function drawBlock(b) {
    if (b.destroyed) return;
    const m = materials[b.material] || materials.wood;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const x = -b.w / 2, y = -b.h / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(31,42,47,.18)';
    ellipse(cx, Math.min(GROUND + 2, blockAABB(b).maxY + 4), b.w * .50, 5);
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(b.angle || 0);

    const hpPct = clamp(b.hp / b.maxHp, 0, 1);
    ctx.globalAlpha = .72 + hpPct * .28;
    roundRect(x, y, b.w, b.h, Math.min(10, Math.min(b.w, b.h) * .22), m.fill);
    ctx.strokeStyle = m.edge; ctx.lineWidth = 2; strokeRoundRect(x, y, b.w, b.h, Math.min(10, Math.min(b.w, b.h) * .22));

    ctx.globalAlpha = .38;
    ctx.fillStyle = m.light;
    roundRect(x + 4, y + 4, Math.max(2, b.w - 8), Math.max(2, Math.min(9, b.h * .18)), 8, m.light);
    ctx.globalAlpha = 1;

    if (b.material === 'wood') {
      ctx.strokeStyle = 'rgba(90,50,24,.22)'; ctx.lineWidth = 2;
      const horizontal = b.w > b.h;
      if (horizontal) for (let yy = y + 8; yy < y + b.h; yy += 10) { ctx.beginPath(); ctx.moveTo(x + 6, yy); ctx.lineTo(x + b.w - 6, yy + Math.sin(yy + b.x) * 2); ctx.stroke(); }
      else for (let xx = x + 7; xx < x + b.w; xx += 8) { ctx.beginPath(); ctx.moveTo(xx, y + 7); ctx.lineTo(xx + Math.sin(xx + b.y) * 2, y + b.h - 7); ctx.stroke(); }
    } else if (b.material === 'stone') {
      ctx.strokeStyle = 'rgba(45,55,63,.28)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + b.w*.22, y + 8); ctx.lineTo(x + b.w*.5, y + b.h*.4); ctx.lineTo(x + b.w*.36, y + b.h - 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + b.w*.62, y + 10); ctx.lineTo(x + b.w*.78, y + b.h*.55); ctx.stroke();
    } else if (b.material === 'ice') {
      ctx.strokeStyle = 'rgba(255,255,255,.66)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 6, y + b.h - 7); ctx.lineTo(x + b.w - 8, y + 8); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.36)'; ctx.beginPath(); ctx.arc(x + b.w*.72, y + b.h*.24, 3, 0, Math.PI*2); ctx.fill();
    } else if (b.material === 'tnt') {
      roundRect(x + 3, y + b.h*.38, b.w - 6, b.h*.25, 4, '#fff2d6');
      ctx.fillStyle = '#81231f'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('TNT', 0, 1);
    }

    const stage = blockDamageStage(b);
    if (stage >= 1) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = b.material === 'ice' ? 'rgba(255,255,255,.88)' : b.material === 'stone' ? 'rgba(44,54,62,.62)' : 'rgba(92,43,22,.58)';
      ctx.lineWidth = stage === 1 ? 2 : 3;
      const crackCount = stage === 1 ? 2 : 4;
      for (let i = 0; i < crackCount; i++) {
        const sx = x + b.w * (.22 + ((i * 37 + b.x) % 55) / 100);
        const sy = y + b.h * (.20 + ((i * 29 + b.y) % 55) / 100);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + (i % 2 ? -1 : 1) * b.w * .10, sy + b.h * .14);
        ctx.lineTo(sx + (i % 2 ? 1 : -1) * b.w * .05, sy + b.h * .28);
        ctx.stroke();
      }
      if (stage >= 2) {
        ctx.strokeStyle = 'rgba(55,32,24,.36)';
        ctx.lineWidth = 4;
        strokeRoundRect(x + 2, y + 2, b.w - 4, b.h - 4, Math.min(8, Math.min(b.w, b.h) * .18));
      }
      ctx.restore();
    }

    if ((b.damageFlash || 0) > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(.42, (b.damageFlash || 0) / 24);
      ctx.strokeStyle = '#fff5bd';
      ctx.lineWidth = 4;
      strokeRoundRect(x - 1, y - 1, b.w + 2, b.h + 2, Math.min(11, Math.min(b.w, b.h) * .24));
      ctx.restore();
    }

    if (Math.abs(b.av || 0) > .01) {
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(42, Math.max(18, Math.min(b.w, b.h) + 16)), 0, Math.PI * 1.4);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPig(p) {
    if (!p.alive) return;
    ctx.save();
    ctx.fillStyle = 'rgba(31,42,47,.18)'; ellipse(p.x, GROUND + 2, p.r * 1.15, 5);
    const bob = Math.sin(performance.now() / 420 + p.x) * 1.1;
    ctx.translate(p.x, p.y + bob);
    if (p.flash > 0) ctx.globalAlpha = .72;
    ctx.fillStyle = '#64bd5a';
    ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#78cf70';
    ctx.beginPath(); ctx.arc(-p.r*.55, -p.r*.72, p.r*.34, 0, Math.PI*2); ctx.arc(p.r*.55, -p.r*.72, p.r*.34, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9ee092';
    ctx.beginPath(); ctx.ellipse(0, p.r*.15, p.r*.55, p.r*.38, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#2b5130';
    ctx.beginPath(); ctx.arc(-p.r*.27, -p.r*.16, 2.4, 0, Math.PI*2); ctx.arc(p.r*.27, -p.r*.16, 2.4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#2e7d32';
    ctx.beginPath(); ctx.arc(-p.r*.17, p.r*.18, 2.3, 0, Math.PI*2); ctx.arc(p.r*.17, p.r*.18, 2.3, 0, Math.PI*2); ctx.fill();
    if (p.hp > 1) { ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.fillText(p.hp, 0, -p.r - 8); }
    ctx.restore();
  }

  function drawBird() {
    if (!bird || bird.hidden) return;
    bird.trail?.forEach(t => {
      if (t.life <= 0) return;
      ctx.fillStyle = `rgba(255,255,255,${t.life / 70})`;
      ctx.beginPath(); ctx.arc(t.x, t.y, Math.max(2, bird.r * t.life / 55), 0, Math.PI*2); ctx.fill();
    });

    const spec = birds[bird.type] || birds.red;
    ctx.save();
    ctx.fillStyle = 'rgba(31,42,47,.20)'; ellipse(bird.x, GROUND + 2, bird.r * 1.15, 5);
    ctx.translate(bird.x, bird.y);
    const angle = bird.launched ? Math.atan2(bird.vy, bird.vx) * .08 : 0;
    ctx.rotate(angle);

    ctx.fillStyle = spec.color;
    ctx.strokeStyle = 'rgba(78,49,40,.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, bird.r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = spec.belly;
    ctx.beginPath(); ctx.ellipse(2, bird.r*.35, bird.r*.58, bird.r*.35, 0, 0, Math.PI*2); ctx.fill();

    // brows / eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(bird.r*.25, -bird.r*.22, bird.r*.22, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#1f2c35';
    ctx.beginPath(); ctx.arc(bird.r*.31, -bird.r*.20, bird.r*.085, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#1f2c35'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bird.r*.02, -bird.r*.42); ctx.lineTo(bird.r*.46, -bird.r*.35); ctx.stroke();

    ctx.fillStyle = spec.beak;
    ctx.beginPath(); ctx.moveTo(bird.r*.82, -2); ctx.lineTo(bird.r*1.46, 3); ctx.lineTo(bird.r*.80, bird.r*.30); ctx.closePath(); ctx.fill();

    if (bird.type === 'bomb') {
      ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-bird.r*.2, -bird.r*.96); ctx.quadraticCurveTo(-bird.r*.42, -bird.r*1.35, -bird.r*.05, -bird.r*1.55); ctx.stroke();
      ctx.fillStyle = '#ffbd4d'; ctx.beginPath(); ctx.arc(-bird.r*.02, -bird.r*1.58, 4, 0, Math.PI*2); ctx.fill();
    }
    if (bird.type !== 'red' && bird.launched && !bird.abilityUsed) {
      ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, bird.r + 8 + Math.sin(performance.now()/110)*2, 0, Math.PI*2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawBlueFragments() {
    if (!blueFragments.length) return;
    blueFragments.forEach(f => {
      f.trail?.forEach(t => {
        if (t.life <= 0) return;
        ctx.fillStyle = `rgba(121,213,255,${t.life / 42})`;
        ctx.beginPath(); ctx.arc(t.x, t.y, Math.max(1.5, f.r * t.life / 34), 0, Math.PI*2); ctx.fill();
      });
      if (f.asleep) return;
      ctx.save();
      ctx.fillStyle = 'rgba(31,42,47,.16)'; ellipse(f.x, GROUND + 2, f.r * 1.05, 4);
      ctx.translate(f.x, f.y);
      ctx.rotate(Math.atan2(f.vy, f.vx) * .08);
      ctx.fillStyle = '#48aeea';
      ctx.strokeStyle = 'rgba(42,120,160,.35)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, f.r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c9efff';
      ctx.beginPath(); ctx.ellipse(1, f.r*.32, f.r*.50, f.r*.30, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(f.r*.25, -f.r*.22, f.r*.20, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#1f2c35'; ctx.beginPath(); ctx.arc(f.r*.31, -f.r*.20, f.r*.08, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#f2b84d';
      ctx.beginPath(); ctx.moveTo(f.r*.78, -1); ctx.lineTo(f.r*1.34, 2); ctx.lineTo(f.r*.78, f.r*.25); ctx.closePath(); ctx.fill();
      ctx.restore();
    });
  }

  function drawCanvasHud() {
    ctx.save();
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(33,49,60,.42)';
    ctx.fillText('v17', 16, H - 16);
    ctx.restore();
    if (!bird || !state.dragging) return;
    const pull = Math.hypot(SLING_X - bird.x, SLING_Y - bird.y);
    const angle = Math.atan2(SLING_Y - bird.y, SLING_X - bird.x) * 180 / Math.PI;
    const txt = pull < 16 ? 'ยกเลิก' : `${Math.round(clamp(pull/MAX_DRAG,0,1)*100)}% • ${Math.round(angle)}°`;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,.78)';
    roundRect(SLING_X - 58, SLING_Y + 56, 116, 30, 999, 'rgba(255,255,255,.70)');
    ctx.fillStyle = pull < 16 ? '#ef6c4f' : '#21313c';
    ctx.fillText(txt, SLING_X, SLING_Y + 76);
  }

  function updateParticles(dt) {
    particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += .08 * dt; p.life -= dt; p.rot += p.spin * dt; });
    particles = particles.filter(p => p.life > 0);
  }
  function updateFloatTexts(dt) {
    floats.forEach(f => { f.y -= .45 * dt; f.life -= dt; });
    floats = floats.filter(f => f.life > 0);
  }
  function updateShockwaves(dt) {
    shockwaves.forEach(w => { w.life -= dt; w.r += (w.maxR - w.r) * .22 * dt; });
    shockwaves = shockwaves.filter(w => w.life > 0);
  }
  function drawShockwaves() {
    shockwaves.forEach(w => {
      const a = clamp(w.life / w.max, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = w.color;
      ctx.lineWidth = 5 * a + 1;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
  }
  function drawParticles() {
    particles.forEach(p => {
      ctx.save(); ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.fillRect(-p.s/2, -p.s/2, p.s, p.s); ctx.restore();
    });
  }
  function drawFloatTexts() {
    floats.forEach(f => {
      ctx.save(); ctx.globalAlpha = clamp(f.life / f.max, 0, 1); ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = f.color; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 4; ctx.strokeText(f.text, f.x, f.y); ctx.fillText(f.text, f.x, f.y); ctx.restore();
    });
  }

  function burst(x, y, count, color, speed = 3) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * speed + .5;
      particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - Math.random()*1.2, s: Math.random()*6 + 3, life: 26 + Math.random()*24, max: 48, color, rot: Math.random()*Math.PI, spin: (Math.random()-.5)*.18 });
    }
  }
  function popPig(x, y) { burst(x, y, 28, '#74cf68', 5.5); burst(x, y, 8, '#f4ffe6', 4); }
  function floatText(text, x, y, color) { floats.push({ text, x, y, color, life: 62, max: 62 }); }

  function pointerPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
  }

  function pointerDown(e) {
    e.preventDefault();
    if (isAnyModalOpen() || state.paused) return;
    const pos = pointerPos(e);
    if (bird && bird.launched) { useAbility(); return; }
    if (!bird || state.mode !== 'ready') return;
    if (Math.hypot(pos.x - bird.x, pos.y - bird.y) <= bird.r + 32) {
      state.dragging = true;
      state.mode = 'aiming';
      canvas.setPointerCapture?.(e.pointerId);
    }
  }

  function pointerMove(e) {
    if (!state.dragging || !bird) return;
    e.preventDefault();
    const pos = pointerPos(e);
    const dx = pos.x - SLING_X, dy = pos.y - SLING_Y;
    const d = Math.hypot(dx, dy);
    if (d > MAX_DRAG) {
      const a = Math.atan2(dy, dx);
      bird.x = SLING_X + Math.cos(a) * MAX_DRAG;
      bird.y = SLING_Y + Math.sin(a) * MAX_DRAG;
    } else { bird.x = pos.x; bird.y = pos.y; }
    predict();
  }

  function pointerUp(e) {
    if (!state.dragging || !bird) return;
    e.preventDefault();
    state.dragging = false;
    trajectory = [];
    const pull = Math.hypot(SLING_X - bird.x, SLING_Y - bird.y);
    if (pull < 16) {
      bird.x = SLING_X; bird.y = SLING_Y;
      state.mode = 'ready';
      toast('ยกเลิกการยิง');
      updateUI();
      return;
    }
    bird.chargePower = clamp(pull / MAX_DRAG, .18, 1);
    bird.vx = (SLING_X - bird.x) * POWER;
    bird.vy = (SLING_Y - bird.y) * POWER;
    lastShotPath = [{ x: bird.x, y: bird.y }];
    bird.launched = true;
    bird.asleep = false;
    bird.age = 0;
    bird.trail = [];
    state.shotsUsed += 1;
    state.turnFrames = 0;
    state.settleFrames = 0;
    state.turnLocked = false;
    state.mode = 'flying';
    burst(bird.x, bird.y, 16, 'rgba(255,255,255,.82)', 3.5);
    sfx('launch');
    updateUI();
  }

  function keyDown(e) {
    if (e.key === 'r' || e.key === 'R') startLevel(state.levelIndex);
    else if (e.key === 'g' || e.key === 'G') { state.aimGuide = !state.aimGuide; toast(`เส้นเล็ง: ${state.aimGuide ? 'เปิด' : 'ปิด'}`); }
    else if (e.key === 'p' || e.key === 'P') { state.paused = !state.paused; toast(state.paused ? 'หยุดชั่วคราว' : 'เล่นต่อ'); updateUI(); }
    else if (e.key === 'm' || e.key === 'M') { state.sound = !state.sound; toast(`เสียง: ${state.sound ? 'เปิด' : 'ปิด'}`); }
    else if (e.code === 'Space') { e.preventDefault(); useAbility(); }
    else if (e.key === 'Escape') closeAllModals();
  }

  function showResultNext() { if (state.levelIndex < levels.length - 1) startLevel(state.levelIndex + 1); }
  function closeAllModals() { ui.resultModal.classList.remove('show'); ui.levelModal.classList.remove('show'); ui.helpModal.classList.remove('show'); }
  function isAnyModalOpen() { return ui.resultModal.classList.contains('show') || ui.levelModal.classList.contains('show') || ui.helpModal.classList.contains('show'); }

  function toast(text) {
    state.toastText = text;
    state.toastTimer = 150;
    ui.toast.textContent = text;
    ui.toast.classList.add('show');
  }


  function levelTip(level) {
    const hasTnt = level.blocks.some(b => b.material === 'tnt');
    const stoneCount = level.blocks.filter(b => b.material === 'stone').length;
    const iceCount = level.blocks.filter(b => b.material === 'ice').length;
    if (hasTnt) return 'มองหา TNT หรือเสาค้ำใกล้ TNT ก่อน แล้วใช้แรงกระแทกให้โครงสร้างพังต่อเนื่อง';
    if (stoneCount > iceCount) return 'อย่ายิงหัวหินตรง ๆ ให้เล็งฐานไม้/น้ำแข็งหรือช่องว่างใต้หลังคาแทน';
    if (iceCount > stoneCount) return 'นกฟ้าทำลายน้ำแข็งดี ใช้เปิดทางแล้วให้นกตัวถัดไปยิงฐาน';
    return 'ลองยิงเสาด้านล่างก่อน เพราะ physics puzzle ส่วนใหญ่แพ้เมื่อฐานเสียสมดุล';
  }

  function sanitizeLevelObjects() {
    blocks.forEach(b => {
      b.x = clamp(Number(b.x) || 0, 0, W - b.w);
      b.y = clamp(Number(b.y) || 0, 0, GROUND - b.h);
      b.vx = 0; b.vy = 0; b.angle = Number(b.angle) || 0; b.av = 0;
    });
    pigs.forEach(p => {
      p.x = clamp(Number(p.x) || 700, p.r + 4, W - p.r - 4);
      p.y = clamp(Number(p.y) || (GROUND - p.r), p.r + 4, GROUND - p.r);
      for (let guard = 0; guard < 28; guard++) {
        const hit = blocks.some(b => !b.destroyed && circleRect(p.x, p.y, p.r + 1, b).collided);
        if (!hit) break;
        if (p.y - p.r > 12) p.y -= 2;
        else p.x = clamp(p.x + 4, p.r + 4, W - p.r - 4);
      }
      p.x0 = p.x; p.y0 = p.y;
    });
  }

  function sfx(type) {
    if (!state.sound) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const map = {
        launch: [220, 0.045, 'triangle', .035],
        pop: [520, 0.065, 'sine', .045],
        break: [150, 0.055, 'square', .026],
        crack: [260, 0.040, 'triangle', .018],
        boom: [70, 0.18, 'sawtooth', .06],
        win: [660, 0.14, 'sine', .035],
        lose: [120, 0.11, 'triangle', .028]
      };
      const [freq, dur, wave, vol] = map[type] || map.launch;
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, now);
      if (type === 'boom') osc.frequency.exponentialRampToValueAtTime(38, now + dur);
      if (type === 'win') osc.frequency.exponentialRampToValueAtTime(880, now + dur);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(vol, now + .008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(now); osc.stop(now + dur + .02);
    } catch {}
  }

  function centerX(o) { return 'w' in o ? o.x + o.w / 2 : o.x; }
  function centerY(o) { return 'h' in o ? o.y + o.h / 2 : o.y; }

  function applyAngularImpulse(body, hitX, hitY, impulseX, impulseY) {
    if (!body || !('w' in body) || !Number.isFinite(body.angle)) return;
    const cx = body.x + body.w / 2, cy = body.y + body.h / 2;
    const rx = hitX - cx, ry = hitY - cy;
    const cross = rx * impulseY - ry * impulseX;
    body.av = clamp((body.av || 0) + cross / Math.max(120, body.inertia || 120), -.18, .18);
  }

  function blockCorners(b) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const hw = b.w / 2, hh = b.h / 2;
    const a = b.angle || 0;
    const c = Math.cos(a), s = Math.sin(a);
    return [
      { x: cx + (-hw) * c - (-hh) * s, y: cy + (-hw) * s + (-hh) * c },
      { x: cx + ( hw) * c - (-hh) * s, y: cy + ( hw) * s + (-hh) * c },
      { x: cx + ( hw) * c - ( hh) * s, y: cy + ( hw) * s + ( hh) * c },
      { x: cx + (-hw) * c - ( hh) * s, y: cy + (-hw) * s + ( hh) * c }
    ];
  }

  function blockAABB(b) {
    const cs = blockCorners(b);
    return {
      minX: Math.min(...cs.map(p => p.x)), maxX: Math.max(...cs.map(p => p.x)),
      minY: Math.min(...cs.map(p => p.y)), maxY: Math.max(...cs.map(p => p.y))
    };
  }

  function worldToLocal(b, wx, wy) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const dx = wx - cx, dy = wy - cy;
    const a = -(b.angle || 0), c = Math.cos(a), s = Math.sin(a);
    return { x: dx * c - dy * s, y: dx * s + dy * c };
  }

  function localToWorld(b, lx, ly) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const a = b.angle || 0, c = Math.cos(a), s = Math.sin(a);
    return { x: cx + lx * c - ly * s, y: cy + lx * s + ly * c };
  }

  function rectOverlap(a, b) { return rectRectSAT(a, b).collided; }

  function rectRectSAT(a, b) {
    const aa = blockAABB(a), ba = blockAABB(b);
    if (aa.maxX < ba.minX || aa.minX > ba.maxX || aa.maxY < ba.minY || aa.minY > ba.maxY) return { collided: false };
    const ac = blockCorners(a), bc = blockCorners(b);
    const axes = [];
    function addAxes(corners) {
      for (let i = 0; i < 2; i++) {
        const p1 = corners[i], p2 = corners[(i + 1) % corners.length];
        const ex = p2.x - p1.x, ey = p2.y - p1.y;
        const len = Math.hypot(ex, ey) || 1;
        axes.push({ x: -ey / len, y: ex / len });
      }
    }
    addAxes(ac); addAxes(bc);
    let bestOverlap = Infinity, bestAxis = null;
    for (const axis of axes) {
      const pa = project(ac, axis), pb = project(bc, axis);
      const overlap = Math.min(pa.max, pb.max) - Math.max(pa.min, pb.min);
      if (overlap <= 0) return { collided: false };
      if (overlap < bestOverlap) { bestOverlap = overlap; bestAxis = axis; }
    }
    const dx = (a.x + a.w/2) - (b.x + b.w/2), dy = (a.y + a.h/2) - (b.y + b.h/2);
    if (dx * bestAxis.x + dy * bestAxis.y < 0) bestAxis = { x: -bestAxis.x, y: -bestAxis.y };
    return { collided: true, nx: bestAxis.x, ny: bestAxis.y, depth: bestOverlap, x: ((a.x+a.w/2)+(b.x+b.w/2))/2, y: ((a.y+a.h/2)+(b.y+b.h/2))/2 };
  }

  function project(points, axis) {
    let min = Infinity, max = -Infinity;
    points.forEach(p => { const v = p.x * axis.x + p.y * axis.y; if (v < min) min = v; if (v > max) max = v; });
    return { min, max };
  }

  function circleRect(cx, cy, r, rect) {
    const local = worldToLocal(rect, cx, cy);
    const clampedX = clamp(local.x, -rect.w / 2, rect.w / 2);
    const clampedY = clamp(local.y, -rect.h / 2, rect.h / 2);
    let dx = local.x - clampedX, dy = local.y - clampedY;
    let d = Math.hypot(dx, dy);
    let nxLocal, nyLocal, depth;
    if (d < .0001) {
      const left = Math.abs(local.x + rect.w / 2), right = Math.abs(rect.w / 2 - local.x), top = Math.abs(local.y + rect.h / 2), bottom = Math.abs(rect.h / 2 - local.y);
      const m = Math.min(left, right, top, bottom);
      if (m === left) { nxLocal = -1; nyLocal = 0; depth = r + left; }
      else if (m === right) { nxLocal = 1; nyLocal = 0; depth = r + right; }
      else if (m === top) { nxLocal = 0; nyLocal = -1; depth = r + top; }
      else { nxLocal = 0; nyLocal = 1; depth = r + bottom; }
    } else {
      if (d >= r) return { collided: false };
      nxLocal = dx / d; nyLocal = dy / d; depth = r - d;
    }
    const hit = localToWorld(rect, clampedX, clampedY);
    const a = rect.angle || 0, c = Math.cos(a), s = Math.sin(a);
    return { collided: true, x: hit.x, y: hit.y, nx: nxLocal * c - nyLocal * s, ny: nxLocal * s + nyLocal * c, depth };
  }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function roundRect(x, y, w, h, r, fill) {
    ctx.save(); roundRectPath(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); ctx.restore();
  }
  function strokeRoundRect(x, y, w, h, r) { roundRectPath(x, y, w, h, r); ctx.stroke(); }
  function roundRectPath(x, y, w, h, r) {
    r = Math.min(r, w/2, h/2);
    ctx.beginPath(); ctx.moveTo(x+r, y); ctx.arcTo(x+w, y, x+w, y+h, r); ctx.arcTo(x+w, y+h, x, y+h, r); ctx.arcTo(x, y+h, x, y, r); ctx.arcTo(x, y, x+w, y, r); ctx.closePath();
  }
  function ellipse(x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI*2); ctx.fill(); }

  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerUp);
  window.addEventListener('pointerup', pointerUp);
  window.addEventListener('pointercancel', pointerUp);
  window.addEventListener('keydown', keyDown);
  document.addEventListener('visibilitychange', () => { if (document.hidden && state.mode === 'flying') { state.paused = true; updateUI(); } });

  ui.restart.addEventListener('click', () => startLevel(state.levelIndex));
  ui.levels.addEventListener('click', () => { renderLevelGrid(); ui.levelModal.classList.add('show'); });
  ui.help.addEventListener('click', () => ui.helpModal.classList.add('show'));
  ui.next.addEventListener('click', showResultNext);
  ui.retry.addEventListener('click', () => startLevel(state.levelIndex));
  ui.closeModal.addEventListener('click', () => ui.resultModal.classList.remove('show'));
  ui.closeLevel.addEventListener('click', () => ui.levelModal.classList.remove('show'));
  ui.startHelp.addEventListener('click', () => { ui.helpModal.classList.remove('show'); try { localStorage.setItem(HELP_KEY, '1'); } catch {} });

  startLevel(0, true);
  // v10: no tutorial popup on start. The compact ? button still keeps help available.
  requestAnimationFrame(loop);
})();

