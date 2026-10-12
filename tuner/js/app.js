import { loadCatalog, loadSong } from "./song-loader.js";
import { midiToNote } from "./pitch-utils.js";
import { listTakes, getStorageStatus } from "./storage.js";
import {
  esc,
  url,
  header,
  footer,
  dateLabel,
  storageDescription,
} from "./ui.js";
const app = document.querySelector("#app");
async function init() {
  const [catalog, takes] = await Promise.all([loadCatalog(), listTakes()]);
  const songs = await Promise.all(
    catalog
      .filter((s) => s.id !== "demo-vocal-exercise" && s.id !== "generic")
      .map((entry) => loadSong(entry.id)),
  );
  const isMapped = (s) =>
    ["verified", "original"].includes(s.melodyStatus) &&
    s.notes.some((n) => Number.isFinite(n.midi));
  const hues = [340, 70, 195];
  const wave = [15, 27, 48, 67, 83, 72, 51, 34, 60, 80, 91, 61, 44, 25, 16];
  app.innerHTML = `${header("songs")}<main id="main" class="shell"><section class="intro"><div><h1>Find your voice.<br>One phrase at a time.</h1><p>Bring a song, tune into your pitch, and make the next take a little better.</p></div><div class="intro-aside">Made for focused practice.<br>Headphones on. Pressure off.</div></section><section aria-labelledby="songs-heading"><div class="section-heading"><h2 id="songs-heading">Your practice room</h2><span class="small muted">${songs.length} songs</span></div><div class="song-grid">${songs
    .map((s, i) => {
      const history = takes
        .filter((t) => t.songId === s.id)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      const scores = history
        .map((t) => t.metrics?.overall)
        .filter(Number.isFinite);
      return `<a class="song-card" href="${url(s.id + "/")}" aria-label="Practice ${esc(s.title)} by ${esc(s.artist)}"><div class="song-art" style="--hue:${hues[i % hues.length]}"><span class="art-label">VOCAL PRACTICE</span><div class="wave" aria-hidden="true">${wave.map((h, j) => `<i style="--h:${wave[(j + i * 3) % wave.length]}px"></i>`).join("")}</div><span class="art-index" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span></div><div class="song-body"><h3>${esc(s.title)}</h3><p>${esc(s.artist)}</p><span class="badge ${isMapped(s) && s.audioMode === "repository" ? "ready" : ""}">${s.audioMode === "local-file" ? "Audio required" : isMapped(s) ? "Ready" : "Track included"}${isMapped(s) ? "" : " · map pending"}</span><div class="song-meta"><span>Vocal range: ${s.range && isMapped(s) ? esc(midiToNote(s.range.low)) + "–" + esc(midiToNote(s.range.high)) : "analysis pending"}</span><span>Difficulty: ${esc(s.difficulty || "not yet assessed")}</span><span>${history.length ? `${history.length} take${history.length === 1 ? "" : "s"} · last ${esc(dateLabel(history[0].date))}` : "Your first take starts here"}</span><span>Last score: ${Number.isFinite(history[0]?.metrics?.overall) ? history[0].metrics.overall + "%" : "—"} · Best: ${scores.length ? Math.max(...scores) + "%" : "—"}</span></div><div class="card-footer"><strong>Open practice</strong><span aria-hidden="true">↗</span></div></div></a>`;
    })
    .join(
      "",
    )}</div></section><section class="start-tools" aria-label="More ways to practice"><div class="tool-row demo"><div><span class="badge ready"><i class="dot"></i>Ready to practice</span><h3 style="margin-top:12px">A small exercise. A complete studio.</h3><p>Try our original 14-second melody with timed notes, lyrics, loops, and real pitch scoring.</p></div><a class="button primary" href="${url("demo-vocal-exercise/")}">Try exercise ↗</a></div><div class="tool-row"><div><h3>Just you and a note.</h3><p>Open the free tuner. No track needed. Find a comfortable pitch and settle into it.</p></div><a class="button" href="${url("generic/")}">Tune ↗</a></div></section><section aria-labelledby="history-heading"><div class="section-heading"><h2 id="history-heading">Recent practice</h2><span class="small muted">Saved on this device</span></div>${
    takes.length
      ? `<ul class="take-list">${takes
          .slice()
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 5)
          .map(
            (t) =>
              `<li class="take-row"><div><strong>${esc([...catalog, { id: "generic", title: "Free tuner" }].find((s) => s.id === t.songId)?.title || t.songId)}</strong><p>${esc(dateLabel(t.date))} · ${Math.round(t.duration)} seconds · ${Number.isFinite(t.metrics?.overall) ? t.metrics.overall + "% overall" : "Free pitch take"}</p></div><a class="button quiet" href="${url(t.songId + "/")}#take=${encodeURIComponent(t.id)}">Review take</a></li>`,
          )
          .join("")}</ul>`
      : '<p class="empty-history">Nothing to listen back to yet. Open a song or the exercise and record your first take.</p>'
  }</section><p id="storage-status" class="small muted" style="margin-top:18px">${esc(storageDescription(getStorageStatus()))}</p>${footer()}</main>`;
}
init().catch((error) => {
  app.innerHTML = `${header()}<main class="shell" id="main" style="padding-top:40px"><h1>Your studio couldn’t load.</h1><p class="notice error" style="margin-top:20px">${esc(error.message)} Refresh to try again.</p>${footer()}</main>`;
});
