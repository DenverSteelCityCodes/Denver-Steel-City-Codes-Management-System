# L4: Retention policy and nightly anonymize job

**Status:** ⬜ not started · **Issue:** #92 · **Priority:** P0 (policy) / P1 (job) · **Effort:** S · **Phase:** Legal
**Depends on:** 05, counsel sign-off on plan §4.3 · **Unblocks:** 28
**Plan reference:** Plan §4.3 retention schedule; §4.1 disposal row

## Why
Nothing is ever deleted. 🔎 Colorado requires a written disposal policy for personal information, and keeping minors' data forever is a risk in itself. Some records (waivers, attendance, incident notes) must be kept long enough to defend a claim, which can run past a minor's 18th birthday.

## Decided rules
- The schedule is plan §4.3, once counsel signs it off.

## Scope: what to build
- `docs/legal/retention-policy.md`: the schedule, who runs it, and how holds work (an admin can put a family on legal hold, which pauses deletion).
- `students.legal_hold boolean`, `parent_profiles.legal_hold boolean` (admin-only writes).
- `private.apply_retention(p_dry_run boolean)`: per the schedule, clear medical text 90 days after the last session; anonymize camper profiles 2 years after the last session (keep year, grade and class for reporting); delete parent accounts 2 years after their last camper's session; delete volunteer applications per schedule; keep waivers/consents, roll calls and camper audit rows until the camper's 21st birthday (computed from grade-derived age; 🔎 counsel to set). Skips holds. Logs reason `retention`.
- `pg_cron` nightly, but ship in **dry-run** mode first: it writes a report table (counts per rule) for an admin to review, and is switched to live by a setting.

## Out of scope
- Backups: rows deleted here survive in backups until those expire (7 days on Pro, longer with PITR). Say so in the privacy notice.

## Done when
- [ ] Policy document approved and linked from the privacy notice.
- [ ] Dry run on staging reports sensible counts; a live run on staging deletes/anonymizes exactly those rows; held families are untouched.
- [ ] Aggregate reports still work after anonymization.

## Tests and verification
- SQL scenario tests with backdated sessions.

## Open questions
- Whether age-21 is the right hold for waivers and attendance (counsel).

## Notes for the builder
- Anonymize means overwrite PII columns (names → "Former camper", contacts → null), not delete rows that reports depend on.
