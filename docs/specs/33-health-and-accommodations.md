# 33: Structured health, diet, accommodations and lunch

**Status:** ⬜ not started · **Issue:** ❓ · **Priority:** P0 · **Effort:** M · **Phase:** B
**Depends on:** 04, L2 · **Unblocks:** none
**Plan reference:** [inbox findings](../research/inbox-findings.md) §2, §5

## Why
The 2026 health sheets were free text. Real allergies (nuts, an EpiPen, penicillin) were mixed with preferences (halal, vegetarian), and a blank cell meant "none". A twice-exceptional camper's parent attends as an aide every year. Free lunch goes only to campers eligible for free/reduced lunch, and parents misunderstood that. A lunch handoff also failed and a camper went without.

## Scope: what to build
- `student_allergies(student_id, allergen, kind enum('food','medication','environmental','other'), severity enum('mild','severe','anaphylaxis'), epipen bool)`, plus an explicit `students.allergies_none bool`. One of the two is required.
- `students.diet text[]` (vegetarian, halal, kosher, other) and `students.no_candy bool`. These are kept separate from allergies.
- `students.accommodations text`, `students.has_iep_504 bool` and `students.parent_on_site bool` (an aide or para). The section builder needs these so it can give that camper a workspace nearby.
- Lunch: keep `free_reduced_lunch` (admin-only, per 04). Add a daily lunch roster per week with a "handed out" tick on the camp-day screen.
- **Visibility:** assigned teachers see allergies, severity, diet, no-candy and accommodations through `section_roster()` (04). They never see free/reduced-lunch status; the lunch roster is visible to the duty volunteer and admins only.
- Roster badges: a red ⚠ for anaphylaxis or an EpiPen, and an icon for accommodations.
- Migrate the old free text into `accommodations` or `allergen = other` for admin cleanup.

## Done when
- [ ] Registering is blocked until allergies or "none" is answered.
- [ ] A lead teacher sees the EpiPen badge for their own camper and nothing for campers in other sections (RLS test).
- [ ] The lunch roster lists exactly the eligible campers who are present that day.
