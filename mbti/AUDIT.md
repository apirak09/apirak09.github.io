# Release verification — 21 October 2026

## Content

- 10 lessons, 8 detailed function profiles, 4 balancing axes, and all 16 primary stacks.
- 18 original detailed comparisons: 6 function pairs and 12 type pairs. Other selections are labeled as structural comparisons without a pair-specific scenario.
- 32 original knowledge questions, four distinct options each, one best-answer key, bilingual explanations, and at least two questions per lesson.
- Every bilingual editorial field contains both Thai and English. All referenced source IDs resolve. There is no history lesson or personality scoring.
- Tertiary-attitude convention is disclosed; Beebe, loop, and grip are distinguished from established empirical mechanisms and diagnostic claims. The empirical paper is explicitly marked as abstract-only reading.

## Automated checks

`node --check` passed for all seven application modules. `node --test mbti/tests/*.test.mjs` passed all five substantive tests:

1. All displayed stacks against an independent fixed table, letter-based derivation, and primary/shadow relationships.
2. Curriculum identity, per-lesson question coverage, source links, and comparison reversal.
3. Bilingual field completeness and aligned, distinct answer options.
4. Complete-bank coverage without repeated IDs, stable shuffled option identities, and rejection of corrupt round restoration.
5. Progress/reflection persistence, state validation, HTML escaping, and graceful storage failures.

## Browser checks

Using the running static site in Chrome:

- All ten Thai lesson routes rendered with their complete sections and without unresolved values.
- English function scenarios, reflection, detailed function/type comparisons, generic structural comparison, the advanced model lesson, sources, and search rendered successfully.
- Stack-position selection displayed the corresponding role and function. Language switching retained the chosen position and note. Reload retained the note, including literal HTML-looking text; progress markers survived navigation and reload.
- A full two-question topic round was completed with one deliberate error. Its selected answer, option order, and explanation survived language switching and reload. Results showed 1/2; a targeted repeat round contained the single missed item, showed 1/1 after correction, and disabled missed practice once none remained.
- Search for `Ni` prioritizes the exact function and relevant pairs rather than incidental substrings.
- Desktop appearance was visually inspected. Mobile CSS viewports of 390 × 844 and 320 × 844 were inspected using a temporary same-origin iframe harness. Main content stayed within its viewport; mobile drawer navigation and stack/compare layout were checked. The closed drawer is hidden from the accessibility tree.

These were viewport checks, not tests on physical Android/iOS devices. Screen-reader behavior, browser extensions, and every browser/version were not exhaustively tested. Temporary QA harnesses and the preview manifest are excluded from the published file set.

## Change boundary

Publication adds only `mbti/` files. Existing Enneagram and other projects are not part of this commit.
