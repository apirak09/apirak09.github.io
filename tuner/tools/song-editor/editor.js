import {
  BASE_URL,
  loadCatalog,
  loadSong,
  validateSong,
} from "../../js/song-loader.js";
import { esc, header, footer } from "../../js/ui.js";

const $ = (id) => document.getElementById(id);
$("header").innerHTML = header("editor");
$("footer").innerHTML = footer();

const blank = () =>
  validateSong({
    id: "new-song",
    title: "Untitled song",
    artist: "",
    melodyStatus: "draft",
    lyricsStatus: "none",
  });
let song = blank();
let edit = null;
let localAudioURL = null;
let dirty = false;
let audioContext = null;
let packageRequest = 0;
const audio = $("audio");
const pitchName = (pitch) =>
  ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"][
    pitch % 12
  ] +
  (Math.floor(pitch / 12) - 1);

function notice(message, error = false) {
  $("status").textContent = message;
  $("status").classList.toggle("error", error);
}

function revokeAudio() {
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  if (localAudioURL) URL.revokeObjectURL(localAudioURL);
  localAudioURL = null;
}

function cancelEdit() {
  edit = null;
  $("save-interval").textContent = "Add interval";
  $("cancel-edit").hidden = true;
}

function renderRows() {
  for (const type of ["notes", "lyrics"]) {
    const singular = type === "notes" ? "note" : "lyric";
    $(singular + "-rows").innerHTML = song[type]
      .map(
        (entry, index) => `<tr>
      <td class="mono">${entry.start.toFixed(3)}</td><td class="mono">${entry.end.toFixed(3)}</td>
      <td>${type === "notes" ? (entry.midi === null ? "Rest" : `${pitchName(entry.midi)} <span class="muted">(${entry.midi})</span>`) : esc(entry.text)}</td>
      <td><div class="row"><button type="button" class="quiet" data-action="edit" data-type="${type}" data-index="${index}" aria-label="Edit ${singular} ${index + 1}">Edit</button><button type="button" class="quiet danger" data-action="delete" data-type="${type}" data-index="${index}" aria-label="Delete ${singular} ${index + 1}">Delete</button></div></td>
    </tr>`,
      )
      .join("");
    $(singular + "-count").textContent =
      `${song[type].length} ${type === "notes" ? "intervals" : "lines"}`;
    $(type + "-empty").hidden = song[type].length > 0;
  }
}

function setSong(next) {
  song = next;
  $("song-picker").value = [...$("song-picker").options].some(
    (option) => option.value === song.id,
  )
    ? song.id
    : "";
  $("song-id").value = song.id;
  $("song-title").value = song.title;
  $("song-artist").value = song.artist;
  $("reference-pitch").value = song.referencePitch;
  // Every editor session requires an explicit verification acknowledgement.
  $("verified").checked = false;
  cancelEdit();
  renderRows();
  dirty = false;
}

function unverify() {
  dirty = true;
  $("verified").checked = false;
}

function candidate() {
  const voiced = song.notes
    .filter((note) => note.midi !== null)
    .map((note) => note.midi);
  return validateSong({
    ...song,
    id: $("song-id").value.trim(),
    title: $("song-title").value.trim(),
    artist: $("song-artist").value.trim(),
    referencePitch: Number($("reference-pitch").value),
    range: voiced.length
      ? { low: Math.min(...voiced), high: Math.max(...voiced) }
      : null,
    melodyStatus: $("verified").checked ? "verified" : "draft",
    lyricsStatus: song.lyrics.length
      ? "user-supplied"
      : "not-included-copyright",
  });
}

function showType() {
  const isNote = $("interval-type").value === "notes";
  $("note-fields").hidden = !isNote;
  $("lyric-fields").hidden = isNote;
  $("midi").required = isNote && !$("rest").checked;
}

