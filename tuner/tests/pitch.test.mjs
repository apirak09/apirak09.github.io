import test from "node:test";
import assert from "node:assert/strict";
import { detectPitch, PitchDetector } from "../js/pitch-detector.js";
import {
  frequencyToMidi,
  midiToFrequency,
  midiToNote,
  centsBetween,
  formatTime,
} from "../js/pitch-utils.js";
import { scoreTake } from "../js/scorer.js";
import { Karaoke } from "../js/karaoke.js";
import { Timeline } from "../js/pitch-visualizer.js";

const tone = (
  frequency,
  sampleRate = 48000,
  amplitude = 0.25,
  harmonics = false,
) =>
  Float32Array.from({ length: 4096 }, (_, i) => {
    const phase = (2 * Math.PI * frequency * i) / sampleRate;
    return (
      amplitude *
      (Math.sin(phase) +
        (harmonics
          ? 0.65 * Math.sin(phase * 2) + 0.4 * Math.sin(phase * 3)
          : 0))
    );
  });
const samples = (start, end, midi, pass = 0) =>
  Array.from({ length: Math.ceil((end - start) * 20) }, (_, i) => ({
    time: start + i * 0.05,
    midi: typeof midi === "function" ? midi(start + i * 0.05) : midi,
    confidence: midi === null ? 0 : 0.99,
    pass,
  }));
const notes = [
  { start: 0, end: 1, midi: 60 },
  { start: 1, end: 1.5, midi: null, type: "rest" },
  { start: 1.5, end: 3, midi: 64 },
];
const verified = { melodyStatus: "verified" };

test("equal temperament conversions support reference tuning and octave names", () => {
  assert.equal(frequencyToMidi(440), 69);
  assert.equal(midiToFrequency(69, 432), 432);
  assert.equal(midiToNote(60), "C4");
  assert.equal(midiToNote(69.1), "A4");
  assert.equal(midiToNote(null), "—");
  assert.equal(frequencyToMidi(0), null);
  assert.equal(
    centsBetween(440 * 2 ** (30 / 1200), 440).toFixed(6),
    "30.000000",
  );
  assert.equal(formatTime(72.9), "1:12");
  assert.equal(formatTime(Infinity), "0:00");
});

test("YIN resolves bass, middle, and high vocal fundamentals across hardware rates", () => {
  for (const rate of [44100, 48000, 96000]) {
    for (const frequency of [65.41, 110, 220, 440, 783.99, 1046.5]) {
      const pitch = detectPitch(tone(frequency, rate), rate);
      assert.ok(pitch, `${frequency} Hz at ${rate} Hz should be voiced`);
      assert.ok(
        Math.abs(centsBetween(pitch.frequency, frequency)) < 8,
        `${frequency} Hz detected as ${pitch.frequency}`,
      );
      assert.ok(pitch.confidence > 0.95);
    }
  }
});

test("YIN finds a harmonic-rich voice with DC offset and ignores weak, silent, noisy input", () => {
  const harmonic = tone(146.83, 48000, 0.2, true);
  for (let i = 0; i < harmonic.length; i++) harmonic[i] += 0.12;
  const pitch = detectPitch(harmonic, 48000);
  assert.ok(pitch && Math.abs(centsBetween(pitch.frequency, 146.83)) < 8);
  assert.equal(detectPitch(new Float32Array(4096), 48000), null);
  assert.equal(detectPitch(new Float32Array(4096).fill(0.2), 48000), null);
  assert.equal(detectPitch(tone(440, 48000, 0.003), 48000), null);
  let seed = 327;
  const noise = Float32Array.from({ length: 4096 }, () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return (seed / 2 ** 32 - 0.5) * 0.8;
  });
  assert.equal(detectPitch(noise, 48000), null);
  assert.equal(detectPitch(new Float32Array(200), 48000), null);
});

test("unverified data never produces a numerical score", () => {
  const result = scoreTake(samples(0, 3, 60), notes, {
    melodyStatus: "pending-transcription",
  });
  assert.equal(result.pitchAccuracy, null);
  assert.equal(result.overall, null);
  assert.match(result.reason, /verified/);
});

test("verified note changes score accurately, with rests excluded", () => {
  const take = samples(0, 3, (time) => (time < 1 ? 60 : time < 1.5 ? 90 : 64));
  const result = scoreTake(take, notes, verified);
  assert.ok(result.pitchAccuracy >= 99);
  assert.ok(result.timingAccuracy >= 99);
  assert.ok(result.stability >= 99);
  assert.ok(result.overall >= 99);
  assert.equal(result.coverage, 100);
  assert.ok(result.hotspots.some((spot) => spot.type === "good"));
});

