/** Shared, strict boundary for bundled packages and locally imported note maps. */
export const BASE_URL = new URL("../", import.meta.url);

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MELODY_STATUSES = new Set([
  "pending-transcription",
  "original",
  "verified",
  "user-supplied",
  "draft",
  "free-pitch",
]);
const LYRICS_STATUSES = new Set([
  "not-included-copyright",
  "original",
  "user-supplied",
  "verified",
  "none",
]);
const ACCENTS = new Set(["amber", "rose", "violet", "mint"]);
const MAX_EVENTS = 20000;

function object(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${name} must be an object.`);
  return value;
}

function text(value, name, max = 160, allowEmpty = false) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (!allowEmpty && !value.trim())
  ) {
    throw new Error(
      `${name} must be ${allowEmpty ? "text" : "nonempty text"} of at most ${max} characters.`,
    );
  }
  return value.trim();
}

function seconds(value, name) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 86400
  ) {
    throw new Error(
      `${name} must be a finite time between 0 and 86400 seconds.`,
    );
  }
  return value;
}

function midi(value, name) {
  if (!Number.isInteger(value) || value < 0 || value > 127)
    throw new Error(`${name} must be an integer MIDI pitch from 0 to 127.`);
  return value;
}

function intervals(value, name, normalize) {
  if (!Array.isArray(value) || value.length > MAX_EVENTS)
    throw new Error(
      `${name} must be an array with at most ${MAX_EVENTS} entries.`,
    );
  let previousEnd = -1;
  return value.map((raw, index) => {
    const entry = object(raw, `${name}[${index}]`);
    const start = seconds(entry.start, `${name}[${index}].start`);
    const end = seconds(entry.end, `${name}[${index}].end`);
    if (end <= start)
      throw new Error(`${name}[${index}] must end after it starts.`);
    if (start < previousEnd)
      throw new Error(
        `${name} must be in time order without overlapping intervals.`,
      );
    previousEnd = end;
    return normalize(entry, { start, end }, index);
  });
}

function status(value, allowed, fallback, name) {
  const result = value ?? fallback;
  if (!allowed.has(result))
    throw new Error(`${name} is not a supported status.`);
  return result;
}

function localAsset(value) {
  const path = text(value, "audioSrc", 300);
  if (
    !/^[a-zA-Z0-9._/-]+$/.test(path) ||
    path.startsWith("/") ||
    path.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error(
      "audioSrc must be a relative repository asset path inside /tuner/.",
    );
  }
  return path;
}

/** Return only supported properties. All lyric text must be rendered with textContent. */
export function validateSong(input) {
  const value = object(input, "Song");
  if (value.schemaVersion !== undefined && value.schemaVersion !== 1)
    throw new Error("Only song schemaVersion 1 is supported.");
  const id = text(value.id, "id", 80);
  if (!SLUG.test(id))
    throw new Error("id must be a lowercase URL-safe song slug.");
  const audioMode = value.audioMode ?? "local-file";
  if (!["local-file", "repository"].includes(audioMode))
    throw new Error("audioMode must be local-file or repository.");
  const referencePitch = value.referencePitch ?? 440;
  if (
    typeof referencePitch !== "number" ||
    !Number.isFinite(referencePitch) ||
    referencePitch < 400 ||
    referencePitch > 480
  ) {
    throw new Error("referencePitch must be between 400 and 480 Hz.");
  }
  const notes = intervals(value.notes ?? [], "notes", (entry, times) => {
    if (
      entry.type !== undefined &&
      !["note", "rest", "unvoiced"].includes(entry.type)
    )
      throw new Error("note.type must be note, rest, or unvoiced.");
    const pitch =
      entry.midi === null || entry.type === "rest" || entry.type === "unvoiced"
        ? null
        : midi(entry.midi, "note.midi");
    return {
      ...times,
      midi: pitch,
      ...(entry.note === undefined
        ? {}
        : { note: text(entry.note, "note.note", 12) }),
    };
  });
  const lyrics = intervals(value.lyrics ?? [], "lyrics", (entry, times) => {
    const result = {
      ...times,
      text: text(entry.text, "lyric.text", 500, true),
    };
    if (entry.words !== undefined) {
      result.words = intervals(
        entry.words,
        "lyric.words",
        (word, wordTimes) => {
          if (wordTimes.start < times.start || wordTimes.end > times.end)
            throw new Error("Word timings must stay inside their lyric line.");
          return {
            ...wordTimes,
            text: text(word.text, "word.text", 100, true),
          };
        },
      );
    }
    return result;
  });
  const sections = intervals(
    value.sections ?? [],
    "sections",
    (entry, times) => ({
      ...times,
      name: text(entry.name ?? entry.title, "section.name", 80),
    }),
  );
  let range = null;
  if (value.range != null) {
    const source = object(value.range, "range");
    range = {
      low: midi(source.low, "range.low"),
      high: midi(source.high, "range.high"),
    };
    if (range.low > range.high)
      throw new Error("range.low cannot exceed range.high.");
  }
  const result = {
    schemaVersion: 1,
    id,
    title: text(value.title, "title"),
    artist: text(value.artist ?? "", "artist", 160, true),
    difficulty:
      value.difficulty == null
        ? null
        : text(value.difficulty, "difficulty", 60),
    range,
    audioMode,
    melodyStatus: status(
      value.melodyStatus,
      MELODY_STATUSES,
      "pending-transcription",
      "melodyStatus",
    ),
    lyricsStatus: status(
      value.lyricsStatus,
      LYRICS_STATUSES,
      "not-included-copyright",
      "lyricsStatus",
    ),
    referencePitch,
    sections,
    lyrics,
    notes,
  };
  if (audioMode === "repository") result.audioSrc = localAsset(value.audioSrc);
  if (value.accent !== undefined) {
    if (!ACCENTS.has(value.accent))
      throw new Error("accent must be amber, rose, violet, or mint.");
    result.accent = value.accent;
  }
  return result;
}

async function readJSON(path) {
  const response = await fetch(new URL(path, BASE_URL));
  if (!response.ok)
    throw new Error(`Could not load ${path} (${response.status}).`);
  const source = await response.text();
  if (source.length > 4_000_000)
    throw new Error("Song data exceeds the 4 MB limit.");
  try {
    return JSON.parse(source);
  } catch {
    throw new Error(`The data in ${path} is not valid JSON.`);
  }
}

export async function loadCatalog() {
  const input = await readJSON("songs/catalog.json");
  if (!Array.isArray(input) || input.length > 1000)
    throw new Error("Song catalog must be an array of at most 1000 songs.");
  const ids = new Set();
  return input.map((raw) => {
    const entry = object(raw, "Catalog entry");
    const id = text(entry.id, "catalog.id", 80);
    if (!SLUG.test(id) || ids.has(id))
      throw new Error("Song catalog IDs must be unique URL-safe slugs.");
    ids.add(id);
    const accent = entry.accent ?? "mint";
    if (!ACCENTS.has(accent))
      throw new Error("Song catalog contains an unknown accent.");
    return {
      id,
      title: text(entry.title, "catalog.title"),
      artist: text(entry.artist ?? "", "catalog.artist", 160, true),
      accent,
    };
  });
}

export async function loadSong(id) {
  if (id === "generic")
    return validateSong({
      id: "generic",
      title: "Generic Tuner",
      artist: "Your voice, in focus",
      melodyStatus: "free-pitch",
      lyricsStatus: "none",
      accent: "mint",
    });
  if (typeof id !== "string" || !SLUG.test(id) || id.length > 80)
    throw new Error("Unknown song route.");
  const song = validateSong(await readJSON(`songs/${id}/song.json`));
  if (song.id !== id)
    throw new Error("Song configuration ID does not match its route.");
  return song;
}
