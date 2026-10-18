# Steel City Codes // Denver — impeccable critique + audit

Method: dual-agent (A: four isolated design reviewers, one per area: signed-out, parent, volunteer, admin · B: impeccable detector + technical audit). A never saw detector output.
Run: 2026-10-17 · code at `main` 47160cf · live demo scc.haanie.com (fictional data) · 25 routes captured at 390×844 and 1440×900, light and dark · impeccable 4.6.0 skill playbooks (`critique.md`, `audit.md`, `craft-floor.md`, `operate.md`) · product context in `PRODUCT.md`.

Evidence: `before/` (screens), `raw/A-public.md`, `raw/A-parent.md`, `raw/A-volunteer.md`, `raw/A-admin.md` (full heuristics, personas and the element-by-element inventories with file:line), `raw/B-detector-audit.md` (detector JSON, axe, contrast tables).

---

## Scores

### Design Health (Nielsen, 0–4 each)

| # | Heuristic | Signed-out | Parent | Volunteer | Admin | The pattern behind the low scores |
|---|---|---|---|---|---|---|
| 1 | Visibility of system status | 2 | 3 | 3 | 2 | Registration open/closed is shown nowhere for admins; the attendance board and roll call don't refresh; wizard progress is unlabeled dots |
| 2 | Match system / real world | 3 | 2 | 3 | 3 | Admin words leak to parents (WEB-1, W1, "6 / 14"); "Students" vs "camper"; camp hours stated three different ways |
| 3 | User control and freedom | 2 | 3 | 3 | 3 | Inline confirms are excellent; long forms lose everything on reload; dead-end "Back" links |
| 4 | Consistency and standards | 2 | 2 | 2 | 2 | Four selected-state styles, six choice idioms on one form, button heights 36/40/44, two registration models, five page widths |
| 5 | Error prevention | 2 | 2 | 3 | 3 | Value-like placeholders ("Sam Brooks" in a signature box), one-click close of a live form, duplicate course choices |
| 6 | Recognition rather than recall | 3 | 3 | 2 | 2 | Health notes behind taps; crew as initials; "Find cover" makes the director remember names across pages |
| 7 | Flexibility and efficiency | 2 | 2 | 3 | 3 | ⌘K and Mark-all are real accelerators; two kids means retyping a 40-field wizard twice |
| 8 | Aesthetic and minimalist design | 2 | 2 | 2 | 2 | Ghost cards, icon tiles, eyebrows, initials discs; one status said four or five times |
| 9 | Error recovery | 2 | 2 | 2 | 2 | Raw Supabase errors reach parents and teens; one error at a time, at the bottom, tied to no field |
| 10 | Help and documentation | 2 | 3 | 2 | 2 | The camp's email address is missing from login, apply and every volunteer screen |
| | **Total** | **22/40** | **24/40** | **25/40** | **24/40** | **Site: 24/40, Acceptable** |

### Audit Health (technical, 0–4 each)

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | 3 | Every text colour passes AA in both themes; the gold focus ring (1.65:1) and field borders (1.69:1) fail 3:1 |
| 2 | Performance | 2 | One 904 KB JS bundle (234 KB gz): parents' phones download every admin page at opening time |
| 3 | Theming | 3 | Zero raw colours in components; dark mode never reaches login/signup/apply and flashes light on load |
| 4 | Responsive | 2 | 14px inputs (iOS zoom) and 24–34px targets on exactly the parent flows that face the rush |
| 5 | Implementation integrity | 3 | Detector nearly clean, but 15 hand-copied input styles, 38 button copies, ~20 text sizes |
| | **Total** | **13/20** | **Acceptable** |

Issues: the five assessments raised **1 P0 and 26 P1s**, many of them the same problem seen from different roles. Deduplicated below to **1 P0 and 9 P1s**, plus the systemic P2s; every P2/P3 with its file:line is in the raw files.

---

## Design Specificity Verdict

