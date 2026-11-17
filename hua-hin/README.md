# Hua Hin, with you.

A personal, Thai-first travel companion for 5–7 December 2026.

Live site: https://apirak09.github.io/hua-hin/

## Run and deploy

Static HTML, CSS and ES modules. No package installation, build step, API key, backend, analytics or login is required. Serve this directory with any static HTTP server. GitHub Pages publishes this folder from the existing repository's `main` branch.

## Change the trip

| File | Edit here |
| --- | --- |
| `trip-data.mjs` | Places, coordinates, opening hours, sources, daily events, hotel and packing list |
| `routes.json` | Verified OSM road geometry, measured distance, routing response metadata |
| `photo-credits.json` | Each photograph's source, author, licence and changes |
| `styles.css` | Visual tokens, responsive layout and reduced motion |
| `app.mjs` | Interactions, map, local notes and dialogs |
| `sw.js` | Scoped offline cache; no map-tile caching |

An event's `start` and `end` define its complete time slot. A ride's `wait` and optional `exit` are explicit allowances. The remaining time after the planning drive/foot estimate is shown as extra slack. Null end times mean the rest of the evening. `fixed: true` preserves the two train events for calendar export.

After changing train times:

```sh
node scripts/generate-calendar.mjs
node --test tests/*.test.mjs
```

If adding a location, add a real local photograph and complete attribution. Get new road geometry from the relevant endpoint stored in `routes.json`; use `routed-foot` for walking. Verify snapped endpoints and enforce Grab/Bolt for routes over 2 km. Do not use a straight line as a measured road distance.

## Travel estimates

Coordinates are sourced from the hotel's own map script and OpenStreetMap features. Routes and distances were retrieved from FOSSGIS / OSRM on 18 November 2026. Raw routing times are retained as metadata. Urban car times shown to users are conservative planning estimates at an explicitly stated assumed 30 km/h, rounded up to five-minute increments, with a ten-minute minimum, plus separate wait/traffic allowances. Foot times come from the walking router plus extra slack. None of these is a live ETA.

The Bangkok–Hua Hin dashed line is an explicitly labelled schematic station connector, not a railway alignment or a distance measurement. Breakfast and flexible lunch slots use the hotel as a reference; no restaurant or restaurant travel distance is invented.

## Offline and privacy

Once initial caching succeeds, the local itinerary, photographs, route geometry and train calendar can be opened offline. Basemap tiles, external sources, Google Maps and fresh geolocation require connectivity. The service worker is scoped to `/hua-hin/` and ignores sibling projects and third-party map tiles.

Notes and packing items use namespaced localStorage on the current browser. They are not synchronized or included in shared links. Location is requested only after pressing the location button. Cache and stored notes can be removed through the browser's site settings.

## Attribution and testing

Full photo attribution and licence links appear in the website's information dialog and `photo-credits.json`. Hotel and TAT photographs retain the copyright of their respective sources. OpenStreetMap attribution remains on the live map. Leaflet and IBM Plex font licence files are included locally.

See `docs/design-notes.md` and `docs/qa.md` for implementation decisions and validation limits.
