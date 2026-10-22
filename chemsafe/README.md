# ChemSafe 3.1

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

Progress uses localStorage; no automatic cross-device sync. Export/import supports transfer. There is no service worker. Asset query versions and meta.version are 3.1.0/v3.1 so the update button loads the revised code and bank without clearing progress. The v3→v3.1 upgrade preserves scores, coverage, bookmarks, history and the current unanswered practice question.

## Quick review

The “ทบทวนเร็ว” navigation item and `https://apirak09.github.io/chemsafe/?v=3.1#study` open a read-only review of all142 questions without pagination. Every card shows its single best answer, explanation, reference links and any wording-revision notice. All choices are available per question or via an “แสดงทุกช้อยส์” checkbox. The answer is always visible for rapid review.

Keyword search defaults to question stems and question IDs; an optional scope searches choices too. Multiple space-separated keywords use AND matching. Matching normalizes Unicode, whitespace, zero-width characters and Latin case; displayed literal matches are highlighted safely. Category, last-wrong, bookmark, unseen and revised filters can be combined. Search updates only results so typing/caret/IME input is not disrupted. Opening or searching review never records an answer, changes a score, consumes a coverage question or replaces active practice/exams. Only explicitly clicking a bookmark changes bookmarks.

Validation:
```
node --test core.test.mjs migration.test.mjs
node --test study.test.mjs
node app.test.mjs
node study-ui.test.mjs
node round-ui.test.mjs
LEGACY=1 node round-ui.test.mjs
node validate.mjs
```
The automated app tests use a DOM stub. They render and answer every production question and check exactly one highlighted answer. Round UI regressions cover an entirely wrong full pass, a v2 user with seven questions remaining, explicit restart, and finite wrong-only review. Quick-review tests cover search scope, Unicode and regex safety, combined filters, IME, all142 answer panels, direct links, bookmarks, and preservation of active practice/exams and progress. Desktop browser QA for v3.1 verified layout, keyword search, displayed choices, bookmarking and bookmarked filtering using the supervised preview; no application console errors were observed. Mobile breakpoint styles are included but mobile visual QA was not performed. Changes are confined to /chemsafe.
