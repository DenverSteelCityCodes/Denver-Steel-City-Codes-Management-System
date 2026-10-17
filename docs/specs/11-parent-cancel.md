# 11: Parent cancels a spot before the deadline; change requests; contact card

**Status:** ✅ [PR #126](https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/pull/126) · **Issue:** #80 · **Priority:** P0 · **Effort:** S · **Phase:** B
**Depends on:** 06, 09, 13 (10 for refilling) · **Unblocks:** 12
**Plan reference:** Plan flow P5, §2.1 rules table, §6 decision Q-W1

## Why
Parents have no UPDATE or DELETE on registrations, and no in-app way to reach the camp. Every drop is an email, and families who silently stop coming keep a seat another child could use.

## Decided rules
- Self-service cancel until **14 days before the session starts** (Q-W1). Leaving a waitlist or declining an offer is allowed any time.
- After the deadline: "Request a change", which goes to admins.
- Show `denver@steelcitycodes.org` on parent pages.

## Scope: what to build
- RPC `cancel_my_registration(p_registration_id)`: caller owns the camper. Status `confirmed/pending` needs `now() < session.start_date - change_deadline_days`, else raise P0001 with the deadline date. `waitlisted` is always allowed. Sets `cancelled`, reason `parent_cancel`, `app.reason`. The spec 10 trigger then offers the seat.
- Table `change_requests(id, registration_id, requested_by, kind check in (cancel, swap, other), message text, status check in (open, done, declined), created_at, resolved_by, resolved_at)`. RLS: parent inserts and reads own; admin all. RPC `request_change(...)`.
- Admin attention item "N change requests" → list on Students with resolve actions (each resolve logged; email to the parent).
- Camper card, per registration: "Cancel this spot" (before the deadline) → InlineConfirm: "Cancel Maya's spot in Python A, Week 1? The seat goes to the next family on the waitlist. This can't be undone by you." After the deadline: "Request a change" with an inline message box.
- "Your contact details" card on the parent dashboard: inline edit of `parent_profiles` (phone, email, emergency contact), using the spec 07 conflict check.
- Parent footer (`ParentLayout`) and every "contact the camp" message show `denver@steelcitycodes.org` as a `mailto:` link.

## Out of scope
- Swaps (spec 12).

## Done when
- [ ] A parent cancels before the deadline from a phone; gets a receipt email; the seat is offered onward (if spec 10 is merged).
- [ ] After the deadline the button is replaced by "Request a change", and the DB refuses a direct RPC cancel.
- [ ] Admins see and resolve requests; parents get an email on resolution.
- [ ] The contact email is visible on every parent page.

## Tests and verification
- SQL: deadline boundary (13 vs. 15 days out), wrong owner refused, waitlist leave always allowed.
- Browser at 375 px: cancel, request a change, edit contact details.

## Open questions
- None.

## Notes for the builder
- Built 2026-10-17. The deadline is midnight (Denver) at the start of `session start − change_deadline_days`, so with 14 days and a June 7 session, the last online-cancel day is May 23; the card says so. A both-weeks section uses the year's earliest session. In the demo both weeks start within 14 days, so seats show "Request a change". Leaving a waitlist is always allowed. Resolving a request emails the family (template `change_request_resolved`). The contact card edits `parent_profiles`; each camper keeps its own emergency contact too.
- Read the deadline from the spec 13 settings, not a constant.

## From the inbox findings (2026-10-17)
- About half of past cancellations dropped **one week of two**. Cancel works per registration (per week), with a "Which camper, which week?" choice. A cancellation must free the seat for the waitlist (10) and release any laptop (29). See [findings](../research/inbox-findings.md) §1 row 2.
