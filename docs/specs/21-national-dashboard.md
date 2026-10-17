# 21: National dashboard

**Status:** ⬜ not started · **Issue:** #95 · **Priority:** P1 ★ · **Effort:** M · **Phase:** C
**Depends on:** 20 · **Unblocks:** —
**Plan reference:** Plan §1.4 N1

## Why
The national team needs to see every chapter at a glance and help without hunting through each one.

## Decided rules
- None.

## Scope: what to build
- `/national` route for national admins: a chapter list with season status, registration open/closed, fill %, waitlist size, volunteers crewed vs. needed, open attention items, and last admin activity.
- `national_rollup()` RPC: aggregates only, no camper PII.
- Drill-in: opens that chapter's admin views in **read-only** mode by default; write access per Q-N2.
- Create chapter: name, slug, time zone, contact → invite the first chapter admin by email → optionally copy last season's classes, sections and form content from another chapter.

## Out of scope
- None.

## Done when
- [ ] National sees all chapters' numbers; chapter admins can't open `/national`.
- [ ] A new chapter can be created and handed to its admin without SQL.

## Tests and verification
- SQL: rollup returns no PII; access tests.

## Open questions
- Q-N2.

## Notes for the builder
- None.
