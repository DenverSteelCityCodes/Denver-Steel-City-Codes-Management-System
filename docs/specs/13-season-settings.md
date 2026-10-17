# 13: Registration opening time, deadlines and offer windows

**Status:** ⬜ not started · **Issue:** #82 · **Priority:** P0 · **Effort:** S · **Phase:** B
**Depends on:** none · **Unblocks:** 10, 11, 12
**Plan reference:** Plan flow A1, §6 decisions Q-R1, Q-W1, Q-W2

## Why
Registration opens when an admin flips a switch (`form_configs.student_registration.enabled`). There's no scheduled start, so anyone with the link could get in early, and the deadline and offer rules need somewhere to live.

## Decided rules
- Opening: **one fixed date and time for everyone, first come first served** (Q-R1). No early window, no lottery.
- Change deadline: 14 days before the session starts. Offers: 48 h, or 12 h inside 7 days.

## Scope: what to build
- Table `season_settings(year smallint pk, registration_opens_at timestamptz, change_deadline_days int default 14, offer_hours int default 48, offer_hours_final_week int default 12, updated_at)`; `chapter_id` added in spec 20. Admin write; everyone signed in reads.
- `registrations_before_insert()`: non-admin inserts before `registration_opens_at` → P0001 "Registration opens <date> at <time> (Denver time)". The existing form switch stays as an emergency close.
- Parent dashboard, class browser and wizard step 4: countdown card "Registration opens Sat, Feb 6 at 9:00 am" (formatted in America/Denver), switching live to open at the moment (client timer + server check).
- Admin: inline settings on the Sessions page.
- Read the settings in specs 10–12 instead of constants.
- Remove the hardcoded `DEFAULT 2026` on `students.registration_year` and `registrations.year` (the trigger already sets the year from the session).

## Out of scope
- Per-family early access (dropped).

## Done when
- [ ] A parent trying 1 minute early is refused by the DB with the opening time, even via direct API.
- [ ] At the opening minute the countdown flips without a reload.
- [ ] Admins can change the time; the change is logged.

## Tests and verification
- SQL: before/after the opening time, admin bypass.
- Browser: set the opening 2 minutes ahead on staging and watch the flip.

## Open questions
- The actual opening date and time ❓ (tracker non-code task).

## Notes for the builder
- Built 2026-10-17. Times are entered and shown in Denver time whatever the viewer's device clock (`src/lib/denverTime.ts`). The class browser disables Register until opening, the wizard refuses step 4, and the countdown flips to open without a reload. The demo has no settings row (registration open). `private.season_settings_for(year)` gives later RPCs the settings with defaults.
- Store `timestamptz`; display in the chapter's time zone (America/Denver until spec 20).
