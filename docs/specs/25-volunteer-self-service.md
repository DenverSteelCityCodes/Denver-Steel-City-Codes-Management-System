# 25: Volunteer preferences, switch requests and "I can't make it"

**Status:** ✅ [PR #133](https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/pull/133) · **Issue:** #99 · **Priority:** P1 · **Effort:** M · **Phase:** C
**Depends on:** 14 · **Unblocks:** 14 (no-lead alert extension)
**Plan reference:** Plan flows V3 and V6, §6 decision Q-V1

## Why
After acceptance, volunteers can't change anything about themselves (self-update was removed so they can't change their experience level), and drops happen by text with no alert.

## Decided rules
- Q-V1 decided: **preferences + admin assigns**. Volunteers edit availability and course preferences and can request a switch; admins (and the matcher) still assign. No self-pick.

## Scope: what to build
- RPC `update_my_volunteer_prefs(p_availability, p_course_prefs)`: only those fields (`experience_level` stays admin-only); after spec 22, availability is per session.
- "Request a switch" on the volunteer dashboard → `change_requests` kind `crew_switch` with a message → admin queue (spec 11's table).
- "I can't make it" → `crew_absences(volunteer_id, from_date, to_date, note)` → feeds the spec 14 no-lead alert, with suggestions: available seniors that week who aren't crewed.
- When an admin assigns a new lead, the section's families get one `new_lead` email ("Your camper's lead this week is Sam").

## Out of scope
- Self-pick of crew spots (decided against).

## Done when
- [ ] A volunteer can update preferences and report an absence from a phone; the admin sees the alert with suggestions; families get one email when the lead changes.

## Tests and verification
- SQL: a volunteer can't change their experience level or others' rows.

## Open questions
- Q-V2 whether a junior can cover as lead.

## Notes for the builder
- Built 2026-10-17 (`migration_volunteer_self_service.sql`, `VolunteerSelfService.tsx`):
  - **Preferences:** `update_my_volunteer_prefs()` sets week availability on `volunteers` and the course choices on the volunteer's application, which is where the matcher reads them. At least one week is required. Volunteers still have no UPDATE on `volunteers`, so the experience level stays admin-only.
  - **Switch requests:** `request_change(NULL, 'crew_switch', …)`. The admin queue on the Students page now covers both families and volunteers.
  - **Absences:** `crew_absences` holds today-or-later dates and is audited. `admin_crew_absences()` lists each absence against the sections the volunteer crews in those dates, with up to 5 suggested seniors: available that week, not crewing that week, and not absent themselves. The admin dashboard shows it as an attention item.
  - **`new_lead` email:** sent only when an admin **replaces** a lead, so first assignments, seeding and resets send nothing. One email per family with held seats in the section.
  - **Course names:** volunteers can read only their own section's class through RLS, so the choice lists come from `course_names()`. Class names are public on the apply form anyway.
- The demo reset now clears `change_requests`, a gap left by spec 11.
- Q-V2 (can a junior cover as lead?) is still open. Suggestions list seniors only until it's decided.
- Spec 22 (any number of weeks) will need per-session availability instead of `availability_week_1/2`.

## Follow-ups from the Discord findings (2026-11-01)

These are outside this spec's merged scope: build each as its own small issue. From [the Discord findings](../research/discord-findings.md), checked against `main` at `d046434`.

- [ ] The matcher and crew editor use the skill ratings and course ranks the application already collects (`schema.sql:89`). The matcher picks by availability and seniority only today (`src/lib/volunteerMatcher.ts:59`). (Discord M29)
- [ ] Crew editor warnings: placed in a course rated 1–2, two part-timers in one section, an all-part-time crew, an admin-only avoid-pair together, or no experienced volunteer in the section. (Discord M29; Q-D11)
- [ ] Per-day availability (Mon–Fri; full, morning or afternoon) and an availability re-confirm prompt about 3 weeks before camp. (Discord M29)
- [ ] Volunteers can edit spec 35's preferred grade band and preferred role in prefs. The fields live on the application and are defined only in spec 35. (Discord M29, M43)
- [ ] An admin-only note on each crew assignment ("why here"). (Discord M29)
- [ ] `crew_assigned` and `crew_changed` emails to the volunteer when an admin adds, moves or removes them: section, week, room, times, class lead and co-crew names. `new_lead` goes to families only (`migration_volunteer_self_service.sql:149`). (Discord M38)
- [ ] The volunteer's section card adds co-crew names and "Your choices" next to "Your assignment". A season setting "Assignments published on <date>" shows on volunteer home until then. (Discord M38)
- [ ] "I can't make it" takes an optional arrive-late or leave-early time and a "Running late" option with an ETA. Each absence emails the section's co-crew. Admins can already add absences for anyone (`migration_volunteer_self_service.sql:81`). (Discord M14, M33)
- [ ] Self-service "Withdraw my application" (before a decision) and "Step down for the season" (after acceptance), which free crew spots and duty claims like `remove_from_season()` and alert admins with the affected sections. (Discord M14)
- [ ] An optional crew check-in tick on volunteer Today, feeding B2. (Discord M14)
