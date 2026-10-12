import assert from "node:assert/strict";
import { readFile, mkdtemp, mkdir, unlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.VOCAL_PLAYWRIGHT_PATH || "playwright");
const tuner = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = await mkdtemp(path.join(tmpdir(), "vocal-editor-check-"));
const base = process.env.VOCAL_BASE_URL || "http://127.0.0.1:4173/tuner/";
const screenshots = process.env.VOCAL_SCREENSHOTS;
if (screenshots) await mkdir(screenshots, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.VOCAL_BROWSER_PATH || undefined,
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("dialog", (dialog) => dialog.accept());
async function add(type, start, end, value, rest = false) {
  await page.selectOption("#interval-type", type);
  await page.fill("#start", String(start));
  await page.fill("#end", String(end));
  if (type === "notes") {
    await page.setChecked("#rest", rest);
    if (!rest) await page.fill("#midi", String(value));
  } else await page.fill("#lyric-text", value);
  await page.click("#save-interval");
}
async function exportMap(filename) {
  const pending = page.waitForEvent("download");
  await page.click("#export");
  const download = await pending;
  await download.saveAs(path.join(temporary, filename));
  return JSON.parse(await readFile(path.join(temporary, filename), "utf8"));
}
try {
  await page.goto(new URL("tools/song-editor/", base).href);
  await page.waitForSelector(
    '#song-picker option[value="demo-vocal-exercise"]',
    { state: "attached" },
  );
  assert.equal(await page.textContent("h1"), "Map a melody.");
  await add("notes", 0.5, 1.5, 60);
  await add("notes", 1.5, 2, null, true);
  await add("notes", 2, 3, 62);
  assert.equal(await page.locator("#note-rows tr").count(), 3);
  await add("notes", 2.5, 3.5, 64);
  assert.match(await page.textContent("#status"), /without overlapping/);
  assert.equal(await page.locator("#note-rows tr").count(), 3);
  await page.locator('#note-rows button[data-action="edit"]').first().click();
  await page.fill("#midi", "61");
  await page.click("#save-interval");
  assert.match(
    await page.locator("#note-rows tr").first().textContent(),
    /C♯4/,
  );
  await add(
    "lyrics",
    0.5,
    3,
    '<img src=x onerror="window.bad=true"> original cue',
  );
  assert.equal(await page.locator("#lyric-rows img").count(), 0);
  const draft = await exportMap("editor-draft.json");
  assert.equal(draft.melodyStatus, "draft");
  assert.equal(draft.notes[0].midi, 61);
  assert.equal(draft.notes[1].midi, null);
  assert.equal(draft.lyrics.length, 1);
  assert.deepEqual(draft.range, { low: 61, high: 62 });
  await page.setChecked("#verified", true);
  const verified = await exportMap("editor-verified.json");
  assert.equal(verified.melodyStatus, "verified");
  await page.setInputFiles(
    "#audio-file",
    path.join(tuner, "demo", "vocal-exercise.wav"),
  );
  await page.waitForFunction(
    () => document.querySelector("#audio").duration === 14,
  );
  assert.equal(await page.isChecked("#verified"), false);
  await page.selectOption("#speed", "0.5");
  assert.equal(await page.$eval("#audio", (el) => el.playbackRate), 0.5);
  await page.$eval("#audio", (el) => {
    el.currentTime = 1.25;
  });
  await page.click("#mark-start");
  assert.equal(await page.inputValue("#start"), "1.250");
  await page.$eval("#audio", (el) => {
    el.currentTime = 2.25;
  });
  await page.click("#mark-end");
  assert.equal(await page.inputValue("#end"), "2.250");
  await page.click("#seek-start");
  assert.ok(
    Math.abs((await page.$eval("#audio", (el) => el.currentTime)) - 1.25) <
      0.05,
  );
  await page.selectOption("#interval-type", "notes");
  await page.fill("#midi", "60");
  await page.click("#hear-note");
  await page.selectOption("#song-picker", "demo-vocal-exercise");
  await page.waitForFunction(
    () => document.querySelectorAll("#note-rows tr").length === 10,
  );
  await page.waitForFunction(
    () => document.querySelector("#audio").duration === 14,
  );
  assert.equal(await page.locator("#lyric-rows tr").count(), 3);
  if (screenshots)
    await page.screenshot({
      path: path.join(screenshots, "editor-desktop.png"),
      fullPage: true,
    });
  await page.setInputFiles("#json-file", {
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{nope"),
  });
  await page.waitForFunction(() =>
    document.querySelector("#status").textContent.includes("valid JSON"),
  );
  assert.equal(await page.locator("#note-rows tr").count(), 10);
  await page.setInputFiles(
    "#json-file",
    path.join(temporary, "editor-verified.json"),
  );
  await page.waitForFunction(
    () => document.querySelectorAll("#note-rows tr").length === 3,
  );
  assert.equal(await page.isChecked("#verified"), false);
  await page.locator('#note-rows button[data-action="delete"]').first().click();
  assert.equal(await page.locator("#note-rows tr").count(), 2);
  await page.setViewportSize({ width: 390, height: 844 });
  if (screenshots)
    await page.screenshot({
      path: path.join(screenshots, "editor-mobile.png"),
      fullPage: true,
    });
  const layout = await page.evaluate(() => ({
    viewport: innerWidth,
    body: document.documentElement.scrollWidth,
    unlabeled: [...document.querySelectorAll("input,select,textarea")]
      .filter((el) => !el.labels?.length && !el.getAttribute("aria-label"))
      .map((el) => el.id),
  }));
  assert.ok(layout.body <= layout.viewport, JSON.stringify(layout));
  assert.deepEqual(layout.unlabeled, []);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        success: true,
        checks: [
          "notes/rests/edit/delete",
          "overlap rejection",
          "literal lyric text",
          "draft/verified JSON export",
          "local audio",
          "speed",
          "mark/seek",
          "target audition",
          "song package loading",
          "JSON import/errors",
          "390px layout",
          "input labels",
          "no JavaScript errors",
        ],
        screenshots: ["editor-desktop.png", "editor-mobile.png"],
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  for (const filename of ["editor-draft.json", "editor-verified.json"])
    await unlink(path.join(temporary, filename)).catch(() => {});
}
