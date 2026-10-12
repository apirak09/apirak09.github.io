// Streaming integration regressions. Only YouTube is mocked; microphone pitch
// analysis, MediaRecorder, IndexedDB, and local media playback use browser APIs.
// Serve the repository on localhost:4173, then run node stream-browser-check.mjs.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.VOCAL_PLAYWRIGHT_PATH || "playwright");
const base = process.env.VOCAL_BASE_URL || "http://127.0.0.1:4173/tuner/";
const tuner = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localAudio = path.join(tuner, "demo", "vocal-exercise.wav");
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.VOCAL_BROWSER_PATH || undefined,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const errors = [];
const failures = [];
const contexts = [];
let checks = 0;

function installMockYouTube() {
  window.__yt = [];
  class MockPlayer {
    constructor(iframe, options) {
      this.iframe = iframe;
      this.events = options.events;
      this.state = -1;
      this.time = 0;
      this.at = performance.now();
      this.duration = 120;
      this.rate = 1;
      this.calls = [];
      this.destroyed = false;
      window.__yt.push(this);
      if (!window.__holdYTReady) setTimeout(() => this.ready(), 0);
    }
    emit(type, data) {
      this.events[type]?.({ target: this, data });
    }
    ready() {
      this.emit("onReady");
    }
    getCurrentTime() {
      return (
        this.time +
        (this.state === 1
          ? ((performance.now() - this.at) / 1000) * this.rate
          : 0)
      );
    }
    setTime(time) {
      this.time = time;
      this.at = performance.now();
    }
    setState(state, time = this.getCurrentTime()) {
      this.setTime(time);
      this.state = state;
      this.emit("onStateChange", state);
    }
    getDuration() {
      return this.duration;
    }
    getPlayerState() {
      return this.state;
    }
    getPlaybackRate() {
      return this.rate;
    }
    getAvailablePlaybackRates() {
      return [0.5, 1];
    }
    playVideo() {
      this.calls.push({ method: "play" });
    }
    pauseVideo() {
      this.calls.push({ method: "pause" });
      this.setState(2);
    }
    seekTo(time, allowSeekAhead) {
      this.calls.push({
        method: "seek",
        time,
        allowSeekAhead,
        at: performance.now(),
      });
      clearTimeout(this.seekTimer);
      const settle = () => {
        this.setTime(time);
        this.calls.push({
          method: "seek-complete",
          time,
          at: performance.now(),
        });
      };
      // Preserve playing state and the old clock while the provider resolves
      // the command; a seek need not emit buffering/pause/play state changes.
      if (window.__ytSeekDelay)
        this.seekTimer = setTimeout(settle, window.__ytSeekDelay);
      else settle();
    }
    setPlaybackRate(rate) {
      const time = this.getCurrentTime();
      this.calls.push({ method: "rate", rate });
      this.setTime(time);
      this.rate = rate;
      this.emit("onPlaybackRateChange", rate);
    }
    setVolume(volume) {
      this.calls.push({ method: "volume", volume });
    }
    destroy() {
      clearTimeout(this.seekTimer);
      this.destroyed = true;
      this.calls.push({ method: "destroy" });
    }
  }
  window.YT = { Player: MockPlayer };
  window.onYouTubeIframeAPIReady?.();
}

