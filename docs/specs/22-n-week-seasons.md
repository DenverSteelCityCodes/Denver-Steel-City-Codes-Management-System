# 22: Seasons with any number of weeks

**Status:** ⬜ not started · **Issue:** #96 · **Priority:** P1 ★ (P0 if Denver 2027 runs 3+ weeks) · **Effort:** L · **Phase:** C
**Depends on:** 20 · **Unblocks:** —
**Plan reference:** Plan §2.4 hardcoded table, row 'exactly 2 weeks'

## Why
Two weeks are hardwired: `sections.week CHECK (1,2)`, `volunteers.availability_week_1/2`, the application's two availability columns, the wizard's session1/session2, and the matcher's `week: 1 | 2`.

## Decided rules
- None.

## Scope: what to build
- `sections.session_id` becomes the source of truth (null still means "all sessions"); drop the `week` column after the backfill, and the `sections_sync_session` trigger with it.
- `volunteer_availability(volunteer_id, session_id)` and `application_availability(application_id, session_id)`, backfilled from the booleans.
- Wizard step 4: one row per active session (any count). The class browser groups by session.
- One-class-per-week rule by session (an "all sessions" section clashes with every session).
- Matcher generalized to N sessions; keep the senior/junior pairing.
- Update the attendance board, CSV export and every "Week N" label to use the session name.

## Out of scope
- None.

## Done when
- [ ] A 4-session season works end to end for parents, volunteers and admins; the existing 2-session data behaves the same.

## Tests and verification
- Matcher unit tests for 1, 2 and 4 sessions; SQL week-clash tests.

## Open questions
- Q-H4: how many weeks Denver runs in 2027.

## Notes for the builder
- If Denver 2027 needs 3+ weeks, move this into Phase B.
