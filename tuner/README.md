# Vocal Studio

A static vocal practice app for [apirak09.github.io/tuner/](https://apirak09.github.io/tuner/).
One training engine powers every song page: official YouTube video or local
audio playback, live pitch,
timestamped melody targets, synchronized lyric cues, microphone recording,
section loops, and local practice history. No account or backend is required.

## Song data status

| Song                               | Audio                                       | Melody / range / difficulty                                    | Lyrics                            | Available now                                            |
| ---------------------------------- | ------------------------------------------- | -------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------- |
| Let Her Go — Passenger             | Official YouTube video; optional local file | Pending transcription; range and difficulty unknown            | Not included because of copyright | Player, Free Pitch tuner, recorder, loops, local history |
| Perfect — Ed Sheeran               | Official YouTube video; optional local file | Pending transcription; range and difficulty unknown            | Not included because of copyright | Player, Free Pitch tuner, recorder, loops, local history |
| Love Me Not — Ravyn Lenae          | Official YouTube video; optional local file | Pending transcription; range and difficulty unknown            | Not included because of copyright | Player, Free Pitch tuner, recorder, loops, local history |
| Find Your Note — original exercise | Included original 14-second generated WAV   | Complete original C4–A4 map, eight pitched intervals and rests | Original practice cues            | Full target practice and scoring                         |

The three commercial configurations deliberately contain empty notes, lyrics,
and sections. They do not report invented scores, sections, or vocal ranges.
Only `original` or `verified` maps with voiced notes enable scoring. A file
labeled `verified` is a declaration by its creator, not automated verification.

The three videos use the artists' official uploads, played in YouTube's visible
embedded player. No commercial audio file is copied into this repository and
no download or audio extraction is performed. The original demo continues to
use its included WAV. Local files remain optional on every commercial song.

Do not commit commercial studio audio, instrumental tracks, or full lyrics
without explicit permission and usable rights. Selecting a file does not grant
permission to redistribute it. You can practice privately with local audio;
audio and lyrics that you want published must be legally usable for publication.

## Use the app

1. Open a song at `/tuner/let-her-go/`, `/tuner/perfect/`, or `/tuner/love-me-not/`.
2. Choose **Load official video**, then **Play**. No audio file is required.
   Alternatively, choose **Local audio (optional)** to use a track on your device.
3. Use headphones. Enable the microphone and allow the browser's permission prompt.
4. Play, seek, choose an available speed, or mark A and B for a loop. Video
   playback uses YouTube's available rates and seeking precision.
5. Once the song itself is playing, choose **Record take**. Finish the take to
   review your pitch trace and recording. With YouTube, recording stays disabled
   while an ad is playing or content has not started.
6. Replay your voice or backing track; download your voice or delete the take.
   **Play both** is available with local or repository audio. It is disabled
   while a YouTube source is selected, because YouTube's developer policies
   prohibit playing alternate audio tracks over YouTube video content.

The video shares the trainer's playback timeline, pitch trace, and A–B loop
controls. YouTube seeking and loops can be less precise than local playback.
The embedded player retains its native controls, branding, and any ads; its
viewport is at least 200 × 200 pixels. Recordings capture your microphone only,
so headphones help keep the backing track out of the microphone.

YouTube availability depends on the uploader, region, connection, and browser.
The trainer's song clock waits for content playback; YouTube's ad controls stay
visible. Finish an ad or use its standard Skip Ad control when available before
recording. Autoplay restrictions may require clicking the video's Play control.
If embedding is blocked or playback fails, use **Open on
YouTube** or select a local track. Selecting a local file removes the embedded
player and switches the shared timeline back to the local track.

The same local audio stays selected while this page is open. Reloading or
opening another song requires choosing the file again; browsers cannot silently
restore access to an arbitrary file. Imported maps also last for this page
session. Takes use local storage as described below.

Space plays or pauses the backing track; Left / Right seek five seconds. These
shortcuts only run outside form controls, buttons, links, and editable text.
The generic tuner at `/tuner/generic/` works without audio or a melody map.
Reference A4 is adjustable from 400 to 480 Hz, with 440 Hz as the default.

For the included demo, choose **Find Your Note** on the home page. Play once to
hear the guide, then hum each note with headphones. The target pitches are
known because the tone asset is generated directly from its map. Its demo
lyrics are exercise instructions, rather than a transcribed commercial song.

## Architecture

```text
tuner/
  index.html                         Song catalog and practice history
  css/main.css, trainer.css          Shared responsive design
  js/app.js                         Catalog screen
  js/trainer.js                     Shared trainer orchestration
  js/track-player.js                Shared sources and visible YouTube IFrame adapter
  js/audio-player.js                Local / repository audio and A–B loops
  js/pitch-detector.js               YIN detector and microphone lifecycle
  js/pitch-utils.js                  Frequency / MIDI / note / time helpers
  js/pitch-visualizer.js             Canvas target bars and voice trace
  js/karaoke.js                      Previous / current / next timed lyric line
  js/recorder.js                     Feature-detected MediaRecorder
  js/scorer.js                       Honest scores and evidence-based hotspots
  js/storage.js                     IndexedDB takes and fallback storage
  js/song-loader.js                 Catalog loading and schema validation
  js/ui.js                          Shared navigation, escaping, and URL helpers
  songs/catalog.json                Data-driven list of songs
  songs/{id}/song.json               Song package, with no application logic
  songs/{id}/index.html              Optional direct alias route
  {id}/index.html                    Public clean route shell
  generic/index.html                Free tuner route
  demo/vocal-exercise.wav            Original generated audio
  demo/generate.py                   Reproducible standard-library generator
  tools/song-editor/                Local manual note / lyric editor
  tests/                            Node regression tests
```

Every route shell identifies the song using `body[data-song]` and imports the
same `trainer.js`. `BASE_URL` comes from `import.meta.url`, so configuration,
audio, imports, and navigation resolve under `/tuner/` instead of the domain
root. Adding a song does not require editing the tuner, player, or scorer.

`TrackPlayer` delegates local and repository sources to the existing native
audio player and optional `youtubeVideoId` sources to the YouTube IFrame
adapter. Trainer controls consume the same clock and playback events, so a
future song's video source is configured entirely in data. YouTube embedding
requires no API key, account, backend, media proxy, or extraction service.

`loadSong(id)` loads a configuration; `validateSong(input)` is the shared
validation boundary for bundled packages and imports. `loadCatalog()` returns
the catalog array. Other modules are independent of song names. Future MIDI
or MusicXML converters can produce the existing timestamped `notes` format;
version 1 deliberately implements JSON import only.

## Song data schema

```json
{
  "schemaVersion": 1,
  "id": "my-song",
  "title": "My song",
  "artist": "My name",
  "difficulty": null,
  "range": null,
  "audioMode": "local-file",
  "melodyStatus": "pending-transcription",
  "lyricsStatus": "not-included-copyright",
  "referencePitch": 440,
  "sections": [],
  "lyrics": [],
  "notes": []
}
```

| Field                         | Meaning                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `schemaVersion`               | Version 1; other versions are rejected                                                                             |
| `id`                          | Lowercase slug such as `my-song`; must match the package's route                                                   |
| `title`, `artist`             | Display text; never HTML                                                                                           |
| `difficulty`                  | Optional descriptive text; `null` when unverified                                                                  |
| `range`                       | `null`, or `{ "low": 60, "high": 69 }` with integer MIDI bounds                                                    |
| `audioMode`                   | `local-file`, or `repository` for legally usable committed audio                                                   |
| `audioSrc`                    | Required with `repository`; path relative to `/tuner/`, e.g. `demo/vocal-exercise.wav`                             |
| `youtubeVideoId`              | Optional official video ID: exactly 11 characters from `A–Z`, `a–z`, `0–9`, `_`, or `-`; a URL or HTML is rejected |
| `melodyStatus`                | `pending-transcription`, `draft`, `user-supplied`, `verified`, `original`, or `free-pitch`                         |
| `lyricsStatus`                | `not-included-copyright`, `none`, `user-supplied`, `verified`, or `original`                                       |
| `referencePitch`              | A4 frequency, from 400 to 480 Hz                                                                                   |
| `accent`                      | Optional shared card color: `amber`, `rose`, `violet`, or `mint`                                                   |
| `notes`, `lyrics`, `sections` | Time-ordered arrays of non-overlapping intervals within each array                                                 |

Note examples use seconds in the exact backing-track timeline:

```json
{
  "notes": [
    { "start": 0.5, "end": 1.5, "midi": 60, "note": "C4" },
    { "start": 1.5, "end": 2.0, "midi": null },
    { "start": 2.0, "end": 3.0, "midi": 62, "note": "D4" }
  ],
  "lyrics": [
    {
      "start": 0.5,
      "end": 3.0,
      "text": "An original practice cue",
      "words": [{ "start": 0.5, "end": 1.0, "text": "An" }]
    }
  ],
  "sections": [{ "name": "First phrase", "start": 0.5, "end": 3.0 }]
}
```

`midi` is an integer from 0 to 127, or `null` for a rest / unvoiced interval.
The `note` name is optional descriptive text; MIDI is the source of pitch truth.
Unmapped gaps are also unscored. Notes are monophonic and may touch at a
transition, but cannot overlap. End times must exceed start times. Times are
finite, nonnegative, and at most 86,400 seconds. A section uses `name`; a
`title` field is accepted and normalized for imported sections.

Optional word timings are validated and retained inside their parent lyric
line. The engine highlights optional timed words as well as the current line.
The editor edits whole lyric lines and removes existing word timings when a
line is edited. Lyric text is rendered as plain text. No embedded markup runs.
Each event array is capped at 20,000 entries. Repository package loading and
editor import are limited to 4 MB; trainer map import is limited to 2 MB.

`youtubeVideoId` is an optional playback alternative, rather than a new
`audioMode`. Existing `local-file` and `repository` configurations retain
their behavior. For example, add `"youtubeVideoId": "RBumgq5yVrA"` to offer
Passenger's official **Let Her Go** video. Importing a melody map preserves
the current page's song identity and configured audio/video source; imported
JSON cannot replace the page's official video ID.

## HOW TO ADD A NEW SONG

1. Choose a lowercase, URL-safe slug, such as `my-original-song`.
2. Create `tuner/songs/my-original-song/song.json` using the schema above.
3. Add the song to `tuner/songs/catalog.json`:

   ```json
   {
     "id": "my-original-song",
     "title": "My Original Song",
     "artist": "Me",
     "accent": "mint"
   }
   ```

4. Create `tuner/my-original-song/index.html`. Copy an existing public route,
   change the title and `data-song`, and retain its `../css/` and `../js/` paths.
5. Optionally also copy `tuner/songs/my-original-song/index.html` from an
   existing alias route. This route needs `../../css/` and `../../js/` paths.
6. Leave pending data empty and unknown metadata `null`. If including audio,
   confirm your publication rights, set `audioMode` to `repository`, and add
   `audioSrc` relative to `tuner/`. Otherwise use `local-file`. To offer an
   official embedded video, add its verified 11-character `youtubeVideoId`;
   keep either existing `audioMode` for local/repository playback.
7. Validate, open the direct route, and test with the precise audio version.

For example, a public route's essentials are:

```html
<link rel="stylesheet" href="../css/main.css" />
<link rel="stylesheet" href="../css/trainer.css" />
<body data-song="my-original-song">
  <div id="app">Loading your practice space…</div>
  <script type="module" src="../js/trainer.js"></script>
</body>
```

Use a complete HTML document with language, viewport, title, skip link, and
JavaScript-disabled message, as in the existing routes. Add new routes only
inside `tuner/`. No core JavaScript change is needed.

## HOW TO CREATE A TARGET MELODY MAP

1. Pick the exact audio version you will practice with. Establish its tuning
   reference, start offset, and whether it contains extra introductions or cuts.
2. Open `/tuner/tools/song-editor/`. Start from a song package or import a saved
   full song JSON. Choose your local audio; it is never included in the export.
3. Slow playback, listen to a short phrase, and identify the lead vocal's
   fundamental pitch. MIDI 60 is C4; MIDI 69 is A4. **Hear target** auditions a
   reference tone. A piano or trusted transcription helps resolve uncertain notes.
4. Seek to each onset and use **Mark start**. Seek to its release or transition
   and use **Mark end**. Type precise seconds when needed, then add the MIDI pitch.
5. Mark a rest / unvoiced interval for silence, breaths, and nonsung sounds.
   Separate note changes into separate intervals. Do not turn the accompaniment,
   vocal harmonies, or spoken syllables into lead melody targets.
6. Add optional legally usable lyric cues using **Lyric cue**. Original practice
   instructions also work. Keep overlapping syllable text in one line; word data
   can be added manually to JSON later.
7. Export a draft often. The editor's in-progress state is held in this tab;
   exported JSON is your saved working copy.
8. Check every target against the exact audio at normal speed. Review octaves,
   transitions, sustained notes, rests, and alignment. Avoid claiming accuracy
   while any transcription is uncertain or incomplete.
9. Only after checking, tick the explicit verification acknowledgement and
   export again. The editor labels that file `verified`; unchecked exports stay
   `draft`, so they cannot silently produce scores.
10. On the matching song trainer, load the same audio and choose **Import melody
    JSON**. The trainer accepts either a full package or a map object containing
    `notes` plus optional `lyrics`, `sections`, and `melodyStatus`. It preserves
    the page's song identity and audio source. Maps remain in this page session.
11. Practice, inspect the target bars and lyric transitions, and correct the map
    in the editor. When the data is ready for publication, replace that song's
    `song.json`. Public lyrics and audio still require publication rights.

Pitch detection from a mixed commercial recording cannot reliably isolate the
lead melody. This editor is a manual annotation tool; it does not automatically
transcribe uploaded audio. MIDI and MusicXML import are future extension points,
not implemented controls. A future converter should output normalized seconds
and MIDI notes through `validateSong`, with its source's timing checked.

## Pitch detection and visualization

The detector implements the YIN cumulative mean normalized difference method
for monophonic singing. It removes DC offset, gates low-energy signals, finds
the first convincing periodic minimum, and refines the period by parabolic
interpolation. At high hardware sample rates, a short averaging filter reduces
work before analysis. Its frequency range is 55–1400 Hz, with a 0.008 RMS
silence gate, a 0.14 YIN threshold, and confidence of at least 0.86.

An analyser buffer of 4096 hardware samples feeds measurements approximately
20 times per second. A short median filter and adaptive smoothing reduce note
jitter while allowing pitch changes. Poor-confidence frames become unvoiced,
rather than contributing a made-up note. Detected frequency maps to equal
temperament relative to the chosen A4. Target and detected notes, cents, and a
±50-cent meter accompany the Canvas trace. Rest intervals are never pitch targets.

These gates reduce silence and nonperiodic noise, but cannot distinguish your
voice from all other periodic sounds. A loud backing track leaking into the
microphone can produce confident false detections. Headphones matter. The
detector handles one voice; chords, multiple singers, growls, very quiet voices,
and pitches outside its range are less reliable.

## Recording, local data, and privacy

`getUserMedia` is requested on a user action, with audio only. The analyser is
not connected to the speakers, avoiding direct microphone feedback. Permission
denial, no microphone, a busy device, disconnection, and browser limitations
have readable errors and allow the player to continue. Mic access needs HTTPS
or localhost. The app releases the microphone when disabled or leaving the page.

`MediaRecorder` selects a supported WebM / Opus, MP4 / AAC, or Ogg / Opus format.
If voice recording is unavailable, pitch practice and saved pitch history still
work. Recorded microphone audio remains separate from the backing track; the
backing track is never copied into the saved voice file. With local or repository
audio, **Play both** aligns
the voice with its recorded playback segments, including speed, pauses, and
loops, using the currently loaded backing track. It needs the same track version.
Combined voice-and-backing replay is disabled while a YouTube source is
selected; voice-only review and microphone downloads remain available.

IndexedDB database `vocal-trainer-v1`, store `takes`, holds each take's song ID,
date, duration, metric object, detected samples, reference pitch, target map,
playback segments, and optional recorded Blob. A take ID identifies both its
history and voice data. Preferences use localStorage where available. If
IndexedDB is denied, blocked, or runs out of space, new takes fall back to memory
for the current page session. Download a voice recording before closing if
storage is unavailable. Browser data clearing, private browsing, storage
eviction, or moving to another browser/device may remove history.

Audio selection uses `URL.createObjectURL()`; replaced and discarded object
URLs are revoked. No selected file, microphone stream, recording, or map is
uploaded by Vocal Studio. Before **Load official video** is clicked, network
requests load the static app, catalog, bundled song JSON, and original demo
asset only. Local/repository practice never requires YouTube. Loading an
official video explicitly loads YouTube's IFrame API and a privacy-enhanced
`youtube-nocookie.com` embed, which contact Google and YouTube. That mode does
not make the player contact-free; YouTube's own terms and privacy practices
apply. Files, recordings, and imported maps remain local to this browser.

The app adds no analytics, remote fonts, account services, or recording-upload
endpoint. See YouTube's [embedding and privacy-enhanced mode guidance](https://support.google.com/youtube/answer/171780),
[IFrame Player API](https://developers.google.com/youtube/iframe_api_reference),
and [developer policies](https://developers.google.com/youtube/terms/developer-policies)
(including III.I.7 on alternate audio tracks). The embedded service is subject
to the [YouTube Terms of Service](https://www.youtube.com/t/terms) and
[Google Privacy Policy](https://policies.google.com/privacy).

## Scores and performance review

`scoreTake(samples, notes, options)` accepts confidence-bearing samples and a
melody status. It scores only `original` / `verified` maps with voiced targets.
Other takes retain history and traces but have null scores and a reason.
Scoring uses 50 ms bins, ignores rests, and splits loop / seek passes instead
of mixing multiple attempts at the same timestamp. Silent or unreliable bins
within practiced target intervals receive zero pitch credit; silence cannot
raise the score.

Pitch credit is 100 within ±15 cents, falling to 85 at ±30 and 65 at ±50, then
falling to zero at ±150. Timing looks for two consecutive readings within
50 cents of a new note near its onset. Sustained-note stability measures pitch
spread around its median. When all metrics are available, overall weights are
65% pitch, 20% timing, and 15% stability; unavailable metrics are excluded and
remaining weights are normalized.

At least 0.5 seconds of practiced voiced targets and 0.35 seconds of reliable
detected voice are needed to report scores. Timing and stability can remain
unavailable for short, late-starting, or sparse observations. Target coverage
describes detected voice during the practiced target intervals, rather than
completion of the whole song. A partial take is a review of that practiced
section. Hotspots report supported observations such as mostly flat/sharp,
late entry, little voiced pitch, or a steady sustained note.

These measures are practice feedback, not an objective judgment of vocal
quality, timbre, expression, or musical interpretation. Microphone latency,
detector smoothing, browser playback latency, and room sound influence timing.
Version 1 does not perform device latency calibration.

## Browser compatibility and limitations

Prioritize current Chrome / Edge desktop, Chrome Android, and Safari on iPhone
or iPad where the required APIs are present. Features are detected at runtime;
recording format and local storage support vary. Mobile browsers may suspend
audio when backgrounded or the screen locks. The trainer pauses playback and
finishes an active take when its document becomes hidden. Keep the app in the
foreground for practice. A take is capped at 15 minutes to bound memory use.

Safari and mobile browsers may require another user gesture to resume audio;
their volume control can be device-managed. Low playback speeds request pitch
preservation where supported, but quality varies. Some recorded blobs do not
expose an immediate native duration. **Play both** can drift slightly because
the voice and backing track are separate HTML media elements; it corrects
position as playback proceeds. A–B looping is close to the selected boundaries,
rather than sample-accurate seamless audio editing. YouTube rates depend on the
specific video, and its seeks can land near a requested position rather than
on an exact sample. Ads, embedding restrictions, region restrictions, removed
videos, blocked third-party requests, and playback errors can interrupt video
practice. Choose a local file when precise control or offline practice is needed.

There is no automatic transcription, MIDI / MusicXML importer, latency
calibration, offline service worker, cross-device synchronization, or guaranteed
durable storage. The full pitch trace is visual; current note, cents, metric,
and hotspot text provide readable alternatives to its Canvas. Reduced motion,
keyboard focus, labels, and mobile layout are included.

## GitHub Pages deployment and local verification

Keep this folder under the repository's published root and publish using the
repository's existing GitHub Pages setup. No build step is required. Directory
`index.html` files allow direct navigation to:

- `/tuner/`
- `/tuner/let-her-go/`
- `/tuner/perfect/`
- `/tuner/love-me-not/`
- `/tuner/demo-vocal-exercise/`
- `/tuner/generic/`
- `/tuner/tools/song-editor/`

Song folder aliases also work at `/tuner/songs/{id}/`. Do not open the HTML
through `file://`; module loading and microphone security require an HTTP(S)
server. For local development, run `node tuner/tests/serve.mjs` from the
repository root, then open `http://127.0.0.1:4173/tuner/`. This development
server supports audio byte ranges so the repository demo can seek and loop;
a simple server without byte-range support may make streamed WAVs unseekable. Node's built-in test
runner can execute all deterministic regression tests:

```sh
node --test tuner/tests/*.test.mjs
```

The tests exercise pitch and silence filtering, score honesty, target map
validation, media / loop / recorder lifecycle, and local storage fallbacks.
Optional reproducible browser checks live in `tuner/tests/browser-check.mjs`,
`tuner/tests/editor-browser-check.mjs`, and `tuner/tests/stream-browser-check.mjs`.
With Node/npm available, install
the test-only dependencies in `tuner/tests` (`npm install`) and install the
Playwright Chromium test browser (`npx playwright install chromium`). Serve
the repository root on port 4173, then run the scripts from `tuner/tests`:

```sh
node browser-check.mjs
node editor-browser-check.mjs
node stream-browser-check.mjs
```

Use `VOCAL_BASE_URL` for a different preview URL (include `/tuner/` and a
trailing slash), `VOCAL_BROWSER_PATH` for an existing Chrome/Chromium executable,
or `VOCAL_PLAYWRIGHT_PATH` for an existing Playwright module. Setting
`VOCAL_SCREENSHOTS` to a directory saves desktop/mobile previews there. These
dependencies are for development only; the published app requires none.

Browser checks should additionally inspect direct URLs, local audio load and
seek, speeds, lyrics, A–B loops, JSON imports, recording playback, IndexedDB
history, permission rejection, mobile layout, labels, keyboard controls, and
error states. Automated synthetic microphones verify the browser integration;
real singing, hardware disconnection, and Safari / Android device behavior
still need device testing.

Recommended next work: accurately transcribe and verify the three starter
melodies against specific legally usable audio versions; calibrate microphone
latency; then add trusted MIDI import and durable export/import of practice
history. Keep unverified song packages pending until their data is ready.
