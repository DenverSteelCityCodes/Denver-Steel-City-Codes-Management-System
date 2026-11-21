<p align="center">
  <img src="assets/sccdenver.png" alt="Steel City Codes Denver" width="320">
</p>

<h1 align="center">Steel City Codes Management System</h1>

<p align="center">
  Registration and camp-operations platform for the Denver chapter of
  <a href="https://steelcitycodes.org">Steel City Codes</a>, a summer coding camp for kids.
</p>

<p align="center">
  <a href="https://scc.haanie.com"><strong>Live demo</strong></a> ·
  <a href="docs/database.md">Database setup</a> ·
  <a href="docs/testing.md">Testing</a> ·
  <a href="docs/specs/README.md">Roadmap</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

<p align="center">
  <a href="https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/actions/workflows/ci.yml"><img src="https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license"></a>
</p>

---

Families register campers for week-long classes, volunteers apply and get crewed onto sections, and admins run the whole season, from opening registration to taking roll calls during camp week. It replaces a spreadsheet-and-email process, and it's being readied for the February 2027 registration opening.

## Try the demo

**[scc.haanie.com](https://scc.haanie.com)** has one-click logins for an admin, a parent, a volunteer and an applicant. Everything in it is fictional and resets every night, so click anything.

## What it does

**Parents**
- Register campers through a five-step wizard that saves a draft, with an automatic waitlist when a class is full
- Browse classes by week and age, and see each camper's status per year
- Cancel or switch class themselves until the change deadline, then send a change request
- Claim a waitlist offer within its window (48 hours, 12 in the final week)

**Volunteers**
- Apply, then book their own interview slot
- See their section, crew, roster and daily duties
- Take named roll calls (arrival, after lunch, dismissal) and post updates
- Set week and course preferences, request a switch, or report an absence

**Admins**
- Manage sessions, courses, sections, capacity and crews, with a volunteer-matching helper that pairs new and experienced volunteers
- Review applications and interviews, and accept volunteers onto crews
- A "Needs attention" queue, search, a live attendance board, printable rosters and CSV exports
- Edit registration forms, and set the season's opening time and deadlines
- See every change in the audit history and undo one with a click
- Sign in with a second factor (TOTP)

## How it's built

| Layer | |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, React Router 7 |
| Backend | Supabase: Postgres, Auth, Row Level Security, `pg_cron`, one Edge Function |
| Email | A database outbox drained every minute by `supabase/functions/send-notifications` (Resend) |
| Tests and CI | Vitest unit tests, SQL/RLS suites, a concurrency test; GitHub Actions on every PR |
| Hosting | Vercel (static SPA); prod build runs `supabase db push` then Vite |
| Region | Demo and planned prod: US (record the concrete prod region in the privacy notice when `scc-prod` is created) |

There is no app server. The browser talks to Supabase directly, so **the database is the security boundary**: RLS policies, triggers and `SECURITY DEFINER` functions enforce roles, capacity, age ranges, one class per camper per week, waitlist order and change deadlines. Volunteers read camper data only through `section_roster()`, which returns just their own section's roster fields. Each migration's header explains the rule it adds.

```
src/
  pages/                 one component per route (Admin*, Parent*, Volunteer*, auth pages)
  components/            shared UI (layouts, roll call, updates feed, inline confirm, ...)
  hooks/                 data access: one hook per table or view, all through supabase-js
  lib/                   pure helpers (Denver time, CSV export, matcher, drafts), unit tested
  types/                 database.ts, the typed schema the app queries against
supabase/migrations/     schema source of truth (timestamped; `supabase db reset` / `db push`)
supabase/demo/           demo-only reset/seed — never apply on prod
supabase/functions/      Edge Functions (send-notifications, admin-invite-parent)
test-plans/              SQL/RLS test suites and the seat-race script
docs/                    improvement plan, per-feature specs, runbooks, testing guide
docs/ops/                production cutover and account register
design/                  design handoffs; tokens are in design_system.md
```

## Run it locally

You need **Node 22+**, the [Supabase CLI](https://supabase.com/docs/guides/cli), and **Docker** (or OrbStack/Colima) for the local stack. Timed under 15 minutes on a clean machine when Docker is already installed.

```bash
git clone https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System.git
cd Denver-Steel-City-Codes-Management-System
npm install
supabase start               # applies supabase/migrations/; prints local URL + anon key
cp .env.example .env.local   # paste the local URL and anon key
npm run dev                  # http://localhost:5173
```

Promote your first user to admin (SQL editor or `psql` against the local DB) — see **[docs/database.md](docs/database.md)**. To use a hosted project instead of local, skip `supabase start` and put that project's URL and anon key in `.env.local`, then `supabase link` + `supabase db push`.

| Variable | Where | |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local` | Local (`http://127.0.0.1:54321`) or hosted project URL |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` | The public anon (publishable) key. Never put a service-role key here: everything prefixed `VITE_` ships to the browser |
| `VITE_DEMO_*` | `.env.demo.local` | Optional demo logins, only with `--mode demo` on a database that has `supabase/demo/demo_environment.sql` |
| `RESEND_API_KEY`, `NOTIFY_FROM`, `NOTIFY_REPLY_TO`, `APP_URL` | Supabase Edge Function secrets | Outgoing email (optional) |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` | Vercel Production only | Used by `scripts/prod-migrate-and-build.sh` to `db push` before the SPA build — never on the demo project |

### Scripts

| Command | |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run build` | Type-check and production build to `dist/` |
| `npm run build:demo` | Same, with the demo login buttons |

## Documentation

| | |
|---|---|
| [docs/database.md](docs/database.md) | Local `supabase start`, migrations, demo vs prod |
| [docs/ops/production-cutover.md](docs/ops/production-cutover.md) | Creating `scc-prod`, Vercel Git deploys, secrets, `v0.1.0` |
| [docs/testing.md](docs/testing.md) | Unit, SQL/RLS and concurrency tests |
| [docs/scc-improvement-plan.md](docs/scc-improvement-plan.md) | The plan to February 2027: risks, legal items, build order, decisions |
| [docs/specs/](docs/specs/README.md) | One spec per feature or PR, with status and issue links |
| [docs/runbooks/security-incident.md](docs/runbooks/security-incident.md) | What to do if data may have been exposed |
| [CHANGELOG.md](CHANGELOG.md) | Release notes; tags are rollback points |
| [design_system.md](design_system.md), [design/](design/README.md) | Brand tokens and design handoffs |
| [CLAUDE.md](CLAUDE.md) | House workflow (also read by Claude Code, which helped build this) |
| [PLAN.md](PLAN.md) | The original June 2026 plan, kept for history |

## Contributing

Issues and pull requests are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md): one issue → one branch → one PR, with lint, tests and build passing. Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Please don't open a public issue for a vulnerability. See [SECURITY.md](SECURITY.md) for how to report one privately.

## License

The code is released under the [MIT License](LICENSE). © 2026 Haanie Mohammed.

The Steel City Codes name and logo belong to Steel City Codes and aren't covered by the license. If you run your own copy, please use your own name and branding.
