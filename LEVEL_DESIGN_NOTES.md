# Level Design Notes — v20

This build keeps the 150-level set and focuses on system quality rather than adding more stages.

## v20 system changes affecting levels

### 1. Static pre-settle

At level load, unsupported blocks and pigs are dropped vertically onto the closest support or ground before support data is captured. This prevents a level from visually starting with floating objects.

### 2. Pig physics

Pigs now have lightweight gravity, horizontal damping, ground collision, and block collision. If a support is destroyed, pigs can fall naturally instead of hovering in the air.

### 3. Turn flow

The game waits for active pigs and blocks to settle before spawning the next bird. This prevents the mid-turn state where structures or pigs appear suspended while the next bird is already ready.

### 4. Debug overlay

Press `D` to evaluate a level quickly:

- Awake blocks
- Damaged blocks
- Unsupported blocks
- Unsupported pigs
- Turn frames

Use it to find bad level layouts before publishing.

## Recommended level rules going forward

- Avoid floating blocks unless they are meant to be decorative background objects. All gameplay blocks should touch the ground or another block.
- For hard levels, prefer stone protection plus small glass/wood weak points instead of huge TNT chain reactions.
- Make TNT useful but not an instant full-map clear.
- Give each stage one or two intended solution patterns.
- Keep pigs physically supported by platforms, not embedded inside blocks.
- Test each stage with debug overlay after edits.

## Material balance

- Glass / ice: 40 HP
- Wood: 100 HP
- Stone: 250 HP
- TNT: 10 HP

Bird damage is calibrated around the v16 system:

- Red: up to ~300 direct impact
- Yellow: up to ~300 direct, ~500 boosted
- Blue: ~150 per body, split into 3 bodies
- Bomb: ~300 direct, ~500 explosion
- TNT: ~500 explosion in a compact radius
