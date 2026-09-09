(function (root) {
  'use strict';
  class FlightAudio {
    constructor(settings) { this.settings = settings; this.context = null; this.master = null; this.musicTimer = null; this.musicStep = 0; this.active = false; }
    async unlock() {
      try {
        if (!this.context) {
          const AudioContext = root.AudioContext || root.webkitAudioContext;
          if (!AudioContext) return false;
          this.context = new AudioContext(); this.master = this.context.createGain();
          // Gentle limiting protects against overlapping effects.
          const compressor = this.context.createDynamicsCompressor(); compressor.threshold.value = -12;
          compressor.knee.value = 18; compressor.ratio.value = 4;
          this.master.connect(compressor); compressor.connect(this.context.destination); this.update(this.settings);
        }
        if (this.context.state !== 'running') await this.context.resume();
        this.syncMusic(); return this.context.state === 'running';
      } catch (_) { return false; }
    }
    update(settings) {
      this.settings = settings;
      const nightmare = settings.difficulty === 'nightmare';
      if (nightmare !== this.nightmare) {
        this.nightmare = nightmare; this.musicStep = 0;
        if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
      }
      if (this.master) this.master.gain.setTargetAtTime(settings.muted ? 0 : settings.volume * .65, this.context.currentTime, .02);
      this.syncMusic();
    }
    tone(frequency, end, duration, volume = .15, type = 'sine', delay = 0) {
      if (!this.context || this.context.state !== 'running' || this.settings.muted) return;
      try {
        const now = this.context.currentTime + delay, osc = this.context.createOscillator(), gain = this.context.createGain();
        osc.type = type; osc.frequency.setValueAtTime(frequency, now); osc.frequency.exponentialRampToValueAtTime(Math.max(25, end), now + duration);
        gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(volume, now + .009); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
        osc.connect(gain); gain.connect(this.master); osc.start(now); osc.stop(now + duration + .03);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      } catch (_) { /* Audio is optional; interruptions must never stop play. */ }
    }
    effect(name, score = 0) {
      if (!this.settings.effects) return;
      if (name === 'flap') { this.tone(480, 860, .075, .1, 'sine'); this.tone(220, 160, .055, .035, 'triangle'); }
      if (name === 'score') { const pitch = [784, 880, 988, 1046][score % 4]; this.tone(pitch, pitch, .19, .14); this.tone(pitch * 1.5, pitch * 1.5, .22, .065, 'sine', .07); }
      if (name === 'crash') { this.tone(170, 42, .26, .26, 'triangle'); this.tone(80, 30, .22, .2); }
      if (name === 'start') { (this.nightmare ? [220, 261.63, 329.63] : [523.25, 659.25, 783.99]).forEach((f, i) => this.tone(f, f, this.nightmare ? .3 : .15, .095, 'sine', i * .055)); }
      if (name === 'medal') { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, f, .24, .12, 'triangle', i * .085)); }
      if (name === 'tick') this.tone(700, 700, .06, .08);
      if (name === 'select') this.tone(520, 590, .055, .06);
      if (name === 'bat') { this.tone(260, 110, .48, .13, 'triangle'); this.tone(700, 220, .33, .055, 'sine', .1); }
      if (name === 'warning') { const warning = score || .95; this.tone(440, 440, Math.min(.12, warning * .4), .12, 'triangle'); this.tone(587.33, 587.33, Math.min(.17, warning * .5), .1, 'triangle', Math.min(.19, warning * .24)); }
      // Additional bats add audible layers without multiplying the full volume.
      if (name === 'laser') { const level = 1 / (1 + score * .3); this.tone(1700 - score * 80, 170, .38, .17 * level, 'sawtooth'); this.tone(110, 65, .32, .13 * level, 'triangle'); }
      if (name === 'volley') { const level = 1 / (1 + score * .3); [0, .045, .09].forEach(delay => this.tone(680, 180, .15, .105 * level, 'triangle', delay)); }
      if (name === 'clear') { [329.63, 392, 493.88].forEach((f, i) => this.tone(f, f, .28, .1, 'sine', i * .09)); }
    }
    setActive(active) { this.active = active; this.syncMusic(); }
    syncMusic() {
      const shouldPlay = this.active && this.settings.music && !this.settings.muted && this.context?.state === 'running';
      if (!shouldPlay && this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
      if (shouldPlay && !this.musicTimer) {
        // Original sparse pentatonic loop, deliberately quieter than effects.
        const notes = this.nightmare ? [220, 0, 261.63, 0, 329.63, 0, 311.13, 0, 196, 0, 246.94, 0, 293.66, 0, 220, 0] : [523.25, 0, 659.25, 783.99, 0, 659.25, 587.33, 0, 440, 0, 523.25, 659.25, 0, 587.33, 523.25, 0];
        this.musicTimer = setInterval(() => {
          const n = notes[this.musicStep % notes.length]; if (n) this.tone(n, n, .24, .032, 'triangle');
          if (this.musicStep % 4 === 0) { const bass = this.nightmare ? (this.musicStep % 16 < 8 ? 55 : 49) : (this.musicStep % 16 < 8 ? 130.81 : 110); this.tone(bass, bass, this.nightmare ? .65 : .32, .035); }
          this.musicStep++;
        }, this.nightmare ? 290 : 230);
      }
    }
    suspend() { this.setActive(false); if (this.context?.state === 'running') this.context.suspend().catch(() => {}); }
  }
  root.FlightAudio = FlightAudio;
})(window);
