# 29: Laptop loans

**Status:** ⬜ not started · **Issue:** ❓ · **Priority:** P0 · **Effort:** M · **Phase:** B
**Depends on:** 09, 13 · **Unblocks:** none
**Plan reference:** [inbox findings](../research/inbox-findings.md) §1 row 4

## Why
Laptop loans were the most common topic in the 2025–26 inbox (about 70 threads). Districts collect school laptops in May, after families have registered, so demand jumps right after the kickoff email. There are 10–30 loaners, borrowed from the host school. They're given out first come first served and must stay on site. Today `students.laptop_available` is one boolean per camper. It can't be changed after registering, has no cap, and the parent never sees a status. One approved loaner never reached the class.

## Decided rules
- A loan is per camper, per week. Parents can request or withdraw one until the session starts.
- Each week has a loaner inventory cap set by an admin. Requests beyond the cap join a FIFO laptop waitlist.
- Loaners stay on site (shown in the request copy).
- Any device with a browser and a keyboard works (Chromebook ok; an iPad only with a keyboard). Show this before the request button.

## Scope: what to build
- `laptop_loans(id, registration_id fk, status enum('requested','reserved','waitlisted','released','returned'), requested_at, decided_at, updated_at)`, one per registration. `season_settings.laptops_per_week int` (per session if 22 lands).
- RPC `request_laptop(registration_id)` reserves a laptop if the week has one free, otherwise waitlists. `release_laptop()` frees it and promotes the next request (FIFO). Cancelling a registration (06/11) releases its loan.
- Parent camper card: "Laptop: Reserved / On the waitlist (#3) / Not needed" with a Request or Release button. The wizard step asks "Will your camper need to borrow a laptop?"
- Volunteer roster (04 `section_roster`) gets a 💻 column. Admin: a per-week inventory count, and a list with a hand-out checkbox for day 1.
- Outbox emails: reserved, waitlisted, promoted, released.
- Migrate `students.laptop_available = false` into 2027 requests only when the parent re-confirms. Then drop the column.

## Out of scope
- Asset tags per physical laptop.

## Done when
- [ ] The (cap+1)th request is waitlisted. A release promotes the next one and emails them.
- [ ] Cancelling a registration releases its laptop.
- [ ] Lead teachers see who gets a loaner on the roster. Parents see the status on the camper card.

## Tests and verification
- SQL: a race test with 2 concurrent requests for the last laptop. A release cascade.

## Open questions
- The 2027 loaner count, and whether the host school lends them again ❓ (Regional Director).