function showPitch() {
  const pitch = Number($("midi").value);
  const resting = $("rest").checked;
  $("midi").disabled = resting;
  $("hear-note").disabled =
    resting || !Number.isInteger(pitch) || pitch < 0 || pitch > 127;
  $("note-label").textContent = resting
    ? "Rest"
    : Number.isInteger(pitch) && pitch >= 0 && pitch <= 127
      ? pitchName(pitch)
      : "—";
  showType();
}

$("interval-type").addEventListener("change", () => {
  cancelEdit();
  showType();
});
$("midi").addEventListener("input", showPitch);
$("rest").addEventListener("change", showPitch);
$("cancel-edit").addEventListener("click", cancelEdit);
for (const id of ["song-id", "song-title", "song-artist", "reference-pitch"])
  $(id).addEventListener("input", unverify);
$("verified").addEventListener("change", () => {
  dirty = true;
});

for (const id of ["mark-start", "mark-end"])
  $(id).addEventListener("click", () => {
    if (!audio.src || !Number.isFinite(audio.duration))
      return notice(
        "Choose audio and wait for it to load before marking a time.",
        true,
      );
    $(id === "mark-start" ? "start" : "end").value =
      audio.currentTime.toFixed(3);
    notice(
      `Marked ${id === "mark-start" ? "start" : "end"} at ${audio.currentTime.toFixed(3)} seconds.`,
    );
  });
$("seek-start").addEventListener("click", () => {
  const start = Number($("start").value);
  if (!audio.src || !Number.isFinite(audio.duration))
    return notice("Choose audio before seeking.", true);
  if (!Number.isFinite(start) || start < 0 || start > audio.duration)
    return notice("Start time must be within the loaded audio.", true);
  audio.currentTime = start;
});
$("speed").addEventListener("change", () => {
  audio.playbackRate = Number($("speed").value);
});
audio.addEventListener("loadedmetadata", () => {
  audio.playbackRate = Number($("speed").value);
});
audio.addEventListener("error", () =>
  notice(
    "This audio could not be played. Try a browser-supported WAV, MP3, or M4A file.",
    true,
  ),
);

$("hear-note").addEventListener("click", async () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass)
      throw new Error("This browser does not support target tone playback.");
    const pitch = Number($("midi").value);
    const reference = Number($("reference-pitch").value);
    if (
      !Number.isInteger(pitch) ||
      pitch < 0 ||
      pitch > 127 ||
      reference < 400 ||
      reference > 480
    )
      throw new Error("Set a valid target pitch and reference first.");
    audioContext ??= new AudioContextClass();
    await audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    oscillator.frequency.value = reference * 2 ** ((pitch - 69) / 12);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.03);
    gain.gain.setValueAtTime(0.12, now + 0.7);
    gain.gain.linearRampToValueAtTime(0, now + 0.8);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.81);
    oscillator.addEventListener(
      "ended",
      () => {
        oscillator.disconnect();
        gain.disconnect();
      },
      { once: true },
    );
  } catch (error) {
    notice(error.message, true);
  }
});

$("audio-file").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  revokeAudio();
  localAudioURL = URL.createObjectURL(file);
  audio.src = localAudioURL;
  song.audioMode = "local-file";
  delete song.audioSrc;
  unverify();
  notice(
    `Loaded ${file.name} locally. Its audio is never included in your JSON export.`,
  );
});

$("interval-form").addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const type = $("interval-type").value;
    const start = Number($("start").value);
    const end = Number($("end").value);
    if (
      audio.src &&
      Number.isFinite(audio.duration) &&
      end > audio.duration + 0.005
    )
      throw new Error("The interval ends after the loaded audio.");
    const entry =
      type === "notes"
        ? {
            start,
            end,
            midi: $("rest").checked ? null : Number($("midi").value),
          }
        : { start, end, text: $("lyric-text").value.trim() };
    if (type === "lyrics" && !entry.text)
      throw new Error("Add a lyric or practice cue first.");
    const entries = [...song[type]];
    if (edit && edit.type === type) entries[edit.index] = entry;
    else entries.push(entry);
    entries.sort((a, b) => a.start - b.start);
    const updated = validateSong({ ...song, [type]: entries });
    const editing = Boolean(edit);
    song = updated;
    unverify();
    cancelEdit();
    renderRows();
    notice(
      `${editing ? "Updated" : "Added"} ${type === "notes" ? "note interval" : "lyric cue"}. Export your map to save it.`,
    );
  } catch (error) {
    notice(error.message, true);
  }
});

