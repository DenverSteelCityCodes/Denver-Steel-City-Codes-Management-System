# 28: Family data-deletion requests

**Status:** ⬜ not started · **Issue:** #102 · **Priority:** P1 · **Effort:** S · **Phase:** C
**Depends on:** 05, L4 · **Unblocks:** —
**Plan reference:** Plan §2.4 privacy bullets

## Why
Families should be able to ask us to delete their data, and the privacy notice will say they can.

## Decided rules
- None.

## Scope: what to build
- "Delete my family's data" on the parent contact card → `change_requests` kind `deletion` with confirmation copy explaining what's kept (signed waivers and attendance records kept until the hold date, per the retention policy).
- Admin queue → "Approve" runs `private.anonymize_family(household_or_parent)`, reusing the L4 anonymize code, skipping legal holds; logged; email confirmation sent before the email address is removed.
- Volunteers: the same, from the volunteer dashboard.

## Out of scope
- None.

## Done when
- [ ] A request is honoured within the timeframe the privacy notice states, and only the records the policy keeps remain.

## Tests and verification
- SQL: anonymize respects holds and keeps the records under hold.

## Open questions
- Response timeframe for the privacy notice ❓ (default 30 days).

## Notes for the builder
- None.
