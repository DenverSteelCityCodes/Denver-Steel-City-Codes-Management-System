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


## From the inbox findings (2026-10-17)
- Placement rule: a volunteer's sibling is never placed in that volunteer's section (a reserved-sibling policy exists). Store the link as `volunteers.sibling_student_ids` and warn in the section builder. Transport/carpool needs are a free-text field on availability.
