# 30: Interest list ("Notify me when registration opens")

**Status:** ⬜ not started · **Issue:** ❓ · **Priority:** P1 · **Effort:** S · **Phase:** B
**Depends on:** 09, 13 · **Unblocks:** none
**Plan reference:** [inbox findings](../research/inbox-findings.md) §1 row 5

## Why
From November to March, about 45 threads asked "when are the dates / when does registration open / add me to the list." Staff added people to lists by hand, and one parent was going by an out-of-date website.

## Scope: what to build
- A public `/notify` form with email and an optional "grade in fall" field. No account needed. `interest_signups(email citext unique per year, grade, created_at, unsubscribed_at, notified_at)`, inserted through a rate-limited RPC with a captcha-free honeypot.
- Signed-in parents get the same as a checkbox on the countdown card.
- A scheduled job enqueues "Registration opens <date>" when `registration_opens_at` is set, and "Registration is open" at the opening minute. Every email has an unsubscribe link.
- The public landing page shows season status (Upcoming / Open / Closed / Waitlist only) from `season_settings`.

## Done when
- [ ] A signup gets exactly one "dates announced" email and one "now open" email, both with a working unsubscribe link.
- [ ] Duplicate signups are merged.

## Notes
- Signups are deleted 30 days after the opening (add this to L4 retention).