async function check(name, fn) {
  try {
    await fn();
    checks++;
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.stack || error.message}`);
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

async function newPage({ micDelay = 0 } = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  contexts.push(context);
  const requests = [];
  await context.route("https://www.youtube.com/iframe_api", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/javascript",
      body: `(${installMockYouTube.toString()})();`,
    }),
  );
  await context.route("https://www.youtube-nocookie.com/embed/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><html><body>Official video test double</body></html>",
    }),
  );
  await context.addInitScript(
    ({ micDelay }) => {
      window.__recordStarts = 0;
      const nativeStart = MediaRecorder.prototype.start;
      MediaRecorder.prototype.start = function (...args) {
        window.__recordStarts++;
        window.__recordStartedAt = performance.now();
        return nativeStart.apply(this, args);
      };
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        configurable: true,
        value: async () => {
          const context = new AudioContext();
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          const destination = context.createMediaStreamDestination();
          oscillator.frequency.value = 440;
          gain.gain.value = 0.2;
          oscillator.connect(gain);
          gain.connect(destination);
          oscillator.start();
          await context.resume();
          window.__mic = {
            context,
            oscillator,
            gain,
            stream: destination.stream,
          };
          if (micDelay)
            await new Promise((resolve) => setTimeout(resolve, micDelay));
          return destination.stream;
        },
      });
    },
    { micDelay },
  );
  const page = await context.newPage();
  page.on("pageerror", (error) =>
    errors.push(`${page.url()}: ${error.message}`),
  );
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(new URL("let-her-go/", base).href);
  await page.locator("#load-youtube").waitFor();
  return { page, requests };
}

async function loadOfficial(page) {
  await page.locator("#load-youtube").click();
  await page.waitForFunction(
    () => window.__yt?.length && !document.querySelector("#play").disabled,
  );
}

async function contentStarts(page, position = 3) {
  await page.evaluate(
    (position) => window.__yt.at(-1).setState(1, position),
    position,
  );
  await page.waitForFunction(() => !document.querySelector("#record").disabled);
}

async function latestTake(page) {
  return page.evaluate(async () => {
    const { listTakes } = await import("/tuner/js/storage.js");
    const take = (await listTakes("let-her-go"))[0];
    return take
      ? {
          ...take,
          recording: {
            size: take.recording?.size || 0,
            type: take.recording?.type || "",
          },
        }
      : null;
  });
}

function longOriginalTone() {
  const sampleRate = 8000;
  const sampleCount = sampleRate * 32;
  const bytes = Buffer.alloc(44 + sampleCount * 2);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(sampleCount * 2, 40);
  for (let sample = 0; sample < sampleCount; sample++)
    bytes.writeInt16LE(
      Math.round(Math.sin((sample / sampleRate) * 2 * Math.PI * 440) * 1000),
      44 + sample * 2,
    );
  return bytes;
}

try {
  const { page, requests } = await newPage();
  let take;
  await check(
    "streaming SDK and iframe are absent before explicit selection",
    async () => {
      assert.equal(
        requests.filter((url) => url.includes("youtube.com/iframe_api")).length,
        0,
      );
      assert.equal(await page.locator("#youtube-mount iframe").count(), 0);
      assert.equal(await page.evaluate(() => typeof window.YT), "undefined");
      assert.equal(await page.locator("#record").isDisabled(), true);
    },
  );

  await check(
    "visible official player loads on demand and pre-roll cannot record, seek, or change speed",
    async () => {
      await loadOfficial(page);
      assert.equal(
        requests.filter((url) => url.includes("youtube.com/iframe_api")).length,
        1,
      );
      assert.equal(
        await page.locator("#youtube-mount iframe").isVisible(),
        true,
      );
      await page.locator("#play").click();
      await page.evaluate(() => {
        const yt = window.__yt.at(-1);
        yt.setState(3, 18);
        yt.setState(-1, 18);
      });
      for (const id of [
        "record",
        "seek",
        "back",
        "forward",
        "speed",
        "set-a",
        "set-b",
      ])
        assert.equal(
          await page.locator(`#${id}`).isDisabled(),
          true,
          `${id} must remain disabled during pre-roll`,
        );
      assert.equal(await page.locator("#current-time").textContent(), "0:00");
      assert.equal(await page.evaluate(() => window.__recordStarts), 0);
    },
  );

  await check(
    "actual song playback enables training controls and respects available streaming speeds",
    async () => {
      await contentStarts(page);
      for (const id of [
        "record",
        "seek",
        "back",
        "forward",
        "speed",
        "set-a",
        "set-b",
      ])
        assert.equal(await page.locator(`#${id}`).isEnabled(), true);
      assert.equal(
        await page
          .locator('#speed option[value="0.75"]')
          .evaluate((option) => option.disabled),
        true,
      );
      assert.equal(
        await page
          .locator('#speed option[value="0.5"]')
          .evaluate((option) => option.disabled),
        false,
      );
    },
  );

  await check(
    "recording an already-playing stream leaves backing uninterrupted and detects real synthesized voice",
    async () => {
      const before = await page.evaluate(
        () =>
          window.__yt
            .at(-1)
            .calls.filter((call) => ["play", "pause"].includes(call.method))
            .length,
      );
      await page.locator("#record").click();
      await page.waitForFunction(() =>
        document
          .querySelector("#record-indicator")
          .classList.contains("active"),
      );
      await page.waitForFunction(
        () => document.querySelector("#detected-note").textContent === "A4",
      );
      const after = await page.evaluate(
        () =>
          window.__yt
            .at(-1)
            .calls.filter((call) => ["play", "pause"].includes(call.method))
            .length,
      );
      assert.equal(
        after,
        before,
        "Record must not call pauseVideo or playVideo on already-playing content",
      );
      assert.equal(await page.evaluate(() => window.__recordStarts), 1);
      await page.waitForTimeout(450);
    },
  );

  await check(
    "paused native forward seek separates saved passes instead of scoring the skipped interval",
    async () => {
      await page.evaluate(() => window.__yt.at(-1).setState(2));
      await page.waitForTimeout(200);
      await page.evaluate(() => window.__yt.at(-1).setState(1, 8));
      await page.waitForTimeout(450);
      await page.locator("#finish").click();
      await page.locator("#review:not([hidden])").waitFor();
      await page.waitForFunction(
        () => !document.querySelector("#audio-file").disabled,
      );
      take = await latestTake(page);
      const before = take.samples.filter((sample) => sample.time < 6);
      const after = take.samples.filter((sample) => sample.time >= 8);
      assert.ok(
        before.length >= 3 && after.length >= 3,
        "both sides of the native seek must have real saved samples",
      );
      assert.notEqual(
        before.at(-1).pass,
        after[0].pass,
        "the skipped interval must not remain inside one scoring pass",
      );
      assert.ok(
        take.segments.some(
          (segment) =>
            !segment.playing && segment.recordEnd - segment.recordStart > 0.1,
        ),
        "the actual pause remains part of microphone replay metadata",
      );
    },
  );

  await check(
    "YouTube take persists source and microphone Blob, with honest unscored and separate replay",
    async () => {
      take ||= await latestTake(page);
      const videoId = await page
        .locator("#youtube-mount iframe")
        .getAttribute("src");
      assert.deepEqual(take.source, {
        type: "youtube",
        id: new URL(videoId).pathname.split("/").at(-1),
      });
      assert.ok(
        take.recording.size > 0,
        "real MediaRecorder audio must be saved in IndexedDB",
      );
      assert.equal(take.metrics.overall, null);
      assert.equal(await page.locator("#play-both").isDisabled(), true);
      assert.equal(await page.locator("#review-stream-note").isVisible(), true);
      await page.locator("#play-voice").click();
      await page.waitForFunction(
        () => document.querySelector("#voice-playback").currentTime > 0.1,
      );
      assert.equal(await page.evaluate(() => window.__yt.at(-1).state), 2);
      await page.locator("#stop-review").click();
    },
  );

  await check(
    "selecting local audio enables combined replay for a saved streaming take",
    async () => {
      await page.locator("#audio-file").setInputFiles(localAudio);
      await page.waitForFunction(
        () => !document.querySelector("#play-both").disabled,
      );
      assert.equal(await page.locator("#youtube-mount").isVisible(), false);
      await page.locator("#voice-playback").evaluate((audio) => {
        audio.currentTime = 0;
      });
      await page.locator("#play-both").click();
      await page.waitForFunction(
        () =>
          !document.querySelector("#backing").paused &&
          document.querySelector("#voice-playback").currentTime > 0.15,
      );
      const positions = await page.evaluate(() => ({
        voice: document.querySelector("#voice-playback").currentTime,
        backing: document.querySelector("#backing").currentTime,
      }));
      const segment = take.segments.find(
        (segment) =>
          positions.voice >= segment.recordStart &&
          positions.voice < segment.recordEnd,
      );
      assert.ok(segment?.playing);
      const expected =
        segment.songStart +
        (positions.voice - segment.recordStart) * segment.speed;
      assert.ok(
        Math.abs(positions.backing - expected) < 0.4,
        JSON.stringify({ positions, expected }),
      );
      assert.equal(await page.locator("#review-error").textContent(), "");
      await page.locator("#stop-review").click();
    },
  );

  await check(
    "fresh official-player backing replay waits through pre-roll then seeks the saved take offset",
    async () => {
      await page.reload();
      await page.locator("#take-history button").first().click();
      await page.locator("#review:not([hidden])").waitFor();
      await loadOfficial(page);
      await page.locator("#play-backing").click();
      assert.equal(
        await page.evaluate(() =>
          window.__yt.at(-1).calls.some((call) => call.method === "seek"),
        ),
        false,
        "pre-roll must not receive a song seek",
      );
      await page.evaluate(() => window.__yt.at(-1).setState(-1, 19));
      assert.equal(
        await page.evaluate(() =>
          window.__yt.at(-1).calls.some((call) => call.method === "seek"),
        ),
        false,
      );
      await page.evaluate(() => window.__yt.at(-1).setState(1, 0));
      await page.waitForFunction(() =>
        window.__yt.at(-1).calls.some((call) => call.method === "seek"),
      );
      const seek = await page.evaluate(() =>
        window.__yt.at(-1).calls.find((call) => call.method === "seek"),
      );
      assert.ok(take.startTime > 2);
      assert.ok(
        Math.abs(seek.time - take.startTime) < 0.05,
        JSON.stringify({ seek, startTime: take.startTime }),
      );
      assert.equal(await page.locator("#review-error").textContent(), "");
      await page.locator("#stop-review").click();
    },
  );

  await check(
    "local A-B to pending YouTube to local fallback clears loops and rejects stale callbacks",
    async () => {
      const { page: fallback } = await newPage();
      await fallback.locator("#audio-file").setInputFiles(localAudio);
      await fallback.waitForFunction(
        () =>
          !document.querySelector("#seek").disabled &&
          Number(document.querySelector("#seek").max) > 4,
      );
      await fallback.locator("#seek").fill("2");
      await fallback.locator("#set-a").click();
      await fallback.locator("#seek").fill("4");
      await fallback.locator("#set-b").click();
      await fallback.locator("#loop-toggle").click();
      await fallback.evaluate(() => {
        window.__holdYTReady = true;
      });
      await fallback.locator("#load-youtube").click();
      await fallback.waitForFunction(() => window.__yt?.length === 1);
      assert.equal(await fallback.locator("#load-youtube").isDisabled(), true);
      assert.equal(await fallback.locator("#audio-file").isEnabled(), true);
      await fallback.locator("#audio-file").setInputFiles({
        name: "fallback.wav",
        mimeType: "audio/wav",
        buffer: await fs.readFile(localAudio),
      });
      await fallback.waitForFunction(
        () =>
          document.querySelector("#audio-name").textContent ===
            "fallback.wav" && !document.querySelector("#seek").disabled,
      );
      await fallback.evaluate(() => {
        const stale = window.__yt[0];
        stale.ready();
        stale.setState(1, 30);
        stale.emit("onError", 101);
      });
      assert.equal(
        await fallback.locator("#audio-name").textContent(),
        "fallback.wav",
      );
      assert.equal(await fallback.locator("#youtube-mount iframe").count(), 0);
      assert.equal(await fallback.locator("#youtube-mount").isVisible(), false);
      assert.equal(
        await fallback.locator("#loop-toggle").getAttribute("aria-pressed"),
        "false",
      );
      assert.equal(await fallback.locator("#play").isEnabled(), true);
      assert.equal(
        await fallback.evaluate(() => window.__yt[0].destroyed),
        true,
      );
    },
  );

  await check(
    "stream pausing during microphone permission cannot start a recording afterward",
    async () => {
      const { page: delayed } = await newPage({ micDelay: 400 });
      await loadOfficial(delayed);
      await contentStarts(delayed, 4);
      await delayed.locator("#record").click();
      await delayed.waitForFunction(() => Boolean(window.__mic));
      await delayed.evaluate(() => window.__yt.at(-1).setState(2));
      await delayed.waitForFunction(() =>
        document
          .querySelector("#message")
          .textContent.includes("Start or resume the song"),
      );
      assert.equal(await delayed.evaluate(() => window.__recordStarts), 0);
      assert.equal(await delayed.locator("#finish").isDisabled(), true);
      assert.equal(await latestTake(delayed), null);
    },
  );

  await check(
    "asynchronous streaming seek excludes waiting samples and resumes a new pass at actual song time",
    async () => {
      const { page: seeking } = await newPage();
      await loadOfficial(seeking);
      await contentStarts(seeking, 8);
      await seeking.locator("#record").click();
      await seeking.waitForFunction(() =>
        document
          .querySelector("#record-indicator")
          .classList.contains("active"),
      );
      await seeking.waitForTimeout(350);
      await seeking.evaluate(() => {
        window.__ytSeekDelay = 250;
      });
      await seeking.waitForFunction(
        () => Number(document.querySelector("#seek").max) >= 20,
      );
      await seeking.locator("#seek").fill("20");
      await seeking.waitForFunction(() =>
        window.__yt
          .at(-1)
          .calls.some(
            (call) => call.method === "seek-complete" && call.time === 20,
          ),
      );
      await seeking.waitForTimeout(450);
      assert.equal(
        await seeking.evaluate(() => window.__yt.at(-1).state),
        1,
        "seek settlement must not rely on a pause/play transition",
      );
      await seeking.locator("#finish").click();
      await seeking.locator("#review:not([hidden])").waitFor();
      await seeking.waitForFunction(
        () => !document.querySelector("#audio-file").disabled,
      );
      const take = await latestTake(seeking);
      const before = take.samples.filter((sample) => sample.time < 10);
      const after = take.samples.filter((sample) => sample.time >= 20);
      assert.ok(
        before.length >= 3 && after.length >= 3,
        "the take must contain singing samples before and after the provider seek",
      );
      assert.equal(
        take.samples.some((sample) => sample.time >= 10 && sample.time < 19),
        false,
        "skipped song time must have no samples",
      );
      assert.notEqual(
        before.at(-1).pass,
        after[0].pass,
        "old-position samples cannot fuse with the resumed target interval",
      );
      const clock = await seeking.evaluate(() => ({
        started: window.__recordStartedAt,
        requested: window.__yt
          .at(-1)
          .calls.find((call) => call.method === "seek" && call.time === 20).at,
        settled: window.__yt
          .at(-1)
          .calls.find(
            (call) => call.method === "seek-complete" && call.time === 20,
          ).at,
      }));
      const waitStart = (clock.requested - clock.started) / 1000;
      const waitEnd = (clock.settled - clock.started) / 1000;
      assert.equal(
        take.samples.some(
          (sample) =>
            sample.recordTime > waitStart + 0.05 &&
            sample.recordTime < waitEnd - 0.04,
        ),
        false,
        "microphone pitch must not score while the provider still reports the pre-seek position",
      );
      const waiting = take.segments.find(
        (segment) =>
          !segment.playing && segment.recordEnd - segment.recordStart >= 0.18,
      );
      assert.ok(
        waiting,
        "microphone review needs an explicit waiting segment during the asynchronous seek",
      );
      const resumed = take.segments.find(
        (segment) =>
          segment.playing &&
          segment.songStart >= 20 &&
          segment.songStart < 20.4,
      );
      assert.ok(resumed, JSON.stringify(take.segments));

      // A longer generated tone permits replay beyond the 14-second demo file.
      await seeking
        .locator("#audio-file")
        .setInputFiles({
          name: "original-32-second-test-tone.wav",
          mimeType: "audio/wav",
          buffer: longOriginalTone(),
        });
      await seeking.waitForFunction(
        () => !document.querySelector("#play-both").disabled,
      );
      await seeking.locator("#voice-playback").evaluate((audio, time) => {
        audio.currentTime = time;
      }, resumed.recordStart + 0.08);
      await seeking.locator("#play-both").click();
      await seeking.waitForFunction(
        () =>
          !document.querySelector("#backing").paused &&
          document.querySelector("#backing").currentTime >= 20,
      );
      const positions = await seeking.evaluate(() => ({
        voice: document.querySelector("#voice-playback").currentTime,
        backing: document.querySelector("#backing").currentTime,
      }));
      const expected =
        resumed.songStart +
        (positions.voice - resumed.recordStart) * resumed.speed;
      assert.ok(
        Math.abs(positions.backing - expected) < 0.4,
        JSON.stringify({ positions, expected }),
      );
      assert.equal(await seeking.locator("#review-error").textContent(), "");
      await seeking.locator("#stop-review").click();
    },
  );

  await check(
    "streaming integration has no uncaught JavaScript errors",
    async () => {
      assert.deepEqual(errors, []);
    },
  );
  console.log(
    `${checks} streaming browser checks passed; ${failures.length} failed.`,
  );
  if (failures.length) {
    console.error(failures.join("\n\n"));
    process.exitCode = 1;
  }
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
}
