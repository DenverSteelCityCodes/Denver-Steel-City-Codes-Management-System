# 10a: Block same-week waitlist backups

**Status:** ⬜ not started · **Issue:** #78 · **Priority:** P0 · **Effort:** S · **Phase:** B
**Depends on:** none · **Unblocks:** 10
**Plan reference:** Plan §6 decision Q-W4

## Why
Today a camper who holds a seat in Week 1 can also join a full Week 1 class's waitlist as a backup (allowed in `migration_one_class_per_week.sql`). With the decided offer rules, seat-holders are skipped, so such a backup could never turn into anything.

## Decided rules
- Decided 2026-10-16 (Q-W4): a camper who holds a seat in a week **cannot** join another waitlist in that week.
- Admins can still override (they bypass the trigger, as today).

## Scope: what to build
- In `registrations_before_insert()`: run the same-week clash check when the new status would be `waitlisted` too, not only `pending`. Message: "This camper already has a spot in <class> that week. Cancel it first to join this waitlist."
- Class browser `SectionCard`: when `weekClash` and the section is full, show a disabled "Already registered this week" instead of "Join waitlist".
- Wizard step 4: if the chosen class is full and the camper holds a seat that week from an earlier registration, show the same message before submit.
- One-off report: count existing same-week backups in the demo DB (prod starts empty). Leave them, and note the count in the PR.

## Out of scope
- Withdrawing a camper's waitlist entries when they later take a seat (spec 10).

## Done when
- [ ] DB refuses a same-week waitlist insert by a parent and allows one by an admin.
- [ ] UI never offers a button the DB would refuse.
- [ ] Waitlisting in a **different** week still works.

## Tests and verification
- Add cases to the seat/week SQL tests: hold W1 seat → W1 waitlist refused; W2 waitlist allowed; a both-weeks section counts as both.

## Open questions
- None.

## Notes for the builder
- Edit the canonical definition in `migration_one_class_per_week.sql` (or its `supabase/migrations/` successor). It's the only definition of that function.
