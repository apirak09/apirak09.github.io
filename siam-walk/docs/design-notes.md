# Interface revision · 1 November 2026

The first version used small, low-contrast text and an editorial sidebar. The revision follows the user's illustrated paper-map reference and removes decorative slogans.

- Map first, with photo markers on larger screens and readable name flags on phones.
- Thai handwritten headings: Itim. Body text: IBM Plex Sans Thai, 16 px on phones and 17 px on larger screens. Map labels: 18–20 px.
- Schedule and venue information open in a dismissible dialog; phones use a bottom sheet.
- Map controls are at least 44 × 44 CSS px; venue targets are larger. Real route geometry, stop durations, date and countdown timezone are preserved.
- Photo flags use leader lines to their actual coordinates. A deterministic placement pass avoids collisions after zoom and resize.
- Primary, secondary and accent text all exceed 4.5:1 contrast on their respective surfaces. Reduced motion disables sheet animations; map fitting does not animate.

Applied [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill): read SKILL.md, quick-reference.md and pro-rules.md; ran a design-system query and explicit style and touch-spacing searches. The generic design-system style result did not fit the supplied reference, so it was not adopted or persisted. The explicit paper-texture search returned Skeuomorphism; the typography search supported a casual handwritten direction. Itim supplies Thai coverage.
