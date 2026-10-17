# 32: Admin register-on-behalf (late, walk-in, phone, lost form)

**Status:** ⬜ not started · **Issue:** #152 · **Priority:** P1 · **Effort:** M · **Phase:** B
**Depends on:** 05, 31 · **Unblocks:** none
**Plan reference:** [inbox findings](../research/inbox-findings.md) §1

## Why
- **Late and walk-in registrations.** Admins registered families after the deadline, mid-week, or in person on day 1 (29 threads).
- **Lost forms.** Families who believed they had registered had no record at all.
- **No way to do it in the app.** Admins can only edit existing registrations (`AdminStudents.tsx`). There's no UI or RPC to create a camper or registration, and `students.parent_id` is required, so the family needs an account.
- **Admin writes skip every rule with no reason recorded.** The insert trigger returns early for admins (`migration_one_class_per_week.sql:81-83`). The audit log has a `reason` column, but `private.set_reason` is only reachable through fixed RPCs.

## Decided rules
- Admin registrations go through one RPC that runs **the same rules as parents**. Each rule an admin skips (deadline, opening time, capacity, grade, prerequisite, same-week clash) must be named, with a free-text reason, and both are written to the audit log.
- A family without an account gets an invite email, and the registration is attached to that account.

## Scope: what to build
- **RPC `admin_register(p_parent_email, p_student_id uuid null, p_student jsonb null, p_section_id, p_source text check in ('late','walk_in','phone','recovery'), p_reason text, p_overrides text[])`:**
  - runs the trigger's checks with an "admin but not bypassing" flag
  - refuses with the list of failing rules unless each one is in `p_overrides`
  - sets `private.set_reason`
  - status is confirmed or waitlisted by capacity, unless `capacity` is overridden
- **Change the insert trigger:** admin inserts that don't come through this RPC are still allowed (for repairs) but must carry a reason. Log a warning row otherwise.
- **Invite:** an Edge Function `admin-invite-parent` (service role, admin JWT required) calls `auth.admin.inviteUserByEmail` and creates `parent_profiles`.
- **UI:** an inline "Add registration" panel on the Students page.
  - Search the parent by email, then pick an existing camper or add one, then pick a section.
  - Show `possible_duplicate_campers()` matches before creating a new camper.
  - Show the failing rules as checkboxes plus a reason field.
- **Emails:** the normal `registration_confirmed` / `_waitlisted` emails (triggers), plus the invite.

## Out of scope
- Bulk import from a spreadsheet (backlog idea).

## Done when
- [ ] An admin registers a walk-in after close in under a minute. The parent gets an invite and a confirmation.
- [ ] Skipping any rule without naming it is refused. Every override shows in History with its reason.
- [ ] The duplicate-camper check appears before a new camper is created.

## Tests and verification
- SQL: each override on its own; no override → refused; a non-admin calling the RPC → refused.
- Browser: the full flow at desktop width.

## Open questions
- Should a registration created after the waiver step (L2) be flagged until the parent signs? Default: yes, a red "waiver missing" badge on the roster.
