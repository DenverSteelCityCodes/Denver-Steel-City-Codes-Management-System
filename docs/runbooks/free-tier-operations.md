# Running on the Supabase free tier

Decided 2026-10-18: to keep hosting at $0, the demo and production projects both run on Supabase's free tier all year. Two GitHub Actions cover the free tier's gaps. Pro (about $25 a month) stays an option if Steel City Codes wants to pay for it, for example for the months registration is open and camp is running.

| Pro gives you | On the free tier |
|---|---|
| The project never pauses | [`keep-alive.yml`](../../.github/workflows/keep-alive.yml) calls the database once a day |
| Daily backups, kept 7 days | [`backup.yml`](../../.github/workflows/backup.yml) makes an encrypted weekly backup in a bucket we own and keeps the newest 4 |
| Leaked-password protection | Nothing equivalent. Keep the minimum password length and admin MFA (`app_settings.admin_mfa_required = 'true'` on prod) |
| Support and an uptime target | None. Fine for a camp registration site; plan for an outage to mean "wait or restore" |

Free-tier limits that matter here: 500 MB database, 1 GB file storage, 2 active free projects per account (the demo and prod use both), and the built-in email sender's 2-an-hour cap (custom SMTP is needed either way, spec 02).

## Keep-alive

Once a day it calls `public_camp_info()` on each project. Signed-out visitors can already make that call, and it returns no personal data. A project without its secrets is skipped.

A failed run means the project didn't answer, usually because it's paused. GitHub emails the repo admins. Restore the project in the Supabase dashboard (Project → *Restore*), then rerun the workflow.

GitHub turns off scheduled workflows in a public repo after 60 days without commits. The keep-alive's second job re-enables both workflows each day to stop that. If GitHub turns them off anyway, it sends an email, and you can turn them back on under Actions → the workflow → *Enable workflow*. Check the Actions tab once at the start of each season.

## Weekly backup

Every Sunday it dumps roles, schema and data with the Supabase CLI, encrypts the bundle with AES-256 using a passphrase held only in GitHub secrets, checks that it decrypts, uploads it, and deletes all but the newest 4 copies.

- The dump holds minors' data. It is never stored in the repo or as a workflow artifact (anyone can download artifacts from a public repo), only encrypted in the private bucket.
- Data an admin deletes is gone from backups within 4 weeks. The privacy notice must say so (spec L4). Change `BACKUP_KEEP` in the workflow and the notice together.
- Vault secrets (`vault` schema) are left out of the dump on purpose. After a restore, rerun the migrations that create them (`migration_public_camp_page.sql` makes the notify-list signing key). Old confirm and unsubscribe links stop working, which is harmless.
- It doesn't back up the demo, which resets every night anyway.

## One-time setup

1. **Bucket.** Create a free Cloudflare account under SCC's email, then R2 → *Create bucket* (e.g. `scc-backups`, location hint North America, public access off). Under R2 → *Manage API tokens*, create a token with **Object Read & Write** on that bucket only. Note the access key ID, the secret, and the S3 endpoint (`https://<account id>.r2.cloudflarestorage.com`).
2. **Passphrase.** Generate one (`openssl rand -base64 32`) and save it in SCC's password manager **before** adding it to GitHub. Without it, the backups can't be opened.
3. **Database URL.** Supabase → prod project → *Connect* → **Session pooler** (GitHub's runners have no IPv6, so the direct connection doesn't work). It looks like `postgresql://postgres.<ref>:<password>@aws-0-us-east-1.pooler.supabase.com:5432/postgres`. Percent-encode special characters in the password.
4. **GitHub secrets.** Repo → Settings → Secrets and variables → Actions → *New repository secret*:

   | Secret | Value |
   |---|---|
   | `DEMO_SUPABASE_URL`, `DEMO_SUPABASE_ANON_KEY` | Demo project URL and anon key (the same values as the demo's `VITE_*` env vars) |
   | `PROD_SUPABASE_URL`, `PROD_SUPABASE_ANON_KEY` | Prod project URL and anon key |
   | `PROD_DB_URL` | Session pooler URL from step 3 |
   | `BACKUP_PASSPHRASE` | Passphrase from step 2 (at least 24 characters) |
   | `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET` | R2 endpoint and bucket name from step 1 |
   | `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` | R2 token from step 1 |

5. **Test.** Actions → *Keep-alive* → *Run workflow*, then *Database backup* → *Run workflow*. Both should go green, and a `scc-prod/…tar.gz.gpg` file should appear in the bucket.
6. **Move the demo to the free tier** (if its org is on Pro): create a free org in Supabase, transfer the demo project to it (Project settings → General → *Transfer project*), and run the keep-alive by hand once.

## Restoring a backup

Do this into a **new, empty** project first, check it, and only then point the site at it. Needs `gpg`, `tar` and `psql` (`brew install gnupg libpq`).

```bash
gpg --decrypt scc-prod-2026-10-18T0941Z.tar.gz.gpg | tar -xzf -
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql --dbname "$NEW_PROJECT_SESSION_POOLER_URL"
```

Then rerun the Vault migrations (see above), redeploy the `send-notifications` Edge Function and its secrets, and update the site's env vars. Delete the decrypted `.sql` files when you're done: they hold every family's data in plain text.

Practice this once before registration opens (spec 19's restore drill) and write down how long it took.
