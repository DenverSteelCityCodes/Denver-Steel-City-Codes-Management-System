# 08: Automated tests and CI

**Status:** ⬜ not started · **Issue:** #76 · **Priority:** P0 · **Effort:** M · **Phase:** A
**Depends on:** 01 · **Unblocks:** every later spec (they add tests here)
**Plan reference:** Plan §2.4 docs/setup table, §2.2 seat race

## Why
There's no test runner (`package.json` has no test script) and no CI (no `.github/`). RLS rules are verified by hand-run SQL. The seat-race protection (section row lock in `registrations_before_insert`) has never been tested under real concurrency.

## Decided rules
- None.

## Scope: what to build
- Vitest + `npm test`. First tests: `lib/volunteerMatcher.ts`, `lib/campers.ts`, `lib/courseConstraints.ts`, `lib/csv.ts`, `lib/campDay.ts`.
- SQL test runner: `supabase start` + `supabase db reset` + `psql -f` over `supabase/tests/*.sql`. Move `test-plans/camp-week-rls-tests.sql` there. Each file fails loudly on the first wrong result (use `pgTAP` if convenient).
- **Seat-race test:** seed one section with capacity 5 and 20 parents each with an eligible camper. Open 20 parallel connections (a small Node or bash script with `psql &`), each authenticated as a different parent (`set local request.jwt.claims`), all inserting at once. Assert exactly 5 seat-holding rows and 15 `waitlisted` (after spec 14: `confirmed`, not `pending`).
- GitHub Actions on every PR and push to `main`: `npm ci`, build, lint, vitest, Supabase local stack, migrations, SQL tests.
- Branch protection on `main`: require the CI check.

## Out of scope
- End-to-end browser tests (can come later; the browser checks per spec stay manual).

## Done when
- [ ] CI runs on a PR in under 10 minutes and blocks merging on failure.
- [ ] The seat-race test passes 20 runs in a row.
- [ ] README explains how to run all tests locally.

## Tests and verification
- Prove CI catches breakage: temporarily break an RLS policy on a branch and see the SQL tests fail.

## Open questions
- None.

## Notes for the builder
- Use the Supabase CLI version pinned in the workflow, so local and CI behave the same.
