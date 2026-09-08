(function (root) {
  'use strict';
  const WIDTH = 480, HEIGHT = 680, FLOOR = 632, BIRD_X = 132, RADIUS = 14, PIPE_WIDTH = 72;
  const DIFFICULTIES = Object.freeze({
    easy: Object.freeze({ name: 'Easy', speed: 150, gap: 220, spacing: 286, gravity: 1160, flap: -365, shift: 82, description: 'Wider gaps. A gentle pace to learn the rhythm.' }),
    normal: Object.freeze({ name: 'Normal', speed: 185, gap: 182, spacing: 280, gravity: 1320, flap: -385, shift: 98, description: 'Balanced speed. Room to find your flow.' }),
    hard: Object.freeze({ name: 'Hard', speed: 225, gap: 150, spacing: 272, gravity: 1450, flap: -405, shift: 108, description: 'Tighter gaps. Faster pipes. Make every flap count.' })
  });
  const MEDALS = Object.freeze([{ score: 5, name: 'Bronze', color: '#c89164' }, { score: 15, name: 'Silver', color: '#9fbac9' }, { score: 30, name: 'Gold', color: '#ffcf4b' }, { score: 50, name: 'Sky legend', color: '#6fcfc4' }]);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  function circleRect(cx, cy, radius, x, y, w, h) {
    const dx = cx - clamp(cx, x, x + w), dy = cy - clamp(cy, y, y + h);
    return dx * dx + dy * dy < radius * radius;
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
    }
    flap() {
      if (this.state === 'ready') this.state = 'playing';
      if (this.state !== 'playing') return false;
      this.vy = this.config.flap; this.events.push({ type: 'flap' }); return true;
    }
    pause() { if (this.state === 'playing') { this.state = 'paused'; return true; } return false; }
    resume() { if (this.state === 'paused') { this.state = 'playing'; return true; } return false; }
    crash(reason) { if (this.state !== 'playing') return; this.state = 'dead'; this.reason = reason; this.events.push({ type: 'crash', reason }); }
    step(dt) {
      if (this.state !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
      // Never integrate more than 1/120 s: collisions cannot tunnel through pipes.
      let remaining = Math.min(dt, 0.1);
      while (remaining > 0 && this.state === 'playing') { const slice = Math.min(remaining, 1 / 120); this.integrate(slice); remaining -= slice; }
    }
    integrate(dt) {
      const c = this.config;
      this.elapsed += dt; this.distance += c.speed * dt; this.vy = Math.min(this.vy + c.gravity * dt, 650); this.y += this.vy * dt;
      this.nextPipe -= c.speed * dt;
      if (this.nextPipe <= WIDTH + 40) {
        const half = c.gap / 2;
        const center = clamp(this.lastCenter + (this.random() * 2 - 1) * c.shift, half + 66, FLOOR - half - 64);
        this.lastCenter = center;
        this.pipes.push({ x: this.nextPipe, center, scored: false }); this.nextPipe += c.spacing;
      }
      for (const pipe of this.pipes) {
        pipe.x -= c.speed * dt;
        const top = pipe.center - c.gap / 2, bottom = pipe.center + c.gap / 2;
        const hit = circleRect(BIRD_X, this.y, RADIUS, pipe.x, 0, PIPE_WIDTH, top - 25)
          || circleRect(BIRD_X, this.y, RADIUS, pipe.x - 5, top - 25, PIPE_WIDTH + 10, 25)
          || circleRect(BIRD_X, this.y, RADIUS, pipe.x, bottom + 25, PIPE_WIDTH, FLOOR - bottom - 25)
          || circleRect(BIRD_X, this.y, RADIUS, pipe.x - 5, bottom, PIPE_WIDTH + 10, 25);
        if (hit) { this.crash('pipe'); break; }
        if (!pipe.scored && pipe.x + PIPE_WIDTH + 5 < BIRD_X - RADIUS) {
          pipe.scored = true; this.score++; this.events.push({ type: 'score', score: this.score });
        }
      }
      this.pipes = this.pipes.filter(pipe => pipe.x + PIPE_WIDTH + 8 > -10);
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
    return { version: 1, best, runs, difficulty: Object.prototype.hasOwnProperty.call(DIFFICULTIES, input.difficulty) ? input.difficulty : 'normal',
      muted: input.muted === true, effects: input.effects !== false, music: input.music === true,
      volume: typeof input.volume === 'number' && Number.isFinite(input.volume) ? clamp(input.volume, 0, 1) : 0.6,
      reducedMotion: typeof input.reducedMotion === 'boolean' ? input.reducedMotion : reducedMotion };
  }
  const api = { Flight, DIFFICULTIES, MEDALS, WIDTH, HEIGHT, FLOOR, BIRD_X, RADIUS, PIPE_WIDTH, circleRect, safeSave, clamp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FlappyCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
