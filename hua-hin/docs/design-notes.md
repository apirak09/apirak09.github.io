# Design and engineering decisions

This is a travel utility for two people, used outside on a phone. The main action is to find the next stop, understand how much time is available, and open directions. A lengthy marketing landing page would make that task harder.

## Visual direction

Warm paper, deep sea green, muted terracotta and restrained gold; an editorial serif title with locally hosted IBM Plex Sans Thai. Actual Hua Hin photography supplies the colour and identity. The hero is compact on phones, while day selection and the bottom navigation remain easy to find. Desktop shows a scrollable itinerary next to the map; phone views separate the two to preserve space.

Cards distinguish hotel rest, flexible meals, station buffers, fixed trains and transfers. The four-hour hotel break gets a photograph and a stronger surface. There is no attempt to fill every free hour with a destination.

Close points are clustered at their actual map coordinates until expanded. This specifically fixes the overlapping Cicada/Tamarind hit targets observed during QA. Every place is also available through the stop rail and timetable, so map gestures are not required.

## Guidance read and applied

| Reference | Revision read | Application |
| --- | --- | --- |
| [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/ui-ux-pro-max/SKILL.md) | `e59ff376` | Priority rules for touch, contrast, Thai text, responsive layout, reduced motion and accessible controls. Design-system searches were run; generic enterprise/Aurora marketing suggestions did not fit this personal trip app, so the final palette and task layout were designed for the brief. |
| [Taste Skill](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md) | `f6b76575` | Real photographs, plain copy, equal edges, editorial hierarchy and restrained interaction. Current v2.5's sales-page section/deal rules are not imposed on this functional itinerary; the requested interactive map and real coordinates take precedence over its place-marketing restrictions. |
| [Vercel Web Design Guidelines](https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md) | `1a2c79d4` | Latest upstream web-interface rules read: semantic controls, visible focus, safe areas, local fonts, image dimensions, URL state, reduced motion and no `transition: all`. |
| [Webapp Testing](https://github.com/github/awesome-copilot/blob/main/skills/webapp-testing/SKILL.md) | `a06ba06d` | Real Chrome UI verification using supported browser/Playwright locators, screenshots, viewport testing, persistence checks and targeted automated invariants. |

The result uses native static browser features rather than a framework. This keeps the page small, avoids hydration and deployment configuration, and fits the existing GitHub Pages repository.

## Sources and uncertainty

The hotel coordinates come from its own Google map configuration, not an unrelated similarly named map listing. The beach pin is the public road endpoint of OSM way 399832202 at Soi 61. The current Hua Hin station feature is used rather than an image-only pin on the historic station.

Cicada hours use the market operator. Tamarind uses the TAT Japan attraction page. Night market hours use Holiday Inn's local visitor compendium and are labelled approximate. Khao Takiab has no confidently verified universal opening hours, so the UI explicitly says the visit is planned in daylight and asks travellers to verify locally. Train times are preserved from the user's brief, with direct SRT timetable and tracking links.
