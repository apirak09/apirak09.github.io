import { loadSong, validateSong, BASE_URL } from "./song-loader.js";
import { AudioPlayer } from "./audio-player.js";
import { PitchDetector } from "./pitch-detector.js";
import {
  midiToNote,
  midiToFrequency,
  centsBetween,
  formatTime,
} from "./pitch-utils.js";
import { Recorder } from "./recorder.js";
import { Timeline } from "./pitch-visualizer.js";
import { Karaoke } from "./karaoke.js";
import { scoreTake } from "./scorer.js";
import {
  listTakes,
  saveTake,
  getTake,
  deleteTake,
  getStorageStatus,
} from "./storage.js";
import {
  esc,
  url,
  header,
  footer,
  dateLabel,
  storageDescription,
} from "./ui.js";

const app = document.querySelector("#app");
const $ = (id) => document.getElementById(id);
let song, player, detector, recorder, timeline, karaoke, reviewTimeline;
let micOn = false,
  micPending = false,
  recording = false,
  recordPending = false,
  finishing = false,
  latest = null,
  samples = [],
  pass = 0,
  a = null,
  b = null,
  loopOn = false;
let takeStart = 0,
  takeSongStart = 0,
  takeSpeed = 1,
  segments = [],
  segment = null,
  recordSamples = [],
  selectedTake = null,
  voiceURL = null,
  reviewMode = "voice",
  frame = 0,
  lastSample = 0;
let transportLocked = false,
  reviewStarting = false,
  reviewGeneration = 0,
  lastDisplay = 0,
  freeStart = performance.now(),
  fileGeneration = 0,
  active = true;
const generic = () => song?.id === "generic";
const scorable = () =>
  ["verified", "original"].includes(song.melodyStatus) &&
  song.notes.some((n) => Number.isFinite(n.midi));
