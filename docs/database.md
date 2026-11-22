# Database setup

The backend is a hosted [Supabase](https://supabase.com) project: Postgres, Auth, Row Level Security (RLS), Edge Functions and `pg_cron`. Every rule that matters (capacity, age range, one class per camper per week, roles, waitlist offers, change deadlines) is enforced in the database, so a hand-crafted API call can't skip it.

> **Status (spec 01).** Schema changes live in timestamped files under [`supabase/migrations/`](../supabase/migrations/). Local and hosted projects apply them with the Supabase CLI (`supabase db reset` / `supabase db push`). The public demo project (`rdckxazvoeixgwtjhrlf`) stays separate from production (`scc-prod`); demo-only seed/reset SQL is in [`supabase/demo/`](../supabase/demo/) and must never run on prod. Cutover checklist: [ops/production-cutover.md](ops/production-cutover.md).

## Local development

You need [Docker](https://docs.docker.com/get-docker/) (or OrbStack/Colima) and the [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
npm install
supabase start          # local API http://127.0.0.1:54321 — prints URL + anon key
cp .env.example .env.local
# paste the local API URL and anon key into .env.local
npm run dev             # http://localhost:5173
```

`supabase start` runs every file in `supabase/migrations/` against an empty database. Local analytics (Logflare/vector) is off in `supabase/config.toml` because it breaks under Colima’s Docker socket mount; turn it back on if you use Docker Desktop. After you add a migration:

```bash
supabase migration new <short_name>   # creates supabase/migrations/<timestamp>_<short_name>.sql
# edit the file, then:
supabase db reset                     # replay from scratch (wipes local data)
# or, against a linked remote:
supabase db push
```

Promote your first admin after signing up through the app:

```sql
update profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
```

## Fresh install order

Filenames are the order. The table maps each migration to what it adds (historical root names in parentheses).

| # | File | Adds |
|---|---|---|
| 1 | `20260604000000_initial_schema.sql` | Base tables, enums, `profiles` (was `schema.sql`) |
| 2 | `20260604000001_auth_roles.sql` | Profile created server-side from sign-up |
| 3 | `20260610000000_sections.sql` | Classes → courses; sections hold age range, capacity, week, crew |
| 4 | `20260610000001_sections_policy_fix.sql` | Breaks RLS recursion between students and registrations |
| 5 | `20260611000001_sessions.sql` | Camp sessions (weeks) |
| 6 | `20260611000002_student_registration.sql` | Full registration form fields |
| 7 | `20260611000003_student_name_program.sql` | First/last name, program fields |
| 8 | `20260611000004_duties.sql` | Volunteer daily duties |
| 9 | `20260611000005_form_configs.sql` | Admin form editor |
| 10 | `20260611000006_interviews.sql` | Volunteer interview slots |
| 11 | `20260612000001_parent_profiles.sql` | Parent contact details across years |
| 12 | `20260612000002_parent_email.sql` | Parent/guardian email |
| 13 | `20260930000000_waitlist_offers_enum.sql` | `offered` status (own transaction; early so later migrations can reference it) |
| 14 | `20260930000001_security_hardening.sql` | Locks roles/statuses; `private` helpers; finishes `section_supports` |
| 15 | `20260930000002_one_class_per_week.sql` | Seat, age, one-class-per-week checks |
| 16 | `20260930000003_camp_week_ops.sql` | Schedules, roll calls, updates |
| 17 | `20260930000004_interview_self_booking.sql` | Applicants book their own interview |
| 18 | `20260930000005_interview_slots_private.sql` | Interview slots admin-only to read |
| 19 | `20260930000006_volunteer_roster_access.sql` | Crew read campers only through `section_roster()` |
| 20 | `20261014000001_review_hardening.sql` | Application throttling, admin-only notes |
| 21 | `20261017000001_audit_log.sql` | `audit.log` |
| 22 | `20261017000002_edit_conflicts.sql` | `updated_at` conflict checks |
| 23 | `20261017000003_season_settings.sql` | Opening time, deadlines, offer windows |
| 24 | `20261017000004_soft_cancel.sql` | Cancel without deleting history |
| 25 | `20261017000005_auto_confirm.sql` | Held seats confirmed at once |
| 26 | `20261017000006_history_revert.sql` | Admin history + one-click revert |
| 27 | `20261017000007_notifications.sql` | Email outbox + `pg_cron` drain |
| 28 | `20261017000008_parent_changes.sql` | Parent self-cancel; change requests |
| 29 | `20261017000009_change_request_email_kind.sql` | Change-request emails know who asked |
| 30 | `20261017000011_waitlist_offers.sql` | Waitlist offer windows |
| 31 | `20261017000012_parent_swap.sql` | Parents switch class within a week |
| 32 | `20261017000013_volunteer_self_service.sql` | Prefs, switch requests, absences |
| 33 | `20261017000014_volunteer_role_gate.sql` | Volunteer access follows current role |
| 34 | `20261017000015_current_season_audiences.sql` | "Parents"/"everyone" = this season |
| 35 | `20261017000016_admin_mfa.sql` | Admins must pass TOTP |
| 36 | `20261018000001_public_camp_page.sql` | Public camp page + notify-me list |
| 37 | `20261018000002_course_rules.sql` | Grades, prerequisites, place-with |
| 38 | `20261018000003_laptop_loans.sql` | Loaner laptops per camper-week |
| 39 | `20261018000004_urgent_and_incidents.sql` | Urgent notices, incidents, roll-call notes |
| 40 | `20261018000005_volunteer_onboarding.sql` | Interviews, checklist, Meet the teachers |
| 41 | `20261018000006_authorized_pickups.sql` | Authorized pickups + walk-home consent |
| 42 | `20261101000001_duty_locks.sql` | Duty drop locks |
| 43 | `20261101000002_duty_minimums.sql` | Weekly duty minimum |
| 44 | `20261101000003_volunteer_hours.sql` | Service hours + letters |
| 45 | `20261101000004_admin_register.sql` | Admin register-on-behalf |
| 46 | `20261101000005_staffing_board.sql` | Staffing board + week roles |
| 47 | `20261101000006_retention.sql` | Retention dry-run job |
| 48 | `20261101000007_crewing_guard.sql` | One crewing guard (accepted + agreement) |

Superseded history only: `supabase/archive/section_supports_superseded.sql` (never apply).

### Demo-only

| File | |
|---|---|
| `supabase/demo/demo_environment.sql` | `private.reset_demo()`, demo accounts tables, nightly cron. **Demo project only.** |

After applying retention (or any change that reshapes seed data) on the demo, re-apply this file so `private.reset_demo()` stays correct and `app_settings.retention_live` stays `'false'`.

### After the SQL (hosted projects)

1. **Auth:** email confirmation on; Site URL + redirect URLs include `/reset`. Custom SMTP is [spec 02](specs/02-custom-smtp.md).
2. **First admin:** sign up, then `update profiles set role = 'admin' …` as above. Roles can't change from the client.
3. **Admin MFA:** keep `app_settings.admin_mfa_required = 'true'` anywhere real data lives.
4. **Email (optional until spec 02):**  
   `supabase functions deploy send-notifications`  
   `supabase secrets set RESEND_API_KEY=… NOTIFY_FROM="…" APP_URL=https://…`
5. **Admin invites:** `supabase functions deploy admin-invite-parent` (verify_jwt on).
6. **Notify-me links:** `public_camp_page` creates Vault secret `interest_link_key` — never copy between projects.

## Production vs demo

| | Demo | Production |
|---|---|---|
| Project | `rdckxazvoeixgwtjhrlf` | `scc-prod` (create once; see cutover doc) |
| Site | `scc.haanie.com` | ❓ `register.steelcitycodes.org` (Q-H5) |
| `VITE_DEMO_MODE` | `true` | unset / false |
| Demo SQL / nightly reset | yes | **never** |
| Schema updates | `supabase db push` (or SQL editor during transition) | `supabase db push` on merge to `main` (GitHub Action + optional Vercel build step) |

Never point a prod build at the demo project or vice versa. Only the anon key belongs in `VITE_*` env vars.
