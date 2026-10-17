# 10: Waitlist offers with a 48-hour claim window

**Status:** ⬜ not started · **Issue:** #79 · **Priority:** P0 · **Effort:** M · **Phase:** B
**Depends on:** 05, 06, 09, 10a · **Unblocks:** 11, 12
**Plan reference:** Plan flow P6, §2.2 'full → waitlist → seat opens', §6 decisions Q-W2, Q-W2b, Q-W3, Q-N1

## Why
When a seat frees today, an admin sees "Waitlist spots opened up", picks someone by hand and sets a status. Nobody is emailed, so seats sit empty.

## Decided rules
- Offer window **48 hours**, or **12 hours** when the session starts within 7 days (values from spec 13 settings).
- Offer order: (1) campers displaced by a cancelled section that week (`displaced_from_section` set), by join time; (2) campers with **no seat that week**, by waitlist join time. Campers who hold a seat that week are **skipped** (Q-W2b), which 10a makes rare.
- Decline or expiry passes the seat to the next camper. Admins can override (offer to a specific camper, or place directly); overrides are logged.
- Accepting confirms the seat at once (auto-confirm, Q-P4) and withdraws the camper's other waitlist entries that week, telling the parent.

## Scope: what to build
- Enum value `offered` on `registration_status`; columns `offered_at`, `offer_expires_at`.
- `offered` **counts toward capacity** everywhere seats are counted: `registrations_before_insert`, `section_fill_counts()`, admin overfill notes, attention items. Rosters (spec 04) exclude it.
- `private.offer_next_seat(p_section_id)`: lock the section; while free seats > 0 and a candidate exists, pick the next candidate in the decided order, set `offered` + expiry, enqueue `waitlist_offer`. Called from AFTER triggers: registration status/section changes and deletes, `sections.capacity` raised, a section un-cancelled.
- RPCs for parents: `accept_offer(p_registration_id)` (owner, status `offered`, not expired → `confirmed`; then withdraw other same-week `waitlisted` rows with reason `took_other_seat` + `waitlist_withdrawn` email) and `decline_offer(p_registration_id)` (→ `cancelled`, reason `declined_offer`, then `offer_next_seat`).
- `pg_cron` every 10 minutes: expired offers → `cancelled`, reason `offer_expired` (+ email "You can rejoin the waitlist anytime"), then `offer_next_seat`. A reminder email (`offer_expiring`) 6 hours before expiry.
- Parent UI: the camper card shows "Spot offered in <class> · claim by Tue 3:00 pm" with inline **Accept** / **Decline** (InlineConfirm on decline). Bell item. The dashboard subhead mentions it.
- Admin UI: Students shows `offered` with a countdown; "Offer to this camper" and "Place directly" overrides. The attention item "Waitlist spots opened up" now fires only when seats are free and **no** candidate exists.

## Out of scope
- Lottery or priority windows (dropped by decision Q-R1).

## Done when
- [ ] Cancel one seat in a full section → the right camper is `offered` within seconds and emailed.
- [ ] Accept → confirmed, plus same-week waitlist entries withdrawn and emailed. Decline → the next camper is offered. Expiry → the same.
- [ ] A displaced camper jumps ahead of everyone; a camper with a seat that week is never offered.
- [ ] Capacity is never exceeded, counting offered seats, under the spec 08 concurrency test.
- [ ] Every offer, accept, decline and expiry is in the audit log with a reason.

## Tests and verification
- SQL scenario tests for each ordering rule and for expiry (set `offer_expires_at` in the past, run the sweep).
- Concurrency: 10 seats freed at once with 30 waiters → exactly 10 offers, no camper offered twice.
- Browser: parent accepts and declines on a phone; admin override.

## Open questions
- What happens on expiry: removed from the waitlist (default, as above) or moved to the back of the line? ❓ Confirm; the default is in the spec.

## Notes for the builder
- Adding an enum value can't be used in the same transaction that adds it. Split the migration.
- Remember `ParentBell`, `StudentCard` STATUS_CONFIG, `buildSubhead` and the admin status filters need an `offered` entry.
