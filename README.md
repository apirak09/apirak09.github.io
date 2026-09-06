# Mini Angry Birds: Reforged — The Egg Heist (v33)

A static, Thai-language slingshot physics game with ten levels, four bird types, destructible structures, TNT chains, and 30 campaign stars. Runs on GitHub Pages or directly from `index.html`; Matter.js is bundled locally.

## Play

- **Drag** the loaded bird backward and release. The dotted guide follows the bird's actual starting position, air resistance, and gravity.
- **Precision aiming:** open **เล็งละเอียด**, adjust the angle and power, then press **ยิง!**. These controls are always visible on portrait phones.
- **Keyboard:** focus the playfield; ↑/↓ adjust angle, ←/→ adjust power, and Space launches or activates an airborne ability. Hold Shift for larger adjustments. Esc cancels aiming or closes a menu. R restarts, P pauses, G toggles the guide, M toggles sound.
- **Birds:** Red pushes wood, Blue splits into three and breaks glass, Yellow boosts in its flight direction, and Bomb detonates on command or 0.85 seconds after impact.
- Defeat every pig to advance. Clear within par for three stars; unused birds earn bonus points.
- Progress and preferences save on this device. Existing v1 saves are retained and validated on load.

The game opens directly on the playfield. The original animated opening is available from **วิธีเล่น → ดูฉากเปิดอีกครั้ง**. Landscape orientation gives a larger view on phones. Sound starts after interaction; reduced shake/flash is available in Help and follows the operating-system preference by default.

## What v33 fixes

The previous layouts could overlap or collapse before the first shot, the aiming preview started at the wrong position, and endless debris motion could prevent a new turn. This version:

- Rebuilds all ten levels with supported beams and non-overlapping pigs, preserving their original themes and mechanics.
- Uses a simulation clock for shots, damage, combos, explosion fuses, and score timing. Pausing, reading Help, and aiming do not consume those timers.
- Waits for TNT chains and the last shot to resolve, bounds the settling period, and offers a next-bird button once the current projectile is finished.
- Cancels interrupted/cancelled drags safely and ignores duplicate or unrelated pointer releases.
- Spawns Blue fragments outside one another, adds Bomb's impact fuse, and measures blast distance to block surfaces.
- Adds precise touch/keyboard aiming, accessible modal focus handling, full-screen menus, visible previous-shot settings, campaign star totals, and a compact responsive interface.
- Keeps result menus recoverable, sanitizes malformed saves, and confirms progress resets.

## Development

No packages need to be installed. Use a current Node.js runtime:

```sh
npm run dev
npm test
npm run check
```

The development server listens on port 4173, with `--port` or `PORT` overrides. Direct `file://` play and GitHub Pages require no server or build step.

## Verification

`npm test` runs **40 automated checks** using the real bundled Matter.js and production game code. Browser presentation APIs are stubbed for these tests; physics is not mocked. Coverage includes:

- Ten seconds of gravity on every starting structure, independently of pre-launch freezing.
- A recorded legal winning sequence for every level, repeated with three visual random seeds.
- Exhausted-bird loss and retry on all ten levels; finite physics state throughout.
- Trajectory/launch agreement for all four birds.
- Pointer cancellation and duplicate releases; pause/menu clocks and explosion fuses; abilities; bounded turn flow; saves, unlocks, and result recovery.

Winning shots are recorded in `tests/winning-shots.json` for reproducible regression checks, not fed into the game. `scripts/search-shots.cjs` searches legal shots for level balancing. `tests/viewports.html` renders portrait and landscape browser fixtures. Automated physics checks do not replace playtesting on physical devices.

## Source map

| Path | Purpose |
| --- | --- |
| `index.html` | Game shell and controls |
| `src/game.js` | Physics, rendering, input, scoring, audio, saves, game flow |
| `src/levels.js` | Ten supported level layouts |
| `src/styles.css` | Responsive game and dialog styling |
| `src/vendor/matter.min.js` | Unmodified Matter.js 0.20.0; license in `MATTER-JS-LICENSE.txt` |
| `tests/` | Physics regression tests and responsive fixtures |
| `scripts/` | Dependency-free development server and shot search |

The separate internship presentation, `the-list/` page, and existing `music.mp3` asset are retained unchanged. The game uses procedural Web Audio effects. A development inspector is available only with `?debug=1`.
