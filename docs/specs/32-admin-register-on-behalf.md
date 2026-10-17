# 32: Admin register-on-behalf (late, walk-in, phone)

**Status:** ⬜ not started · **Issue:** ❓ · **Priority:** P1 · **Effort:** S · **Phase:** B
**Depends on:** 05, 13 · **Unblocks:** none
**Plan reference:** [inbox findings](../research/inbox-findings.md) §1 row 9

## Why
About 15 threads asked to register after the deadline, mid-week, or on day 1, and one family was added in person in the admin room. Four families who believed they had registered had no record at all. Admins need to create a registration for a family directly, without the parent's login.

## Scope: what to build
- An admin "Add registration" flow on the Students page. Pick or create the parent (by email; send an invite if they have no account), pick or create the camper, pick the section.
- The flow skips the opening time and deadlines (13) and, with a confirmation, the seat cap. It does not skip the grade rules (31) unless an override reason is given.
- A required `source` (late / walk-in / phone / recovery) and a note, both written to the audit log.
- The confirmation email goes to the parent with a link to finish the waiver (L2) if it's unsigned. A camper without a signed waiver shows a red badge on the roster.

## Done when
- [ ] An admin registers a walk-in after close in under a minute, and the parent gets a confirmation email plus a waiver link.
- [ ] Every over-cap or override registration appears in History with its reason.
