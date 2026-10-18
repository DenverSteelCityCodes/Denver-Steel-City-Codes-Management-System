# Build brief: Terminal Yellow mockup, every screen

You are building part of a clickable HTML mockup of the redesigned Steel City Codes // Denver app. The director chose the **Terminal Yellow** world. Static HTML + the shared CSS/JS, fictional demo data, nothing saved. This is a design deliverable, not app code: do not touch `src/`.

## Read first (in this order)
1. `.impeccable/surfaces/src-app-tsx.md` (worktree root): the **direction contract**. It binds every screen.
2. `PRODUCT.md` (worktree root): users, jobs, constraints.
3. `design/impeccable-audit/mockup/system.css` and `mock.js`: the system you build with. Read every class.
4. `design/impeccable-audit/mockup/screens/parent-home.html`: the **reference screen**. Match its head, shell, structure, density and voice exactly.
5. Your role's critique: `design/impeccable-audit/raw/A-<role>.md`, sections 6 (priority issues), 8 (element inventory) and 9 (redesign direction). Section 9 is your screen spec; the Terminal Yellow contract overrides any visual detail in it (e.g. it may say "cream", "Josefin everywhere" or "card": ignore those; use the system). Also `raw/B-detector-audit.md` for the technical findings your screens must not repeat.
6. Impeccable craft floor: `/private/tmp/claude-501/-Users-haaniemohammed-Steel-City-Codes-Management-System/7dabb1fb-ef6a-444f-8c80-d5e75865d451/scratchpad/src-impeccable/impeccable/skill/reference/craft-floor.md` and `operate.md`.
7. Real demo data for content: `design/impeccable-audit/before/*.txt` (page text of every live screen) and the screenshots beside them. Use those names, classes, rooms, times, dates and copy. Invent nothing a reviewer could mistake for a real claim; demo data is fictional and that is fine.

## The world, in rules (from the contract)
- **Yellow is wayfinding.** It appears only as: the sign band (`.sign`), the active-tab marker, and at most **one** primary action per view (`.btn--primary`), and never both a yellow sign arrow and a yellow button competing in the first viewport. Gold text appears only on ink. Everything else is ink, floor, white fields and state colours.
- **One sign per screen**, at the top of the content, holding the one next decision for this person: context line, monumental figure (room, time, count, seats, step), message, supporting line, arrow square (`.go`) when the whole band is a link. Variants: `.sign--ink` (live camp-day status), `.sign--alarm` (safety: unaccounted campers, failures), `.sign--quiet` (nothing urgent, e.g. off-season). If a screen truly has no next decision, use `.sign--quiet` or no sign; never a decorative one.
- **Decisions** (`.decisions`) one per line, 2px ink rules, a pictogram square (`.picto`) naming the decision's kind (Lucide icon, never initials or emoji). **Rows of one dataset** use hairlines (`.rows`, `table.data`). **No cards**, no shadows, no nested containers, no icon tiles, no eyebrow labels above headings, no side stripes, no pills that repeat a heading.
- **Type:** Atkinson Hyperlegible Next for everything; Josefin Sans only for the page `h1`. Floor 14px; inputs 16px; tabular numerals.
- **Status words** (`.status--ok/wait/offer/danger/plain`) once per thing, never repeated. Red only for safety, failure and destructive actions. A full class is ink, not red.
- **Safety information is never behind a tap** (`.health`, `.call` with the contact name, relationship and number visible).
- **Controls:** 44px minimum targets, 48px buttons and inputs, real `<input type=radio|checkbox>` inside `.choice` rows, `.seg` for every segmented choice, `.confirm` for inline confirms (never a modal), `details.more` for disclosure. Errors inline under the field (`.error`, `aria-invalid`).
- **Shells:** parents and volunteers get the ink bar + top tabs exactly like the reference (`.shell.shell--tabs`, `.tabs` on phone, `.tabs-inline` on desktop), avatar menu with the person's name/email, their settings link, a Dark mode switch and Sign out. Admin gets the ink bar + the `.rail` (Today, Campers, Classes, Volunteers, Updates, divider, Setup) at ≥1024px and an ink top-tab strip with the same six items under the bar below 1024px (horizontally scrollable if needed). Signed-out pages get the ink bar only.
- **No new features.** Re-layout, merge, re-word, remove freely; never invent a capability the critique doesn't say exists.
- **Copy:** plain, warm for parents, calm for staff. Controls name their action ("Register Noor for Intro to Python, Week 2"). Errors name the problem and the recovery. Use "camper", never "student". No exclamation marks except where a family hears good news ("Sam is in!").
- **Theme:** every screen must look composed in light and dark (`?theme=dark`).

## Files
- Write your screens to `design/impeccable-audit/mockup/screens/<role>-<screen>.html` using the exact `<head>` of the reference (relative `../system.css`, pinned Lucide `https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js`, `../mock.js`). Link screens to each other with relative hrefs so the mockup is clickable end to end (tabs, sign arrows, buttons that lead somewhere). Cross-role links: sign-out → `public-login.html`; demo seats → `parent-home.html`, `volunteer-today.html`, `volunteer-applicant.html`, `admin-today.html`.
- **Do not edit `system.css`, `mock.js` or another role's files.** If you need a component the system lacks, put it in `design/impeccable-audit/mockup/css/<role>.css` (link it after system.css), keep it in the system's vocabulary (tokens only, no raw hex), and list each addition in your final reply so it can be promoted.
- Write `design/impeccable-audit/mockup/notes/<role>.js` that registers every screen for the hub:
  ```js
  window.SCC_SCREENS = window.SCC_SCREENS || [];
  window.SCC_SCREENS.push({ file: 'parent-home.html', role: 'Parent', title: 'Home', state: 'Week 1 starts Monday', replaces: '/parent',
    notes: ['Sign: the one next decision (Room 202, Monday 9:00).', 'Cut: initials discs, rollup badges, icon eyebrows, the 8-row schedule (now folded).', '…'] });
  ```
  `notes` are 3–6 short lines that justify the screen against the critique: what was cut, merged or changed and why, citing the issue (e.g. "A-parent P1: Home order inverted").

## Verify before you finish
- Render every screen with `node /private/tmp/claude-501/-Users-haaniemohammed-Steel-City-Codes-Management-System/7dabb1fb-ef6a-444f-8c80-d5e75865d451/scratchpad/pw/shot.mjs <outdir> <files…>` (run it from inside that `pw` folder; it captures 390 light, 390 dark and 1440 light, and prints height, horizontal OVERFLOW and console errors). Use an outdir under that scratchpad, e.g. `.../scratchpad/shots/<role>/`. Look at the screenshots and fix what you see: overflow, wrapping, clipped text, weak hierarchy, anything yellow that isn't wayfinding, any screen taller than it needs to be.
- Run the impeccable detector on your screen files: `/private/tmp/claude-501/-Users-haaniemohammed-Steel-City-Codes-Management-System/7dabb1fb-ef6a-444f-8c80-d5e75865d451/scratchpad/imp/node_modules/.bin/impeccable detect --json <your files>` and fix every real finding (`cream-palette` cannot fire; anything else is yours).
- Two inspection rounds maximum, then stop.

Reply with only: the list of files written, any `css/<role>.css` additions, and anything you could not do.
