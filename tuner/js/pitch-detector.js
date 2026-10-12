import {
  frequencyToMidi,
  midiToFrequency,
  midiToNote,
  centsBetween,
} from "./pitch-utils.js";

const MIN_FREQUENCY = 55;
const MAX_FREQUENCY = 1400;
const MIN_RMS = 0.008;
const YIN_THRESHOLD = 0.14;

/** YIN cumulative mean normalized difference, with silence and periodicity gates. */
export function detectPitch(input, sampleRate) {
  if (
    !input ||
    input.length < 512 ||
    !Number.isFinite(sampleRate) ||
    sampleRate < 8000
  )
    return null;
  // At common hardware rates, a short averaging filter halves the work while
  // retaining the full vocal band. No mic samples ever leave the browser.
  const step = Math.max(1, Math.floor(sampleRate / 22050));
  const length = Math.floor(input.length / step);
  const signal = new Float32Array(length);
  let mean = 0;
  for (let i = 0; i < length; i++) {
    let value = 0;
    for (let j = 0; j < step; j++) value += input[i * step + j];
    signal[i] = value / step;
    mean += signal[i];
  }
  mean /= length;
  let energy = 0;
  for (let i = 0; i < length; i++) {
    signal[i] -= mean;
    energy += signal[i] * signal[i];
  }
  const rms = Math.sqrt(energy / length);
  if (!Number.isFinite(rms) || rms < MIN_RMS) return null;
  const rate = sampleRate / step;
  const minLag = Math.max(2, Math.floor(rate / MAX_FREQUENCY));
  const maxLag = Math.min(
    Math.floor(rate / MIN_FREQUENCY),
    Math.floor(length / 2) - 1,
  );
  if (maxLag <= minLag) return null;
  const windowSize = Math.floor(length / 2);
  const difference = new Float32Array(maxLag + 1);
  difference[0] = 1;
  let running = 0;
  let lag = -1;
  for (let tau = 1; tau <= maxLag; tau++) {
    let sum = 0;
    for (let i = 0; i < windowSize; i++) {
      const delta = signal[i] - signal[i + tau];
      sum += delta * delta;
    }
    running += sum;
    difference[tau] = running > 0 ? (sum * tau) / running : 1;
  }
  for (let tau = minLag; tau < maxLag; tau++) {
    if (difference[tau] < YIN_THRESHOLD) {
      while (tau + 1 <= maxLag && difference[tau + 1] < difference[tau]) tau++;
      lag = tau;
      break;
    }
  }
  if (lag < 0) return null;
  const confidence = Math.max(0, Math.min(1, 1 - difference[lag]));
  if (confidence < 0.86) return null;
  let refined = lag;
  if (lag > 1 && lag < maxLag) {
    const a = difference[lag - 1],
      b = difference[lag],
      c = difference[lag + 1];
    const denominator = a - 2 * b + c;
    if (Math.abs(denominator) > 1e-9) refined += (0.5 * (a - c)) / denominator;
  }
  const frequency = rate / refined;
  if (
    !Number.isFinite(frequency) ||
    frequency < MIN_FREQUENCY ||
    frequency > MAX_FREQUENCY
  )
    return null;
  return { frequency, confidence, rms };
}

const MIC_MESSAGES = {
  NotAllowedError:
    "Microphone access was declined. Allow the microphone in your browser settings, then try again.",
  PermissionDeniedError:
    "Microphone access was declined. Allow the microphone in your browser settings, then try again.",
  NotFoundError: "No microphone was found. Connect a microphone and try again.",
  DevicesNotFoundError:
    "No microphone was found. Connect a microphone and try again.",
  NotReadableError:
    "The microphone is busy or unavailable. Close other apps using it, then try again.",
  AbortError: "The microphone could not start. Reconnect it and try again.",
  SecurityError: "Microphone access requires a secure HTTPS page or localhost.",
};

export class PitchDetector {
  constructor({
    onPitch = () => {},
    onStatus = () => {},
    referencePitch = 440,
  } = {}) {
    this.onPitch = onPitch;
    this.onStatus = onStatus;
    this.referencePitch = referencePitch;
    this.stream = null;
    this.context = null;
    this.analyser = null;
    this.source = null;
    this.frame = null;
    this.timer = null;
    this.history = [];
    this.smoothed = null;
    this.running = false;
    this.starting = null;
    this.generation = 0;
    this.status = "";
  }

  report(message) {
    if (this.status === message) return;
    this.status = message;
    this.onStatus(message);
  }