**LLM assessment (all four reviewers, independently): category-interchangeable.** The brand is real (the ink bar, the `{STEEL CITY CODES} //DENVER` wordmark, gold kept to primaries) but it sits on a stock SaaS kit: a cream ground, white rounded cards with *both* a border and a shadow, uppercase icon eyebrows over every section, icon-in-a-tinted-disc tiles, initials avatars on every row, and pills that repeat what the heading already says. Cover the wordmark and the parent area is any "family portal", the volunteer area any shift-booking app, the admin any membership dashboard (greeting, five stat cards, a "Jump to" grid that repeats the sidebar).

Where the product does show through, it shows through **words and rules, not design**: the status sentence ("Maya is all set for camp. One spot is on a waitlist. Noor isn't signed up yet."), the consequence-naming inline confirms ("10 campers with a spot and 2 waitlisted will be taken out…"), the roll call's "Mark all present" that never overwrites a co-volunteer's marks, the reset flow that tells an expired link from an invalid one. The product's real shape (campers × weeks, one class per week, a fixed opening minute, an offer with a clock, three roll calls a day, a week × class timetable) shapes none of the layouts.

**Deterministic scan.** Source scan of 124 files: **1 finding** (`side-tab`, the class-browser toast `ClassBrowser.tsx:393`). URL and in-page scans of all 25 routes × 2 sizes + dark: `cream-palette` on every page (the documented `--bg`, a design call, see below), low-contrast placeholders in the admin search (3.5:1) and duty field (3.2:1), a heading skip on `/admin/attendance`, and a 3,000px duty schedule (`first-viewport-column-overflow`). 252 hits from the static HTML engine were false positives (248 `cramped-padding`, 4 em-dash cells). The detector and the reviewers agree: the slop here is not the famous tells (gradients, glass, purple), it is **decoration by default**, which a pattern detector can't see but an element-by-element inventory can.

---

## Overall impression

The bones are better than the skin. The rules engine, the inline confirmations, the roll-call mechanics, the reset flow and the token discipline are careful, unusual work. What fails is hierarchy and honesty of emphasis: the things people come for (is my kid set? who has an allergy? is registration open?) sit below or behind things that carry no information. The single biggest opportunity: **make every screen answer its one question first** — and stop spending colour, boxes and icons on things that don't need them.

## What's working

1. **Consequence-first, modal-free confirmation everywhere.** Cancel, switch, move, drop a duty, cancel a section: each confirm sits under the thing it changes, focuses the safe choice, and names the real outcome with live counts. Principle 5 done right (`InlineConfirm`, `StudentCard.tsx:70-294`, `AdminClasses.tsx:567-589`).
2. **The roll call and the recovery flows are genuine product thinking.** Time-of-day default, Mark-all that respects others' marks, call buttons only on absent rows; forgot/reset copy that never leaks whether an account exists; apply detecting an existing account and retrying only the booking.
3. **A clean token layer and a strong accessibility floor.** Zero raw hex in components, AA text in both themes, labels on every input, `role="alert"` and live regions (82 of them), focus moved on step changes.

---

## Priority issues (site-wide, deduplicated)

**[P0] 1. Nobody can see whether registration is open.**
- *What:* "Open" depends on a Forms "Close form" switch plus a Sessions opening time; neither is shown on the admin Home or in the shell, and either flips with one click and no confirm (`AdminFormEditor.tsx:192-199`, `SeasonSettingsCard.tsx:55-57`). The same split exists for volunteer applications (a green toggle in Volunteers, a red button in Forms).
- *Why it matters:* On opening night the director's one question is "is it open?". Wrong means families locked out or let in early: the fairness promise breaks.
- *Fix:* One registration status, always visible on Today ("Open since 7:00 PM · 84 campers placed · 38 seats left · 9 waitlisted"), one place to change it (Setup › Season) with an inline confirm before closing a live form.
- *Command:* `/impeccable clarify` + `/impeccable layout`

