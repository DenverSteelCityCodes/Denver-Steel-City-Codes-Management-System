# 12: Parent switches class within the same week

**Status:** ⬜ not started · **Issue:** #81 · **Priority:** P0 · **Effort:** M · **Phase:** B
**Depends on:** 10, 11 · **Unblocks:** —
**Plan reference:** Plan flow P5, §6 decisions Q-W1 and Q-W4

## Why
Switching classes needs an admin today. A self-swap before the deadline saves admin time, and it's something comparables like Sawyer and ActivityHero route through staff, so it sets us apart.

## Decided rules
- Before the 14-day deadline only; same week only.
- Only into a section with a **free seat**. Because same-week backups are blocked (Q-W4), a camper holding a seat can't waitlist for a full class. The UI says: "Python B is full. To join its waitlist you'd need to cancel your spot in A first."

## Scope: what to build
- RPC `swap_my_registration(p_registration_id, p_target_section_id)`: owner; source status `confirmed/pending`; deadline check on **both** sessions; target in the same week (same rule as the week-clash check, including both-weeks sections); camper eligible for the target (age; grade rule, until spec 23 moves it to the DB, checked here in SQL for the microcontrollers rule). Lock both sections **in id order** (avoids deadlock). If the target has a free seat: update the registration's `section_id` (same row, so history stays together), status `confirmed`. Then `offer_next_seat(source)`. If full: raise P0001 with the message above.
- Camper card: "Switch class" → inline list of eligible same-week sections with spots left (fresh `section_fill_counts`) → InlineConfirm → result.
- Email `registration_moved` to the parent (spec 09 trigger already covers section changes).

## Out of scope
- Cross-week swaps (cancel + register instead).

## Done when
- [ ] Swap succeeds into a free seat; the source seat is offered onward; one email to the parent.
- [ ] Two parents swapping into the last seat at once: exactly one succeeds; the other gets the full message.
- [ ] Ineligible or after-deadline swaps are refused by the DB with readable reasons.

## Tests and verification
- SQL concurrency test (two swaps, one seat); deadlock test (A→B and B→A at once).

## Open questions
- None.

## Notes for the builder
- Built 2026-10-17 (`migration_parent_swap.sql`). `my_swap_options()` lists the other same-week classes the camper fits (age band, the Microcontrollers grade rule matched by class name like `courseConstraints.ts`, no clash with a seat in the other week for a both-weeks section) with live spots left. Full ones are listed too, so the card can explain why they can't be picked. `swap_my_registration()` re-checks everything under the locks (the camper's advisory lock, then both sections in id order). It checks the earlier of the two classes' deadlines and moves the same row (audit reason `parent_swap`). The spec 10 trigger offers the freed seat; the spec 09 trigger sends one `registration_moved` email.
- Concurrency was verified with two real connections: see `test-plans/parent-swap-concurrency.md`.
- The admin move (`moveStudentToSection`) bypasses these checks on purpose. Leave it, but log it (spec 05).
