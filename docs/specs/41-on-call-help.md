# 41: On-call help from volunteer Today

**Status:** ⬜ not started · **Issue:** — · **Priority:** P1 · **Effort:** S · **Phase:** B
**Depends on:** 37 🟨 and 38 🟨 (duty slots), 39 ⬜ (week roles), 34 🟨 (incidents), 09 🟨 (outbox) · **Unblocks:** none
**Plan reference:** [Discord findings](../research/discord-findings.md) M48 (also M41, M45)

## Why
- **Help requests went into busy volunteer chat (17 conversations, 2021–2026):** a behaviour problem, a locked classroom, broken computers, a missing cable or supplies.
- **They waited.** Help requests sat unanswered for hours, and locked rooms waited while volunteers asked in chat for someone to come.
- **Nobody knew who to call.** Leads posted personal contact details in chat.
- **What the app already has:** admins can create an "On-call" duty type and slots (`migration_duties.sql:6`, `:22`), and crew can log incidents for their section (`migration_urgent_and_incidents.sql:288`). Nothing routes a request to a person or tracks a response. Urgent notices are admin-only by design (spec 34), so volunteers must not get broadcast rights.

## Decided rules
- A help request goes to whoever holds **today's on-call duty slot**. If nobody does, it goes to every admin.
- It stays open on the admin attention list until someone taps **On my way**. The volunteer sees who is coming.
- Injury requests always go to every admin as well as the on-call holder.
- A help request is not an incident. An admin can turn it into one.

## Scope: what to build
- **`duty_types.is_on_call BOOLEAN NOT NULL DEFAULT false`.** Admins tick it on one or more types. Slots work as in specs 37 and 38 (minutes, locks, minimums).
- **`help_requests(id, section_id null, requested_by, kind text check in ('behavior','injury','room','tech','supplies','other'), note text check length ≤ 300, created_at, acknowledged_by null, acknowledged_at null, resolved_at null, incident_id null)`.**
  - RLS: the requester reads their own; admins read and update all; today's on-call holders read today's rows. No direct insert. Audited.
- **`request_help(p_section_id, p_kind, p_note)`** (SECURITY DEFINER): the caller must be crew of that section, or hold a week role or a duty slot, today. At most one open request per section and kind (a second tap returns the open one).
- **Notification:** `help_request` email at priority 1 (spec 34's urgent lane) to today's on-call holders, or every admin when there are none; injury always adds every admin. One per person, deduplicated.
- **Escalation:** a request with no "On my way" after N minutes (default 5) is sent to every admin who hasn't had it yet (pg_cron, every minute while a camp day is running).
- **`acknowledge_help(p_id)`** (admin or today's on-call holder) sets "On my way" and the name; **`resolve_help(p_id)`** closes it.
- **Admin:** an attention item "Help needed: Room 104, behaviour, 3 min ago" at the top of the dashboard and bell (refreshed every 30 seconds while a camp day is running), with **On my way**, **Done** and **Make it an incident** (pre-fills spec 34's form with section and kind; kinds map `behavior` → `behavior`, `injury` → `injury`, and `room`, `tech`, `supplies`, `other` → `other`; the admin picks the section when the request has none, since incidents need one). When a camper is linked later, the admin sees their incident count this week (spec 34 follow-up, M41).
- **Volunteer Today:** a **Need help** button on the section card. One tap opens the kinds as large buttons labelled from the kind values (Behaviour, Injury, Room, Tech, Supplies, Other) and an optional note; after sending, the card shows "Sent 10:42 · waiting" and then "On the way: <preferred name>". Spec 35's `on_duty_phone` setting (read only, M45) shows under it as a fallback, never a personal number.
- **Demo seed:** an "On-call" type with today's slot held by the demo admin.
- **Help:** volunteer and admin topics.

## Out of scope
- SMS or push notifications (B1, Q-D13).
- Chat integration.
- Fixing the building problem itself (the host school's job).
- Volunteer-to-volunteer requests.

## Done when
- [ ] A crewed volunteer sends a Room request (kind `room`) from Today in two taps, and today's on-call holder gets one email and sees it on the dashboard.
- [ ] With no on-call slot held today, every admin gets it. An injury always reaches every admin.
- [ ] Tapping On my way shows the name on the volunteer's Today; Done clears the attention item.
- [ ] A volunteer who is neither crew of that section nor holds a week role or a duty slot today is refused by the database, and so is a parent.
- [ ] A request with no On my way after the escalation time (default 5 minutes) goes once to every admin who hasn't had it.
- [ ] Make it an incident opens spec 34's form pre-filled with the mapped kind and links the two.
- [ ] `test-plans/on-call-help-tests.sql` prints only `ok`; the template renders. Checked at 375 px, light and dark.

## Tests and verification
- SQL: `request_help()` permissions (section crew today, week role, duty holder, other volunteer, parent); routing with and without an on-call slot; injury routing; escalation after N minutes, once per admin; RLS on reads; one open request per section and kind.
- Browser: the button and status on Today at 375 px, one-handed.

## Deploy note
Deploy `send-notifications` (one new template) before applying the migration.

## Open questions
- How long before an unanswered request escalates to every admin? ❓ Default: 5 minutes, an admin setting.
- Should the requester be able to cancel ("sorted, never mind")? ❓ Default: yes, which resolves it.
