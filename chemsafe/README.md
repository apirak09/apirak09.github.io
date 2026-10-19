# ChemSafe

Thai chemical-safety exam practice at https://apirak09.github.io/chemsafe/ . Static HTML/CSS/ES modules; no build or account required.

Source exam: user-provided 51-page PDF. 206 complete question occurrences; 165 records after conservative duplicate consolidation. One partial question at page47/top-right/bottom has missing options, is documented, and is not fabricated. Variants with changed text/choices remain separate. Original option order is retained in sourceLocations.

117 records have a single supported answer and count toward scores. 48 ambiguous, conditional, or source-limited records remain available in practice with explicit explanations; they are excluded from scoring/exam mode. This is independently checked study material, not an official answer key. Do not infer that an answer omitted from scoring is necessarily medically/chemically unknowable; some require additional SDS or policy details beyond the specified references.

References:
- https://www.shecu.chula.ac.th/data/boards/617/chemical-safety-manual-students-research.pdf
- https://www.shecu.chula.ac.th/data/boards/1018/2025-chemsafe-document.pdf

All page citations are 1-based PDF pages, not printed page numbers. questions.json is the production bank. source-audit.json retains all complete occurrences and provenance. No selected radio button or handwritten tick was treated as authoritative.

Adaptive practice drains a shuffled coverage queue and reserves every third draw for eligible weak questions. Recently seen questions are avoided when alternatives exist. Thus all questions receive exposure even if answers remain wrong. Exams prioritize never-seen scored questions, contain no duplicates, and reveal explanations only after submission. Configurable time/length are practice settings, not official exam requirements.

Progress and active sessions use localStorage. No cross-device sync. Export/import on the overview supports transfer. Refreshing or updating does not erase progress. There is no service worker or offline cache which could trap old versions. Bump both asset query versions and meta.version when publishing code/data updates.

Validation:
```
node --test core.test.mjs
node app.test.mjs
node validate.mjs
```
The app test is an isolated DOM-stub interaction test, not a visual browser test. Browser QA was unavailable in the execution environment. No existing repository files outside /chemsafe were changed.
