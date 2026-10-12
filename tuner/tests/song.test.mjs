import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  BASE_URL,
  loadCatalog,
  loadSong,
  validateSong,
} from "../js/song-loader.js";

const readPackage = async (id) =>
  JSON.parse(
    await readFile(
      new URL(`../songs/${id}/song.json`, import.meta.url),
      "utf8",
    ),
  );
const base = { id: "my-song", title: "My song", artist: "Me" };

test("explicit rest and unvoiced types never become pitched targets", () => {
  for (const type of ["rest", "unvoiced"]) {
    const song = validateSong({
      ...base,
      notes: [
        { start: 0, end: 1, midi: 69, type },
        { start: 1, end: 2, type },
      ],
    });
    assert.deepEqual(
      song.notes.map((note) => note.midi),
      [null, null],
    );
  }
  assert.throws(
    () =>
      validateSong({
        ...base,
        notes: [{ start: 0, end: 1, midi: 69, type: "unknown" }],
      }),
    /note.type/,
  );
});

test("commercial packages expose truthful empty data and no embedded audio", async () => {
  for (const id of ["let-her-go", "perfect", "love-me-not"]) {
    const song = validateSong(await readPackage(id));
    assert.equal(song.id, id);
    assert.equal(song.melodyStatus, "pending-transcription");
    assert.equal(song.lyricsStatus, "not-included-copyright");
    assert.equal(song.audioMode, "local-file");
    assert.equal(song.difficulty, null);
    assert.equal(song.range, null);
    assert.deepEqual(song.notes, []);
    assert.deepEqual(song.lyrics, []);
    assert.deepEqual(song.sections, []);
    assert.equal(song.audioSrc, undefined);
  }
});

test("demo package has real original intervals and the WAV matches its duration", async () => {
  const song = validateSong(await readPackage("demo-vocal-exercise"));
  assert.equal(song.melodyStatus, "original");
  assert.equal(song.lyricsStatus, "original");
  assert.equal(song.audioMode, "repository");
  assert.equal(song.notes.filter((note) => note.midi !== null).length, 8);
  assert.ok(song.notes.some((note) => note.midi === null));
  assert.ok(song.notes.some((note) => note.end - note.start >= 2));
  const wave = await readFile(new URL(song.audioSrc, BASE_URL));
  assert.equal(wave.toString("ascii", 0, 4), "RIFF");
  assert.equal(wave.toString("ascii", 8, 12), "WAVE");
  const sampleRate = wave.readUInt32LE(24);
  const bytesPerSample = wave.readUInt16LE(34) / 8;
  const duration = wave.readUInt32LE(40) / sampleRate / bytesPerSample;
  assert.equal(duration, 14);
  assert.ok(Math.max(...song.notes.map((note) => note.end)) <= duration);
});

test("normalizes optional metadata, accepts rests and future word timings", () => {
  const song = validateSong({
    ...base,
    notes: [
      { start: 0, end: 1, midi: null },
      { start: 1, end: 2, midi: 69 },
    ],
    lyrics: [
      {
        start: 0,
        end: 2,
        text: "<b>safe literal text</b>",
        words: [{ start: 0, end: 1, text: "safe" }],
      },
    ],
    sections: [{ title: "Phrase", start: 0, end: 2 }],
    unrelatedProperty: "discard",
  });
  assert.equal(song.schemaVersion, 1);
  assert.equal(song.referencePitch, 440);
  assert.equal(song.notes[0].midi, null);
  assert.equal(song.sections[0].name, "Phrase");
  assert.equal(song.lyrics[0].text, "<b>safe literal text</b>");
  assert.equal(song.unrelatedProperty, undefined);
});

