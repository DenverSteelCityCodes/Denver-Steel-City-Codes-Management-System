# 26: Admin guide, architecture doc, new-chapter legal checklist

**Status:** ⬜ not started · **Issue:** #100 · **Priority:** P1 ★ · **Effort:** M · **Phase:** C
**Depends on:** 20–23 · **Unblocks:** handoff
**Plan reference:** Plan §2.4 docs table

## Why
The national team has to run, extend and hand this to new chapters without the people who built it.

## Decided rules
- None.

## Scope: what to build
- `docs/admin-guide.md`: season setup checklist (sessions → classes → sections → schedule → forms → waivers → opening time), registration day (links the runbook), camp week (roll calls, updates, attendance board, print rosters), wrap-up (exports, retention). With screenshots.
- `docs/architecture.md`: diagram, data model, where each rule is enforced (trigger/RLS/RPC), the email pipeline, environments, deploys.
- `docs/legal/new-chapter-checklist.md`: the site settings a new chapter fills in from SCC's own policies (waiver text, privacy notice, clearance requirements if used, time zone, contact email), and the state rules that affect the site (breach-notice timing, minors' privacy). Org-level compliance stays with SCC.
- `docs/specs/` kept current: move done specs to an `archive/` subfolder with their PR links.

## Out of scope
- None.

## Done when
- [ ] Someone who didn't build the app sets up a new test chapter's season using only the admin guide (watch them do it; fix where they get stuck).

## Tests and verification
- None.

## Open questions
- None.

## Notes for the builder
- None.
