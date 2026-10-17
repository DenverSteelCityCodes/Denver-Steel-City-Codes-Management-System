# 14: Auto-confirm, "section has no lead" alert, duplicate-camper report

**Status:** ⬜ not started · **Issue:** #83 · **Priority:** P0 · **Effort:** S · **Phase:** B
**Depends on:** none · **Unblocks:** —
**Plan reference:** Plan §0 win 5, §2.2 'volunteer drops last-minute' and 'duplicate accounts', §6 decision Q-P4

## Why
Every new seat sits as `pending` ("Spot held · We'll confirm soon") until an admin clicks Confirm, and the step checks nothing. Nothing alerts admins when a section has no lead. Two guardians can create two copies of one child, who can then hold two seats in one week.

## Decided rules
- Q-P4 decided: **auto-confirm**. A held seat is `confirmed` immediately.

## Scope: what to build
- `registrations_before_insert()`: a parent insert with a free seat gets `confirmed` (not `pending`). Migrate existing `pending` → `confirmed` (prod starts empty; demo: update `reset_demo()` seed).
- Parent copy: drop "We'll confirm soon" and "Awaiting confirmation"; success screens say "You're in". Keep a `pending` label for any legacy rows. Check `StudentCard`, `buildSubhead`, `ParentBell`, `ThisWeekCard`, the wizard and class browser success copy.
- Admin: remove confirm-centric copy; status menus still offer all statuses.
- Attention item **"No lead"**: sections in active, upcoming sessions where `lead_id is null` (after spec 25, also when the lead has a `crew_absences` row on a camp day in the next 7 days) → "PY-B has no lead for Week 1" → link to the section's crew editor.
- **14b.** Duplicate-camper report: admin RPC `possible_duplicate_campers()` returns pairs with the same normalized first+last name and either the same grade or school, under **different** parent accounts, in the current year. Attention item "2 possible duplicate campers" → list with both families' contacts. Merge comes later (spec 24).

## Out of scope
- Merging duplicates (spec 24).

## Done when
- [ ] New registrations are `confirmed` instantly, and the confirmation email says so (with spec 09).
- [ ] No parent screen says "confirm soon".
- [ ] Removing a lead makes the alert appear on the dashboard and bell within one page load.
- [ ] Seeding two "Maya Lopez, 6th" under two accounts shows one duplicate pair.

## Tests and verification
- SQL: status on insert; duplicate RPC is admin-only.
- Browser: parent registers (sees confirmed), admin sees both alerts.

## Open questions
- None.

## Notes for the builder
- The demo login blurb in `lib/demo.ts` mentions campers in different states. Keep it accurate after the seed change.
