# Flappy 2
<!-- impeccable:product-schema 1 -->
## Platform
web
## Users
Jack and visitors to apirak09.github.io, playing a one-input arcade game on desktop, phone, or tablet.
## Product Purpose
A separate Flappy sequel with improved gameplay, graphics, controls and interface. Keep the original /flappy/ completely untouched.
## Operating Context
Static GitHub Pages, no server, keyboard/mouse/touch, either orientation, viewport-filling world. Wider screens may see obstacles farther away.
## Capabilities and Constraints
Exactly three modes: Moon, Nightmare, Hell. Moon has lunar scenery and low gravity. Nightmare preserves the original six-gate / demon-bat attack loop with improvements. Hell has seven mechanically distinct sins, randomized without a fixed rotation and increasing difficulty with survival time. User selected increasing overlap: readable individual encounters initially, up to two compatible sins later.
Existing repository uses buildless HTML, CSS, JavaScript and Canvas. Ship only a new /flappy2/ directory. Preserve original saves; use separate storage and a service worker scoped to /flappy2/.
Saved death counts are per mode plus a combined total. Only actual crashes increment them; pausing, leaving a flight, and preparing another flight do not. Show counts in the menu, flight HUD, and results.
## Brand Commitments
User requests Impeccable guidance, full-screen layouts without a forced portrait arena, lunar / blood moon / seven sins worlds. No Easy, Normal or Hard choices.
## Evidence on Hand
Current /flappy/core.js, README.md, game.js, styles.css and assets. These are the authority for original Nightmare mechanics.
## Product Principles
- One flap control; distinct worlds and mechanics.
- Hazards communicate danger before collision becomes active.
- Difficulty comes from survival and increasingly demanding encounters.
- Full viewport, finite rendering work, no external runtime dependencies.