**[P1] 2. Safety information hides behind taps.**
- *What:* Volunteers see each camper's health note only by tapping a 24px chip that always says "Medical", even for allergies (`MedicalFlag.tsx:13`); the call button is a bare phone icon whose contact and number live only in the screen-reader label (`VolunteerClasses.tsx:97`). The admin camper list truncates "Bee stings — EpiPen in backp…" (`AdminStudents.tsx:487`). The paper roster is safer than the phone.
- *Why it matters:* Principle 3 ("Safety information wins the screen") is broken on the screens it was written for. A 16-year-old at lunch must remember which of 12 kids is diabetic.
- *Fix:* Always-visible health line in danger ink, split "Allergy:" / "Medical:"; visible call lines naming contact, relationship and number; never truncate health text.
- *Command:* `/impeccable clarify` → `/impeccable layout`

**[P1] 3. The phone rules are kept for volunteers and broken for parents and applicants.**
- *What:* Inputs compute to 14px on signup, login, apply, the wizard, the class browser and the parent edit forms (only 2 of 15 input styles use 16px), so iOS Safari zooms on every field. Parent tap targets are 24–34px ("Leave the waitlist", "Request a change", bell, theme). **There is no navigation at all below 640px** on parent pages (`ParentLayout.tsx:53`). Step 3 of `/apply` scrolls sideways (522px document at 375).
- *Why it matters:* These are the flows that face the February rush on phones.
- *Fix:* Shared 16px `Input`/`Select`/`Textarea`, a 44px `IconButton`, `min-h-11` text actions, top tabs at every width, a skill scale that wraps.
- *Command:* `/impeccable extract` → `/impeccable adapt`

**[P1] 4. Priority is inverted on the screens people open most.**
- *What:* Parent Home shows a countdown, an always-open 8-row schedule and three updates before the campers; at 390px the first camper starts ~1,700px down and a waitlist offer's Claim button sits below that. The volunteer camp-day header plus a 205px sticky slab leaves 1.5 campers visible on a 360×640 phone. Admin Home is a launcher (greeting, five stat cards, a 10-tile grid that repeats the sidebar). The duty schedule is 3,000px; Users is 5,440px with no search.
- *Why it matters:* "Is my kid set?", "who's here?" and "what needs me?" are answered last.
- *Fix:* One sign at the top with the one next decision; then the list of other decisions; schedules and feeds folded or moved to their own tab.
- *Command:* `/impeccable layout` → `/impeccable distill`

**[P1] 5. Red is spent on good news; gold is spent on everything.**
- *What:* A full section gets the same red ring as "camper unaccounted"; "Full" is red on Classes and green on Duties; required form fields are red pills; open interview slots are warning-yellow. Gold marks selected tabs, filters, week toggles, 17 "Book" buttons, the "senior" pill, and applicant initials drawn gold-on-pale-gold at 1.44:1.
- *Why it matters:* Opening night's best moment is the reddest screen in the admin, so the real alarm on camp morning has no force left. A primary action can't stand out when everything is gold.
- *Fix:* Red only for safety, failure and destruction; a full section is ink; gold only for the one next action per view.
- *Command:* `/impeccable colorize`

**[P1] 6. Forms fail one error at a time, at the bottom, and look filled before they are.**
- *What:* The wizards return only the first failing field, render it at the form's foot tied to nothing, and don't mark the field. Placeholders read as values ("17", "Jane", "Smith", "••••••••", and signature boxes pre-filled with the expected names "Sam Brooks" / "Taylor Brooks"). Raw Supabase errors reach parents and teens.
- *Why it matters:* Abandonment in the longest flows, and a WCAG 3.3.1 failure on a P0 accessibility flow (L6a).
- *Fix:* Whole-step validation with inline errors and focus on the first; labels carry instructions; mapped, recoverable error copy.
- *Command:* `/impeccable harden` + `/impeccable clarify`

**[P1] 7. Some copy isn't true.**
- *What:* The opening countdown says "You can add your campers now" but the wizard won't pass step 4 before opening. Step 4 hard-codes "8:00 AM – 4:00 PM" against 9–3 sections and an 8:30–3:30 schedule. Every newcomer is greeted "Welcome back". Signup shows "Check your email" for an existing account and sends nothing.
- *Why it matters:* Principle 2: honest, never optimistic. A returning family waits for an email that never comes, then emails the director.
- *Fix:* Gate only the final Register button before opening (so "get ready now" becomes true), pull hours from data, "Sign in" / "Create a parent account", reuse apply's existing-account detection on signup.
- *Command:* `/impeccable clarify` → `/impeccable harden`

