# Flappy 2 — Small wings. Strange worlds.

Play: https://apirak09.github.io/flappy2/

An independent, buildless arcade sequel. This directory runs directly on GitHub Pages, with no CDN, package installation, backend, or account. The original `/flappy/` files and saves are untouched.

## Three worlds

- **Moon:** a black lunar sky, a procedural Earth, cratered terrain, an astronaut bird, drifting monolith openings, and exactly one-sixth of Nightmare's game gravity. Gentler flaps have much longer hang time.
- **Nightmare:** preserves the original six-gate → bat arrival → laser/volley swarm → recovery loop. Every point raises speed, tightens future gates, and eventually adds bats, up to eight. Every bat has its own locked sightline and firing time. Volleys share a genuinely clear corridor. Attacks snapshot their warning geometry, and all gates leave before a swarm begins. Speed continues rising after geometric minimums.
- **Hell:** seven separate mechanics, selected randomly without a fixed rotation. Repeats are possible. Survival time increases speed, closes gaps, shortens warnings, and reduces encounter spacing. After 45 seconds, the director can add a compatible secondary sin. It never deliberately schedules a third simultaneous encounter. Gold is an optional risk, not a requirement.

| Sin | Mechanic | Counterplay |
| --- | --- | --- |
| Pride | Crowned towers with a vertically moving aperture | Follow the opening |
| Greed | Three rotating blades guard a bonus coin | Bypass the whole orbit, or take the risk for two bonus points |
| Envy | An echo bird follows recent flight history, then locks its height | Change altitude after its approach |
| Wrath | A horizontal lightning strike locks onto a dashed sightline | Move off the line before it becomes solid |
| Lust | A lethal rose exerts a vertical gravitational pull | Keep distance and compensate with your flaps |
| Gluttony | Living jaws open and close continuously | Time the crossing and leave clearance |
| Sloth | Amber fog increases gravity and weakens the flap | Tap sooner and more frequently |

All normal clears earn one point. Modes have separate records; Hell bonus gold adds two points. Difficulty never forces a timed death. Late play is intentionally difficult; simulations do not establish that every late combination is survivable.

## Controls and layout

- Tap/click the sky, **Space**, or **Up Arrow:** one flap per press. Holding a key does not repeat.
- **P / Escape:** pause or resume, with a protected resume countdown. Escape from the ready screen returns to world selection.
- **R:** retry after a crash. A short input guard prevents accidental immediate restarts.
- **M:** audio. **F:** browser fullscreen where supported.
- Settings include sound, original synthesized ambient music, volume, reduced motion, and graphics detail. Music is off by default; audio starts after interaction.
- World selection supports arrow keys, Home, and End. Pause/results retain focus; native settings/help dialogs protect focus. Records use tabular numerals and controls have visible focus styles.

The Canvas fills the actual viewport in both orientations, including safe-area accommodations for interface controls. Logical height is 720 units; width follows the screen aspect ratio. Wide devices see more world. No forced portrait arena, letterboxing, orientation lock, or stretched collision geometry. Resizing pauses active flight and preserves obstacle distances relative to the bird, including nested rotating blades and projectiles. Browser fullscreen restrictions still apply, particularly on iOS; Home Screen installation is another option.

## Engine and graphics

Physics integrates in slices no larger than 1/120 second. Swept circle/rectangle and moving circle collisions prevent tunneling. Rendered characters are slightly larger than the forgiving hit circle. The renderer draws original procedural worlds and characters at runtime: no downloaded background image or pre-rendered game screenshot. Stars, terrain layers, crater rims, gothic silhouettes, eclipsed sky, lava seams, wing animations, particles, and all seven hazards use Canvas 2D. Resolution is capped by pixel count and device ratio; low-detail mode reduces decorative work without changing physics.

UI uses locally bundled **Chakra Petch** and **Manrope**, under their included SIL Open Font Licenses. The app icon is original `assets/icon.svg`; PNGs are raster exports of that SVG. Design work follows the user-requested [Impeccable skill](https://github.com/pbakaus/impeccable/blob/main/.claude/skills/impeccable/SKILL.md). Its optional remote concept catalog was unreachable; the user's lunar, blood-moon, and seven-sins worlds govern the implementation.

## Saves and offline behavior

Storage is isolated under `apirak-flappy2-v1`; no old Flappy key is read or changed. Saves validate input, keep separate best score/best survival/run count, and degrade to memory when browser storage is blocked. This is a personal device record, not a global leaderboard.

The service worker is scoped to `/flappy2/`. After a successful first online load and cache installation, this game can reopen offline. Updates wait for existing game windows to close, avoiding replacement during a flight. Version changes must update `CACHE` in `sw.js`. Cache cleanup only touches `apirak-flappy2-*` names. The manifest allows either orientation and asks for fullscreen/standalone display.

## Verification

Run from the repository root:

```sh
node --test flappy2/tests/*.test.mjs
```

The Node tests cover physics across 30/60/120 FPS; collision sweeps; separate sin behaviors; truthful laser/volley warnings; pause, resize and retry cleanup; time scaling and randomness; saves; bounded actor counts in 180-second diagnostic Hell runs; sampled-input opening simulations at phone/tablet/desktop widths; and production-app interaction through a DOM adapter. Diagnostic invulnerability in the long-run director test is explicitly marked.

The DOM adapter exercises actual app code and renderer calls but does **not** verify browser layout or native browser APIs. Actual production Canvas frames were separately rendered and visually inspected at desktop, portrait phone, and landscape phone dimensions. Live browser/device QA was unavailable in the authoring environment; Safari/Chrome layout, native fullscreen, audio hardware, installation and offline reopening still need real-device verification. No claim of universal device compatibility is made.

## Files

`engine.mjs` is DOM-independent gameplay; `renderer.mjs` is Canvas graphics; `app.mjs` owns inputs/UI/state/persistence; `audio.mjs` synthesizes the score and cues. `index.html`/`styles.css` provide the interface, `sw.js`/`manifest.webmanifest` offline installation, and `tests/` executable verification.
