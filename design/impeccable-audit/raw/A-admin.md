# Assessment A: Admin surfaces (design review, unanchored)

Scope: `src/components/AdminLayout.tsx` (top bar, sidebar, drawer, AdminSearch, AttentionBell, MfaGate) and every `/admin/*` page. Mode: **Operate** throughout (agree with the brief). Evidence: source at `main` 47160cf, the `before/admin-*` captures (1440 and 390), plus extra read-only captures in `before/extra/A-*.png` (Classes expanded with roster, section edit form with History, Volunteers Applications tab, bell open, ⌘K search, dashboard at 1280 and in dark, phone drawer, Classes expanded at 390). Nothing was saved, toggled or submitted. The detector was not run or read.

Scope notes: `StudentCard.tsx` and `ConfirmOnboardingPanel.tsx` are **parent-side** components (rendered only by `ParentDashboard.tsx:176` and `ClassBrowser.tsx:279`), so they're out of admin scope. The admin camper detail is `StudentDetail` inside `AdminStudents.tsx`. `design/ADMIN_DASHBOARD_HANDOFF.md` describes the current dashboard: the stat-card template, the "Jump to" grid and the 40px greeting all trace back to it. This review disagrees with several of its prescriptions (see §6 P1-2, §8).

---

## 1. Design Specificity Verdict

**Mostly category-interchangeable: a competent default admin template with SCC's colours applied.** The shell (ink top bar with the gold wordmark, a warm cream ground, a 260px white sidebar with group eyebrows and a gold active pill) is the standard SaaS admin layout. Swap the wordmark and the dashboard could run any membership org: a greeting, five icon-tile stat cards, a "Needs attention" card grid, and a 10-tile "Jump to" grid that repeats the sidebar. Specific to this product are the **copy** (the attention items, "Cancel ... families see 'Cancelled by camp' with a link to pick another class", the inline-confirm consequences) and the **rules surfaced in the UI** (overfill warnings, age checks on a move, cancel-not-delete with tallies). That's where the product's character is, and it's very good. The **visual and structural language doesn't carry it**.

The biggest missed opportunity is structural. This product is a **timetable**: classes × weeks × sections, a daily schedule, three roll calls a day, duties per day. Every list in the admin is built as "cards in a vertical stack" instead. Classes is an accordion of course cards with sections hidden inside. Duties is 40 stacked rows sorted by duty name, so "Afternoon Dismissal" comes before "Morning Check-In". Interviews is 20 stacked slots. Sessions shows the same 8-row daily schedule twice. A week-by-class grid would serve the Director's two real moments (opening night: which sections are filling; camp morning: which rooms have a problem) and would be the one signature move this surface lacks. Brand presence is right-sized (wordmark on ink, gold for primary). But gold is overused as the "selected" colour on tabs, filters, week toggles and 17 "Book" buttons, so it stops meaning "the one action". Josefin Sans at 11–13px for dense table data is the brand-kit face used for a job it wasn't chosen for (see §10 question).

## 2. Nielsen's 10 heuristics

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | Nothing on any admin screen says **whether registration is open** (it lives in Forms "Close form" plus Sessions "opening time"). Attendance board refreshes only on a manual "Refresh" (`AdminAttendance.tsx:174`). Badges and the queue refetch only on navigation (`AdminLayout.tsx:44-57`). A full section is styled as an error. |
| 2 | Match system / real world | 3 | Copy is plain and humane. Leaks: "Students" in nav, h1 and filters vs "camper" everywhere else (search hint says "Camper", `AdminSearch.tsx:33`). Duties sorted alphabetically, not by time of day. Two sections both called "MC-1", told apart only by a "W1/W2" chip. "Sessions" for camp weeks. "(spec 02)" in the email-log alert (`EmailLog.tsx:59`). |
| 3 | User control and freedom | 3 | Strong: inline confirms with Cancel focused, Esc closes forms, History + Revert on sections and campers, cancel-instead-of-delete. Gaps: the phone drawer has no Esc or focus return, and the avatar menu has no Esc (`AdminLayout.tsx:78-84`, `192-217`). |
| 4 | Consistency and standards | 2 | Five content widths (1200/1000/900/860, `max-w-[…]` on every page), so the left edge jumps between pages. h1 is 40px on the dashboard and 24px elsewhere. Three different tab styles (gold segmented control in Volunteers, gold pills in Form editor, filter chips). "Full" is green on Duties (`AdminDuties.tsx:242`) and red on Classes (`CapacityMeter.tsx:11`). The same "volunteer applications open" setting appears as a green toggle in Volunteers (`AdminVolunteers.tsx:645`) and a red "Close form" button in Form editor (`AdminFormEditor.tsx:192`). |
| 5 | Error prevention | 3 | Registration moves and cancels are excellent: fresh tallies, over-fill, age and same-week warnings in the confirm (`AdminStudents.tsx:104-127`, `AdminClasses.tsx:567-589`). Gaps: closing a **live** registration or application form is one click with no confirm. The lead and support selects list every volunteer with no level, availability or current assignment (`AdminClasses.tsx:324-331`), so double-booking a lead across weeks is easy. |
| 6 | Recognition rather than recall | 2 | Crew shown as initial discs, with names only in a `title` hover (`AdminClasses.tsx:910-920`). Section problems ("no lead", "full") are invisible until the class accordion is opened. "Find cover" lists suggested names in text, then links to the generic Classes page, so the admin must remember the names and hunt for the section (`useAdminAttention.ts:217-218`). Application rows don't say who has an interview booked. |
| 7 | Flexibility and efficiency | 3 | ⌘K search across pages, classes, campers and applicants is a real accelerator. Deep links (`?open=`, `?q=`, `#requests`), CSV exports and auto-assign. Missing: search on Users (80 rows, not indexed by ⌘K), applicant-first booking, keyboard row navigation. Auto-assign sits below a 22-row table. |
| 8 | Aesthetic and minimalist design | 2 | Dashboard: 5 stat cards with icon tiles, plus a 10-tile grid duplicating the sidebar. "5 pending" is said four times (sidebar badge, stat delta, queue card, bell). Eyebrow labels on most sections. Interviews' 3 stat tiles. A green banner restates the toggle above it. "Role" label ×80 on Users. A repeated "Notes" column on the roster. |
| 9 | Error recovery | 2 | Load errors usually carry a Retry, but most action errors print the raw Supabase message behind a "⚠" glyph (`AdminClasses.tsx:631`, `AdminStudents.tsx:442`, `AdminSessions.tsx:279`, `AdminUpdates.tsx:33`) with no recovery step. |
| 10 | Help and documentation | 2 | Page intros, the locked-field footnote and consequence-rich confirms do real teaching. No admin guide yet (plan PR 26). Contextual help for the season rules (deadline days, offer hours) is a single label each. |
| **Total** | | **24/40** | **Acceptable** (significant improvements needed) |

## 3. Cognitive load

Checklist (8 items):

- [ ] **Single focus**: **fail**. Dashboard: stats, queue and jump grid all compete. Attendance on camp day puts a gold "Download attendance CSV" primary under the live board (`AdminAttendance.tsx:233`).
- [ ] **Chunking**: **fail**. Students: 73 rows on one page (100 per page by design, `AdminStudents.tsx:358`). Users: 80 rows / 5,440px. Duties: 40 slots / 3,260px. Interviews: 20 slots. Sessions: 16 schedule rows (8 per week, identical).
- [x] **Grouping**: pass. Sidebar groups, day groups and the student detail are grouped by proximity.
- [ ] **Visual hierarchy**: **fail**. The dashboard's loudest element is "2 sections are at capacity" in a red ring, which is good news on opening night. Five equal-weight stat cards sit above the work queue.
- [x] **One thing at a time**: pass, mostly. Inline forms open one at a time. Minor: on Classes the section edit form, History and the roster can all be open together (`before/extra/A-classes-section-edit.d.png`).
- [ ] **Minimal choices**: **fail** (see decision points below).
- [ ] **Working memory**: **fail**. Find cover: read suggested names on Home, navigate, expand a class, find the section, open edit, pick from an unlabelled 22-name select. Interview booking: remember who lacks an interview (Home) and book them from a slot-first list.
- [x] **Progressive disclosure**: pass. Accordions, row expansion, History behind a toggle.

