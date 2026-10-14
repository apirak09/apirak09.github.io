import { H, FLOOR, R, SINS, seeded, clamp } from './engine.mjs';
const TAU = Math.PI * 2;
function ellipse(c, x, y, rx, ry, fill, rotate = 0) { c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rotate, 0, TAU); if (fill) { c.fillStyle = fill; c.fill(); } }
function path(c, points, fill, stroke) { c.beginPath(); points.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.stroke(); } }
function line(c, x, y, x2, y2, color, width = 1) { c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.strokeStyle = color; c.lineWidth = width; c.stroke(); }
export function drawBird(c, x, y, angle, time, mode = 'moon', scale = 1, ghost = false) {
  c.save(); c.translate(x, y); c.rotate(angle); c.scale(scale, scale);
  if (ghost) c.globalAlpha *= .78;
  const wing = Math.sin(time * 22) * 4;
  path(c, [[-17, -3], [-32, -13], [-27, 3], [-33, 11], [-14, 8]], ghost ? '#598a72' : '#8c8975', '#292a29');
  const body = c.createLinearGradient(-15, -18, 12, 19); body.addColorStop(0, ghost ? '#bbf4d5' : '#f5f1ce'); body.addColorStop(.6, ghost ? '#689e81' : '#d7d6b5'); body.addColorStop(1, ghost ? '#315f4b' : '#918e76');
  ellipse(c, 0, 0, 22, 18, body); c.lineWidth = 1.5; c.strokeStyle = ghost ? '#baffd7' : '#3c4037'; c.stroke();
  ellipse(c, 2, 8, 16, 10, ghost ? '#5aa17c' : '#e5c56d');
  if (mode === 'moon') {
    c.save(); ellipse(c, 9, -5, 14, 12); c.clip();
    const visor = c.createLinearGradient(0, -15, 21, 9); visor.addColorStop(0, '#d1ecdd'); visor.addColorStop(.3, '#68a9b3'); visor.addColorStop(1, '#183e52'); c.fillStyle = visor; c.fillRect(-6, -20, 35, 40);
    path(c, [[0, -14], [9, -15], [19, -8], [18, -5], [7, -10], [-2, -8]], '#d6f5ed88');
    c.restore(); ellipse(c, 9, -5, 14, 12); c.strokeStyle = '#5b716f'; c.lineWidth = 2; c.stroke();
    ellipse(c, 12, -3, 2, 3, '#122b35');
    line(c, -8, -17, -12, -27, '#b8c5b0', 2); ellipse(c, -12, -28, 3, 3, '#ecf5a1');
    c.fillStyle = '#8e9687'; c.fillRect(-23, -9, 6, 19); c.fillStyle = '#d0d4b3'; c.fillRect(-23, -7, 4, 6);
  } else {
    ellipse(c, 11, -5, 8, 9, ghost ? '#ccffde' : '#fbf3ce'); ellipse(c, 14, -6, 2.4, 3.5, '#111918');
    path(c, [[4, -15], [19, -13], [15, -9], [5, -11]], mode === 'hell' ? '#e7a66b' : '#bc5d72');
    line(c, -2, -15, 3, -9, '#756a62', 1.5);
  }
  path(c, [[21, -1], [31, 4], [20, 7]], ghost ? '#8adbae' : '#e6a458', '#635139');
  c.save(); c.translate(-7, 2); c.rotate(-.2 + wing * .06);
  const w = c.createLinearGradient(0, -2, -10, 14); w.addColorStop(0, ghost ? '#9eeac0' : '#e4e6c0'); w.addColorStop(1, ghost ? '#397856' : '#9b9d7a');
  c.beginPath(); c.moveTo(9, -3); c.bezierCurveTo(-2, -9, -20, 0, -19, 11 + wing); c.bezierCurveTo(-6, 13 + wing, 6, 8, 9, -3); c.fillStyle = w; c.fill(); c.strokeStyle = '#727a60'; c.lineWidth = 1; c.stroke();
  line(c, -10, 6, 0, 1, '#6a715a88'); c.restore();
  line(c, -1, 16, 3, 21, '#ad9360', 2); line(c, 10, 14, 15, 19, '#ad9360', 2);
  c.restore();
}
function bat(c, x, y, time, scale = 1, color = '#cc637c') {
  c.save(); c.translate(x, y); c.scale(scale, scale); const flap = Math.sin(time * 9) * 10;
  for (const sign of [-1, 1]) { c.save(); c.scale(sign, 1); c.beginPath(); c.moveTo(0, -4); c.bezierCurveTo(13, -15 - flap, 26, -7 - flap, 37, -24 - flap); c.quadraticCurveTo(35, 9, 25, 8); c.quadraticCurveTo(19, 2, 16, 15); c.quadraticCurveTo(8, 5, 0, 12); c.closePath(); c.fillStyle = color; c.fill(); c.strokeStyle = '#f6a0ab88'; c.lineWidth = 1; c.stroke(); line(c, 3, 2, 29, -8 - flap * .4, '#441d35'); c.restore(); }
  ellipse(c, 0, 1, 8, 13, '#341a30'); path(c, [[-8, -6], [-9, -19], [-1, -12], [8, -19], [9, -5]], '#4e233e');
  ellipse(c, -3.5, -5, 1.8, 2.2, '#fff1b5'); ellipse(c, 3.5, -5, 1.8, 2.2, '#fff1b5'); c.restore();
}
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false });
    if (!this.ctx) throw new Error('Canvas is unavailable');
    const rng = seeded(94021); this.stars = Array.from({ length: 250 }, () => ({ x: rng(), y: rng() * .81, r: .3 + rng() * 1.15, a: .2 + rng() * .7 }));
    this.rocks = Array.from({ length: 44 }, () => ({ x: rng(), y: rng(), r: rng() * 18 + 5, a: rng() }));
    this.particles = []; this.flash = 0; this.shake = 0; this.time = 0; this.motion = false; this.low = false; this.cssW = 1; this.cssH = 1;
  }
  resize(w, h, quality = 'auto') {
    this.cssW = w; this.cssH = h; this.scale = h / H; this.width = w / this.scale;
    const dpr = Math.min(window.devicePixelRatio || 1, quality === 'low' ? 1 : 2, Math.sqrt(3500000 / Math.max(1, w * h)));
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr); this.dpr = dpr;
    this.low = quality === 'low' || (quality === 'auto' && w * h * dpr ** 2 > 2600000);
  }
  burst(x, y, color = '#f1f1bb', n = 12) {
    if (this.motion) return;
    for (let i = 0; i < n && this.particles.length < 100; i++) { const a = i / n * TAU; this.particles.push({ x, y, vx: Math.cos(a) * (40 + i * 7), vy: Math.sin(a) * (40 + i * 7), life: .6, color }); }
  }
  draw(flight, dt, menu = false, frozen = false) {
    const c = this.ctx, w = this.width, mode = flight.mode;
    if (!frozen) this.time += Math.min(dt, .05);
    const time = this.motion ? 0 : this.time, distance = menu ? time * 14 : flight.distance;
    c.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, 0, 0);
    c.clearRect(0, 0, w, H); this.background(c, w, mode, time, distance);
    c.save();
    if (!this.motion && this.shake > 0) { c.translate(Math.sin(time * 73) * this.shake, Math.cos(time * 53) * this.shake * .5); this.shake = Math.max(0, this.shake - dt * 30); }
    if (!menu) {
      for (const e of flight.hazards) if (e.sin === 'sloth') this.drawSin(c, e, flight, time);
      for (const gate of flight.gates) this.gate(c, gate.x, gate.w, gate.center, gate.gap, mode, time);
      for (const e of flight.hazards) if (e.sin !== 'sloth') this.drawSin(c, e, flight, time);
      this.drawAttack(c, flight, time);
      if (flight.heavy) { c.fillStyle = '#be954812'; c.fillRect(0, 0, w, FLOOR); }
      this.player(c, flight, time, frozen);
      this.offscreenCue(c, flight);
    } else {
      const phone = this.cssW < 650 && this.cssH > this.cssW;
      const bx = phone ? w * .81 : w * .69, by = phone ? 200 : 339;
      const size = phone ? 1.65 : 2.8;
      if (!this.motion) for (let j = 0; j < 8; j++) ellipse(c, bx - 50 - j * 12, by + 12 + Math.sin(time * 2 - j * .4) * 10, 2.5 - j * .2, 2.5 - j * .2, `${mode === 'moon' ? '#e8edba' : '#fbad86'}${Math.round((1 - j / 8) * 70).toString(16).padStart(2, '0')}`);
      drawBird(c, bx, by + Math.sin(time * 1.7) * 10, -.11, time * .45, mode, size);
      if (!phone && mode === 'nightmare') { bat(c, w * .84, 265 + Math.sin(time) * 8, time, .7, '#894159'); bat(c, w * .86, 422, time + 1, .45, '#78334e'); }
    }
    c.restore();
    this.ground(c, w, mode, distance, time);
    for (const p of this.particles) { if (!frozen) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 150 * dt; } c.globalAlpha = Math.max(0, p.life / .6); ellipse(c, p.x, p.y, 2.5, 2.5, p.color); }
    c.globalAlpha = 1; this.particles = this.particles.filter(p => p.life > 0);
    if (this.flash > 0 && !this.motion) { c.fillStyle = `rgba(249,202,151,${this.flash * .12})`; c.fillRect(0, 0, w, H); this.flash = Math.max(0, this.flash - dt * 4); }
  }
  background(c, w, mode, time, d) {
    const sky = c.createLinearGradient(0, 0, 0, H);
    const colors = mode === 'moon' ? ['#03090f', '#111e2a', '#343e46'] : mode === 'nightmare' ? ['#100a15', '#301421', '#6a2e3b'] : ['#150c0d', '#522522', '#b75e38'];
    sky.addColorStop(0, colors[0]); sky.addColorStop(.62, colors[1]); sky.addColorStop(1, colors[2]); c.fillStyle = sky; c.fillRect(0, 0, w, H);
    const count = this.low ? 90 : 220;
    for (let i = 0; i < count; i++) { const s = this.stars[i]; c.globalAlpha = s.a * (mode === 'hell' ? .35 : 1); ellipse(c, ((s.x * w - d * .013) % w + w) % w, s.y * H, s.r, s.r, mode === 'moon' ? '#cddad9' : '#edbdaf'); }
    c.globalAlpha = 1;
    const phone = w < 600, x = w * (phone ? .78 : .73), y = phone ? 115 : 178, r = phone ? 51 : 88;
    if (mode === 'moon') this.earth(c, x, y, r, time);
    else if (mode === 'nightmare') {
      const moon = c.createRadialGradient(x - r * .3, y - r * .3, r * .05, x, y, r); moon.addColorStop(0, '#e59a85'); moon.addColorStop(.6, '#c86f70'); moon.addColorStop(1, '#793549'); ellipse(c, x, y, r, r, moon);
      c.save(); ellipse(c, x, y, r, r); c.clip();
      for (const rock of this.rocks.slice(0, 25)) { const rx = x + (rock.x - .5) * r * 2, ry = y + (rock.y - .5) * r * 2; ellipse(c, rx, ry, rock.r * .8, rock.r * .7, '#5d2e3c30'); ellipse(c, rx - 2, ry - 1, rock.r * .55, rock.r * .45, '#e3a18a1f'); }
      c.restore();
    } else {
      const glow = c.createRadialGradient(x, y, r * .7, x, y, r * 2.3); glow.addColorStop(0, '#e7a77e44'); glow.addColorStop(1, '#b9653300'); c.fillStyle = glow; c.fillRect(x - r * 2.3, y - r * 2.3, r * 4.6, r * 4.6);
      ellipse(c, x, y, r + 2, r + 2, '#ffb37e'); ellipse(c, x - 3, y - 5, r, r, '#241219');
      for (let i = 0; i < 5; i++) { c.strokeStyle = '#ed9d6f33'; c.lineWidth = .8; c.beginPath(); c.arc(x, y, r + 8 + i * 3, .3 + i, 1.4 + i); c.stroke(); }
    }
    for (let layer = 0; layer < 3; layer++) {
      const base = 470 + layer * 62, offset = d * (.025 + layer * .035), points = [[0, H]];
      for (let xx = -30; xx <= w + 30; xx += 25) {
        const q = xx + offset, wave = Math.sin(q * .005 + layer * 2) * (47 - layer * 9) + Math.sin(q * .019 + layer) * (20 - layer * 3);
        points.push([xx, base + wave]);
      }
      points.push([w, H]); path(c, points, mode === 'moon' ? ['#36424a', '#28323a', '#20282f'][layer] : mode === 'nightmare' ? ['#4d293b', '#311e2e', '#241a27'][layer] : ['#693b36', '#42272c', '#2c1c23'][layer]);
    }
    if (mode === 'moon') {
      for (let i = 0; i < this.rocks.length; i++) { const rock = this.rocks[i], xx = ((rock.x * (w + 100) - d * .12) % (w + 100) + w + 100) % (w + 100) - 50, yy = 551 + rock.y * 111;
        ellipse(c, xx, yy, rock.r * 1.5, rock.r * .33, '#0f171e88'); c.beginPath(); c.ellipse(xx + 1, yy - 2, rock.r * 1.5, rock.r * .34, 0, .1, Math.PI); c.strokeStyle = '#7e8a8e50'; c.lineWidth = 1.5; c.stroke(); }
    } else if (mode === 'nightmare') {
      for (let i = -1; i < Math.ceil(w / 220) + 1; i++) { const xx = i * 220 - d * .07 % 220, yy = 489 + Math.sin(i * 4) * 25;
        path(c, [[xx, 640], [xx, yy], [xx + 10, yy], [xx + 25, yy - 76], [xx + 38, yy], [xx + 48, yy], [xx + 48, 640]], '#261b2b');
        path(c, [[xx + 70, 640], [xx + 70, yy + 11], [xx + 78, yy + 11], [xx + 88, yy - 20], [xx + 99, yy + 11], [xx + 108, yy + 11], [xx + 108, 640]], '#241a29');
        c.fillStyle = '#9e4c573d'; c.fillRect(xx + 23, yy + 25, 4, 20); }
      for (let i = 0; i < 5; i++) bat(c, (w * .61 + i * 45 + Math.sin(time * .3) * 8) % w, 330 + Math.sin(i * 2) * 55, time + i, .16, '#432538');
    } else {
      for (let i = -1; i < Math.ceil(w / 170) + 1; i++) { const xx = i * 170 - d * .09 % 170, h = 45 + Math.abs(Math.sin(i * 19)) * 100;
        path(c, [[xx - 40, 657], [xx + 17, 550 - h], [xx + 37, 590 - h], [xx + 68, 535 - h * .4], [xx + 105, 662]], '#271d26');
        path(c, [[xx + 17, 550 - h], [xx + 25, 587 - h], [xx + 5, 615], [xx + 19, 650], [xx - 4, 662], [xx - 9, 615]], '#dd794334'); }
      if (!this.motion) for (let i = 0; i < (this.low ? 15 : 35); i++) { const xx = (i * 83 + Math.sin(i * 6 + time * .4) * 18 + w) % w, yy = 660 - (time * (12 + i % 6) + i * 31) % 290; ellipse(c, xx, yy, 1, 2, '#f6a27499'); }
    }
    // A natural vignette keeps the horizon bright and the interface readable.
    const shade = c.createLinearGradient(0, 0, w, 0); shade.addColorStop(0, '#0206098a'); shade.addColorStop(.52, '#00000000'); shade.addColorStop(1, '#0000000a'); c.fillStyle = shade; c.fillRect(0, 0, w, H);
  }
  earth(c, x, y, r, time) {
    const halo = c.createRadialGradient(x, y, r * .9, x, y, r * 1.18); halo.addColorStop(0, '#85bad155'); halo.addColorStop(1, '#6ec4e000'); ellipse(c, x, y, r * 1.18, r * 1.18, halo);
    const ocean = c.createRadialGradient(x - r * .45, y - r * .4, 0, x, y, r); ocean.addColorStop(0, '#709eac'); ocean.addColorStop(.5, '#3b738b'); ocean.addColorStop(1, '#102736'); ellipse(c, x, y, r, r, ocean);
    c.save(); ellipse(c, x, y, r, r); c.clip(); c.translate(x, y); c.scale(r / 88, r / 88);
    path(c, [[-67, -45], [-47, -57], [-26, -49], [-16, -31], [2, -26], [-3, -15], [-21, -7], [-17, 6], [-31, 14], [-34, 30], [-46, 23], [-55, 3], [-75, -10]], '#a2b39a');
    path(c, [[-19, 18], [-3, 13], [13, 28], [8, 42], [1, 49], [-4, 69], [-17, 76], [-23, 51], [-31, 37]], '#8da288');
    path(c, [[37, -67], [67, -54], [90, -29], [69, -13], [48, -21], [28, -40]], '#89a89d');
    for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(-90 + i * 8, -65 + i * 19); c.bezierCurveTo(-30, -78 + i * 18, 25, -32 + i * 10, 100, -52 + i * 20); c.strokeStyle = i % 2 ? '#eff4e17a' : '#dce9e34a'; c.lineWidth = 3 + i % 3 * 2; c.stroke(); }
    const night = c.createLinearGradient(-75, 0, 80, 30); night.addColorStop(0, '#07111e00'); night.addColorStop(.55, '#07111e0a'); night.addColorStop(1, '#02060bd9'); c.fillStyle = night; c.fillRect(-95, -95, 190, 190); c.restore();
    c.beginPath(); c.arc(x, y, r, Math.PI * .8, Math.PI * 1.65); c.strokeStyle = '#b5d5d288'; c.lineWidth = 1.4; c.stroke();
  }
  ground(c, w, mode, d, time) {
    c.fillStyle = mode === 'moon' ? '#131c22' : mode === 'nightmare' ? '#180f1d' : '#221219'; c.fillRect(0, FLOOR, w, H - FLOOR);
    line(c, 0, FLOOR, w, FLOOR, mode === 'moon' ? '#7b8585' : mode === 'nightmare' ? '#a75565' : '#ffb079', 2);
    for (let i = -1; i < w / 75 + 1; i++) { const x = i * 75 - d * .65 % 75;
      if (mode === 'hell') { path(c, [[x, 674], [x + 18, 670], [x + 35, 679], [x + 51, 675], [x + 69, 680], [x + 43, 687], [x + 25, 682], [x + 6, 688]], '#d16a35'); line(c, x + 7, 676, x + 21, 674, '#f9be7a', 1.8); }
      else { path(c, [[x, 684], [x + 7, 678], [x + 20, 680], [x + 24, 685]], mode === 'moon' ? '#4b565b' : '#4d2b3e'); line(c, x + 31, 703, x + 48, 701, mode === 'moon' ? '#29363d' : '#3c2336'); }
    }
  }
  gate(c, x, width, center, gap, mode) {
    if (x > this.width + 100 || x + width < -100) return;
    const top = center - gap / 2, bottom = center + gap / 2;
    const metal = c.createLinearGradient(x, 0, x + width, 0), moon = mode === 'moon';
    metal.addColorStop(0, moon ? '#475057' : '#4a2538'); metal.addColorStop(.2, moon ? '#788080' : '#783f50'); metal.addColorStop(.28, moon ? '#606c70' : '#583045'); metal.addColorStop(.84, moon ? '#323d46' : '#321d30'); metal.addColorStop(1, moon ? '#212d35' : '#1a1422');
    c.fillStyle = metal; c.fillRect(x, 0, width, top); c.fillRect(x, bottom, width, FLOOR - bottom);
    for (const [edge, dir] of [[top, -1], [bottom, 1]]) {
      c.fillStyle = moon ? '#b9bba3' : '#bd6873'; c.fillRect(x - 5, edge + (dir < 0 ? -17 : 0), width + 10, 17);
      c.fillStyle = moon ? '#dfe6ac' : '#f0a29c'; c.fillRect(x - 5, edge + (dir < 0 ? -3 : 0), width + 10, 3);
      c.fillStyle = moon ? '#3a4749' : '#4f273c'; for (let i = 0; i < 5; i++) c.fillRect(x + i * 15, edge + dir * 8 - 2, 8, 4);
      line(c, x + 5, edge + dir * 21, x + width - 5, edge + dir * 21, '#d6d9c141');
    }
    c.save(); c.beginPath(); c.rect(x, 0, width, top - 18); c.rect(x, bottom + 18, width, FLOOR); c.clip();
    for (let j = 0; j < 10; j++) { const yy = j * 78 + (x * .2 % 40); line(c, x + 9, yy, x + 27, yy + 12, moon ? '#a9b4ae26' : '#be5a6b44'); line(c, x + 27, yy + 12, x + 21, yy + 24, '#050b144d'); }
    c.restore();
  }
  drawSin(c, e, f, time) {
    // Wrath spans the viewport even when its emitter is still offscreen.
    if (!(e.sin === 'wrath' && e.triggered) && (e.x > this.width + 190 || e.x + Math.max(190, e.w) < -80)) return;
    const color = SINS[e.sin].color, top = e.y - (e.opening || e.gap) / 2, bottom = e.y + (e.opening || e.gap) / 2;
    c.save();
    if (e.sin === 'pride') {
      this.gate(c, e.x + 5, e.w - 10, e.y, e.opening || e.gap, 'nightmare');
      c.fillStyle = '#8b648d'; c.fillRect(e.x, top - 23, e.w, 23); c.fillRect(e.x, bottom, e.w, 23);
      for (const [yy, sign] of [[top - 6, -1], [bottom + 6, 1]]) path(c, [[e.x + 7, yy], [e.x + 7, yy + sign * 22], [e.x + 24, yy + sign * 10], [e.x + e.w / 2, yy + sign * 27], [e.x + e.w - 23, yy + sign * 10], [e.x + e.w - 7, yy + sign * 22], [e.x + e.w - 7, yy]], '#e0bd7e', '#fff0bd');
      c.setLineDash([4, 7]); line(c, e.x + e.w / 2, top + 26, e.x + e.w / 2, bottom - 26, '#dfbaff88');
    } else if (e.sin === 'gluttony') {
      const flesh = c.createLinearGradient(e.x, 0, e.x + e.w, 0); flesh.addColorStop(0, '#4b3b36'); flesh.addColorStop(.4, '#77805a'); flesh.addColorStop(1, '#344437');
      c.fillStyle = flesh; c.fillRect(e.x, 0, e.w, top); c.fillRect(e.x, bottom, e.w, FLOOR - bottom);
      for (const [yy, dir] of [[top, -1], [bottom, 1]]) {
        c.fillStyle = '#b17c6b'; c.fillRect(e.x, yy + (dir < 0 ? -32 : 0), e.w, 32);
        for (let i = 0; i < 5; i++) path(c, [[e.x + i * e.w / 5, yy + dir * 29], [e.x + (i + 1) * e.w / 5, yy + dir * 29], [e.x + (i + .5) * e.w / 5, yy + dir * 1]], '#eee1b5', '#d9c997');
        line(c, e.x, yy, e.x + e.w, yy, '#f2bd98', 2);
      }
      ellipse(c, e.x + e.w * .27, top - 68, 15, 12, '#d8d9a2'); ellipse(c, e.x + e.w * .73, top - 68, 15, 12, '#d8d9a2'); ellipse(c, e.x + e.w * .27, top - 64, 4, 7, '#1a2825'); ellipse(c, e.x + e.w * .73, top - 64, 4, 7, '#1a2825');
    } else if (e.sin === 'greed') {
      c.beginPath(); c.arc(e.x, e.y, 59, 0, TAU); c.strokeStyle = '#e5c38655'; c.lineWidth = 1; c.setLineDash([3, 5]); c.stroke(); c.setLineDash([]);
      for (const b of e.blades) { line(c, e.x, e.y, b.x, b.y, '#b69467aa'); c.save(); c.translate(b.x, b.y); c.rotate(time * 5); const pts = []; for (let j = 0; j < 20; j++) { const a = j / 20 * TAU, r = j % 2 ? 11 : 15; pts.push([Math.cos(a) * r, Math.sin(a) * r]); } path(c, pts, '#e3c67a', '#fff0b2'); ellipse(c, 0, 0, 5, 5, '#795838'); c.restore(); }
      if (!e.collected) { ellipse(c, e.x, e.y, 13, 15, '#eac76d'); ellipse(c, e.x, e.y, 9, 11, '#b18847'); line(c, e.x, e.y - 7, e.x, e.y + 7, '#ffe7a2', 2); line(c, e.x - 4, e.y - 4, e.x + 4, e.y + 4, '#ffe7a2', 2); }
    } else if (e.sin === 'envy') {
      for (let j = 3; j > 0; j--) { c.globalAlpha = .1; drawBird(c, e.x + j * 17, e.y + Math.sin(time * 3 + j) * 6, Math.PI * .02, time, 'hell', .88, true); }
      c.globalAlpha = 1; drawBird(c, e.x, e.y, -.1, time, 'hell', .9, true);
      if (!e.locked) { c.setLineDash([4, 6]); line(c, e.x - 100, e.y, e.x - 38, e.y, '#9ee8b781'); }
    } else if (e.sin === 'lust') {
      const field = c.createRadialGradient(e.x, e.y, 22, e.x, e.y, 175); field.addColorStop(0, '#de6a9740'); field.addColorStop(1, '#c05e8200'); ellipse(c, e.x, e.y, 175, 175, field);
      for (let j = 0; j < 3; j++) { const radius = 55 + ((j * 43 - time * 18) % 120 + 120) % 120; c.globalAlpha = (1 - radius / 180) * .65; c.beginPath(); c.ellipse(e.x, e.y, radius, radius, 0, 0, TAU); c.strokeStyle = color; c.lineWidth = 1; c.stroke(); }
      c.globalAlpha = 1;
      c.save(); c.translate(e.x, e.y); c.rotate(time * .3);
      for (let j = 0; j < 7; j++) { const a = j / 7 * TAU; ellipse(c, Math.cos(a) * 13, Math.sin(a) * 13, 18, 11, j % 2 ? '#d7809e' : '#a74d77', a); }
      ellipse(c, 0, 0, 12, 12, '#48243c'); path(c, [[0, -9], [8, 1], [0, 10], [-8, 1]], '#ffc8d3'); c.restore();
    } else if (e.sin === 'sloth') {
      const g = c.createLinearGradient(e.x, 0, e.x + e.w, 0); g.addColorStop(0, '#d3ac5010'); g.addColorStop(.18, '#d3ac502e'); g.addColorStop(.8, '#d3ac502e'); g.addColorStop(1, '#d3ac5008'); c.fillStyle = g; c.fillRect(e.x, 0, e.w, FLOOR);
      c.setLineDash([5, 9]); line(c, e.x, 0, e.x, FLOOR, '#e2bc7c88'); line(c, e.x + e.w, 0, e.x + e.w, FLOOR, '#e2bc7c88'); c.setLineDash([]);
      for (let j = 0; j < 7; j++) { const yy = (time * 13 + j * 93) % FLOOR; line(c, e.x + 20, yy, e.x + e.w - 20, yy + 20, '#e1ba6e24'); }
      this.hourglass(c, e.x + e.w / 2, 115, color);
    } else if (e.sin === 'wrath') {
      if (e.triggered) {
        const active = e.timer >= e.warning && e.timer < e.warning + .34;
        if (e.timer < e.warning) { c.setLineDash([9, 10]); line(c, 0, e.y, this.width, e.y, '#ffb197bb', 2); c.setLineDash([]); const progress = 1 - e.timer / e.warning; c.fillStyle = '#ff9b80'; c.fillRect(this.width - 54, e.y - 20, 40 * progress, 3); }
        if (active) {
          c.fillStyle = '#de664544'; c.fillRect(0, e.y - 11, this.width, 22); c.fillStyle = '#ffaf78'; c.fillRect(0, e.y - 6, this.width, 12);
          const pts = []; for (let xx = 0; xx <= this.width; xx += 16) pts.push([xx, e.y + Math.sin(xx * .7 + time * 55) * 4]);
          c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.strokeStyle = '#fff5cc'; c.lineWidth = 3; c.stroke();
        }
        ellipse(c, Math.min(this.width - 27, e.x), e.y, 19, 24, '#712d32'); ellipse(c, Math.min(this.width - 27, e.x), e.y, 7, 15, active ? '#fff1b8' : '#e59172');
      }
    }
    c.restore();
  }
  hourglass(c, x, y, color) { c.save(); c.translate(x, y); line(c, -12, -17, 12, -17, color, 2); line(c, -12, 17, 12, 17, color, 2); path(c, [[-10, -15], [10, -15], [4, -2], [2, 1], [10, 15], [-10, 15], [-2, 1], [-4, -2]], '#e3b86822', color); path(c, [[-7, 13], [7, 13], [0, 4]], color); c.restore(); }
  drawAttack(c, f, time) {
    const a = f.attack;
    if (f.phase === 'arrival') { const ex = Math.min(this.width - 40, f.birdX + 470); for (let j = 0; j < f.threat.bats; j++) bat(c, ex + (1 - Math.min(1, f.phaseAge / .8)) * 100, 80 + j * 70, time + j, .65); }
    if (a) {
      if (a.kind === 'volley') { c.fillStyle = '#b9daaa0c'; c.fillRect(0, a.safeY - a.tuning.corridor, this.width, a.tuning.corridor * 2); c.setLineDash([6, 8]); line(c, 0, a.safeY - a.tuning.corridor, this.width, a.safeY - a.tuning.corridor, '#d4e8af99'); line(c, 0, a.safeY + a.tuning.corridor, this.width, a.safeY + a.tuning.corridor, '#d4e8af99'); c.setLineDash([]); }
      for (const b of a.shooters) {
        if (a.kind === 'laser') {
          if (!b.fired) { c.setLineDash([8, 9]); line(c, 0, b.aim, b.x, b.aim, '#f4a2aa99', 1.5); c.setLineDash([]); ellipse(c, f.birdX, b.aim, 4, 4, '#f2a9a8'); }
          else if (a.age < b.fireAt + a.tuning.laserTime) { c.fillStyle = '#c64b6d4a'; c.fillRect(0, b.aim - a.tuning.beam, b.x, a.tuning.beam * 2); c.fillStyle = '#f899a3'; c.fillRect(0, b.aim - a.tuning.beam * .55, b.x, a.tuning.beam * 1.1); line(c, 0, b.aim, b.x, b.aim, '#fff3cf', 2); }
        }
        bat(c, b.x, b.y, time + b.x, .73);
      }
    }
    for (const b of f.bolts) { ellipse(c, b.x, b.y, b.r + 4, b.r + 2, '#df708a33'); ellipse(c, b.x, b.y, b.r, b.r, '#e9879a'); ellipse(c, b.x - 1, b.y - 1, 3, 3, '#ffe8b5'); }
  }
  player(c, f, time, frozen) {
    const angle = f.state === 'ready' ? -.1 : clamp(f.vy / 570, -.48, 1.1);
    if (!this.motion && f.state === 'playing' && !frozen && this.particles.length < 60 && Math.sin(time * 31) > .7) this.particles.push({ x: f.birdX - 24, y: f.y + 4, vx: -65, vy: 12, life: .28, color: f.mode === 'moon' ? '#dce4b2' : '#f2a389' });
    drawBird(c, f.birdX, f.y, angle, time, f.mode, 1);
  }
  offscreenCue(c, f) {
    const next = [...f.gates.map(e => ({ x: e.x, y: e.center, color: '#e3e5b6' })), ...f.hazards.filter(e => !e.scored).map(e => ({ x: e.x, y: e.sin === 'sloth' ? 340 : e.y, color: SINS[e.sin].color }))].filter(e => e.x > this.width + 20).sort((a, b) => a.x - b.x)[0];
    if (!next || (next.x - f.birdX) / f.speed > 2.8) return;
    const yy = clamp(next.y, 145, FLOOR - 55); path(c, [[this.width - 17, yy - 7], [this.width - 9, yy], [this.width - 17, yy + 7]], null, next.color);
  }
}
