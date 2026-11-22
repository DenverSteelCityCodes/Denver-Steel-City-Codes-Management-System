# Production cutover (spec 01)

In-repo work for spec 01 converts flat `migration_*.sql` files into `supabase/migrations/` and wires Git deploys. **Creating the hosted prod project and connecting Vercel still need a human with account access.** Do this once, then every merge to `main` applies schema via `supabase db push` and ships the SPA.

## Accounts register (Discord M01)

Keep two named owners, a renewal date, and authenticator-app 2FA for each:

| Service | Owners | Renewal / notes |
|---|---|---|
| Domain + DNS (`steelcitycodes.org`) | ❓ | Q-H5; SPF/DKIM for system email |
| Supabase (demo `rdckxazvoeixgwtjhrlf` + prod `scc-prod`) | ❓ | Pro billing; transfer to national later (Q-H1) |
| Vercel (demo + prod projects) | ❓ | Hobby is personal/non-commercial — use Pro or Cloudflare/Netlify (Q-H1) |
| Email provider (Resend) + shared mailbox | ❓ | Spec 02 |
| Social / org password manager | ❓ | Recovery codes (Supabase Auth has none — admin recovery is another admin's reset, spec 27) |

## 1. Create `scc-prod`

Default if Q-H1/H3 undecided: create in the account that already has Pro; transfer to national later.

1. In the [Supabase dashboard](https://supabase.com/dashboard), **New project** → name `scc-prod`, region **US** (record the region in the README and privacy notice), generate a strong DB password; store it in the org password manager.
2. Do **not** apply `supabase/demo/demo_environment.sql`. Prod must have no `private.demo_*` tables and no nightly `private.reset_demo()` cron job.
3. Auth: enable email confirmation; set Site URL and redirect URLs to the prod app (include `/reset`). Custom SMTP is spec 02.
4. Copy the project ref, URL, and **anon** key only (never put the service-role key in `VITE_*`).

## 2. First schema push

From a clean checkout of `main`:

```bash
supabase login
supabase link --project-ref <scc-prod-ref>
supabase db push
```

Confirm:

```sql
select jobname from cron.job;                    -- no reset_demo job
select to_regclass('private.demo_accounts');     -- null
```

Sign up a test parent on prod, confirm email, register a camper, then delete the account.

## 3. GitHub secrets

Repository → Settings → Secrets and variables → Actions (and the `production` environment):

| Secret | |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Token that can push to prod |
| `SUPABASE_PROD_PROJECT_REF` | Prod ref (**not** `rdckxazvoeixgwtjhrlf`) |
| `SUPABASE_PROD_DB_PASSWORD` | Database password from step 1 |

Workflow: `.github/workflows/deploy-migrations.yml`.

## 4. Vercel

1. **Prod project** (new): connect this GitHub repo; Production branch `main`.
   - Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` for **prod**. Do **not** set `VITE_DEMO_MODE`.
   - Optional but recommended: set Build Command to `scripts/prod-migrate-and-build.sh` and add `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` (same prod ref) so a failed migration blocks the SPA deploy.
   - Framework: Vite; Output: `dist`. `vercel.json` already rewrites to `index.html`.
   - Domain: ❓ `register.steelcitycodes.org` when DNS exists (Q-H5). Until then, use the `*.vercel.app` URL.
2. **Demo project** (existing `scc.haanie.com`): keep `VITE_DEMO_MODE=true` and demo anon key. Never set prod migrate secrets on this project.
3. **PR previews:** point Preview env at the **demo** project (or a future staging project). Previews must not receive prod migrate secrets.

## 5. Demo stays as-is

- Project `rdckxazvoeixgwtjhrlf`, nightly `private.reset_demo()`, deploy `scc.haanie.com`.
- After this PR merges, apply any **new** migrations to the demo with `supabase db push --project-ref rdckxazvoeixgwtjhrlf` once (baseline), or keep applying via the SQL editor until you link the CLI. Re-apply `supabase/demo/demo_environment.sql` whenever retention or seed shape changes.

## 6. Release `v0.1.0`

After the first successful prod push + Vercel prod deploy:

```bash
gh release create v0.1.0 --generate-notes --title "v0.1.0 — production foundation"
```

Later milestones: `v0.9.0` (February dry run), `v1.0.0` (registration opening). A tag is the rollback point: redeploy that commit in Vercel, then run any down-steps noted in the release.

## 7. Dependabot

Already configured to group npm minor/patch weekly-or-monthly and **ignore major** updates until after the summer season (see `.github/dependabot.yml`).
