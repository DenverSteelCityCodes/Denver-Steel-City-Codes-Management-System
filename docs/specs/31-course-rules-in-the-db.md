# 31: Course rules in the database: grades, prerequisites, repeat courses, "place with"

**Status:** 🟨 in review ([PR #194](https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/pull/194)) · **Issue:** #151 · **Priority:** P0 · **Effort:** M · **Phase:** B
**Depends on:** 05 · **Unblocks:** 23 (makes these rules per region), 32
**Plan reference:** [inbox findings](../research/inbox-findings.md) §1–2; plan Q-P2; takes over the grade-rule half of spec 23

## Why
- **The grade rule can be bypassed.** The Microcontrollers rule (rising grade 7+, after Intermediate Python) lives in `lib/courseConstraints.ts:20-28` and matches by class name. The UI checks it, and so does the swap function (`migration_parent_swap.sql:58-61`), but the insert trigger doesn't, so a direct API insert gets past it. Spec 23 was going to fix this, but it waits on regions (Phase C, after February).
- **Prerequisites are only a note.** Staff caught prerequisite and grade problems by hand (29 threads).
- **Repeat courses.** Staff emailed families who picked the same course for both weeks (21 threads).
- **"Place with" requests.** Families asked to be placed with a friend or sibling (21 threads). There's nowhere to record that.
- **Admin edits skip everything.** They bypass every rule (`migration_one_class_per_week.sql:81-83`), with no reason recorded.

Already true, and kept: grade is stored as the grade the camper enters in the fall (`campers.ts:3-7`, labelled "Grade (entering fall)"). Sections still have `age_min`/`age_max`, derived from grade.

## Decided rules
- Eligibility uses the **rising grade** (already in code). The public page (30) and flyers use the same words: "grade this fall".
- Grade limits and prerequisites are **enforced by the database** for parents. A parent who doesn't qualify gets a "Request an exception" button, which creates a `change_requests` row of a new kind, `exception`. Admins can override, and the override is logged with a reason (via spec 32). ❓ confirm hard block vs warning.
- Taking the same course in both weeks is a **warning** with a suggested next course, not a block.

## Scope: what to build
- **New class columns:** `classes.grades_allowed text[]` (null = any), `classes.requires_class_id uuid null`, `classes.requirement_note text`, `classes.next_class_id uuid null`.
- **Admin class form:** edits these fields inline.
- **Migrate the hard-coded rule:** set Microcontrollers to grades 7th–9th, requiring Intermediate Python. Then delete the name matching in `courseConstraints.ts`.
- **`registrations_before_insert()` and the swap function** refuse when:
  - the grade isn't in `grades_allowed`, or
  - `requires_class_id` is set and the camper has no seat-holding registration in that class in an earlier session this year, nor a completed one in a past year.
- **Error message:** "Microcontrollers needs Intermediate Python first. Request an exception?"
- **Wizard, class browser and swap options** grey out ineligible classes and show the reason.
- **Repeat-course warning** (wizard, class browser, swap options): "Already taking Intro Python in Week 1. Try Intermediate Python?", using `next_class_id`.
- **`registrations.place_with text`** (max 100 characters). Parents can edit it until the change deadline. Admins see it in the section builder (`AdminClasses`) and in the Students list.
- **Attention item "Prerequisite at risk":** a week-2 registration whose required week-1 class was cancelled, or whose camper was absent at every week-1 arrival roll call.

## Out of scope
- Per-region grade lists (spec 23).
- Auto-placing friends together. Admins read the requests.

## Done when
- [ ] A direct API insert or swap that breaks the grade or prerequisite rule is refused, for both MC and any other class with rules.
- [ ] `courseConstraints.ts` name matching is gone, and the same rules show in the UI from the DB.
- [ ] "Request an exception" creates a change request that admins see in the queue.
- [ ] The repeat warning shows in both registration paths and in swap options.
- [ ] "Place with" is visible in the section builder.

## Tests and verification
- SQL: grade outside the range; prerequisite missing; prerequisite met earlier this season; prerequisite met in a past year; a swap into a class with rules.
- Browser: an ineligible class is greyed out with the reason (375 px).

## Open questions
- Should a parent's "has done Python before" answer (`students.previous_program`, collected but unused) count toward a prerequisite? Default: no. Use the exception request instead.

## Notes for the builder
- Update spec 23 to say it only makes these columns per region.