**5 failures → high cognitive load.**

Decision points with more than 4 visible options:

| Where | Count | Note |
|---|---|---|
| Sidebar (every page) | **11** destinations in 4 groups | Guideline ≤5 top-level |
| Dashboard | 4 queue CTAs + **10** jump tiles + 11 sidebar links = **25 destinations** on one screen | Jump grid is pure duplication |
| Students status filter | 6 chips (`AdminStudents.tsx:427`) | Acceptable as one control; style it as one |
| Student registration (expanded) | 3 status chips + move select (9 sections) + Remove + Show history = **6 controls per registration** | "Remove registration" and "Set status: cancelled" do the same write (`useAdminStudents.ts:164-168`) |
| Section row | Roster, Print, Edit, Delete icons + crew + meter + age chip (`AdminClasses.tsx:928-949`) | 4 icon-only actions at ~26px |
| Section form | 11 fields | Acceptable for setup; group into "When/where", "Who", "Seats" |
| Volunteers > Applications header | 2 tabs + Export + open toggle + Copy link + 4 filters | Toggle duplicated in Form editor |
| Interviews | 17 gold "Book" + 20 delete icons on one page | Every open slot shouts |
| Form editor | 21 rows × (toggle + rename + required pill) | Fine as a table; required pill reads as an error |
| Users | 80 role selects | No search, no filter |

**Top-level nav: 11 vs the ≤5 guideline.** Grouping into Overview/People/Program/Setup helps scanning but doesn't fix it. The groups are by **noun**, not by **job or season phase**: "Program" mixes season setup (Classes, Sessions), recruiting (Interviews) and camp-week operations (Attendance, Duty schedule). Interviews is split from Volunteers > Applications, though they're one pipeline. Attendance is split from Home, though on a camp day it *is* home. Regrouping by job gets to **5 primary items + Setup** (§9).

## 4. Emotional journey

**Opening night (Director at a laptop watching registrations land).**
- *Before 9:00*: Home says "Good evening, Jordan / Manage classes, volunteers, and registrations." Nothing tells them registration opens at 9:00 or that it's armed. To check, they must open Sessions (opening time) **and** Form editor ("Close form" means it's on). **Valley: uncertainty at the highest-stakes moment.**
- *9:00–9:15*: Numbers don't move. Stats, queue and badges load once per navigation, so the Director refreshes the browser to see progress. Then the first section fills and the screen's loudest element becomes a **red-ringed danger card** with a "Full" danger pill and a warning-triangle icon (`useAdminAttention.ts:99-110`, styled like the "unaccounted camper" alarm). **A success reads as an emergency. Valley.**
- *Seats*: the only per-section view is Classes, where the class-level meter hides it. "Intro to Python 39/56" shows no warning while PY-A Week 1 is 10/10 Full with a waitlist (`before/extra/A-classes-expanded.m.png`).
- *End*: nothing marks a good night: no "412 campers registered, 9 waitlisted, 0 failed emails". Peak and end are both flat or alarming.

**Camp morning (unaccounted kids).**
- *Home*: the "N campers unaccounted for" item goes to the top with a danger ring and a "Now" badge (`useAdminAttention.ts:84-99`). Right instinct. But it's styled identically to the "sections full" card, so the alarm has been spent on a non-alarm all season.
- *Attendance*: four stat cards come first. Then sections in **alphabetical** order (`useAttendanceBoard.ts:188`), each a card whose unaccounted list sits inside it. With 15 sections the Director scrolls to find the rooms with problems. "No roll call taken yet — call the lead" names no lead and offers no number, while the same card's header lists the lead's name 20px above.
- *Reassurance*: "Call parent" and "Call {emergency contact}" `tel:` buttons on each unaccounted child, with medical notes in red. **This is the peak moment done right.** But "Updated 9:31 PM" and a manual Refresh mean the Director can't trust that "0 unaccounted" is current.
- *End*: per-section "Everyone accounted for at Arrival" lines, with no page-level all-clear. The day never says "all 73 campers accounted for at Lunch."

## 5. What's working

1. **Consequence-first inline confirmation.** `InlineConfirm` under the row, Cancel autofocused, and messages that state real outcomes with live counts: "Cancel Microcontrollers? 10 campers with a spot and 2 waitlisted will be taken out. Registrations are kept as cancelled…" (`AdminClasses.tsx:567-589`). Moves warn about overfill, age range and same-week clashes in one sentence (`AdminStudents.tsx:115-127`). This is the product's "rules live in the system" principle made visible, and it beats most commercial camp tools.
2. **The attention queue as the dashboard spine, and the safety items in it.** Items exist only when count > 0. Unaccounted campers go to the top on a camp day. Absences carry suggested cover. The copy is specific ("oldest is 5 days old"). On Attendance, `tel:` buttons sit next to medical notes on each unaccounted child (`AdminAttendance.tsx:28-56`). The right information exists; it needs the right stage (§9).
3. **⌘K search and History + Revert.** A top-bar search that reaches campers, classes and applicants with keyboard selection (`before/extra/A-search-open.d.png`), and a per-row History strip with Revert inside the edit form. Both are power-user features that cost the novice nothing.

## 6. Priority issues

**[P0] Registration status is invisible, and split across two pages.**
- *What*: Whether parents can register right now depends on the Forms "Close form/Open form" switch (`AdminFormEditor.tsx:192-199`) **and** the Sessions "Registration opens" time (`SeasonSettingsCard.tsx:55-57`, whose own copy says "registration follows the Forms on/off switch"). Neither is shown on Home or in the shell, and either can be flipped with one click and no confirm.
- *Why it matters*: On opening night the one question is "is it open?" Being wrong means families locked out or let in early, which breaks the product's fairness promise. That's the P0 failure for the season.
- *Fix*: One "Registration" status line in the Home header that changes with the season phase ("Opens Sat Feb 1, 9:00 AM Denver" / "Open since 9:00 AM · 412 campers · 38 seats left · 9 waitlisted" / "Closed"). One place to change it: Setup → Season, holding the on/off switch moved out of Form editor next to the opening time, deadlines and offer windows. Inline confirm before closing a live form. Do the same for volunteer applications: keep the control in one place and show a status line elsewhere.
- *Command*: `/impeccable clarify` + `/impeccable layout`

**[P1] Alarm styling is spent on non-alarms, so real alarms don't stand out.**
- *What*: "Sections at capacity" uses the same danger ring, danger icon tile and danger pill as "campers unaccounted" (`useAdminAttention.ts:99-110` vs `84-99`). The capacity meter turns red at full (`CapacityMeter.tsx:11`). Duties use green for "Full" (`AdminDuties.tsx:242`). "Required" form fields are red pills (`AdminFormEditor.tsx:92`). Interviews mark open slots "Available" in warning yellow (`AdminInterviews.tsx:324`).
- *Why it matters*: Principle 3, "Safety information wins the screen", only works if red is reserved for safety and failures. Today a successful opening night is the reddest screen in the admin.
- *Fix*: Reserve danger for unaccounted campers, medical flags, failed emails and destructive actions. Full section → neutral ink "Full" with waitlist count, and the meter at full uses ink, not red. Show "No lead" as warning. Required = plain text. Open interview slot = plain text "Open". Add one status vocabulary table to `design_system.md`.
- *Command*: `/impeccable colorize`

