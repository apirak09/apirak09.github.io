# ChemSafe 3.0

Thai chemical-safety practice: https://apirak09.github.io/chemsafe/ . Static HTML/CSS/ES modules; no build or account required.

## Question bank

142 live questions, each with exactly one best answer. Version1 had165 records;23 further duplicates were consolidated, including shuffled options, transcription differences and equivalent phrasings. All206 complete source occurrences remain traceable through sourceLocations; the cropped fragment at source page47 remains documented, with no fabricated missing choices.

36 retained questions have limited wording/context revisions to make one answer defensible. These show a visible "ปรับถ้อยคำสำหรับฝึก" label, a revision explanation after answering, and original text/choices in questions.json. The remaining questions preserve the source wording. Some questions therefore differ from the original exam; this is an independently checked practice bank, not an official key.

Primary references:
- https://www.shecu.chula.ac.th/data/boards/617/chemical-safety-manual-students-research.pdf
- https://www.shecu.chula.ac.th/data/boards/1018/2025-chemsafe-document.pdf

Supplemental primary sources from CDC/ATSDR, NHS and Berkeley Lab EHS cover specific gaps such as HF, thermal burns and cryogenic vessels. Question explanations link them explicitly. All PDF page citations are1-based PDF pages, not printed page numbers.

questions.json is the production bank. revision-audit.json records consolidation decisions and old IDs. source-audit.json is the historical transcription/audit from version1, not the live answer key.

## Practice and persistence

Practice uses finite rounds. Each question is shown once until every item has been answered, regardless of correctness; the round then stops on a completion screen. A new round starts only after an explicit click. Wrong-answer and bookmark reviews are finite snapshots too. Opening one question from the bank returns to the bank after answering. Exams use all live questions and do not repeat a canonical item within one set. The loader rejects zero/multiple-answer items, duplicate semantic keys and identical question/option content even if choices are shuffled.

On upgrading from v2, the first coverage round is seeded from existing answered-question history, so users resume only questions they have not answered. Round order, completed IDs and review snapshots persist across refresh, reopening and export/import. A wrong answer is counted as completed in the current round. Original v1 visited counts, bookmarks, queues and selected options migrate through canonical aliases and option-order maps. Revised questions keep visit counts and bookmarks but require a fresh answer. Old active exams containing revised wording are cleared rather than silently grading answers against changed text. Completed history remains stored. The v1 answer-key migration runs only for v1 data; upgrading v2 to v3 does not reset mastered/revised question statistics.

Progress uses localStorage; no automatic cross-device sync. Export/import supports transfer. There is no service worker. Asset query versions and meta.version are3.0.0/v3 so the update button loads the revised code and bank without clearing progress.

Validation:
```
node --test core.test.mjs migration.test.mjs
node app.test.mjs
node round-ui.test.mjs
LEGACY=1 node round-ui.test.mjs
node validate.mjs
```
The app test uses a DOM stub, not a visual browser. It renders and answers every production question and checks exactly one highlighted answer. Round UI regressions cover an entirely wrong full pass, a v2 user with seven questions remaining, explicit restart, and finite wrong-only review. Browser QA was unavailable in this environment. Changes are confined to /chemsafe.
