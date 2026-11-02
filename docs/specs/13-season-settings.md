# 13: Registration opening time, deadlines and offer windows

**Status:** ✅ [PR #121](https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/pull/121) · **Issue:** #82 · **Priority:** P0 · **Effort:** S · **Phase:** B
**Depends on:** none · **Unblocks:** 10, 11, 12
**Plan reference:** Plan flow A1, §6 decisions Q-R1, Q-W1, Q-W2

## Why
Registration opens when an admin flips a switch (`form_configs.student_registration.enabled`). There's no scheduled start, so anyone with the link could get in early, and the deadline and offer rules need somewhere to live.

## Decided rules
- Opening: **one fixed date and time for everyone, first come first served** (Q-R1). No early window, no lottery.
- Change deadline: 14 days before the session starts. Offers: 48 h, or 12 h inside 7 days.

## Scope: what to build
- Table `season_settings(year smallint pk, registration_opens_at timestamptz, change_deadline_days int default 14, offer_hours int default 48, offer_hours_final_week int default 12, updated_at)`; `region_id` added in spec 20. Admin write; everyone signed in reads.
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
- Store `timestamptz`; display in the region's time zone (America/Denver until spec 20).

## Follow-ups from the Discord findings (2026-11-01)

These are outside this spec's merged scope: build each as its own small issue. From [the Discord findings](../research/discord-findings.md), checked against `main` at `d046434`.

- [ ] `season_settings.registration_closes_at` (Denver time), enforced in `registrations_before_insert()` for non-admins like the opening time. After it, `/camp` and the class browser say "Registration closed" with notify-me and "Request a late spot". A family's late request goes to spec 11's queue; the only insert is spec 32's `admin_register()`. Spec 30's closed status derives from it. (Discord M22)
- [ ] The emergency form switch asks for a reason, and flips show in the History strip. Flips are already audited (`migration_audit_log.sql:88`). (Discord M22)
- [ ] Volunteer application open and close times, shown on `/apply` and `/camp`. `/apply` closes itself at that time (the manual switch stays, `migration_security_hardening.sql:220`); an admin can reopen, audited. After the close, an optional "late application", optionally only for weeks spec 39 marks short, lands marked late for one-click decision. An optional per-week target switches the form to a standby list. (Discord M21; Q-D4)
- [ ] A pre-opening checklist card on the admin dashboard: venue set (or "to be announced"), every section has a room, opening time set, volunteer window set. It warns; it never blocks. Aim to fix the opening date by Dec 1. Capacity is already required on every section (`migration_sections.sql:15`). (Discord M13, M30; Q-D9)
- [ ] Dashboard counts: unique campers per week (a camper in both weeks counted once), rooms in use, crewed volunteers, and signups against the same day last year. The seat grid already exists (`src/pages/AdminDashboard.tsx:87`). (Discord M30)
- [ ] An optional `camper_cap_per_week` that warns, never blocks, when section capacity exceeds it. Section capacity stays the only hard limit. (Discord M30; Q-D7)
- [ ] Admins overfill only by raising capacity, which is audited and already triggers offers (`migration_waitlist_offers.sql:113`); remove the direct overfill path (`src/pages/AdminStudents.tsx:166`). (Discord M30)
