# L5: Site security-incident runbook and access review

**Status:** 🟨 runbook drafted; review and tabletop open · **Issue:** #93 · **Priority:** P0 · **Effort:** S · **Phase:** Legal
**Depends on:** none (ships inside 19) · **Unblocks:** 19
**Plan reference:** Plan §4.1 breach row

## Why
Colorado requires notifying affected residents within 30 days of determining a breach, the Attorney General if 500+ are affected, and credit bureaus if 1,000+ 🔎 ([Mintz](https://www.mintz.com/mintz-matrix/colorado)). Today nobody is assigned and there's no procedure.

## Decided rules
- None.

## Scope: what to build
- `docs/runbooks/security-incident.md`: (1) roles: incident lead (Regional Director), technical lead, SCC national contact; hand-off into SCC's existing incident process; (2) contain: rotate Supabase keys, revoke sessions (`auth.sessions`), disable affected accounts, close registration; (3) assess with the audit log (spec 05), Supabase logs and the email-provider log, recording what data, whose, and when; (4) decide on notice: start the 30-day clock at determination, note the thresholds; (5) notice templates for families and volunteers; (6) post-incident review.
- Quarterly access review checklist: list admins (`admin_user_emails`), confirm each still needs access, MFA on (spec 27), remove leavers, rotate any shared credentials. Record each review in the runbook's log section.
- Contacts table: Supabase support, Vercel support, email provider, SCC national's contact, the Colorado AG's data-breach reporting page.

## Out of scope
- None.

## Done when
- [ ] Runbook reviewed by the Regional Director and SCC national.
- [ ] A 30-minute tabletop exercise done once before February ("a volunteer's phone with the roster open is stolen"), with notes.

## Tests and verification
- Tabletop exercise notes in the runbook.

## Open questions
- None.

## Notes for the builder
- Drafted 2026-10-17: [`docs/runbooks/security-incident.md`](../runbooks/security-incident.md). It has the roles, containment steps with exact SQL and dashboard paths, assessment queries on the audit log, Colorado notice thresholds (🔎 to confirm with SCC's legal contacts), family and volunteer notice templates, the quarterly access review, contacts (names to fill in) and the tabletop scenario. The Done-when items need people: the review by the Regional Director and SCC national, and the tabletop exercise.

## From the Discord findings (2026-11-01)

From [the Discord findings](../research/discord-findings.md). Each item was checked against `main` at `d046434`, so it asks only for what is missing.

- [ ] At every handoff: rotate shared credentials, keep 2FA on an authenticator held by two people, and keep security notices out of group chats. (Discord M01)
- [ ] An accounts-and-renewals register in the access review: domain and DNS, Supabase, Vercel, email provider, shared mailbox, social account. Each has two named owners, a renewal date and authenticator 2FA. Supabase Auth has no recovery codes, so app admin recovery stays another admin's reset (spec 27); for other services that issue recovery codes, keep them in an org password manager. The runbook already reviews shared credentials (`docs/runbooks/security-incident.md:128`). (Discord M01)
- [ ] The rule: no credentials in chat, ever. The app has no shared admin login; every lead is invited as their own admin. Admin note fields carry a "Never paste passwords here" hint. (Discord M01)
- [ ] Add phishing (emails impersonating a leader) to the runbook. (Discord safety flags)
- [ ] Run the access review in June at the summer handoff, as well as when someone leaves (`docs/runbooks/security-incident.md:121`). (Discord M35)
- [ ] Users page: invite an admin, flag accounts with no sign-in for 60 days, and a "review by" date per admin, audited. Last sign-in is already fetched (`src/hooks/useAdminUsers.ts:45`). (Discord M35)
- [ ] Volunteer access to current-season views ends with the season unless the volunteer is accepted again. (Discord M35; Q-D10)
