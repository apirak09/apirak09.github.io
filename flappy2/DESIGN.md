---
name: Flappy 2
description: Small wings across three immense hostile worlds.
colors:
  ink: "#f3f3dc"
  accent: "#e9edaa"
  on-accent: "#172020"
  muted: "#b4c1bc"
  surface: "#131e24"
  line: "#afc2bc38"
  deep: "#070e15"
  nightmare-accent: "#ffb1bd"
  nightmare-on-accent: "#3d1328"
  nightmare-muted: "#d3b8c5"
  nightmare-surface: "#251523"
  nightmare-line: "#d9afc238"
  nightmare-deep: "#100b16"
  hell-accent: "#ffc093"
  hell-on-accent: "#401e1b"
  hell-muted: "#ddc1b1"
  hell-surface: "#2b1b20"
  hell-line: "#dfb3a438"
  hell-deep: "#160e12"
  moon-sky-top: "#03090f"
  moon-sky-mid: "#111e2a"
  moon-sky-horizon: "#343e46"
  nightmare-sky-top: "#100a15"
  nightmare-sky-mid: "#301421"
  nightmare-sky-horizon: "#6a2e3b"
  hell-sky-top: "#150c0d"
  hell-sky-mid: "#522522"
  hell-sky-horizon: "#b75e38"
  pride: "#dfbaff"
  greed: "#ffe39a"
  envy: "#8fe6b2"
  wrath: "#ff9587"
  lust: "#ffafd2"
  gluttony: "#d6de94"
  sloth: "#e7c688"
typography:
  display:
    fontFamily: "Chakra, sans-serif"
    fontSize: "clamp(60px, 6.5vw, 96px)"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Chakra, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "18px"
    fontWeight: 750
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Manrope, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.75
  reading:
    fontFamily: "Manrope, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.85
  label:
    fontFamily: "Manrope, sans-serif"
    fontSize: "11px"
    fontWeight: 800
    letterSpacing: "0.14em"
  action:
    fontFamily: "Manrope, sans-serif"
    fontSize: "15px"
    fontWeight: 800
  score:
    fontFamily: "Chakra, sans-serif"
    fontSize: "52px"
    fontWeight: 700
    lineHeight: 1
rounded:
  key: "3px"
  control: "6px"
  panel: "12px"
  circle: "50%"
spacing:
  action-gap: "6px"
  group-gap: "12px"
  row-gap: "15px"
  section-gap: "20px"
  menu-gap: "25px"
  dialog-inset: "28px"
  panel-inset: "30px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "15px 21px"
  button-primary-hover:
    backgroundColor: "{colors.ink}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  button-icon:
    backgroundColor: "#080e1740"
    textColor: "{colors.ink}"
    rounded: "{rounded.circle}"
    size: "44px"
  world-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    padding: "14px 14px 14px 7px"
  state-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "30px"
  select:
    backgroundColor: "{colors.deep}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "9px 25px 9px 10px"
---

# Design System: Flappy 2

## Overview

**Creative North Star: "Small wings, immense worlds"**

A small, determined bird sits against immense procedural landscapes. Lunar silver and acid ivory establish the quiet baseline; blood rose and lava amber shift the same controls into Nightmare and Hell. Fine contours, soft atmospheric gradients, and tangible buttons keep the scenes illustrated while controls stay precise.

The playfield fills the viewport. The menu gives way to edge information during flight, and a compact centered panel handles pause and results. The interface uses original Canvas creatures and inline SVG contours rather than an image-heavy component shell.

Death counts sit alongside personal records: the menu footer shows selected-world deaths and the all-world total, the bottom flight HUD shows DEATHS, and results use four stat columns including Deaths. Each actual crash increments its world count once; pausing, leaving a run, and preparing a retry do not.

**Key Characteristics:**

- Three mode-bound palettes on one shared control system.
- Full-viewport scenery with compact edge information.
- Chakra numerals and display; Manrope instructions and controls.
- Dashed warnings become solid active hazards.

This record is extracted from `styles.css`, `index.html`, `renderer.mjs`, `app.mjs`, and the shared engine palettes. The finish review covered source and Canvas evidence; browser DOM layout and device screenshots were unavailable.

## Colors

The frontmatter is normative. Unprefixed interface colors are Moon defaults; `nightmare-` and `hell-` entries are the exact overrides applied by the root mode attribute.

### Primary

- **Acid ivory:** Moon's selected world, launch action, icons, and score feedback.
- **Blood rose:** Nightmare's corresponding interface roles.
- **Lava amber:** Hell's corresponding interface roles.

### Secondary

The seven named sin colors identify encounter announcements and matching Canvas hazards. They support recognition alongside shapes and instructions: crowned gates, guarded gold, the green echo, lightning, a rose, jaws, and amber fog.

### Neutral

Shared warm ink carries high-priority text. Each world has its own muted text, deep background, surface, and translucent divider. The renderer's sky entries are the actual gradient stops at (0), (.62), and (1); they are scene materials, separate from interface surfaces. Terrain is built from three progressively darker silhouettes.

**The World Binding Rule.** Changing worlds updates accent, on-accent, muted text, surface, divider, and deep background together; ink stays shared.

**The Warning Grammar Rule.** Keep warning sightlines dashed and active beams solid. Wrath warnings and beams span the visible playfield even while the emitter is offscreen.

## Typography

