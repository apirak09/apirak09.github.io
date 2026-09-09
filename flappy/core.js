(function (root) {
  'use strict';
  const WIDTH = 480, HEIGHT = 680, FLOOR = 632, BIRD_X = 132, RADIUS = 14, PIPE_WIDTH = 72;
  const DIFFICULTIES = Object.freeze({
    easy: Object.freeze({ name: 'Easy', speed: 150, gap: 220, spacing: 286, gravity: 1160, flap: -365, shift: 82, description: 'Wider gaps. A gentle pace to learn the rhythm.' }),
    normal: Object.freeze({ name: 'Normal', speed: 185, gap: 182, spacing: 280, gravity: 1320, flap: -385, shift: 98, description: 'Balanced speed. Room to find your flow.' }),
    hard: Object.freeze({ name: 'Hard', speed: 225, gap: 150, spacing: 272, gravity: 1450, flap: -405, shift: 108, description: 'Tighter gaps. Faster pipes. Make every flap count.' }),
    nightmare: Object.freeze({ name: 'Nightmare', speed: 300, gap: 124, spacing: 248, gravity: 1450, flap: -405, shift: 80, description: 'Every point feeds the nightmare. The speed never stops rising.' })
  });
  const NIGHTMARE = Object.freeze({
    pipesPerRound: 6, gapMin: 112, gapMax: 136, spacingMin: 220, spacingMax: 276,
    maxShift: 80, entryTime: 1, warningTime: .95, laserTime: .46,
    cooldown: .5, recoveryTime: .9, attacksPerRound: 4,
    laserHalfWidth: 8, boltRadius: 9, boltSpeed: 400, corridorHalfWidth: 82,
    enemyX: 420, maxBats: 8
  });
  function nightmareThreat(points) {
    const p = Number.isFinite(points) ? Math.max(0, points) : 0;
    const gapMin = Math.max(50, 112 - p * .85), spacingMin = Math.max(145, 220 - p * 1.1);
    return {
      level: p + 1, speed: 300 + 9 * p + .18 * p * p,
      gapMin, gapMax: Math.max(gapMin + 8, 136 - p * .95),
      spacingMin, spacingMax: Math.max(spacingMin + 15, 276 - p * 1.4),
      maxShift: Math.min(138, 80 + p * 1.2), aggression: Math.min(1, p / 24),
      bats: Math.min(NIGHTMARE.maxBats, 1 + Math.floor(p / 5)),
      warningTime: Math.max(.08, .95 / (1 + p * .028)),
      stagger: Math.max(.025, .13 / (1 + p * .022)),
      laserTime: .46 + Math.min(.3, p * .005), laserHalfWidth: Math.min(22, 8 + p * .22),
      boltSpeed: 400 + 12 * p + .2 * p * p, boltRadius: Math.min(12, 9 + p * .035),
      corridorHalfWidth: Math.max(22, 82 - p), volleyStep: Math.max(34, 62 - p * .5),
      cooldown: Math.max(.06, .5 / (1 + p * .05)),
      entryTime: Math.max(.2, 1 / (1 + p * .018)),
      recoveryTime: Math.max(.12, .9 / (1 + p * .035)),
      attacksPerRound: Math.min(12, 4 + Math.floor(p / 6))
    };
  }
  const MEDALS = Object.freeze([{ score: 5, name: 'Bronze', color: '#c89164' }, { score: 15, name: 'Silver', color: '#9fbac9' }, { score: 30, name: 'Gold', color: '#ffcf4b' }, { score: 50, name: 'Sky legend', color: '#6fcfc4' }]);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  function circleRect(cx, cy, radius, x, y, w, h) {
    const dx = cx - clamp(cx, x, x + w), dy = cy - clamp(cy, y, y + h);
    return dx * dx + dy * dy < radius * radius;
  }
  function segmentDistanceSq(ax, ay, bx, by, x, y) {
    const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy;
    const t = length ? clamp(((x - ax) * dx + (y - ay) * dy) / length, 0, 1) : 0;
    return (ax + dx * t - x) ** 2 + (ay + dy * t - y) ** 2;
  }
  function segmentRect(ax, ay, bx, by, x, y, w, h) {
    let enter = 0, leave = 1;
    for (const [a, delta, low, high] of [[ax, bx - ax, x, x + w], [ay, by - ay, y, y + h]]) {
      if (Math.abs(delta) < 1e-12) { if (a < low || a > high) return false; }
      else { const t1 = (low - a) / delta, t2 = (high - a) / delta; enter = Math.max(enter, Math.min(t1, t2)); leave = Math.min(leave, Math.max(t1, t2)); if (enter > leave) return false; }
    }
    return true;
  }
  function sweptCircleRect(ax, ay, bx, by, radius, x, y, w, h) {
    if (w <= 0 || h <= 0) return false;
    if (segmentRect(ax, ay, bx, by, x - radius, y, w + radius * 2, h)
      || segmentRect(ax, ay, bx, by, x, y - radius, w, h + radius * 2)) return true;
    return [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].some(([cx, cy]) => segmentDistanceSq(ax, ay, bx, by, cx, cy) < radius * radius);
  }
  class Flight {
    constructor(difficulty = 'normal', random = Math.random) {
      this.random = random; this.reset(difficulty);
    }
    reset(difficulty = this.difficulty) {
      this.difficulty = Object.hasOwn ? (Object.hasOwn(DIFFICULTIES, difficulty) ? difficulty : 'normal') : (Object.prototype.hasOwnProperty.call(DIFFICULTIES, difficulty) ? difficulty : 'normal');
      this.config = DIFFICULTIES[this.difficulty]; this.state = 'ready'; this.y = 282; this.vy = 0;
      this.elapsed = 0; this.distance = 0; this.score = 0; this.pipes = []; this.nextPipe = WIDTH + 40;
      this.lastCenter = 305; this.reason = ''; this.events = [];
      this.nightmare = this.difficulty === 'nightmare'; this.round = 1; this.phase = 'gates';
      this.phaseTime = 0; this.spawned = 0; this.cleared = 0; this.attacksCleared = 0;
      this.attack = null; this.enemies = []; this.projectiles = []; this.nextAttackDelay = 0; this.lastSpacing = NIGHTMARE.spacingMax;
      this.threat = nightmareThreat(0); this.speed = this.config.speed; this.previousY = this.y;
      this.huntTarget = this.threat.attacksPerRound; this.entryDuration = this.threat.entryTime; this.recoveryDuration = this.threat.recoveryTime;
    }
    flap() {
      if (this.state === 'ready') this.state = 'playing';
      if (this.state !== 'playing') return false;
      this.vy = this.config.flap; this.events.push({ type: 'flap' }); return true;
    }
    pause() { if (this.state === 'playing') { this.state = 'paused'; return true; } return false; }
    resume() { if (this.state === 'paused') { this.state = 'playing'; return true; } return false; }
    crash(reason) { if (this.state !== 'playing') return; this.state = 'dead'; this.reason = reason; this.events.push({ type: 'crash', reason }); }
    point(source = 'pipe') { this.score++; if (this.nightmare) this.threat = nightmareThreat(this.score); this.events.push({ type: 'score', score: this.score, source }); }
    changePhase(phase) {
      this.phase = phase; this.phaseTime = 0;
      if (phase === 'arrival') { this.enemies = []; this.huntTarget = this.threat.attacksPerRound; this.entryDuration = this.threat.entryTime; }
      if (phase === 'recovery') this.recoveryDuration = this.threat.recoveryTime;
      this.events.push({ type: 'phase', phase, round: this.round });
    }
    beginAttack() {
      // Snapshot each attack's geometry and timing so the warning remains truthful
      // even as the next point increases the overall threat.
      const t = this.threat;
      const kind = (this.round + this.attacksCleared) % 2 === 1 ? 'laser' : 'volley';
      const aimY = clamp(this.y, 82, FLOOR - 82);
      const safeY = clamp(this.y + (this.random() * 2 - 1) * Math.min(145, 75 + this.score * 1.5), 110, FLOOR - 110);
      const shooters = Array.from({ length: t.bats }, (_, i) => {
        const offset = i === 0 ? 0 : Math.ceil(i / 2) * 76 * (i % 2 ? 1 : -1);
        const laserY = 52 + ((aimY - 52 + offset) % (FLOOR - 104) + FLOOR - 104) % (FLOOR - 104);
        return { index: i, x: NIGHTMARE.enemyX - (i % 3) * 29,
          fromY: this.enemies[i]?.y ?? 68 + i * (FLOOR - 136) / Math.max(1, t.bats - 1),
          y: kind === 'laser' ? laserY : 68 + i * (FLOOR - 136) / Math.max(1, t.bats - 1),
          aimY: laserY, fireAt: t.warningTime + i * t.stagger, fired: false };
      });
      this.attack = { kind, age: 0, fired: false, aimY, safeY, warning: t.warningTime,
        index: this.attacksCleared + 1, shooters, tuning: { ...t } };
      this.enemies = shooters;
      this.events.push({ type: 'warning', kind, aimY, safeY });
    }
    advanceNightmare(dt) {
      if (this.phase === 'gates') {
        if (this.spawned >= NIGHTMARE.pipesPerRound && this.pipes.length === 0) this.changePhase('arrival');
        return;
      }
      this.phaseTime += dt;
      if (this.phase === 'arrival') {
        if (this.phaseTime >= this.entryDuration) { this.changePhase('hunt'); this.beginAttack(); }
        return;
      }
      if (this.phase === 'recovery') {
        if (this.phaseTime >= this.recoveryDuration) {
          this.round++; this.spawned = 0; this.cleared = 0; this.attacksCleared = 0;
          this.nextPipe = WIDTH + 40; this.lastCenter = clamp(this.y, 190, FLOOR - 190);
          this.lastSpacing = NIGHTMARE.spacingMax; this.changePhase('gates');
        }
        return;
      }
      const attack = this.attack;
      if (!attack) {
        this.nextAttackDelay -= dt;
        if (this.nextAttackDelay <= 0) {
          if (this.attacksCleared >= this.huntTarget) this.changePhase('recovery');
          else this.beginAttack();
        }
        return;
      }
      attack.age += dt;
      const t = attack.tuning;
      for (const shooter of attack.shooters) {
        if (!shooter.fired && attack.age >= shooter.fireAt) {
          shooter.fired = true; attack.fired = true; this.events.push({ type: 'fire', kind: attack.kind, bat: shooter.index });
          if (attack.kind === 'volley') {
            for (let y = 42 + shooter.index * t.volleyStep / attack.shooters.length; y < FLOOR - 30; y += t.volleyStep) {
              if (Math.abs(y - attack.safeY) < t.corridorHalfWidth + t.boltRadius) continue;
              this.projectiles.push({ x: shooter.x - 22, y, radius: t.boltRadius, speed: t.boltSpeed * (1 + shooter.index * .025) });
            }
          }
        }
        if (attack.kind === 'laser' && shooter.fired && attack.age < shooter.fireAt + t.laserTime
          && Math.abs(this.y - shooter.aimY) < RADIUS + t.laserHalfWidth) this.crash('laser');
      }
      for (const bolt of this.projectiles) {
        const previousX = bolt.x; bolt.x -= bolt.speed * dt;
        if (segmentDistanceSq(previousX, bolt.y - this.previousY, bolt.x, bolt.y - this.y, BIRD_X, 0) < (RADIUS + bolt.radius) ** 2) this.crash('bolt');
      }
      this.projectiles = this.projectiles.filter(bolt => bolt.x > -35);
      const done = attack.shooters.every(shooter => shooter.fired) && (attack.kind === 'laser'
        ? attack.shooters.every(shooter => attack.age >= shooter.fireAt + t.laserTime)
        : this.projectiles.length === 0);
      if (done && this.state === 'playing') {
        this.attacksCleared++; this.point(attack.kind); this.attack = null; this.nextAttackDelay = this.threat.cooldown;
        this.events.push({ type: 'evaded', kind: attack.kind });
      }
    }
    step(dt) {
      if (this.state !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
      // Never integrate more than 1/120 s: collisions cannot tunnel through pipes.
      let remaining = Math.min(dt, 0.1);
      while (remaining > 0 && this.state === 'playing') { const slice = Math.min(remaining, 1 / 120); this.integrate(slice); remaining -= slice; }
    }
    integrate(dt) {
      const c = this.config;
      this.previousY = this.y;
      this.speed = this.nightmare ? this.speed + (this.threat.speed - this.speed) * (1 - Math.exp(-dt * 4)) : c.speed;
      const speed = this.speed, t = this.threat;
      this.elapsed += dt; this.distance += speed * dt; this.vy = Math.min(this.vy + c.gravity * dt, 650); this.y += this.vy * dt;
      if (!this.nightmare || (this.phase === 'gates' && this.spawned < NIGHTMARE.pipesPerRound)) this.nextPipe -= speed * dt;
      if (this.nextPipe <= WIDTH + 40 && (!this.nightmare || (this.phase === 'gates' && this.spawned < NIGHTMARE.pipesPerRound))) {
        const gap = this.nightmare ? t.gapMin + this.random() * (t.gapMax - t.gapMin) : c.gap;
        const spacing = this.nightmare ? t.spacingMin + this.random() * (t.spacingMax - t.spacingMin) : c.spacing;
        const earlyShift = Math.min(NIGHTMARE.maxShift, (this.lastSpacing - PIPE_WIDTH - RADIUS * 2 - 10) * .5);
        // Early gates retain a recovery allowance; later gates intentionally stop
        // compensating for the growing speed, making survival progressively harsher.
        const shift = this.nightmare ? earlyShift + (t.maxShift - earlyShift) * t.aggression : c.shift;
        const half = gap / 2;
        const center = clamp(this.lastCenter + (this.random() * 2 - 1) * shift, half + 66, FLOOR - half - 64);
        this.lastCenter = center;
        this.pipes.push({ x: this.nextPipe, center, gap, spacing, pressure: this.nightmare ? this.score : 0, scored: false }); this.nextPipe += spacing;
        this.lastSpacing = spacing; this.spawned++;
      }
      for (const pipe of this.pipes) {
        const previousX = pipe.x; pipe.x -= speed * dt;
        const top = pipe.center - (pipe.gap || c.gap) / 2, bottom = pipe.center + (pipe.gap || c.gap) / 2;
        let hit = circleRect(BIRD_X, this.y, RADIUS, pipe.x, 0, PIPE_WIDTH, top - 25)
          || circleRect(BIRD_X, this.y, RADIUS, pipe.x - 5, top - 25, PIPE_WIDTH + 10, 25)
          || circleRect(BIRD_X, this.y, RADIUS, pipe.x, bottom + 25, PIPE_WIDTH, FLOOR - bottom - 25)
          || circleRect(BIRD_X, this.y, RADIUS, pipe.x - 5, bottom, PIPE_WIDTH + 10, 25);
        if (!hit && this.nightmare) {
          const ax = BIRD_X - previousX, bx = BIRD_X - pipe.x;
          hit = sweptCircleRect(ax, this.previousY, bx, this.y, RADIUS, 0, 0, PIPE_WIDTH, top - 25)
            || sweptCircleRect(ax, this.previousY, bx, this.y, RADIUS, -5, top - 25, PIPE_WIDTH + 10, 25)
            || sweptCircleRect(ax, this.previousY, bx, this.y, RADIUS, 0, bottom + 25, PIPE_WIDTH, FLOOR - bottom - 25)
            || sweptCircleRect(ax, this.previousY, bx, this.y, RADIUS, -5, bottom, PIPE_WIDTH + 10, 25);
        }
        if (hit) { this.crash('pipe'); break; }
        if (!pipe.scored && pipe.x + PIPE_WIDTH + 5 < BIRD_X - RADIUS) {
          pipe.scored = true; this.cleared++; this.point();
        }
      }
      this.pipes = this.pipes.filter(pipe => pipe.x + PIPE_WIDTH + 8 > -10);
      if (this.nightmare && this.state === 'playing') this.advanceNightmare(dt);
      if (this.y + RADIUS >= FLOOR) { this.y = FLOOR - RADIUS; this.crash('ground'); }
      if (this.y - RADIUS <= 0) { this.y = RADIUS; this.crash('ceiling'); }
    }
    drainEvents() { return this.events.splice(0); }
  }
  function safeSave(raw, reducedMotion = false) {
    let input = {}; try { input = typeof raw === 'string' ? JSON.parse(raw) : raw || {}; } catch (_) {}
    if (!input || typeof input !== 'object') input = {};
    const best = {}, runs = {};
    for (const key of Object.keys(DIFFICULTIES)) {
      best[key] = clamp(Number.isSafeInteger(input.best?.[key]) ? input.best[key] : 0, 0, 999999);
      runs[key] = clamp(Number.isSafeInteger(input.runs?.[key]) ? input.runs[key] : 0, 0, 999999);
    }
    return { version: 2, best, runs, difficulty: Object.prototype.hasOwnProperty.call(DIFFICULTIES, input.difficulty) ? input.difficulty : 'normal',
      muted: input.muted === true, effects: input.effects !== false, music: input.music === true,
      volume: typeof input.volume === 'number' && Number.isFinite(input.volume) ? clamp(input.volume, 0, 1) : 0.6,
      reducedMotion: typeof input.reducedMotion === 'boolean' ? input.reducedMotion : reducedMotion };
  }
  const api = { Flight, DIFFICULTIES, MEDALS, NIGHTMARE, nightmareThreat, WIDTH, HEIGHT, FLOOR, BIRD_X, RADIUS, PIPE_WIDTH, circleRect, sweptCircleRect, segmentDistanceSq, safeSave, clamp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FlappyCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
