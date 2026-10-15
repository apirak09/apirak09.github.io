# Flappy Bird — Sky Club

Play: https://apirak09.github.io/flappy/

A standalone, dependency-free arcade game. This directory can be served as-is by GitHub Pages or any static HTTP server. No build or external CDN is needed. Other games in the repository are independent.

## Controls

- Tap/click the game area, Space, or Up Arrow: one flap.
- P or Escape: pause/resume. Resume includes a short countdown.
- R: retry from the results screen.
- M: toggle all audio. F: fullscreen where supported.
- Select Easy, Normal, Hard, or the red Nightmare card in the menu. Best scores are separate for each mode.
- Settings: sound effects, optional music, volume, reduced motion.

## Difficulty

The logical playfield stays 480 × 680 on every screen; resizing does not change physics or obstacle positions. Canvas resolution follows device pixel ratio, capped at 2 for battery/performance. Physics substeps are no larger than 1/120 second.

| Mode | Pipe speed (units/s) | Gap (units) | Gravity (units/s²) | Flap velocity (units/s) |
| --- | ---: | ---: | ---: | ---: |
| Easy | 150 | 220 | 1160 | -365 |
| Normal | 185 | 182 | 1320 | -385 |
| Hard | 225 | 150 | 1450 | -405 |
| Nightmare | Starts at 300, rises every point | Starts at 112–136, shrinks with score | 1450 | -405 |

Collision checks include the pipe lips, use a forgiving bird hit circle, and award each passed pair only once. Gap centers are bounded and successive height changes are limited. Medals are awarded at 5, 15, 30, and 50 points.

## Nightmare — Endless escalation update

A prominent crimson fourth mode switches the scene to an original Blood Moon landscape, blood-stained metal gates, a darker interface, demon-bat artwork, warning sounds, laser/volley effects, and an optional minor-key soundtrack. Controls remain the same.

Each endless round alternates between:

1. **Six blood gates.** The opening speed is 300 units/s, up from 245. Initial gaps vary from 112 to 136 units and center-to-center spacing from 220 to 276 units. Every point increases speed and reduces the bounds for newly spawned gates. Early height changes retain some recovery allowance; later gates become more aggressive.
2. **Bat arrival.** Every pipe must leave the playfield before bats enter. Arrival time gets shorter as the threat rises. Bats cannot attack among pipes.
3. **An expanding swarm.** Another bat joins every five points, up to eight actual shooters. Each bat has its own locked laser height and staggered firing time, or launches its own column of non-homing bolts through a shared open corridor. Warnings and recovery shrink; beams get wider, bolts get faster, and the corridor narrows. Each room snapshots its wave count on entry, so it can finish even while the threat rises. The first room has five waves; later rooms grow to twelve. All beams or bolts clear before the next wave begins.
4. **Return to gates.** A shortening breather precedes the next set. The first gate starts offscreen; the growing speed keeps reducing the time available to react.

At score `p`, target speed is `300 + 9p + 0.18p²` units/s, approached smoothly after each point. It has no gameplay cap. The HUD shows threat level, current speed multiplier, bat count, and progress through the current room.

| Points | Target speed | Gap range | Gate spacing | Bats | First shot warning |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 300 | 112–136 | 220–276 | 1 | 0.95 s |
| 6 | 360 | 107–130 | 213–268 | 2 | 0.81 s |
| 12 | 434 | 102–125 | 207–259 | 3 | 0.71 s |
| 24 | 620 | 92–113 | 194–242 | 5 | 0.57 s |
| 36 | 857 | 81–102 | 180–226 | 8 | 0.47 s |

Late play intentionally becomes overwhelming. There is no timer that forces a loss: pipes, beams, bolts, ground, and ceiling remain the only causes of death. Bat count and minimum geometric sizes are bounded for finite rendering work, while scene and projectile speeds continue increasing. Swept collisions prevent high-speed gates and bolts from skipping over the bird between physics updates.

Each gate or attack survived awards one point. Nightmare has its own record and run count. Existing saved classic scores/settings are retained automatically. Pausing freezes the attack warning, beam timer, projectiles, and encounter state. Reduced motion keeps the essential warnings and collision geometry visible while removing decorative glow/motion where appropriate.

The engine tests include 48 simulations (16 seeds at 30/60/120 FPS) using visible cues, decisions at 50 ms intervals, and at least 140 ms between flaps. They check that the harder opening remains playable; they do not promise survival in later rounds. Separate tests cover continuous escalation, independent bat targeting/firing, truthful warnings, corridor clearance, fixed room targets, high-speed collisions, pause/resume, retry cleanup, and old-save migration. All 25 tests pass with `node --test flappy/tests/*.test.cjs`.

