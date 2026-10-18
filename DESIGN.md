---
name: Steel City Codes // Denver
description: Terminal Yellow. Every screen is a junction sign; the one next decision stands in a gold band, everything else is a list.
colors:
  shell-ink: "#1A1613"
  shell-ink-raised: "#2B2620"
  on-shell: "#FFFFFF"
  on-shell-muted: "#CFC9BF"
  sign-gold: "#F1C446"
  sign-gold-press: "#E2B12C"
  on-sign: "#1A1613"
  on-sign-muted: "#4A3D10"
  concourse-floor: "#F4F4F1"
  surface-white: "#FFFFFF"
  text-ink: "#1A1613"
  muted-ink: "#57524A"
  rule-ink: "#1A1613"
  hairline: "#CFCBC3"
  field-stroke: "#7A756C"
  danger-red: "#B3261E"
  danger-wash: "#FBE8E6"
  ok-green: "#1E6B3A"
  ok-wash: "#E3F1E8"
  alarm-red: "#B3261E"
  dark-shell-ink: "#0B0A09"
  dark-shell-ink-raised: "#24201B"
  dark-on-shell-muted: "#BDB6AB"
  dark-floor: "#141210"
  dark-surface: "#1D1A17"
  dark-text: "#F2EFE9"
  dark-muted: "#B3ACA1"
  dark-hairline: "#3A3530"
  dark-field-stroke: "#8E887E"
  dark-danger: "#FF8F86"
  dark-danger-wash: "#3A1714"
  dark-ok: "#7FD39E"
  dark-ok-wash: "#13301F"
  dark-alarm-red: "#A8221B"
typography:
  display:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3.5rem"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.03em"
    fontFeature: "\"tnum\", \"lnum\""
  headline:
    fontFamily: "Josefin Sans, Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  message:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 800
    lineHeight: 1.15
  title:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  row:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"tnum\""
  label:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.3
rounded:
  r: "4px"
  tick: "2px"
  pill: "999px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "20px"
  s6: "24px"
  s8: "32px"
  s10: "40px"
  s12: "48px"
  gutter-phone: "16px"
  gutter-wide: "32px"
  tap: "44px"
components:
  button-primary:
    backgroundColor: "{colors.sign-gold}"
    textColor: "{colors.on-sign}"
    typography: "{typography.body}"
    rounded: "{rounded.r}"
    padding: "0 20px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.sign-gold-press}"
    textColor: "{colors.on-sign}"
  button-ink:
    backgroundColor: "{colors.shell-ink}"
    textColor: "{colors.sign-gold}"
    rounded: "{rounded.r}"
    padding: "0 20px"
    height: "48px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text-ink}"
    rounded: "{rounded.r}"
    padding: "0 20px"
    height: "48px"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.danger-red}"
    rounded: "{rounded.r}"
    padding: "0 20px"
    height: "48px"
  input:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.text-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.r}"
    padding: "10px 12px"
    height: "48px"
  sign-band:
    backgroundColor: "{colors.sign-gold}"
    textColor: "{colors.on-sign}"
    rounded: "{rounded.r}"
    padding: "{spacing.s4}"
  sign-band-hover:
    backgroundColor: "{colors.sign-gold-press}"
  sign-band-ink:
    backgroundColor: "{colors.shell-ink}"
    textColor: "{colors.on-shell}"
    rounded: "{rounded.r}"
    padding: "{spacing.s4}"
  sign-band-alarm:
    backgroundColor: "{colors.alarm-red}"
    textColor: "{colors.on-shell}"
    rounded: "{rounded.r}"
    padding: "{spacing.s4}"
  go-arrow:
    backgroundColor: "{colors.shell-ink}"
    textColor: "{colors.sign-gold}"
    rounded: "{rounded.r}"
    size: "48px"
  pictogram:
    backgroundColor: "{colors.shell-ink}"
    textColor: "{colors.on-shell}"
    rounded: "{rounded.r}"
    size: "40px"
  status-ok:
    backgroundColor: "{colors.ok-wash}"
    textColor: "{colors.ok-green}"
    typography: "{typography.label}"
    rounded: "{rounded.r}"
    padding: "6px 8px"
  status-danger:
    backgroundColor: "{colors.danger-wash}"
    textColor: "{colors.danger-red}"
    typography: "{typography.label}"
    rounded: "{rounded.r}"
    padding: "6px 8px"
  segmented-selected:
    backgroundColor: "{colors.shell-ink}"
    textColor: "{colors.on-shell}"
    height: "44px"
  tab:
    backgroundColor: "{colors.shell-ink}"
    textColor: "{colors.on-shell-muted}"
    height: "48px"
  tab-active:
    backgroundColor: "{colors.shell-ink}"
    textColor: "{colors.on-shell}"
