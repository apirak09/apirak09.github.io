import { midiToNote, formatTime } from "./pitch-utils.js";

const isNote = (note) =>
  Number.isFinite(note.midi) &&
  note.type !== "rest" &&
  note.type !== "unvoiced";

export class Timeline {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.notes = [];
    this.samples = [];
    this.time = 0;
    this.cssWidth = 0;
    this.cssHeight = 0;
    this.dpr = 0;
    this.canvas.setAttribute("role", "img");
    this.canvas.setAttribute(
      "aria-label",
      "Pitch timeline. Target notes are mint bars. Your detected voice is a pink line.",
    );
    this.resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => this.draw(this.time))
        : null;
    this.resizeObserver?.observe(canvas);
    this.draw(0);
  }

  setNotes(notes) {
    this.notes = (Array.isArray(notes) ? notes : [])
      .filter(
        (note) =>
          Number.isFinite(note.start) &&
          Number.isFinite(note.end) &&
          note.end > note.start,
      )
      .sort((a, b) => a.start - b.start);
    this.draw(this.time);
  }

  setSamples(samples) {
    this.samples = (Array.isArray(samples) ? samples : [])
      .filter((sample) => Number.isFinite(sample?.time))
      .slice(-6000);
    this.draw(this.time);
  }

  push(sample) {
    if (!Number.isFinite(sample?.time)) return;
    this.samples.push(sample);
    if (this.samples.length > 6000)
      this.samples.splice(0, this.samples.length - 6000);
  }

  draw(time = 0) {
    if (!this.context || !this.canvas.isConnected) return;
    this.time = Math.max(0, Number.isFinite(time) ? time : 0);
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(
      240,
      Math.round(rect.width || this.canvas.parentElement?.clientWidth || 720),
    );
    // CSS owns layout; bitmap dimensions only affect rendering resolution.
    const height = Math.max(160, Math.min(600, Math.round(rect.height || 280)));
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 3);
    if (
      width !== this.cssWidth ||
      height !== this.cssHeight ||
      dpr !== this.dpr
    ) {
      this.cssWidth = width;
      this.cssHeight = height;
      this.dpr = dpr;
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
    }
    const ctx = this.context;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const left = 43,
      right = 16,
      top = 21,
      bottom = 30;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const span = width < 480 ? 8 : 12;
    const start = Math.max(0, this.time - span * 0.6);
    const end = start + span;
    const visibleNotes = this.notes.filter(
      (note) => note.end >= start && note.start <= end && isNote(note),
    );
    const visibleSamples = this.samples.filter(
      (sample) => sample.time >= start && sample.time <= end,
    );
    const pitches = [
      ...visibleNotes.map((note) => note.midi),
      ...visibleSamples
        .filter(
          (sample) =>
            Number.isFinite(sample.midi) &&
            sample.midi >= 24 &&
            sample.midi <= 100,
        )
        .map((sample) => sample.midi),
    ];
    const center = pitches.length
      ? (Math.min(...pitches) + Math.max(...pitches)) / 2
      : 66;
    const low = Math.floor(
      Math.min(center - 7, pitches.length ? Math.min(...pitches) - 2 : 59),
    );
    const high = Math.ceil(
      Math.max(center + 7, pitches.length ? Math.max(...pitches) + 2 : 73),
    );
    const x = (value) => left + ((value - start) / span) * plotWidth;
    const y = (value) => top + ((high - value) / (high - low)) * plotHeight;

    ctx.font = "11px ui-monospace, SFMono-Regular, Consolas, monospace";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 1;
    for (let midi = low; midi <= high; midi++) {
      const isC = midi % 12 === 0;
      ctx.strokeStyle = isC ? "oklch(.36 .008 340)" : "oklch(.28 .006 340)";
      ctx.beginPath();
      ctx.moveTo(left, y(midi));
      ctx.lineTo(width - right, y(midi));
      ctx.stroke();
      if (isC || (midi % 2 === 0 && high - low <= 19)) {
        ctx.fillStyle = "oklch(.76 .01 340)";
        ctx.textAlign = "right";
        ctx.fillText(midiToNote(midi), left - 9, y(midi));
      }
    }
    const timeStep = 2;
    for (
      let second = Math.ceil(start / timeStep) * timeStep;
      second <= end;
      second += timeStep
    ) {
      ctx.strokeStyle = "oklch(.28 .006 340)";
      ctx.beginPath();
      ctx.moveTo(x(second), top);
      ctx.lineTo(x(second), height - bottom);
      ctx.stroke();
      ctx.fillStyle = "oklch(.76 .01 340)";
      ctx.textAlign = "center";
      ctx.fillText(formatTime(second), x(second), height - 12);
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top - 6, plotWidth, plotHeight + 12);
    ctx.clip();
    const barHeight = Math.max(
      5,
      Math.min(11, (plotHeight / (high - low)) * 0.7),
    );
    for (const note of visibleNotes) {
      const noteX = x(note.start);
      const noteWidth = Math.max(2, x(note.end) - noteX - 1);
      ctx.fillStyle =
        this.time >= note.start && this.time < note.end
          ? "oklch(.85 .10 175)"
          : "oklch(.49 .055 175)";
      ctx.fillRect(noteX, y(note.midi) - barHeight / 2, noteWidth, barHeight);
    }

    ctx.strokeStyle = "oklch(.87 .065 340)";
    ctx.lineWidth = 2.2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    let previous = null;
    ctx.beginPath();
    for (const sample of visibleSamples) {
      if (
        !Number.isFinite(sample.midi) ||
        (sample.confidence !== undefined && sample.confidence < 0.8)
      ) {
        previous = null;
        continue;
      }
      const connected =
        previous &&
        previous.pass === sample.pass &&
        sample.time > previous.time &&
        sample.time - previous.time < 0.2;
      if (connected) ctx.lineTo(x(sample.time), y(sample.midi));
      else ctx.moveTo(x(sample.time), y(sample.midi));
      previous = sample;
    }
    ctx.stroke();
    if (previous && Math.abs(previous.time - this.time) < 0.25) {
      ctx.fillStyle = "oklch(.93 .04 340)";
      ctx.beginPath();
      ctx.arc(x(previous.time), y(previous.midi), 3.3, 0, Math.PI * 2);
      ctx.fill();
    }
    const position = x(this.time);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "oklch(.96 0 0)";
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(position, top);
    ctx.lineTo(position, height - bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    ctx.textAlign = "center";
    ctx.fillStyle = "oklch(.96 0 0)";
    ctx.fillText("NOW", position, 9);
    if (
      !visibleNotes.length &&
      !visibleSamples.some((sample) => Number.isFinite(sample.midi))
    ) {
      ctx.fillStyle = "oklch(.76 .01 340)";
      ctx.font = "13px system-ui, sans-serif";
      ctx.fillText(
        "Sing a note to begin your pitch trace",
        left + plotWidth / 2,
        top + plotHeight / 2,
      );
    }
  }

  destroy() {
    this.resizeObserver?.disconnect();
    this.samples = [];
    this.notes = [];
  }
}
