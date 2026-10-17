# 03: Forgot password, reset page, resend confirmation

**Status:** ⬜ not started · **Issue:** #71 · **Priority:** P0 · **Effort:** S · **Phase:** A
**Depends on:** 02 · **Unblocks:** —
**Plan reference:** Plan §0 Risk 3, flow P1

## Why
There's no "Forgot password" anywhere (`resetPasswordForEmail` is never called). Returning 2026 families who forgot their password are locked out. The "Check your email" screen has no resend, and the apply form dead-ends when the email already has an account.

## Decided rules
- None.

## Scope: what to build
- `/forgot`: email field → `supabase.auth.resetPasswordForEmail(email, { redirectTo: <origin>/reset })`. Always shows "If that email has an account, we sent a link" (never reveal whether an account exists).
- `/reset`: handles the `PASSWORD_RECOVERY` auth event, a new-password field (8+, with confirm) → `supabase.auth.updateUser({ password })` → success → redirect to the role home.
- "Forgot password?" link on `/login`, under the password field.
- "Didn't get it? Resend" on the signup success screen → `supabase.auth.resend({ type: 'signup', email })`, with a 60-second cooldown shown on the button.
- Volunteer apply: when the email already has an account, show "Sign in" and "Forgot your password?" links under the message. *(Changed while building: the `?next=/apply` round trip was dropped, because the apply form creates a new account and doesn't support signed-in applicants. Supporting that is a separate change.)*
- Add `/reset` to Supabase Auth redirect URLs for prod, staging and demo.
- Expired or used reset link: a clear message plus "Send a new link".

## Out of scope
- Magic-link sign-in (P2 backlog).

## Done when
- [ ] A parent can reset their password from the login page on a phone in under 2 minutes.
- [ ] Resend works, and is rate-limited in the UI.
- [ ] No screen reveals whether an email is registered.
- [ ] Style guide, 375 px, labels linked, errors focused.

## Tests and verification
- Manual end-to-end on staging for each role (admin, parent, volunteer).
- Signup and apply now send `emailRedirectTo` (origin + `/login`), so confirmation links work from any allowed host.

## Open questions
- None.

## Notes for the builder
- Found while building (2026-10-17): the demo project's Auth **site URL was `http://localhost:3000`** with no allowed redirect URLs, so confirmation links pointed at localhost. Fixed on the demo project: site URL `https://scc.haanie.com`, allow list = that origin plus `localhost:5173–5176`. Prod (spec 01) needs the same.
- `AuthContext` already defers profile loads inside `onAuthStateChange`. Keep the reset handling inside that pattern, to avoid the supabase-js deadlock noted there.
