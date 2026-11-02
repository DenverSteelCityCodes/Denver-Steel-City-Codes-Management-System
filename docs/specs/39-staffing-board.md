# 39: Staffing board (ratios, teachers per course, week roles)

**Status:** ⬜ not started · **Issue:** — · **Priority:** P1 · **Effort:** M · **Phase:** B
**Depends on:** 13 ✅ (season settings), 14 ✅ (attention items), 25 ✅ (availability, absences, cover suggestions), 35 🟨 (the crewing guard), 33 ⬜ (dated cover, for floaters covering a section) · **Unblocks:** B2 (week-role hours), the spec 14 minimum-crew follow-up
**Plan reference:** [Discord findings](../research/discord-findings.md) M09, M53; decision Q-D3 (open)

## Why
- **Staffing is spreadsheet math every spring (101 conversations, 2021–2026).** Leads computed ratios in chat: about 1:6 in 2021, 2–3 teachers a class in 2022, no class worse than 1:7 in 2024, about 45 volunteers a week for 1:4 in 2026. Building assignments took about 3 hours a week in 2026.
- **What they found by eye:** sections with one teacher, one week overstaffed while the other was short, accepted volunteers left unassigned, an interview no-show assigned, two sections booked into one room, and a course short of teachers (19+ intro Python teachers needed while volunteers ranked Java first). In 2023 registration closed because volunteers lagged.
- **Non-teaching roles are invisible (M53, 10 conversations).** Some volunteers and leads staff the admin room, float between rooms or run check-in for a whole week. They were tracked by colour in a sheet, admins were pulled into classrooms when teachers dropped, and B2's formula counts only section crew, so they would get no hours.
- **What the app already has:** seats, capacity and waitlist per section, the crew on each, and a crew picker that groups available, unassigned people by week (`src/hooks/useAdminClasses.ts:77`, `src/lib/sectionCrew.ts:74`). Sections already have a `room` (`migration_camp_week_ops.sql:42`). Absence alerts already cover leads and supports (`src/hooks/useAdminAttention.ts:223`). Missing: ratio targets, teacher demand per course, a room-clash rule, an unassigned-volunteer alert and week roles.

## Decided rules
- **Preferences + admin assigns** (Q-V1). The board shows and warns. It never assigns anyone.
- **Ratio is a warning, never a block.** Section capacity stays the only hard limit on registration (Q-D7 default). Waitlist offers stay automatic.
- **Two sections can't share a room in the same week.** The database refuses it.
- **Only vetted volunteers can be crewed.** Spec 35 owns the one crewing guard (accepted, not removed, agreement verified); this spec calls it for sections and week roles.
- **Week roles count as crew** for staffing totals, cover suggestions and hours, but not toward a section's ratio.

## Scope: what to build
- **Settings** on `season_settings` (spec 13):
  - `target_campers_per_crew SMALLINT NOT NULL DEFAULT 4 CHECK 1–20` (1:4, the 2026 target).
  - `min_crew_per_section SMALLINT NOT NULL DEFAULT 2 CHECK 1–6` (two teachers present, decided 2022).
  - Edited inline at the top of the Staffing board.
- **`classes.min_teachers SMALLINT NULL CHECK 1–6`.** Overrides the season minimum for every section of that course (for example 3 for Microcontrollers). Edited on the class.
- **`week_roles(id, volunteer_id, session_id, role text check in ('admin_room','floater'), note text check length ≤ 200, created_at, updated_at)`.**
  - Unique `(volunteer_id, session_id)`. A volunteer with a week role can't also be crewed on a section that week (trigger, both directions). A floater covering a section uses spec 33's dated cover, which isn't crewing, so the week role stays.
  - Check-in stays a duty type (`migration_duties.sql:13`), not a week role, so it can't be staffed twice.
  - RLS: admins write; a volunteer reads their own rows. Audited. `region_id` after spec 20.
  - `remove_from_season()` (spec 35) also deletes the volunteer's week roles.
