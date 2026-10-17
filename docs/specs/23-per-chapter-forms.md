# 23: Per-chapter form content and DB-enforced grade rules

**Status:** ⬜ not started · **Issue:** #97 · **Priority:** P1 ★ · **Effort:** M · **Phase:** C
**Depends on:** 20, L2 · **Unblocks:** —
**Plan reference:** Plan §2.4 hardcoded table

## Why
The school district list is four Denver-metro districts in code. The waiver is per chapter only after L2 adds versions. The microcontrollers grade rule lives in `lib/courseConstraints.ts` and matches class names by substring, so the DB doesn't enforce it.

## Decided rules
- None.

## Scope: what to build
- District list per chapter in `form_configs` (editable in the Form editor), with "Other".
- `waivers.chapter_id`: each chapter publishes its own versions (L2 tables).
- `sections.grades_allowed text[]` (null = any), edited in the section form, enforced in `registrations_before_insert()` and in swaps. Remove `courseConstraints.ts` name matching; keep the requirement note as `classes.requirement_note`.
- Grade list (4th–9th) and the grade→age map per chapter in settings, defaulting to Denver's.

## Out of scope
- None.

## Done when
- [ ] A second chapter can run with its own districts, waiver and grade rules without code changes.
- [ ] A camper outside a section's grades is refused by the DB.

## Tests and verification
- SQL: grade rule on insert and swap.

## Open questions
- None.

## Notes for the builder
- None.
