# Flappy Bird — Sky Club

Play: https://apirak09.github.io/flappy/

A standalone, dependency-free arcade game. This directory can be served as-is by GitHub Pages or any static HTTP server. No build or external CDN is needed. Other games in the repository are independent.

## Controls

- Tap/click the game area, Space, or Up Arrow: one flap.
- P or Escape: pause/resume. Resume includes a short countdown.
- R: retry from the results screen.
- M: toggle all audio. F: fullscreen where supported.
- Select Easy, Normal, or Hard in the menu. Best scores are separate for each mode.
- Settings: sound effects, optional music, volume, reduced motion.

## Difficulty

The logical playfield stays 480 × 680 on every screen; resizing does not change physics or obstacle positions. Canvas resolution follows device pixel ratio, capped at 2 for battery/performance. Physics substeps are no larger than 1/120 second.

| Mode | Pipe speed (units/s) | Gap (units) | Gravity (units/s²) | Flap velocity (units/s) |
| --- | ---: | ---: | ---: | ---: |
| Easy | 150 | 220 | 1160 | -365 |
| Normal | 185 | 182 | 1320 | -385 |
| Hard | 225 | 150 | 1450 | -405 |

Collision checks include the pipe lips, use a forgiving bird hit circle, and award each passed pair only once. Gap centers are bounded and successive height changes are limited. Medals are awarded at 5, 15, 30, and 50 points.

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