---

<!-- TARGET SYSTEM. This file records Terminal Yellow as built in the mockup at
     design/impeccable-audit/mockup/ (system.css, css/*.css, screens/*.html). The shipping app in src/
     still runs the old cream / Josefin system documented in design_system.md; that file describes the
     incumbent, this one describes the world the app is moving to. Where they disagree, new work follows
     this file. -->

# Design System: Steel City Codes // Denver

> **Status: target, not yet shipped.** Every token and rule below is taken from the Terminal Yellow mockup (`design/impeccable-audit/mockup/`). The app in `src/` still uses the older cream and Josefin system recorded in `design_system.md`. This DESIGN.md is the system the app is migrating to.

## Overview

**Creative North Star: "The Junction Sign"**

Every screen is a sign at a transit junction. The one next decision for this person stands in a single gold band at the top: a short line of context, the number they act on (room, time, count, seats) at monumental scale, an ink arrow square locked to the edge it points past, and a one-line message. Everything after the band is the list of other decisions, one per line, each named by a white-on-ink pictogram square. There is no dashboard of equal white cards, no stat tiles, no icon eyebrows.

The world is a quiet neutral concourse (not cream) with ink furniture. Content sits straight on the floor; the only containers are signs and data tables. Hierarchy comes from the type scale and from rule weight: a heavy 2px ink rule between decisions, a 1px hairline between rows of one dataset. It is one ply: nothing floats, nothing casts a shadow. Gold is the wayfinding colour and is rationed to three places. Red and green sit on top of the world only where they carry meaning.

The world is built for a phone in someone's hand (parents at the registration minute, teen volunteers taking roll call standing up) and opens up to density on the admin's laptop. Targets are 44px or larger, inputs are 16px, settings live under the avatar, and nothing is a modal. At night the floor goes dark and the signs stay lit.

**Key Characteristics:**
- One gold sign band per view carries the next decision and its figure.
- Gold only for the sign band, the active tab marker and the one primary action.
- Ink shell (bar, tabs, admin rail) with white-on-ink pictogram squares.
- Neutral concourse floor (#F4F4F1); white only for fields and data tables.
- 2px ink rules between decisions, 1px hairlines within a dataset.
- One ply, no shadows, 4px corners.
- Atkinson Hyperlegible Next with tabular numerals; Josefin Sans for page titles only.
- Split-flap figure updates, instant under reduced motion.

## Colors

An ink-and-concourse neutral world with one rationed wayfinding gold and two state colours that only appear when they mean something.

### Primary
- **Terminal Gold** (sign-gold): the sign band, the 4px active-tab marker, the one primary button on the floor, and the current admin rail item's pictogram. Always carries ink text (on-sign, 10.9:1); muted text on gold uses on-sign-muted (6.6:1). It stays the same value in dark mode: signs stay lit.
- **Gold, Pressed** (sign-gold-press): hover and press on a linked sign band, a demo-login seat row and the primary button.

### Secondary
- **Shell Ink** (shell-ink): the ink bar, tab strip, admin rail, pictogram squares, the arrow square, the ink button and the selected segment. The same ink is the text colour and the 2px rule. **Raised Ink** (shell-ink-raised) is hover and current item on the shell and the resting pictogram well in the rail.
- **On-Shell / On-Shell Muted**: white for current items and icons on ink; warm grey (11.4:1 on ink) for idle tabs, rail items and search placeholder.

### Tertiary (state)
- **Safety Red** (danger-red, with danger-wash): health and allergy lines, destructive actions, blocking validation errors, the danger pictogram and the inline confirm frame. **Alarm Red** (alarm-red) is the white-on-red alarm sign (unaccounted campers); in dark it deepens to dark-alarm-red so white holds 6.6:1.
- **Done Green** (ok-green, with ok-wash): confirmed status, "Present" in roll call, completed steps, the settled roll-call line.

### Neutral
- **Concourse Floor** (concourse-floor): the page. Neutral, deliberately not cream.
- **Surface White** (surface-white): fields, choice rows, data tables, the avatar menu, the printable sheet. Never used as a card behind ordinary content.
- **Ink Text** (text-ink, 16.6:1 on floor) and **Muted Ink** (muted-ink, 7.0:1 on floor): body and meta.
- **Hairline** (hairline): 1px between rows of one dataset, and choice-row borders at rest. Not a boundary.
- **Field Stroke** (field-stroke, 4.4:1 on white): the 2px border of inputs, selects and roll-call toggles, and dashed "not final / not yet" frames.

### Dark
The terminal at night. The floor and surface go dark (dark-floor, dark-surface), text and the 2px rule become bone (dark-text), hairline and field stroke lift for contrast, red and green brighten (dark-danger, dark-ok) over deep washes. Gold does not change. Selected segments, the ink button and option squares invert to bone fill on dark floor rather than ink-on-ink. The focus ring turns gold.

### Named Rules
**The Wayfinding Gold Rule.** Gold appears in exactly three roles on a view: the sign band, the active tab marker and the one primary action. The primary action is the sign's arrow or a single gold button on the floor, never both. Everything else that is "on" (switches, selected segments, sub-tab underlines, seat meters) is ink.

**The Meaningful Red Rule.** Red is for safety, destruction and blocking validation errors only. "Needs a person soon" (no lead, open slot, no roll call yet) is ink weight with a drawn icon, never red. A full seat meter is ink, never red or gold.

**The Gold Never Text Rule.** Gold is a ground, never a text colour on the light floor or white. Gold text appears only on ink (the arrow, the ink button, the figure in an ink sign).

## Typography

**Display / UI Font:** Atkinson Hyperlegible Next (weights 400, 600, 700, 800), falling back to ui-sans-serif, system-ui
**Brand Title Font:** Josefin Sans 700, falling back to the UI face

**Character:** A legibility-first humanist sans does all the work in sentence case, with tabular numerals everywhere so counts, times and seats line up. Josefin Sans appears once per page, as the page title, carrying the brand without costing legibility.

### Hierarchy
- **Display** (800, 3.5rem on phone / 4.5rem from 768px, line-height 0.92, -0.03em, tabular lining): the sign band's monumental figure only. Units after it drop to 0.42em.
- **Headline** (Josefin Sans 700, 1.75rem, 1.15, -0.01em, balanced): the page title (h1). The only Josefin on any screen.
- **Message** (800, 1.375rem, 1.15, balanced): the sign band's message line.
- **Title** (700, 1.375rem, 1.2, -0.01em): section headings (h2).
- **Row** (700, 1.125rem, 1.3): h3, a decision's sentence, a person or class name in a row, section codes set like gate numbers (800, +0.02em).
- **Body** (400, 1rem, 1.5, tabular numerals): running text, field values, table cells. Legal text caps at 65ch.
- **Label** (700, 0.875rem): sign context line, meta, table headers, status words, rail counts. Sentence case, no tracking.

Buttons are 800 at 1rem. Field labels and legends are 700 at 1rem.

### Named Rules
**The One Josefin Rule.** Josefin Sans sets the page title and nothing else: no Josefin headings, buttons, figures or labels.

**The Sentence Case Rule.** Every label, tab, button and status is sentence case with no letter-spacing. The only tracked text is the one-time-code field, which is a code.

**The Tabular Rule.** Numerals are tabular across the whole UI (`font-variant-numeric: tabular-nums` on body).

## Layout

Single column on the phone, max content width 1280px. Gutter is 16px below 768px and 32px from 768px. Spacing is a 4-unit scale (4, 8, 12, 16, 20, 24, 32, 40, 48); sections sit 40px apart, a page head 20px above its content. Narrow pages cap at 760px, forms at 640px with one column and labels above fields (two-up pairs from 480px).

- **Shell (parents, volunteers):** a sticky 56px ink bar with the wordmark left and the avatar right, then a 48px ink tab strip of equal-width top tabs. From 768px the bar grows to 64px and the tabs move inline into it. Top tabs, never a bottom bar.
- **Shell (admin):** ink bar with search; below 1024px an ink tab strip; from 1024px a 232px sticky ink rail (five jobs plus Setup, current item with a gold pictogram) beside left-aligned content. Two columns from 1024px (7fr / 5fr), 3:2 from 1280px.
- **Signed out:** the ink bar alone, not sticky. The desktop login splits 5:7 with the demo seats on ink at left.
- **Sign band:** first thing in the page flow. A sticky variant goes full bleed to the gutter edge under the shell (camp-day roll call); on a phone during camp day the shell scrolls away so only the roll-call band sticks.
- **Schedules:** block height equals duration (timetable rows scale with minutes); stable identifiers sit in a fixed left column like gate numbers.
- **Viewport:** `100dvh` and safe-area padding on the shell and footer. Check at 375px in light and dark.

## Elevation & Depth

None. The system is one ply: no drop shadows anywhere, no floating cards, no layered surfaces. Depth is conveyed by ground (gold sign, ink shell, white field) and by rule weight. The only `box-shadow` values in the build are inset lines doing the job of borders: the 4px gold (or ink, on sub-tabs) underline on the current tab, a 2px inset frame on a waiting status or an expanded admin section, and a 1px inset seam under the shell and roll-call band in dark mode.

### Named Rules
**The One Ply Rule.** Nothing casts a shadow. If something needs to stand out, change its ground or its rule, not its elevation. Inline popovers (the avatar menu) are framed with a 2px ink rule, not lifted.

**The Rule Weight Rule.** A 2px ink rule separates decisions, frames a dataset and closes a form; a 1px hairline separates rows inside one dataset. Never box a group of rows in a card.

## Shapes

Corners are a firm, nearly square 4px on every control, sign, field, pictogram, arrow and status. 2px appears only on the focus outline, the seat meter and paper checkboxes; full pills only on the rail count badge, the avatar ring and the switch. Borders are 2px when they are a boundary (fields, secondary buttons, segmented controls, confirm frames, selected choices) and 1px when they divide. Dashed 2px frames mean "not final" (placeholder legal text) or "not yet" (a list visible but not usable). The sticky sign band goes square-cornered when it bleeds to the screen edges.

## Components

### Buttons
Heavy, square, 48px tall, never more than one gold per view.
- **Shape:** 4px corners, 2px border slot, 0 20px padding, 800 weight at 16px.
- **Primary:** gold with ink text; pressed gold on hover. Wizard nav puts it right of Back, full width beside Back on a phone.
- **Ink:** ink with gold text, for the strong secondary action (and on a gold sign). Bone fill with dark text in dark mode.
- **Secondary:** transparent with a 2px ink border; a 6% ink wash on hover. On a sign the border and text become on-sign ink.
- **Danger:** transparent with a red border and red text; filled alarm red when it sits on gold.
- **Text link:** 700, underlined (offset 3px), 44px tall target; muted and danger variants.
- **Disabled:** 45% opacity, not-allowed cursor.

### Sign Band (signature)
The junction sign: gold, 4px corners, 16px padding, a two-column grid. Context line (label, on-sign-muted), monumental figure (display), message (message), one supporting line, and a 48px ink arrow square with a gold arrow at the right. A linked sign presses to pressed gold. Variants: **ink** (camp-day roll call, gold figure, inverted arrow), **alarm** (white on alarm red, for unaccounted campers), **quiet** (transparent with a 2px ink frame), and **sticky** (full bleed, square corners). The figure updates with a split-flap swap (160ms, two steps, scaleY), instant under reduced motion. Wizards add a segmented step rail (6px segments) and a step label inside the band.

### Decision List (signature)
One decision per line between 2px ink rules: a 40px white-on-ink pictogram square (red for safety), the decision as a row-weight sentence, a muted reason, then one action. A plain variant drops the pictogram.

### Rows and Data Tables
Rows of one dataset are divided by 1px hairlines and framed top and bottom by 2px ink rules. Admin tables sit on the floor between 2px ink rules with a sticky header (label type, muted, 1px ink under it), 12px cells, right-aligned numerals, and a faint hover tint. Safety text wraps, never truncates. Under 768px many tables reflow to rows instead of scrolling.

### Status Words
Inline, 14px 700, 6px 8px padding, 4px corners. Done is green on green wash; danger is red on red wash; waiting is ink text in a 2px inset ink frame; plain is muted text with no box. Each carries a drawn icon.

### Inputs / Fields
- **Style:** white, 2px field-stroke border, 4px corners, 48px minimum height, 10px 12px padding, 16px text (never smaller). Textareas start at 112px. Placeholders are muted ink.
- **Focus:** border and a 2px outline in ink (gold in dark).
- **Error:** red border plus a red 14px 700 message with an icon under the field.
- **Choice rows:** real radios and checkboxes in 52px white rows with a hairline border; selected becomes a 2px ink frame.
- **Segmented control:** one component for weeks, roll calls, filters and campers. 2px ink frame and dividers, 44px items; selected is an ink fill with white text.
- **Switch:** a real checkbox with switch role; on is ink, never gold.

### Navigation
Ink bar and tab strip. Idle tabs are on-shell-muted 700; hover is white; the current tab is white with a 4px gold inset underline. Admin rail items are 48px with a raised-ink hover; the current item is raised ink with its pictogram turned gold. Sub-tabs on the floor use ink text and a 4px ink underline (gold stays in the shell). The avatar (44px, 2px ring, gold ring on hover) opens an inline popover under it framed by a 2px ink rule, holding profile, settings and the theme toggle.

### Inline Confirm
Sits directly under the thing it changes: 2px red frame, 16px padding, a bold sentence and its actions. Never a modal.

### Roll Call
Full-bleed rows on the phone, name and a 132px-wide toggle on one line, health and a call line full width beneath. Present is green on green wash; absent is red on red wash and tints the row. Allergy lines are always visible, never behind a tap.

## Do's and Don'ts

### Do:
- **Do** put the one next decision in a single gold sign band at the top, with its number at display scale and the ink arrow square at its edge.
- **Do** ration gold to the sign band, the 4px active-tab marker and one primary action per view.
- **Do** separate decisions with 2px ink rules and rows of one dataset with 1px hairlines.
- **Do** set content straight on the concourse floor; reserve white for fields, choice rows and data tables.
- **Do** keep every target at 44px or larger (buttons and fields 48px) and every input at 16px.
- **Do** use red for safety, destruction and blocking validation errors, green for done, and ink weight with a drawn icon for "needs attention".
- **Do** confirm inline under the thing being changed; edit profile and settings from the avatar menu.
- **Do** use drawn line icons (2.25 stroke at 20px, 2.5 at 16px) inside pictogram squares and next to status words.
- **Do** keep safety information (allergies, medical notes, emergency phones, unaccounted campers) visible without a tap.
- **Do** keep gold unchanged in dark mode and invert selected states to bone fill rather than ink on ink.

### Don't:
- **Don't** use gold as text on the light floor or white, or for switches, meters, sub-tab underlines, status chips or decoration.
- **Don't** show a gold sign arrow and a gold floor button for the same action on one view.
- **Don't** add shadows, floating cards, stat tiles or a dashboard of equal white cards.
- **Don't** set anything but the page title in Josefin Sans.
- **Don't** use uppercase labels, tracked eyebrows or kickers above headings.
- **Don't** use red for "no lead yet" or a full class.
- **Don't** open a modal; don't put primary navigation in a bottom bar.
- **Don't** use a cream floor; the concourse is neutral.
- **Don't** truncate safety text in tables; let it wrap.
