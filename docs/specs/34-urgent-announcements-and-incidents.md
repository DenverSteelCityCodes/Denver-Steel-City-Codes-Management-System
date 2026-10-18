# 34: Urgent announcements, week audiences, incident log and roll-call notes

**Status:** 🟨 in progress (built on `feat/spec-34-urgent-announcements`) · **Issue:** #154 · **Priority:** P1 · **Effort:** M · **Phase:** B
**Depends on:** 09's announcements follow-up (Also email through the outbox), 05 ✅ · **Unblocks:** none
**Plan reference:** [inbox findings](../research/inbox-findings.md) §2

## Why
Incidents were rare (4 threads) but each was serious:
- a police "hold" at the host school during week 2
- a camp-wide bullying notice, where a camper's parent heard about their child from a neighbour, not from staff
- a volunteer showing an unsuitable video during a break

There are also 17 attendance threads (late arrival, early pickup, missed days).

Today:
- **Updates page audiences** are everyone, parents, volunteers or one section (`UpdateComposer.tsx:95-98`). There's no "this week's families".
- **"Also email"** opens the admin's mail app with a BCC list (`lib/mailto.ts:15-22`). Spec 09 plans to move it to the outbox.
- **The sender is first-in, first-out at 50 per minute** (`send-notifications/index.ts:27`), so an urgent message would wait behind a queue.
- **No incident record** exists.
- **`roll_call_marks.note` exists but no screen writes it** (`useRollCalls.ts:55`).

## Decided rules
- Urgent announcements are safety notices. They go first, ignore the marketing opt-out, and also show as a banner on parent and volunteer dashboards until the end of the day.
- Incidents are visible to admins. A volunteer can log one for their own section and see only their own entries.

## Scope: what to build
- **Audiences:** add "Families in week N" and "Crew in week N" (from `sessions`). Every family audience is limited to the current season (also fixes the past-years bug, filed separately).
- **Urgent:**
  - `updates.urgent bool`
  - `notifications.priority smallint default 0`, with the sender ordering by `priority desc, created_at`
  - for urgent sends, use the provider's batch endpoint so 300 families go out within 2 minutes
  - templates `urgent_notice`, plus prewritten bodies: site hold, weather, early dismissal
- **Incidents:**
  - `incidents(id, section_id, student_id null, occurred_at, kind text check in ('injury','behavior','conduct','safety','other'), level text check in ('note','warning','admin_room','written_notice'), description, reported_by, parent_notified_at, created_at)`
  - RLS: the crew of the section inserts and reads their own entries; admins read and update all.
  - Audited.
  - "Notify parent" enqueues `incident_notice` and stamps `parent_notified_at`.
  - An attention item for incidents with a camper but no parent notice after 24 h.
- **Roll-call notes:** quick tags on `RollCallRow` (Late, Left early, Picked up by…) that write `roll_call_marks.note`. They show on the admin attendance board and the CSV.

## Out of scope
- SMS (backlog B1).
- Incident reports to national (national's process; see L5).

## Done when
- [ ] An urgent update reaches every guardian of the week within 2 minutes, one email each, and shows as a dashboard banner.
- [ ] "Families in week 2" reaches only that week's families for this season.
- [ ] A volunteer logs an incident for their own section only. Notifying the parent is recorded.
- [ ] Late and early tags appear on the board and in the CSV.

## Tests and verification
- SQL: incident RLS (own section, other section, admin). Sender order with mixed priorities.
- Browser: compose an urgent update, then check the banner on a parent account.

## As built (2026-10-18)
- **Migration:** `migration_urgent_and_incidents.sql` (step 36 in `docs/database.md`), applied to the demo. Tests: `test-plans/urgent-incidents-tests.sql` (49 checks) and `src/lib/__tests__/spec34.test.ts`, `notificationTemplates.test.ts`.
- **Week audiences** are `updates.session_id` with `week_families` / `week_crew`. A section is in a week when tied to it or running both weeks; families are counted in that session's year. Week crew also read what that week's families were told. Addresses for "Also email": `week_recipient_emails()` (admins).
- **Urgent:** admins only (a lead's policy refuses `urgent`). A trigger queues one `urgent_notice` per person in the audience at priority 1, one per address, ignoring `email_opt_out`. The sender claims urgent rows first (`claim_urgent_notifications`, up to 300) and sends them 100 per call through Resend's batch endpoint; `claim_notifications` orders by priority, then age. The composer asks once, inline, before sending, and offers the three prewritten starts. The red banner shows on parent Home and volunteer Today until midnight Denver time.
- **"Also email"** for ordinary posts still opens the admin's mail app: moving it to the outbox is spec 09's follow-up, not this spec.
- **Incidents:** crew log from Classes (own section, own name, a camper holding a seat, the last 14 days) and read only their own entries; admins read and update all on Attendance › Incidents. `notify_incident_parent()` is admins only, once per entry, and emails the admin's own message, never the crew's description. Attention item after 24 h. No client deletes.
- **Roll-call notes:** an "Add notes" mode on the roll call (Late, Left early, Picked up by …) writing through `set_roll_call_note()`, so who marked the camper stays. Shown under the camper on the board, on Unaccounted now, and in the CSV's Notes column.

## Open questions
- How long are incident records kept? ❓ (L4). Default: 1 year after the season, then anonymize the camper link.
