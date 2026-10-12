import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

let importNumber = 0;
async function moduleUnderTest(name) {
  const source = await readFile(
    new URL(`../js/${name}.js`, import.meta.url),
    "utf8",
  );
  return import(
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${++importNumber}`
  );
}

function detailEvent(type, detail) {
  const event = new Event(type);
  Object.assign(event, detail);
  return event;
}

class FakeAudio extends EventTarget {
  constructor() {
    super();
    Object.assign(this, {
      src: "",
      currentSrc: "",
      currentTime: 0,
      duration: NaN,
      paused: true,
      readyState: 0,
      playbackRate: 1,
      volume: 1,
      preservesPitch: false,
      playCount: 0,
    });
  }
  load() {
    this.readyState = 0;
  }
  metadata(duration) {
    this.duration = duration;
    this.currentSrc = this.src;
    this.readyState = 1;
    this.dispatchEvent(new Event("loadedmetadata"));
  }
  async play() {
    this.paused = false;
    this.playCount++;
    this.dispatchEvent(new Event("play"));
  }
  pause() {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }
  removeAttribute(name) {
    if (name === "src") this.src = "";
  }
}

test("rapid local-file replacement rejects the old load and revokes each owned URL", async () => {
  const { AudioPlayer } = await moduleUnderTest("audio-player");
  const audio = new FakeAudio();
  const player = new AudioPlayer(audio);
  const revoked = [];
  const nativeCreate = URL.createObjectURL;
  const nativeRevoke = URL.revokeObjectURL;
  let urlCount = 0;
  URL.createObjectURL = () => `blob:local-${++urlCount}`;
  URL.revokeObjectURL = (url) => revoked.push(url);
  try {
    const oldLoad = player.loadFile(new Blob(["one"], { type: "audio/wav" }));
    const oldResult = oldLoad.catch((error) => error);
    const latestLoad = player.loadFile(
      new Blob(["two"], { type: "audio/wav" }),
    );
    audio.currentSrc = "blob:local-1";
    audio.duration = 3;
    audio.dispatchEvent(new Event("loadedmetadata"));
    assert.equal(
      player.ready,
      false,
      "a stale metadata event cannot complete the new load",
    );
    audio.metadata(8);
    assert.equal((await oldResult).name, "AbortError");
    assert.equal((await latestLoad).duration, 8);
    assert.equal(player.ready, true);
    assert.deepEqual(revoked, ["blob:local-1"]);
    player.destroy();
    assert.deepEqual(revoked, ["blob:local-1", "blob:local-2"]);
  } finally {
    URL.createObjectURL = nativeCreate;
    URL.revokeObjectURL = nativeRevoke;
  }
});

test("seeking clamps, pitch is preserved, and loops recover at the media endpoint", async () => {
  const { AudioPlayer } = await moduleUnderTest("audio-player");
  const audio = new FakeAudio();
  const player = new AudioPlayer(audio);
  const loaded = player.loadSource("./exercise.wav");
  audio.metadata(12);
  await loaded;
  assert.equal(audio.preservesPitch, true);
  assert.equal(player.seek(999), 12);
  assert.equal(player.skip(-999), 0);
  player.setSpeed(0.5);
  player.setVolume(2);
  assert.equal(audio.playbackRate, 0.5);
  assert.equal(audio.volume, 1);
  const wraps = [];
  const seeks = [];
  player.addEventListener("loop", (event) => wraps.push(event.detail));
  player.addEventListener("seek", (event) => seeks.push(event.detail));
  player.setLoop(4, 12, true);
  await player.play();
  audio.currentTime = 12;
  audio.dispatchEvent(new Event("timeupdate"));
  assert.equal(audio.currentTime, 4);
  assert.equal(wraps.length, 1);
  assert.equal(seeks.at(-1).reason, "loop");
  audio.currentTime = 12;
  audio.paused = true;
  audio.dispatchEvent(new Event("ended"));
  assert.equal(audio.currentTime, 4);
  assert.equal(audio.playCount, 2);
  player.clearLoop();
  assert.equal(player.loop.enabled, false);
  assert.throws(() => player.setLoop(11.99, 12), RangeError);
  player.destroy();
});

test("failed decode rejects the load and leaves playback unavailable", async () => {
  const { AudioPlayer } = await moduleUnderTest("audio-player");
  const audio = new FakeAudio();
  const player = new AudioPlayer(audio);
  const result = player.loadSource("./bad.wav");
  audio.error = { code: 3 };
  audio.dispatchEvent(new Event("error"));
  await assert.rejects(result, /decoded/);
  assert.equal(player.ready, false);
  await assert.rejects(player.play(), /Choose your audio/);
  player.destroy();
});

class FakeTrack extends EventTarget {
  constructor() {
    super();
    this.readyState = "live";
  }
  end() {
    this.readyState = "ended";
    this.dispatchEvent(new Event("ended"));
  }
}

class FakeMediaRecorder extends EventTarget {
  static instances = [];
  static isTypeSupported(type) {
    return type === "audio/mp4";
  }
  constructor(stream, options = {}) {
    super();
    this.stream = stream;
    this.mimeType = options.mimeType || "audio/webm";
    this.state = "inactive";
    FakeMediaRecorder.instances.push(this);
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    queueMicrotask(() => this.finish());
  }
  finish() {
    this.dispatchEvent(
      detailEvent("dataavailable", {
        data: new Blob(["last chunk"], { type: this.mimeType }),
      }),
    );
    this.dispatchEvent(new Event("stop"));
  }
}

test("recording detects Safari-compatible MIME and retains the final stop chunk", async () => {
  const original = globalThis.MediaRecorder;
  globalThis.MediaRecorder = FakeMediaRecorder;
  try {
    const { Recorder } = await moduleUnderTest("recorder");
    const recorder = new Recorder();
    const track = new FakeTrack();
    recorder.start({ getAudioTracks: () => [track] });
    assert.equal(recorder.recording, true);
    assert.equal(FakeMediaRecorder.instances.at(-1).mimeType, "audio/mp4");
    const blob = await recorder.stop();
    assert.equal(blob.type, "audio/mp4");
    assert.equal(await blob.text(), "last chunk");
    assert.equal(recorder.recording, false);
    assert.equal(
      track.readyState,
      "live",
      "the trainer owns microphone cleanup",
    );
    assert.equal(await recorder.stop(), null);
  } finally {
    globalThis.MediaRecorder = original;
  }
});

test("microphone interruption finalizes a take and cancellation discards it", async () => {
  const original = globalThis.MediaRecorder;
  globalThis.MediaRecorder = FakeMediaRecorder;
  try {
    const { Recorder } = await moduleUnderTest("recorder");
    const recorder = new Recorder();
    const track = new FakeTrack();
    let stopped;
    recorder.addEventListener("stopped", (event) => {
      stopped = event.detail;
    });
    recorder.start({ getAudioTracks: () => [track] });
    track.end();
    const interrupted = await recorder.stop();
    assert.equal(await interrupted.text(), "last chunk");
    assert.equal(stopped.interrupted, true);
    recorder.start({ getAudioTracks: () => [new FakeTrack()] });
    const pending = recorder.stop();
    recorder.cancel();
    assert.equal(await pending, null);
    assert.equal(recorder.recording, false);
  } finally {
    globalThis.MediaRecorder = original;
  }
});

test("an inactive recorder error waits for queued audio rather than losing its final chunk", async () => {
  const original = globalThis.MediaRecorder;
  globalThis.MediaRecorder = FakeMediaRecorder;
  try {
    const { Recorder } = await moduleUnderTest("recorder");
    const recorder = new Recorder();
    recorder.start({ getAudioTracks: () => [new FakeTrack()] });
    const nativeRecorder = FakeMediaRecorder.instances.at(-1);
    nativeRecorder.state = "inactive";
    nativeRecorder.dispatchEvent(
      detailEvent("error", { error: new Error("device disconnected") }),
    );
    queueMicrotask(() => nativeRecorder.finish());
    const blob = await recorder.stop();
    assert.equal(await blob.text(), "last chunk");
    assert.match(recorder.lastError.message, /device disconnected/);
  } finally {
    globalThis.MediaRecorder = original;
  }
});

test("unsupported MediaRecorder reports a useful fallback without preventing pitch practice", async () => {
  const original = globalThis.MediaRecorder;
  globalThis.MediaRecorder = undefined;
  try {
    const { Recorder } = await moduleUnderTest("recorder");
    const recorder = new Recorder();
    assert.equal(recorder.supported, false);
    assert.throws(() => recorder.start({}), /Live pitch practice still works/);
    assert.equal(await recorder.stop(), null);
  } finally {
    globalThis.MediaRecorder = original;
  }
});

function fakeIndexedDB(initialEntries = []) {
  const entries = new Map(initialEntries.map((take) => [take.id, take]));
  const control = {
    autoComplete: true,
    quota: false,
    completions: [],
    success: null,
  };
  const db = {
    close() {},
    transaction(storeName, mode) {
      const tx = { error: null };
      const operation = (kind, value) => {
        const request = { result: undefined, error: null };
        queueMicrotask(() => {
          if (kind === "getAll") request.result = [...entries.values()];
          if (kind === "get") request.result = entries.get(value);
          if (kind === "put") request.result = value.id;
          request.onsuccess?.();
          const complete = () => {
            if (mode === "readwrite" && control.quota) {
              tx.error = new DOMException(
                "Quota exceeded",
                "QuotaExceededError",
              );
              tx.onabort?.();
              return;
            }
            if (kind === "put") entries.set(value.id, value);
            if (kind === "delete") entries.delete(value);
            tx.oncomplete?.();
          };
          if (control.autoComplete) queueMicrotask(complete);
          else control.completions.push(complete);
          control.success?.();
        });
        return request;
      };
      tx.objectStore = () => ({
        getAll: () => operation("getAll"),
        get: (id) => operation("get", id),
        put: (entry) => operation("put", entry),
        delete: (id) => operation("delete", id),
      });
      return tx;
    },
  };
  return {
    entries,
    control,
    api: {
      open() {
        const request = {};
        queueMicrotask(() => {
          request.result = db;
          request.onsuccess?.();
        });
        return request;
      },
    },
  };
}

test("persistent save waits for transaction commit and stores recording blobs", async () => {
  const original = globalThis.indexedDB;
  const fake = fakeIndexedDB();
  fake.control.autoComplete = false;
  globalThis.indexedDB = fake.api;
  try {
    const storage = await moduleUnderTest("storage");
    let didResolve = false;
    const successSeen = new Promise((resolve) => {
      fake.control.success = resolve;
    });
    const recording = new Blob(["voice"], { type: "audio/webm" });
    const save = storage.saveTake({
      id: "committed",
      songId: "perfect",
      date: "2026-10-13",
      duration: 2,
      recording,
    });
    save.then(() => {
      didResolve = true;
    });
    await successSeen;
    assert.equal(didResolve, false, "request success is not commit success");
    assert.equal(fake.entries.has("committed"), false);
    fake.control.completions.shift()();
    assert.equal(await save, "committed");
    assert.equal(storage.getStorageStatus(), "persistent");
    fake.control.autoComplete = true;
    assert.equal(
      await (await storage.getTake("committed")).recording.text(),
      "voice",
    );
    assert.equal((await storage.listTakes("perfect")).length, 1);
    await storage.deleteTake("committed");
    assert.equal(await storage.getTake("committed"), null);
  } finally {
    globalThis.indexedDB = original;
  }
});

test("quota abort falls back to honest session-only storage while preserving prior history", async () => {
  const original = globalThis.indexedDB;
  const fake = fakeIndexedDB([
    { id: "old", songId: "perfect", date: "2026-10-12" },
  ]);
  globalThis.indexedDB = fake.api;
  try {
    const storage = await moduleUnderTest("storage");
    fake.control.quota = true;
    await storage.saveTake({
      id: "new",
      songId: "perfect",
      date: "2026-10-13",
      recording: new Blob(["new voice"]),
    });
    assert.equal(fake.entries.has("new"), false);
    assert.equal(storage.getStorageStatus(), "session-only");
    assert.deepEqual(
      (await storage.listTakes("perfect")).map((take) => take.id),
      ["new", "old"],
    );
    assert.equal(
      await (await storage.getTake("new")).recording.text(),
      "new voice",
    );
    await assert.rejects(
      storage.deleteTake("old"),
      /could not be deleted.*kept/,
    );
    assert.equal(
      fake.entries.has("old"),
      true,
      "failed durable deletion preserves the recording",
    );
    assert.deepEqual(
      (await storage.listTakes("perfect")).map((take) => take.id),
      ["new", "old"],
    );
    await storage.deleteTake("new");
    assert.deepEqual(
      (await storage.listTakes("perfect")).map((take) => take.id),
      ["old"],
      "a memory-only take can still be deleted despite quota failure",
    );
  } finally {
    globalThis.indexedDB = original;
  }
});

test("unavailable IndexedDB still supports take history within this session", async () => {
  const original = globalThis.indexedDB;
  globalThis.indexedDB = undefined;
  try {
    const storage = await moduleUnderTest("storage");
    const id = await storage.saveTake({
      songId: "generic",
      duration: 1,
      recording: null,
    });
    assert.equal(storage.getStorageStatus(), "session-only");
    assert.equal((await storage.listTakes("generic")).length, 1);
    assert.equal((await storage.getTake(id)).songId, "generic");
    await storage.deleteTake(id);
    assert.equal((await storage.listTakes()).length, 0);
  } finally {
    globalThis.indexedDB = original;
  }
});
