# 25: Volunteer preferences, switch requests and "I can't make it"

**Status:** ⬜ not started · **Issue:** #99 · **Priority:** P1 · **Effort:** M · **Phase:** C
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
- None.
