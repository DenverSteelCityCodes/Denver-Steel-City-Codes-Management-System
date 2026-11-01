# 40: Editable answer choices on the Forms page

**Status:** 🟨 in progress · **Issue:** #203 · **Priority:** P1 · **Effort:** S · **Phase:** B (before go-live)
**Depends on:** 39 · **Unblocks:** 23 (per-region district list)
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
- Adding questions, help text, sections, logic (B14).

## Done when
- [x] An admin can change the districts, schools, shirt sizes and how-heard lists, and the live forms show them.
- [x] A camper saved with a removed choice still shows it on camper detail and in the CSV.
- [x] build + lint + vitest pass; verified at 375 px and in dark mode.

## Build notes
- Editable lists: camper school district, shirt size, ethnic background, how-heard; volunteer school, shirt size, CS languages. The camper "School name" is a free-text box, so "schools" means the volunteer School list.
- Last year's programs (`PREVIOUS_PROGRAMS`) stay in code: they sit under the yes/no "came last year" question, which has no list of its own on the Forms page. Pick up with spec 23 or when the course list moves to the database.
- Only the volunteer School list has a free-text "Other" box, so only it pins "Other" last. Elsewhere "Other" is an ordinary choice.
- The two shirt-size defaults still differ (camper XS–XL, volunteer XS–XXL); the director can now line them up on the Forms page.
- A list that matches the default is saved as no list, so later changes to the code default still reach it.
- A family re-registering a camper whose saved answer was removed still sees that answer selected (it's added back to their list), so re-registering never clears it.
- Removing a choice that records already use asks first with the count ("19 campers chose “M”"); removing an unused one doesn't ask.
- The editor edits its own copy of the list (rows with ids that survive renames and moves) and saves the whole list after each change, so a move straight after a rename, or two quick edits, act on what's on screen. Repeats and "at least one choice" are checked against that copy before saving. A failed save puts the list back to the last one saved. Another admin's edits show when the list is reopened.
- The class-onboarding panel ("Change something") uses the same shirt list.
- `/apply` and the wizard wait for the form settings before showing, so nobody picks from a default list the admin already changed.
- Reviewed by Grok 4.7 (through Cursor) and Codex; the editor was reworked after both found that name-based edits could be lost after a rename.
