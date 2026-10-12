import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

let importNumber = 0;
async function moduleUnderTest() {
  const local = await readFile(
    new URL("../js/audio-player.js", import.meta.url),
    "utf8",
  );
  const source = (
    await readFile(new URL("../js/track-player.js", import.meta.url), "utf8")
  ).replace(
    '"./audio-player.js"',
    JSON.stringify(
      `data:text/javascript;base64,${Buffer.from(local).toString("base64")}`,
    ),
  );
  return import(
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${++importNumber}`
  );
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
    });
  }
  load() {
    this.readyState = 0;
    this.duration = NaN;
    this.currentTime = 0;
  }
  metadata(duration) {
    this.duration = duration;
    this.currentSrc = this.src;
    this.readyState = 1;
    this.dispatchEvent(new Event("loadedmetadata"));
  }
  async play() {
    this.paused = false;
    this.dispatchEvent(new Event("play"));
  }
  pause() {
    const changed = !this.paused;
    this.paused = true;
    if (changed) this.dispatchEvent(new Event("pause"));
  }
  removeAttribute(name) {
    if (name === "src") this.src = "";
  }
}

class FakeElement extends EventTarget {
  constructor(tagName) {
    super();
    this.tagName = tagName;
    this.style = {};
    this.attributes = {};
    this.removed = false;
  }
  setAttribute(name, value) {
    this.attributes[name] = value;
  }
  remove() {
    this.removed = true;
  }
}

async function fixture({ apiInitiallyLoaded = true, duration = 120 } = {}) {
  const original = Object.fromEntries(
    ["window", "document", "location"].map((key) => [key, globalThis[key]]),
  );
  const created = [];
  const scripts = [];
  const instances = [];
  const mount = {
    hidden: false,
    children: [],
    replaceChildren(...items) {
      this.children = items;
    },
  };
  class MockPlayer {
    constructor(iframe, options) {
      this.iframe = iframe;
      this.events = options.events;
      this.time = 0;
      this.duration = duration;
      this.rate = 1;
      this.rates = [0.5, 1, 1.5];
      this.volume = 100;
      this.state = -1;
      this.calls = [];
      this.destroyed = false;
      instances.push(this);
    }
    emit(type, data) {
      this.events[type]?.({ target: this, data });
    }
    ready() {
      this.emit("onReady");
    }
    changeState(state) {
      this.state = state;
      this.emit("onStateChange", state);
    }
    getCurrentTime() {
      return this.time;
    }
    getDuration() {
      return this.duration;
    }
    getPlaybackRate() {
      return this.rate;
    }
    getAvailablePlaybackRates() {
      return this.rates;
    }
    getPlayerState() {
      return this.state;
    }
    playVideo() {
      this.calls.push(["play"]);
    }
    pauseVideo() {
      this.calls.push(["pause"]);
      this.changeState(2);
    }
    seekTo(time, allowSeekAhead) {
      this.calls.push(["seek", time, allowSeekAhead]);
    }
    setPlaybackRate(rate) {
      this.calls.push(["rate", rate]);
    }
    setVolume(value) {
      this.volume = value;
    }
    destroy() {
      this.destroyed = true;
      this.iframe.remove();
    }
  }
  const YT = { Player: MockPlayer };
  globalThis.window = apiInitiallyLoaded ? { YT } : {};
  globalThis.location = { origin: "https://apirak09.github.io" };
  globalThis.document = {
    querySelector() {
      return scripts.find((script) => !script.removed) || null;
    },
    createElement(tag) {
      const element = new FakeElement(tag);
      created.push(element);
      return element;
    },
    head: {
      append(element) {
        scripts.push(element);
      },
    },
  };
  const { TrackPlayer } = await moduleUnderTest();
  const nativeAudio = new FakeAudio();
  const player = new TrackPlayer(nativeAudio, mount);
  const settle = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };
  const load = async (id = "dQw4w9WgXcQ") => {
    const result = player.loadYouTube(id);
    await settle();
    instances.at(-1).ready();
    await result;
    return instances.at(-1);
  };
  return {
    player,
    nativeAudio,
    mount,
    created,
    scripts,
    instances,
    YT,
    load,
    settle,
    close() {
      player.destroy();
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete globalThis[key];
        else globalThis[key] = value;
      }
    },
  };
}

test("local sources keep the facade stable and forward media transport events", async () => {
  const f = await fixture();
  try {
    const facade = f.player.audio;
    const seen = [];
    for (const event of [
      "loadedmetadata",
      "durationchange",
      "play",
      "pause",
      "ratechange",
    ])
      facade.addEventListener(event, () => seen.push(event));
    assert.deepEqual(f.player.availableSpeeds, [0.5, 0.75, 1]);
    const result = f.player.loadSource("./demo.wav");
    f.nativeAudio.metadata(12);
    await result;
    assert.equal(f.player.sourceType, "repository");
    assert.equal(f.player.sourceId, "./demo.wav");
    assert.equal(f.player.ready, true);
    assert.equal(f.player.contentStarted, true);
    await f.player.play();
    f.player.pause();
    f.player.setSpeed(0.5);
    f.nativeAudio.dispatchEvent(new Event("ratechange"));
    assert.equal(facade.playbackRate, 0.5);
    assert.equal(facade.duration, 12);
    assert.equal(facade.paused, true);
    assert.equal(f.player.seek(99), 12);
    assert.equal(f.player.skip(-99), 0);
    assert.equal(f.player.audio, facade);
    assert.deepEqual(seen, [
      "pause",
      "loadedmetadata",
      "durationchange",
      "play",
      "pause",
      "ratechange",
    ]);
    assert.equal(
      f.scripts.length,
      0,
      "local playback does not request YouTube",
    );
  } finally {
    f.close();
  }
});

test("the official iframe stays visible with controls, privacy domain and referrer", async () => {
  const f = await fixture();
  try {
    f.player.setVolume(0.7);
    const yt = await f.load();
    const iframe = f.mount.children[0];
    const url = new URL(iframe.src);
    assert.equal(url.hostname, "www.youtube-nocookie.com");
    assert.equal(url.pathname, "/embed/dQw4w9WgXcQ");
    assert.equal(url.searchParams.get("enablejsapi"), "1");
    assert.equal(url.searchParams.get("origin"), "https://apirak09.github.io");
    assert.equal(url.searchParams.get("controls"), "1");
    assert.equal(url.searchParams.get("autoplay"), null);
    assert.equal(
      iframe.attributes.referrerpolicy,
      "strict-origin-when-cross-origin",
    );
    assert.equal(iframe.title, "YouTube song player");
    assert.equal(iframe.style.minWidth, "200px");
    assert.equal(iframe.style.minHeight, "200px");
    assert.equal(f.mount.hidden, false);
    assert.equal(
      yt.calls.some(([action]) => action === "play"),
      false,
    );
    assert.equal(yt.volume, 70);
    assert.equal(f.player.sourceType, "youtube");
    assert.equal(f.player.sourceId, "dQw4w9WgXcQ");
  } finally {
    f.close();
  }
});

test("API loads only on selection and a stale API initialization cannot create an iframe", async () => {
  const f = await fixture({ apiInitiallyLoaded: false });
  try {
    assert.equal(f.scripts.length, 0);
    const first = f.player.loadYouTube("dQw4w9WgXcQ").catch((error) => error);
    assert.equal(f.scripts.length, 1);
    assert.equal(f.scripts[0].src, "https://www.youtube.com/iframe_api");
    const latest = f.player.loadSource("./local.wav");
    f.nativeAudio.metadata(8);
    await latest;
    window.YT = f.YT;
    window.onYouTubeIframeAPIReady();
    await f.settle();
    assert.equal((await first).name, "AbortError");
    assert.equal(f.instances.length, 0);
    assert.equal(f.player.sourceType, "repository");
    assert.equal(f.player.ready, true);
    assert.equal(f.mount.hidden, true);
  } finally {
    f.close();
  }
});

test("pre-roll without duration resolves loading while play waits for actual content", async () => {
  const f = await fixture({ duration: 0 });
  try {
    const yt = await f.load();
    assert.equal(f.player.ready, true);
    assert.equal(f.player.contentStarted, false);
    yt.time = 18;
    assert.equal(f.player.currentTime, 0, "pre-roll time is not song time");
    assert.equal(f.player.seek(12), 0);
    assert.throws(() => f.player.setLoop(1, 10), /Start the song/);
    assert.equal(f.player.duration, 0);
    let played = false;
    const play = f.player.play().then(() => {
      played = true;
    });
    yt.changeState(3);
    yt.changeState(-1);
    await f.settle();
    assert.equal(played, false);
    assert.equal(f.player.paused, true);
    assert.equal(f.player.ready, true, "an ordinary ad is not a load failure");
    const metadata = [];
    f.player.audio.addEventListener("loadedmetadata", () =>
      metadata.push("metadata"),
    );
    f.player.audio.addEventListener("durationchange", () =>
      metadata.push("duration"),
    );
    yt.duration = 150;
    yt.changeState(1);
    await play;
    assert.equal(f.player.paused, false);
    assert.equal(f.player.contentStarted, true);
    assert.equal(f.player.currentTime, 18);
    assert.deepEqual(metadata, ["metadata", "duration"]);
    yt.changeState(3);
    assert.equal(
      f.player.paused,
      true,
      "buffering has no advancing content timeline",
    );
  } finally {
    f.close();
  }
});

test("supported rates and volume use API controls and actual rate feedback", async () => {
  const f = await fixture();
  try {
    const yt = await f.load();
    const rates = [];
    f.player.audio.addEventListener("ratechange", () =>
      rates.push(f.player.audio.playbackRate),
    );
    assert.deepEqual(f.player.availableSpeeds, [0.5, 1, 1.5]);
    assert.throws(() => f.player.setSpeed(0.75), /does not support/);
    f.player.setSpeed(0.5);
    assert.equal(
      f.player.audio.playbackRate,
      1,
      "requested rates must wait for actual API confirmation",
    );
    yt.rate = 0.5;
    yt.emit("onPlaybackRateChange", 0.5);
    assert.deepEqual(rates, [0.5]);
    f.player.setVolume(2);
    assert.equal(yt.volume, 100);
    assert.deepEqual(yt.calls, [["rate", 0.5]]);
  } finally {
    f.close();
  }
});

test("asynchronous seeking reports actual time and loops suppress duplicate seeks and ended", async () => {
  const f = await fixture();
  try {
    const yt = await f.load();
    const loops = [];
    const ended = [];
    f.player.addEventListener("loop", (event) => loops.push(event.detail));
    f.player.audio.addEventListener("ended", () => ended.push(true));
    const playback = f.player.play();
    yt.changeState(1);
    await playback;
    yt.time = 8;
    f.player.setLoop(4, 12);
    assert.equal(f.player.seek(10), 10);
    assert.equal(
      f.player.currentTime,
      8,
      "seek is not optimistically presented as complete",
    );
    yt.time = 10;
    f.player._poll();
    yt.time = 12;
    f.player._poll();
    f.player._poll();
    yt.changeState(0);
    assert.equal(
      loops.length,
      1,
      "endpoint and polling may observe the same pending wrap",
    );
    assert.equal(ended.length, 0);
    assert.deepEqual(
      yt.calls.filter(([action]) => action === "seek"),
      [
        ["seek", 10, true],
        ["seek", 4, true],
      ],
    );
    yt.time = 4;
    yt.changeState(1);
    f.player._poll();
    yt.time = 12;
    f.player._poll();
    assert.equal(loops.length, 2);
    f.player.clearLoop();
    yt.changeState(0);
    yt.changeState(0);
    assert.equal(ended.length, 1);
    assert.throws(() => f.player.setLoop(119.99, 120), /at least/);
  } finally {
    f.close();
  }
});

test("switching to local cancels YouTube playback and destroys stale callbacks", async () => {
  const f = await fixture();
  try {
    const facade = f.player.audio;
    const yt = await f.load();
    const playing = f.player.play().catch((error) => error);
    const latest = f.player.loadSource("./different.wav");
    assert.equal(f.player.ready, false);
    assert.equal(yt.destroyed, true);
    assert.equal(f.mount.hidden, true);
    assert.equal(f.mount.children.length, 0);
    yt.changeState(1);
    yt.emit("onError", 100);
    assert.equal(f.player.ready, false);
    f.nativeAudio.metadata(20);
    await latest;
    assert.equal((await playing).name, "AbortError");
    assert.equal(f.player.audio, facade);
    assert.equal(f.player.duration, 20);
    assert.equal(f.player.sourceType, "repository");
  } finally {
    f.close();
  }
});

test("rapid local-to-stream selection revokes file URLs and aborts native metadata loading", async () => {
  const f = await fixture();
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const revoked = [];
  URL.createObjectURL = () => "blob:owned-song";
  URL.revokeObjectURL = (url) => revoked.push(url);
  try {
    const fileLoad = f.player
      .loadFile(new Blob(["song"], { type: "audio/wav" }))
      .catch((error) => error);
    const yt = await f.load();
    f.nativeAudio.metadata(500);
    assert.equal((await fileLoad).name, "AbortError");
    assert.deepEqual(revoked, ["blob:owned-song"]);
    assert.equal(f.player.duration, yt.duration);
    assert.equal(f.player.ready, true);
  } finally {
    f.close();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }
});

for (const [code, message] of [
  [100, /unavailable or private/],
  [101, /owner does not allow/],
  [150, /owner does not allow/],
  [153, /identify this website/],
]) {
  test(`YouTube error ${code} leaves the visible fallback and cancels pending playback`, async () => {
    const f = await fixture();
    try {
      const yt = await f.load();
      const errors = [];
      f.player.audio.addEventListener("error", (event) =>
        errors.push(event.detail.error),
      );
      const playing = f.player.play();
      yt.emit("onError", code);
      await assert.rejects(playing, message);
      assert.equal(f.player.ready, false);
      assert.equal(f.player.paused, true);
      assert.equal(f.mount.hidden, false);
      assert.equal(f.mount.children.length, 1);
      assert.match(errors[0].message, message);
      await assert.rejects(f.player.play(), /Load a song/);
    } finally {
      f.close();
    }
  });
}

test("autoplay denial waits for actual native control playback before recovering", async () => {
  const f = await fixture();
  try {
    const yt = await f.load();
    const pending = f.player.play();
    yt.emit("onAutoplayBlocked");
    await assert.rejects(pending, /browser blocked/);
    assert.equal(f.player.ready, false);
    assert.equal(f.mount.hidden, false);
    yt.changeState(3);
    assert.equal(f.player.ready, false);
    yt.changeState(1);
    assert.equal(f.player.ready, true);
    assert.equal(f.player.paused, false);
  } finally {
    f.close();
  }
});

test("invalid IDs do not load the API and failed API initialization can be retried", async () => {
  const f = await fixture({ apiInitiallyLoaded: false });
  try {
    await assert.rejects(
      f.player.loadYouTube("not-a-video-id"),
      /valid YouTube/,
    );
    assert.equal(f.scripts.length, 0);
    const failed = f.player.loadYouTube("dQw4w9WgXcQ");
    f.scripts[0].dispatchEvent(new Event("error"));
    await assert.rejects(failed, /could not connect/);
    assert.equal(f.player.ready, false);
    assert.equal(f.scripts[0].removed, true);
    const latest = f.player.loadYouTube("dQw4w9WgXcQ");
    assert.equal(f.scripts.length, 2);
    window.YT = f.YT;
    window.onYouTubeIframeAPIReady();
    await f.settle();
    f.instances[0].ready();
    await latest;
    assert.equal(f.player.ready, true);
  } finally {
    f.close();
  }
});

test("a failed initialization is not revived by a later ready callback", async () => {
  const f = await fixture();
  try {
    const pending = f.player.loadYouTube("dQw4w9WgXcQ");
    await f.settle();
    const yt = f.instances[0];
    yt.emit("onError", 101);
    await assert.rejects(pending, /owner does not allow/);
    yt.ready();
    assert.equal(f.player.ready, false);
    assert.equal(f.mount.hidden, false);
  } finally {
    f.close();
  }
});

test("the last video selection owns metadata even if the old ready callback arrives later", async () => {
  const f = await fixture();
  try {
    const first = f.player.loadYouTube("dQw4w9WgXcQ").catch((error) => error);
    await f.settle();
    const oldPlayer = f.instances[0];
    const latest = f.player.loadYouTube("_Z5Z8fl_xgY");
    await f.settle();
    oldPlayer.ready();
    assert.equal(f.player.ready, false);
    assert.equal(oldPlayer.destroyed, true);
    f.instances[1].duration = 222;
    f.instances[1].ready();
    await latest;
    assert.equal((await first).name, "AbortError");
    assert.equal(f.player.sourceId, "_Z5Z8fl_xgY");
    assert.equal(f.player.duration, 222);
    assert.equal(f.mount.children[0], f.instances[1].iframe);
  } finally {
    f.close();
  }
});

test("native YouTube control seek jumps emit segments while commanded seeks emit only once", async () => {
  const f = await fixture();
  try {
    const yt = await f.load();
    const seeks = [];
    f.player.addEventListener("seek", (event) => seeks.push(event.detail));
    yt.time = 20;
    yt.changeState(1);
    yt.time = 20.1;
    f.player._poll();
    assert.equal(seeks.length, 0, "ordinary playback is not a seek");
    yt.time = 42;
    f.player._poll();
    assert.deepEqual(seeks, [{ from: 20.1, to: 42, reason: "native-seek" }]);
    f.player.seek(5);
    yt.time = 5;
    f.player._poll();
    assert.deepEqual(seeks.at(-1), { from: 42, to: 5, reason: "seek" });
    assert.equal(
      seeks.length,
      2,
      "API completion must not create a second native seek",
    );
    const latest = f.player.loadYouTube("_Z5Z8fl_xgY");
    assert.equal(f.player.contentStarted, false);
    assert.equal(f.player.currentTime, 0);
    await f.settle();
    f.instances[1].ready();
    await latest;
    f.instances[1].pauseVideo = () => {
      throw new Error("removed iframe");
    };
    assert.doesNotThrow(() => f.player.pause());
  } finally {
    f.close();
  }
});

test("a delayed API seek with uninterrupted playback exposes its gap and actual settlement once", async () => {
  const f = await fixture();
  try {
    const yt = await f.load();
    yt.time = 42;
    yt.changeState(1);
    const events = [];
    f.player.addEventListener("seek", (event) =>
      events.push(["seek", event.detail, f.player.seeking]),
    );
    f.player.addEventListener("seeked", (event) =>
      events.push(["seeked", event.detail, f.player.seeking]),
    );
    assert.equal(f.player.seeking, false);
    f.player.seek(5);
    assert.equal(f.player.seeking, true);
    assert.equal(f.player.currentTime, 42);
    f.player._poll();
    assert.equal(f.player.seeking, true);
    assert.equal(
      events.length,
      1,
      "old API time cannot complete a delayed seek",
    );
    yt.time = 5.08;
    f.player._poll();
    f.player._poll();
    assert.equal(f.player.seeking, false);
    assert.equal(
      f.player.paused,
      false,
      "no buffering transition is needed for seek settlement",
    );
    assert.deepEqual(events, [
      ["seek", { from: 42, to: 5, reason: "seek" }, true],
      ["seeked", { from: 42, to: 5.08, reason: "seek" }, false],
    ]);
    yt.time = 30;
    f.player._poll();
    assert.deepEqual(events.at(-1), [
      "seek",
      { from: 5.08, to: 30, reason: "native-seek" },
      false,
    ]);
    assert.equal(
      events.filter(([type]) => type === "seeked").length,
      1,
      "native control seeks remain immediate",
    );
    const local = f.player.loadSource("./local.wav");
    f.nativeAudio.metadata(60);
    await local;
    f.player.seek(10);
    assert.equal(
      f.player.seeking,
      false,
      "native seek semantics remain unchanged",
    );
  } finally {
    f.close();
  }
});
