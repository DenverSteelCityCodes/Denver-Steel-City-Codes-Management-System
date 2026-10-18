# Testing

Three kinds of test, from fastest to slowest. CI (`.github/workflows/ci.yml`) runs the first on every pull request and every push to `main`.

## 1. Lint, unit tests, build (CI)

```bash
npm ci
npm run lint
npm test          # Vitest: src/lib/__tests__/*.test.ts
npm run build
```

- Unit tests cover the pure helpers: the volunteer matcher, CSV export (including formula defusing), grade → age, the course rules (grades, prerequisites, the repeat warning; `courseRules.ts`), camp-day formatting, Denver time (both DST sides, any device zone) and registration drafts (signatures never stored).
- CI runs them with `TZ=Asia/Tokyo`, so a Denver-time bug can't hide behind a Denver machine.
- Add a test next to any new helper in `src/lib/`.

## 2. SQL / RLS suites (by hand for now)

`test-plans/*-tests.sql` each impersonate users (`set local role authenticated` plus `request.jwt.claims`). They end with `raise exception 'RESULTS …'`, so **everything rolls back**. Run one against the demo database, after `select private.reset_demo();`, in the Supabase SQL editor or with any runner, and read the lines it prints. Every line should say `ok`; any `BAD` is a failure.

- Where admin MFA is required (spec 27), an admin's claims need `'aal': 'aal2'`.
- `camp-week-rls-tests.sql` is older: it prints `(BAD)` lines instead of raising.

**Next (spec 08 after spec 01):** once migrations live in `supabase/migrations/`, CI starts the Supabase local stack (`supabase start`, `supabase db reset`) and runs these files with `psql`, failing on any `BAD`.

## 3. Concurrency

- **Seat race:** `test-plans/seat-race.sh`. 20 parents, each on their own connection, take a 5-seat section at the same moment. It passes only with exactly 5 seats held and 15 waitlisted, 20 runs in a row. Last run 2026-10-17 on the demo: 20/20 passed. With an API runner, watch for rate limits: the script now fails on them instead of leaving data behind.
  ```bash
  DATABASE_URL=postgres://… test-plans/seat-race.sh
  ```
  `RUN_SQL` can point at any command that runs a `.sql` file. It needs 20 parent accounts and cleans up after itself. **Never run it on production.**
- **Last loaner laptop (spec 29):** the same script with `RACE=laptops` (the default `RACE=all` runs both). Families whose campers hold seats ask for a loaner at the same moment with `LOANERS` left (default 2 families, 1 loaner); it passes only with exactly `LOANERS` reserved and the rest queued. Last run 2026-10-18 on the demo through the Management API: 10/10 with 2 families and 1 loaner, 5/5 with 8 families and 3 loaners.
- **Parent swap races:** `test-plans/parent-swap-concurrency.md` covers two parents racing for one seat, and A→B with B→A at once.

## 4. In the browser

Each spec's PR lists what was checked by hand and with axe-core (accessibility, spec L6a); see `docs/specs/L6a-accessibility-registration.md` for how to run axe in the dev server.