- **Room clash:** a trigger on `sections` refuses a second section with the same non-blank `room` (trimmed, case-insensitive) in the same session. A section with no session runs both weeks, so it clashes with either week.
- **Crewing guard:** `week_roles` inserts call spec 35's crewing guard (accepted, not removed, agreement verified for the season). No second guard here.
- **`admin_staffing(p_session_id)` (admin RPC, read only).** Per section: course, label, room, seated campers, capacity, waitlist, crew count, campers per crew, required crew (`max(min crew, ceil(seated / target))`), grade spread (lowest–highest fall grade seated), status. Per course: crew required, crew assigned, accepted volunteers available that week who rank the course (from the ranked choices on their application, where spec 25 stores them). Plus the week's role holders, the week's duty-slot holders (spec 37 and 38 types such as Morning Check-In) and the list of accepted volunteers available that week with no section, week role or duty slot.
- **Admin Staffing view** (a tab on Classes, one week at a time):
  - Section rows coloured by status: **red** when crew is below the section's minimum (`classes.min_teachers`, else the season minimum) or campers per crew is greater than target × 1.25; **amber** when campers per crew is above the target but at most target × 1.25; **green** at or under the target. The colour always has a word next to it ("Short 1 teacher").
  - A "small section" note when seated campers are at most target × minimum crew (8 at the defaults), because the minimum, not the ratio, sets its crew.
  - Course summary: "Intro Python: 9 of 12 teachers · 4 more available who ranked it".
  - "Accepted, available this week, no section, week role or duty slot": each with a link to the crew editor. Duty-slot holders with no section are listed in their own group, not as unassigned.
  - Week roles: add, change or remove inline (role, note). Shown in their own group with a count.
  - **Projected need:** total capacity for the week ÷ target, against accepted volunteers available that week. "Seats could need 50 crew; 41 accepted volunteers are available."
- **Attention items** (spec 14's list, sessions starting within 21 days):
  - "PY-B is under ratio for Week 1" (red rows only), linking to the board.
  - "2 accepted volunteers have no section, week role or duty slot in Week 2", linking to the list.
- **Cover suggestions** (spec 25's `admin_crew_absences()`): senior floaters for that week are listed first. Suggestions stay senior-only until Q-V2 is decided. The cover itself is spec 33's dated cover, so the floater keeps the week role.
- **Volunteer Today and Classes:** a week-role holder sees "Week 2: Admin room" and the note ("report to room 104 at 8:15") instead of a section card.
- **Short weeks on `/apply`:** `sessions.needs_teachers BOOLEAN NOT NULL DEFAULT false`, set on the board. This spec owns it; `/apply` and spec 13's late-application path only read it ("Week 2 still needs teachers").
- **Demo seed:** one section under ratio, one floater, one accepted volunteer with no section, and a Microcontrollers class with `min_teachers = 3`.
- **Help:** an admin topic explaining the colours and that nothing is auto-assigned.

## Out of scope
- Auto-assigning or rebalancing crew.
- Pausing registration or waitlist offers when crew is short (Q-D7 default; capacity stays the only limit).
- Per-day staffing math (partial-day availability is a spec 25 follow-up).
- Room booking with the venue.

## Done when
- [ ] For a chosen week, the admin sees every section's campers per crew against the target, coloured with a word, and each course's teachers needed against assigned and willing volunteers.
- [ ] Changing the target or minimum on the board, or a class's `min_teachers`, updates the board without a reload.
- [ ] Red, amber and green follow the thresholds above exactly (unit-tested at the boundaries).
- [ ] The database refuses a second section in the same room and week, and spec 35's guard refuses a week role for someone it would refuse as crew.
- [ ] A senior floater appears first in cover suggestions for that week and is counted in the week's crew total; covering a section doesn't remove the week role.
- [ ] Marking a week short of teachers on the board shows "Week 2 still needs teachers" on `/apply`; clearing it removes the line.
- [ ] The two attention items appear and clear when fixed.
- [ ] `test-plans/staffing-board-tests.sql` prints only `ok`. Checked at 375 px, light and dark, as admin and as a week-role volunteer.

## Tests and verification
- SQL: the room-clash trigger (same week, both-weeks section, blank rooms ignored); week roles through spec 35's guard (accepted, pending, declined, removed, agreement unverified); week-role RLS (own row, other volunteer, admin); `admin_staffing()` math with absences ignored (planned crew), both-weeks sections and `min_teachers`.
- Unit: the status helper (thresholds and wording) in `src/lib/`.
- Browser: the board on the demo at 375 px.

## Open questions
- **Q-D3 target and minimum crew.** ❓ Default: 1:4, minimum 2, Microcontrollers 3.
- Does a junior volunteer count fully toward the ratio? (Q-V2 is about covering as lead.) ❓ Default: every crew member counts the same.
- Should admin-room staff count toward a week's ratio total? ❓ Default: no; they count only in the week's crew total and hours.
