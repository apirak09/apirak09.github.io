export const H = 720, FLOOR = 662, R = 12;
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const MODES = Object.freeze({
  moon: { name: 'Moon', gravity: 1450 / 6, flap: -190, speed: 185, color: '#e9edaa' },
  nightmare: { name: 'Nightmare', gravity: 1450, flap: -405, speed: 300, color: '#ff8b9e' },
  hell: { name: 'Hell', gravity: 1500, flap: -425, speed: 280, color: '#ffad70' }
});
export const SINS = Object.freeze({
  pride: { name: 'Pride', title: 'The crown keeps moving.', hint: 'Follow the opening between the crowned towers.', color: '#dfbaff' },
  greed: { name: 'Greed', title: 'Some gold costs a life.', hint: 'Orbiting blades guard a bonus coin. Taking it is optional.', color: '#ffe39a' },
  envy: { name: 'Envy', title: 'Your echo is hunting.', hint: 'The shadow copies your recent flight, then locks its path.', color: '#8fe6b2' },
  wrath: { name: 'Wrath', title: 'Move before the strike.', hint: 'The dashed line locks in place before the lightning fires.', color: '#ff9587' },
  lust: { name: 'Lust', title: 'Resist the attraction.', hint: 'The rose pulls you toward its lethal heart. Fly wide.', color: '#ffafd2' },
  gluttony: { name: 'Gluttony', title: 'Never trust an open mouth.', hint: 'The jaws breathe open and shut. Aim through the center.', color: '#d6de94' },
  sloth: { name: 'Sloth', title: 'The air gets heavy.', hint: 'Amber fog increases gravity and weakens your flap. Tap sooner.', color: '#e7c688' }
});
export function seeded(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function segmentDistance(ax, ay, bx, by, cx, cy) {
  const dx = bx - ax, dy = by - ay, n = dx * dx + dy * dy;
  const t = n ? clamp(((cx - ax) * dx + (cy - ay) * dy) / n, 0, 1) : 0;
  return (ax + t * dx - cx) ** 2 + (ay + t * dy - cy) ** 2;
}
export function sweptCircle(ax, ay, bx, by, radius, cx, cy, cr) { return segmentDistance(ax, ay, bx, by, cx, cy) < (radius + cr) ** 2; }
export function sweptRect(ax, ay, bx, by, radius, x, y, w, h) {
  if (w <= 0 || h <= 0) return false;
  function segmentBox(l, t, r, b) {
    let lo = 0, hi = 1;
    for (const [a, d, min, max] of [[ax, bx - ax, l, r], [ay, by - ay, t, b]]) {
      if (Math.abs(d) < 1e-9) { if (a < min || a > max) return false; }
      else { const u = (min - a) / d, v = (max - a) / d; lo = Math.max(lo, Math.min(u, v)); hi = Math.min(hi, Math.max(u, v)); if (lo > hi) return false; }
    }
    return true;
  }
  return segmentBox(x - radius, y, x + w + radius, y + h) || segmentBox(x, y - radius, x + w, y + h + radius)
    || [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].some(p => segmentDistance(ax, ay, bx, by, ...p) < radius ** 2);
}
export function tuning(mode, time = 0, score = 0) {
  if (mode === 'moon') return { speed: 185 + time * .28, gap: Math.max(184, 226 - time * .16), spacing: 325, shift: 76 };
  if (mode === 'nightmare') return {
    speed: 300 + 8 * score + .12 * score ** 2,
    gap: Math.max(84, 146 - score * .7), spacing: Math.max(192, 278 - score * 1.1), shift: Math.min(114, 72 + score * .8),
    bats: Math.min(8, 1 + Math.floor(score / 5)), warning: Math.max(.3, .98 / (1 + score * .023)),
    stagger: Math.max(.045, .12 - score * .0013), laserTime: .36, beam: Math.min(14, 7 + score * .12),
    boltSpeed: 440 + 10 * score + .13 * score ** 2, corridor: Math.max(61, 96 - score * .6), waves: Math.min(12, 4 + Math.floor(score / 6))
  };
  return { speed: 280 + time * 1.65 + time ** 2 * .0035, gap: Math.max(124, 188 - time * .22),
    interval: Math.max(2.65, 4.35 - time * .009), warning: Math.max(.48, 1.25 - time * .003),
    level: 1 + Math.floor(time / 20), overlap: time >= 45, orbit: 1.4 + time * .006 };
}
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
export function validateSave(raw, motion = false) {
  let source; try { source = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { source = {}; }
  if (!source || typeof source !== 'object' || Array.isArray(source)) source = {};
  const finite = (n, max = 1e9) => Number.isFinite(n) && n >= 0 ? Math.min(max, n) : 0;
  const out = { version: 1, mode: own(MODES, source.mode) ? source.mode : 'moon', records: {}, settings: { sound: true, music: false, volume: .45, motion, quality: 'auto' } };
  for (const key of Object.keys(MODES)) {
    const r = source.records?.[key]; out.records[key] = { best: Math.floor(finite(r?.best)), time: finite(r?.time), runs: Math.floor(finite(r?.runs)), deaths: Math.floor(finite(r?.deaths)) };
  }
  for (const key of ['sound', 'music', 'motion']) if (typeof source.settings?.[key] === 'boolean') out.settings[key] = source.settings[key];
  if (Number.isFinite(source.settings?.volume)) out.settings.volume = clamp(source.settings.volume, 0, 1);
  if (['auto', 'low', 'high'].includes(source.settings?.quality)) out.settings.quality = source.settings.quality;
  return out;
}
export class Flight {
  constructor(mode = 'moon', width = 1200, random = Math.random) {
    this.random = random; this.width = Math.max(240, width); this.birdX = clamp(width * .245, 76, 186); this.reset(mode);
  }
  reset(mode = this.mode) {
    this.mode = own(MODES, mode) ? mode : 'moon'; this.config = MODES[this.mode]; this.state = 'ready';
    this.y = 318; this.previousY = this.y; this.vy = 0; this.elapsed = 0; this.distance = 0; this.score = 0; this.coins = 0;
    this.speed = this.config.speed; this.reason = ''; this.events = []; this.gates = []; this.hazards = []; this.bolts = []; this.history = [];
    this.phase = this.mode === 'nightmare' ? 'gates' : 'flight'; this.round = 1; this.phaseAge = 0; this.wave = 0; this.waveTarget = 4; this.attack = null;
    this.spawned = 0; this.lastCenter = 324; this.nextGate = Math.max(this.width + 64, this.birdX + this.speed * 2.5);
    this.director = .15; this.nextAttack = 0; this.sequence = 0; this.heavy = false; this.attraction = 0;
    this.threat = tuning(this.mode); this.lastSin = ''; this.encounters = {}; this.overlaps = 0;
  }
  resize(width) {
    const x = clamp(width * .245, 76, 186), dx = x - this.birdX;
    this.width = Math.max(240, width); this.birdX = x;
    for (const a of [...this.gates, ...this.hazards, ...this.bolts]) a.x += dx;
    for (const e of this.hazards) {
      for (const b of e.blades) b.x += dx;
      for (const b of e.previousBlades) b.x += dx;
    }
    this.nextGate += dx;
    if (this.attack) for (const bat of this.attack.shooters) bat.x += dx;
  }
  flap() {
    if (this.state === 'ready') this.state = 'playing';
    if (this.state !== 'playing') return false;
    this.vy = this.config.flap * (this.heavy ? .86 : 1); this.events.push({ type: 'flap' }); return true;
  }
  pause() { if (this.state !== 'playing') return false; this.state = 'paused'; return true; }
  resume() { if (this.state !== 'paused') return false; this.state = 'playing'; return true; }
  crash(reason) { if (this.state !== 'playing') return; this.state = 'dead'; this.reason = reason; this.events.push({ type: 'crash', reason }); }
  point(source = 'gate', amount = 1) { if (this.state !== 'playing') return; this.score += amount; this.events.push({ type: 'score', source, score: this.score, amount }); }
  step(dt) {
    if (this.state !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    let remaining = Math.min(dt, .1);
    while (remaining > 1e-9 && this.state === 'playing') { const d = Math.min(remaining, 1 / 120); this.integrate(d); remaining -= d; }
  }
  integrate(dt) {
    this.previousY = this.y; this.elapsed += dt;
    this.threat = tuning(this.mode, this.elapsed, this.score);
    this.speed += (this.threat.speed - this.speed) * (1 - Math.exp(-dt * 4));
    this.distance += this.speed * dt;
    this.heavy = this.hazards.some(e => e.sin === 'sloth' && e.x < this.birdX + R && e.x + e.w > this.birdX - R);
    this.attraction = 0;
    for (const e of this.hazards) if (e.sin === 'lust') {
      const near = Math.max(0, 1 - Math.abs(e.x - this.birdX) / 178);
      this.attraction += clamp((e.y - this.y) * 2.1, -360, 360) * near;
    }
    this.vy = Math.min(720, this.vy + (this.config.gravity * (this.heavy ? 1.3 : 1) + this.attraction) * dt);
    this.y += this.vy * dt;
    this.history.push({ t: this.elapsed, y: this.y });
    while (this.history.length > 2 && this.history[1].t < this.elapsed - 1.5) this.history.shift();
    if (this.mode === 'hell') this.advanceHell(dt); else this.advanceGates(dt);
    if (this.mode === 'nightmare' && this.state === 'playing') this.advanceNightmare(dt);
    if (this.y + R >= FLOOR) { this.y = FLOOR - R; this.crash('ground'); }
    if (this.y - R <= 0) { this.y = R; this.crash('ceiling'); }
  }
  advanceGates(dt) {
    const d = this.speed * dt, t = this.threat;
    if (this.mode === 'moon' || (this.phase === 'gates' && this.spawned < 6)) {
      this.nextGate -= d;
      while (this.nextGate < this.width + 170 && (this.mode === 'moon' || this.spawned < 6)) {
        const gap = t.gap + (this.random() - .5) * (this.mode === 'moon' ? 20 : 16);
        const center = clamp(this.lastCenter + (this.random() * 2 - 1) * t.shift, gap / 2 + 70, FLOOR - gap / 2 - 65);
        const gate = { x: this.nextGate, center, base: center, gap, w: 70, id: ++this.sequence, scored: false, age: this.random() * 6,
          drift: this.mode === 'moon' && this.spawned % 3 === 2 ? 21 : 0 };
        this.gates.push(gate); this.lastCenter = center; this.spawned++;
        this.nextGate += t.spacing * (.94 + this.random() * .12);
      }
    }
    for (const gate of this.gates) {
      const oldX = gate.x; gate.x -= d; gate.age += dt;
      gate.center = gate.base + Math.sin(gate.age * .8) * gate.drift;
      const top = gate.center - gate.gap / 2, bottom = gate.center + gate.gap / 2;
      if (sweptRect(this.birdX - oldX, this.previousY, this.birdX - gate.x, this.y, R, -5, 0, gate.w + 10, top)
        || sweptRect(this.birdX - oldX, this.previousY, this.birdX - gate.x, this.y, R, -5, bottom, gate.w + 10, FLOOR - bottom)) this.crash('gate');
      if (!gate.scored && gate.x + gate.w + 5 < this.birdX - R) { gate.scored = true; this.point(); }
    }
    this.gates = this.gates.filter(e => e.x + e.w > -30);
  }
  phaseTo(phase) {
    this.phase = phase; this.phaseAge = 0; this.events.push({ type: 'phase', phase, round: this.round });
  }
  beginBatAttack() {
    const t = { ...this.threat }, kind = (this.round + this.wave) % 2 ? 'laser' : 'volley';
    const aim = clamp(this.y, 75, FLOOR - 75), safeY = clamp(this.y + (this.random() * 2 - 1) * 105, 116, FLOOR - 112);
    const ex = Math.min(this.width - 40, this.birdX + 470);
    const shooters = Array.from({ length: t.bats }, (_, i) => {
      const y = 58 + ((aim - 58 + (i ? Math.ceil(i / 2) * 80 * (i % 2 ? 1 : -1) : 0)) % (FLOOR - 116) + FLOOR - 116) % (FLOOR - 116);
      return { x: ex - i % 3 * 27, y: kind === 'laser' ? y : 64 + i * (FLOOR - 128) / Math.max(1, t.bats - 1), aim: y, fireAt: t.warning + i * t.stagger, fired: false };
    });
    this.attack = { kind, age: 0, safeY, tuning: t, shooters }; this.events.push({ type: 'warning', kind });
  }
  advanceNightmare(dt) {
    this.phaseAge += dt;
    if (this.phase === 'gates') { if (this.spawned === 6 && !this.gates.length) { this.wave = 0; this.waveTarget = this.threat.waves; this.phaseTo('arrival'); } return; }
    if (this.phase === 'arrival') { if (this.phaseAge > .95) { this.phaseTo('swarm'); this.beginBatAttack(); } return; }
    if (this.phase === 'recovery') {
      if (this.phaseAge > .9) { this.round++; this.spawned = 0; this.lastCenter = clamp(this.y, 215, FLOOR - 215); this.nextGate = Math.max(this.width + 80, this.birdX + this.speed * 1.65); this.phaseTo('gates'); } return;
    }
    if (!this.attack) {
      this.nextAttack -= dt;
      if (this.nextAttack <= 0) { if (this.wave >= this.waveTarget) this.phaseTo('recovery'); else this.beginBatAttack(); }
      return;
    }
    const a = this.attack, t = a.tuning; a.age += dt;
    for (const bat of a.shooters) {
      if (!bat.fired && a.age >= bat.fireAt) {
        bat.fired = true; this.events.push({ type: 'fire', kind: a.kind });
        if (a.kind === 'volley') for (let y = 34; y < FLOOR - 25; y += 53) {
          if (Math.abs(y - a.safeY) > t.corridor + 9) this.bolts.push({ x: bat.x - 20, y, r: 8, speed: t.boltSpeed });
        }
      }
      if (a.kind === 'laser' && bat.fired && a.age < bat.fireAt + t.laserTime && Math.abs(this.y - bat.aim) < R + t.beam) this.crash('laser');
    }
    for (const b of this.bolts) {
      const x = b.x; b.x -= b.speed * dt;
      if (sweptCircle(x, b.y - this.previousY, b.x, b.y - this.y, b.r, this.birdX, 0, R)) this.crash('bolt');
    }
    this.bolts = this.bolts.filter(b => b.x > -30);
    const done = a.shooters.every(b => b.fired) && (a.kind === 'laser' ? a.shooters.every(b => a.age >= b.fireAt + t.laserTime) : !this.bolts.length);
    if (done && this.state === 'playing') { this.wave++; this.point(a.kind); this.attack = null; this.nextAttack = Math.max(.25, .64 - this.score * .006); }
  }
  spawnSin(sin, x, protectedY = null) {
    const t = this.threat, rng = this.random;
    let y = clamp(160 + rng() * 340, 140, FLOOR - 140);
    if (protectedY !== null) y = protectedY < FLOOR / 2 ? FLOOR - 105 : 105;
    const e = { id: ++this.sequence, sin, x, y, base: y, w: sin === 'sloth' ? 230 : sin === 'gluttony' ? 116 : sin === 'pride' ? 82 : 58,
      age: rng() * 2, life: 0, gap: t.gap, phase: rng() * Math.PI * 2, orbit: t.orbit, warned: false, scored: false, collected: false,
      warning: t.warning, timer: -1, triggered: false, locked: false, blades: [], previousBlades: [] };
    if (sin === 'pride') { e.base = clamp(y, 175, FLOOR - 175); e.y = e.base; }
    if (sin === 'greed') this.updateBlades(e);
    this.hazards.push(e); this.lastSin = sin; this.encounters[sin] = (this.encounters[sin] || 0) + 1;
    return e;
  }
  updateBlades(e) { e.blades = [0, 1, 2].map(i => { const a = e.age * e.orbit + i * Math.PI * 2 / 3; return { x: e.x + Math.cos(a) * 59, y: e.y + Math.sin(a) * 59, r: 12 }; }); }
  scheduleHell() {
    const keys = Object.keys(SINS), sin = keys[Math.floor(this.random() * keys.length)];
    const x = Math.max(this.width + 110, this.birdX + this.speed * 2.8);
    const first = this.spawnSin(sin, x);
    if (this.threat.overlap && this.random() < Math.min(.72, .28 + (this.elapsed - 45) * .004)) {
      // Secondary gold or echo hazards cannot close the primary's safe corridor.
      const pair = ['pride', 'gluttony', 'wrath', 'lust'].includes(sin) ? 'greed' : sin === 'greed' ? 'envy' : 'greed';
      this.spawnSin(pair, x + this.speed * .82, ['pride', 'gluttony'].includes(sin) ? first.base : null); this.overlaps++;
    }
    this.director = this.threat.interval * (.83 + this.random() * .34);
  }
  advanceHell(dt) {
    this.director -= dt;
    if (this.director <= 0) this.scheduleHell();
    for (const e of this.hazards) {
      const ox = e.x, oy = e.y; e.x -= this.speed * dt * (e.sin === 'envy' ? 1.1 : 1); e.age += dt; e.life += dt;
      const eta = (e.x - this.birdX) / this.speed;
      if (!e.warned && eta < 2.2) { e.warned = true; this.events.push({ type: 'sin', sin: e.sin }); }
      if (e.sin === 'pride' || e.sin === 'gluttony') {
        e.y = e.sin === 'pride' ? clamp(e.base + Math.sin(e.age * 1.15) * 47, 135, FLOOR - 135) : e.base;
        const gap = e.sin === 'gluttony' ? e.gap - 32 + (.5 + Math.sin(e.age * 2.5) * .5) * 100 : e.gap;
        e.opening = gap;
        const top = e.y - gap / 2, bottom = e.y + gap / 2;
        if (sweptRect(this.birdX - ox, this.previousY, this.birdX - e.x, this.y, R, 0, 0, e.w, top)
          || sweptRect(this.birdX - ox, this.previousY, this.birdX - e.x, this.y, R, 0, bottom, e.w, FLOOR - bottom)) this.crash(e.sin);
      } else if (e.sin === 'envy') {
        const entry = this.history.find(h => h.t >= this.elapsed - .85);
        if (!e.locked) { e.y += ((entry?.y ?? this.y) - e.y) * (1 - Math.exp(-dt * 4)); if (e.x < this.birdX + 142) e.locked = true; }
        if (sweptCircle(ox, oy - this.previousY, e.x, e.y - this.y, 18, this.birdX, 0, R)) this.crash('envy');
      } else if (e.sin === 'greed') {
        e.previousBlades = e.blades; this.updateBlades(e);
        for (let j = 0; j < e.blades.length; j++) {
          const b = e.blades[j], prev = e.previousBlades[j] || b;
          if (sweptCircle(prev.x, prev.y - this.previousY, b.x, b.y - this.y, b.r, this.birdX, 0, R)) this.crash('greed');
        }
        if (!e.collected && sweptCircle(ox, e.y - this.previousY, e.x, e.y - this.y, 11, this.birdX, 0, R) && this.state === 'playing') {
          e.collected = true; this.coins++; this.point('gold', 2); this.events.push({ type: 'coin' });
        }
      } else if (e.sin === 'lust') {
        e.y = e.base + Math.sin(e.age * 1.3) * 35;
        if (sweptCircle(ox, oy - this.previousY, e.x, e.y - this.y, 25, this.birdX, 0, R)) this.crash('lust');
      } else if (e.sin === 'wrath') {
        if (!e.triggered && eta <= 1.65) { e.triggered = true; e.timer = 0; e.y = clamp(this.y, 45, FLOOR - 45); this.events.push({ type: 'warning', kind: 'wrath' }); }
        if (e.triggered) {
          const prev = e.timer; e.timer += dt;
          if (prev < e.warning && e.timer >= e.warning) this.events.push({ type: 'fire', kind: 'wrath' });
          if (e.timer >= e.warning && e.timer < e.warning + .34 && Math.min(this.previousY, this.y) < e.y + 11 + R && Math.max(this.previousY, this.y) > e.y - 11 - R) this.crash('wrath');
          if (e.timer >= e.warning + .34 && !e.scored) { e.scored = true; this.point('wrath'); }
        }
      }
      const right = e.x + (e.sin === 'greed' ? 78 : e.w);
      if (!e.scored && e.sin !== 'wrath' && right < this.birdX - R) { e.scored = true; this.point(e.sin); }
    }
    this.hazards = this.hazards.filter(e => e.sin === 'wrath' ? !(e.scored || e.x < -100) : e.x + e.w + 100 > -20);
  }
  drainEvents() { return this.events.splice(0); }
}
