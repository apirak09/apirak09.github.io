# ChemSafe 2.0

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

Adaptive practice drains a shuffled coverage queue and reserves every third draw for weak questions. Exams use all live questions and do not repeat a canonical item within one set. The loader rejects zero/multiple-answer items and duplicate semantic keys.

Old visited counts, bookmarks, queues and selected options migrate through canonical aliases and option-order maps. Revised questions keep visit counts and bookmarks but require a fresh answer. Old active exams containing revised wording are cleared rather than silently grading answers against changed text. Completed history remains stored. Migration runs once per bank version.

Progress uses localStorage; no automatic cross-device sync. Export/import supports transfer. There is no service worker. Asset query versions and meta.version are2.0.0/v2 so the update button loads the revised code and bank without clearing progress.

Validation:
```
node --test core.test.mjs migration.test.mjs
node app.test.mjs
node validate.mjs
```
The app test uses a DOM stub, not a visual browser. It renders and answers every production question and checks exactly one highlighted answer. Browser QA was unavailable in this environment. Changes are confined to /chemsafe.