test("missing singing lowers accuracy and coverage; complete silence remains unscored", () => {
  const targets = [{ start: 0, end: 2, midi: 60 }];
  const result = scoreTake(
    samples(0, 2, (time) => (time < 1 ? null : 60)),
    targets,
    verified,
  );
  assert.ok(result.pitchAccuracy >= 45 && result.pitchAccuracy <= 55);
  assert.ok(result.coverage >= 45 && result.coverage <= 55);
  assert.equal(result.timingAccuracy, 0);
  const silent = scoreTake(samples(0, 2, null), targets, verified);
  assert.equal(silent.overall, null);
  assert.equal(silent.coverage, 0);
  assert.match(silent.reason, /reliable singing/);
});

test("confidence rejection prevents noisy readings from inflating a score", () => {
  const take = samples(0, 2, 60).map((sample, i) => ({
    ...sample,
    confidence: i < 20 ? 0.4 : 0.99,
  }));
  const result = scoreTake(take, [{ start: 0, end: 2, midi: 60 }], verified);
  assert.ok(result.pitchAccuracy <= 55);
  assert.ok(result.coverage <= 55);
});

test("late entrances and sustained wrong pitches produce evidence-based hotspots", () => {
  const targets = [
    { start: 0, end: 1, midi: 60 },
    { start: 1, end: 2, midi: 64 },
  ];
  const result = scoreTake(
    samples(0, 2, (time) => (time < 0.3 ? null : time < 1 ? 60 : 63)),
    targets,
    verified,
  );
  assert.ok(result.timingAccuracy < 50);
  assert.ok(result.pitchAccuracy < 70);
  assert.ok(result.hotspots.some((spot) => spot.type === "late"));
  assert.ok(result.hotspots.some((spot) => spot.type === "flat"));
});

test("separate loop passes each contribute without joining backwards timestamps", () => {
  const targets = [{ start: 0, end: 1, midi: 60 }];
  const take = [...samples(0, 1, 60, 0), ...samples(0, 1, 61, 1)];
  const result = scoreTake(take, targets, verified);
  assert.ok(result.pitchAccuracy > 60 && result.pitchAccuracy < 70);
  const unmarked = scoreTake(
    take.map((sample) => ({ ...sample, pass: 0 })),
    targets,
    verified,
  );
  assert.equal(unmarked.pitchAccuracy, result.pitchAccuracy);
});

test("sample gaps count as missing pitch rather than interpolating a held note", () => {
  const take = [...samples(0, 0.5, 60), ...samples(1.5, 2, 60)];
  const result = scoreTake(take, [{ start: 0, end: 2, midi: 60 }], verified);
  assert.ok(result.coverage < 65);
  assert.ok(result.pitchAccuracy < 65);
});

test("variable pitch reduces stability independently of static tuning offset", () => {
  const targets = [{ start: 0, end: 2, midi: 60 }];
  const steady = scoreTake(samples(0, 2, 60.2), targets, verified);
  const unstable = scoreTake(
    samples(0, 2, (time) => 60 + 0.7 * Math.sin(time * 15)),
    targets,
    verified,
  );
  assert.ok(steady.stability > 95);
  assert.ok(unstable.stability < 60);
});

test("microphone unsupported and denied errors are actionable, and tracks stop on cleanup", async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator",
  );
  const originalContext = globalThis.AudioContext;
  let stopped = 0,
    closed = 0;
  const statuses = [];
  const track = {
    stop() {
      stopped++;
    },
    addEventListener() {},
  };
  class Context {
    state = "running";
    sampleRate = 48000;
    async resume() {}
    async close() {
      closed++;
      this.state = "closed";
    }
    addEventListener() {}
    createMediaStreamSource() {
      return { connect() {}, disconnect() {} };
    }
    createAnalyser() {
      return {
        disconnect() {},
        getFloatTimeDomainData(array) {
          array.fill(0);
        },
      };
    }
  }
  try {
    Object.defineProperty(globalThis, "navigator", {
      value: { mediaDevices: {} },
      configurable: true,
    });
    globalThis.AudioContext = Context;
    await assert.rejects(
      new PitchDetector({
        onStatus: (message) => statuses.push(message),
      }).start(),
      /unavailable/,
    );
    navigator.mediaDevices.getUserMedia = async () => {
      const error = new Error();
      error.name = "NotAllowedError";
      throw error;
    };
    await assert.rejects(
      new PitchDetector({
        onStatus: (message) => statuses.push(message),
      }).start(),
      /declined/,
    );
    navigator.mediaDevices.getUserMedia = async () => ({
      getTracks: () => [track],
      getAudioTracks: () => [track],
    });
    const detector = new PitchDetector();
    await detector.start();
    assert.ok(detector.stream);
    detector.stop();
    assert.equal(detector.stream, null);
    assert.equal(stopped, 1);
    assert.ok(closed >= 2);
    assert.ok(statuses.some((status) => /declined/.test(status)));
  } finally {
    if (originalNavigator)
      Object.defineProperty(globalThis, "navigator", originalNavigator);
    else delete globalThis.navigator;
    if (originalContext) globalThis.AudioContext = originalContext;
    else delete globalThis.AudioContext;
  }
});

