# QA record

Research and implementation reviewed on 2 October 2026.

## Automated and integration checks

- Structural validation passes for 57 bilingual incidents, 100 entity trails, 15 biology records and 57 source records: unique safe IDs, chronology, precision labels, required references, connections and bilingual fields.
- Biology has no cycles; independent parasite/fungal origins and Rose's placement after Requiem are protected.
- Build and Node syntax validation passed before the initial deployment. The final application also passed JavaScript compilation and a rendering/integration pass.
- All 57 records render in both languages (114 checks). Deep links, bilingual narrative search, Leon's 14-incident trail, empty states and guide rendering pass.
- Every knowledge tier from 1–10 was checked. Later events, biological parents and browser-title metadata respect the boundary.
- Read/save actions preserve device-local records; language controls change the document language.
- The regression harness uses lightweight DOM doubles. It does not claim to reproduce browser layout or assistive technologies.

Run `npm test` and `npm run build` to reproduce the repository's checks.

## Live browser review

The first Pages deployment completed successfully and loaded the actual site in the cloud browser.

Reviewed:
- Thai desktop archive at the browser's approximately 1348 px viewport.
- English language switch, search, Leon trail, record selection, reading marks and bookmarks.
- Reloaded direct-event URL and confirmed saved/read state persisted.
- A 390 px mobile QA frame (375 px content after its desktop scrollbar): Thai record view, readable wrapping, mobile header, back control, and no horizontal overflow in the measured document.
- The mobile back action exposed the timeline in the accessibility/DOM observation. The cloud browser disconnected before the next visual confirmation, so that observation is not presented as a completed end-to-end visual check.

QA findings fixed: narrative text added to search (so Raccoon searches include the RE2 incident), explicit mobile spoiler-button accessible name, pressed states on read/save, larger mobile entity targets, selected-event retention when lifting a boundary, a compact 320 px header rule, and spoiler-safe browser-title metadata.

## Responsive, accessibility and deployment review

Grid minimum widths, horizontal era navigation, the mobile list/detail transition, wrapped actions and narrow typography were reviewed from 320 through 1920 px. Viewport frames for 375, 390, 768, 1024 and 1440 are provided in `tests/viewport.html`; only the desktop and 390-frame checks above were observed in the browser during this session.

Semantic buttons, labels, headings and native disclosure/dialog controls are used. The first spoiler dialog receives focus and prevents dismissal until a boundary is chosen. Reduced motion, focus-visible indicators, a skip link, keyboard/mobile Escape handling and a print record layout are present. No animation or remote asset is required.

All runtime asset paths are relative. Event selection uses URL fragments and refresh requests the actual index file. No backend, external scripts, trackers, API secrets or service-worker caching are involved. Fonts are local with their license. The optional dedicated-repository workflow is not used to replace the existing multi-project Pages deployment.

## Editorial review and limits

Original/remake incidents are merged; incompatible routes, Javier, undated letters, annual ordering and the source-supported Requiem release outcome retain explicit caveats. Source labels distinguish publisher material, mirrored primary files and secondary aids. Unknown agents and open institutional threads are not given invented answers.

External references can restrict automated access and may contain later spoilers. Research dates are not promises of permanent host availability. The cloud test environment went offline during QA; the repository and completed GitHub Pages deployment remained available through the GitHub connector. Real iOS/Android devices and screen-reader hardware were unavailable. These checks are practical coverage, not device certification or a claim that every lore interpretation is undisputed.