test("rejects bad schemas and invalid or oversized display fields", () => {
  for (const extra of [
    { schemaVersion: 2 },
    { id: "../escape" },
    { id: "Bad Song" },
    { title: "" },
    { title: "x".repeat(161) },
    { artist: {} },
    { difficulty: [] },
    { melodyStatus: "pretend-ready" },
    { referencePitch: 0 },
    { referencePitch: NaN },
    { range: { low: 70, high: 60 } },
  ]) {
    assert.throws(() => validateSong({ ...base, ...extra }));
  }
  assert.throws(() => validateSong(null));
  assert.throws(() => validateSong([]));
});

test("rejects malformed, overlapping, or unordered monophonic intervals", () => {
  for (const notes of [
    [{ start: -1, end: 1, midi: 60 }],
    [{ start: 0, end: 0, midi: 60 }],
    [{ start: 0, end: Infinity, midi: 60 }],
    [{ start: 0, end: 1, midi: 60.2 }],
    [{ start: 0, end: 1, midi: 128 }],
    [{ start: 0, end: 1 }],
    [
      { start: 0, end: 2, midi: 60 },
      { start: 1, end: 3, midi: 62 },
    ],
    [
      { start: 2, end: 3, midi: 60 },
      { start: 0, end: 1, midi: 62 },
    ],
  ])
    assert.throws(() => validateSong({ ...base, notes }));
  assert.throws(() =>
    validateSong({
      ...base,
      lyrics: [
        {
          start: 1,
          end: 2,
          text: "line",
          words: [{ start: 0, end: 1.5, text: "word" }],
        },
      ],
    }),
  );
  assert.throws(() =>
    validateSong({
      ...base,
      notes: Array(20001).fill({ start: 0, end: 1, midi: 60 }),
    }),
  );
});

test("repository audio stays inside the tuner directory", () => {
  assert.equal(
    validateSong({
      ...base,
      audioMode: "repository",
      audioSrc: "demo/own-track.wav",
    }).audioSrc,
    "demo/own-track.wav",
  );
  for (const audioSrc of [
    "/demo/audio.wav",
    "../audio.wav",
    "demo/../audio.wav",
    "https://example.com/audio.wav",
    "demo\\audio.wav",
    "demo/%2e%2e/audio.wav",
    "demo//audio.wav",
    "",
  ]) {
    assert.throws(() =>
      validateSong({ ...base, audioMode: "repository", audioSrc }),
    );
  }
});

test("route loader resolves configs through BASE_URL and rejects ID mismatches", async () => {
  const previous = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (target) => {
    requested.push(String(target));
    return {
      ok: true,
      text: async () => JSON.stringify(await readPackage("perfect")),
    };
  };
  try {
    assert.equal((await loadSong("perfect")).title, "Perfect");
    assert.equal(
      requested[0],
      new URL("songs/perfect/song.json", BASE_URL).href,
    );
    await assert.rejects(loadSong("let-her-go"), /does not match/);
    await assert.rejects(loadSong("../bad"), /Unknown song route/);
    const generic = await loadSong("generic");
    assert.equal(generic.melodyStatus, "free-pitch");
    assert.deepEqual(generic.notes, []);
    assert.equal(requested.length, 2);
  } finally {
    globalThis.fetch = previous;
  }
});

test("catalog validates IDs and reports bad fetch or JSON responses", async () => {
  const previous = globalThis.fetch;
  try {
    const catalog = JSON.parse(
      await readFile(new URL("../songs/catalog.json", import.meta.url), "utf8"),
    );
    globalThis.fetch = async () => ({
      ok: true,
      text: async () => JSON.stringify(catalog),
    });
    assert.equal((await loadCatalog()).length, 4);
    globalThis.fetch = async () => ({
      ok: true,
      text: async () => JSON.stringify([catalog[0], catalog[0]]),
    });
    await assert.rejects(loadCatalog(), /unique/);
    globalThis.fetch = async () => ({ ok: false, status: 404 });
    await assert.rejects(loadCatalog(), /404/);
    globalThis.fetch = async () => ({
      ok: true,
      text: async () => "{malformed",
    });
    await assert.rejects(loadCatalog(), /not valid JSON/);
  } finally {
    globalThis.fetch = previous;
  }
});
