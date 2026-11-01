# 37: Duty sign-ups lock close to the day

**Status:** 🟨 in review · **Issue:** #204 · **Priority:** P0 · **Effort:** S · **Phase:** B (before go-live)
**Depends on:** 05 ✅, 35 ✅ · **Unblocks:** 38
**Plan reference:** V4 (duty slots); decided by the Regional Director 2026-10-19

## Why
- **Volunteers can drop a duty at any time.** `volunteer_manage_own_duties` (`migration_duties.sql:68`) is `FOR ALL` on the volunteer's own rows, so the morning of a duty a volunteer can delete their claim. The only server check is the capacity trigger (`migration_security_hardening.sql:239`). The Duties tab shows **Cancel** on every upcoming duty, today's included. Checked on the demo DB 2026-10-19.
- **Past dates are open too.** The database accepts a claim on, or a drop from, a slot that already happened. Once hours certificates (B2) read duty records, a volunteer could add hours they never did or erase ones they did.
- **Admins can't freeze a slot.** Some duties (the first morning's check-in, a field-trip day) need a fixed crew that volunteers shouldn't change.

## Decided rules (2026-10-19)
- **Dropping locks 3 days before the duty** (Denver date). A Friday duty can be dropped until Monday; from Tuesday it's locked. The number of days is a per-year setting (default 3).
- **Signing up late stays open** up to and including the day itself, because that helps cover gaps. A late sign-up is locked at once, and the button says so before the tap.
- **Admins can lock a specific slot.** A locked slot can't be joined or dropped by volunteers, whatever the date.
- **No changes to past slots** by volunteers.
- **Admins can change anything**, any time (the audit log records it).
- After the lock, a volunteer who can't make it uses **Tell the camp** (crew absences, spec 25), and an admin sorts out cover.

## Scope: what to build
- **`duty_settings`** (one row per camp year, like `season_settings`): `year PK, drop_lock_days SMALLINT NOT NULL DEFAULT 3 CHECK 0–30, updated_at`. Everyone signed in can read it (the UI explains the lock); admins write. Audited. `private.duty_settings_for(year)` returns defaults when there's no row.
- **`duty_slots.locked BOOLEAN NOT NULL DEFAULT false`.** Admin-only (existing admin policy).
- **One trigger** on `duty_assignments` (BEFORE INSERT OR DELETE) that applies only when a signed-in non-admin acts. Jobs and admins skip it:
  - Insert: refused on a past slot or a locked slot.
  - Delete: refused on a past slot, a locked slot, or when fewer than `drop_lock_days + 1` days remain.
  - Messages in plain words ("This duty is locked. Use Tell the camp if you can't make it.").
- **Volunteers can't UPDATE assignments at all.** `volunteer_manage_own_duties` (FOR ALL) is replaced by an INSERT policy and a DELETE policy. The capacity trigger's UPDATE case stays as a safety net for admins.
- **Volunteer Duties tab** (same structure as #162, restyle only):
  - A duty you're on inside the lock (or on a locked slot) shows "Locked" instead of **Cancel**, with "Can't make it? Tell the camp".
  - An open slot inside the lock window shows "You can't drop this one later" next to **Sign up**.
  - A locked slot with room shows "Locked" instead of **Sign up**.
- **Admin Duties grid:** each slot gets a **Lock** / **Unlock** link next to Delete, and a lock mark when locked. The page explains the drop rule once: "Volunteers can drop a duty until 3 days before".
- **Help:** volunteer "Sign up for a duty, or drop one" and admin duties topics updated.

## Out of scope
- Swapping a duty with another volunteer (backlog B5).
- Reminder emails for duties (backlog B5).
- The weekly minimum (spec 38).

## Done when
- [ ] As a volunteer: dropping a duty 3 or fewer days out is refused by the database (not just hidden), and so is dropping or joining a past slot.
- [ ] As a volunteer: a locked slot can't be joined or dropped. As an admin: it can.
- [ ] As a volunteer: `PATCH duty_assignments` changes nothing.
- [ ] Signing up for tomorrow's duty works and is shown as locked right away.
- [ ] `private.reset_demo()` still seeds duties (it runs without a user, so the trigger skips it).
- [ ] `test-plans/duty-locks-tests.sql` prints only `ok`.
- [ ] Checked at 375 px, light and dark, as volunteer and admin.

## Tests and verification
- SQL: the matrix above (volunteer insert/delete × past / inside lock / outside lock / locked slot; admin bypass; update blocked; no-user job bypass).
- Browser: the volunteer Duties tab on the demo (Week 1 is the current week, so today's and tomorrow's duties are inside the lock).
