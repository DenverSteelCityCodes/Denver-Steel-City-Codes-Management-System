# Database setup

The backend is a hosted [Supabase](https://supabase.com) project: Postgres, Auth, Row Level Security (RLS), one Edge Function and `pg_cron`. Every rule that matters (capacity, age range, one class per camper per week, roles, waitlist offers, change deadlines) is enforced in the database, so a hand-crafted API call can't skip it.

> **Status.** Schema changes are flat SQL files in the repo root, applied by hand in the Supabase SQL editor. Converting them into timestamped `supabase/migrations/` files that `supabase db reset` can replay is planned in [spec 01](specs/01-production-project.md). Until then, use the order below.

## Fresh install order

The order comes from the `Order:` / `Apply after` notes in each file's header. Every file from October 2026 on is safe to re-run. **This sequence hasn't been replayed end to end on an empty project yet** (spec 01 does that). If a step fails, the failing file's header names what it depends on.

| # | File | Adds |
|---|---|---|
| 1 | `schema.sql` | Base tables, enums, `profiles` |
| 2 | `migration_auth_roles.sql` | Profile created server-side from sign-up |
| 3 | `migration_sections.sql` | Classes become courses; sections hold age range, capacity, week, crew |
| 4 | `migration_sections_policy_fix.sql` | Breaks an RLS recursion between students and registrations |
| 5 | `migration_sessions.sql` | Camp sessions (weeks) |
| 6 | `migration_student_registration.sql` | Full registration form fields |
| 7 | `migration_student_name_program.sql` | First/last name, program fields |
| 8 | `migration_duties.sql` | Volunteer daily duties |
| 9 | `migration_form_configs.sql` | Admin form editor |
| 10 | `migration_interviews.sql` | Volunteer interview slots |
| 11 | `migration_parent_profiles.sql` | Parent contact details that carry across years |
| 12 | `migration_parent_email.sql` | Parent/guardian email |
| 13 | `migration_security_hardening.sql` | Locks roles and statuses; moves RLS helpers to `private`; finishes `section_supports` |
| 14 | `migration_one_class_per_week.sql` | Seat, age and one-class-per-week checks on every registration |
| 15 | `migration_camp_week_ops.sql` | Section schedules, daily schedule, roll calls, updates |
| 16 | `migration_interview_self_booking.sql` | Applicants book their own interview |
| 17 | `migration_volunteer_roster_access.sql` | Crew read campers only through `section_roster()` |
| 18 | `migration_review_hardening.sql` | Application throttling, admin-only notes |
| 19 | `migration_audit_log.sql` | `audit.log`: who changed what, when |
| 20 | `migration_edit_conflicts.sql` | `updated_at` checks, so saves can't silently overwrite |
| 21 | `migration_season_settings.sql` | Opening time, change deadline, offer windows |
| 22 | `migration_soft_cancel.sql` | Cancel without deleting history |
| 23 | `migration_auto_confirm.sql` | Held seats are confirmed at once |
| 24 | `migration_history_revert.sql` | Admin history and one-click revert |
| 25 | `migration_notifications.sql` | Email outbox and its `pg_cron` job |
| 26 | `migration_parent_changes.sql` | Parent self-cancel before the deadline; change requests |
| 27 | `migration_waitlist_offers_enum.sql` | The `offered` status (must run on its own) |
| 28 | `migration_waitlist_offers.sql` | Freed seats offered to the waitlist with a claim window |
| 29 | `migration_parent_swap.sql` | Parents switch class within a week |
| 30 | `migration_volunteer_self_service.sql` | Volunteer preferences, switch requests, absences |
| 31 | `migration_admin_mfa.sql` | Admins must pass a TOTP step |
| 32 | `migration_audit_log.sql` **again** | Attaches the audit trigger to tables created after step 19 |
| 33 | `migration_public_camp_page.sql` | Each week's place (`sessions.location`), the public camp page's data, the "notify me" list and its every-minute job (spec 30). Deploy `send-notifications` first |
| 34 | `migration_course_rules.sql` | Course rules on classes (grades this fall, a class to take first, a note, the next course), "place with" on registrations, exception requests and the "prerequisite at risk" list (spec 31). Steps 14, 29 and 33 call its helpers once it exists |
| 35 | `migration_laptop_loans.sql` | Loaner laptops per camper-week: a cap per week, a first-come queue, emails, and a laptop column on the crew's roster (spec 29). Deploy `send-notifications` first |
| 36 | `migration_urgent_and_incidents.sql` | Urgent notices (emailed to a whole audience at once, first in the outbox, through the batch sender) and the week audiences on updates, the incident log with its parent notice, and roll-call notes (spec 34). Deploy `send-notifications` first |
| 37 | `migration_volunteer_onboarding.sql` | Volunteer interviews and onboarding: private meeting links, interview and decision emails with a reminder job, the volunteer profile and photo bucket, the onboarding checklist, remove from the season, and Meet the teachers (spec 35). Deploy `send-notifications` first |
| 38 | `migration_authorized_pickups.sql` | Adults who may collect each camper and the dated walk-home consent; who collected each camper at dismissal; the admin dismissal board; a `pickup_changed` email to the lead (spec 36). Redefines `section_roster()` after step 35 (laptop loans); uses step 37's crew helpers. Deploy `send-notifications` first |
| 39 | `migration_duty_locks.sql` | Duty rules per year (`duty_settings`), an admin lock on a duty slot, and the volunteer rules: no drops within 3 days of the duty (the default), no changes to past or locked slots, claim or drop only (spec 37) |

Skip `migration_section_supports.sql`: it is superseded by step 13.

Some headers say "then RE-APPLY X". That is for upgrading a database that already ran an older copy of X. On a fresh install the repo copy is already current.

### After the SQL

1. **Auth:** turn on email confirmation and set the site URL and redirect URLs to where the app is served (`/reset` must be allowed for password reset). Set up custom SMTP ([spec 02](specs/02-custom-smtp.md)), because Supabase's built-in sender is capped at a few emails an hour.
2. **First admin:** sign up through the app, then promote that account in the SQL editor:
   ```sql
   update profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
   ```
   Roles can't be changed from the client, by design.
3. **Admin MFA:** `app_settings.admin_mfa_required` decides whether admins need an authenticator code. Keep it `'true'` anywhere real data lives.
4. **Email (optional):** deploy the outbox sender and set its secrets:
   ```bash
   supabase functions deploy send-notifications
   supabase secrets set RESEND_API_KEY=… NOTIFY_FROM="Your Chapter <no-reply@your-domain>" APP_URL=https://your-site
   ```
   `NOTIFY_REPLY_TO` is optional. Without `RESEND_API_KEY` nothing is sent and emails wait in `notifications`. See the header of `supabase/functions/send-notifications/index.ts`. Redeploy the function whenever `templates.ts` gains a template (spec 30 added three, spec 29 four, spec 36 one).
5. **Notify-me links:** `migration_public_camp_page.sql` creates the Vault secret `interest_link_key` that signs confirm and unsubscribe links. Never copy it between projects; a new key only breaks links already sent.

## Demo environment

`migration_demo_environment.sql` is **only for a throwaway demo project**. `private.reset_demo()` deletes all camp data and every account not listed in `private.demo_keep_users`, reseeds a fictional camp, and runs nightly through `pg_cron`. Never apply it to a project with real families.

To use it, apply it after everything above, fill `private.demo_accounts` and `private.demo_keep_users` (see the file's header), then put the same demo logins in `.env.demo.local` and run `npm run dev -- --mode demo`. All seeded people are fictional: emails use `example.com` and phone numbers use the 555-01xx range.

## Where the schema is described

- `src/types/database.ts`: the TypeScript types the app queries against.
- Each migration's header comment explains what it changes and why, often with the spec or issue it came from.
- `test-plans/*-tests.sql`: RLS and rule tests (see [testing.md](testing.md)).
