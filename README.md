# Mini Angry Birds v20 — Physics & Graphics Update

Static GitHub Pages build for a Mini Angry Birds-style canvas game.

## What's new in v20

- Keeps the stable local save key: `mini-angry-birds-save-v1`.
- Loads all level packs from 001–150.
- Adds support-aware static settling at level start so objects do not visibly float before the first shot.
- Adds pig gravity and pig-block collision resolution so pigs fall with the structure instead of hovering between birds.
- Extends turn resolution: the next bird waits for moving/falling pigs and blocks, not just the bird projectile.
- Adds a hidden debug overlay: press `D` to show HP, awake blocks, damaged blocks, unsupported blocks, unsupported pigs, and turn frames.
- Adds save Export/Import inside the `?` help modal.
- Improves graphics for birds, pigs, wood, stone, glass, TNT, cracks, highlights, and shadows.

## Deploying to GitHub Pages

Upload the whole folder contents to the root of your repository. GitHub Pages will load `index.html` first.

Important: do not rename the repository/domain/path if you want localStorage progress to remain available in the same browser. Also do not change this save key in future versions:

```js
const SAVE_KEY = 'mini-angry-birds-save-v1';
```

## Editing levels

Level data lives in:

```text
src/levels/levels-001-025.js
src/levels/levels-026-050.js
src/levels/levels-051-075.js
src/levels/levels-076-100.js
src/levels/levels-101-125.js
src/levels/levels-126-150.js
```

Block materials:

- `ice` = glass, 40 HP
- `wood` = 100 HP
- `stone` = 250 HP
- `tnt` = 10 HP, explodes when broken

## Debug controls

- `R` restart level
- `G` toggle aim guide
- `P` pause
- `M` sound on/off
- `D` debug overlay
- `Space` use bird ability

## Save backup

Open `?` and use:

- `Export Save` to copy/backup local progress as JSON
- `Import Save` to restore/merge progress from JSON

This is still offline/local save, not cloud login.