**Display Font:** Chakra, the self-hosted Chakra Petch Bold face, with sans-serif fallback.
**Body Font:** self-hosted Manrope variable (200–800), with sans-serif fallback.

Chakra's angular letters and tabular scores give the flight a mechanical voice; Manrope carries compact controls and readable explanations. No external font request is required.

### Hierarchy

- **Display:** title; the frontmatter records the desktop clamp, with responsive overrides below.
- **Headline:** pause-panel title; native dialog titles use (28px), and result titles use (29px).
- **Title:** world names; selected names inherit the active accent.
- **Body:** short introductory copy; **Reading:** guide paragraphs and sin explanations.
- **Label:** live mode status. Other utility text and the footer stay at least (11px); settings descriptions, scene-note copy, and crash advice use (12px).
- **Action:** primary buttons. **Score:** live desktop score; mobile uses (42px), short landscape (40px), and results use (76px) before responsive overrides.

**The Reading Split Rule.** Use compact labels for live status and records; use the reading role for the flight guide. Preserve the larger help-text overrides when changing responsive styles.

## Layout

The app uses the full available width and dynamic viewport height (`100dvh`, with `100vh` fallback). Canvas scales from a fixed logical height (720); logical width expands with aspect ratio. There is no forced portrait arena. The player stays near the left edge while wider screens reveal more approach distance.

The default menu is left-aligned at `clamp(36px,7vw,128px)`, width `min(410px,34vw)`, with the title, three divided world rows, and a full-width launch action. Top controls and the flight HUD use edge offsets plus safe-area insets. The common rhythm is small action gaps, generous row gaps, and panel insets from the frontmatter.

- Above (1700px), the menu grows to (430px) and moves to (9vw).
- Portrait at or below (650px) anchors controls above the footer, with (25px) side offsets; the right-side world note disappears.
- Short landscape at or below (540px) height uses two menu columns and a two-column result panel. At or below (560px) width, the menu uses (90vw) with a narrower title column. At or below (430px) landscape width, it becomes a scrollable single column between the top controls and footer.
- Portrait refinements at (380px) width and (680px) height reduce title and row sizes. Landscape below (350px) height omits secondary row descriptions. These are implemented breakpoints, not claims of device testing.

## Elevation & Depth

Canvas gradients, silhouettes, craters, atmospheric halos, and layered terrain supply scenic depth. Interface panels use thin borders, tonal separation, dark backdrops, and diffuse shadows. There is no hard offset-shadow vocabulary. The sidecar records the exact primary, panel, dialog, and toast shadows.

Button movement is brief: the primary action rises (2px) on hover and presses down (1px); icon buttons scale to (.93) on press. The shared easing curve is recorded in the sidecar. Reduced motion removes CSS transitions/animations and decorative Canvas drift, particles, flashes, and shake while retaining gameplay and warning geometry.

## Shapes

Controls have gently squared corners; panels and dialogs have a softer, larger radius. Round icon buttons and radio indicators contrast with the ruled world rows. Interface borders are thin (1px); custom SVG symbols use round caps and joins with a (1.6px) stroke. Canvas hazards keep their own recognizable silhouettes rather than sharing a generic card frame.

## Components

- **Primary action:** active-world fill and contrasting dark text; full-width launch/retry/resume variants. Default minimum height (54px), reducing to (48px) on short portrait screens. Hover uses shared ink and the raised shadow; disabled controls use opacity (.55).
- **Secondary action:** transparent fill, thin world divider, minimum height (48px), and a subtle light hover wash. Used for returning to world selection and closing settings.
- **World selector:** a vertical radiogroup of three flat rows, default minimum height (77px). The checked row has a faint fill, accent symbol/name, and filled radio dot. Arrow keys, Home, and End move the roving selection; each row carries its own best score.
- **Edge controls and HUD:** circular SVG buttons, normally (44px) square; pointer input belongs to the controls rather than the HUD wrapper. A centered score, left-side phase, bottom elapsed time, best score and death count, and temporary centered danger instruction leave the action open.
- **Panels and dialogs:** pause/results use a compact bordered surface over a dark full-screen scrim. Results retain a four-column stat row including Deaths. Settings and help use native dialogs with scrollable content. Pause/results trap keyboard focus and make background controls inert; native dialogs restore the previous focus on close.
- **Settings:** native switches, range, and select, tinted with the active accent. The select is capped at (110px) width; switches use (40px × 28px) after the legibility override.
- **Hazard cues:** Nightmare sightlines and marked safe corridors precede attacks. Hell uses distinct sin geometry, a temporary named instruction, and matching color; Wrath's offscreen emitter remains clamped into view while its warning/beam spans the viewport.

All keyboard focus uses an accent outline (3px) offset by (5px). Preserve those rings in component extensions.

## Do's and Don'ts

### Do:

- **Do** bind controls to the active world through the existing CSS custom properties.
- **Do** preserve full-height scaling and safe-area offsets when changing the viewport layout.
- **Do** keep explicit warning geometry, focus outlines, and reduced-motion behavior alongside visual changes.

### Don't:

- **Don't** replace the three world identities with difficulty labels.
- **Don't** stretch the Canvas to a fixed portrait arena or crop away the extra world visible on wide screens.
- **Don't** shrink guide paragraphs to compact HUD-label sizes.

Not canonized or repaired: no unresolved source-level finish finding is made a system rule. Browser layout remains unverified because browser tooling was unavailable.