**[P1] 8. Focus and field edges fail non-text contrast in light mode.**
- *What:* Gold focus ring 1.65:1 on white, field border 1.69:1, and 11 inputs drop their border on focus (`focus:border-transparent`).
- *Fix:* Ink focus outline (gold on dark), field borders ≥3:1, keep the border on focus. (WCAG 1.4.11, 2.4.7.)
- *Command:* `/impeccable harden`

**[P1] 9. Two registration designs for one decision.**
- *What:* The wizard picks by week with radios; the class browser groups by course with admin codes, capacity fractions, ~8 identical gold "Register Noor Brooks" buttons and a 4-second toast. The yearly check retypes 13 fields, triggered only after tapping Register.
- *Fix:* One week-and-class picker used by both; the yearly check first, as a read-only summary with "Change" per group.
- *Command:* `/impeccable distill` → `/impeccable onboard`

**[P1] 10. Admins manage sections, but sections are hidden in accordions.**
- *What:* Classes is a stack of course cards; the class-level fill meter hides full sections (Python 39/56 while PY-A Week 1 is 10/10); crew are initials; "Find cover" links to the generic Classes page and the lead select lists 22 bare names.
- *Fix:* A week × class timetable grid with every section, its fill, waitlist, lead and "No lead" visible; one inline panel per section; deep links from Today.
- *Command:* `/impeccable layout`

**[P2] Systemic patterns** (details and file:line in the raw files):
- **Decoration with no job:** border + shadow "ghost cards" on every region, icon tiles on every status, uppercase icon eyebrows, initials discs, a megaphone disc on every update, icons inside every primary button, Unicode ⚠ ✓ ✕ as icons. Eli's waitlist status is said five times on one screen; "5 pending" four times on admin Home.
- **Component drift:** no shared Input/Button/Field; 15 input styles, 38 primary-button copies, `rounded-[10px]` ×173, ~20 text sizes (11, 12.5, 13, 13.5…).
- **Navigation:** admin has 11 top-level items grouped by noun; Interviews is split from Applications, Attendance from Home. Settings (theme) live in the top bar instead of the avatar menu in all three shells.
- **Theme:** dark mode lives in three copies of layout code, never reaches signed-out pages, flashes light, and sets no `color-scheme` (the date-picker icon renders black on dark).
- **Performance:** one 904 KB bundle; a 4168px wordmark PNG shown at 119px with no dimensions.
- **Josefin Sans at 11–13.5px** carries times, counts and table data; its small x-height hurts glanceability on low-DPI Androids. (Decided: Josefin for brand moments only.)

## Persona red flags (the sharpest from each review)

- **Opening-night parent, 7:00 PM, iPhone SE, two kids:** follows "add your campers now" at 6:50, is stopped at step 4; every field tap zooms; both signature boxes look filled; the success screen offers only "Back to dashboard", so she retypes ~40 fields for the second child while the seat count she saw may no longer hold.
- **Maya, 16, support volunteer, 9:00 roll call, cracked Android:** sees 1.5 campers on load; "Mark" doesn't say what it does; Andre's diabetes is behind a 24px chip; the call button doesn't say whether Grandpa or Dad will answer; on slow wifi each tap greys all 12 rows and a second tap is silently dropped.
- **The director, 8:55 AM camp Monday, two volunteers out sick:** the board is alphabetical with a manual Refresh, a full section is styled like an emergency, finding cover means four pages and a 22-name select, and "No roll call yet — call the lead" names nobody.
- **Jordan (first-time parent):** greeted "Welcome back"; "Sign up" doesn't say it makes a parent account; reads "JAVA-1 · W1 · 6 / 14" and can't tell taken from left.
- **Sam (screen reader):** wizard progress is four unlabeled divs; skill ratings announce "1, button" ×30; orphan `role="tab"`s; the avatar is named "Account menu" while showing "TB" (label-in-name fails on all 21 signed-in routes).
- **Dana, portfolio reviewer at 1440:** a 384px card floating in cream, Sign in below the fold, nothing that shows craft beyond a clean form.

