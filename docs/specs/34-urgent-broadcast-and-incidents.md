# 34: Urgent broadcast and incident log

**Status:** ⬜ not started · **Issue:** ❓ · **Priority:** P1 · **Effort:** M · **Phase:** B
**Depends on:** 05, 09 · **Unblocks:** none
**Plan reference:** [inbox findings](../research/inbox-findings.md) §2 emergencies, behavior

## Why
- **Emergency notices:** a swatting "hold" and a secure-perimeter notice at the host school meant emailing every family that day, by hand.
- **Incidents:** a peer injury complaint escalated. The behavior policy (warning → admin room → written notice) existed only in emails.

## Scope: what to build
- **Broadcast:** an admin picks an audience (this week's guardians, one section's guardians, all volunteers on shift) and writes a message. It's marked urgent and sent first, ahead of the normal outbox queue. Each recipient gets a separate email (never a visible list). Sends are logged with delivery counts and bounces. Templates: "Site hold", "Weather", "Early dismissal".
- **Incidents:** `incidents(id, student_id null, section_id, occurred_at, kind enum('injury','behavior','safety','other'), level enum('note','warning','admin_room','written_notice'), description, reported_by, parent_notified_at)`. Volunteers can create one for their own section; only admins read them all. "Notify parent" sends a templated email and stamps `parent_notified_at`.
- Incidents are kept per L4 retention (default: 1 year after the season) ❓.

## Done when
- [ ] An urgent broadcast reaches every guardian of the week in under 2 minutes, with no shared recipient list.
- [ ] A volunteer can log an incident only for their own section. The parent notification is logged.
