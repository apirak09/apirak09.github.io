# Ennea — Interactive Enneagram Learning

A responsive, source-linked learning app covering the five requested layers of the Enneagram. Published in the `enneagram/` folder of `apirak09/apirak09.github.io`.

## Learn

- **Core types:** all nine types; motivations, fears, strengths, difficulties, illustrative situations, and private reflection prompts.
- **Instincts and subtypes:** SP, SO, SX; all 27 Chestnut–Paes subtype descriptions; the nine countertypes; six instinct-stack orders; clear terminology differences between schools.
- **Wings:** all 18 combinations, interactive neighbouring points, and illustrative comparisons that retain the core type.
- **Arrows:** all nine traditional Riso–Hudson growth and stress mappings, correct directional diagrams, and a separately labelled Chestnut–Paes view of constructive possibilities at both connections.
- **Triads:** centers, Hornevian stances, harmonic groups, and object relations. Each framework has interactive memberships and an explanatory question.
- **Practice:** 20 original knowledge questions, 4 per lesson, shuffled questions and answer positions, answer explanations with citations, lesson filters, and a missed-question review round.
- **Progress:** manually completed lessons and optional reflection notes are saved only in this browser on this device. Quiz scores are session-only. No account or remote database is used.

## Source and evidence policy

Reviewed 10 September 2026. The app distinguishes accurate presentation of a school’s teaching from empirical validation. This is an educational reflection framework, not a diagnostic tool or an automated personality assessment.

The course uses original summaries. Wing blends, scenarios, and reflection prompts are explicitly illustrative. Every lesson has source links, and the Sources & evidence view includes the reference directory. Subtype labels and countertypes consistently follow Chestnut–Paes rather than mixing naming systems.

| Material | Source |
| --- | --- |
| Core types, conventional wings, traditional arrows | [The Enneagram Institute](https://www.enneagraminstitute.com/how-the-enneagram-system-works/) and its nine individual type pages |
| 27 subtypes and countertypes | [Chestnut–Paes Enneagram Academy](https://cpenneagram.com/subtypes) and its nine individual type guides |
| Alternative instinct terminology | [The Narrative Enneagram](https://www.narrativeenneagram.org/instinctual-subtypes/) |
| Hornevian, harmonic, object relations | [Enneagrammer: Triads](https://www.enneagrammer.com/triads) |
| Empirical limits | [Hook et al., 2021, Journal of Clinical Psychology](https://onlinelibrary.wiley.com/doi/abs/10.1002/jclp.23097) |

The review assessed 104 independent samples and reported mixed reliability and validity evidence, including little research support for secondary aspects such as wings and intertype movement. Its abstract was consulted; this app does not claim a new systematic review or continuous source monitoring.

## Run and maintain

This is a dependency-free static app. Serve the directory containing `index.html` with any HTTP server. ES modules require HTTP(S), so do not rely on opening the file directly with a `file:` URL.

In the GitHub repository:

```sh
python -m http.server 8000
# Then visit http://localhost:8000/enneagram/
node --test enneagram/tests/learning.test.mjs
```

In the Sites checkout, the authored public files are under `dist/`:

```sh
node --test dist/tests/learning.test.mjs
```

All asset paths are relative, so the same app works at the site root or under the GitHub Pages subdirectory. Hash routes retain lesson, selected type, and relevant view. The existing repository's games are preserved.

## Accessibility and implementation

Native buttons, keyboard-operable tabs, visible focus, meaningful diagram button labels, skip link, reduced-motion support, responsive layouts, a focus-trapped source dialog, and text equivalents for connections and groupings. No remote fonts, images, or scripts are required. Source links open separately.

Optional WebMCP registers `navigate_enneagram_lesson` when `document.modelContext` is available. It uses the same navigation action as the UI, validates the lesson and type, and neither answers questions nor marks lessons complete. Validation in a supported browser WebMCP context was unavailable in this environment; the feature is optional and feature-detected.

Automated checks cover the curriculum, all arrow endpoints, countertype assignments, triad partitions, wing wraparound, quiz answer preservation under shuffling, source reference integrity, and malformed stored state. Browser visual/end-to-end QA was not performed.
