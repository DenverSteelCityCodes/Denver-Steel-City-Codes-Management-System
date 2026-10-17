# 04: Tighten volunteer access to camper data

**Status:** ⬜ not started · **Issue:** #72 · **Priority:** P0 · **Effort:** S · **Phase:** A
**Depends on:** none · **Unblocks:** L3
**Plan reference:** Plan §0 Risk 4, §2.2 'volunteer sees only what's needed', §2.4 who-sees-what

## Why
A review on 2026-10-16 found that volunteer access to camper records is broader than the roster needs. The specifics are kept off this public repo until this spec merges; the Regional Director has them. Many volunteers are 14–17, so crew access should be the minimum a roster needs. Only fictional demo data is involved today; this must land before any real family registers.

## Decided rules
- Crew may see, for campers **holding a seat** in **their own section** (status `confirmed`, plus legacy `pending`; not `offered`, since an offered camper isn't attending yet): name, age, allergies, medical conditions, emergency contact name/phone/relation, parent name and phone. Nothing else.
- *Changed while building (PR for #72):* parent **name** was added to the list. The print roster has always shown it next to the parent phone, and it is no more sensitive than the emergency contact's name; without it the crew roster would have changed.

## Scope: what to build
- New `public.section_roster(p_section_id uuid)` RPC, SECURITY DEFINER: returns exactly the fields above. Caller must be admin or `private.auth_volunteer_has_section(p_section_id)`, else raise 42501. Status filter `pending, confirmed`.
- Remove the broader volunteer read path on `students`, so the RPC is the only way crew read camper data.
- Tighten `volunteer_read_registrations` to rows with status `pending/confirmed` (crew don't need cancelled or waitlisted rows).
- Switch every volunteer read of camper data to the RPC: `useAssignedClass`, `useSectionRoster`, `PrintRoster`, `RollCallPanel` (check each for `students` selects or embeds).
- Keep `private.auth_volunteer_has_student` only if other policies still use it; otherwise drop it.

## Out of scope
- Photo-consent flag on the roster (L3 adds a column to the RPC).

## Done when
- [ ] Volunteers can read camper data **only** through `section_roster` (verify every other path returns nothing).
- [ ] `section_roster` for the volunteer's own section returns only seated campers and only the listed fields; for another section it errors.
- [ ] Volunteer dashboard, roll calls and print roster look and work exactly as before (screenshots before/after).
- [ ] Admin views unchanged.
- [ ] Demo seed still produces a full roster.

## Tests and verification
- Add to the RLS test file: volunteer cannot read `students` columns directly; can call the RPC for own section only; cannot see cancelled campers.
- Re-run the 2026-10-16 check (details from the Regional Director): it must return nothing.

## Open questions
- None.

## Notes for the builder
- Do this before any real data exists in prod. It's small and should go first.
