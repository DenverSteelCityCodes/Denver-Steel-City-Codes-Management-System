# Assessment A: volunteer surfaces (design review, unanchored)

Scope: `/volunteer` (Today, both pre-camp and camp-day states), `/volunteer/classes`, `/volunteer/duties`, `/volunteer/updates`, `/volunteer/profile`, the applicant waiting room (`/volunteer` as "Volunteer applicant"), and `/print/roster/:sectionId`. Source read in full: `src/components/VolunteerLayout.tsx`, `src/pages/volunteer/*`, `RollCallPanel.tsx`, `RollCallRow.tsx`, `MedicalFlag.tsx`, `VolunteerSelfService.tsx`, `UpdateComposer.tsx`, `UpdatesFeed.tsx`, `InterviewSlotPicker.tsx`, `InlineConfirm.tsx`, `src/pages/PrintRoster.tsx`, plus `lib/campers.ts`, `lib/campDay.ts`, `hooks/useRollCalls.ts`. `DailySchedule.tsx` and `RollCallStatus.tsx` are not rendered on any volunteer surface (parent dashboard only); the volunteer schedule is a second, separate implementation (`ScheduleBlock` in `pages/volunteer/parts.tsx:44`).

Evidence: the brief's `before/` screenshots plus new read-only captures in `design/impeccable-audit/before/extra/`:
- `vol-campday-today*.{android,m,d}.png`: Today on a camp day. The clock was faked to Mon 19 Oct 2026, 9:05 AM Denver, at 360×640 (a small Android), 390×844 and 1440×900. Nothing was marked.
- `vol-campday-today-scrolled.android.png`, `vol-campday-medical-open.android.png`: the sticky header while scrolling, and a health note opened.
- `vol-campday-dark.m.png`, `vol-classes-dark.m.png`: dark mode.
- `vol-menu.m.png`, `applicant-menu.m.png`: avatar menus.
- `vol-classes-medical.m.png`: a roster health note opened.
- `vol-duties-cancelconfirm.m.png`, `vol-duties-fri.m.png`: duty drop confirm opened but not confirmed, and the Friday day view.
- `vol-updates-composer.m.png`: composer opened, nothing posted.
- `vol-profile-edit.m.png`: edit forms opened, nothing saved.
- `vol-print-roster.{m,d,print}.png`: print roster on phone, desktop and print media.
- `applicant-changetime.m.png`: picker opened, nothing booked.
- `vol-duties-focus.d.png`: keyboard focus.

Measured at 360×640 on the camp day:
- Sticky roll-call header: 205px.
- Sticky tab strip: 48px.
- Targets under 44px: the three roll-call tabs (40px) and the "Medical" chips (76×24px).

---

## 1. Design Specificity Verdict (unanchored)

**Mostly category-interchangeable, with one real authored moment.**

The authored moment is the camp-day roll call: a dark ink slab carrying the roll-call name, a gold present-count, three time-of-day tabs and a full-width gold "Mark all 9 present", over a list of one-tap toggles. That composition belongs to this product. It encodes how a camp room actually works: mark everyone, then untick whoever is missing. It defaults to the roll call for the time of day. "Mark all" never overwrites a co-volunteer's existing marks (`useRollCalls.ts:41-60`), and a call button appears only on absent rows. It is the closest thing the portal has to a signature move, but it is undercut by its size (it eats 40% of a small phone) and by hiding the safety data it exists to surface.

