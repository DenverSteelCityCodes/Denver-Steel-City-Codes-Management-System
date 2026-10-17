# 27: Admin MFA

**Status:** ⬜ not started · **Issue:** #101 · **Priority:** P1 ★ · **Effort:** S · **Phase:** C
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
- Roll out before giving anyone new admin access in Phase C.