test("stopping a pending permission request releases the late stream without cancelling a newer start", async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator",
  );
  const originalContext = globalThis.AudioContext;
  let resolveOld,
    calls = 0,
    oldStopped = 0,
    newStopped = 0;
  const oldTrack = {
    stop() {
      oldStopped++;
    },
    addEventListener() {},
  };
  const newTrack = {
    stop() {
      newStopped++;
    },
    addEventListener() {},
  };
  const oldStream = {
    getTracks: () => [oldTrack],
    getAudioTracks: () => [oldTrack],
  };
  const newStream = {
    getTracks: () => [newTrack],
    getAudioTracks: () => [newTrack],
  };
  class Context {
    state = "running";
    sampleRate = 48000;
    async resume() {}
    async close() {
      this.state = "closed";
    }
    addEventListener() {}
    createMediaStreamSource() {
      return { connect() {}, disconnect() {} };
    }
    createAnalyser() {
      return {
        disconnect() {},
        getFloatTimeDomainData(array) {
          array.fill(0);
        },
      };
    }
  }
  const detector = new PitchDetector();
  try {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        mediaDevices: {
          getUserMedia: () =>
            ++calls === 1
              ? new Promise((resolve) => {
                  resolveOld = resolve;
                })
              : Promise.resolve(newStream),
        },
      },
      configurable: true,
    });
    globalThis.AudioContext = Context;
    const pending = detector.start();
    await Promise.resolve();
    detector.stop();
    await detector.start();
    resolveOld(oldStream);
    assert.equal(await pending, null);
    assert.equal(detector.stream, newStream);
    assert.equal(detector.running, true);
    assert.equal(oldStopped, 1);
    assert.equal(newStopped, 0);
  } finally {
    detector.stop();
    if (originalNavigator)
      Object.defineProperty(globalThis, "navigator", originalNavigator);
    else delete globalThis.navigator;
    if (originalContext) globalThis.AudioContext = originalContext;
    else delete globalThis.AudioContext;
  }
});

class Element {
  children = [];
  textContent = "";
  attributes = {};
  classList = { add() {}, remove() {}, toggle() {} };
  setAttribute(name, value) {
    this.attributes[name] = value;
  }
  replaceChildren(...children) {
    this.children = children;
    this.textContent = "";
  }
  append(child) {
    this.children.push(child);
  }
}

test("karaoke follows line timing, displays gaps, and preserves imported text safely", () => {
  const originalDocument = globalThis.document;
  globalThis.document = { createElement: () => new Element() };
  try {
    const karaoke = new Karaoke(new Element());
    assert.match(karaoke.next.textContent, /not included/);
    karaoke.setLyrics([
      { start: 1, end: 2, text: "<script>literal text</script>" },
      { start: 3, end: 4, text: "Second line" },
    ]);
    karaoke.update(1.5);
    assert.equal(karaoke.active.textContent, "<script>literal text</script>");
    karaoke.update(2.5);
    assert.match(karaoke.active.textContent, /Instrumental/);
    assert.equal(karaoke.next.textContent, "Second line");
    karaoke.update(3.1);
    assert.equal(karaoke.active.textContent, "Second line");
    karaoke.update(5);
    assert.equal(karaoke.active.textContent, "Practice complete");
  } finally {
    globalThis.document = originalDocument;
  }
});

test("timeline breaks voice paths on silence and loop pass changes", () => {
  const commands = [];
  const ctx = new Proxy(
    {},
    {
      get: (target, key) =>
        target[key] || ((...args) => commands.push([key, ...args])),
      set: (target, key, value) => {
        target[key] = value;
        return true;
      },
    },
  );
  const canvas = {
    isConnected: true,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ width: 720, height: 280 }),
    setAttribute() {},
  };
  const timeline = new Timeline(canvas);
  timeline.setSamples([
    { time: 0, midi: 60, pass: 0 },
    { time: 0.05, midi: 60, pass: 0 },
    { time: 0.1, midi: null, pass: 0 },
    { time: 0.15, midi: 60, pass: 0 },
    { time: 0.2, midi: 60, pass: 1 },
    { time: 0.25, midi: 60, pass: 1 },
  ]);
  commands.length = 0;
  timeline.draw(0.25);
  const blueStart = commands.findIndex((command) => command[0] === "rect");
  const trace = commands
    .slice(blueStart)
    .filter((command) => ["moveTo", "lineTo"].includes(command[0]));
  // 3 separate voice subpaths, followed by the current-time marker.
  assert.equal(trace.filter((command) => command[0] === "moveTo").length, 4);
  assert.equal(trace.filter((command) => command[0] === "lineTo").length, 3);
  timeline.destroy();
});
