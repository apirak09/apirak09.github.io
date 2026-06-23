# Level Packs

The game loads level packs in `index.html` before `src/game.js`.

Current packs:

- `levels-001-025.js`
- `levels-026-050.js`
- `levels-051-075.js`
- `levels-076-100.js`
- `levels-101-125.js`
- `levels-126-150.js`

Each file appends one array to `window.LEVEL_PACKS`.

v20 includes static pre-settle and pig physics, but level data should still be designed as physically supported structures.