**[P1] Sections, the unit the Director actually manages, are hidden inside class accordions.**
- *What*: Classes is a stack of course cards (`AdminClasses.tsx:672-848`). Week, crew, fullness and "no lead" live on section rows visible only after expanding. The class-level meter aggregates and hides full sections (39/56 while PY-A W1 is full). Crew shows as initial discs. Duplicate labels (MC-1 ×2) are told apart only by a W-chip.
- *Why it matters*: Opening night (which sections are filling) and camp morning (which room has no lead) both need every section at once. The accordion forces recall and four clicks per check.
- *Fix*: A week × class **timetable grid** (rows = classes, columns = Week 1 / Week 2). Each cell is a section: label, time · room, "10/10 · 2 waitlisted", lead's name in text plus "+2 support", and a "No lead" flag. Clicking a cell expands one inline panel under that class row (edit form, roster, History). This becomes the product's signature move and also powers the Home seat view. Drop the class-level aggregate meter.
- *Command*: `/impeccable layout`

**[P1] Home is a launcher with metrics instead of a status board.**
- *What*: A 40px greeting plus a generic subhead (`AdminDashboard.tsx:67-72`), five icon-tile stat cards (the hero-metric template; Classes "4" and Volunteers "22" lead to no action), the queue, then a 10-tile "Jump to" grid that repeats the sidebar (`:124-143`). At 1440 the queue starts 455px down. At 390 the stat cards take a full screen before the queue.
- *Why it matters*: Fails Single focus and Visual hierarchy. 25 destinations. "5 pending" is stated four times.
- *Fix*: Header = h1 "Today" + the registration/camp status sentence (P0). Main column = the queue as a compact list (rows, not cards; one action link each; severity sorted). Side column = section seat grid on registration days, roll-call board on camp days. Cut the stat cards, the jump grid and the eyebrows.
- *Command*: `/impeccable distill`

**[P1] The camp-morning board isn't sorted by trouble and doesn't stay current.**
- *What*: Attendance leads with 4 stat cards, then sections alphabetically (`useAttendanceBoard.ts:188`). Unaccounted children are nested per section. No auto-refresh. "No roll call taken yet — call the lead" names nobody. The end-of-week export is a gold primary on the same screen.
- *Why it matters*: At 8:55 on camp Monday this is the screen where a missing child is found or not. Scrolling past fine sections, and not knowing whether the data is two minutes or two hours old, puts children at risk.
- *Fix*: One "Unaccounted now" list at the top across all sections (child, age, section · room, missed roll call, medical note, Call parent / Call emergency contact). Then "No roll call yet" rows naming the lead and room. Then sections sorted by problem, with fine sections collapsed to a one-line "all 12 accounted for at Arrival". Refresh on an interval and on tab focus, with "Updated 8:55" next to it. Move the export into a "Week export" disclosure at the bottom as a secondary button. Make this the camp-day state of Home (§9).
- *Command*: `/impeccable layout` + `/impeccable harden`

**[P1] Reassigning cover is a recall exercise.**
- *What*: "Find cover" links to `/admin/classes` (`useAdminAttention.ts:218`); "Assign a lead" does too. The lead and support selects list all volunteers by name only (`AdminClasses.tsx:324-331`), with no level, week availability or current assignment, though that data is loaded (`useVolunteers`; the roster table shows it).
- *Why it matters*: The Director with two sick volunteers must cross-reference the roster page and the classes page in their head under time pressure.
- *Fix*: Deep-link the CTA to the section's open edit panel (`/admin/classes?section=<id>`; the `?open=` pattern already exists). Option text in the lead select: "Harper Ito · senior · free Week 1" / "… · leads PY-A W1". Put suggested names first in an optgroup ("Free seniors this week").
- *Command*: `/impeccable clarify`