for (const type of ["notes", "lyrics"])
  $(type === "notes" ? "note-rows" : "lyric-rows").addEventListener(
    "click",
    (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const index = Number(button.dataset.index);
      const entry = song[type][index];
      if (!entry) return;
      if (button.dataset.action === "delete") {
        song[type].splice(index, 1);
        unverify();
        cancelEdit();
        renderRows();
        notice("Interval deleted. Export to save this change.");
        return;
      }
      edit = { type, index };
      $("interval-type").value = type;
      $("start").value = entry.start;
      $("end").value = entry.end;
      if (type === "notes") {
        $("rest").checked = entry.midi === null;
        $("midi").value = entry.midi ?? 60;
      } else $("lyric-text").value = entry.text;
      $("save-interval").textContent = "Save changes";
      $("cancel-edit").hidden = false;
      showType();
      showPitch();
      $("start").focus();
      notice(
        `Editing ${type === "notes" ? "note" : "lyric cue"} ${index + 1}. Adjust the interval above, then save.`,
      );
    },
  );

async function replaceSong(getSong) {
  if (
    dirty &&
    !window.confirm(
      "Replace this map? Export first if you want to keep your current work.",
    )
  )
    return;
  const request = ++packageRequest;
  try {
    const next = await getSong();
    if (request !== packageRequest) return;
    setSong(next);
    revokeAudio();
    $("audio-file").value = "";
    if (song.audioMode === "repository")
      audio.src = new URL(song.audioSrc, BASE_URL).href;
    notice(
      `Loaded ${song.title}. Check alignment before marking the exported map verified.`,
    );
  } catch (error) {
    if (request === packageRequest) notice(error.message, true);
  }
}

$("song-picker").addEventListener("change", (event) => {
  const id = event.target.value;
  replaceSong(() => (id ? loadSong(id) : blank()));
});
$("new-map").addEventListener("click", () => replaceSong(() => blank()));
$("json-file").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  replaceSong(async () => {
    if (file.size > 4_000_000)
      throw new Error("Song JSON must be smaller than 4 MB.");
    let input;
    try {
      input = JSON.parse(await file.text());
    } catch {
      throw new Error("That file does not contain valid JSON.");
    }
    return validateSong(input);
  });
  event.target.value = "";
});

$("export").addEventListener("click", () => {
  try {
    const output = candidate();
    if (
      output.melodyStatus === "verified" &&
      !output.notes.some((note) => note.midi !== null)
    )
      throw new Error("A verified melody needs at least one voiced note.");
    const blobURL = URL.createObjectURL(
      new Blob([JSON.stringify(output, null, 2) + "\n"], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = blobURL;
    link.download = `${output.id}.song.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobURL), 10000);
    dirty = false;
    notice(
      `Exported ${output.title} as ${output.melodyStatus}. Import it on the matching trainer page to practice.`,
    );
  } catch (error) {
    notice(error.message, true);
  }
});

window.addEventListener("beforeunload", (event) => {
  if (dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) {
    if (localAudioURL) URL.revokeObjectURL(localAudioURL);
    audioContext?.close();
  }
});

loadCatalog()
  .then((catalog) => {
    for (const entry of catalog) {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = `${entry.title} — ${entry.artist}`;
      $("song-picker").append(option);
    }
    $("song-picker").value = [...$("song-picker").options].some(
      (option) => option.value === song.id,
    )
      ? song.id
      : "";
  })
  .catch((error) =>
    notice(
      `The song catalog is unavailable. You can still create and import maps. ${error.message}`,
      true,
    ),
  );
renderRows();
showPitch();
