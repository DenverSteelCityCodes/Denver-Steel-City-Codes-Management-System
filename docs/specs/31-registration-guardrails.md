# 31: Registration guardrails: prerequisites, repeat courses, "place with"

**Status:** ⬜ not started · **Issue:** ❓ · **Priority:** P0 · **Effort:** M · **Phase:** B
**Depends on:** 16 · **Unblocks:** 23 (makes the rules per chapter)
**Plan reference:** [inbox findings](../research/inbox-findings.md) §1 rows 7–8, §2 eligibility; plan Q-P2

## Why
- **Repeat courses:** staff emailed about 30 families who picked the same course for both weeks.
- **Prerequisites:** Microcontrollers needs Intermediate Python and rising grade 7+. It was chosen without them at least 7 times, and caught by hand.
- **Grade wording:** the eligible range was written as both "currently 4–8" and "entering 5–9" in different years.
- **"Place with" requests:** about 25 families asked for a friend or sibling in the same section.

## Decided rules (proposed, confirm in office hours)
- Eligibility uses the **rising grade** (the grade in the fall after camp). Every label says "Grade this fall".
- Course prerequisites are hard blocks for parents. An admin can override, and the override is logged (05).
- Repeating the same course in both weeks is a **warning** with a suggested next course, not a block.

## Scope: what to build
- `classes.min_grade`, `classes.max_grade`, `classes.prerequisite_class_id`, and `classes.next_class_id` (for example P1 → P2).
- The `registrations_before_insert()` check: grade range, plus the prerequisite met by an earlier week this season or a past season. Message: "Microcontrollers needs Intermediate Python first."
- Wizard and class browser: ineligible classes are greyed out with the reason. A repeat course shows "Already taking Intro Python in Week 1. Try Intermediate Python?"
- A `place_with` free-text field on the registration (max 100 chars). The admin section builder lists open "place with" requests next to each camper.
- If a camper cancels or misses week 1, flag their week-2 registration when it depends on the week-1 course ("prerequisite at risk" attention item).

## Done when
- [ ] A direct API insert that breaks grade or prerequisite rules is refused. An admin insert with an override reason succeeds and is logged.
- [ ] The repeat-course warning shows in both registration paths.
- [ ] "Place with" requests show up in the section builder.
