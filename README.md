# Mini Angry Birds: Reforged (v32 Crush & Cinematic)

A complete rebuild of the v21 prototype focused on better physics, stronger game feel, clearer UX, and ten deliberately designed levels.

## Run

Open `index.html` in a modern browser. The build is fully static and works on GitHub Pages. Matter.js is included locally under `src/vendor/`; no internet connection is required after downloading the folder.

## Controls

- Drag and release the loaded bird to shoot.
- Click/tap the playfield or press `Space` while flying to use an ability.
- `R`: restart level
- `G`: toggle trajectory guide
- `P`: pause/resume
- `M`: mute/unmute
- `Esc`: close an open menu or pause

## What changed from v21

### Physics

- Replaced the custom collision and support solver with Matter.js rigid-body physics.
- Added real mass, inertia, angular momentum, friction, restitution, improved contact handling, and more stable stacking.
- Added material-specific durability and impact response.
- Added localized TNT/bomb blast force, damage falloff, and chain reactions.
- Added pig damage from direct hits, falling structures, crushing impacts, and explosions.
- Prevented setup settling from damaging structures before the first shot.

### Graphics and game feel

- New high-resolution responsive canvas with device-pixel-ratio rendering.
- Original vector-drawn birds, pigs, slingshot, materials, terrain, and layered backgrounds.
- Material cracks, damage flashes, debris, dust, glass shards, sparks, smoke, shockwaves, score floaters, trails, and camera shake.
- Procedural Web Audio sound effects; no audio files required.

### Level design

- Replaced 150 repetitive stages with a ten-level campaign.
- Each level teaches or combines a distinct solution pattern: support cutting, glass splitting, long-range boost, TNT chains, lever rotation, stone bunker demolition, controlled collapse, precision tunnel shots, and a mixed-material finale.
- Sequential unlocks, per-level best score, best stars, par targets, contextual tutorials, and failure tips.

### UX/UI

- Redesigned HUD, bird queue, power meter, ability button, pause menu, results breakdown, level selection, help panel, fullscreen support, responsive mobile layout, and persistent settings.
- Progress is stored under `mini-angry-birds-reforged-save-v1`.
- Existing v21 scores for the first ten levels are migrated when available.

## Main files

- `index.html`: application shell and UI
- `src/styles.css`: responsive interface styling
- `src/levels.js`: all ten level definitions
- `src/game.js`: physics integration, rendering, input, scoring, audio, saves, and game flow
- `src/vendor/matter.min.js`: local Matter.js runtime


## v31 stability hotfix

- Reduced UI repaint churn that could cause stutter or apparent frame freezes on some machines.
- Disabled aggressive body sleeping and retuned friction/restitution so stacked objects respond more naturally instead of looking stuck or floating.
- Increased solver quality and sub-stepping for more reliable launches and collision resolution.
- Added extra guards against invalid projectile state, missed pointer release, and disappearing birds.


## v32 crush and cinematic update

- Added a 16-second skippable opening cinematic shown when the game starts.
- The cinematic uses original vector animation, film-strip presentation, Thai captions, and a short egg-theft story; it does not embed external video or copyrighted audio.
- Added a replay button for the opening cinematic in the Help menu.
- Added impact crushing: a falling block now damages pigs according to mass, downward speed, and contact geometry.
- Added sustained crushing: blocks that have actually moved and continue pressing down can kill a pig even after the initial impact has ended.
- Added safeguards so stable starting contacts are not automatically treated as crushing before the physics system is armed by the first launch.
- Added CRUSH feedback, dust, and score effects when a pig is defeated by falling debris.
