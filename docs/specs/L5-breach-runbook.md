# L5: Security-incident runbook and access review

**Status:** ⬜ not started · **Issue:** #93 · **Priority:** P0 · **Effort:** S · **Phase:** Legal
**Depends on:** none (ships inside 19) · **Unblocks:** 19
**Plan reference:** Plan §4.1 breach row

## Why
Colorado requires notifying affected residents within 30 days of determining a breach, the Attorney General if 500+ are affected, and credit bureaus if 1,000+ 🔎 ([Mintz](https://www.mintz.com/mintz-matrix/colorado)). Today nobody is assigned and there's no procedure.

## Decided rules
- None.

## Scope: what to build
- `docs/runbooks/security-incident.md`: (1) roles: incident lead (Regional Director), technical lead, national contact, counsel; (2) contain: rotate Supabase keys, revoke sessions (`auth.sessions`), disable affected accounts, close registration; (3) assess with the audit log (spec 05), Supabase logs and the email-provider log, recording what data, whose, and when; (4) decide on notice: start the 30-day clock at determination, note the thresholds; (5) notice templates for families and volunteers; (6) post-incident review.
- Quarterly access review checklist: list admins (`admin_user_emails`), confirm each still needs access, MFA on (spec 27), remove leavers, rotate any shared credentials. Record each review in the runbook's log section.
- Contacts table: Supabase support, Vercel support, email provider, counsel, the Colorado AG's data-breach reporting page.

## Out of scope
- None.

## Done when
- [ ] Runbook reviewed by the Regional Director and counsel.
- [ ] A 30-minute tabletop exercise done once before February ("a volunteer's phone with the roster open is stolen"), with notes.

## Tests and verification
- Tabletop exercise notes in the runbook.

## Open questions
- None.

## Notes for the builder
- None.
