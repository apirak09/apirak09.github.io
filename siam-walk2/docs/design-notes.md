# Siam Walk 2 · 6 November 2026

Place / existing itinerary application.
Deal: place palette and typography reviewed with Taste Skill; brand tokens generated for #f8f6f1 / #253b39 / #a64b32. Figtree with local IBM Plex Sans Thai coverage. No shaders, WebGL, gradients or scroll effects. Skill motion layer retained unmodified.

One workspace: date, meeting and countdown above toolbar; eight photo/time rows beside the geographic map on desktop; map followed by rows on mobile. Uniform control sizes, 16px body, 17–18px itinerary names, 44px minimum map controls. Existing venue descriptions, route descriptions, times, source links and photographs are preserved.

User constraints override marketing-site defaults: no full-screen promotional photo, no added selling sections, no editing itinerary copy, retain existing dialogs and per-photo attribution. The retained source app provides the structure instead of replacing its semantics with the marketing starter.

## Verification

- Compared trip-data.mjs, core.mjs and basemap.mjs byte-for-byte with current GitHub siam-walk.
- Compared all index.html text nodes with the original; identical.
- Both original core tests pass; app module syntax check passes.
- Supported browser QA at 1440×900, 1024×768, 820×1180, 768×1024 and 390×844 via isolated iframe viewports. No horizontal page overflow, all seven map pins visible without intersection, no broken images.
- Opened schedule, venue details, route details and mobile schedule.
- Taste Skill's standalone Chrome checker was not run: this managed environment requires the supported browser and preview daemon. Actual browser rendering and DOM geometry were checked instead.
- Screenshots reviewed at desktop, tablet and phone sizes.
