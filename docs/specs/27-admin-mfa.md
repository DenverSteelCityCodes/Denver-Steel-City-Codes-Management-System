# 27: Admin MFA

**Status:** 🟨 built; real-phone authenticator check open · **Issue:** #101 · **Priority:** P1 ★ · **Effort:** S · **Phase:** C
**Depends on:** none · **Unblocks:** L5 access review
**Plan reference:** Plan §2.4 privacy bullets; §3 rank 13

## Why
Admins can see every child's medical information and every family's contact details, so a phished admin password is the worst-case breach.

## Decided rules
- None.

## Scope: what to build
- Supabase Auth MFA (TOTP) enrollment flow: QR code, verify, recovery codes.
- Admins must enroll: an admin without MFA is sent to enrollment on sign-in. RLS for admin-only data checks `auth.jwt()->>'aal' = 'aal2'` (assurance level), so the API enforces it too.
- Optional for parents and volunteers.
- Admin recovery: another admin can reset a colleague's MFA (logged).

## Out of scope
- None.

## Done when
- [ ] No admin data is readable with only a password (API test at `aal1` is refused).
- [ ] Enrollment works on iOS and Android authenticator apps.

## Tests and verification
- SQL: admin policies at aal1 vs aal2.

## Open questions
- None.

## Notes for the builder
- Built 2026-10-17 (`migration_admin_mfa.sql` plus the change to `private.auth_user_role()` in `migration_security_hardening.sql`):
  - An admin below `aal2` gets no role from `auth_user_role()`, so every admin policy and admin RPC refuses them. They can still read their own profile, which the app uses for routing.
  - `MfaGate` sends them to `/mfa`: enrol with a QR code or manual key on the first sign-in, enter a code afterwards.
  - Admin → Users shows each admin's status. "Reset" removes a colleague's authenticator and signs them out (`admin_reset_mfa`, never your own, logged in `audit.log` with reason `mfa_reset`).
- **Switch:** `app_settings.admin_mfa_required`. It's required unless set to `'false'`. The public demo sets it to `'false'` in `reset_demo()`, because its one-click admin can't do TOTP. **Production gets `'true'` from the migration, so admins enrol at their next sign-in after spec 01 applies it.**
- **Recovery codes:** Supabase Auth has none. The recovery path is another admin's reset. Keep at least two admins, and admins can add a second authenticator app. Plan to look again when Supabase adds codes.
- **Not built (follow-up):** optional two-step sign-in for parents and volunteers.
- **SQL tests that impersonate an admin** need `'aal': 'aal2'` in `request.jwt.claims` wherever the switch is on (the demo has it off).
- **Verified:**
  - `test-plans/admin-mfa-tests.sql`, 12/12;
  - the browser, with the switch briefly on for the demo: enrolment and the code step, using RFC 6238 codes computed in the page; a wrong code is refused.
- Still to check by hand: a real iPhone and Android authenticator app scanning the QR code.
- Roll out before giving anyone new admin access in Phase C.
