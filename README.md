# Mini Angry Birds v16 — Calibrated Block HP / Damage

GitHub-ready HTML5 Canvas physics puzzle game.

## Run locally

Open `index.html` directly in a browser, or serve the folder with any static server.

## GitHub Pages

Push the whole folder to a GitHub repository. GitHub Pages can use `index.html` at the repository root.

## File structure

```text
index.html
src/styles.css
src/game.js
src/levels/levels-001-025.js
src/levels/levels-026-050.js
src/levels/levels-051-075.js
src/levels/levels-076-100.js
src/levels/README.md
LEVEL_DESIGN_NOTES.md
README.md
```

## v16 balance update

This version keeps the 100 unlocked levels and minimal UI from the previous build, but replaces the over-tough block damage model with calibrated HP / damage values.

### Block HP

- Glass / Ice: 40 HP
- Wood: 100 HP
- Stone: 250 HP
- TNT: 10 HP

Block size still affects mass and physics behavior, but **does not multiply HP** anymore. This prevents long beams and large blocks from becoming nearly unbreakable.

### Bird damage

- Red bird: up to 300 direct hit damage at full charge
- Yellow bird: up to 300 direct hit damage at full charge; up to 500 after boost skill
- Blue bird: 150 direct hit damage; after splitting, each of the 3 fragments also deals up to 150
- Bomb bird: up to 300 direct hit damage; skill explosion deals up to 500 in a short radius

### TNT

TNT has 10 HP and uses the same 500-damage explosion model as the bomb bird. Explosion radius is intentionally limited, so TNT breaks nearby targets without deleting the entire map.

## Level editing

Each level object contains:

```js
{
  name: 'Level name',
  birds: ['red', 'yellow', 'blue', 'bomb'],
  pigs: [{ x: 632, y: 484, r: 15, hp: 1 }],
  blocks: [B(600, 430, 24, 70, 'stone')]
}
```

Materials: `wood`, `stone`, `ice`, `tnt`.

You can override a single block's HP by adding `hp` to that block object, but most blocks should use the default calibrated material HP.
