# 35: Volunteer onboarding: interview links, checklist, bios, legal name

**Status:** ⬜ not started · **Issue:** ❓ · **Priority:** P1 · **Effort:** M · **Phase:** C
**Depends on:** 09 · **Unblocks:** B2 (hours certificate uses the legal name)
**Plan reference:** [inbox findings](../research/inbox-findings.md) §3, §7

## Why
- **Interview logistics:** about 15 "where's the Zoom link" emails, one Zoom passcode reused for years and emailed to large groups, and an applicant who never booked a slot and never got a decision.
- **Onboarding:** acceptance starts a 24-hour checklist (info form, photo and bio, Discord, Remind, Drive), and volunteers who miss it are removed. All of it is tracked by hand.
- **Hours letters:** about 49 written by hand. Volunteers asked for their legal name on them.
- **"Meet the Teachers":** a 20-page PDF made by hand.

## Scope: what to build
- `interview_slots.meeting_url`, set per slot. It's shown only to the booked applicant, and the reminder email goes out 24 h and 1 h before.
- An attention item lists applicants who haven't booked 5 days after applying, with a nudge email.
- `onboarding_tasks(key, label, due_hours_after_accept)` set by the admin, and `volunteer_tasks(volunteer_id, task_key, done_at)`. The volunteer dashboard shows a checklist with deadlines. The admin view shows overdue items with a "remove from season" action (logged).
- `volunteers.legal_name`, `preferred_name`, `name_pronunciation`, `bio` (300 chars), `photo_path` (storage, with consent). Rosters use the preferred name; letters use the legal name.
- A "Meet the teachers" page generated per week, viewable by parents of confirmed campers only.
- Acceptance and rejection emails are sent one per person through the outbox.

## Done when
- [ ] No meeting link is visible to anyone but the booked applicant.
- [ ] An overdue checklist item shows on the admin dashboard.
- [ ] The parent "Meet the teachers" page shows only that week's crew.
