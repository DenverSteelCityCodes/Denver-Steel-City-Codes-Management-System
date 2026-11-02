# 40: Crew day plan on volunteer Today

**Status:** ⬜ not started · **Issue:** — · **Priority:** P1 · **Effort:** M · **Phase:** B
**Depends on:** 09 🟨 (outbox), 02 ⬜ (sending), 34 🟨 (week-crew updates), 39 ⬜ (week roles, staffing board) · **Unblocks:** spec 30's per-day location (M36), spec 34's venue emergency card (M47)
**Plan reference:** [Discord findings](../research/discord-findings.md) M16 (also M39, M36)

## Why
- **Volunteers ask the same questions every camp day (70 conversations, 2021–2026):** when and where to arrive, which door is open, where to park, whether lunch is provided, what to wear and bring, where to take campers after lunch.
- **The answers conflicted.** Three different arrival times the night before day one (2024). A day-two slide deck copied from day one with the wrong time (2026). "No lunch provided" one year and free sandwiches the next. A volunteer went to the wrong building, and another learned the week before that it was a day camp in a school.
- **Crew hours aren't camper hours.** Crew arrive about 8:20–8:30 and stay until about 4:30; campers are there 9–3 or 9:30–3.
- **What the app already has:** volunteer Today shows the section's room, teaching times, duties and the session's daily schedule with item locations (`src/pages/volunteer/VolunteerToday.tsx:38`, `:105`; `src/pages/volunteer/parts.tsx:97`). Missing: a crew call time, a meeting point, anything that differs by day, crew-only items, practical crew info and a night-before message. The schedule is shared with parents and is public on `/camp` (`migration_public_camp_page.sql:132`), so crew-only items need filtering.

## Decided rules
- **One source for times.** The call time and meeting point live in the app's session data, never only in a slide deck or chat post. Anything printed or posted copies from here.
- **Crew-only items never reach parents or the public page.**
- **Same-day changes are marked**, so nobody follows an old time.

## Scope: what to build
- **Session defaults:** `sessions.crew_call_time TIME NULL` and `sessions.crew_meeting_point TEXT NULL` (for example "West entrance, by the gym doors").
- **`session_days(session_id, day date, crew_call_time time null, crew_meeting_point text null, location_override text null, note text null check length ≤ 300, updated_at, updated_by)`**, primary key `(session_id, day)`.
  - Null fields fall back to the session default. `location_override` covers a single day in another building (spec 30's M36 reads it for `/camp`).
  - RLS: admins write; signed-in volunteers read. Not exposed to parents except `location_override`, which the spec 30 RPC may show. `note` is crew-only. Audited.
  - The day must fall inside the session's dates (check constraint via trigger).
- **Schedule items:** `schedule_items.audience TEXT NOT NULL DEFAULT 'everyone' CHECK IN ('everyone','crew')`, `schedule_items.day DATE NULL` (null = every day of the session) and `updated_at`.
  - Parents' read policy and the public `/camp` RPC return only `audience = 'everyone'`.
  - Crew items: setup, crew huddle, lunch-duty posts, room resets, debrief.
- **Volunteer Today, top card "Today's plan":**
  - Call time and meeting point (from the day, else the session), the day's location if it differs, the section's room (or week role, spec 39).
  - The day's items for crew and everyone, in time order, each with its room.
  - An item or day field changed today shows "Updated 10:42".
  - Admins can tick "Also post as a crew update" when saving a same-day change, which creates a non-urgent spec 34 `week_crew` update.
- **"Before camp" card and crew FAQ:** `crew_faq(id, year, question, answer, sort, updated_at)`, admin-edited, shown on volunteer home from acceptance until the last camp day. Starter questions: parking, what to bring (laptop that joins wifi and can screen share, charger), lunch, dress code and theme days, the coding platform, who to contact (spec 35's `on_duty_phone`, read only, never a personal number). Volunteer policies themselves belong to the handbook (spec 35 follow-up, M39).
- **Night-before email `crew_starts_tomorrow`** (outbox): to every crewed volunteer and week-role holder of the session, the evening before its first day (pg_cron, 5 pm Denver), with call time, meeting point, location, section or role and room, and a link to Today. Dedupe key per volunteer and session.
- **"Assignment viewed":** `crew_plan_views(volunteer_id, session_id, first_viewed_at)` written the first time a crewed volunteer opens Today or Classes for that session. The spec 39 board and the crew editor show "Not opened yet" next to anyone who hasn't.
- **Season copy (spec 26 follow-up, M12):** crew FAQ rows, session defaults and crew schedule items are copied forward.
- **Admin:** the Sessions page gets the session defaults and a per-day table (date, call time, meeting point, location, note); schedule items get Audience and Day selects.
- **Demo seed:** call times for both weeks, one day with a different call time, two crew-only items and four FAQ rows.

## Out of scope
- Correcting slide decks or chat posts outside the app.
- Emergency procedures (spec 34 follow-up M47 owns the venue emergency card; this card links to it).
- Volunteer SMS (B1, Q-D13).
- Per-volunteer call times.

## Done when
- [ ] A crewed volunteer opening Today on a camp day sees the call time, meeting point, location, room and the day's crew and shared items in order.
- [ ] Changing tomorrow's call time on one day shows only on that day, and a same-day change shows "Updated" with the time.
- [ ] A parent, and the public `/camp` page, never see crew-only items (RLS and RPC tests).
- [ ] The night-before email goes once to each crewed volunteer and week-role holder, and to nobody else.
- [ ] The admin sees who hasn't opened their assignment.
- [ ] `test-plans/crew-day-plan-tests.sql` prints only `ok`; the template renders in `send-notifications`. Checked at 375 px, light and dark.

## Tests and verification
- SQL: `session_days` RLS (volunteer reads, parent refused except through the camp RPC, admin writes); schedule-item audience filtering for parents and `/camp`; the night-before job's recipients and dedupe.
- Unit: the "effective plan for a day" helper (day override, else session default).
- Browser: Today at 375 px on a demo camp day.

## Deploy note
Deploy `send-notifications` (one new template) before applying the migration, like specs 29–38.

## Open questions
- Default crew call time when none is set? ❓ Default: 30 minutes before the earliest section start that day.
- Does the night-before email also go before week 2's first day to people crewed both weeks? ❓ Default: yes, once per session.
