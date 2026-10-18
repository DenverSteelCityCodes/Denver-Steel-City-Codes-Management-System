# 23: Per-region form content and DB-enforced grade rules

**Status:** ⬜ not started · **Issue:** #97 · **Priority:** P1 ★ · **Effort:** M · **Phase:** C
**Depends on:** 20, L2 · **Unblocks:** —
**Plan reference:** Plan §2.4 hardcoded table

## Why
The school district list is four Denver-metro districts in code. The waiver is per region only after L2 adds versions. The microcontrollers grade rule lives in `lib/courseConstraints.ts` and matches class names by substring, so the DB doesn't enforce it.

## Decided rules
- None.

## Scope: what to build
- District list per region in `form_configs` (editable in the Form editor), with "Other".
- `waivers.region_id`: each region publishes its own versions (L2 tables).
- ~~`sections.grades_allowed text[]`~~ Built by spec 31 as class-level rules (`classes.grades_allowed`, `requires_class_id`, `requirement_note`, `next_class_id`), enforced in `registrations_before_insert()` and in swaps; `courseConstraints.ts` is gone. This spec only makes them (and the grade list they use) per region.
- Grade list (4th–9th) and the grade→age map per region in settings, defaulting to Denver's.
- The wizard's hardcoded venue line ("Camp is held at Cherry Creek High School, 8:00 AM – 4:00 PM each day", step 4) becomes per-region (or per-session) text. Found while building spec 13.

## Out of scope
- None.

## Done when
- [ ] A second region can run with its own districts, waiver and grade rules without code changes.
- [ ] A camper outside a section's grades is refused by the DB.

## Tests and verification
- SQL: grade rule on insert and swap.

## Open questions
- None.

## Notes for the builder
- None.

## Update (2026-10-17)
- Spec [31](31-course-rules-in-the-db.md) now builds the DB-enforced grade and prerequisite rules for Denver before February, as `classes.grades_allowed`, `requires_class_id`, `requirement_note` and `next_class_id`. This spec only makes them (and the grade→age map) per region. The `sections.grades_allowed` design above is replaced by the class-level columns.
