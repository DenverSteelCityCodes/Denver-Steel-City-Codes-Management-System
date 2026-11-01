# 39: Every form answer shown and exportable

**Status:** 🟨 in progress · **Issue:** #202 · **Priority:** P1 · **Effort:** M · **Phase:** B (before go-live)
**Depends on:** none · **Unblocks:** 40
**Plan reference:** office-hours decision 2026-10-19 (keep form structure in code; full form builder parked as [B14](backlog-p2.md))

## Why
- **Answers are collected and then lost.** The wizard saves shirt size, district, camper email, gender, ethnic background, how they heard, last year's program, free/reduced lunch, wants lunch, candy consent, other info and both signatures (`ParentRegistrationPage.tsx` student payload). Camper detail shows none of them (`AdminStudents.tsx` `CamperDetail`).
- **The camper CSV has 11 fixed columns**, so ordering shirts, the lunch list or the how-did-you-hear tally means asking a developer.
- **The applications CSV leaves out the applicant's own words** (why, experience, CS classes, skills, other curricula, signatures).
- **Parent email is saved on `parent_profiles`** and isn't shown anywhere in the admin.

## Decided rules
- The form structure stays in code for February (director, 2026-10-19). This spec only makes what's collected visible and exportable.
- One answer catalogue per form drives the detail view and the export, so the two never disagree.
- Labels are short admin labels ("Candy treats"), not the parent-facing sentence.
- Export is an inline panel, never a modal: choose column groups, one row per class or one row per camper. It exports what the current filter shows. The choice is remembered on this device only.

## Scope: what to build
- `src/lib/camperAnswers.ts`: the camper answer catalogue (key, group, short label, formatter, CSV value). Groups: Camper, Parent and emergency, Health, Details, Waiver.
- `useAdminStudents`: select every answer column, and the parent's email through `profiles → parent_profiles`.
- Camper detail: every answer, grouped like the wizard; health stays first and red. Empty optional answers are left out; a required answer that's missing says "Not given".
- Campers › Export: inline panel with group checkboxes, row shape, the count of rows it will write, and Download CSV.
- `src/lib/applicationAnswers.ts` + application review + the applications CSV get the same treatment.
- The volunteer crew CSV moves onto the shared `toCsv` / `downloadCsv` helpers (formula-safe cells, UTF-8 BOM).

## Out of scope
- Adding or editing questions (B14). Editable choice lists (40).
- Pickups and laptop loans: already shown on their own screens.

## Done when
- [x] Camper detail shows every saved answer, grouped like the wizard.
- [x] Campers › Export lets an admin choose groups and the row shape, and the CSV matches the detail view.
- [x] Application review and the applications CSV carry every answer.
- [x] build + lint + vitest pass; verified in the browser at 375 px and in dark mode.

## Build notes
- "Not given" follows the Form editor: an answer the editor makes optional or hides is left out when empty, instead of flagged.
- Parent name is now the name typed in the wizard, falling back to the account name for campers added another way.
- The legacy `laptop_available` answer isn't shown (spec 29 replaced it with per-week loans).
- The applications CSV, like the campers one, exports what the current filter shows.

## Tests and verification
- Vitest: the catalogues' CSV rows (per class and per camper), empty answers, arrays, booleans.
- Browser: demo admin, open a seeded camper, export with two group choices.
