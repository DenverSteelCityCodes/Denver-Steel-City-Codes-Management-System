# Contributing

Thanks for helping. This app holds children's medical notes and family contact details, so changes are kept small and reviewable, and the database stays the place where rules are enforced.

## Set up

Follow [Run it locally](README.md#run-it-locally) and [docs/database.md](docs/database.md). Use your own Supabase project. A demo project seeded with `migration_demo_environment.sql` is the easiest way to get realistic, fictional data.

## Workflow: one issue → one branch → one PR

1. **Open or pick an issue** that covers exactly one concern. If your change touches several things, split it. Larger features have a spec in [`docs/specs/`](docs/specs/README.md); read it first and follow its "Done when" list.
2. **Branch from `main`**: `feat/<short-slug>` for features, `fix/<short-slug>` for fixes.
3. **Keep the PR focused** on that issue, and put `Closes #<issue>` in the description. If you find an unrelated problem on the way, open a new issue for it.
4. **Before you push:**
   ```bash
   npm run lint
   npm test
   npm run build
   ```
   CI runs the same three on every PR.

[CLAUDE.md](CLAUDE.md) has the long form of this workflow (it's written for Claude Code, but it applies to everyone).

## Conventions

- **Database changes** go in a new `migration_<name>.sql` at the repo root, with a header that says what it changes, why, and which files it must run after (`Order: after …`). Make it safe to re-run (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP … IF EXISTS`). Add it to the order table in [docs/database.md](docs/database.md).
- **Enforce rules in the database**, not only in the UI: RLS policies, triggers or `SECURITY DEFINER` functions with `SET search_path`. The browser calls Supabase directly, so a check that only lives in React can be skipped.
- **Add a test.** New helpers in `src/lib/` get a Vitest test in `src/lib/__tests__/`. New RLS rules or RPCs get a suite in `test-plans/` that impersonates each role and rolls back (see [docs/testing.md](docs/testing.md)).
- **Keep `src/types/database.ts` in sync** with the schema.
- **Styling:** use the semantic tokens from [design_system.md](design_system.md), not raw hex. Prefer inline editing and `InlineConfirm` over modals.
- **Times** are camp-local (America/Denver). Use the helpers in `src/lib/denverTime.ts`; CI runs in another time zone to catch mistakes.
- **No real personal data** in code, seeds, tests, screenshots or issues. Use `example.com` emails and 555-01xx phone numbers.
- **Never commit secrets.** `.env*` files are gitignored except `.env.example`. Only the public anon key belongs in `VITE_` variables.

## Reporting bugs and ideas

Use the issue templates. For anything security-related, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
