Closes #

## What and why

<!-- One concern per PR. What changes, and the problem it solves. -->

## How it was checked

<!-- The review pipeline: docs/review-pipeline.md -->

- [ ] `npm run lint`, `npm test` and `npm run build` pass
- [ ] New or changed DB rules have a `test-plans/` suite, run with `scripts/sql-test.sh` (paste the ok/BAD counts; note any suite that already fails on `main`)
- [ ] New migration has an `Order:` header, is safe to re-run, and is listed in `docs/database.md`
- [ ] UI changes checked in the browser for each affected role, at 375 px and in dark mode (screenshots below if visual)
- [ ] No real personal data or secrets in code, tests or screenshots

## Review

<!-- /code-review high (max for RLS, SECURITY DEFINER, auth, Edge Functions or cross-family data).
     List each finding as fixed (commit) or answered (why, or the follow-up issue). -->

- Level and outcome: <!-- e.g. high · 3 findings: 2 fixed, 1 answered -->
- [ ] Every finding is fixed or answered here
- [ ] Needs a person's review too (who can read children's data, a new family email, a legal text)

## After merge

- [ ] Migrations applied to the demo in `docs/database.md` order; frontend and changed Edge Functions redeployed
- [ ] Spec tracker ticked (`docs/specs/README.md`)
