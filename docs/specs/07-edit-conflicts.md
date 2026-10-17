# 07: No silent overwrites when two people edit the same record

**Status:** ⬜ not started · **Issue:** #75 · **Priority:** P0 · **Effort:** S · **Phase:** A
**Depends on:** none (nicer with 05) · **Unblocks:** —
**Plan reference:** Plan §2.2 'two people editing the same record'

## Why
Saves are last-write-wins. An admin fixing a camper's allergy and the parent editing the same camper at the same time silently overwrite each other.

## Decided rules
- The second save is refused with a clear message; nothing is overwritten silently.

## Scope: what to build
- `updated_at timestamptz not null default now()` on `students, sections, classes, sessions` (`parent_profiles` already has one) plus a shared BEFORE UPDATE trigger `private.touch_updated_at()`.
- Client pattern (one helper in `src/lib/`): `.update(patch).eq('id', id).eq('updated_at', loadedUpdatedAt).select().maybeSingle()`. No row back = conflict.
- Conflict UI, inline in the same form: "Someone else changed this at 3:41 pm. Reload to see their version, then make your change again." with a Reload button that keeps the user's typed values visible beside the new ones. After spec 05, name who changed it.
- Apply to: `StudentCard` CamperEditor, `ConfirmOnboardingPanel`, admin student edits, the AdminClasses section/class forms, AdminSessions, and the parent contact card (spec 11).

## Out of scope
- Real-time co-editing.

## Done when
- [ ] Two browsers editing the same camper: the second save shows the conflict message, and both values are visible to the user.
- [ ] Normal single-user edits behave exactly as before.
- [ ] `updated_at` changes on every update, including updates made by RPCs and triggers.

## Tests and verification
- Vitest for the helper; manual two-tab test for each form listed.

## Open questions
- None.

## Notes for the builder
- Parent-profile upsert (`useParentProfile.saveProfile`) currently writes `updated_at` from the client clock. Let the trigger own it.