## "Justify every div": the element inventory

Each reviewer walked every visible element of every screen and gave it a verdict with its file:line. Across the site, roughly **590 elements** were judged: about **230 keep** (they have a job), **90 cut** (no job), **35 merge** (duplicate another element's job) and **235 change** (a job done badly). The full tables are in `raw/A-*.md` §8. The cuts cluster in five families, and the redesign removes every one of them:

| Family | Examples | Verdict |
|---|---|---|
| Containers compensating for weak grouping | ghost cards, nested sunken footers, card-in-card interview picker, "SECTIONS" panel | Cut: proximity and rules group |
| Icons that repeat a word | icon tiles on statuses, icons in primary buttons, megaphone per update, calendar disc, eyebrow icons | Cut |
| People as decoration | initials discs on campers, applicants, users, roll-call rows | Cut (and the gold-on-gold ones fail contrast) |
| Status said twice | "All set" + "Confirmed", rollup + per-class chips, "5 pending" ×4, "15 min" ×17 | Merge to one |
| Duplicate navigation | Jump-to grid, "Browse classes" ×2, "Rosters" link, Back-to-dashboard links, sidebar footer = avatar menu | Cut |

## Minor observations

- The demo seed says "Denver *Summer* Camp" with October dates, and interview slots fall inside camp weeks: fix in the seed.
- `cream-palette` (detector) on every page: `--bg #FAF6EF` is a documented choice, but cream is the most common AI-default ground and nothing in Denver's brand requires it. The redesign uses a neutral floor.
- Two schedule components render the same data differently (parent `DailySchedule`, volunteer `ScheduleBlock`).
- The roll call switches to "After lunch" at 11:30, before lunch (12:00–12:45).
- The bell remounts on every route (`key={pathname}`) and re-runs ~8 queries per navigation in admin.
- `role="alert"` on every InlineConfirm interrupts screen readers for a user-initiated confirm.
- A teen support volunteer can "Email all parents" from the print roster: a policy question, answered by default today.

## Questions to consider

- What if each screen had exactly one gold thing?
- What if the camper × week strip *were* the parent Home, and the roll call *were* the volunteer Today on camp days?
- Should a health note ever be hidden from the person standing next to the child?
- Is the apply page's waiver SCC national's official text? If not, it is invented legal copy.
- Adults volunteer too: should "Current grade" gain "Not in school"?
- Does the waitlist position exist in data a parent may read? "#2 in line" would be the most reassuring line the waitlist could show.

---

## The redesign (mockup)

The director chose the world **Terminal Yellow** (airport wayfinding) over the roll's Camp Shirt; the direction contract is in `.impeccable/surfaces/src-app-tsx.md`. Every screen is a junction sign: one gold band holds the one next decision with the number you act on at monumental scale; the rest is a list of decisions, one per line. Yellow is reserved for wayfinding (the sign, the active tab, one primary action); red for safety; green for done; ink for everything else. Atkinson Hyperlegible Next carries the UI with tabular numerals; Josefin Sans only for page titles; the wordmark stays on ink.

The clickable mockup of every screen, with per-screen notes justifying what was cut, merged and changed, is in `mockup/index.html`.

## Run notes

- Target: whole site (`src/App.tsx` routes + live demo). Ignore list: none.
- Independence: the four A reviewers and B ran as isolated sub-agents; A reviewers wrote before B's output existed and never read it.
- CLI detector: impeccable 4.6.0 source + URL scans; in-page browser detector injected via Playwright on all 50 route/size pairs + 25 dark (no live server, no project HTML modified). axe-core light + dark.
- Product context: `PRODUCT.md` written from the plan, specs and the director's standing instructions (the director asked for context to be supplied rather than interviewed); inferred items are marked.
- The impeccable skill, its four agents and its three hooks in `~/.claude/settings.json` were installed globally earlier the same day by another session (deliberately, with a settings backup); this run used them but did not install them.
