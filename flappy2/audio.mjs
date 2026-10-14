export class FlightAudio {
  constructor() { this.context = null; this.settings = {}; this.mode = 'moon'; this.noteAt = 0; this.note = 0; this.failed = false; }
  async unlock() {
    if (this.failed) return;
    try { const Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) { this.failed = true; return; }
      if (!this.context) { this.context = new Audio(); this.master = this.context.createGain(); this.master.connect(this.context.destination); this.apply(this.settings); }
      if (this.context.state === 'suspended') await this.context.resume();
    } catch { this.failed = true; }
  }
  apply(settings) { this.settings = settings; if (this.master) this.master.gain.setTargetAtTime(settings.sound === false ? 0 : (settings.volume ?? .45) * .45, this.context.currentTime, .03); }
  tone(freq, duration, type = 'sine', gain = .15, when = 0, end = null) {
    if (!this.context || this.context.state !== 'running') return;
    const t = this.context.currentTime + when, o = this.context.createOscillator(), g = this.context.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (end) o.frequency.exponentialRampToValueAtTime(end, t + duration);
    g.gain.setValueAtTime(.001, t); g.gain.exponentialRampToValueAtTime(Math.max(.002, gain), t + .008); g.gain.exponentialRampToValueAtTime(.001, t + duration);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + duration + .02); o.onended = () => { o.disconnect(); g.disconnect(); };
  }
  effect(kind) {
    if (!this.settings.sound) return;
    if (kind === 'flap') this.tone(this.mode === 'moon' ? 300 : 240, .055, 'sine', .11, 0, 530);
    if (kind === 'score') { this.tone(660, .12, 'sine', .14); this.tone(990, .2, 'sine', .11, .07); }
    if (kind === 'warning') { this.tone(220, .15, 'triangle', .12); this.tone(330, .12, 'triangle', .08, .17); }
    if (kind === 'fire') this.tone(170, .15, 'sawtooth', .07, 0, 50);
    if (kind === 'crash') { this.tone(110, .35, 'triangle', .35, 0, 35); this.tone(55, .45, 'sine', .3); }
    if (kind === 'coin') { this.tone(1100, .1, 'sine', .16); this.tone(1650, .24, 'sine', .13, .07); }
    if (kind === 'tick') this.tone(550, .08, 'sine', .1);
    if (kind === 'select') this.tone(440, .07, 'sine', .09);
  }
  tick(paused = false) {
    if (!this.context || !this.settings.music || !this.settings.sound || paused) { this.noteAt = 0; return; }
    const now = this.context.currentTime;
    if (!this.noteAt || this.noteAt < now - 1) this.noteAt = now;
    if (this.noteAt > now + .16) return;
    const notes = this.mode === 'moon' ? [220, 329.63, 440, 293.66, 261.63, 329.63, 493.88, 392] : this.mode === 'nightmare' ? [146.83, 220, 174.61, 207.65, 146.83, 164.81, 220, 196] : [130.81, 155.56, 196, 138.59, 130.81, 207.65, 174.61, 155.56];
    this.tone(notes[this.note++ % notes.length], .95, 'sine', .055, Math.max(0, this.noteAt - now));
    if (this.note % 4 === 1) this.tone(notes[0] / 2, 2.3, 'sine', .08);
    this.noteAt += .62;
  }
}
