# Changelog

## v33 — Playability Revamp

- Rebuilt all ten starting structures with properly supported beams and pigs.
- Matched the aiming guide to the actual launch position and 120 Hz physics integration.
- Added a simulation clock: pauses and menus no longer age shots or explosion fuses.
- Bounded turn settling and added a safe next-bird action after a projectile finishes.
- Fixed pointer cancellation, duplicate releases, and firing or using abilities through menus.
- Separated Blue fragments at spawn, added Bomb impact detonation, and improved blast contact/chain reactions.
- Added precision angle/power sliders, keyboard launch controls, previous-shot settings, and campaign star totals.
- Reworked responsive controls and full-screen dialogs; restored focus and result-menu navigation.
- Kept the opening cinematic as an optional replay and respected reduced-motion preferences.
- Validated legacy saves and added confirmation before progress reset.
- Added 40 reproducible physics/game-flow checks, ten winning-shot fixtures, and local development tools.

## v32 — Crush & Cinematic

- Added an original animated opening cutscene with five scenes, film-strip framing, Thai captions, progress bar, skip control, and replay control.
- Added mass-, velocity-, position-, and penetration-aware pig damage from falling blocks.
- Added sustained compression damage for heavy objects resting on a pig after a genuine structural movement.
- Added a physics arming snapshot so minor initial settling does not count as crushing.
- Added CRUSH visual feedback and dust effects.

## v31 — Stability Hotfix

- Fixed intermittent launch failures where birds could sometimes not release correctly or appear to vanish.
- Reduced frame hitching by caching UI updates instead of rebuilding HUD elements every animation frame.
- Disabled overly aggressive sleeping and retuned friction/restitution so structures topple more naturally and stop looking glued together.
- Increased solver iterations and sub-stepping to improve collision stability, stacking, and chain reactions.
- Added defensive cleanup for invalid physics bodies and a pointer-capture fallback so drag release is more reliable across browsers.

## v30 — Reforged

- Rebuilt the physics layer on Matter.js.
- Replaced the 150-stage pack with ten curated stages.
- Added four distinct bird behaviors and three active abilities.
- Added material durability, impact damage, crushing, explosions, chain reactions, and debris.
- Rebuilt all canvas art and interface styling.
- Added par-based stars, combo scoring, unused-bird bonuses, tutorials, failure tips, sequential unlocking, best scores, settings persistence, pause/help/level menus, fullscreen, mobile controls, and generated sound effects.
- Added migration of first-ten-level records from the original save key.
