/** Original synthesized sounds; no downloaded audio or autoplay. */
export class IslandAudio {
  constructor() { this.enabled = false; this.context = null; this.master = null; this.round = 0; this.active = new Set(); }
  async unlock() {
    if (!this.enabled) return;
    try {
      if (!this.context) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) { this.enabled = false; return; }
        this.context = new Context();
        this.master = this.context.createGain(); this.master.gain.value = 0.3;
        const compressor = this.context.createDynamicsCompressor();
        this.master.connect(compressor); compressor.connect(this.context.destination);
        this.wind();
      }
      if (this.context.state === 'suspended' && !document.hidden) await this.context.resume();
    } catch { this.enabled = false; }
  }
  async setEnabled(value) {
    this.enabled = value;
    if (value) await this.unlock();
    else if (this.context?.state === 'running') await this.context.suspend().catch(() => {});
  }
  noiseBuffer(seconds) {
    const buffer = this.context.createBuffer(1, this.context.sampleRate * seconds, this.context.sampleRate);
    const data = buffer.getChannelData(0); let previous = 0;
    for (let i = 0; i < data.length; i++) { const white = Math.random() * 2 - 1; previous = (previous + 0.02 * white) / 1.02; data[i] = previous * 3.5; }
    return buffer;
  }
  wind() {
    const c = this.context;
    const source = c.createBufferSource(); source.buffer = this.noiseBuffer(5); source.loop = true;
    const filter = c.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 650;
    this.windGain = c.createGain(); this.windGain.gain.value = 0.19;
    source.connect(filter); filter.connect(this.windGain); this.windGain.connect(this.master); source.start();
    const lfo = c.createOscillator(); const depth = c.createGain(); lfo.frequency.value = 0.12; depth.gain.value = 0.05;
    lfo.connect(depth); depth.connect(this.windGain.gain); lfo.start();
  }
  tone(frequency, duration, volume = 0.1, type = 'sine', delay = 0, endFrequency = frequency) {
    if (!this.enabled || this.context?.state !== 'running') return;
    const c = this.context, at = c.currentTime + delay;
    const oscillator = c.createOscillator(), gain = c.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, at); oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), at + duration);
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(volume, at + 0.012); gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain); gain.connect(this.master); oscillator.start(at); oscillator.stop(at + duration + 0.02);
    this.active.add(oscillator); oscillator.onended = () => { this.active.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
  }
  noise(duration, volume, delay = 0, frequency = 1500) {
    if (!this.enabled || this.context?.state !== 'running') return;
    const c = this.context, at = c.currentTime + delay;
    const source = c.createBufferSource(); source.buffer = this.noiseBuffer(duration);
    const filter = c.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = frequency;
    const gain = c.createGain(); gain.gain.setValueAtTime(volume, at); gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.master); source.start(at); source.stop(at + duration);
    this.active.add(source); source.onended = () => { this.active.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
  move() { this.tone(420, 0.11, 0.14, 'sine', 0, 180); this.noise(0.07, 0.24, 0, 1800); }
  creak(round) {
    this.round = round;
    if (this.windGain) this.windGain.gain.setTargetAtTime(0.19 + round * 0.04, this.context.currentTime, 0.4);
    this.tone(110, 1.15, 0.055, 'sawtooth', 0, 67);
    this.tone(320, 0.65, 0.038, 'triangle', 0.15, 180);
    for (let i = 0; i < round + 1; i++) this.noise(0.13, 0.8 + round * 0.15, 0.22 + i * 0.22, 550);
  }
  reveal(result) { this.tone(result === '-' ? 370 : 245, 0.8, 0.12, 'sine', 0, result === '-' ? 370 : 180); }
  break() { this.noise(0.7, 1.5, 0, 250); this.noise(0.2, 1.0, 0.19, 1200); this.tone(85, 0.8, 0.3, 'triangle', 0, 32); }
  finish(won) { (won ? [330, 440, 554, 660] : [180, 151, 120]).forEach((f, i) => this.tone(f, 0.75, 0.13, 'sine', i * 0.16)); }
  reset() {
    for (const source of this.active) { try { source.stop(); } catch {} }
    this.active.clear(); this.round = 0;
    if (this.windGain) this.windGain.gain.setTargetAtTime(0.19, this.context.currentTime, 0.1);
  }
  visibility() {
    if (!this.context) return;
    if (document.hidden) this.context.suspend().catch(() => {});
    else if (this.enabled) this.context.resume().catch(() => {});
  }
}
