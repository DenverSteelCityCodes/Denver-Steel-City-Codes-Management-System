# 05: Audit log: who changed what, when

**Status:** ⬜ not started · **Issue:** #73 · **Priority:** P0 · **Effort:** M · **Phase:** A
**Depends on:** none · **Unblocks:** 06, 10, 15, 20, 24, 28, L4
**Plan reference:** Plan §2.1 'How it's enforced', §0 Risk 5

## Why
Nothing records changes today. Admins can override anything, which is required, but nobody can answer "who changed this camper's allergies?" or undo a mistake.

## Decided rules
- Every change to tracked tables is logged with actor, time, before and after. Logs are admin-only.

## Scope: what to build
- Schema `audit` (not exposed to the API). Table `audit.log(id bigserial pk, at timestamptz default now(), actor_id uuid, actor_role text, table_name text, row_id text, action text check in (INSERT, UPDATE, DELETE), old jsonb, new jsonb, reason text)`; index on `(table_name, row_id, at desc)` and `(actor_id, at desc)`.
- Generic trigger function `audit.log_change()` (SECURITY DEFINER, pinned search_path): actor = `auth.uid()`, role = `private.auth_user_role()`, reason = `current_setting('app.reason', true)`. For UPDATE, skip the row if nothing changed.
- Attach AFTER INSERT/UPDATE/DELETE on: `students, registrations, sections, section_supports, classes, sessions, volunteers, parent_profiles, profiles` (role/display name), `form_configs, app_settings, duty_slots, duty_assignments, interview_bookings, volunteer_applications`. Log full rows; the log is admin-only.
- Helper `private.set_reason(text)` → `set_config('app.reason', $1, true)` for RPCs to label their writes.
- Admin-only read RPC `public.admin_history(p_table text, p_row_id text, p_limit int default 50)` returning entries plus the actor's display name.
- Document in the README which tables are audited and that new tables must be added.

## Out of scope
- The UI for history and revert (spec 15).
- Retention of log rows (L4).

## Done when
- [ ] A parent edit, an admin edit, a trigger-made change and a cron change each produce one log row with the right actor (cron/SQL editor: actor null, reason set).
- [ ] No non-admin can read `audit.log` by any API path; `admin_history` refuses non-admins.
- [ ] Write overhead measured: 100 registration inserts take < 20% longer than without the trigger.
- [ ] No-op updates don't create rows.

## Tests and verification
- SQL tests: impersonate parent/volunteer/admin (rolled-back transactions, same style as `camp-week-rls-tests.sql`) and assert the log contents and access.

## Open questions
- None.

## Notes for the builder
- The log contains PII (it copies rows). Treat it like the source tables: admin-only, covered by the retention schedule (L4).
