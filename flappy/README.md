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
| Nightmare | 245 | 126–158, varied per gate | 1450 | -405 |

Collision checks include the pipe lips, use a forgiving bird hit circle, and award each passed pair only once. Gap centers are bounded and successive height changes are limited. Medals are awarded at 5, 15, 30, and 50 points.

## Nightmare — Blood Moon update

A prominent crimson fourth mode switches the scene to an original Blood Moon landscape, blood-stained metal gates, a darker interface, demon-bat artwork, warning sounds, laser/volley effects, and an optional minor-key soundtrack. Controls remain the same.

Each endless round alternates between:

1. **Six blood gates.** Gaps vary from 126 to 158 units and spacing from 250 to 332 units. Close pairs reduce the allowed height change; maximum center displacement is 76 units. The speed stays capped at 245 units/s rather than accelerating into an impossible state.
2. **Bat arrival.** Every pipe must leave the entire playfield before a 1.35-second arrival begins. Attacks cannot overlap pipes.
3. **Three attacks.** Laser and blood-volley patterns alternate. Every attack has a 1.1-second visual/audio warning. A laser locks its horizontal sightline once, then fires for 0.42 seconds; it does not track the bird after the lock. A volley marks a 186-unit open corridor and launches finite, non-homing bolts from the right. The next attack waits for all bolts or the beam to clear, plus 0.72 seconds of recovery.
4. **Return to gates.** A 1.25-second breather precedes the next set. Its first pipe starts offscreen with more than 1.4 seconds before it can reach the bird.

Each gate or attack survived awards one point. Nightmare has its own record and run count. Existing saved classic scores/settings are retained automatically. Pausing freezes the attack warning, beam timer, projectiles, and encounter state. Reduced motion keeps the essential warnings and collision geometry visible while removing decorative glow/motion where appropriate.

The engine tests include 96 complete simulations (32 seeds at 30/60/120 FPS), each surviving five rounds and scoring 45 points. The simulation reads visible cues at 100 ms intervals and allows no more than one flap per 160 ms. These are practical solvability checks, not a proof that every player state or every conceivable random sequence is survivable. Separate tests cover warning-only immunity, fixed laser targeting, live attack collisions, corridor clearance, pause/resume, reset cleanup, and old-save migration.

The new HTML references versioned code/styles and the offline cache has its own update version, avoiding mixed old/new game scripts. The direct update link is https://apirak09.github.io/flappy/?v=nightmare-1.

## Compatibility and saves

Designed for current Safari/iOS/iPadOS, Chrome/Android, Edge, and Firefox with keyboard, mouse, or touch. Both orientations are supported. Fullscreen depends on browser support; standalone Home Screen launch is an alternative on iPhone. Web Audio starts only after user input and gracefully fails without preventing play. Losing focus, switching apps, or changing orientation pauses the game. No unverified promise of support for every device is implied.

Best scores and settings use the isolated `flappy-bird-sky-club-v1` localStorage key, validated on read. Blocked/unavailable storage falls back to session memory. Scores are device-local, not a global leaderboard. A service worker scoped to `/flappy/` caches only this game for later offline play, after the first successful online visit and cache installation. No analytics or network account is required.

## Source

- `index.html`, `styles.css`: responsive UI and accessible HTML menus.
- `core.js`: DOM-independent physics, obstacle generation, collisions, and save validation.
- `audio.js`: original synthesized effects and optional original pentatonic loop.
- `game.js`: rendering, state transitions, controls, and persistence.
- `sw.js`, `manifest.webmanifest`: offline caching and install metadata.
- `assets/`: original generated bird and landscape, plus icon derivatives.

Run the deterministic engine/compatibility tests with `node --test flappy/tests/*.test.cjs` from the repository root. No package installation is needed.
