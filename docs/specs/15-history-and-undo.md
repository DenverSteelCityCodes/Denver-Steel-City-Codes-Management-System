# 15: Admin history strip and revert

**Status:** ⬜ not started · **Issue:** #84 · **Priority:** P0 (cut second if short on time) · **Effort:** M · **Phase:** B
**Depends on:** 05, 06 · **Unblocks:** —
**Plan reference:** Plan §2.1 'Undo', §0 win 4

## Why
With spec 05 every change is recorded, but admins need to see it where they work and undo a mistake without SQL.

## Decided rules
- None.

## Scope: what to build
- "History" toggle on the AdminStudents camper row and on the AdminClasses section editor: an inline list (no modal) of the last 20 changes. Each shows when, who (display name + role), and what changed (field: old → new), with friendly labels. Reasons shown as text ("Parent cancelled", "Offer expired").
- "Revert" on UPDATE entries: RPC `admin_revert(p_audit_id)`. Re-apply the old values of the changed columns **only if** the current values still equal the logged new values; else refuse ("Changed again since. Revert the newer change first"). Logged with reason `revert:<id>`.
- Revert on a soft-cancel (status → cancelled): restore the previous status if capacity allows, else refuse with the reason; admins can still place by override.
- InlineConfirm before every revert, stating the effect.

## Out of scope
- Reverting INSERTs or hard DELETEs.
- History for tables other than camper, registration and section in v1.

## Done when
- [ ] An admin can see who changed a camper's allergies and revert it in two clicks.
- [ ] Reverting a stale change is refused with a readable message.
- [ ] Reverts appear in the history themselves.

## Tests and verification
- SQL: revert happy path, stale refusal, non-admin refused.
- Browser: both screens, 375 px.

## Open questions
- None.

## Notes for the builder
- Built 2026-10-17. `admin_camper_history(student)` returns the camper's own changes plus all their registrations' changes. `admin_revert(id)` covers UPDATEs on students, registrations and sections. It never writes back `updated_at`, `cancelled_at` or `cancelled_by` (the database owns those). It refuses when any reverted field changed again since, or when restoring a seat would overfill (or land in a cancelled) section. Admin Students no longer flashes a loading skeleton on refresh, so an open History panel stays open after Revert.
- If time runs short before February, this is the second thing to cut (after 17). The log still records everything.
