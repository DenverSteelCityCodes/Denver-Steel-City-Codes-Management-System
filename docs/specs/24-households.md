# 24: Households, guardian invites and duplicate merge

**Status:** ⬜ not started · **Issue:** #98 · **Priority:** P1 · **Effort:** M · **Phase:** C
**Depends on:** 05 · **Unblocks:** —
**Plan reference:** Plan §2.2 'duplicate registrations / duplicate accounts'

## Why
Each camper belongs to one parent account. A second guardian makes their own account and a second copy of the child, who can then hold two seats in one week, because the clash check is per camper row.

## Decided rules
- None.

## Scope: what to build
- `households(id, name)`, `household_members(household_id, profile_id, role check in (primary, guardian), invited_by, joined_at)`; `students.household_id` backfilled one household per current parent.
- RLS for parents changes from `parent_id = auth.uid()` to household membership (students, registrations, roll calls, consents, change requests).
- Invite: "Add another guardian" on the dashboard → email invite (spec 09) with a one-time token → accept page → joins the household (creates their account if needed).
- Admin merge: from the duplicate report (spec 14b), "Merge into…" moves campers, registrations and consents to one household and one camper row, resolving same-week double seats (keep the earliest, cancel the other with reason `merged`), logged.

## Out of scope
- None.

## Done when
- [ ] Two guardians see and manage the same campers; either can register or cancel; both get emails.
- [ ] Merging two duplicate campers leaves one camper and at most one seat per week.

## Tests and verification
- SQL: household isolation; merge scenarios.

## Open questions
- Whether each guardian gets every email or only the primary ❓ (default: both).

## Notes for the builder
- None.
