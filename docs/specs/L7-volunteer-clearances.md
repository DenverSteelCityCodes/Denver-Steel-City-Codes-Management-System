# L7: Volunteer clearances with expiry

**Status:** ⬜ not started · **Issue:** #104 · **Priority:** P1 ★ handoff · **Effort:** S · **Phase:** C
**Depends on:** 20 · **Unblocks:** —
**Plan reference:** Plan §4.1 Pennsylvania row; §3 rank 14

## Why
Pennsylvania requires three clearances for adult volunteers responsible for children (State Police criminal check, DHS child-abuse clearance, FBI fingerprint check; the FBI check is waived for unpaid PA residents of 10+ years who sign an affirmation), renewed every 60 months 🔎. National's own policy may go further (Q-L7). We store no clearance data.

## Decided rules
- Requirements are a **per-chapter setting**; Denver may require none or fewer (❓ Q-L7).

## Scope: what to build
- `chapter_clearance_requirements(chapter_id, kind, applies_to check in (adult, minor, all), renewal_months)`.
- `volunteer_clearances(id, volunteer_id, kind, issued_on, expires_on, verified_by, verified_at, note)`. Admin write; the volunteer reads their own (no document uploads in v1: admins verify the paper or PDF and record dates).
- Crewing guard: a trigger on `sections.lead_id` and `section_supports` insert refuses a volunteer missing a required, unexpired clearance ("Ana's FBI clearance expired Mar 2027"). Admin override requires a reason (logged).
- Attention item: clearances expiring in the next 30 days; volunteer dashboard: "Your child-abuse clearance expires on …".
- The volunteer apply form shows the chapter's requirements up front.

## Out of scope
- Integrating with background-check vendors.

## Done when
- [ ] A PA-configured test chapter blocks crewing an adult without the three clearances and allows it once recorded.
- [ ] Denver's configuration behaves as Denver decides.

## Tests and verification
- SQL: guard, override, expiry.

## Open questions
- Q-L7 national's screening policy; whether teen volunteers need any clearance.

## Notes for the builder
- None.
