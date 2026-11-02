# 43: Editable answer choices on the Forms page

**Status:** ⬜ not started · **Issue:** #203 · **Priority:** P1 · **Effort:** S · **Phase:** B (before go-live)
**Depends on:** 42 · **Unblocks:** 23 (per-region district list)
**Plan reference:** office-hours decision 2026-10-19

## Why
- Every dropdown and checkbox list in both forms is hardcoded: school districts, schools, shirt sizes, how-did-you-hear, ethnic background, CS languages, last year's programs (`ParentRegistrationPage.tsx`, `applyForm.ts`).
- The two forms use different shirt-size lists (XS–XL vs XS–XXL).
- These are the parts of a form that change from year to year, and the only change today is a code change.

## Decided rules
- Lists save in `form_configs.config.fields.<key>.options`; the code list stays as the default when nothing is saved.
- Answers are stored as the option's text (as today). Renaming an option doesn't rewrite old answers; removing one hides it from new families only.
- "Other" stays last wherever the form shows a free-text box for it, and can't be removed there.
- Reorder with up/down buttons (WCAG 2.5.7), not drag.

## Scope: what to build
- `formFields.ts`: mark choice questions with their default `options`; `resolveField()` returns the resolved list.
- Forms page: a choice question's row opens its list in place: add, rename, move up/down, remove (InlineConfirm when records already use it).
- Wizard and `/apply` read the resolved lists.

## Out of scope
- Adding questions, help text, sections, logic (B21).

## Done when
- [ ] An admin can change the districts, schools, shirt sizes and how-heard lists, and the live forms show them.
- [ ] A camper saved with a removed choice still shows it on camper detail and in the CSV.
- [ ] build + lint + vitest pass; verified at 375 px and in dark mode.
