# Content contract and editorial procedure

`data/archive.json` is UTF-8 JSON with `schemaVersion: 1`. Every translated text field has `{ "en": "…", "th": "…" }`. UI copy lives in the bilingual dictionary in `app.js`; lore lives in JSON.

## Event fields

| Field | Meaning |
| --- | --- |
| `id` | Stable, unique lowercase slug; used in shared links and saved records. |
| `sortDate` | ISO navigation anchor. Never present it as a confirmed date by itself. |
| `date` | Human-readable bilingual date or period. |
| `precision` | `day`, `month`, `year`, `range`, `approximate`, or `uncertain`. |
| `era` | Existing era ID. |
| `spoiler` | Knowledge boundary 1–10; minimum tier at which the whole entry can be shown. |
| `importance` | `core` or `support`. |
| `title`, `summary` | Title and short explanation; naturally authored in both languages. |
| `story` | Array of bilingual paragraphs. Prefer one focused paragraph before adding length. |
| `cause`, `consequence` | Explain the causal chain without merely repeating the summary. |
| `location` | Bilingual location; empty strings are permitted for events without one physical site. |
| `characters`, `organizations`, `agents` | Entity IDs. A drug or countermeasure may be indexed under agents, but must be described accurately. |
| `works` | IDs of canonical works depicting or materially establishing the event. |
| `sources` | IDs of evidence records; retain primary file locators when available. |
| `uncertainty` | Bilingual caveat, or `null`. Required for approximate / uncertain placement. |
| `connections` | Event IDs linked by cause, character continuity or consequence, not just adjacency. |

## Entities, works and sources

Entities have `id`, `category` (`character`, `organization`, `agent`), bilingual `name` / `description`, and `spoiler`. Keep descriptions short. Do not leak a later revelation through an early character record.

Works have `id`, `name`, and `source`. Combine originals and remakes within a single work entry where they represent the same incident. DLC stories may have separate work records but should share or connect their underlying incidents naturally.

Sources have `id`, `title`, `url`, `kind`, `locator`, and `checked`. `kind` distinguishes `official` publisher material, `game-file` transcripts (often preserved on an unofficial host), and `reference` databases. `checked` records editorial research date, not a guarantee that an external host will always be available. Do not label a community page as an official source.

Biology records contain `id`, `title`, bilingual `description`, `spoiler`, `sources`, and `parents`. Each parent has `id` and `type`: `derived`, `combined`, `research-line`, or `condition`. Only direct documented derivation receives a solid visual marker. Other relationships use dashed markers. Unknown relationships remain absent. Parent nodes beyond the spoiler boundary are hidden.

## Add or update an incident

1. Establish that the underlying work belongs to the primary continuity. A Capcom credit alone is insufficient.
2. Verify the event and date through a named game scene/file or official source. Use reference databases to discover and cross-check, and retain the primary locator.
3. Decide whether it is essential, supporting, or unnecessary. Do not add an event only to increase the count.
4. Add source records and entities if required. Prefer expanding an existing incident over duplicating it for a remake or DLC perspective.
5. Write a brief summary, then explain cause, incident and consequence. Distinguish a demonstrated fact from a character's assertion or an interpretation.
6. Set a truthful date label. For undated material, use an approximate navigation anchor and explain it in `uncertainty`. Annual sorting does not establish exact order within the year.
7. Author Thai and English together. Preserve the same uncertainty, facts and spoiler level in both.
8. Link the events that explain why this one happened and what it changes. Check character continuity and biological relationships.
9. Assign the spoiler tier to the most sensitive fact shown in the entry. If one late revelation would hide a core early incident, move that revelation to the later incident instead.
10. Run `npm run validate` and `npm run build`. Review both languages and narrow/mobile layouts using `tests/viewport.html`. Test direct links, external references and source disclosure.
11. Commit the source changes. Avoid changing stable IDs. Recheck the live Pages deployment.

## Updating knowledge boundaries

The `caps` array in `app.js` defines the displayed tiers. They are knowledge groups, not a chronological game playlist. For example, early Miranda history is tier 8 because Village reveals it. New releases can contribute early dated material without being sorted at their release year. Before extending the highest tier, audit filters, biology records and character descriptions for unintended revelation.
