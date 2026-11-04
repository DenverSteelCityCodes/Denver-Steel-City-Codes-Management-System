# 35: Volunteer interviews and onboarding: private links, emails, checklist, profile

**Status:** ✅ merged ([PR #198](https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/pull/198)) · follow-up: one crewing guard, [#220](https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/issues/220), in progress · **Issue:** #155 · **Priority:** P1 · **Effort:** M · **Phase:** C (interview emails can ship earlier, in B)
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
- Does national have rules on publishing photos of volunteers who are minors? ❓ **Built with the stricter default:** under 18 (by the age on their latest application; no application counts as under 18), a photo reaches parents only with the volunteer's consent and a named guardian's consent. Revisit when national answers.

## As built (2026-10-18)
- `migration_volunteer_onboarding.sql`: `interview_slot_links` (admin-only); `my_interview()` adds `denver_time` and `meeting_url`; emails queued by triggers and one pg_cron job (`interview-reminders`, every 5 minutes), each with a dedupe key so it goes once; profile columns on `volunteers` plus `photo_guardian_name`/`photo_guardian_consent_at`, `accepted_at` and `removed_*`; private bucket `volunteer-photos` (2 MB, JPEG/PNG/WebP) with storage policies; `onboarding_tasks`, `volunteer_tasks`, `my_onboarding()`, `set_my_onboarding_task()`, `admin_onboarding_overdue()`, `remove_from_season()`, `meet_the_crew()`. Tests: `test-plans/volunteer-onboarding-tests.sql`.
- Choices the spec left open: "times posted" goes at most once a Denver day per applicant, to pending applicants from the last 180 days; a nudge at most once a day; an item is due its hours after acceptance or after the item was added, whichever is later; volunteers accepted before this have no due times; a finished item stays done if the volunteer is accepted again; a removed volunteer loses volunteer access and can't be put on a crew until an application of theirs is accepted again; the removal email carries the admin's reason; the decline email doesn't (the reject note stays admin-only).
- Review fixes: removal also ends crew access to past seasons' sections; both-weeks sections show in every week; overdue counts only this season's acceptances; queued interview emails are withdrawn when a booking moves or goes or the application is decided, and a reminder past its interview is never sent; removed volunteers are off the volunteer email audiences (including spec 34's).
- Not done here: photos a demo visitor uploads stay in storage after the nightly reset (the reset clears the profile's pointer to them).

## From the Discord findings (2026-11-01)

From [the Discord findings](../research/discord-findings.md). Each item was checked against `main` at `d046434`, so it asks only for what is missing.

**Vetting**
- [ ] Apply form: date of birth and school status (grade 9–12, graduated, college, adult). Age and College are already asked (`src/lib/applyForm.ts:6`). Derive the adult flag used by photo consent and L7. State the age rule up front, with a minimum volunteer grade setting above the top camper grade and an admin override with a reason. (Discord M04)
- [ ] Application review shows every earlier application by the same person: decision, admin-only reason, removal reason, incidents and prior-season record (weeks crewed, absences, duty shortfall). (Discord M04, M11, M32)
- [ ] Ask about affiliation with other youth programs. (Discord M04, M43)
- [ ] A "Signed volunteer agreement" task an admin verifies. The application waiver stays.
- [ ] One crewing guard, owned here: extend the existing guard (`migration_volunteer_onboarding.sql:703`, which refuses only removed volunteers) to refuse a section lead or support, or a spec 39 week role, unless the volunteer has an accepted, non-removed application for that season and a verified agreement. Leads and organizers included. Spec 39 calls this guard and defines no other. (Discord M04, M09; Q-D12)
- [ ] Adults on crew per camp day on the admin dashboard. (Discord M04)
- [ ] A "Do not re-accept" flag that blocks acceptance without an admin override reason, and an end-of-camp evaluation (reliability, duties, invite back?) on the volunteer's admin record. (Discord M32)
- [ ] The removal screen reminds admins to also remove chat and shared-folder access. (Discord M32)

**Onboarding**
- [ ] An optional fixed due date per task (for example the Tuesday before camp) next to hours-after-accept, capped at orientation or day one, and counted from the crewing date for volunteers added late. (Discord M08)
- [ ] `onboarding_reminder` emails 24 hours before due and once when overdue, and "Remind all overdue". Done states and one-click removal already exist (`src/components/AdminOnboarding.tsx:255`). (Discord M08)
- [ ] A per-season "Confirm your profile for this year" task. This changes "a finished item stays done" (As built) for that one task. (Discord M08)
- [ ] A "No chat app" flag, so that volunteer is reached by email only. (Discord M08)
- [ ] A "clear photo of your face" hint with minimum dimensions on upload, and an admin crew directory (preferred name, photo, section). (Discord M08)
- [ ] An "event" task type for orientation, training and bonding: dates, time, place and map; RSVP (going, or can't with a reason); reminders 2 days before and the morning of; one email when the date or place changes; admin bulk attendance that ticks the task and feeds B2; an automatic make-up task (recording and slides) due before day one for anyone absent or accepted afterwards; a per-event "returning volunteers may skip" toggle, off by default. (Discord M18; Q-D5)
- [ ] A "Crew resources" list on the volunteer dashboard (title, URL, audience: all crew, a course, a week, admins), shown only to accepted, non-removed volunteers. (Discord M20)
- [ ] An optional "email for shared folders" with a type-twice check, and a prompt for a personal backup address when the email is a school domain. (Discord M20)
- [ ] An admin Share card with the stable `/camp` and `/apply` URLs and a QR code download for each. (Discord M20)
- [ ] A season-end CSV of last season's volunteers who haven't re-applied, for chat-role cleanup. (Discord M20)
- [ ] A versioned volunteer handbook per season (SCC's text: conduct, phones at break, photos, health and illness, classroom rules, parents go to organizers, reporting contact) and a "Read and acknowledge" task that stores the version and reopens when it changes, with an admin list. The version table comes with L2 (unbuilt). No vaccination or test records. (Discord M39)
- [ ] A separate volunteer tick "OK to appear in camp social media posts" (off by default, withdrawable), distinct from the parent-facing photo consent. (Discord M06)

**Interviews**
- [ ] An admin-edited question list per season; per-interviewer rubric scores (explaining, communication, reliability, motivation), notes and a recommendation (accept, hold, decline), required before a booking can be closed. Booking notes already exist (`migration_interviews.sql:22`). (Discord M11)
- [ ] A non-final "hold" status with a required reason and no email until the final decision. (Discord M11)
- [ ] A required admin-only decline reason code (no interview, past deadline, conflict of interest, skills, capacity). (Discord M11)
- [ ] A "needs a strong co-teacher" flag carried into crew assignment. (Discord M11)
- [ ] A "decision sent" status per applicant and a bulk send. (Discord M11)
- [ ] A per-season interview rule (everyone; new volunteers only; or waive with at least N accepted seasons, default N = 2) with a "Returning: N seasons" badge. Waived applicants see "No interview needed", get a receipt email and drop off the unbooked and nudge lists. An audited admin waive or require override with a reason. A waiver never skips the application or the agreement. (Discord M15; Q-D1)
- [ ] Interview slots: capacity for parallel panels (changes the one-booking-per-slot constraint, `migration_interviews.sql:24`); a cutoff for applicant cancel and reschedule; an email when an admin edits or cancels a booked slot, and the applicant goes back on the unbooked list. One booking per application, future slots only, self-move and "times not posted yet" already exist (`migration_interview_self_booking.sql:26`). (Discord M23)
- [ ] An interview outcome per booking (attended, no-show, missed by us). A no-show frees the slot and emails one rebook link; the unbooked and no-show list shows days waiting. Accepting an applicant whose interview is pending or a no-show needs an override reason, unless the interview was waived. (Discord M23)
- [ ] One org-owned meeting link per slot or day, so no one's school account is needed. (Discord M23)
- [ ] Interviewers per slot: `interview_slot_interviewers(slot_id, admin_id, role lead|shadow)`. Admins sign up and see "My interviews today"; at least two per slot; an attention item for a booked slot in the next 24 hours with no lead; recusal (knows the applicant, relative) marks the slot uncovered; a warning on a B11 family link; a shadow count per new interviewer. (Discord M26)

**Applications and profile**
- [ ] "Apply again for <season>" on a past volunteer's dashboard, prefilled from the last application and profile, asking only for this season's availability, courses and consents. One application per season, editable until the window closes. (Discord M24)
- [ ] Graduation year on the profile; a "You haven't applied for <season> yet" card; an automatic "applications are open" email to past volunteers (spec 34's audience) with applied and not-applied tracking. (Discord M24)
- [ ] Application fields: preferred camper grade band (bands taken from the season grade range, spec 31), preferred role (teach, admin room, either; spec 25 lets volunteers edit both in prefs), an admin-only "rather not be paired with", shirt size editable on the profile, and a role description with time commitment and service-hour credit above the form. Optional demographics only after L1 review. Languages, skill ratings, motivation and shirt size are already collected (`schema.sql:78`, `:82`, `:87`). (Discord M43)
- [ ] Draft autosave for the application and a receipt email on submit. (Discord M21)
- [ ] Each crewed volunteer sees their section's co-crew and leads with opt-in contact (the email or phone they chose to share), visible only to that section's crew and admins. (Discord M45)
- [ ] `season_settings.on_duty_phone`, an on-duty lead phone shown on volunteer Today, so personal numbers don't circulate. This spec owns the setting; specs 40 and 41 only read it. (Discord M45)
