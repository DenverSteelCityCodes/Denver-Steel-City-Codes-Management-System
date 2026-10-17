# 01: Production Supabase project, CLI migrations, Git deploys, README v1

**Status:** ⬜ not started · **Issue:** #69 · **Priority:** P0 · **Effort:** M · **Phase:** A: Foundations
**Depends on:** none · **Unblocks:** 02, 08, 19 and every later spec (prod gets its schema from here)
**Plan reference:** Plan §0 Risk 2, §2.4 handoff table

## Why
The only Supabase project (`rdckxazvoeixgwtjhrlf`) is the public demo. Its nightly `private.reset_demo()` deletes every account not in `private.demo_keep_users`, so real families registered there would be wiped at 3 am. Schema changes are 18 flat SQL files applied by hand, in an order written in their comments, and deploys run from a laptop.

## Decided rules
- Denver is a chapter of national (Q-L1), so the prod accounts should be owned or co-owned by national (Q-H1, confirm before creating).
- The demo project stays as it is: public, reset nightly, deployed to `scc.haanie.com`.

## Scope: what to build
- **New Supabase project** `scc-prod` on Pro, in a US region. Record the region in the README and the privacy notice. No `pg_cron` reset job, and no `private.demo_*` tables.
- **Convert migrations:** move the 18 `migration_*.sql` files into `supabase/migrations/<timestamp>_<name>.sql` in dependency order. Start from `schema.sql`; each file's header names what it must follow. `migration_demo_environment.sql` becomes `supabase/demo/` and is applied **only** to the demo project.
- Prove the conversion: `supabase db reset` locally, then `supabase db diff` against the demo project must show only demo-only objects.
- **Vercel:** connect the GitHub repo with Git integration. Prod project: `main` → production URL (❓ e.g. `register.steelcitycodes.org`; needs DNS, Q-H5); PRs → preview deploys against a **staging** Supabase project, or the demo project if no third project is affordable. The demo deploy keeps `VITE_DEMO_MODE=true`; prod must not set it.
- **README v1:** what the app is, architecture in five lines, local setup (clone, `npm i`, `supabase start`, `.env.local`, `npm run dev`), how migrations work, how to deploy. Replace the Vite template text.
- Fix `CLAUDE.md`: point the schema source of truth at `supabase/migrations/`, and the commit attribution line to the current one.

## Out of scope
- Chapters (spec 20).
- Any data migration from the demo DB: prod starts empty.

## Done when
- [ ] Prod project exists; schema built only by `supabase db push` from `main`.
- [ ] `select * from cron.job` on prod returns no reset job; `private.demo_accounts` doesn't exist on prod.
- [ ] A test parent can sign up, confirm, register a camper on prod (or staging), then be deleted.
- [ ] Merging to `main` deploys prod automatically; a PR gets a preview URL.
- [ ] A new developer follows the README on a clean machine and has the app running locally in under 15 minutes (time it).
- [ ] Demo site still works, and its nightly reset still runs.

## Tests and verification
- `supabase db reset` locally succeeds from an empty database.
- Run `test-plans/camp-week-rls-tests.sql` against the local DB: all pass.

## Open questions
- Q-H1 who owns the accounts, Q-H3 billing for the extra project, Q-H5 DNS/prod domain. Default if undecided: create it in the account that already has Pro, and transfer ownership to national later (Supabase supports transferring a project between organizations).

## Notes for the builder
- Never point a prod build at the demo project or vice versa: name the env vars clearly and check them in the deploy log.
- Keep service-role keys out of Vercel client env vars. Only the anon key goes in `VITE_*`.
