# 26: Admin guide, architecture doc, new-region legal checklist

**Status:** ⬜ not started · **Issue:** #100 · **Priority:** P1 ★ · **Effort:** M · **Phase:** C
**Depends on:** 20–23 · **Unblocks:** handoff
**Plan reference:** Plan §2.4 docs table

## Why
The national team has to run, extend and hand this to new regions without the people who built it.

## Decided rules
- None.

## Scope: what to build
- `docs/admin-guide.md`: season setup checklist (sessions → classes → sections → schedule → forms → waivers → opening time), registration day (links the runbook), camp week (roll calls, updates, attendance board, print rosters), wrap-up (exports, retention). With screenshots.
- `docs/architecture.md`: diagram, data model, where each rule is enforced (trigger/RLS/RPC), the email pipeline, environments, deploys.
- `docs/legal/new-region-checklist.md`: the site settings a new region fills in from SCC's own policies (waiver text, privacy notice, clearance requirements if used, time zone, contact email), and the state rules that affect the site (breach-notice timing, minors' privacy). Org-level compliance stays with SCC.
- `docs/specs/` kept current: move done specs to an `archive/` subfolder with their PR links.

## Out of scope
- None.

## Done when
- [ ] Someone who didn't build the app sets up a new test region's season using only the admin guide (watch them do it; fix where they get stuck).

## Tests and verification
- None.

## Open questions
- None.

## Notes for the builder
- None.

## From the Discord findings (2026-11-01)

From [the Discord findings](../research/discord-findings.md). Each item was checked against `main` at `d046434`, so it asks only for what is missing.

- [ ] "Start next season" next to spec 13's settings: copy classes with their rules (31), sections with capacity and room but no crew, duty types and rules (37, 38), onboarding tasks (35), crew FAQ and day defaults (40), and email and form text. Shift dates by a year, leave registration closed and the opening time empty, and copy no family or volunteer data. Built before go-live like everything else (Q-G1); first used in summer 2027. (Discord M12)
- [ ] Season notes: free text the next team reads (rooms used, tools, contacts, what went wrong). (Discord M12)
- [ ] A dated season calendar in the guide: venue by February, registration mid-March, volunteer applications close about the 2nd week of May, interviews mid-May, orientation the Friday before camp, camp the first two weeks of June, hours letters by the end of June. (Discord M12)
- [ ] A year-end handoff checklist with named owners: transfer account ownership, remove leavers, invite successors, run the L5 access review in June. The setup and wrap-up checklists in Scope gain these. (Discord M12, M35)
- [ ] Prior seasons stay readable to admins, with CSV exports, within L4's limits. (Discord M12)
- [ ] The accounts-and-renewals register and the rule "no credentials in chat, ever" (with L5). (Discord M01)
- [ ] Run the shared address as a collaborative inbox with individual logins (assign and resolve), with no shared password or one-phone 2FA, and keep inbox notifications out of group chats. (Discord M17)
- [ ] State that the camper cap is per week and that unique campers are counted separately. (Discord M30; Q-D7)
- [ ] Camp photos: one shared per-day folder, an upload deadline and posting rules. The app stores no camp photos. (Discord M06)
- [ ] How to export post-camp survey results for reports. (Discord M55)
