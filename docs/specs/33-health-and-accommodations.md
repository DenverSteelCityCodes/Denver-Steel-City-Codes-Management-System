# 33: Structured allergies, accommodations and lunch

**Status:** ⬜ not started · **Issue:** #153 · **Priority:** P0 (allergies + roster badge) / P1 (diet, lunch list) · **Effort:** M · **Phase:** B
**Depends on:** 04 ✅, L2 · **Unblocks:** none
**Plan reference:** [inbox findings](../research/inbox-findings.md) §2, §5

## Why
Health threads are few (9 in five years) but carry the most risk:
- **A recurring aide.** A twice-exceptional camper's parent attends as an aide every year. The workspace and trigger notes reached the teacher only because staff forwarded them by hand.
- **Unsafe lunch.** A free-lunch camper with a dye allergy refused the meals on offer.

The 2026 roster's health tabs were free text:
- About 15% of campers listed something.
- Real allergies (nuts, an EpiPen, penicillin) were mixed with preferences (halal, vegetarian).
- A blank cell meant "none".

The app copies that shape today:
- **Free text.** `students.allergies` is labelled "Allergies / dietary restrictions" and `medical_conditions` "Medical conditions, learning disabilities, etc." (`migration_student_registration.sql:20-26`). There's no accommodations field and no explicit "none".
- **Hidden fields.** `candy_consent`, `lunch_provision` and `other_info` appear in no admin screen or CSV (`AdminStudents.tsx:298`).
- **Correct today:** `section_roster()` gives teachers `allergies`, `medical_conditions` and `medical_info`, and keeps `free_reduced_lunch` hidden (`migration_volunteer_roster_access.sql:17-29`).

## Decided rules
- Every camper has either at least one allergy entry or an explicit "No allergies". Blank is not allowed for new or re-confirmed campers.
- Diet preferences are separate from allergies.
- Teachers see allergies, severity, diet, candy and accommodations for **their own seated campers only**. Nobody but admins sees free/reduced-lunch status. The lunch list says "lunch provided", never why.

## Scope: what to build
- **`student_allergies(id, student_id, allergen text, kind text check in ('food','medication','environmental','other'), severity text check in ('mild','severe','anaphylaxis'), epipen bool, updated_at)`.**
  - RLS: the parent owns their camper's rows; admins have full access.
  - Volunteers read only through the roster RPC.
  - Audited.
- **New student columns:** `students.allergies_none bool`, `students.diet text[]` (vegetarian, halal, kosher, other), `students.accommodations text`, `students.parent_on_site bool`.
  - Keep `candy_consent` and relabel it "OK to receive candy as a prize?".
  - Rename the old `allergies` column to `allergies_legacy`. A migration copies it into an `other`-kind row flagged for admin review.
- **Wizard step and re-confirm panel:** a repeatable allergy row (allergen, kind, severity, EpiPen) or "No allergies", then diet, accommodations, and "A parent or aide will be on site".
- **`section_roster()`:** add structured allergies, diet, candy and accommodations, plus `parent_on_site`.
- **Roster badges:** red ⚠ for anaphylaxis or an EpiPen, and an icon for accommodations. Same on the print roster.
- **Lunch list:**
  - `lunch_list(p_section_id, p_day)` returns the seated campers with `lunch_provision` who were present at that day's arrival roll call.
  - Readable by admins and by the volunteer holding that day's Lunch Duty slot.
  - New table `lunch_marks(student_id, day, marked_by, marked_at)` for a "handed out" tick.
- **Admin:** the student detail and CSV show every field, including laptop, lunch, candy and other_info.
- **Camp-week email (follow-up to 09):** when a camper's allergies or accommodations change during camp week, email the lead (`medical_changed`).

## Out of scope
- Medication administration logs.
- Uploading IEP or 504 documents.

## Done when
- [ ] Registration and re-confirm refuse a camper with no allergy entry and no "none".
- [ ] A lead sees the EpiPen badge for their own camper and nothing for other sections' campers (RLS test).
- [ ] Free/reduced-lunch status is unreadable by any volunteer (RLS test), and the lunch list shows only names.
- [ ] Old free-text allergies are migrated and listed for admin review.

## Tests and verification
- SQL: the RLS matrix (parent, lead of the section, lead of another section, lunch-duty volunteer, admin).
- Browser: the allergy rows at 375 px with a screen reader label on each field.

## Open questions
- Is a diet "preference" ever a safety issue (for example a religious restriction) that should look like an allergy on the roster? Default: diet shows as a neutral tag.
