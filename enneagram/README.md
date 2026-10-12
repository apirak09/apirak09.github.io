# Ennea — Bilingual Enneagram Field Guide

Dependency-free learning app at https://apirak09.github.io/enneagram/.

## Release 02 · 12 October 2026

- ENG / ไทย button on every page. Thai is editorially written for understanding rather than generated at runtime. The same model data and answer order support both languages.
- Five lessons: nine core types, 27 Chestnut–Paes subtypes, all 18 wing combinations, traditional versus both-connection arrows, and four triad frameworks.
- **Common confusions** is a separate, linkable view at `#compare/1/8`. Any two of the nine types can be compared using their core descriptions; 18 selected pairs also include an original scenario, underlying difference, reflection question and pair-specific Institute reading. Generic pairs are explicitly distinguished from detailed articles.
- Eight expandable misconceptions cover leadership, creativity, quietness, kindness, fear, anger, wings, arrows, instincts and overconfidence in typing.
- Existing `ennea-learning-v1` notes and completed lessons are retained. The preferred language is saved with them; `?lang=en` or `?lang=th` can select the language for a shared URL.
- Read/unread toggle, keyboard tabs, visible focus, source dialog with focus trapping, accessible diagrams and reduced-motion support.
- Twenty original knowledge questions, lesson filters, shuffled questions/options, explanations and missed-question rounds. A round is stored in `sessionStorage` for reload within the same browser tab; language switching does not restart or reshuffle it. No personality score is produced.
- No account, analytics, remote database, external fonts or automatic translation service. Reflections use `localStorage` in this browser only. Failed storage is handled gracefully.

## Sources and evidence

Base curriculum reviewed 10 September 2026; new pair discussions reviewed 12 October 2026. The site separates a school's teaching from independent scientific validation.

| Material | Teaching / research source |
| --- | --- |
| Core types, conventional wings, traditional arrows | [Enneagram Institute](https://www.enneagraminstitute.com/how-the-enneagram-system-works/) |
| Selected pair distinctions | [Institute misidentification discussions](https://www.enneagraminstitute.com/36-type-misidentifications/) |
| Subtypes, countertypes, both-connection perspective | [Chestnut–Paes](https://cpenneagram.com/subtypes) |
| Alternative instinct terms | [Narrative Enneagram](https://www.narrativeenneagram.org/instinctual-subtypes/) |
| Hornevian, harmonic, object relations | [Enneagrammer](https://www.enneagrammer.com/triads) |
| Empirical limits | [Hook et al., 2021](https://doi.org/10.1002/jclp.23097) |

Summaries, Thai equivalents, wing blends, scenarios and reflection questions are original teaching material. Examples do not establish a person's type. The research review's abstract was consulted; the full article was not reviewed. Its mixed reliability/validity findings and limited secondary-model support are stated in Sources & evidence.

## Run and check

ES modules require HTTP(S). In a local development environment:

```sh
python -m http.server 8000
# http://localhost:8000/enneagram/
node --test enneagram/tests/*.test.mjs
```

All public asset paths are relative and work under GitHub Pages' subdirectory. No build step or dependency installation is needed. Entry assets use release query strings to refresh cached clients.

Tests cover curriculum structure, wings/arrows/triads, countertypes, source references, Thai completeness, bilingual answer alignment, migration, safe quiz restoration, comparison orientation, escaped notes and app runtime rendering in both languages. The runtime test uses a minimal DOM surface and is not browser/layout testing. See AUDIT.md for verification scope.

`navigate_enneagram_lesson` is optionally registered with WebMCP when available, using the same navigation as the visible app. Its experimental integration remains feature-detected; no unsupported API can block learning.