Everything else is the generic "cream SaaS" kit:
- white rounded list cards with 1px borders (`listCls`, `parts.tsx:13`);
- section headers with an underlined text link on the right;
- calendar-style date stacks;
- small tinted pills (Lead, Full, You're on, Medical);
- initials avatars on every person row;
- a megaphone avatar on every update.

Cover the wordmark and the pre-camp Today, Duties, Updates and Profile screens could belong to a gym class booker, a church volunteer rota or a coworking app. Nothing is wrong with familiarity on an Operate surface. The issue is that the decoration it carries (avatars, pills, icon circles, card borders, double-ringed avatars) is the category's default chrome rather than this product's information. Meanwhile the product-specific information (who has an allergy, who to call, what a duty involves, when to be where) is hidden behind taps or absent.

Brand presence is correct and restrained. The ink bar holds the wordmark and the gold underline marks the active tab. Gold is used for primary actions and never as text on cream. Josefin Sans gives the screens a voice, but it is applied to everything, including 12–13.5px data such as audience labels, the "Week" caption, initials and schedule times. Josefin's small x-height and geometric figures make those small sizes harder to read on a low-DPI Android, which is exactly where volunteers use this.

Missed opportunity: the camp day is a timetable (arrival, after lunch, dismissal, and a fixed daily schedule). A timetable rhythm (time column, "now" row, roll-call checkpoints that live on that same timeline) could tie roll call and schedule into one product-specific structure. Instead they are two unrelated components in two columns.

## 2. Nielsen's 10 heuristics

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Live count, aria-live hint, ✓ on finished roll-call tabs and optimistic toggles are good. But any single tap greys *every* row to 50% until two round trips finish (`RollCallPanel.tsx:132`, `RollCallRow.tsx:58`). Save errors land in a banner above the list, out of view while scrolled (`RollCallPanel.tsx:112`). The duty day-tile dot (`VolunteerDuties.tsx:123`) is unexplained on screen. |
| 2 | Match System / Real World | 3 | "Roll call", "Arrival / After lunch / Dismissal", "Tell the camp" and "Drop duty" are the crew's own words. But "Mark" (`RollCallRow.tsx:63`) doesn't say what a tap does. Ages are a bare "13" with no label. The section code "PY-B" carries the headline. The "Week 1 / 1" stack looks like a calendar date. |
| 3 | User Control and Freedom | 3 | Toggles are reversible, dropping a duty asks inline with "Keep it" focused, and the interview has "Keep my time" plus Cancel on every form. But Profile's "Back" always goes to Today, even when you arrived from Duties' "Tell the camp" (`VolunteerProfile.tsx:29`). The print page's Back is `history.back()` and dead-ends on a direct visit. "Mark all present" has no single undo. |
| 4 | Consistency and Standards | 2 | Four selected-state styles: gold-underline tabs, ink segmented week toggle, gold day tile, white-on-ink roll-call tabs. Four pill treatments. Control heights of 36, 40 and 44px (InlineConfirm `h-9`, composer and slot picker `h-10`, roll-call tabs `h-10`). Desktop tabs have icons and phone tabs don't. The same date-stack visual means "week" in one place and "day" in another. There are two schedule components. |
| 5 | Error Prevention | 3 | Strong where it counts. Roll call defaults to the time-of-day tab. "Mark all" keeps existing marks. Absence dates have a `min`. Destructive actions confirm inline. The time-based tab switches to After lunch at 11:30, before lunch happens (`campDay.ts:12`), a mild trap. |
| 6 | Recognition Rather Than Recall | 2 | Health notes sit behind a 24px chip on both the roll call and the roster (`MedicalFlag.tsx:13`). The call button shows neither who you're calling nor the number (`VolunteerClasses.tsx:97`). Duties show a name only: no time, and the duty type's existing `description` is never shown. The screen roster shows *less* than the paper roster. |
| 7 | Flexibility and Efficiency | 3 | Mark-all accelerator, time-of-day default, `tel:` links, paper roster, single-tap toggles and deep link from Duties to days off. No bulk "mark absent", which is fine. |
| 8 | Aesthetic and Minimalist Design | 2 | Decorative initials avatars on every camper row (twice), a megaphone circle on every update, and a double-ringed avatar on Profile. "Confidential — for camp staff only" repeats under every health note. Week 1 and Week 2 rows are identical. The pre-camp Today is a full 8-row schedule plus three other sections. The roll-call header repeats its tab name in an H2 and shows a gold "0". |
| 9 | Error Recovery | 2 | Roll-call errors are generic ("check your connection") and don't name the camper. Duty claim, absence and switch errors print the raw Supabase `error.message` (`VolunteerSelfService.tsx:142, 226`). Interview booking falls back to "Something went wrong" (`VolunteerApplicant.tsx:68`). |
| 10 | Help and Documentation | 2 | Good inline hints ("Mark everyone, then tap whoever is missing", "Tell the camp early so they can find cover"). But no volunteer or applicant surface shows the camp's contact address (it exists only on `/apply` and in the parent layout). Applicants get no decision date and no word on how they'll join the "online" interview. Duties never explain what a duty involves. |
| **Total** | | **25/40** | **Acceptable**: solid mechanics, but significant recognition, consistency and noise problems before it is impeccable. |

## 3. Cognitive load

Checklist (pass/fail across the portal, weighted to the camp-day job):

- [x] **Single focus.** Camp-day Today leads with roll call. *But* the pre-camp Today (`volunteer-volunteer.m.png`) gives four sections equal weight: classes, duties, a full schedule and the latest update.
- [ ] **Chunking.** The pre-camp schedule is one 8-row group. The applicant picker is 17 slots in one column. **Fail.**
- [x] **Grouping.** Proximity and list surfaces group well.
- [x] **Visual hierarchy.** Clear H1 on every screen. The roll-call slab dominates on camp days.
- [x] **One thing at a time.** Duties shows one week, then one day. Roll call shows one roll call at a time.
- [ ] **Minimal choices.** See the decision points below. **Fail.**
- [ ] **Working memory.** A volunteer must remember which camper has which condition, because each note closes again and isn't on the row. They must remember what "Break Supervision" means and when it is. They must know that the phone icon calls the emergency contact rather than the parent; only the screen-reader label says so. **Fail.**
- [ ] **Progressive disclosure.** Applied backwards. Safety information (health notes, who to call) is hidden. Low-value information (age, initials, "Confidential" footnote, full schedule before camp) is always shown. **Fail.**

**4 failures: high cognitive load** for a screen used standing up with kids in front of you, even though each screen individually looks calm.

Decision points with more than 4 visible options:
- **Applicant "Change time"** (`applicant-changetime.m.png`): 17 slot buttons across 9 days in one tall column. The current slot isn't marked in the list, and Keep/Move buttons sit stacked and right-aligned below it all.
- **Duties, "Find a duty"**: a week toggle (2), five day tiles and four slot rows, alongside your own duty's Cancel and "Tell the camp". About 12 targets on one screen. It is grouped well, but the day tiles' "1 open" figures and the unexplained dot add reading load.
- **Roll call**: 9–12 identical "Mark" buttons plus three tabs and "Mark all". This is inherent to the task and acceptable, because "Mark all" collapses it to one decision.

## 4. Emotional journey

**Waiting on an application (applicant).**
- Peak: a calm, numbered four-step tracker. The interview time is set large ("Tue, Oct 20, 4:00 PM"), which is the most reassuring element in the portal.
- Valleys:
  - The page never says who to ask. A 15-year-old with a conflict has no address, and the rejection state is a dead end too (`VolunteerApplicant.tsx:11-18`).
  - "15 minutes, online" with no hint how they'll join, so anxiety peaks the hour before the interview.
  - "Change time" explodes into a 17-button wall that doesn't show the current time as selected.
  - "Decision: We email everyone after interviews wrap up" gives no time frame.
- End: the step list stops at "An admin will assign you to a section", which is fine.
- Net: reassuring at a glance, thin the moment something goes wrong.

**First camp morning (accepted volunteer).**
- Saturday before: "Week 1 starts Monday. Your first day is Monday, October 19, and the day starts at 8:30 AM. Roll calls open that morning, right here." Excellent: specific, warm, sets the expectation.
- Monday 9:05: the page opens on "Day 1 of Week 1" plus a two-line sentence. That headline takes 170px on a 360px phone, and the roll-call slab takes another 205px. On a 360×640 Android only one and a half campers are visible on load (`vol-campday-today-viewport.android.png`).
- The count reads a large gold **0** "of 9 present", a faintly alarming way to start the day.
- "Mark all 9 present" is the obvious, confident move.
- Finishing is under-celebrated. "Taken at 9:05. 9 present." appears as 14px muted text in the header; the only other sign is a ✓ on the tab. For the peak-end rule, the moment the volunteer finishes the room's first roll call should land: the header could settle into a calm success state.

**A kid with an allergy.**
- This is the portal's lowest point. The roster and roll call show a red "Medical" chip, 24px tall, with the condition hidden.
- The label says "Medical" even when the note is an allergy. `healthNote()` builds "Allergies: … · Medical: …", but the chip always says "Medical".
- Tapping opens a pink box squeezed into the name column, about 165px wide on a 360px phone (`vol-campday-medical-open.android.png`). It ends with "Confidential — for camp staff only.", which a staff member already knows.
- At lunch, the teen supervising has to remember which of 12 kids is diabetic or tap 12 chips.
- The **paper** roster prints "Type 1 diabetes — checks levels at lunch" in bold in its own column: the printout is safer than the phone. PRODUCT.md principle 3 ("Safety information wins the screen") is violated on the very screens it was written for.

## 5. What's working

1. **Roll-call mechanics are genuinely good product thinking** (`RollCallPanel.tsx:26-28, 101-109`; `useRollCalls.ts:40-77`).
   - It defaults to the roll call for the time of day, not "first untaken", with the reason documented in the source.
   - "Mark all N present" becomes "Mark the other N present", and the database decides who is unmarked, so a co-volunteer's absent mark survives.
   - One toggle per camper, with Present and Absent shown as icon plus word, not colour alone.
   - The aria-live hint announces "8 campers still to mark".
   - A call button appears only when a camper is absent.
   - Under 30 seconds for a full room is realistic.
2. **The shell honours the platform decisions.** Top tabs stick under the ink bar (iOS Safari's bottom toolbar is respected and documented at `VolunteerLayout.tsx:18-21`). Inputs are 16px. The main controls are 44px. Settings are under the avatar. Bottom padding is safe-area aware. Every destructive action is an inline confirm with the safe choice focused (`InlineConfirm.tsx:37`). Dark mode is coherent, and the roll-call slab correctly becomes a raised surface in dark.
3. **Copy voice is plain and specific in the right places.**
   - "Can't make a day? Tell the camp"
   - "Drop Morning Check-In on Monday, October 19? The camp will need someone else to cover it." with "Keep it" / "Drop duty"
   - "You and 1 other"
   - "Roll calls open that morning, right here."
   - Duties reveal one week and one day at a time instead of a wall of slots.

## 6. Priority issues

### [P1] 1. Health notes are hidden behind a 24px "Medical" chip on the roll call and the roster
- **What:** `MedicalFlag` (`MedicalFlag.tsx:13-28`) renders a 76×24px chip. It always reads "Medical", even for allergies, and hides the note until tapped. Opened, the note wraps inside the name column (`RollCallRow.tsx:39-43`, `VolunteerClasses.tsx:92-96`), so it becomes a tall, narrow pink box, plus a footnote. The roster header says "2 with health notes" but doesn't say who.
- **Why it matters:**
  - It breaks PRODUCT.md principle 3 on the exact screens it was written for.
  - The volunteer must recall which camper has which condition.
  - A 24px target on a cracked screen will be missed.
  - The paper roster shows more safety information than the app.
- **Fix:**
  - Drop the chip. Render the note text, always visible, as a second line under the camper's name, in danger ink at 15px with one `HeartPulse` icon. Split it into its kinds: "Allergy: peanuts", "Medical: Type 1 diabetes, checks levels at lunch".
  - Cut the per-note "Confidential" footnote; say it once in the roster header or not at all.
  - Same treatment on roll call, roster and print (print already does this).
  - On the roster, change "2 with health notes" to a filter-free anchor that lists the names: "Health notes: Andre Tran, Kai Lopez".
- **Command:** `/impeccable clarify` then `/impeccable layout`.

### [P1] 2. The camp-day roll call header takes 40% of a small phone and pushes campers off-screen
- **What:** At 360×640 the sticky stack is the 48px tab strip plus a 205px roll-call header: H2, hint, 44px count, 40px tabs and a 48px gold button (`RollCallPanel.tsx:61-110`). Above it, the "Day 1 of Week 1" head plus sentence (`VolunteerToday.tsx:35-38`) takes about 170px. On load, 1.5 campers are visible. Scrolled, 4–5 of 12 are visible.
- **Why it matters:** The job is to look up from the screen at a kid and tap their row, over and over. Every scroll is a missed glance at the room. The H2 "Arrival roll call" repeats the selected "Arrival" tab, and the hint repeats the count.
- **Fix:**
  - Collapse the day head to one dateline: "Mon Oct 19 · Day 1 · PY-B, Room 102 · you lead · also Morning Check-In".
  - Make the sticky part a single ~56px ink row: segmented Arrival / After lunch / Dismissal with ✓ on the left, and "0/9" right-aligned in gold.
  - Move "Mark all 9 present" out of the sticky region, to the top of the list in normal flow. It disappears once used, as it does today.
  - Show the hint only before the first mark, as a line under that button.
  - Raise the roll-call tabs to 44px.
- **Command:** `/impeccable layout`, then `/impeccable adapt`.

### [P1] 3. Who to call is invisible on screen
- **What:**
  - The roster shows a 44px outlined phone icon on every row (`VolunteerClasses.tsx:97-102`). It calls `callTarget()`: the emergency contact if one exists, else the parent (`lib/campers.ts:35-38`). The name, relationship and number appear only in the aria-label.
  - Roll call shows the same bare icon on absent rows (`RollCallRow.tsx:45-53`).
  - The parent's number is unreachable on screen whenever an emergency contact exists, yet the paper roster prints both.
- **Why it matters:**
  - A 16-year-old calling about a missing kid needs to know whether "Grandpa Tran" or "Linh Tran (parent)" will answer before the phone rings.
  - Nine identical icon buttons are also the loudest repeated element on the roster, and they carry no information.
- **Fix:**
  - Replace the icon column with a text `tel:` link on the camper's second line: "Call Grandpa Tran (emergency) · 720-555-0137". Add the parent line where the data is loaded; it already is for print via `useSectionRoster`.
  - On roll call, absent rows show the same link full-width under the name.
  - No new data and no new capability.
- **Command:** `/impeccable clarify`.

### [P2] 4. Pre-camp Today is a long, four-equal-section dashboard
- **What:** At 390px the pre-camp Today is 1430px tall (`volunteer-volunteer.m.png`):
  - two identical class rows (Week 1 and Week 2 of the same PY-B, same room, same times);
  - a "Rosters" link that duplicates the Classes tab;
  - the duties list;
  - a fully expanded 8-row schedule;
  - an update card.
- **Why it matters:** It breaks "no long scrolling pages". The headline sentence already answers the real question (when and where to show up), and the rest dilutes it.
- **Fix:**
  - Merge the class rows into one: "Intro to Python, PY-B · Room 102 · 9–3 · Lead · Weeks 1 and 2". Make it a link to Class and cut "Rosters".
  - Fold the schedule with the same `<details>` used on camp days: "Day starts 8:30 at the front lobby · Full day ▾".
  - Show the latest update as one line linking to Updates.
  - Target: about 1.2 screens.
- **Command:** `/impeccable distill`.

### [P2] 5. Selection and status vocabulary is inconsistent across four screens
- **What:**
  - Selected state is drawn four ways:
    - gold underline on tabs (`VolunteerLayout.tsx:124`);
    - ink-filled segmented week toggle (`VolunteerClasses.tsx:47`, `VolunteerDuties.tsx:107`);
    - gold-filled day tile (`VolunteerDuties.tsx:122`);
    - white pill on ink for roll-call tabs (`RollCallPanel.tsx:89`).
  - Pills: sky "Lead" (`parts.tsx:116`), grey "Full", green "You're on", red "Medical".
  - Heights: 36px InlineConfirm buttons, 40px composer, slot-picker and roll-call controls, 44px elsewhere.
  - Desktop tabs carry icons; phone tabs don't.
  - The "Week / 1" stack (`parts.tsx:106-111`) is visually identical to the "Mon / 19" date stack (`VolunteerDuties.tsx:19-22`).
- **Why it matters:**
  - Gold is meant to mark primary actions; a gold day tile beside a gold "Sign up" button blurs that.
  - Learners can't build one rule for "this is selected".
  - 36–40px targets fail the 44px standard.
- **Fix:**
  - One segmented-control component, used for the week toggle and the roll-call tabs.
  - Day tiles: ink outline and ink fill when selected; gold stays for actions only.
  - Use pills only for states that need colour: "You're on" and Absent. "Lead" and "Full" become plain muted text.
  - Every control at 44px.
  - Drop the icons from the desktop tabs.
  - Replace the week stack with text: "Week 1 · Oct 19–23".
- **Command:** `/impeccable polish`.

### [P2] 6. Roll-call writes lock the whole list, and errors land off-screen
- **What:**
  - `busy` disables every row button while one write and its re-fetch complete (`RollCallPanel.tsx:37-45, 132`). On school wifi, each absent tap greys all rows to 50% for 1–2 seconds.
  - Errors render as a banner above the list (`RollCallPanel.tsx:112-117`), usually scrolled out of view, and don't name the camper.
- **Why it matters:** The "under 30 seconds" promise depends on rapid taps. A silent rollback (the optimistic mark reverts on error) on a row you can't see is a real chance of a wrong attendance record, and attendance feeds the admin "unaccounted" board.
- **Fix:**
  - Pending state per row: a spinner inside that toggle only, with the other rows staying live.
  - Put the error in the sticky bar's existing live region and on the row itself: "Couldn't save Kai Lopez. Tap to try again."
  - Replace the muted "Refresh" text link (`RollCallPanel.tsx:139-144`) with a status line: "Updated 9:06 · Refresh". The lead and the support may both be marking, and there is no live sync.
- **Command:** `/impeccable harden`.

### [P2] 7. The applicant waiting room has dead ends and a wall-of-slots picker
- **What:**
  - No contact address anywhere on the applicant or rejected states.
  - No time frame for the decision.
  - "online" with no join information.
  - "Change time" shows 17 slot buttons, 40px each, without marking the current slot.
  - "Keep my time" and "Move my interview" stack right-aligned on separate lines.
- **Why it matters:** PRODUCT principle 1, "No dead ends". The applicant is often 14–17 and nervous; the waiting room is the first impression of the volunteer side.
- **Fix:**
  - Add a final line, "Questions? denver@steelcitycodes.org" (a mailto link), on both states.
  - In the picker, show the current slot as selected and labelled "Your time".
  - Lay out one row per day with times inline, at 44px.
  - Put a full-width confirm bar at the bottom, "Move to Thu, Oct 22, 4:30 PM", with "Keep Tue 4:00" as a text button.
  - Cut "Here's where everything stands."
  - Ask the director what joining "online" means before writing copy for it.
- **Command:** `/impeccable onboard`, then `/impeccable clarify`.

### [P2] 8. Duties say what but not what it involves; the dot is unexplained
- **What:**
  - Slot rows show only the duty name (`VolunteerDuties.tsx:141`).
  - `duty_types.description` exists (`useDutyRoles.ts:4-9`), but the slot query and UI never show it.
  - The "you have a duty here" dot (`VolunteerDuties.tsx:123`) is explained only in the aria-label.
- **Why it matters:** A new 15-year-old can't judge "Break Supervision" against "Afternoon Dismissal".
- **Fix:**
  - Show the description as the row's second line, above the seats line.
  - Replace the dot with the tile's third line reading "You're on" instead of "1 open".
- **Command:** `/impeccable clarify`.

### [P2] 9. Josefin Sans at 12–13.5px carries data the volunteer must glance at
- **What:** Small Josefin text is used for:
  - audience labels at 12px (`UpdatesFeed.tsx:68`);
  - the "Week" caption at 12.5px;
  - roster initials at 13px;
  - schedule times at 13.5px (`parts.tsx:56`);
  - day-tile "1 open" at 12px;
  - picker day labels at 12px.

  `tabular-nums` is applied to Josefin, which has to be verified to ship a `tnum` feature.
- **Why it matters:** Glanceability on a low-DPI, cracked Android at arm's length. PRODUCT.md marks Josefin-for-UI as *inferred*, not a brand requirement.
- **Fix:**
  - Floor UI text at 14px and row data at 15–16px.
  - Keep Josefin for headings and the brand voice.
  - Set times, counts and names in a workhorse sans with real tabular figures, or verify Josefin's figures at those sizes.
  - Decide it once for all three roles.
- **Command:** `/impeccable typeset`.

### [P2] 10. Profile repeats the menu and gives settings the wrong home
- **What:**
  - The theme toggle occupies a permanent slot in the top bar (`VolunteerLayout.tsx:83-86`), against "settings under the avatar".
  - "Sign out" appears on the profile page (`VolunteerProfile.tsx:49`) and in the menu.
  - The 56px double-ringed avatar (`VolunteerProfile.tsx:33-35`) repeats the menu header.
  - "Back" is hard-wired to Today.
  - "Admins assign classes" is said twice (`VolunteerSelfService.tsx:60, 250`).
  - On Profile, no tab is active, so the tab strip suggests you are nowhere.
- **Fix:**
  - Move Dark mode into the avatar menu as a switch row.
  - Cut Sign out, the avatar and the "Back" link from Profile.
  - Merge the two "admins assign" sentences.
- **Command:** `/impeccable distill`.

### [P3] 11. Updates carry per-item decoration and undersized controls
- **What:**
  - A megaphone circle on every update (`UpdatesFeed.tsx:64-66`).
  - The visible H1 "Updates" repeats the active tab.
  - The composer label "Message to Intro to Python PY-B, Week 1 families" repeats the "Which class?" select directly above it.
  - An always-on "0/2000" counter.
  - The Post and Cancel buttons are 40px, the "Also email" checkbox is 16px, and copy/delete are icon-only at about 31px (`UpdatesFeed.tsx:79-89`).
- **Fix:**
  - Cut the megaphone circle.
  - Make the H1 visually hidden.
  - Merge the label into the select ("To: families in…").
  - Show the counter only past 1,800 characters.
  - Make all controls 44px.
  - Give delete a text label on your own posts.
- **Command:** `/impeccable distill`, then `/impeccable polish`.

### [P3] 12. Print roster details
- **What:**
  - There is no `@page { size: landscape }`, so 10 columns on portrait Letter get cramped.
  - The header row prints a cream fill.
  - "← Back" uses a Unicode glyph (`PrintRoster.tsx:92`).
  - "Age" takes a column next to the name while the health column sits fourth.
  - On a phone, the toolbar wraps to two rows and the table scrolls sideways (`vol-print-roster.m.png`). That is acceptable for a page whose job is paper.
- **Fix:**
  - Landscape page size.
  - White header in print.
  - Lucide icon for Back.
  - Column order: #, Camper, Allergies / medical, Emergency contact, Parent, three roll-call boxes, Notes. Fold Age into the camper cell.
  - Group "Copy / Email parent emails" under one label.
- **Command:** `/impeccable polish`.

### [P3] 13. Browser surfaces and the schedule "now" stripe
- **What:**
  - Focus rings are the browser default `outline: auto 1px` in currentColor (measured on Duties): 1px ink on the gold tile, cream on the ink segment.
  - The schedule's current row is marked with a 3px inset left stripe (`parts.tsx:55`), which reads as a decorative side stripe.
- **Fix:**
  - A themed 2px `--ring` focus-visible on every control.
  - Mark "now" with weight plus a "Now" word in the time column instead of the stripe.
- **Command:** `/impeccable polish`.

## 7. Persona red flags

**Casey (distracted mobile, one-handed):**
- On load at 9:05, Casey sees 1.5 campers; the rest of the screen is the dateline and the sticky slab.
- Every tap greys the whole list on a slow connection, so the next tap waits.
- The "Medical" chips are 24px tall, and the three roll-call tabs and every InlineConfirm button are 36–40px.
- "Mark all present" sits at the very top of the screen. On a tall phone that is the hardest reach, and the director's top-tabs decision makes the action the only thing up there.
- The applicant picker needs long scrolling to reach "Move my interview", with no sticky confirm.
- The "Refresh" link is 14px muted text at the bottom of a long list.
- Errors appear where Casey isn't looking.

**Sam (screen reader / keyboard):**
- Focus rings are default 1px `auto` outlines, nearly invisible on the gold day tile and the gold "Sign up" button.
- The count's `aria-label` sits on a `<p>` (`RollCallPanel.tsx:70`), which many screen readers ignore, so the big "0 / of 9 present" is read as two fragments.
- Roll-call tabs use `role="tab"` without a tabpanel or arrow-key handling.
- Health notes are a disclosure button, so Sam must expand each one to hear it. An always-visible line would be read inline.
- The phone button's label does carry the contact name and number, so Sam actually gets *more* call information than sighted users.
- Present and Absent are icon plus word, not colour alone: good.
- The day-tile dot is aria-labelled: good.

**Project persona, "Maya", 16, support volunteer, 9:00 roll call in a room of 12 kids, one hand, cracked Android (360×640, Chrome bars visible):**
- **She opens the app at 8:58.** The dateline and the 205px slab leave 1.5 rows visible. She has to scroll before she sees a single kid, and the sticky slab then holds 45% of the glass for the rest of roll call.
- **"Mark" doesn't say what it does.** She hesitates on the first row: does Mark mean absent? The aria-label says "tap to mark present"; the screen doesn't.
- **Andre is diabetic, and the room doesn't show it.** To learn that, Maya must hit a 24px red chip through a crack in the glass. The note opens as a narrow pink column that pushes the row tall. Twelve kids means remembering, or tapping, every chip before lunch.
- **Kai is absent, and the call button is a bare phone icon.** Is she about to call his dad, his aunt or the camp? She doesn't know until someone answers.
- **The lead marked two kids on the other side of the room a minute ago.** Maya's screen doesn't show it until she finds the "Refresh" text link at the bottom. Nothing says who marked what or when.
- **The wifi is slow.** Each tap greys all 12 rows. She taps a second kid during the grey-out and nothing happens: the button was disabled, the tap was dropped silently, and she believes she marked him.
- **She finishes.** The only acknowledgement is small muted text, "Taken at 9:05. 12 present.", and a ✓ on the tab. Nothing at thumb height tells her she's done.

## 8. Element-justification inventory

### Shell: `src/components/VolunteerLayout.tsx`
| Element | Verdict | Note |
|---|---|---|
| Ink bar with wordmark (67-68) | **Keep** | Brand and identity; the wordmark sits on ink as the brand requires. |
| Desktop tab icons (76) | **Cut** | Labels carry the meaning; the phone has none; icons add noise and inconsistency. |
| Desktop tab pill background (74-75) | **Change** | Use the phone's gold underline on desktop too: one selected-state rule. |
| Theme toggle in top bar (83-86) | **Change** | Move into the avatar menu ("settings under the avatar"). |
| Avatar initials with gold ring (91-93) | **Keep** | It is the account menu's affordance. The gold ring is a brand touch, cheap and consistent. |
| Avatar chevron, desktop only (94) | **Cut** | The avatar is already understood as a menu; it is the only chevron in the bar. |
| Menu header (name + email) (99-102) | **Keep** | Confirms which account you're in; matters on shared family devices. |
| "My profile and availability" item (104-108) | **Keep** | Only door to Profile. |
| "Sign out" item (109-112) | **Keep** | Single home for sign-out (cut the duplicate on Profile). |
| Phone sticky tab strip (120-128) | **Keep** | The navigation; top placement is a director decision. Rename "Classes" to "Class" (most volunteers have one section per week). |
| Gold active underline (124) | **Keep** | The clearest selected state in the portal; make it the rule everywhere. |
| Loading skeleton (133-137) | **Keep** | |
| Load error with "Try again" (139-146) | **Keep** | Specific recovery. |

### Today, camp day: `VolunteerToday.tsx`, `RollCallPanel.tsx`, `RollCallRow.tsx`, `parts.tsx`
| Element | Verdict | Note |
|---|---|---|
| Dateline "Monday, October 19" (`parts.tsx:24`) | **Merge** | Into the single context line with day number, class and room. |
| H1 "Day 1 of Week 1" (`VolunteerToday.tsx:35`) | **Change** | Demote into the dateline. The roll call is the page's subject. |
| Lead sentence "You're leading … also Morning Check-In" (36-37) | **Change** | Compress to "PY-B · Room 102 · you lead · also Morning Check-In" on one line. |
| Sticky ink slab (`RollCallPanel.tsx:61`) | **Change** | Keep the ink (signature), shrink it to one ~56px row. |
| H2 "Arrival roll call" (64-66) | **Merge** | Duplicates the selected tab; keep it as visually hidden heading text. |
| Hint "Mark everyone, then tap…" (67) | **Change** | Show it only before the first mark, under the Mark-all button. Its "N still to mark" job moves to the count. |
| Big gold count "0 / of 9 present" (70-73) | **Change** | Keep the count and make it inline ("0/9 present") in the sticky row. A 44px gold zero is alarm without information. |
| Roll-call tabs with ✓ (77-99) | **Keep / Change** | Essential: switching between roll calls and seeing which are done. Raise to 44px and use the shared segmented style. |
| "Mark all N present" gold button (101-109) | **Keep / Change** | The accelerator. Move it out of the sticky region into the list head. |
| Error banner (112-117) | **Change** | Move into the sticky row's live region; name the camper. |
| Initials avatar per row (`RollCallRow.tsx:33-37`) | **Cut** | No photo, and initials don't help identify a child. Its colour change duplicates the toggle's state. |
| Camper name (40) | **Keep** | Bump to 17px. |
| Age "13" (41) | **Cut** | Irrelevant to roll call; the section's age band is on Class. |
| "Medical" chip (42, `MedicalFlag.tsx:13-22`) | **Change** | Always-visible note line in danger ink (see P1-1). |
| Health note "Confidential…" footnote (`MedicalFlag.tsx:26`) | **Cut** | The reader is staff; repeated per note. |
| Absent-row tint (`RollCallRow.tsx:30-31`) | **Keep** | The absent row should stand out for the call. |
| Call icon on absent rows (45-53) | **Change** | Text `tel:` link naming the contact and relationship. |
| Toggle "Mark / ✓ Present / ✕ Absent" (55-64) | **Keep / Change** | The core control. Rename unmarked to "Mark present"; make pending per-row. |
| "Refresh" link (`RollCallPanel.tsx:139-144`) | **Change** | "Updated 9:06 · Refresh" status line under the sticky row. |
| "Right now … Full day ▾" schedule fold (`parts.tsx:69-85`) | **Keep** | Right disclosure on a camp day. |
| Inset 3px "now" stripe (`parts.tsx:55`) | **Change** | Weight plus the word "Now" instead of a side stripe. |
| "Latest from the camp" card (`parts.tsx:89-97`) | **Change** | One line (author · time · first sentence) linking to Updates; drop the card and megaphone. |

### Today, pre-camp and "accepted, unassigned"
| Element | Verdict | Note |
|---|---|---|
| H1 "Week 1 starts Monday" plus sentence (`VolunteerToday.tsx:59-63`) | **Keep** | Best copy in the portal. |
| "Your classes" header with "Rosters" link (66) | **Cut** (link) | Duplicates the Class tab; make the class row itself the link. |
| Two class rows, identical except week (`parts.tsx:101-122`) | **Merge** | One row: "Weeks 1 and 2" when section, room and times match. |
| "Week / 1" stack (106-111) | **Change** | Text "Week 1 · Oct 19–23". It currently mimics the duty date block. |
| "Lead" sky pill (116-118) | **Change** | Plain muted "Lead". The only sky-blue on the page, decorative. |
| "Your duties" with "Find more" (70-74) | **Keep** | Next action. |
| Duty date block "Mon / 19" (`VolunteerDuties.tsx:19-22`) | **Keep** | A real date; the stack is apt here. |
| Expanded 8-row schedule (`parts.tsx:68`) | **Change** | Fold like the camp day; first item plus "Full day ▾". |
| "Latest from the camp" (79) | **Change** | One line, as above. |
| "What we'll assign you from" bordered dl (112-116) | **Change** | Drop the card border; a plain dl on the page. |
| PartyPopper icon on "Duties are open" (121) | **Cut** | Decoration; the sentence carries it. |

### Class: `VolunteerClasses.tsx`
| Element | Verdict | Note |
|---|---|---|
| Week segmented toggle (41-53) | **Keep / Change** | Real choice; use the shared segmented style. On desktop, cap its width (it stretches to 1016px). |
| Empty-state icon tile (21) | **Cut** | Decorative circle; the H1 and sentence suffice. |
| H1 "Intro to Python, PY-B" (63) | **Keep** | |
| Sentence "You lead this class. Room 102, Mon–Fri… Ages 11 to 13." (64) | **Change** | Meta line: "You lead · Room 102 · Mon–Fri 9–3 · ages 11–13". |
| "Paper roster" button (67) | **Keep** | |
| "Post to families" button (68-70) | **Merge** | The Updates tab already has this action. Keep one door, or demote it to a text link. |
| "Roll calls open Monday, October 19." (72-76) | **Keep** | Status with a next step; on camp days it links to Today. |
| "9 campers" heading (78) | **Keep** | |
| "2 with health notes" (79) | **Change** | Name them: "Health notes: Andre Tran, Kai Lopez". |
| Initials avatar per row (91) | **Cut** | No job. |
| Age (94) | **Change** | "age 13", or cut it (the age band is in the meta line). |
| "Medical" chip (95) | **Change** | Always-visible note line (P1-1). |
| Phone icon per row (97-102) | **Change** | Text `tel:` link with contact name and relationship (P1-3). |
| List card surface (84) | **Keep** | A tappable list earns a surface. |

### Duties: `VolunteerDuties.tsx`
| Element | Verdict | Note |
|---|---|---|
| H1 "You're on 1 duty" / "No duties yet" (76) | **Keep** | Status as the headline. |
| My-duty rows with Cancel (78-91) | **Keep** | The Cancel then inline confirm flow is right. |
| InlineConfirm (`InlineConfirm.tsx`, h-9 buttons) | **Change** | 44px buttons; the copy is excellent. |
| "Can't make a day? Tell the camp" (95-97) | **Keep** | |
| "Find a duty" heading (101) | **Keep** | |
| Week toggle (102-112) | **Keep / Change** | Shared segmented style. |
| Day tiles, three lines each (113-130) | **Keep / Change** | Selected fill ink, not gold. |
| Dot on day tile (123) | **Change** | Replace with "You're on" as the tile's third line. |
| "Monday, October 19" label (132) | **Keep** | Confirms which day you're looking at. |
| Duty name (141) | **Keep** | Add the description line (existing data). |
| Seats line "2 of 2 seats taken" (142) | **Change** | Redundant with "Full"; show it only when open ("1 of 2 open"). |
| "Full" grey pill (147) | **Change** | Plain muted text, no pill. |
| "You're on" green pill (145) | **Keep** | State that earns colour. |
| "Sign up" gold button (149-152) | **Keep** | The primary action. |

### Updates: `VolunteerUpdates.tsx`, `UpdatesFeed.tsx`, `UpdateComposer.tsx`
| Element | Verdict | Note |
|---|---|---|
| H1 "Updates" (`VolunteerUpdates.tsx:27`) | **Change** | Visually hidden; the active tab says it. |
| Gold full-width "Post to your class's families" (46-48) | **Change** | Secondary outline. Reading is the page's main job; posting is occasional. |
| Composer gold border (29) | **Change** | Neutral border; gold is for actions. |
| "Which class?" select (30-37) | **Merge** | With the textarea label, into "To: families in [select]". |
| Textarea label "Message to … families" (`UpdateComposer.tsx:112-115`) | **Merge** | See above. |
| "0/2000" counter (126) | **Change** | Show only past 1,800. |
| "Also email (opens your mail app)" (129-133) | **Keep / Change** | Real choice; make the checkbox row 44px. |
| Cancel / Post (136-143) | **Change** | 44px. |
| Megaphone circle per update (`UpdatesFeed.tsx:64-66`) | **Cut** | Every item is an update; no job. |
| Meta line author · audience · time (68-72) | **Keep / Change** | Raise from 12px to 14px; drop the `Users` icon. |
| Copy-emails / delete icon buttons (76-91) | **Change** | 44px, delete with a text label. |
| Feed card surface (`VolunteerUpdates.tsx:50`) | **Cut** | Not a tap list; the dividers carry it. |

### Profile: `VolunteerProfile.tsx`, `VolunteerSelfService.tsx`
| Element | Verdict | Note |
|---|---|---|
| "Back" link (`VolunteerProfile.tsx:29-31`) | **Cut** | Tabs are present; it also always goes to Today. |
| Double-ring avatar (33-35) | **Cut** | Repeats the menu header; pure decoration. |
| Name + email (36-39) | **Keep** | Identity. |
| "Availability and courses" + Edit (`VolunteerSelfService.tsx:51-58`) | **Keep** | |
| Hint "Admins use these… Your class is set by an admin." (60) | **Merge** | With the switch hint; say it once. |
| Bordered dl card (63-67) | **Change** | Plain dl; the card adds a border, not information. |
| "Availability saved" status (68) | **Keep** | |
| "Switch classes" + hint + "Ask to switch" (232-252) | **Keep / Change** | One sentence: "You're in PY-B for Weeks 1 and 2. Ask an admin to switch." |
| "Days you can't make it" + hint + list + "Add a day" (158-208) | **Keep** | Inline form, 16px inputs, clear validation. |
| "Sign out" button (`VolunteerProfile.tsx:49`) | **Cut** | Lives in the avatar menu. |

### Applicant: `VolunteerApplicant.tsx`, `InterviewSlotPicker.tsx`
| Element | Verdict | Note |
|---|---|---|
| H1 "Your application" (22) | **Keep** | |
| "Here's where everything stands." (22) | **Cut** | Restates the H1 and the stepper. |
| Numbered stepper with rail (35-53) | **Keep** | A real sequence; numbers carry order. |
| Green ✓ and green rail for done (38-43) | **Keep** | |
| Interview time at 24px (79) | **Keep** | The most important fact on the page. |
| "15 minutes, online." (80) | **Change** | Add how to join only once the director confirms it. |
| "Change time" (86) | **Keep** | |
| Slot picker wall (`InterviewSlotPicker.tsx:33-60`) | **Change** | Current slot shown selected; one row per day; 44px. |
| "15 min" on every slot (54) | **Cut** | Said once above ("15 minutes"); repeated 17 times. |
| Keep / Move buttons (93-100) | **Change** | Full-width confirm naming the new time; Keep as a text button. |
| Step 3 / Step 4 copy (28-29) | **Keep** | Add a contact line under the list. |
| Rejected state (11-18) | **Change** | Add the contact line; otherwise kind and right. |

### Print roster: `PrintRoster.tsx`
| Element | Verdict | Note |
|---|---|---|
| Screen toolbar (91-97) | **Keep / Change** | Lucide icon for Back; group the two email actions under one label. |
| "Steel City Codes // Denver" text line (116) | **Keep** | Identifies the sheet; text, not the PNG, is right for print. |
| "Date: ____" (117) | **Keep** | One sheet per day. |
| Meta: schedule, lead, "Printed …" (122-124) | **Keep** | |
| Card inside page on screen (113) | **Keep** | Previews the paper. |
| Table header fill (130) | **Change** | White in print. |
| Column order (131) | **Change** | Health next to the name; fold Age into the camper cell. |
| Bold allergies cell (147) | **Keep** | Safety first; the screen should match this. |
| Roll-call boxes (156-158) | **Keep** | |
| "Confidential… Shred after the camp week." (167) | **Keep** | Correct once, on paper. |
| Missing `@page size` (79) | **Change** | Landscape. |

## 9. Redesign direction for the mockup

Principles carried through every screen:
- The signature is the ink roll-call slab and the gold count. Everything else gets quieter so it can lead.
- Safety data is always visible.
- One selected-state rule: gold underline for top tabs, an ink segment for in-page toggles, gold only for primary actions.
- One list surface for tap lists, and no decorative avatars or icon circles.
- 44px controls, 16px inputs.
- Josefin for headings; body and data at 15–17px.
- No new features, no modals, top tabs, settings under the avatar, wordmark on ink.

### Shell
- **375px:**
  - Ink bar 56px: wordmark left, avatar right (theme toggle removed).
  - Sticky ink tab strip 48px: Today · Class · Duties · Updates, with a gold underline.
  - Avatar menu: name + email, "My profile and availability", "Dark mode" switch row, "Sign out".
- **Desktop:** the same ink bar with the tabs inline after the wordmark, text only, and a gold underline for the active tab. Content max 1080px.
- **Removed:** the top-bar theme button, desktop tab icons and the avatar chevron.

### Today: camp day (the signature screen)
- **375px hierarchy:**
  1. Context line, 15px muted, one line, wrapping to two at most: "Mon, Oct 19 · Day 1 of 5 · PY-B, Room 102 · you lead". A second muted line appears only if needed: "Also on Morning Check-In".
  2. **Sticky ink row, about 56px:** a segmented control [✓ Arrival][After lunch][Dismissal], 44px tall, on the left. A gold "0/9" at 22px bold on the right. Visually hidden H2 "Arrival roll call".
  3. In flow, above the list: gold full-width "Mark all 9 present", 48px. Under it once, 14px muted: "Then tap whoever is missing." Both vanish after the first mark.
  4. Camper list on one white surface. Each row: name at 17px semibold; under it, *only if present in the data*, a danger-ink health line at 15px with a heart icon, "Allergy: peanuts · Type 1 diabetes, checks levels at lunch". Right side: a 44px toggle, "Mark present" / "✓ Present" / "✕ Absent". Absent rows tint and add a full-width line: "Call Grandpa Tran (emergency) · 720-555-0137".
  5. Status line: "Updated 9:06 · Refresh".
  6. "Right now: Morning session, classrooms · Full day ▾" (fold kept).
  7. One-line latest update: "Jordan Rivera, 7:30 PM: Crew huddle at 8:15 each morning… All updates →".
- **Completion state:** when every camper is marked, the sticky row's count turns to "✓ 9/9 · 9:05" on a success tint, and the hint area reads "Arrival roll call done." Same data, a calmer end.
- **Desktop:** two columns, roll call at 1.3fr on the left with the sticky row pinned within the column. Right column: the schedule open, as a timetable with a bold "Now" row, then the one-line update.
- **Removed:**
  - the H1 "Day 1 of Week 1" (folded into the context line);
  - the hint line in the sticky header and the 44px count block;
  - initials avatars, ages, the "Medical" chip and the "Confidential" footnote;
  - the bare phone icon and the update card with megaphone.

### Today: before camp / accepted, unassigned
- **375px:**
  - H1 "Week 1 starts Monday" plus the existing sentence.
  - "Your class": one row linking to Class, "Intro to Python, PY-B — Room 102 · 9–3 · Weeks 1 and 2 · Lead (muted)".
  - "Your duties": date-stack rows plus "Find more".
  - "Daily schedule": folded, "Starts 8:30, drop-off at the front lobby · Full day ▾".
  - One-line latest update.
  - Fits about 1.2 screens.
- **Unassigned variant:**
  - H1 "You're on the crew" and the sentence.
  - A plain dl (no card) with "Change" linking to Profile.
  - "Duties are open" with "Browse" and no party popper.
- **Desktop:** the left column holds class and duties; the right column holds the folded schedule (open on desktop) and the update.

### Class
- **375px:**
  - Week segmented control (shared style), only when there are two or more weeks.
  - H1 "Intro to Python, PY-B".
  - Meta line: "You lead · Room 102 · Mon–Fri 9–3 · ages 11–13".
  - Secondary button "Paper roster".
  - Status: "Roll calls open Mon, Oct 19". On camp days: "Take today's roll call on Today →".
  - Roster heading "9 campers", with "Health notes: Andre Tran, Kai Lopez" under it in danger ink.
  - Rows: name at 17px; health line if any; call line "Call Grandpa Tran (emergency) · 720-555-0137" as a `tel:` link, plus "Linh Tran (parent) · 303-555-0137" where the data is loaded.
  - No avatars, no icon column.
- **Desktop:** meta on the left at 1fr. On the right at 1.3fr, the roster as a light table: Camper | Health | Call (contact name, relationship, number).
- **Removed:** the "Post to families" duplicate (it lives on Updates), initials, the icon-only phone column and the "Medical" chips.

### Duties
- **375px:**
  - H1 "You're on 1 duty".
  - Your rows with Cancel and an inline confirm with 44px buttons.
  - "Can't make a day? Tell the camp".
  - "Find a duty": week segmented control; five day tiles with an ink outline and ink fill when selected; the third line reads "2 open", "Full" or "You're on".
  - A day label, then slot rows: name; description at 15px muted; "1 of 2 open" only when open. Right side: gold "Sign up", muted "Full" text, or a green "✓ You're on" pill.
- **Desktop:** the current two columns, with the same changes.
- **Removed:** the dot, the grey "Full" pill and "2 of 2 seats taken" on full slots.

### Updates
- **375px:**
  - Visually hidden H1.
  - For leads: a secondary full-width button, "Post to your class's families".
  - Inline composer: "To: [families in PY-B, Week 1 ▾]" (one control); textarea at 16px; "Also email (opens your mail app)" as a 44px row; full-width "Post update" with Cancel as a text button.
  - The feed sits directly on the page: meta at 14px (author · audience · time), body at 16px, and for your own posts "Delete" as a text button at 44px.
- **Desktop:** the same at max 760px.
- **Removed:** megaphone circles, the always-on counter, the duplicate label and the gold composer border.

### Profile (avatar → My profile)
- **375px:**
  - H1 name, email muted.
  - "Availability and courses" with Edit: plain dl, and the inline form on edit.
  - "Switch classes": one sentence plus "Ask to switch".
  - "Days you can't make it": list plus "Add a day".
- **Desktop:** two columns.
- **Removed:** Back, the big avatar, Sign out and the duplicate "admins assign" sentence.

### Applicant waiting room
- **375px:**
  - H1 "Your application".
  - Stepper:
    - ✓ Application received, Fri Oct 16.
    - ② Interview: "Tue, Oct 20, 4:00 PM" at 24px, "15 minutes, online", "Change time".
    - ③ Decision.
    - ④ Your class.
  - Footer line: "Questions? denver@steelcitycodes.org".
- **Change time open:** day rows ("Mon Oct 19 — [4:00 PM] [4:30 PM]") with 44px chips. The current slot is pre-selected with "Your time" under it. A full-width primary button names the new time ("Move to Thu Oct 22, 4:30 PM"), with "Keep my time" as a text button beside it.
- **Rejected:** the existing copy plus the contact line.
- **Desktop:** same, max 640px.
- **Removed:** the sub-heading sentence and the "15 min" on every chip.

### Print roster
- **Screen:**
  - Toolbar: Back (icon), Print (gold), and "Parent emails: Copy · Email".
  - A paper preview below.
- **Paper:**
  - Landscape.
  - Header: org line + "Date: ____", class · section · week, schedule · room, lead, printed date.
  - Columns: # | Camper (age) | Allergies / medical (bold) | Emergency contact | Parent | Arrival | After lunch | Dismissal | Notes.
  - White header, black hairlines, confidentiality line once.

### Copy changes (complete list)
| Where | Now | Change to |
|---|---|---|
| Unmarked toggle | "Mark" | "Mark present" |
| Health chip | "Medical" (always) | The note itself, prefixed "Allergy:" / "Medical:" |
| Call button | (icon only) | "Call Grandpa Tran (emergency) · 720-555-0137" |
| Roll-call header | "Arrival roll call" + "Mark everyone, then tap whoever is missing." + "0 of 9 present" | Tabs + "0/9"; the hint once under Mark-all: "Then tap whoever is missing." |
| Roll-call done | "Taken at 9:05. 9 present." | "Arrival roll call done · 9 of 9 · 9:05" |
| Refresh | "Refresh" | "Updated 9:06 · Refresh" |
| Roster count | "2 with health notes" | "Health notes: Andre Tran, Kai Lopez" |
| Tab | "Classes" | "Class" |
| Today pre-camp link | "Rosters" | (cut; the row is the link) |
| Duty tile | dot | "You're on" |
| Full slot | "2 of 2 seats taken" + "Full" pill | "Full" |
| Applicant | "Here's where everything stands." | (cut) + "Questions? denver@steelcitycodes.org" |
| Slot confirm | "Move my interview" | "Move to Thu, Oct 22, 4:30 PM" |
| Profile switch | two sentences on who assigns | "You're in PY-B for Weeks 1 and 2. Ask an admin to switch." |
| Composer | "Which class?" + "Message to Intro to Python PY-B, Week 1 families" | "To: families in [PY-B, Week 1 ▾]" |

## 10. Minor observations and questions to consider

**Minor observations**

- **The roll-call tab switches to After lunch at 11:30** (`campDay.ts:12`). Lunch in the demo schedule is 12:00–12:45. A volunteer opening the app at 11:45 to finish a late arrival roll call lands on After lunch, before lunch has happened. Tie the switch to the schedule's lunch end, or at least to 12:45. That is a constant change, not a feature.
- **Two schedule components.** `ScheduleBlock` (`parts.tsx:44`) and `DailySchedule` (parent side) render the same data with different sizes (13.5/15px vs 12/14px) and column widths. Merge them.
- **`DailySchedule.tsx:28-34`'s `ScheduleHeading`** is an uppercase, wide-tracked eyebrow with a clock icon. That is parent-side, but note it for the parent reviewer.
- **The "Latest from the camp" demo update** says "take them on your phone from the dashboard". The UI calls it "Today", not "dashboard". Content, but it teaches the wrong word.
- **Raw database errors** surface verbatim in duty claim, absence add/remove and switch request (`VolunteerSelfService.tsx:142, 151, 226`). A teen should never see a Postgres constraint message.
- **Profile `#days-off` scroll.** In the full-page capture the sticky tab strip lands over the content (`vol-profile-edit.m.png`). Verify at a real viewport, since `scroll-mt-16` may be short of the 48px strip plus margin.
- **Duplicate first names.** Two "Priya"s and two "Lopez"es in one section is normal; full names keep them distinct. Keep surnames visible at 360px (no truncation is set on the name, so it wraps, which is fine).
- **Day-tile layout** uses `repeat(max(days,5))`. A 4-day week leaves an empty fifth column. Minor.
- **No `::selection` or caret theming**, and the focus rings are browser default (craft-floor "browser surfaces").
- **Dark mode** holds up. Check the "Medical" chip (`danger-soft` on the dark surface) for 4.5:1 once it becomes body text.

**Questions to consider**

- **What if the roll call *were* the Today tab** on camp days, with nothing above it but a one-line context, and schedule and update below the list? Is "Day 1 of Week 1" worth 170px at 9:00 AM?
- **Should a health note ever be hidden from the person standing next to the child?** If confidentiality is the worry, the answer is who can open the app, not a tap per child.
- **Does the volunteer need a call button on all 12 rows of the roster,** or only a visible contact line, with the tap reserved for absent kids on roll call?
- **Should a 16-year-old support volunteer have "Email all parents" and "Copy all parent emails"** on the print page? That moves every family's address into a teen's personal mail app. It's a policy question for the director, not a design one, but the design currently answers it by default.
- **How does an applicant join the "online" interview?** If the answer is "we email a link", say so on the page. If it's unknown, that is the biggest anxiety on the applicant side.
- **If Josefin is not mandatory for UI text,** would a workhorse sans for data (names, times, counts) with Josefin kept for headings make the camp-day screens measurably faster to read? Decide once for all three roles.
- **What would a confident completion moment look like** for the first roll call of the summer, using only the existing state (✓ on the tab, the count, the time)?
