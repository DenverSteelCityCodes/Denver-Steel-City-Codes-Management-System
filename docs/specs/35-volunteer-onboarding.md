# 35: Volunteer interviews and onboarding: private links, emails, checklist, profile

**Status:** ⬜ not started · **Issue:** #155 · **Priority:** P1 · **Effort:** M · **Phase:** C (interview emails can ship earlier, in B)
**Depends on:** 09 · **Unblocks:** B2 (hours certificate uses the legal name)
**Plan reference:** [inbox findings](../research/inbox-findings.md) §3

## Why
- **Interview logistics:** 44 volunteer-application threads and 14 onboarding threads. The repeating problems were "where's the interview link", expired sign-up pages, mixed-up times, and an applicant who never booked and never heard back.
- **Plain-text Zoom details:** one Zoom ID and passcode were reused for years and emailed to large groups.
- **Onboarding by hand:** acceptance starts a 24-hour checklist (info form with photo and bio, Discord, Remind, the shared folder). Volunteers who miss it are removed, and all of it is tracked by hand. One volunteer silently dropped off every mailing list because of a trailing space in a spreadsheet.
- **Handmade documents:** 52 service-hour letters a year, and a 20-page "Meet the Teachers" PDF.

What exists:
- **Interview tables:** `interview_slots(id, slot_datetime, duration_minutes, notes)` and self-booking (`migration_interview_self_booking.sql`).
- **No meeting link field.** Free-text `notes` is readable by every signed-in user (filed separately as a bug).
- **No emails.** Nothing is sent on booking or as a reminder. The picker promises "we'll email you when times are posted" (`InterviewSlotPicker.tsx:27`) and nothing does.
- **Unbooked applicants** appear only as a count (`useAdminAttention.ts:294-311`).
- **Decisions are silent.** Accept and reject are a status change with no email.
- **Wrong time zone.** Times show in the device's zone, not Denver's.
- **Thin volunteer profile.** `volunteers` holds only experience and week availability. Names live on the application. There's no legal or preferred name, bio or photo.
- **No season removal.** There's no "remove from season", and demoting someone leaves volunteer access in place (filed separately as a bug).

## Decided rules
- A meeting link is visible only to the applicant booked into that slot, and to admins.
- Every decision (accepted, declined, removed) is emailed, one person per email.
- Rosters show the preferred name. Letters and certificates use the legal name.
- Volunteer photos are opt-in. Many volunteers are minors, so a photo shows to parents only with a consent tick (from the volunteer, and from a guardian if under 18 ❓ confirm with national).

## Scope: what to build
- **Interview links:** `interview_slot_links(slot_id pk, meeting_url)`, admin-only. `my_interview()` returns the time (formatted in America/Denver) and the link to the booked applicant. Move nothing into `notes`.
- **Interview emails** (outbox):
  - `interview_booked` (with an .ics attachment or link)
  - `interview_reminder` at 24 h and 1 h (cron)
  - `interview_times_posted` to applicants with no booking when an admin adds slots
  - `application_accepted`, `application_declined`
- **Admin Interviews page:** a list of applicants with no booking, with a "nudge" button that sends `interview_nudge`.
- **Onboarding checklist:**
  - `onboarding_tasks(key, label, help_url, due_hours_after_accept)`, set by admins
  - `volunteer_tasks(volunteer_id, task_key, done_at, verified_by)`
  - the volunteer dashboard shows the checklist with due times
  - an admin "Overdue" list
  - `remove_from_season(volunteer_id, reason)` clears crew spots and duty claims, marks the volunteer removed for the season, emails them, and is audited
- **Profile:** `volunteers.legal_name`, `preferred_name`, `pronunciation`, `bio` (300 chars), `photo_path` (private storage bucket, signed URLs), `photo_consent_at`. The volunteer edits these on their dashboard.
- **"Meet the teachers":** a page for parents with a seated camper that week, showing that week's crew (preferred name, pronunciation, bio, consented photo). A print view replaces the hand-made PDF.

## Out of scope
- Background checks (L7, and SCC's own process).
- Discord and Remind automation. They stay as checklist links.

## Done when
- [ ] No meeting link is readable by anyone except the booked applicant and admins (RLS test).
- [ ] Booking, a reminder, posted times and decisions each send exactly one email.
- [ ] An overdue checklist item shows to admins. Removal frees crew spots and is in History.
- [ ] Parents see only their camper's week's crew, with photos only where consented.

## Tests and verification
- SQL: link RLS (booked applicant, other applicant, admin); remove-from-season effects.
- Browser: the volunteer checklist and profile at 375 px.

## Open questions
- Does national have rules on publishing photos of volunteers who are minors? ❓
