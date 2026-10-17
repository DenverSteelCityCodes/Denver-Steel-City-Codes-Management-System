# 02: Custom SMTP, branded auth emails, rate limits, leaked-password protection

**Status:** ⬜ not started · **Issue:** #70 · **Priority:** P0 · **Effort:** S · **Phase:** A
**Depends on:** 01 · **Unblocks:** 03, 09
**Plan reference:** Plan §0 Risk 1, §2.3 'what breaks first' #1–2

## Why
New accounts must confirm by email, and Supabase's built-in sender is capped at 2 emails/hour and only delivers to organization members ([docs](https://supabase.com/docs/guides/auth/auth-smtp)). On opening night almost no parent would get their confirmation link.

## Decided rules
- Official chapter address: `denver@steelcitycodes.org` is the **reply-to**.
- Sender: a `steelcitycodes.org` address, e.g. `Steel City Codes Denver <no-reply@steelcitycodes.org>` (needs DNS records, Q-H5).

## Scope: what to build
- Pick a provider (Resend, Postmark or Amazon SES; Resend or Postmark is simplest). Create the account under national's ownership.
- Verify the sending domain: SPF, DKIM, and a DMARC record at least `p=none`.
- Supabase prod → Auth → SMTP settings: host, port, user, password, sender name and address.
- Branded templates (logo, cream/gold, Josefin via web-safe fallback) for confirm signup, reset password, magic link and email change. Plain-text versions too. Every template ends with "Questions? Reply to this email or write to denver@steelcitycodes.org."
- Raise the Auth email rate limit (Auth → Rate limits) to cover the spike (e.g. 1,000/hour); note the per-IP sign-in/sign-up limit, which spec 19 sets for registration week.
- Turn off link tracking in the provider, so confirmation links aren't rewritten.
- Turn on leaked-password protection (Pro feature); set the server-side minimum password length to 8, matching the signup form.
- Do the same on the staging/demo project, so demo signups work too.

## Out of scope
- App notification emails (spec 09). This spec is only Supabase Auth's own emails.

## Done when
- [ ] 50 signups to test inboxes within 10 minutes all arrive within 1 minute each.
- [ ] mail-tester.com score ≥ 9/10; SPF and DKIM pass.
- [ ] Templates look right in Gmail on a phone and in Outlook; the reply-to is `denver@steelcitycodes.org`.
- [ ] A known-leaked password (e.g. `password123`) is refused at signup.
- [ ] Settings are recorded in the README (no secrets).

## Tests and verification
- Manual: signup, reset and email-change flows end to end on staging.

## Open questions
- Q-H5 DNS access. Default if blocked: send from the provider's shared domain temporarily, with reply-to `denver@steelcitycodes.org`, and switch once DNS is set.

## Notes for the builder
- Store SMTP credentials only in the Supabase dashboard, never in the repo.
