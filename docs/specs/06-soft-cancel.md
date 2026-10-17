# 06: Soft-cancel registrations; cancel a section without deleting history

**Status:** ⬜ not started · **Issue:** #74 · **Priority:** P0 · **Effort:** M · **Phase:** A
**Depends on:** 05 · **Unblocks:** 10, 11, 15
**Plan reference:** Plan §1.3 A4, §2.2 'admin cancels a class with people in it'

## Why
"Remove registration" is a hard DELETE, and deleting a section cascades away its registrations, roll calls and updates (`ON DELETE CASCADE`). Families see "Not enrolled" with no explanation, and nothing can be undone.

## Decided rules
- Families in a cancelled section get an email with a rebook link and go to the **front of the line** on any waitlist they join that week (Q-N1, decided 2026-10-16).

## Scope: what to build
- Columns on `registrations`: `cancelled_at timestamptz`, `cancel_reason text` (`admin_removed, parent_cancel, section_cancelled, declined_offer, offer_expired, took_other_seat`), `cancelled_by uuid`, `displaced_from_section uuid` (set when a section is cancelled).
- A trigger keeps `cancelled_at/by` in step whenever status becomes `cancelled`.
- Admin "Remove registration" → sets `cancelled` with reason `admin_removed` (no DELETE). Hard delete stays possible only through the SQL editor.
- FK `registrations.section_id` → `ON DELETE RESTRICT` (was CASCADE). A section with any registration can't be deleted.
- `sections.cancelled_at timestamptz`, `sections.cancel_reason text`. Parents' and the wizard's section lists hide cancelled sections; admin lists show them greyed with "Cancelled".
- RPC `public.cancel_section(p_section_id uuid, p_reason text)`, admin-only: locks the section, sets every non-cancelled registration to `cancelled` with reason `section_cancelled` and `displaced_from_section = p_section_id`, marks the section cancelled, sets `app.reason`. Returns the affected camper count.
- AdminClasses: "Delete section" becomes "Cancel section" (InlineConfirm: "12 campers will be removed and their families emailed"). "Delete" only appears for a section with zero registrations.
- Hook for spec 09: enqueue a `section_cancelled` notification per family (no-op until 09 exists).
- Same treatment for a class: "Cancel class" cancels all its sections.

## Out of scope
- Waitlist priority logic (spec 10 reads `displaced_from_section`).

## Done when
- [ ] No UI path hard-deletes a registration.
- [ ] Cancelling a section keeps its registrations (as cancelled), roll calls and updates; parents see "Cancelled by camp" on the camper card with a "Pick another class" link.
- [ ] Seat counts (`section_fill_counts`) and rosters ignore cancelled sections and registrations.
- [ ] Deleting a section with registrations is refused by the DB, with a readable error.
- [ ] Every cancel is in the audit log with its reason.

## Tests and verification
- SQL: cancel_section as admin works; as parent or volunteer it is refused; FK RESTRICT verified.
- Browser: admin cancels a demo section; parent view shows the cancelled state; volunteer no longer sees the section.

## Open questions
- None.

## Notes for the builder
- Update `useAdminStudents.removeRegistration` and the AdminStudents confirm copy ("The registration is kept as cancelled…").
- `useAdminClasses.deleteSection/deleteClass` and their cascade-count warnings change meaning: rewrite the copy.