The HTML references versioned code/styles and the offline cache has its own update version, avoiding mixed old/new game scripts. The current entry link is https://apirak09.github.io/flappy/?v=3.0.0.

## The Wardrobe update — 3.0.0

The original physics engine, difficulty settings, hit circle, audio, backgrounds, and free yellow bird are unchanged. The additions are:

- **Deaths:** a total in the footer and results, with per-mode counts in the footer tooltip. Existing completed-run counts migrate into deaths; earlier sessions that were never saved cannot be reconstructed. Pausing and returning to the menu do not count as a death.
- **Coins:** each point pays one coin when the bird crashes, including Nightmare gate and attack points. A zero-point crash still counts as a death. The complete run is settled once before the results can be retried or updated. Old high scores do not generate retrospective coins; abandoning an unfinished flight does not pay coins.
- **Bird shop:** open the gold wallet button in the header or the bag in results. Previewing is free; **Buy & equip** spends coins once. Owned looks can be equipped for free. Opening the shop during a flight pauses it, using the existing resume countdown afterward.
- **14 costumes:** Mint Breeze, Rose Finch, and Bluebird (100); Rainbow Prism, Aurora, and Neon Pulse (250); Batman and Spider-Man (500); Superman and Captain America (750); Iron Man, Thor, Black Panther, and Doctor Strange (1,000). Hero details include masks, capes, suit emblems, armor plates, shields, and spell rings. Each local SVG is drawn into the same 56 × 56 render box, independent of the unchanged 14-unit hit circle.
- **Updates:** Settings → **Check for updates** checks an uncached `version.json`. A banner offers **Update now** when a release is ready. Updates wait for a finished flight and settled wallet transactions; there is no automatic mid-flight reload. The waiting offline worker activates only after the explicit button, then navigates once with a fresh URL. A worker activated by another tab never reloads the current tab. When service workers are unavailable, fresh matching-version HTML must be reachable before the update navigation.

Coins, inventory, equipped skin, paid-run IDs, and deaths use the separate `flappy-bird-sky-club-profile-v1` localStorage key. The existing `flappy-bird-sky-club-v1` scores/settings key is preserved. Web Locks serialize wallet changes between tabs where supported; a local queue handles repeated taps. Storage failures use consistent session memory and show a session-only save note. All costumes are included in the offline cache after installation. Update checks themselves require a connection. Clearing browser data or changing browsers/devices does not preserve local progress.

### Publishing later updates

After a source change, prepare a newer release with:

```sh
node flappy/tools/release.cjs 3.1.0
node --test flappy/tests/*.test.cjs
```

The helper updates the online version marker, HTML metadata, script/style URLs, and worker cache together. Commit and publish those files together. Do not reuse a release number for changed code. If adding a costume, also add its path to the worker's `FILES` list; the offline tests check every costume. Rebuild the committed costume SVGs with `node flappy/tools/build-skins.cjs` after editing their vector source. The release-consistency test catches mismatched page, script, and cache versions.

Tests cover the original 25 engine scenarios, wallet/migration/duplicate-purchase behavior, real UI handlers using a minimal Node DOM fixture, update timing, and offline-worker events. The Node fixture does not verify browser layout, real service-worker installation, or platform-specific rendering.

## Compatibility and saves

Designed for current Safari/iOS/iPadOS, Chrome/Android, Edge, and Firefox with keyboard, mouse, or touch. Both orientations are supported. Fullscreen depends on browser support; standalone Home Screen launch is an alternative on iPhone. Web Audio starts only after user input and gracefully fails without preventing play. Losing focus, switching apps, or changing orientation pauses the game. No unverified promise of support for every device is implied.

Best scores and settings use the isolated `flappy-bird-sky-club-v1` localStorage key, validated on read. Blocked/unavailable storage falls back to session memory. Scores are device-local, not a global leaderboard. A service worker scoped to `/flappy/` caches only this game for later offline play, after the first successful online visit and cache installation. No analytics or network account is required.

## Source

- `index.html`, `styles.css`: responsive UI and accessible HTML menus.
- `core.js`: DOM-independent physics, obstacle generation, collisions, and save validation.
- `audio.js`: original synthesized effects and optional original pentatonic loop.
- `game.js`: rendering, state transitions, controls, and persistence.
- `club.js`: validated inventory, coin settlement, death migration, and queued wallet transactions.
- `updates.js`, `version.json`: online release checks and explicit safe update activation.
- `sw.js`, `manifest.webmanifest`: offline caching and install metadata.
- `assets/`: original generated bird and landscape, plus icon derivatives.
- `assets/skins/`, `tools/build-skins.cjs`: local vector bird costumes and their source generator.

Run the deterministic engine/compatibility tests with `node --test flappy/tests/*.test.cjs` from the repository root. No package installation is needed.
