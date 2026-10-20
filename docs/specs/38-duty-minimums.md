# 38: A weekly duty minimum, in minutes

**Status:** 🟨 in review · **Issue:** #205 · **Priority:** P1 · **Effort:** M · **Phase:** B (before go-live)
**Depends on:** 09 ✅ (outbox), 37 · **Unblocks:** B2 (hours certificate reads duty minutes)
**Plan reference:** V4 (duty slots); decided by the Regional Director 2026-10-19

## Why
- **Some volunteers never sign up.** Duties are self-pick, which volunteers like because they can work with the people they want. But some skip them, and the same few cover every lunch.
- **Duties aren't the same length.** Lunch takes longer than a break, so "3 duties each" isn't fair, and "one of each kind" forces people off the duty they like.

## Decided rules (2026-10-19)
- **Each duty type has a length in minutes.** Every volunteer crewed in a week needs at least **N duty minutes that week**, made up of any duties. Someone who likes lunch duty can do only lunch duty.
- **Sign-up deadline:** N days before the week starts (default 7). Until then, volunteers pick their own.
- **Anyone short at the deadline is assigned by an admin.** Admins get a "Short on duty minutes" list for the week, with open slots to put each person in. The volunteer gets an email when an admin adds them to a duty. Nothing is auto-assigned.
- **Reminder:** 2 days before the deadline, each crewed volunteer who is still short gets one email.
- **After the deadline**, a volunteer can't drop a duty if it would take them below the minimum for that week. The 3-day lock from spec 37 still applies on top.
- "Crewed in a week" = lead or support on a section in that week's session (a section with no session counts for every week of its year), and not removed from the season. Volunteers who aren't crewed can still sign up. No minimum applies to them.
- **Minimum 0 = off** (the default), so nothing changes until an admin sets it.

## Scope: what to build
- **`duty_types.minutes SMALLINT NOT NULL DEFAULT 30 CHECK 5–480`.** Shown to volunteers on every duty ("45 min"). Admins set it when adding a type and edit it in the Duty types list.
- **`duty_settings`** (from spec 37) gains `minutes_per_week SMALLINT NOT NULL DEFAULT 0 CHECK 0–1200` and `signup_deadline_days SMALLINT NOT NULL DEFAULT 7 CHECK 0–60`.
- **Helpers (private):** `crewed_sessions(volunteer)`, `duty_minutes(volunteer, session)` (sum of `minutes` over the volunteer's claims dated in the session), `duty_deadline(session)` (start date − deadline days).
- **Drop rule:** the spec 37 trigger also refuses a volunteer's drop after the week's deadline when their minutes for that week would fall below the minimum.
- **`public.my_duty_weeks()`** (volunteer): per crewed week, the session, start/end dates, minutes required, minutes signed up, the deadline.
- **`public.admin_duty_shortfall(p_session_id)`** (admin): every crewed volunteer below the minimum, with their name and minutes. Read only. Admins assign through the existing `duty_assignments` insert.
- **Emails (outbox):**
  - `duty_assigned`: an admin added you to a duty (name, date, minutes). Not sent when you sign yourself up.
  - `duty_minimum_reminder`: you have X of N minutes for Week n, sign up by <deadline>. Daily `pg_cron` job, sent once per volunteer and week.
- **Volunteer Duties tab:**
  - One line per crewed week under the heading: "Week 2: 30 of 60 duty minutes. Sign up for 30 more by Monday, Oct 19". When met: "Week 2: 75 duty minutes. You've met the minimum."
  - Each duty row shows its length.
  - **Cancel** on a duty you need for the minimum (after the deadline) is replaced by "Needed for your minimum".
- **Admin Duties page:**
  - A **Duty rules** fold: minutes per week, deadline (days before the week), drop lock (days before the duty), saved inline.
  - **Short on duty minutes** for the selected week: before the deadline, a quiet list ("still signing up"); after it, the action list. Each row: name, "30 of 60 min", a Select of the week's open slots, and **Assign**.
  - Duty types list: minutes per type, editable inline.
- **Demo seed:** lengths for the four seeded types (check-in 30, lunch 45, dismissal 30, breaks 15) and a 60-minute minimum, so the demo shows someone short.
- **Help:** volunteer and admin topics.

## Out of scope
- Auto-assigning anyone short (decided against: admins choose, so friends stay together).
- Per-volunteer exemptions. An admin can leave someone short. Revisit if the list is noisy in 2027.
- Counting crew absences against the minimum.

## Done when
- [ ] A crewed volunteer sees their minutes against the minimum for each week they're crewed, and every duty shows its length.
- [ ] After the deadline, the database refuses a drop that takes a volunteer below the minimum. Before it, the drop works (outside the 3-day lock).
- [ ] The admin sees who is short for a week and can assign each one to an open slot. That volunteer gets a `duty_assigned` email.
- [ ] The reminder job queues one `duty_minimum_reminder` per short volunteer per week, 2 days before the deadline, and none for volunteers who've met it.
- [ ] Minimum 0 hides every minimum line and sends nothing.
- [ ] `test-plans/duty-minimums-tests.sql` prints only `ok`. Templates render in `send-notifications`.
- [ ] Checked at 375 px, light and dark, as volunteer and admin.

## Tests and verification
- SQL: minutes math (session dates, both-weeks sections, removed volunteers), the after-deadline drop rule, shortfall RLS (volunteer refused), the reminder job's dedupe, `duty_assigned` only for admin inserts.
- Unit: the week-line wording helper in `src/lib/volunteerHome.ts`.
- Browser: both roles on the demo.

## Deploy note
Deploy `send-notifications` (two new templates) before applying the migration, like specs 29–36.