**[P1] Gold-on-gold initials on Applications fail contrast and break the brand rule.**
- *What*: Applicant initials use `text-brand` (#F1C446) on `bg-brand-soft` (#FCEFC4), about 1.4:1 (`AdminVolunteers.tsx:706-708`, visible in `before/extra/A-volunteers-applications.d.png`).
- *Why it matters*: Fails WCAG AA, and the brand rule "never gold text on white". The disc has no job anyway (the name is right next to it).
- *Fix*: Cut the disc. Same for the student initial discs (`AdminStudents.tsx:471`) and user initial discs (`AdminUsers.tsx:158-162`).
- *Command*: `/impeccable distill`

**[P2] Eleven nav items grouped by noun; two pairs are one job.**
- *What*: `AdminLayout.tsx:95-125`. Interviews is separate from Volunteers > Applications. Attendance is separate from Home. Sessions and Form editor hold the registration controls. Sign-out and identity appear in both the sidebar footer (`:276-296`) and the avatar menu (`:167-180`). The theme toggle is in the top bar, not under the avatar menu as the brief's settings rule says.
- *Fix*: 5 primary items + Setup (§9). One identity location (avatar menu: name, role, theme, sign out). Drop the sidebar group headings once there are only 5 items.
- *Command*: `/impeccable layout`

**[P2] Inconsistent page frame.**
- *What*: Content widths 1200/1000/900/860, all centred, so the left edge moves on every navigation. h1 is 40px on Home and 24px elsewhere. Volunteers has tabs above the h1 (`AdminVolunteers.tsx:476-501`) and the h1 changes with the tab. Three tab styles. Dashboard is `py-10`, others `py-8`.
- *Fix*: One page header component (h1 24px + optional one-line description + right-aligned primary), left-aligned content at a fixed gutter. Two widths: tables 100% up to 1200, forms and feeds 720. One tab style (underline top tabs, matching the parent/volunteer rule).
- *Command*: `/impeccable polish`

**[P2] Long scroll walls on Students, Users, Duties, Interviews, Sessions.**
- *What*: Users 5,440px with no search; Duties 3,260px; Students 5,180px at 1440 and 7,851px at 390; Interviews 2,286px; Sessions 1,633px with the 8-block schedule duplicated.
- *Why it matters*: Breaks "avoid long scrolling pages" and the chunking check.
- *Fix*: Users: search + role tabs. Duties: a day × duty grid per week (5 columns × 4 rows fits one screen). Interviews: past days collapsed, "Needs a time" first. Sessions: each week's schedule collapsed to "8 blocks · 8:30 AM–3:30 PM". Students: 50 per page with a sticky header.
- *Command*: `/impeccable layout`

**[P2] Duplicate controls and duplicate status.**
- *What*: "Remove registration" vs "Set status: cancelled" (same write). Applications open/close in two places with two looks. The green "form is live" banner restates the green toggle. "5 pending" ×4. The bell's "Recent updates" repeats the Updates page.
- *Fix*: Merge each pair (§8).
- *Command*: `/impeccable distill`

**[P2] Safety notes truncated.**
- *What*: Students list Medical column truncates ("Bee stings — EpiPen in backp…", `AdminStudents.tsx:487-490`). The class roster wraps, so it's inconsistent.
- *Fix*: Wrap health text in the list. Never truncate allergy or medical notes.
- *Command*: `/impeccable harden`

**[P3] Small icon targets and unlabelled visual states.**
- *What*: Section-row actions are 14px icons in `p-1.5` (~26px) (`AdminClasses.tsx:928-949`), as are duty and interview delete. Crew names exist only in `title`. Volunteers tabs use `role="tab"` without a `tablist` parent (`AdminVolunteers.tsx:477-491`).
- *Fix*: 36px minimum targets on laptop and 44px under 768px. Crew names in text. Proper tablist semantics.
- *Command*: `/impeccable audit` → `/impeccable harden`

## 7. Persona red flags

**Alex (power user)**
- Changing one camper's status: expand row → chip → sometimes confirm. No status select, no bulk action for placing waitlisted campers.
- Booking the 2 applicants without interviews: the page is slot-first. Alex scans 17 gold "Book" buttons, opens a panel and picks the applicant from a list. Nothing on the page lists who needs a time.
- Users: finding one parent to promote means scrolling 80 rows; ⌘K doesn't index accounts (`AdminSearch.tsx:20-37`: classes, campers, applicants, pages only).
- Editing a section is three levels deep (expand class → find row → 14px pencil). No keyboard path to row actions besides Tab through every icon.
- Auto-assign, the most leveraged volunteer action, sits under a 22-row table (`AdminVolunteers.tsx:519-545`).
- The Home "Jump to" grid patronizes Alex: it's the sidebar again as 10 cards.

**Sam (accessibility)**
- Gold-on-gold applicant initials, about 1.4:1 (`AdminVolunteers.tsx:707`).
- Crew discs show one letter each; names only in `title`, which isn't reliably announced and is unreachable by keyboard (`AdminClasses.tsx:910-920`).
- Volunteers tabs: `role="tab"` buttons with no `role="tablist"`, no arrow keys, no `aria-controls`.
- Phone drawer: no dialog role, no focus move or trap, no Esc (`AdminLayout.tsx:192-217`). Hamburger and avatar buttons have no `aria-expanded`. The avatar menu has no Esc (the bell does).
- Section and duty action targets ~26px. At 200% zoom the volunteer roster table clips "Assigned to" with no visible scroll cue (seen at 390, `admin-admin_volunteers.m.png`).
- The attendance board's manual refresh is silent: no live region announces new unaccounted children.
- Josefin Sans 11px uppercase sidebar headings and 11px badges. Legible on contrast, but the face's small x-height makes 11–12px the weakest text in the admin.

**Project persona: the Regional Director, 8:55am, camp Monday, two volunteers out sick (they texted)**
- Lands on Home: the queue shows "1 section has no lead" only if the absence was entered in the app. Volunteers who **texted** don't appear anywhere, and the admin has no in-app way to record an absence, so Home looks calm while two rooms are uncrewed. (Not a design fix; flag for product. Design can at least show "today's crew per section" so a gap is visible by sight.)
- To find who's free: Volunteers roster (Week 1 ✓ column, "Assigned to" text), then Classes, expand the class, edit the section, then a lead select with 22 bare names. Two sick volunteers = two passes through this. The roster's "Notes" column ("Returning volunteer, comfortable leading a room." ×8) is noise at 8:55.
- Meanwhile roll call starts at 9:00: they flip to Attendance, which is alphabetical, manual refresh, with a gold export button. Nothing ties "PY-A has no lead today" to "PY-A has no roll call yet": two different pages tell the same story.
- Calls a parent from the unaccounted list: good. Calls the lead of a room with no roll call: no number shown on the board; must go to Users or Volunteers to find it.
- Wants to message one section's families ("new lead today"): Updates → Send to (12-option select) works, but it's a fifth page in the flow.

## 8. Element-justification inventory

Verdicts: **Keep** (it has a job) · **Cut** (no job) · **Merge** (duplicates another element's job) · **Change** (has a job, does it badly).

### Shell: `AdminLayout.tsx`, `AdminSearch.tsx`, `AttentionBell.tsx`, `MfaGate.tsx`
- Ink top bar, 64px (`:130`): **Keep**, the brand's hero placement for the wordmark.
- Wordmark `h-8` (`:139`): **Keep**.
- ⌘K search field + kbd hint (`:141`, `AdminSearch`): **Keep**. **Change**: index accounts (Users) too, which uses the existing users query, not a new feature.
- Theme toggle in top bar (`:144-150`): **Change**, move into the avatar menu (settings live under the avatar).
- Bell with gold dot (`AttentionBell.tsx:34-42`): **Keep**, reachable from every page.
- Bell "Needs attention" list (`:46-78`): **Keep**.
- Bell "Recent updates" block (`:79-93`): **Change**, show only updates posted by others (leads), or cut; the admin wrote most of them.
- Bell remount on every route (`AdminLayout.tsx:152` `key={pathname}`): **Change**. It re-runs ~8 queries per navigation, on top of the dashboard's own copy of the hook.
- Avatar disc with gold ring + chevron (`:156-165`): **Keep** as the account menu trigger.
- Avatar menu: name + "Administrator" + Sign out (`:167-180`): **Keep**, becomes the single identity location.
- Sidebar 260px white (`:187`): **Change** to 224px at ≥1280; 260 is generous for 6 short labels.
- Group eyebrows OVERVIEW/PEOPLE/PROGRAM/SETUP (`:243`): **Cut** once nav is 5 + Setup; a divider before Setup is enough.
- Nav item icons (`:261`): **Keep** (scan aid), but fix semantics: Students uses `GraduationCap`, the same as the Parents section icon on Users.
- Active state: brand-soft fill **and** 3px gold bar (`:256`): **Change**, one signal (the bar plus ink weight) is enough; double encoding is decoration.
- Count badges on Volunteers and Interviews (`:264`): **Keep** one (Volunteers = pending applications). Interviews merges into Volunteers.
- Sidebar footer: avatar + name + Admin chip + sign-out (`:276-296`): **Merge** into the avatar menu; it duplicates it exactly.
- Badge-count queries in the layout (`:44-57`): **Merge** into `useAdminAttention` (same data).
- Phone drawer (`:192-217`): **Keep** (admins are laptop-first; a drawer is acceptable here). **Change**: dialog semantics, Esc, focus.
- Drawer's second wordmark header (`:199-208`): **Cut**, the top bar is already visible behind it; a close button in the drawer top-right is enough.
- MfaGate spinner (`MfaGate.tsx:30-34`): **Keep** (brief, pre-auth).

### Home `/admin`: `AdminDashboard.tsx`, `StatCard.tsx`, `AdminNeedsAttention.tsx`
- `max-w-[1200px] mx-auto px-6 py-10` (`:65`): **Change** to the shared page frame.
- "Good evening, Jordan" 40px (`:68-70`): **Change**, h1 "Today" at 24px. The greeting is decoration on a work surface; the date and season state are the information.
- Slab subhead "Manage classes, volunteers, and registrations." (`:71`): **Cut**, says nothing.
- Five stat cards grid (`:75-118`): **Cut** as cards. Fold Students/Confirmed/Waitlisted into the status sentence; Classes (4) and Volunteers (22) have no decision attached.
- StatCard icon tile `w-9 h-9 rounded-full` (`StatCard.tsx:38-40`): **Cut** (decorative chrome).
- StatCard uppercase label (`:42`): **Cut** with the card.
- StatCard delta "5 pending review" (`AdminDashboard.tsx:93`): **Merge**, already in the queue and badge.
- "92% of registrations" (`:106`): **Cut**, a ratio with no target.
- "Awaiting open seats" (`:116`): **Cut**, restates "waitlisted".
- "NEEDS ATTENTION" eyebrow h2 (`AdminNeedsAttention.tsx:12-14`): **Change** to a sentence-case h2 "To do", or no heading if it's the page's main column.
- Attention items as bordered cards in a 2-up grid (`:36-71`): **Change** to a single list with dividers (rows). The 2-up grid scatters reading order (row 1 full width, then a ragged pair); at 390 the CTA squeezes titles into 2-word lines.
- Attention icon tile `w-11 h-11 rounded-full` tinted (`:46-48`): **Change** to a 16px inline status icon only for danger/warning rows; cut for neutral rows.
- Danger ring on the capacity item (`useAdminAttention.ts` capacity `cardCls`): **Cut**. Danger is reserved for unaccounted, failed email and absent lead today.
- "Full" pill on the capacity item: **Cut**, the title says it.
- Per-item secondary buttons with arrow (`:62-67`): **Change** to text links ("Review applications →") right-aligned in the row; one weight lower.
- "Assign a lead" / "Find cover" → `/admin/classes`: **Change**, deep-link to the section.
- Skeleton tiles (`:16-24`): **Keep**.
- All-caught-up card with Sparkles tile + "✨" (`:25-34`): **Change** to one line, "Nothing needs you right now." No icon tile.
- "JUMP TO" eyebrow + 10 link cards (`AdminDashboard.tsx:124-143`): **Cut**, duplicates the sidebar 1:1.
- Jump card hover lift `hover:-translate-y-px` + shadow (`:131`): **Cut** with the grid.

### Classes `/admin/classes`: `AdminClasses.tsx`, `CapacityMeter.tsx`, `HistoryStrip.tsx`, `InlineConfirm.tsx`
- h1 "Classes" + gold "New class" (`:617-626`): **Keep**.
- Error and fill-error banners with "⚠" (`:631-639`): **Change**, drop the glyph and say what to do ("Seat counts are out of date. Retry").
- New-class card with "NEW CLASS" eyebrow (`:641-656`): **Change**, the form's first label is enough; cut the eyebrow.
- Empty state with BookOpen tile (`:664-670`): **Keep** the copy, **Cut** the icon tile.
- Class card per course, `rounded-[14px]` border (`:676`): **Change**, a class becomes a grid row, not a card.
- Chevron toggle (`:690-692`): **Change**, the whole row expands; keep the chevron only on phone.
- Class name 19px (`:694`): **Change** to 16px semibold; 19 vs h1 24 is a muddy step.
- Slab description truncated (`:696`): **Change** to one line of sans ink-muted under the name, shown only when expanded or on hover; the timetable cell carries the operational facts.
- "N sections" pill (`:699-701`): **Cut**, the cells show the sections.
- Class-level CapacityMeter (`:702-706`): **Cut**, the aggregate hides full sections.
- Class edit / remove icons (`:709-725`): **Keep**, move into the class row's end, 36px targets.
- Inline class confirm (`:728-737`): **Keep** (excellent copy).
- Expanded sunken panel + "SECTIONS" eyebrow (`:741-745`): **Cut** the eyebrow. The panel becomes the inline section detail.
- Section row label + W-chip (`:883-893`): **Change**, the week is the grid column; drop the chip. Disambiguate the duplicate "MC-1" labels by position.
- Schedule line "Mon-Fri · 9:00 AM - 3:00 PM · Maker Lab" (`:894-896`): **Keep**.
- Age chip bordered pill (`:900-902`): **Change** to plain text "Ages 12–14"; a bordered pill implies an interactive filter.
- Section CapacityMeter + "+2 waitlisted" (`:905-910`): **Keep**. **Change** the full colour to ink and the 90% colour to warning (not `bg-warning` #715709, which reads as dark olive "filled", not "nearly full").
- Crew initials discs with gold ring = senior (`:913-923`): **Change** to text: "Daniela Ruiz (lead) +1". Ring colour as a seniority code is undiscoverable.
- "No crew" faint text (`:912`): **Change** to a warning "No lead" flag; it's an attention item elsewhere.
- Row actions: Roster / Print / Edit / Delete 14px icons (`:928-949`): **Change**. Roster becomes the row click (detail panel); Print sits inside the panel; Edit is a panel tab; Delete moves to the bottom of the edit form ("Remove section").
- Section edit form: brand-bordered card + "EDIT MC-1" eyebrow (`:224-227`): **Change**. Cut the eyebrow; group fields as When / Where / Who / Seats.
- "Eligible: Ages 12–14" success pill (`:252-256`): **Change** to plain helper text; green "success" for a computed range is a misuse.
- Week radiogroup Any / Week 1 / Week 2 in gold (`:270-283`): **Keep** the control. **Change** the selected state to ink-on-sunken; gold is the primary action colour.
- Lead select (`:324-331`): **Change**, option text carries level, week availability and current assignment.
- Support chips + "Add a support…" select (`:336-358`): **Keep**.
- History strip (`:780-786`, `HistoryStrip.tsx`): **Keep**. **Change**: put it below the form behind "Show history", consistent with Students.
- Section roster table (`:444-500`): **Keep**. **Change**: hide cancelled registrations, or show them under a "Cancelled (1)" disclosure. Clara Price "Cancelled" sits mid-roster in `before/extra/A-classes-expanded-roster.d.png`.
- Roster red health text (`:476-483`): **Keep** (safety wins).
- Dashed "Add section to Microcontrollers" full-width button (`:832-839`): **Change** to an empty grid cell "+ Add Week 2 section".

### Campers (now "Students") `/admin/students`: `AdminStudents.tsx`, `AdminChangeRequests.tsx`
- Change requests block above the h1 (`:399`, `AdminChangeRequests.tsx:53`): **Change**, place it below the page header as the first section, with the heading "Change requests (2)". Cut the eyebrow-style h2 and the MessageSquare icon.
- Change-request instruction copy (`AdminChangeRequests.tsx:57`): **Keep** (it teaches the flow).
- Quoted message in a sunken bubble (`:70`): **Keep**.
- h1 "Students" (`:402`): **Change** to "Campers".
- Export CSV secondary (`:403-407`): **Keep**.
- Search input with icon (`:409-418`): **Keep**.
- 6 status filter chips with counts (`:421-433`): **Change** to one segmented control or a select. Selected in gold competes with primary buttons; use ink.
- Desktop column header row (`:452-456`): **Keep**, and make it sticky.
- Student initial disc in brand-soft with warning-coloured letter (`:471`): **Cut**, no job.
- Name / Age / Parent cells: **Keep**. **Change**: add grade next to age ("13 · 8th") from the detail facts.
- Registration pills coloured by status (`:479-484`): **Change**. Plain text "Python W1, Java W2" for confirmed; colour and word only for exceptions (Waitlisted, Offered, Cancelled). 70 green pills is a noise floor.
- Medical column, truncated red (`:486-490`): **Change**, wrap, never truncate.
- Row chevron (`:492`): **Keep**.
- Detail: red health callout (`:172-180`): **Keep**.
- Detail facts `<dl>` (`:182-189`): **Keep**. **Change**: parent phone and emergency phone as `tel:` links.
- Detail "REGISTRATIONS" eyebrow (`:192`): **Change** to a plain h3.
- Registration card per registration (`:197`): **Change** to a row with dividers; a card inside an expanded row inside a card is a nested card.
- "Set status:" + 3 pill buttons (`:208-223`): **Change** to a "Status" select. The pills look like the filter chips above.
- "Move to section" select (`:225-245`): **Keep**. **Change**: label options with seats left and age range.
- "Remove registration" danger-outline button (`:246-254`): **Merge** into Status → Cancelled (same write, `useAdminStudents.ts:164-168`).
- Show/Hide history button (`:277-284`): **Keep**.
- Footer "73 students shown · select a student for details…" (`:513-517`): **Change** to "73 campers" only; the instruction is obvious from the chevrons.
- "Show 100 more" (`:518-525`): **Change**, page size 50 with page controls.

### Volunteers `/admin/volunteers`: `AdminVolunteers.tsx` (+ Interviews, Duties merge here)
- Gold segmented "Roster | Applications (5)" above the h1 (`:476-491`): **Change** to underline top tabs under the h1 "Volunteers", with proper tablist.
- h1 that changes per tab ("Volunteer roster" / "Volunteer applications", `:501`, `:621`): **Change** to one h1 "Volunteers".
- Roster Export CSV (`:503-507`): **Keep**.
- Roster table (`:509-516`, columns `:424-470`): **Change** the columns to Name | Level | Week 1 | Week 2, where each week cell shows the assignment ("PY-A lead"), "Free", or "Not available". This merges the ✓ columns and "Assigned to".
- Senior/junior pills, senior in gold (`:430-436`): **Change** to plain text in a Level column; gold for "senior" spends the brand colour on a category.
- Notes column (`:466-469`): **Cut** from the table; it belongs in the row detail.
- "Auto-assign volunteers" section below the table (`:519-545`): **Change**, move it to a toolbar above the Crew table: "Fill open spots: [Week 1 ▾] Preview matches".
- Auto-assign Week 1/Week 2 gold toggle (`:525-538`): **Change** to a select or neutral segmented control.
- Preview table (`:575-600`): **Keep**.
- Applications open toggle, green with ToggleRight icon (`:635-647`): **Change** into a status sentence "Applications are open at scc.haanie.com/apply" + "Copy link" + a secondary "Close applications" with inline confirm. **Merge**: remove the duplicate in Form editor.
- Green "form is live" banner with pulsing dot (`:655-667`): **Merge** into that sentence. Cut the pulse animation (decorative motion).
- Filter pills All/Pending/Accepted/Rejected (`:670-683`): **Keep** as a segmented control. Default to Pending.
- Applicant initial disc, gold on gold (`:706-708`): **Cut** (contrast fail, no job).
- School · grade line: **Keep**.
- W1/W2 green chips (`:719-720`): **Change** to text "Weeks 1, 2"; green implies success.
- Status pill "Pending" (`:723`): **Keep** on the All filter. **Cut** when filtered to Pending (it repeats the filter).
- Interview status per applicant: **Change**, show "Interview Tue 4:00 PM" or "No interview yet" (data exists in bookings), replacing a trip to Interviews.
- Detail section eyebrows CONTACT/AVAILABILITY/… (`:167-264`): **Change** to a two-column `<dl>` with plain labels.
- Accept / Reject as two equal tinted buttons (`:291-300`): **Change**. Accept = primary, Reject = secondary text button; equal weight invites misclicks on a consequential decision.

### Interviews `/admin/interviews` → Volunteers › Interviews tab: `AdminInterviews.tsx`
- Page intro "Open interview slots, book applicants into them, and keep notes." (`:225-229`): **Cut** once it's a tab.
- Three stat tiles Total/Booked/Available (`:232-243`): **Cut**, they restate the list. Fold "3 booked · 17 open" into the tab label or a header line.
- Add-slot card (`:245-265`): **Keep**. **Change** to a single inline row at the top of the list; cut the card chrome.
- "Needs a time" list (missing): **Change**. List pending applicants with no booking first, each with a slot select + "Book". Applicant-first matches the job; the data is already loaded (`bookedAppIds`).
- Day headings (`:288-290`): **Keep**. **Change**: collapse past days.
- Day group cards (`:291`): **Change** to a single table with day group rows.
- Time + "15 min" (`:300-303`): **Keep** the time. **Cut** "15 min" when every slot shares one duration (show it once in the header).
- "Booked" green pill next to the name (`:317`): **Cut**, a name in the row means booked.
- "Available" warning-yellow pill (`:324`): **Change** to plain muted "Open".
- Gold "Book" per open slot (`:342-348`): **Change** to a secondary text button. 17 gold buttons dilute the primary.
- Notes / unbook / delete 14px icons (`:322-357`): **Keep** the functions. **Change** to 36px targets.
- Notes preview truncated under the name (`:313-315`): **Keep**.

### Duties `/admin/duties` → Volunteers › Duties tab: `AdminDuties.tsx`
- Intro copy (`:97-98`): **Change** to "Accepted volunteers sign up for these from their dashboard." Cut the rest.
- Two-column layout: Duty types left, Slots right (`:100-160`): **Change**. Duty types become a compact editable list in a disclosure ("Duty types (4)"); they're set once a season.
- "Add duty slot" card with Duty/Date/Volunteers/Add (`:170-200`): **Keep** the function. **Change** to a toolbar row above the grid.
- "All sessions" select (`:164-168`): **Change** to Week tabs.
- Slots grouped by day, sorted by duty name (`:218-250`): **Change** to a grid per week: rows = duty types in a fixed order (creation order, as listed in Duty types), columns = Mon–Fri, cells = "2/2 Aiden, Cameron" or "1/2 · 1 open". Turns 3,260px into one screen per week.
- "Full" green / "Open" warning pills (`:240-243`): **Change**, mark only the gap ("1 open") in warning text. Full is the normal state.
- Per-slot trash icon (`:244-249`): **Keep** the function, inside the cell's hover or focus menu.

### Attendance `/admin/attendance` → Home's camp-day state: `AdminAttendance.tsx`, `AttendanceExport.tsx`
- h1 + date + "Updated 9:31 PM" (`:166-173`): **Keep** the date and updated time. **Change**: auto-refresh.
- Refresh ghost button (`:174-180`): **Keep** as a secondary manual override.
- "No camp today" card (`:191-201`): **Change** to a single line in the Home status sentence.
- Four stat cards (`:204-221`): **Cut** as cards. "Unaccounted" becomes the heading of the unaccounted list ("3 campers unaccounted"); "no roll call" becomes the heading of its list; campers today / present join the status line.
- Section card per section, alphabetical (`:59-153`, sort `useAttendanceBoard.ts:188`): **Change**, sort by trouble; collapse sections with no problems to one line.
- Roll-call chips "Arrival 12/12 · 9:02" coloured (`:79-96`): **Keep**; this is the right density.
- "No roll call taken yet — call the lead." warning panel (`:97-101`): **Change** to "No roll call yet · Lead: Daniela Ruiz · Maker Lab".
- "Everyone accounted for at Arrival." green line (`:102-104`): **Keep**, and add a page-level all-clear.
- Unaccounted row with Call parent / Call emergency contact `tel:` buttons (`:28-56`): **Keep**. The best element in the admin.
- Section print icon (`:74-77`): **Keep**.
- Show/Hide full roster with ✓ / ✗ / – marks (`:113-150`): **Keep**. **Change**: drawn icons instead of Unicode glyphs (`:22-26`).
- End-of-week export card with gold primary (`:233`, `AttendanceExport.tsx:118-147`): **Change** to a secondary button inside a "Week export" disclosure at the bottom. It's a Friday job, not a 9am one.

### Updates `/admin/updates`: `AdminUpdates.tsx`, `UpdateComposer.tsx`, `UpdatesFeed`, `EmailLog.tsx`
- Intro paragraph (`:21-23`): **Change** to "Posts appear on parent and volunteer dashboards and in their bells." The "Also email" explanation already sits beside the checkbox.
- Composer card with brand border + "NEW UPDATE" eyebrow + Megaphone (`:26-31`): **Change**. Cut the eyebrow and icon; the h1 says Updates and the composer is the page's primary.
- "Send to" select (`UpdateComposer`): **Keep**.
- "Message · This season's parents and every volunteer" audience echo: **Keep** (it confirms reach).
- 0/2000 counter: **Change**, show it only past 1,800.
- "Also email (opens your mail app)": **Keep**.
- Feed card wrapper (`:35`): **Change**, a list with dividers, no outer card.
- Feed megaphone icon tile per post: **Cut**, every row is an update.
- Per-post mail and trash icons: **Keep**.
- "EMAILS THE APP SENT" card (`:47`, `EmailLog.tsx:50-86`): **Change** to a second tab "Sent emails", or a collapsed section. **Change** the copy "(spec 02)" to "the email service isn't connected yet".

### Users & roles `/admin/users` → Setup › Users: `AdminUsers.tsx`
- Intro "Every account and what it can access…" (`:111-112`): **Change**, keep only "Role changes apply the next time the person loads a page."
- Section heads with icon tile + count pill (`:136-145`): **Change** to tabs "Admins 2 · Volunteers 28 · Parents 47" + a search box.
- Parents icon `GraduationCap` in info blue (`:133`): **Cut** (wrong icon; collides with volunteer blue).
- User initial disc (`:158-162`): **Cut**.
- Name + "(you)" + email · joined (`:164-171`): **Keep**.
- Two-step sign-in line + Reset (`:172-181`): **Keep**.
- Repeated "Role" label before each select (`:197`): **Cut**; the tab says the role. **Change** the select to a "Change role" text button that reveals the select inline.
- "You can't change your own role" / "Only admin" (`:191-193`): **Keep**.
- Role and MFA inline confirms (`:212-231`): **Keep**.

### Form editor `/admin/forms` → Setup › Forms: `AdminFormEditor.tsx`
- Intro copy (`:137-138`): **Keep** "Changes apply to the live forms immediately." (critical). Cut the rest.
- Form tabs as gold pills (`:141-157`): **Change** to the shared underline tab style.
- Form header card: name + "Open · The public form at /apply" (`:172-181`): **Change** to a status line.
- Preview link (`:183-190`): **Keep**.
- "Close form" danger-soft / "Open form" success-soft (`:191-199`): **Merge** into Setup › Season (registration) and Volunteers › Applications (applications); add a confirm. Two controls for one setting is the P0.
- Table header "Show / Question label (click to rename) / Required?" (`:204-208`): **Change** to "Show / Question / Answer". Give the rename an edit affordance on hover and focus instead of the parenthetical.
- Lock icon in the Show column (`FieldRow`): **Keep**.
- Show switch `role="switch"`: **Keep**.
- Dashed underline on labels: **Keep** as the rename cue, **Change** to appear on hover and focus only.
- Locked "Required" grey pill vs toggleable "Required" red pill (`:82-95`): **Change** to a two-option segmented control "Required | Optional" for toggleable rows and plain text "Always required" for locked ones. Red reads as an error.
- Footnote about locked questions (`:224-226`): **Keep**.

### Sessions `/admin/sessions` → Setup › Season: `AdminSessions.tsx`, `SeasonSettingsCard.tsx`
- Intro "Each session is one camp week. The year's first and second sessions by date are Week 1 and Week 2, shown or hidden." (`:264`): **Change** to "Each session is one camp week."; the rest is implementation.
- "New session" gold primary (`:266-273`): **Keep**.
- Season settings card above the sessions (`:278`): **Keep** as the first block of Setup › Season, retitled "Registration". **Merge** in the registration on/off switch and status.
- CalendarClock icon in the settings h2 (`SeasonSettingsCard.tsx:52`): **Cut**.
- Opening-time datetime field + "Leave empty for no scheduled opening." (`:66-69`): **Keep**.
- Long label "Parents can cancel or switch until (days before a session)" (`:71`): **Change** to label "Change deadline" + suffix "days before the week starts".
- "…in the week before camp (hours)" (`:79`): **Change** to "Offer window in the final week" + suffix "hours".
- Disabled gold "Save settings" (`:86-89`): **Keep**.
- Session card calendar icon tile (`AdminSessions.tsx:317-319`): **Cut**.
- Session name + year + Shown/Hidden pill (`:322-328`): **Keep**. **Change**: "Shown" green → plain "Visible to families"; only "Hidden" needs emphasis.
- Edit / delete icons (`:334-349`): **Keep**, 36px.
- "DAILY SCHEDULE" eyebrow + 8 rows with 16 icons, repeated for Week 2 (`:353-…`): **Change** to a collapsed "Daily schedule · 8 blocks · 8:30 AM–3:30 PM" disclosure per week. Inside, row actions appear on hover and focus.
- Dashed "Add a time block" button: **Keep** inside the disclosure.

## 9. Redesign direction (for the mockup)

### Information architecture

Sidebar: **5 primary items + Setup**, no group headings, one divider.

| Nav | Contains (merged from) | Why |
|---|---|---|
| **Today** `/admin` | Dashboard + Attendance (camp-day state) | The Director's first screen; on camp days it *is* the roll-call board |
| **Campers** `/admin/campers` (alias `/admin/students`) | Students + Change requests | One noun, the product's own word |
| **Classes** `/admin/classes` | Classes + sections as a week × class grid | Sections are the unit; weeks are columns |
| **Volunteers** `/admin/volunteers` | Applications · Interviews · Crew · Duties (top tabs) | One pipeline: apply → interview → crew → duties |
| **Updates** `/admin/updates` | Compose · Posted · Sent emails | Unchanged scope, calmer layout |
| *divider* | | |
| **Setup** `/admin/setup` | Season (registration controls, session dates, daily schedule) · Forms · Users & roles | Set once a season; out of the daily path |

Avatar menu: name, "Admin", theme (light/dark), sign out. Sidebar footer removed. Badges: Today = count of danger/warning items; Volunteers = pending applications. No other badges. Old routes redirect (`/admin/attendance` → `/admin?view=roll-call`, `/admin/interviews` → `/admin/volunteers?tab=interviews`, etc.).

Frame for every page: a 24px h1, an optional one-line ink-muted description, and the primary action right-aligned on the same line. Content is left-aligned at a 32px gutter (24px at ≤1280, 16px at 390). Tables fill to 1200px max; forms and feeds cap at 720px. One tab style: underline top tabs, ink text, 2px gold underline for the selected tab (gold as an indicator, not a fill). Selected filters and segments: ink on sunken. **Gold fill is reserved for the page's one primary action.**

Colour roles (fix the semantics): danger = unaccounted / medical / failed email / destructive. Warning = needs a person soon (no lead, no roll call, pending > 3 days, open duty). Info = waitlist. Success = done states only (roll call complete, saved). Full section = ink.

### Today (`/admin`)

**Registration / off-season state.** Header: h1 "Today" + status sentence (P0), e.g. "Registration opens Sat Feb 1, 9:00 AM (Denver) · 0 campers so far" or "Registration open since 9:00 AM · 412 campers · 38 seats left · 9 waitlisted". The sentence refreshes on an interval and on tab focus; "Updated 9:14" sits at its end.
- 1440: two columns, 7/5. Left: **To do**, a list (rows with dividers, no cards). Each row: a 16px status icon (danger/warning only), a title, a muted detail on the same line where it fits, and a right-aligned text link. Severity order, with unaccounted always first. Right: **Seats**, the week × class mini-grid. Rows = 4 classes, columns = W1/W2, each cell = "PY-A 10/10 · 1 wait" with a 4px meter, and "No lead" flagged in warning. Clicking a cell deep-links to the Classes section panel.
- 1280: same 2 columns at 3/2; the Seats grid drops the descriptions.
- 390: status sentence, then To do, then Seats as a stacked list grouped by week. No stat cards, so To do starts within the first 200px.
- Removed: greeting, subhead, 5 stat cards, icon tiles, Jump-to grid, eyebrows, the danger ring on full sections.

**Camp-day state** (a session is running today): the header status sentence becomes "Week 1 · Monday · Lunch roll call at 12:00 · Updated 8:55". The left column becomes **Roll call**:
1. "3 campers unaccounted": one row each with name · age · section · room · "Missed Arrival", the medical note in danger text, and Call parent / Call {emergency contact} buttons (44px).
2. "2 sections have no roll call yet": section · room · "Lead: Daniela Ruiz".
3. "All sections": one line per section ("PY-A · Room 101 · Arrival 12/12 9:02") that expands to the full mark grid. Problem sections first.
4. A page-level all-clear when 1 and 2 are empty: "All 73 campers accounted for at Arrival."

The right column becomes To do. "Week export" is a disclosure at the bottom with a secondary "Download attendance CSV". A "Roll call / To do" top-tab pair appears only at 390, where both don't fit.

### Campers

h1 "Campers" + Export CSV (secondary). Change requests (when any) sit directly under the header as a compact list with Reply / Decline / Mark done.
- Toolbar: search (with parent name), status segmented control (All · Waitlisted · Offered · Cancelled · Not registered; Confirmed stays in All to cut noise).
- Table at 1440: Camper (name, then muted "13 · 8th grade") | Parent (name + phone as link) | Classes (plain "Python W1 · Java W2"; exceptions as a coloured word) | Health (full wrapped text in danger). 50 rows per page, sticky header.
- Row expansion: two columns. Left: facts `<dl>` and the health callout. Right: one row per registration: class · section · week | Status select | Move to select (options show "PY-B W1 · 9/16 · ages 11–13") | Show history.
- 1280: the Parent column drops the phone into the expansion.
- 390: rows are two lines (name + classes / parent + health flag icon); the expansion stacks.
- Removed: initials discs, the coloured confirmed pills, "Remove registration" (merged into Status), the footer instruction.

### Classes

h1 "Classes" + "New class". **Timetable grid** (the signature move): a sticky header row "Class | Week 1 · Oct 19–23 | Week 2 · Oct 26–30".
- Each class row: name (16px semibold), muted "Ages 9–13" range, and the class edit/remove at the row end.
- Each cell lists that class's sections for that week as stacked mini-rows: "PY-A · 9:00–3:00 · Rm 101", a meter "10/10 · 1 waitlisted", "Harper Ito +2". "No lead" in warning. An empty cell shows "+ Add section".
- Selecting a section opens an **inline panel spanning the full row width** under that class, with tabs Roster · Edit · History and actions Print roster / Remove section. Only one panel is open at a time. A deep link `?section=<id>` opens it from Today's "Assign a lead / Find cover".
- Lead select options: "Harper Ito · senior · free Week 1"; suggested cover listed first.
- 1440: class column 260px, two week columns flexible. 1280: class column 220px; class descriptions hidden.
- 390: week top tabs (Week 1 / Week 2); each class is a heading with its sections as rows below; the panel opens full width under the row.
- Removed: class cards, aggregate class meter, "N sections" pill, "SECTIONS" eyebrow, initials discs, W-chips, dashed full-width add button, the 4 row icons (moved into the panel).

### Volunteers

h1 "Volunteers". Top tabs: **Applications (5) · Interviews · Crew · Duties**.
- *Applications*: a status line "Applications are open · scc.haanie.com/apply · Copy link · Close applications" (one control, with confirm). Filter segmented control (Pending default). Rows: name, then muted "Grandview HS · 11th · Weeks 1, 2", then interview state ("Tue 4:00 PM" / "No interview yet" in warning), then chevron. Expansion: two-column `<dl>`; Accept (primary) + Reject (text).
- *Interviews*: an add-slot inline row. "Needs a time (2)" list first, each with a slot select + Book. Then upcoming slots as a table grouped by day (Time | Applicant or "Open" | Notes | actions). Past days collapsed.
- *Crew*: toolbar "Fill open spots [Week 1 ▾] Preview matches" + Export. Table: Name | Level | Week 1 | Week 2 (each cell "PY-A lead" / "Free" / "—"). Notes move into the row expansion.
- *Duties*: Week top tabs. Grid of duty types × Mon–Fri. Cell: filled names, "1 open" in warning. Add-slot toolbar row. "Duty types (4)" disclosure for setup.
- 1280: same, with tables tighter. 390: tabs scroll horizontally; the Crew table becomes rows with Week 1 / Week 2 lines; the Duties grid becomes day sections listing duties.

### Updates

h1 "Updates". Tabs: **Post · Sent emails**. Post: the composer with no wrapper card or eyebrow, then the posted list with dividers (author, audience, time, body, mail/delete). Sent emails: the email log list; the stuck-queue alert in warning with plain copy. 720px column at every desktop width; full width at 390.

### Setup

h1 "Setup". Tabs: **Season · Forms · Users & roles**.
- *Season*: a "Registration" block: status ("Opens Feb 1, 9:00 AM" / "Open" / "Closed"), the on/off switch (moved from Forms, with confirm), opening time, change deadline (days), offer window, final-week offer window, Save. Then a "Volunteer applications" status + switch. Then "Weeks": each session row (name, dates, "Hidden" when hidden, edit/delete) with a collapsed "Daily schedule · 8 blocks · 8:30 AM–3:30 PM" disclosure.
- *Forms*: form tabs (Camper registration · Volunteer application), a Preview link, and the field table (Show switch | Question | Required/Optional segmented control, or "Always required").
- *Users & roles*: search + tabs Admins · Volunteers · Parents; rows with name, email · joined, two-step state, and a "Change role" control.

### Copy changes (consolidated)
- "Students" → "Campers" (nav, h1, filters, footer, CSV filename).
- "Good evening, Jordan / Manage classes, volunteers, and registrations." → "Today" + status sentence.
- "2 sections are at capacity" → "2 sections full · 2 waitlisted". CTA "Review classes" → "See seats".
- "1 section has no lead" CTA "Assign a lead" → keep the label, deep-link to the section.
- "No roll call taken yet — call the lead." → "No roll call yet · Lead: {name} · {room}".
- "Duty schedule" → "Duties". "Form editor" → "Forms". "Sessions" → "Season" (inside Setup), with "Weeks" as the list heading.
- "Available" (interview slot) → "Open". "Booked" pill → removed.
- "Question label (click to rename)" → "Question". "Required?" → "Answer".
- "Applications open" toggle → "Applications are open" + "Close applications".
- "…the email provider isn't set up yet (spec 02)." → "…the email service isn't connected yet."
- "⚠ {raw error}" → "Couldn't {action}. {plain cause if known}. Try again." (keep the raw message in a `title` or console).
- "You're all caught up ✨" → "Nothing needs you right now."
- "W1"/"W2" in tables → "Week 1"/"Week 2" where space allows (grid column headers make chips unnecessary).

## 10. Minor observations and questions

**Minor**
- `bg-warning` (#715709) as the "almost full" bar fill reads as a darker "more full" gold, not as a warning (`CapacityMeter.tsx:12`). Use the warning-soft track with a warning-deep tick, or rely on the text.
- Type scale has no clear steps: 11, 12, 12.5, 13, 14, 15, 19, 24, 30 and 40px all appear in admin. Collapse to 12 / 14 / 16 / 20 / 24.
- Josefin Slab used for class descriptions and the dashboard subhead (`AdminClasses.tsx:696`, `AdminDashboard.tsx:71`): a second family doing a muted-caption job. Use the sans.
- `hover:-translate-y-px` lift on jump cards and `animate-pulse` on the "form is live" dot: decorative motion on an Operate surface.
- The section edit form, History and roster can all be open at once on Classes; one panel at a time is calmer.
- The dashboard mounts `useAdminAttention` twice (dashboard + bell), and the layout runs its own badge queries. The plan's 2.9s dashboard load (§ perf table) is partly self-inflicted.
- The attention item for interviews says "post more slots or book them in", but the Interviews page can't show *who* needs booking.
- Sidebar active pill plus gold bar plus bold text: three signals for one state.
- `role="alert"` on every `InlineConfirm` (`InlineConfirm.tsx:25`) interrupts screen readers for a user-initiated confirm; `role="group"` with a labelled region is calmer.
- Volunteers roster at 390 clips "Assigned to" with no scroll shadow (`admin-admin_volunteers.m.png`).
- At 390, the dashboard attention card CTAs squeeze titles to 2–3 words a line (`admin-admin.m.png`); the CTA should drop below the text under 480px.
- Sessions "2026" year next to "Week 1" is noise when every session is the same year; show the year once in the page header.
- Admin focus rings rely on `ring-brand` (#F1C446) on white inputs, about 1.6:1. Use `--ring` with an ink offset, or a 2px ink outline, for keyboard focus.

**Questions to consider**
- Josefin Sans is "inferred" as a kit font, not confirmed for UI text. For dense admin tables, would the director accept Josefin for headings and the wordmark only, with a high-x-height UI sans for data? It would sharpen every table without touching the brand.
- If a full section is good news, what should opening night *feel* like at 9:15? A seat grid that fills in, with no red anywhere, would be the peak moment the product currently lacks.
- Does the admin need "Today" to change shape by season phase (setup → registration → camp week → wrap-up) instead of one page trying to serve all four?
- Should Setup live in the avatar menu (as for parents and volunteers) or stay a sixth sidebar item? It's visited a handful of times a season, but registration controls are critical on one night.
- Two sick volunteers who text can't be recorded in-app, so the board can't show the gap. Is "today's crew per section" visible enough in the timetable grid that the Director sees it by sight, without a new feature?
- What would this look like if every page had exactly one gold button?