function message(text, error = false) {
  $("message").textContent = text;
  $("message").classList.toggle("error", error);
}
function targetAt(time) {
  if (!scorable()) return undefined;
  return song.notes.find(
    (n) => time >= n.start && time < n.end && Number.isFinite(n.midi),
  );
}
function now() {
  return generic()
    ? (performance.now() - freeStart) / 1000
    : player.currentTime;
}
function updateNote() {
  const target = targetAt(now());
  $("target-note").textContent = target
    ? midiToNote(target.midi)
    : scorable()
      ? "Rest"
      : "Free pitch";
  if (!latest) {
    $("detected-note").textContent = "—";
    $("pitch-details").textContent = micOn
      ? "Listening for your voice"
      : "Microphone is off";
    $("pitch-state").textContent = micOn
      ? "Sing a comfortable, steady note"
      : "Enable your microphone to begin";
    $("meter-marker").hidden = true;
    return;
  }
  const cents = target
    ? centsBetween(
        latest.frequency,
        midiToFrequency(target.midi, detector.referencePitch),
      )
    : latest.cents;
  $("detected-note").textContent = latest.note;
  $("pitch-details").textContent =
    `${latest.frequency.toFixed(1)} Hz · ${cents >= 0 ? "+" : ""}${Math.round(cents)} cents`;
  $("pitch-state").textContent =
    Math.abs(cents) <= 15
      ? "In tune"
      : cents < 0
        ? "Low · lift your pitch"
        : "High · ease your pitch down";
  $("meter-marker").hidden = false;
  $("meter-marker").style.left = `${50 + Math.max(-50, Math.min(50, cents))}%`;
  $("meter-track").setAttribute(
    "aria-valuenow",
    String(Math.round(Math.max(-50, Math.min(50, cents)))),
  );
  $("meter-track").setAttribute(
    "aria-valuetext",
    `${Math.round(cents)} cents ${target ? "from target" : "from nearest note"}`,
  );
}
function render() {
  app.setAttribute("aria-busy", "false");
  app.innerHTML = `${header(generic() ? "generic" : "songs")}<main id="main" class="shell trainer ${generic() ? "generic" : ""}"><div class="trainer-head"><div><a class="breadcrumb" href="${url("")}">← Your practice room</a><h1>${esc(song.title)}</h1><p>${esc(song.artist || "Find your pitch. Take your time.")}</p></div><div class="row"><span class="badge" id="analysis-mode">${scorable() ? "Target melody" : "Free Pitch"}</span><button id="mic-toggle">Enable microphone</button><span class="status-tag" id="mic-state" role="status">Microphone off</span></div></div><div id="message" class="notice" role="status" aria-live="polite">${generic() ? "Sing a single note to see your pitch. Use headphones if other audio is playing." : "Choose your audio file to begin. Use headphones so the microphone hears your voice."}</div><div class="workspace"><section class="panel tuner-panel" aria-label="Live pitch tuner"><div class="panel-label"><span>Your voice</span><span id="confidence">Waiting</span></div><div><div class="pitch-note mono" id="detected-note">—</div><div class="pitch-details mono" id="pitch-details">Microphone is off</div><div class="pitch-state" id="pitch-state">Enable your microphone to begin</div></div><div class="tuner-right"><div class="meter"><div class="meter-track" id="meter-track" role="meter" aria-label="Pitch deviation in cents" aria-valuemin="-50" aria-valuemax="50" aria-valuenow="0"><span class="meter-marker" id="meter-marker" hidden></span></div><div class="meter-labels"><span>−50 · LOW</span><span>0</span><span>HIGH · +50</span></div></div><div class="target-row"><span id="target-label">${scorable() ? "Target note" : "Analysis mode"}</span><strong id="target-note">Free pitch</strong></div></div><label class="reference-row">Reference A4 <input id="reference" type="number" min="400" max="480" step="1" value="${song.referencePitch}" aria-label="Reference A4 frequency"> Hz</label></section><div class="analysis"><section class="panel graph-panel" aria-labelledby="graph-heading"><div class="graph-title"><h2 id="graph-heading">Pitch timeline</h2><div class="legend"><span><i class="target"></i>Target</span><span><i class="voice"></i>Your voice</span></div></div><canvas id="timeline" class="timeline" role="img" aria-label="Pitch over time; target notes are bars and your voice is a line"></canvas><p class="graph-caption" id="graph-caption">${scorable() ? "Follow the notes. Gaps are rests; the vertical line is now." : "Your recent pitch trace. Add a verified melody map to compare with target notes."}</p></section><section class="panel lyrics-panel" aria-label="Synchronized lyrics"><div id="lyrics"></div></section></div></div><section class="panel transport" aria-label="Backing track player" ${generic() ? "hidden" : ""}><div class="audio-setup"><div><h2 id="audio-name">Choose your audio file to begin</h2><p id="audio-info">Files stay in your browser. Nothing is uploaded.</p></div><label class="button file-button">Select audio file<input id="audio-file" type="file" accept="audio/*" aria-label="Select local song audio"></label></div><audio id="backing" preload="metadata"></audio><div class="seek-row"><span id="current-time" class="mono">0:00</span><input id="seek" type="range" min="0" max="1" step="0.01" value="0" aria-label="Seek backing track" disabled><span id="duration" class="mono">0:00</span></div><div class="transport-controls"><div class="play-group"><button id="back" aria-label="Back 5 seconds" disabled>−5s</button><button id="play" class="primary play" disabled>Play</button><button id="forward" aria-label="Forward 5 seconds" disabled>+5s</button></div><div class="player-options"><label class="compact-field">Speed<select id="speed" aria-label="Playback speed"><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1" selected>1.0×</option></select></label><label class="compact-field">Volume<input id="volume" type="range" min="0" max="1" step="0.01" value="0.7" aria-label="Backing track volume"></label></div></div><div class="loop-controls"><div class="row"><button id="set-a" disabled>Set A</button><button id="set-b" disabled>Set B</button><button id="loop-toggle" aria-pressed="false" disabled>Loop off</button><button id="clear-loop" disabled>Clear</button></div><span id="loop-points" class="loop-points mono">A — : — · B — : —</span></div><div id="segments" class="segments" hidden></div><p class="keyboard-help"><kbd>Space</kbd> play / pause · <kbd>←</kbd> <kbd>→</kbd> seek 5 seconds · shortcuts work outside form controls.</p><p class="error-inline" id="player-error" role="alert"></p></section><div class="session-area"><section class="panel record-panel" aria-labelledby="record-heading"><h2 id="record-heading">Hear your progress</h2><p>Record a take, then listen to your voice on its own or alongside the backing track.</p><div class="row"><button id="record" class="primary">Record take</button><button id="finish" disabled>Finish take</button></div><div class="record-indicator" id="record-indicator"><i class="dot"></i><span id="record-status">Ready when you are</span></div><p id="record-error" class="error-inline" role="alert"></p></section><section class="panel map-panel" ${generic() ? "hidden" : ""}><h2>${scorable() ? "Melody map loaded" : "Make the song yours"}</h2><p id="map-status">${scorable() ? "Target notes and timed lyrics are ready for this exercise." : "This song’s melody map is pending. Use Free Pitch now, or import a verified note map to unlock scoring."}</p><label class="button quiet file-button">Import melody JSON<input id="map-file" type="file" accept="application/json,.json" aria-label="Import target melody map"></label> <a class="button quiet" style="margin-top:16px;font-size:.85rem" href="${url("tools/song-editor/")}">Open map editor ↗</a><p id="map-error" class="error-inline" role="alert"></p></section></div><section class="review" id="review" hidden aria-labelledby="review-heading"><div class="review-top"><div><h2 id="review-heading">Your take</h2><p id="review-date" class="small muted"></p></div><button id="another" class="quiet">Start another take</button></div><p id="review-reason" class="notice"></p><div class="metric-grid" id="metrics"></div><audio id="voice-playback" controls preload="metadata" aria-label="Recorded voice playback"></audio><div class="review-controls"><button id="play-voice">Play my voice</button><button id="play-backing" ${generic() ? "hidden" : ""}>Play backing track</button><button id="play-both" ${generic() ? "hidden" : ""}>Play both</button><button id="stop-review">Stop playback</button><a id="download" class="button quiet" download="vocal-take.webm">Download voice</a><button id="delete-take" class="quiet danger">Delete take</button></div><p id="review-error" class="error-inline" role="alert"></p><canvas id="review-timeline" class="timeline" role="img" aria-label="Recorded take pitch timeline"></canvas><label class="field">Explore take timeline<input id="review-seek" type="range" min="0" max="1" step="0.05" value="0" aria-label="Explore recorded pitch timeline"></label><p id="review-position" class="small muted"></p><ul id="hotspots" class="hotspots"></ul><p class="privacy-note">Scores describe pitch practice. They don’t measure expression, tone, or the quality of your voice.</p></section><section class="review-history" aria-labelledby="history-heading"><div class="section-heading"><h2 id="history-heading">Your takes</h2><span class="small muted" id="take-count"></span></div><ul id="take-history" class="take-list"></ul><p class="history-note" id="storage-status"></p></section>${footer()}</main>`;
}
async function enableMic() {
  if (micOn && detector.context?.state === "running") return true;
  if (micPending) return false;
  micPending = true;
  $("mic-toggle").disabled = true;
  $("mic-state").textContent = "Waiting for permission…";
  try {
    await detector.start();
    if (!active) {
      detector.stop();
      return false;
    }
    micOn = true;
    freeStart = performance.now();
    $("mic-toggle").textContent = "Microphone off";
    $("mic-state").textContent = "Microphone on";
    message(
      generic()
        ? "Listening. Sing one note at a time."
        : "Listening to your voice. Headphones help keep the backing track out of your microphone.",
    );
    return true;
  } catch (e) {
    message(e.message, true);
    $("mic-state").textContent = "Microphone unavailable";
    return false;
  } finally {
    micPending = false;
    $("mic-toggle").disabled = false;
  }
}
function disableMic() {
  detector.stop();
  micOn = false;
  latest = null;
  $("mic-toggle").textContent = "Enable microphone";
  $("mic-state").textContent = "Microphone off";
  updateNote();
}
function markSegment() {
  if (!recording) return;
  const elapsed = (performance.now() - takeStart) / 1000;
  if (segment) {
    segment.recordEnd = elapsed;
  }
  segment = {
    recordStart: elapsed,
    recordEnd: elapsed,
    songStart: now(),
    speed: player.audio.playbackRate,
    playing: generic() ? false : !player.paused,
    pass,
  };
  segments.push(segment);
}
function syncButtons() {
  const ready = player.ready;
  ["play", "back", "forward", "seek", "set-a", "set-b", "clear-loop"].forEach(
    (id) => {
      $(id).disabled = !ready || transportLocked;
    },
  );
  $("loop-toggle").disabled =
    !ready || !(a !== null && b !== null && b > a) || transportLocked;
  $("play").textContent = player.paused ? "Play" : "Pause";
  $("record").disabled =
    recording || recordPending || finishing || (!generic() && !ready);
  $("finish").disabled = !recording || finishing;
  $("audio-file").disabled = recording || recordPending || finishing;
  $("map-file").disabled = recording || recordPending || finishing;
  $("reference").disabled = recording || recordPending || finishing;
  $("speed").disabled = transportLocked;
  $("mic-toggle").disabled =
    recording || micPending || recordPending || finishing;
  $("review").inert = recording || recordPending || finishing;
}
function updateLoop() {
  if (a !== null && b !== null && b > a) player.setLoop(a, b, loopOn);
  else player.clearLoop();
  $("loop-toggle").textContent = loopOn ? "Loop on" : "Loop off";
  $("loop-toggle").setAttribute("aria-pressed", String(loopOn));
  $("loop-points").textContent =
    `A ${a === null ? "— : —" : formatTime(a)} · B ${b === null ? "— : —" : formatTime(b)}`;
  syncButtons();
}
async function startTake() {
  if (recording || recordPending || finishing) return;
  recordPending = true;
  stopReview();
  syncButtons();
  try {
    if (!(await enableMic())) return;
    recordSamples = [];
    segments = [];
    pass++;
    takeSongStart = now();
    takeSpeed = player.audio.playbackRate;
    if (recorder.supported) recorder.start(detector.stream);
    takeStart = performance.now();
    recording = true;
    markSegment();
    if (!generic()) await player.play();
    $("record-error").textContent = "";
    $("record-indicator").classList.add("active");
    message("Take in progress. Finish when you’re ready to listen back.");
  } catch (e) {
    $("record-error").textContent = e.message;
    if (recording) {
      recorder.cancel();
      recording = false;
      player.pause();
    }
  } finally {
    recordPending = false;
    syncButtons();
  }
}
async function finishTake() {
  if (!recording || finishing) return;
  finishing = true;
  syncButtons();
  const duration = (performance.now() - takeStart) / 1000;
  markSegment();
  segments = segments.filter((s) => s.recordEnd > s.recordStart + 0.001);
  recording = false;
  player.pause();
  try {
    let blob = null;
    try {
      blob = await recorder.stop();
    } catch (e) {
      $("record-error").textContent =
        `Voice recording unavailable: ${e.message}. Pitch history is still saved.`;
    }
    const metrics = scoreTake(recordSamples, song.notes, {
      melodyStatus: song.melodyStatus,
      referencePitch: detector.referencePitch,
    });
    const take = {
      songId: song.id,
      date: new Date().toISOString(),
      duration,
      metrics,
      samples: recordSamples,
      recording: blob,
      startTime: takeSongStart,
      speed: takeSpeed,
      segments,
      notes: song.notes,
      referencePitch: detector.referencePitch,
    };
    const id = await saveTake(take);
    take.id = id;
    await showReview(take);
    await refreshHistory();
    message(
      "Take finished. Listen back and choose one phrase to work on next.",
    );
  } catch (e) {
    message(`Couldn’t save this take: ${e.message}`, true);
  } finally {
    finishing = false;
    $("record-indicator").classList.remove("active");
    $("record-status").textContent = "Ready for another take";
    syncButtons();
  }
}
async function refreshHistory() {
  const takes = (await listTakes(song.id)).sort(
    (x, y) => new Date(y.date) - new Date(x.date),
  );
  $("take-count").textContent =
    `${takes.length} take${takes.length === 1 ? "" : "s"}`;
  $("take-history").innerHTML = takes.length
    ? takes
        .map(
          (t) =>
            `<li class="take-row"><div><strong>${esc(dateLabel(t.date))}</strong><p>${formatTime(t.duration)} · ${Number.isFinite(t.metrics?.overall) ? t.metrics.overall + "% overall" : "Free pitch / insufficient scoring data"}</p></div><button data-take="${esc(t.id)}" class="quiet">Review</button></li>`,
        )
        .join("")
    : '<li class="empty-history">Your recordings and practice results will appear here after a take.</li>';
  $("storage-status").textContent = storageDescription(getStorageStatus());
}
function stopReview() {
  reviewGeneration++;
  reviewStarting = false;
  const voice = $("voice-playback");
  if (voice) voice.pause();
  reviewMode = "voice";
  transportLocked = false;
  if (player) {
    player.pause();
    player.setSpeed(Number($("speed").value));
    updateLoop();
  }
}
async function showReview(take) {
  if (recording) return;
  stopReview();
  selectedTake = take;
  $("review").hidden = false;
  disableMic();
  $("review-date").textContent =
    `${dateLabel(take.date)} · ${formatTime(take.duration)} recorded`;
  const m = take.metrics || {};
  $("review-reason").textContent =
    m.reason ||
    `Target coverage: ${Math.round(m.coverage || 0)}%. Use these results to choose your next practice phrase.`;
  $("metrics").innerHTML = [
    ["Pitch accuracy", m.pitchAccuracy],
    ["Timing", m.timingAccuracy],
    ["Stability", m.stability],
    ["Overall", m.overall],
  ]
    .map(
      ([label, value]) =>
        `<div class="metric"><span>${label}</span><strong class="mono">${Number.isFinite(value) ? Math.round(value) + "%" : "—"}</strong></div>`,
    )
    .join("");
  const voice = $("voice-playback");
  voice.removeAttribute("src");
  voice.load();
  if (voiceURL) {
    URL.revokeObjectURL(voiceURL);
    voiceURL = null;
  }
  if (take.recording?.size) {
    voiceURL = URL.createObjectURL(take.recording);
    voice.src = voiceURL;
    $("download").href = voiceURL;
    $("download").download =
      `${song.id}-${new Date(take.date).toISOString().slice(0, 10)}.${take.recording.type.includes("mp4") ? "m4a" : take.recording.type.includes("ogg") ? "ogg" : "webm"}`;
  }
  voice.hidden = !voiceURL;
  $("download").hidden = !voiceURL;
  $("play-voice").disabled = !voiceURL;
  $("play-both").disabled =
    !voiceURL || !player.ready || !take.segments?.length;
  $("play-backing").disabled = !player.ready;
  $("review-error").textContent = voiceURL
    ? ""
    : "This take has pitch history only. Voice recording was unavailable.";
  reviewTimeline?.destroy();
  reviewTimeline = new Timeline($("review-timeline"));
  reviewTimeline.setNotes(take.notes || []);
  reviewTimeline.setSamples(take.samples || []);
  const max = Math.max(
    take.startTime || 0,
    ...(take.samples || []).map((s) => s.time),
    1,
  );
  $("review-seek").max = max;
  $("review-seek").value = take.startTime || 0;
  drawReview();
  $("hotspots").innerHTML = (m.hotspots || [])
    .map(
      (h) =>
        `<li><strong>${formatTime(h.start)}–${formatTime(h.end)}</strong> · ${esc(h.label || h.type)}${h.detail ? " — " + esc(h.detail) : ""}</li>`,
    )
    .join("");
}
function drawReview() {
  if (!reviewTimeline) return;
  const t = Number($("review-seek").value);
  reviewTimeline.draw(t);
  $("review-position").textContent =
    `Song position ${formatTime(t)}. Use the slider to inspect each phrase.`;
}
function syncReviewBacking() {
  if (reviewMode !== "both" || reviewStarting || !selectedTake) return;
  const voice = $("voice-playback");
  const t = voice.currentTime;
  const seg = selectedTake.segments.find(
    (s) => t >= s.recordStart && t < s.recordEnd,
  );
  if (!seg || !seg.playing || voice.paused) {
    player.pause();
    return;
  }
  const expected = Math.min(
    player.duration,
    seg.songStart + (t - seg.recordStart) * seg.speed,
  );
  player.setSpeed(seg.speed);
  if (Math.abs(player.currentTime - expected) > 0.16) player.seek(expected);
  if (player.paused)
    player.play().catch((e) => {
      reviewMode = "voice";
      $("review-error").textContent = e.message;
    });
  $("review-seek").value = expected;
  drawReview();
}
async function playback(mode) {
  stopReview();
  const generation = reviewGeneration;
  $("review-error").textContent = "";
  const voice = $("voice-playback");
  try {
    if (mode === "backing") {
      player.clearLoop();
      player.seek(selectedTake.startTime || 0);
      player.setSpeed(selectedTake.speed || 1);
      await player.play();
      return;
    }
    if (voice.ended) voice.currentTime = 0;
    reviewMode = mode;
    reviewStarting = true;
    const starts = [];
    if (mode === "both") {
      transportLocked = true;
      player.clearLoop();
      syncButtons();
      const segment = selectedTake.segments.find(
        (s) =>
          voice.currentTime >= s.recordStart && voice.currentTime < s.recordEnd,
      );
      if (segment?.playing) {
        player.seek(
          segment.songStart +
            (voice.currentTime - segment.recordStart) * segment.speed,
        );
        player.setSpeed(segment.speed);
        starts.push(player.play());
      }
    }
    starts.push(voice.play());
    await Promise.all(starts);
  } catch (e) {
    if (generation === reviewGeneration) {
      $("review-error").textContent = `Playback couldn’t start: ${e.message}`;
      stopReview();
    }
  } finally {
    if (generation === reviewGeneration) reviewStarting = false;
  }
}
function refreshSections() {
  $("segments").hidden = !song.sections.length;
  $("segments").innerHTML = song.sections
    .map(
      (section, i) =>
        `<button data-section="${i}">${esc(section.name || section.title)}</button>`,
    )
    .join("");
}
function bind() {
  player = new AudioPlayer($("backing"));
  player.setVolume(0.7);
  recorder = new Recorder();
  detector = new PitchDetector({
    referencePitch: song.referencePitch,
    onPitch: (value) => {
      latest = value;
    },
    onStatus: (text) => {
      $("mic-state").textContent = text;
      if (micOn && !detector.running) {
        micOn = false;
        latest = null;
        $("mic-toggle").textContent = "Enable microphone";
        if (recording) finishTake();
      }
      if (text.includes("disconnected")) message(text, true);
      if (detector.context?.state === "suspended") {
        $("mic-toggle").textContent = "Resume microphone";
      }
    },
  });
  timeline = new Timeline($("timeline"));
  timeline.setNotes(song.notes);
  karaoke = new Karaoke($("lyrics"));
  karaoke.setLyrics(song.lyrics);
  $("mic-toggle").addEventListener("click", () => {
    if (micOn && detector.context?.state === "running") disableMic();
    else enableMic();
  });
  $("reference").addEventListener("change", () => {
    const value = Number($("reference").value);
    if (Number.isFinite(value) && value >= 400 && value <= 480) {
      detector.referencePitch = value;
    } else {
      $("reference").value = detector.referencePitch;
      message("Choose a reference between 400 and 480 Hz.", true);
    }
  });
  $("audio-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const generation = ++fileGeneration;
    stopReview();
    player.pause();
    message("Loading your local audio…");
    try {
      await player.loadFile(file);
      if (generation !== fileGeneration) return;
      $("audio-name").textContent = file.name;
      $("audio-info").textContent =
        "Local file · available while this page stays open";
      a = b = null;
      loopOn = false;
      updateLoop();
      samples = [];
      pass++;
      timeline.setSamples(samples);
      message(
        "Audio ready. Enable your microphone to practice, or record a take.",
      );
    } catch (error) {
      message(error.message, true);
    } finally {
      syncButtons();
    }
  });
  $("play").addEventListener("click", () => {
    if (!player.paused) player.pause();
    else player.play().catch((e) => message(e.message, true));
  });
  $("back").addEventListener("click", () => player.skip(-5));
  $("forward").addEventListener("click", () => player.skip(5));
  $("seek").addEventListener("input", () =>
    player.seek(Number($("seek").value)),
  );
  $("speed").addEventListener("change", () => {
    markSegment();
    player.setSpeed(Number($("speed").value));
    markSegment();
  });
  $("volume").addEventListener("input", () =>
    player.setVolume(Number($("volume").value)),
  );
  $("set-a").addEventListener("click", () => {
    a = player.currentTime;
    if (b !== null && b <= a + 0.2) {
      b = null;
      loopOn = false;
    }
    updateLoop();
  });
  $("set-b").addEventListener("click", () => {
    const point = player.currentTime;
    if (a === null) {
      message("Set A at the beginning of your phrase first.", true);
      return;
    }
    if (point <= a + 0.2) {
      message("Set B at least 0.2 seconds after A.", true);
      return;
    }
    b = point;
    updateLoop();
  });
  $("loop-toggle").addEventListener("click", () => {
    loopOn = !loopOn;
    updateLoop();
  });
  $("clear-loop").addEventListener("click", () => {
    a = b = null;
    loopOn = false;
    player.clearLoop();
    updateLoop();
  });
  player.addEventListener("seek", () => {
    pass++;
    markSegment();
  });
  player.addEventListener("loop", () => {
    pass++;
    markSegment();
  });
  for (const event of [
    "play",
    "pause",
    "ended",
    "loadedmetadata",
    "durationchange",
  ])
    player.audio.addEventListener(event, () => {
      markSegment();
      syncButtons();
      if (event === "ended" && recording && !loopOn) finishTake();
    });
  player.audio.addEventListener("error", () => {
    $("player-error").textContent =
      "This audio cannot be decoded. Try an MP3, WAV, or AAC file supported by your browser.";
    syncButtons();
  });
  player.addEventListener("loaded", () => {
    $("player-error").textContent = "";
    syncButtons();
    if (selectedTake) {
      $("play-backing").disabled = false;
      $("play-both").disabled = !voiceURL || !selectedTake.segments?.length;
    }
  });
  $("record").addEventListener("click", startTake);
  $("finish").addEventListener("click", finishTake);
  recorder.addEventListener("interrupted", () => {
    if (recording) finishTake();
  });
  recorder.addEventListener("error", (e) => {
    $("record-error").textContent =
      e.detail?.error?.message ||
      "Recording interrupted. Available pitch history will be saved.";
    if (recording) finishTake();
  });
  if (!recorder.supported) {
    $("record").textContent = "Start pitch take";
    $("record-error").textContent =
      "Voice recording is unavailable in this browser. Pitch analysis and local practice history still work.";
  }
  $("map-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 2_000_000)
        throw new Error("Choose a JSON file smaller than 2 MB.");
      const imported = JSON.parse(await file.text());
      if (!Array.isArray(imported.notes))
        throw new Error("The file must contain a notes array.");
      song = validateSong({
        ...song,
        ...imported,
        id: song.id,
        title: song.title,
        artist: song.artist,
        audioMode: song.audioMode,
        audioSrc: song.audioSrc,
        melodyStatus: imported.melodyStatus || "draft",
      });
      timeline.setNotes(song.notes);
      karaoke.setLyrics(song.lyrics);
      detector.referencePitch = song.referencePitch;
      $("reference").value = song.referencePitch;
      refreshSections();
      $("target-label").textContent = scorable()
        ? "Target note"
        : "Analysis mode";
      $("graph-caption").textContent = scorable()
        ? "Follow the notes. Gaps are rests; the vertical line is now."
        : "Draft preview. Scores are off until the melody is verified.";
      samples = [];
      pass++;
      timeline.setSamples(samples);
      $("analysis-mode").textContent = scorable()
        ? "Target melody"
        : "Free Pitch";
      $("map-status").textContent = scorable()
        ? `${song.notes.length} intervals loaded for this session. Confirm the audio version and timing before practicing.`
        : "Map loaded as draft. Set melodyStatus to verified after checking every note and its timing to enable scores.";
      $("map-error").textContent = "";
      message("Melody map imported for this page session.");
    } catch (error) {
      $("map-error").textContent = error.message;
    } finally {
      e.target.value = "";
    }
  });
  refreshSections();
  $("segments").addEventListener("click", (e) => {
    const button = e.target.closest("[data-section]");
    if (!button || transportLocked) return;
    const sec = song.sections[Number(button.dataset.section)];
    if (sec.end > player.duration) {
      message(
        "This section is outside the loaded audio. Check the track version.",
        true,
      );
      return;
    }
    a = sec.start;
    b = sec.end;
    loopOn = true;
    updateLoop();
    player.seek(a);
  });
  $("take-history").addEventListener("click", async (e) => {
    const button = e.target.closest("[data-take]");
    if (!button || recording || recordPending || finishing) return;
    try {
      const take = await getTake(button.dataset.take);
      if (take) {
        await showReview(take);
        $("review").scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (error) {
      message(error.message, true);
    }
  });
  $("another").addEventListener("click", () => {
    stopReview();
    $("review").hidden = true;
    $("record").focus();
  });
  $("play-voice").addEventListener("click", () => playback("voice"));
  $("play-backing").addEventListener("click", () => playback("backing"));
  $("play-both").addEventListener("click", () => playback("both"));
  $("stop-review").addEventListener("click", stopReview);
  $("voice-playback").addEventListener("timeupdate", syncReviewBacking);
  $("voice-playback").addEventListener("seeking", syncReviewBacking);
  $("voice-playback").addEventListener("pause", () => {
    if (reviewMode === "both") player.pause();
  });
  $("voice-playback").addEventListener("play", syncReviewBacking);
  $("voice-playback").addEventListener("ended", stopReview);
  $("review-seek").addEventListener("input", drawReview);
  $("delete-take").addEventListener("click", async () => {
    if (!selectedTake) return;
    try {
      const id = selectedTake.id;
      stopReview();
      await deleteTake(id);
      selectedTake = null;
      $("review").hidden = true;
      const voice = $("voice-playback");
      voice.removeAttribute("src");
      voice.load();
      if (voiceURL) {
        URL.revokeObjectURL(voiceURL);
        voiceURL = null;
      }
      await refreshHistory();
      message("Take deleted from this device.");
    } catch (error) {
      $("review-error").textContent = error.message;
    }
  });
  document.addEventListener("keydown", (e) => {
    if (
      e.defaultPrevented ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      e.shiftKey ||
      e.repeat ||
      transportLocked ||
      e.target.closest(
        "input,select,textarea,button,a,audio,[contenteditable]",
      ) ||
      !player.ready
    )
      return;
    if (e.code === "Space") {
      e.preventDefault();
      $("play").click();
    } else if (e.code === "ArrowLeft") {
      e.preventDefault();
      player.skip(-5);
    } else if (e.code === "ArrowRight") {
      e.preventDefault();
      player.skip(5);
    }
  });
  window.addEventListener("pagehide", () => {
    active = false;
    cancelAnimationFrame(frame);
    recorder.cancel();
    detector.stop();
    player.destroy();
    timeline.destroy();
    reviewTimeline?.destroy();
    if (voiceURL) URL.revokeObjectURL(voiceURL);
  });
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) location.reload();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (reviewMode === "both" || !$("voice-playback").paused) stopReview();
      player.pause();
      if (recording) finishTake();
    } else {
      pass++;
    }
  });
  window.addEventListener("beforeunload", (e) => {
    if (recording) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  syncButtons();
  tick(performance.now());
}
function tick(ts) {
  if (!active) return;
  frame = requestAnimationFrame(tick);
  if (ts - lastSample >= 50) {
    lastSample = ts;
    const time = now();
    if (micOn && (generic() || !player.paused)) {
      const sample = {
        time,
        midi: latest?.midi ?? null,
        frequency: latest?.frequency ?? null,
        confidence: latest?.confidence ?? 0,
        pass,
      };
      samples.push(sample);
      if (samples.length > 12000) samples.splice(0, samples.length - 12000);
      timeline.push(sample);
      if (recording)
        recordSamples.push({ ...sample, recordTime: (ts - takeStart) / 1000 });
    } else if (recording) {
      recordSamples.push({
        time,
        midi: null,
        frequency: null,
        confidence: 0,
        pass,
        recordTime: (ts - takeStart) / 1000,
      });
    }
    timeline.draw(time);
    karaoke.update(time);
    syncReviewBacking();
  }
  if (ts - lastDisplay < 100) return;
  lastDisplay = ts;
  updateNote();
  $("confidence").textContent = latest
    ? "Voice detected"
    : micOn
      ? "Listening"
      : "Waiting";
  $("current-time").textContent = formatTime(player.currentTime);
  $("duration").textContent = formatTime(player.duration || 0);
  $("seek").max = Math.max(1, player.duration || 0);
  $("seek").value = player.currentTime;
  if (recording) {
    $("record-status").textContent =
      `${recorder.supported ? "Recording" : "Analyzing"} · ${formatTime((ts - takeStart) / 1000)}`;
    if (ts - takeStart > 900000) finishTake();
  }
}
async function init() {
  song = await loadSong(document.body.dataset.song);
  render();
  bind();
  await refreshHistory();
  if (song.audioMode === "repository" && song.audioSrc) {
    try {
      await player.loadSource(new URL(song.audioSrc, BASE_URL).href);
      $("audio-name").textContent = song.title;
      $("audio-info").textContent =
        `Repository audio · ${formatTime(player.duration)} · ready to practice`;
      message(
        "Audio ready. Play to hear the melody, then record a take using headphones.",
      );
    } catch (e) {
      message(e.message, true);
    }
    syncButtons();
  }
  if (location.hash.startsWith("#take=")) {
    const take = await getTake(decodeURIComponent(location.hash.slice(6)));
    if (take?.songId === song.id) await showReview(take);
  }
}
init().catch((e) => {
  app.setAttribute("aria-busy", "false");
  app.innerHTML = `${header()}<main id="main" class="shell" style="padding-top:40px"><h1>Practice couldn’t load.</h1><p class="notice error" style="margin-top:20px">${esc(e.message)}</p><a class="button" style="margin-top:20px" href="${url("")}">Back to songs</a>${footer()}</main>`;
});
