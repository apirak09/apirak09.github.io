// Optional integration checks: install Playwright in this directory and run
// node browser-check.mjs while serving the repository root on localhost:4173.
// These tests use a synthesized microphone, never the operator's real device.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.VOCAL_PLAYWRIGHT_PATH || "playwright");
const base = process.env.VOCAL_BASE_URL || "http://127.0.0.1:4173/tuner/";
const tuner = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.VOCAL_BROWSER_PATH || undefined,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const errors = [];
let checks = 0;
async function check(name, fn) {
  await fn();
  checks++;
  console.log(`PASS ${name}`);
}
async function context(
  mode = "target",
  viewport = { width: 1440, height: 1000 },
) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript((mode) => {
    if (mode === "unsupported")
      Object.defineProperty(window, "MediaRecorder", {
        value: undefined,
        configurable: true,
      });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        if (mode === "denied")
          throw new DOMException(
            "Test permission rejection",
            "NotAllowedError",
          );
        if (mode === "missing")
          throw new DOMException("Test missing microphone", "NotFoundError");
        const context = new AudioContext(),
          osc = context.createOscillator(),
          gain = context.createGain(),
          destination = context.createMediaStreamDestination();
        osc.connect(gain);
        gain.connect(destination);
        osc.frequency.value = 440;
        gain.gain.value = mode === "silence" ? 0 : 0.2;
        osc.start();
        await context.resume();
        window.__mic = { context, osc, gain, stream: destination.stream };
        const notes = await fetch(
          new URL(
            "/tuner/songs/demo-vocal-exercise/song.json",
            location.origin,
          ),
        )
          .then((r) => r.json())
          .then((s) => s.notes);
        setInterval(() => {
          if (mode === "silence") return;
          const backing = document.querySelector("#backing");
          if (document.body.dataset.song === "demo-vocal-exercise") {
            const note = notes.find(
              (n) =>
                backing.currentTime >= n.start &&
                backing.currentTime < n.end &&
                Number.isFinite(n.midi),
            );
            gain.gain.value = note && !backing.paused ? 0.2 : 0;
            if (note) osc.frequency.value = 440 * 2 ** ((note.midi - 69) / 12);
          }
        }, 15);
        return destination.stream;
      },
      configurable: true,
    });
  }, mode);
  return ctx;
}
async function open(ctx, route) {
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${route}: ${e.message}`));
  await p.goto(new URL(route, base).href);
  await p.locator("#main").waitFor();
  return p;
}
async function loaded(p) {
  await p.waitForFunction(() => !document.querySelector("#play").disabled);
}
try {
  const ctx = await context();
  const home = await open(ctx, "");
  await check(
    "library has three requested songs and honest pending states",
    async () => {
      await home.locator(".song-card").first().waitFor();
      assert.equal(await home.locator(".song-card").count(), 3);
      assert.equal(
        await home
          .locator(".song-card .badge")
          .filter({ hasText: "map pending" })
          .count(),
        3,
      );
    },
  );
  const pages = [];
  await check(
    "clean direct routes and package aliases load without redirects",
    async () => {
      for (const slug of [
        "let-her-go",
        "perfect",
        "love-me-not",
        "generic",
        "demo-vocal-exercise",
        "songs/perfect",
      ]) {
        const p = await open(ctx, slug + "/");
        assert.match(await p.title(), /Vocal Studio/);
        assert.equal(
          await p.locator("#app").getAttribute("aria-busy"),
          "false",
        );
        pages.push(p);
      }
    },
  );
  const demo = pages.find((p) => p.url().endsWith("/demo-vocal-exercise/"));
  await demo.bringToFront();
  await loaded(demo);
  await check("play, pause, seek, ±5 seconds, speed and volume", async () => {
    await demo.locator("#play").click();
    await demo.waitForFunction(
      () => document.querySelector("#backing").currentTime > 0.15,
    );
    await demo.locator("#play").click();
    await demo.locator("#seek").fill("3");
    await demo.locator("#forward").click();
    assert.ok(
      Math.abs(
        (await demo.locator("#backing").evaluate((a) => a.currentTime)) - 8,
      ) < 0.2,
    );
    await demo.locator("#back").click();
    assert.ok(
      Math.abs(
        (await demo.locator("#backing").evaluate((a) => a.currentTime)) - 3,
      ) < 0.2,
    );
    await demo.locator("#speed").selectOption("0.75");
    assert.equal(
      await demo.locator("#backing").evaluate((a) => a.playbackRate),
      0.75,
    );
    await demo.locator("#volume").fill("0.3");
    assert.equal(await demo.locator("#backing").evaluate((a) => a.volume), 0.3);
  });
  await check("A-B loops wrap and clear correctly", async () => {
    await demo.locator("#seek").fill("1");
    await demo.locator("#set-a").click();
    await demo.locator("#seek").fill("1.7");
    await demo.locator("#set-b").click();
    await demo.locator("#loop-toggle").click();
    await demo.locator("#play").click();
    await demo.waitForTimeout(1400);
    const position = await demo
      .locator("#backing")
      .evaluate((a) => a.currentTime);
    assert.ok(position >= 1 && position < 1.82);
    await demo.locator("#play").click();
    await demo.locator("#clear-loop").click();
    assert.equal(
      await demo.locator("#loop-toggle").getAttribute("aria-pressed"),
      "false",
    );
  });
  await check(
    "keyboard shortcuts skip body focus and respect form controls",
    async () => {
      await demo.locator("#seek").fill("2");
      await demo.locator("h1").click();
      await demo.keyboard.press("ArrowRight");
      assert.ok(
        Math.abs(
          (await demo.locator("#backing").evaluate((a) => a.currentTime)) - 7,
        ) < 0.2,
      );
      await demo.locator("#reference").focus();
      await demo.keyboard.press("ArrowLeft");
      assert.ok(
        Math.abs(
          (await demo.locator("#backing").evaluate((a) => a.currentTime)) - 7,
        ) < 0.2,
      );
    },
  );
  await check(
    "synthesized voice drives real Web Audio/YIN, recording, scoring, and lyrics",
    async () => {
      await demo.locator("#speed").selectOption("1");
      await demo.locator("#seek").fill("0");
      await demo.locator("#record").click();
      await demo.waitForFunction(
        () => !document.querySelector("#finish").disabled,
      );
      await demo.waitForFunction(
        () => document.querySelector("#detected-note").textContent !== "—",
        {},
        { timeout: 5000 },
      );
      await demo.waitForFunction(
        () => document.querySelector("#backing").currentTime >= 4,
        {},
        { timeout: 8000 },
      );
      assert.ok((await demo.locator("#lyrics").textContent()).length > 0);
      await demo.locator("#finish").click();
      await demo.locator("#review:not([hidden])").waitFor();
      await demo.waitForFunction(
        () => !document.querySelector("#record").disabled,
      );
      assert.match(await demo.locator("#metrics").textContent(), /\d+%/);
      const observed = await demo.evaluate(async () => {
        const { listTakes } = await import("/tuner/js/storage.js");
        const take = (await listTakes("demo-vocal-exercise"))[0];
        return {
          metrics: take.metrics,
          samples: take.samples.slice(0, 12),
          count: take.samples.length,
          segments: take.segments,
        };
      });
      assert.ok(
        Number.parseInt(
          await demo.locator("#metrics strong").first().textContent(),
        ) > 75,
        JSON.stringify(observed),
      );
      assert.ok(await demo.locator("#voice-playback").getAttribute("src"));
      assert.match(
        await demo.locator("#storage-status").textContent(),
        /saved in this browser/,
      );
    },
  );
  await check(
    "voice-only and combined review playback start and stay aligned",
    async () => {
      await demo.locator("#play-voice").click();
      await demo.waitForFunction(
        () => !document.querySelector("#voice-playback").paused,
      );
      await demo.locator("#stop-review").click();
      await demo
        .locator("#voice-playback")
        .evaluate((a) => (a.currentTime = 0));
      await demo.locator("#play-both").click();
      await demo.waitForTimeout(700);
      assert.equal(
        await demo.locator("#voice-playback").evaluate((a) => a.paused),
        false,
      );
      assert.equal(
        await demo.locator("#backing").evaluate((a) => a.paused),
        false,
      );
      assert.equal(await demo.locator("#review-error").textContent(), "");
      const times = await demo.evaluate(() => ({
        voice: document.querySelector("#voice-playback").currentTime,
        track: document.querySelector("#backing").currentTime,
      }));
      assert.ok(Math.abs(times.voice - times.track) < 0.35);
      await demo.locator("#stop-review").click();
    },
  );
  await check(
    "recorded loops and pauses retain separate passes and replay the current segment",
    async () => {
      await demo.locator("#seek").fill("1");
      await demo.locator("#set-a").click();
      await demo.locator("#seek").fill("1.5");
      await demo.locator("#set-b").click();
      await demo.locator("#loop-toggle").click();
      await demo.locator("#record").click();
      await demo.waitForFunction(
        () => !document.querySelector("#finish").disabled,
      );
      await demo.waitForTimeout(1400);
      await demo.locator("#play").click();
      await demo.waitForTimeout(450);
      await demo.locator("#play").click();
      await demo.waitForTimeout(600);
      await demo.locator("#finish").click();
      await demo.waitForFunction(
        () => !document.querySelector("#record").disabled,
      );
      const segments = await demo.evaluate(async () => {
        const { listTakes } = await import("/tuner/js/storage.js");
        const take = (await listTakes("demo-vocal-exercise"))[0];
        return take.segments;
      });
      assert.ok(new Set(segments.map((s) => s.pass)).size >= 2);
      const pause = segments.find(
        (s) =>
          !s.playing &&
          s.recordStart > 0.1 &&
          s.recordEnd - s.recordStart > 0.3,
      );
      assert.ok(
        pause,
        "The actual recorded pause must survive in take metadata",
      );
      await demo
        .locator("#voice-playback")
        .evaluate(
          (audio, time) => (audio.currentTime = time),
          pause.recordStart + 0.08,
        );
      await demo.locator("#play-both").click();
      assert.equal(
        await demo.locator("#backing").evaluate((a) => a.paused),
        true,
      );
      await demo.locator("#stop-review").click();
      await demo.locator("#clear-loop").click();
      await demo.locator("#delete-take").click();
      await demo.locator("#take-history button").first().click();
    },
  );
  await check(
    "history and recording Blob survive a reload and can be deleted",
    async () => {
      await demo.reload();
      await demo.locator("#take-history button").waitFor();
      await demo.locator("#take-history button").first().click();
      await demo.locator("#review:not([hidden])").waitFor();
      assert.ok(await demo.locator("#voice-playback").getAttribute("src"));
      await demo.locator("#delete-take").click();
      await demo.waitForFunction(
        () => document.querySelector("#take-count").textContent === "0 takes",
      );
      await demo.reload();
      await demo.waitForFunction(
        () => document.querySelector("#take-count").textContent === "0 takes",
      );
    },
  );
  const commercial = pages.find((p) => p.url().endsWith("/let-her-go/"));
  await commercial.bringToFront();
  await check(
    "local audio loads on a commercial song and pending map produces no scores",
    async () => {
      await commercial
        .locator("#audio-file")
        .setInputFiles(path.join(tuner, "demo", "vocal-exercise.wav"));
      await loaded(commercial);
      await commercial.locator("#record").click();
      await commercial.waitForTimeout(1000);
      await commercial.locator("#finish").click();
      await commercial.locator("#review:not([hidden])").waitFor();
      assert.equal(
        await commercial
          .locator("#metrics strong")
          .filter({ hasText: "—" })
          .count(),
        4,
      );
      assert.match(
        await commercial.locator("#review-reason").textContent(),
        /verified target melody/,
      );
    },
  );
  await check(
    "melody JSON import unlocks targets, validates bad maps and renders lyrics safely",
    async () => {
      const map = JSON.parse(
        await fs.readFile(
          path.join(tuner, "songs", "demo-vocal-exercise", "song.json"),
          "utf8",
        ),
      );
      map.lyrics = [{ start: 0, end: 4, text: "<img src=x onerror=alert(1)>" }];
      map.melodyStatus = "verified";
      map.referencePitch = 442;
      await commercial.locator("#map-file").setInputFiles({
        name: "map.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(map)),
      });
      await commercial.waitForFunction(
        () =>
          document.querySelector("#analysis-mode").textContent ===
          "Target melody",
      );
      assert.equal(await commercial.locator("#lyrics img").count(), 0);
      assert.equal(await commercial.locator("#reference").inputValue(), "442");
      assert.equal(await commercial.locator("#segments button").count(), 3);
      assert.equal(
        await commercial.locator("#target-label").textContent(),
        "Target note",
      );
      await commercial.locator("#map-file").setInputFiles({
        name: "bad.json",
        mimeType: "application/json",
        buffer: Buffer.from('{"notes":[{"start":2,"end":1,"midi":60}]}'),
      });
      await commercial.waitForFunction(
        () => document.querySelector("#map-error").textContent.length > 0,
      );
    },
  );
  await check(
    "unplayable audio provides a useful error without crashing",
    async () => {
      await commercial.locator("#audio-file").setInputFiles({
        name: "bad.wav",
        mimeType: "audio/wav",
        buffer: Buffer.from("not audio"),
      });
      await commercial.waitForFunction(() =>
        document.querySelector("#message").classList.contains("error"),
      );
    },
  );
  const generic = pages.find((p) => p.url().endsWith("/generic/"));
  await generic.bringToFront();
  await check(
    "generic tuner detects A4, silence is ignored and microphone can disconnect/retry",
    async () => {
      await generic.locator("#mic-toggle").click();
      await generic.waitForFunction(
        () => document.querySelector("#detected-note").textContent === "A4",
      );
      await generic.evaluate(() => (window.__mic.gain.gain.value = 0));
      await generic.waitForFunction(
        () => document.querySelector("#detected-note").textContent === "—",
      );
      await generic.evaluate(() => {
        const track = window.__mic.stream.getTracks()[0];
        track.dispatchEvent(new Event("ended"));
      });
      await generic.waitForFunction(
        () =>
          document.querySelector("#mic-toggle").textContent ===
          "Enable microphone",
      );
      await generic.locator("#mic-toggle").click();
      await generic.waitForFunction(
        () => document.querySelector("#detected-note").textContent === "A4",
      );
    },
  );
  for (const mode of ["denied", "missing"]) {
    await check(`${mode} microphone has actionable retry UI`, async () => {
      const c = await context(mode);
      const p = await open(c, "generic/");
      await p.locator("#mic-toggle").click();
      await p.waitForFunction(() =>
        document.querySelector("#message").classList.contains("error"),
      );
      assert.match(
        await p.locator("#message").textContent(),
        mode === "denied" ? /declined/ : /No microphone/,
      );
      assert.equal(await p.locator("#mic-toggle").isEnabled(), true);
      await c.close();
    });
  }
  await check(
    "unsupported MediaRecorder saves a usable analysis-only take",
    async () => {
      const c = await context("unsupported");
      const p = await open(c, "generic/");
      assert.equal(
        await p.locator("#record").textContent(),
        "Start pitch take",
      );
      await p.locator("#record").click();
      await p.waitForTimeout(600);
      await p.locator("#finish").click();
      await p.locator("#review:not([hidden])").waitFor();
      assert.equal(await p.locator("#voice-playback").isVisible(), false);
      assert.match(
        await p.locator("#review-error").textContent(),
        /pitch history only/,
      );
      await c.close();
    },
  );
  await check(
    "desktop/tablet/mobile layouts stay within viewport and expose labeled inputs",
    async () => {
      for (const width of [1440, 1024, 768, 390, 320]) {
        for (const p of [home, demo]) {
          await p.setViewportSize({ width, height: 1000 });
          await p.waitForTimeout(75);
          assert.ok(
            await p.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
            `${p.url()} overflows at ${width}`,
          );
          const unlabeled = await p
            .locator("input,select")
            .evaluateAll((inputs) =>
              inputs
                .filter(
                  (el) =>
                    !el.closest("label") &&
                    !el.getAttribute("aria-label") &&
                    !el.labels?.length,
                )
                .map((el) => el.id),
            );
          assert.deepEqual(unlabeled, []);
        }
      }
    },
  );
  if (process.env.VOCAL_SCREENSHOTS) {
    const folder = process.env.VOCAL_SCREENSHOTS;
    await fs.mkdir(folder, { recursive: true });
    await home.setViewportSize({ width: 1440, height: 1100 });
    await home.screenshot({
      path: path.join(folder, "vocal-studio-library.png"),
      fullPage: true,
    });
    await demo.setViewportSize({ width: 1440, height: 1100 });
    await demo.screenshot({
      path: path.join(folder, "vocal-studio-trainer.png"),
      fullPage: true,
    });
    await demo.setViewportSize({ width: 390, height: 844 });
    await demo.screenshot({
      path: path.join(folder, "vocal-studio-mobile.png"),
      fullPage: true,
    });
  }
  assert.deepEqual(errors, [], "No uncaught JavaScript errors");
  console.log(
    `PASS ${checks} browser flow groups; no uncaught JavaScript errors`,
  );
  await ctx.close();
} finally {
  await browser.close();
}
