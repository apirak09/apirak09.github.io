# Cognia — MBTI Cognitive Functions Field Guide

Independent, bilingual learning site at `https://apirak09.github.io/mbti/`.

Ten lessons progress from preferences to eight cognitive functions, balancing axes, stack derivation, sixteen type patterns, development/stress, self-observation, supplementary models, and evidence/application. There is no history curriculum. Thai and English content is authored directly rather than translated at runtime.

## Explore

- Eight functions, each with processing emphasis, strengths, blind spots, misconceptions, two original scenarios, reflection, and a practical experiment.
- All sixteen primary stacks. Click a position to inspect the function and its proposed role.
- Eighteen detailed comparisons: six function pairs and twelve type pairs. Any other pair can be compared structurally, explicitly labeled as lacking a pair-specific article.
- Thirty-two original knowledge questions, with a single best answer, shuffled questions and options, per-answer explanations, full-bank or topic rounds, and missed-question practice. This is not a personality assessment or an official MBTI questionnaire.
- Search, per-lesson read/unread markers, and personal notes. Language changes preserve the current route, completed lessons, notes, question order, and selected answers. Progress and notes use localStorage; the active round uses sessionStorage. Storage failures fall back to in-page state.

## Model and evidence boundaries

The displayed stack convention alternates attitudes and gives the tertiary the dominant’s attitude. Myers & Briggs Foundation material permits either attitude for the tertiary. Beebe’s eight archetypal roles are labeled as an extension, not an ability ranking. Loop is explained as community vocabulary, not presented as a validated mechanism. Grip is a type-dynamics interpretation, not a diagnosis.

Sources are linked in the lessons and on `#sources`: public Foundation descriptions, Cognitive Processes teaching material, Beebe’s author article, and the McCrae–Costa study abstract. Only the abstract of the empirical paper was consulted; this site does not claim a systematic evidence review. Scenarios, explanatory comparisons, and exercises are original educational material rather than typing rules.

## Runtime

Buildless static HTML/CSS/ES modules. No external fonts, analytics, network calls, credentials, or package dependencies. All entry paths are relative for GitHub Pages. No service worker is installed, so releases can refresh through versioned asset URLs without an offline cache intercepting them.

Development checks:

```sh
node --test mbti/tests/*.test.mjs
node --check mbti/app.mjs
```

Tests verify every displayed stack against a fixed table, letter-based derivation, primary/shadow relationships, bilingual content completeness, stable quiz restoration, full-bank coverage without duplicates, comparison reversal, safe note rendering, and failure-tolerant browser storage. Browser QA is recorded separately in AUDIT.md.

Release: 21 October 2026.
