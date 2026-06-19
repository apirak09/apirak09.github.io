# Mini Angry Birds v18 — 150 Levels Undersea Build

GitHub-ready HTML5 Canvas physics puzzle game.

## What changed in v18

- Expanded from 100 to 150 levels.
- Added level packs `levels-101-125.js` and `levels-126-150.js`.
- All levels remain unlocked from the start.
- Best stars/scores are still saved per level in localStorage.
- Added a decorative dynamic undersea background.
- Salmon fish and swimming salmon-sashimi pieces wander randomly in the background. They are visual only and do not affect collision, scoring, birds, pigs, or blocks.
- Kept the v17 freeze fix and v16 calibrated damage balance.

## File structure

```text
index.html
src/styles.css
src/game.js
src/levels/levels-001-025.js
src/levels/levels-026-050.js
src/levels/levels-051-075.js
src/levels/levels-076-100.js
src/levels/levels-101-125.js
src/levels/levels-126-150.js
src/levels/README.md
LEVEL_DESIGN_NOTES.md
README.md
```

## GitHub Pages

Push this folder to a GitHub repository and enable GitHub Pages. GitHub will serve `index.html` as the entry point.

## Editing levels

Each level is a plain object inside `src/levels/*.js`. To add or edit levels, change only the relevant level pack. Make sure new scripts are listed in `index.html` before `src/game.js`.