  async start() {
    if (this.running) {
      if (this.context?.state === "suspended") {
        await this.context.resume();
        this.report(
          "Listening — sing a steady note. Headphones help keep the backing track out of the microphone.",
        );
      }
      return this.stream;
    }
    if (this.starting) return this.starting;
    const generation = ++this.generation;
    const pending = this.initialize(generation);
    this.starting = pending;
    try {
      return await pending;
    } finally {
      if (this.starting === pending) this.starting = null;
    }
  }

  async initialize(generation) {
    const AudioContextClass =
      globalThis.AudioContext || globalThis.webkitAudioContext;
    if (
      !globalThis.navigator?.mediaDevices?.getUserMedia ||
      !AudioContextClass
    ) {
      const message =
        "Microphone pitch detection is unavailable. Open this HTTPS page in a current Chrome, Edge, or Safari browser.";
      this.report(message);
      throw new Error(message);
    }
    this.report("Waiting for microphone permission…");
    let stream;
    let context;
    try {
      // Construct/resume inside the initiating user gesture for Safari.
      context = new AudioContextClass();
      this.context = context;
      await context.resume();
      if (generation !== this.generation) {
        if (context.state !== "closed") await context.close().catch(() => {});
        return null;
      }
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
      if (generation !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        if (context.state !== "closed") await context.close().catch(() => {});
        return null;
      }
      this.stream = stream;
      this.source = this.context.createMediaStreamSource(stream);
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 4096;
      this.analyser.smoothingTimeConstant = 0;
      this.source.connect(this.analyser);
      // Deliberately no connection to the speakers: the mic is analysis-only.
      this.frame = new Float32Array(this.analyser.fftSize);
      for (const track of stream.getAudioTracks()) {
        track.addEventListener(
          "ended",
          () => {
            if (this.running && this.stream === stream) {
              this.stop();
              this.report(
                "Microphone disconnected. Reconnect it and enable the microphone again.",
              );
            }
          },
          { once: true },
        );
      }
      context.addEventListener("statechange", () => {
        if (
          this.running &&
          this.context === context &&
          context.state === "suspended"
        )
          this.report(
            "Microphone paused by the browser. Enable it again to resume.",
          );
      });
      this.running = true;
      this.report(
        "Listening — sing a steady note. Headphones help keep the backing track out of the microphone.",
      );
      this.tick();
      return stream;
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      if (generation !== this.generation) {
        if (context?.state !== "closed") await context?.close().catch(() => {});
        return null;
      }
      const message =
        MIC_MESSAGES[error.name] ||
        "Could not start the microphone. Check your device and browser permissions, then try again.";
      this.stop();
      this.report(message);
      throw new Error(message, { cause: error });
    }
  }

  tick() {
    if (!this.running) return;
    if (this.context.state !== "running") {
      this.onPitch(null);
      this.history = [];
      this.smoothed = null;
    } else {
      this.analyser.getFloatTimeDomainData(this.frame);
      const result = detectPitch(this.frame, this.context.sampleRate);
      if (!result) {
        this.history = [];
        this.smoothed = null;
        this.onPitch(null);
      } else {
        const midi = frequencyToMidi(result.frequency, this.referencePitch);
        this.history.push(midi);
        if (this.history.length > 3) this.history.shift();
        const sorted = [...this.history].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        this.smoothed =
          this.smoothed === null || Math.abs(median - this.smoothed) > 0.7
            ? median
            : this.smoothed + (median - this.smoothed) * 0.5;
        const frequency = midiToFrequency(this.smoothed, this.referencePitch);
        this.onPitch({
          ...result,
          frequency,
          midi: this.smoothed,
          note: midiToNote(this.smoothed),
          cents: centsBetween(
            frequency,
            midiToFrequency(Math.round(this.smoothed), this.referencePitch),
          ),
        });
      }
    }
    // A 20 Hz measurement cadence bounds work on mobile hardware.
    this.timer = setTimeout(() => this.tick(), 50);
  }

  stop() {
    this.generation++;
    this.starting = null;
    this.running = false;
    clearTimeout(this.timer);
    this.timer = null;
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.context && this.context.state !== "closed")
      this.context.close().catch(() => {});
    this.stream = null;
    this.context = null;
    this.source = null;
    this.analyser = null;
    this.frame = null;
    this.history = [];
    this.smoothed = null;
    this.onPitch(null);
    this.report("Microphone off.");
  }
}
