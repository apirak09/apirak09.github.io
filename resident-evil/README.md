# BIOHAZARD — Canon Archive

A responsive Thai / English visual guide to the primary Resident Evil game continuity. Choose one of six illustrated eras on a horizontal timeline, then read its numbered event branches. Short summaries and consequences are visible immediately; a single click expands the full story in place. Supporting incidents, search, character trails, sources and spoiler settings are available when wanted.

Live: https://apirak09.github.io/resident-evil/

## Run locally

Requires Python 3 for the local HTTP server. Node 20+ is only needed for validation or building.

```sh
cd resident-evil
python3 -m http.server 4173
```

Open http://localhost:4173. Use an HTTP server rather than opening `index.html` with `file://`, because the interface fetches JSON.

```sh
npm run validate
npm test
npm run build
```

No `npm install` is required. `npm run build` validates the archive and copies deployable files into `dist/`. The source folder is itself deployable.

## Project structure

```text
resident-evil/
  index.html                 Semantic shell, metadata and no-script fallback
  app.js                     Buildless ES module, hash routes and interaction
  styles.css                 Visual era rail, responsive branches and inline stories
  data/archive.json          Bilingual incidents, entities, sources and biology
  assets/                    Original era illustrations, SVG icon and licensed fonts
  docs/LORE-SOURCES.md        Canon decisions, evidence hierarchy and source index
  docs/CONTENT-SCHEMA.md      Data contract and adding new incidents
  docs/QA.md                 Historical QA record
  docs/QA-2026-10-03.md       Visual redesign QA
  docs/ART-DIRECTION.md       Image provenance, prompts and display policy
  scripts/validate.mjs        Structural and chronological invariants
  scripts/build.mjs           Optional static packaging
  deployment/github-pages.yml Optional dedicated-repository workflow
  tests/integration.mjs      Regression checks with lightweight DOM doubles
  tests/viewport.html         Responsive QA frame harness
```

## GitHub Pages deployment

This project is published in the existing `apirak09/apirak09.github.io` repository under `resident-evil/`. Its existing Pages publishing serves the folder at `/resident-evil/`; the root homepage and other projects are preserved. Commit edits to the same branch and wait for the Pages build to finish.

All asset paths are relative, and selected events use URL fragments, for example:

`https://apirak09.github.io/resident-evil/#event=mansion&lang=en`

An era is also shareable: `#era=raccoon&lang=th`. Existing event IDs and device-local reading/bookmark data remain compatible.

Refreshing a direct event link requests the real `index.html`; it needs no server rewrite or SPA fallback. A reader's saved spoiler boundary takes precedence over a shared link.

For a **new dedicated repository**, place these files at its root. Either enable Pages from `main` / root, or copy `deployment/github-pages.yml` into `.github/workflows/pages.yml` and enable GitHub Actions as the Pages source. The optional workflow is for the dedicated repository, not a replacement for the current multi-project homepage deployment.

## Content maintenance

Follow [the schema and review checklist](docs/CONTENT-SCHEMA.md). Keep the ID of existing incidents stable so bookmarks and shared links survive. Source records preserve publisher pages, named game files and secondary research aids. Use [the lore notes](docs/LORE-SOURCES.md) before interpreting disputed details.

Thai is authored alongside English rather than generated at runtime. Both languages contain the same facts, caveats and navigation controls. Proper names retain their canonical spelling for search and recognition.

## Technical choices

No framework or build-time dependency is necessary for this interaction model. One ES module loads a local JSON document; CSS handles the horizontal era rail, desktop event branches and mobile vertical story cards. Details expand inside the current card rather than replacing the timeline. A first-reader spoiler notice is inline and nonblocking; an explicitly shared event outside a saved boundary still asks before revealing it. There are no trackers, remote fonts, required APIs, accounts, backend services or exposed secrets.

Reading progress, saved incidents, language and spoiler consent use `localStorage`. If storage is unavailable, the session remains usable. External references open separately and may reveal later spoilers. The site is designed for modern evergreen browsers with native `<dialog>` support.

## Rights

Independent fan project. Resident Evil / Biohazard and the associated characters, works and names belong to Capcom. Lore is paraphrased; the repository does not redistribute game artwork or full game-file text. Original interface code and graphics are provided under the MIT license. The environmental illustrations are AI-assisted mood cues, not game screenshots or proof of scene geography; see [art direction](docs/ART-DIRECTION.md). Small WebP thumbnails are separate from era banners so the first view does not download every full-sized image. Noto Sans Thai is distributed under the SIL Open Font License in `assets/FONT-LICENSE.txt`. No endorsement is implied.

## Maintaining the visual interface

New incidents use the era illustration by default. Optional incident environment overrides live in `sceneByEvent` in `app.js`; their original assets and prompts are documented in `docs/ART-DIRECTION.md`. Use illustrative images as mood cues, never as proof of an uncertain canon detail. When changing `app.js` or `styles.css` in the directly served source folder, refresh their content-version query in `index.html` so returning browsers load the matching interface files.
