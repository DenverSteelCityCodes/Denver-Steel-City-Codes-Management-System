# Build specs: tracker

This folder turns [the improvement plan](../scc-improvement-plan.md) into one build brief per PR, so nothing gets forgotten. **This page is the single list of what's left.** If a feature isn't here, it isn't planned. Add it here first.

## How to use these specs

1. **Pick the next spec** whose dependencies are all ✅ (table below, in order).
2. **Follow the house workflow** in [`CLAUDE.md`](../../CLAUDE.md): one GitHub issue → one worktree off `origin/main` → one PR that `Closes #issue`. Paste the spec's "Done when" checklist into the issue.
3. **Build to the spec.** If the build shows a spec is wrong, fix the spec in the same PR and say so in the PR body. If a *decision* changes, update the plan's §6 "Decisions made" too.
4. **When it merges:** tick the box here, set the spec's **Status** to ✅ with the PR link, and redeploy (until PR 1 adds Git deploys).

A Claude session can be started on any spec with: *"Build `docs/specs/<file>` following its Done-when checklist and CLAUDE.md."*

## Rules every spec inherits (not repeated in each file)

- **The database enforces every rule.** Trigger, RLS policy or SECURITY DEFINER RPC. The UI only explains it. Parents and volunteers never get direct UPDATE/DELETE on registrations.
- **New tables:** RLS on, policies written, explicit `GRANT`s. Supabase stops auto-exposing new tables to the API from 2026-10-30, per the note in `supabase/config.toml`. After PR 5, add the table to the audit trigger. After PR 20, give it a `region_id`.
- **Never add a second foreign key between two tables the app joins without a `!hint`** (e.g. registrations → sections). PostgREST then answers every such embed with HTTP 300 "more than one relationship", and browsers may cache that error. Use a plain column, or add `!fk_name` hints to every embed in the same PR. (Learned the hard way in spec 06.)
- **New SECURITY DEFINER functions:** `SET search_path`, `REVOKE ALL … FROM PUBLIC, anon`, grant only to `authenticated`. Helpers go in the `private` schema.
- **Every state change a family or volunteer cares about** sends a notification through the outbox (after PR 9). Reply-to is `denver@steelcitycodes.org` (per region after PR 20).
- **Design:** the Terminal Yellow system in [`DESIGN.md`](../../DESIGN.md) (decided 2026-10-17; it replaces the v1.0 cream/Josefin guide in `design_system.md`): semantic tokens and the shared `ui-input` / `ui-btn` primitives, never raw hex; Atkinson Hyperlegible Next for UI, Josefin Sans for page titles only; gold only for the sign band, active tab and one primary action; red only for safety, destruction and blocking errors; **no modals**: inline editing and `InlineConfirm`. Check at 375 px and in dark mode. Every input has a linked label; errors use `role="alert"` and get focus. The redesign of every screen is in `design/impeccable-audit/mockup/`.
- **Done means:** `npm run build` + `npm run lint` pass. CI is green (after PR 8). RLS/SQL tests are added for any new rule. Verified in the browser for each affected role, with a screenshot in the PR. Applied to the demo DB **and**, after PR 1, to prod via migrations. Demo seed (`private.reset_demo()`) updated if the change affects seeded data.
- **Migrations:** until PR 1 lands, add a flat `migration_<name>.sql` at the repo root (re-runnable, applied via the SQL editor or MCP, ordering noted in its header). After PR 1, use `supabase/migrations/`.

## Tracker

Legend: ⬜ not started · 🟨 in progress · ✅ merged · ⛔ blocked (reason in spec)

| ✓ | Spec | Issue | Concern | P | Effort | Deps | Phase |
|---|---|---|---|---|---|---|---|
| ⬜ | [01](01-production-project.md) | #69 | Production Supabase project, CLI migrations, Git deploys, README v1 | P0 | M | — | A |
| ⬜ | [02](02-custom-smtp.md) | #70 | Custom SMTP, branded auth emails, rate limits, leaked-password protection | P0 | S | 01 | A |
| ✅ | [03](03-password-reset.md) | #71 | Forgot password, reset page, resend confirmation | P0 | S | 02 | A |
| ✅ | [04](04-volunteer-pii-lockdown.md) | #72 | Tighten volunteer access to camper data | P0 | S | — | A |
| ✅ | [05](05-audit-log.md) | #73 | Audit log table + trigger | P0 | M | — | A |
| ✅ | [06](06-soft-cancel.md) | #74 | Soft-cancel registrations, cancel-section RPC, RESTRICT deletes | P0 | M | 05 | A |
| ✅ | [07](07-edit-conflicts.md) | #75 | `updated_at` + conflict-checked saves | P0 | S | — | A |
| 🟨 | [08](08-tests-and-ci.md) | #76 | Vitest, SQL/RLS tests, seat-race test, GitHub Actions | P0 | M | 01 | A |
| 🟨 | [09](09-email-outbox.md) | #77 | Notifications outbox + sender + templates | P0 | M | 02 | B |
| ✅ | [10a](10a-block-same-week-backups.md) | #78 | Block same-week waitlist backups | P0 | S | — | B |
| ✅ | [10](10-waitlist-offers.md) | #79 | Waitlist offers: 48 h, decided order, auto-withdraw | P0 | M | 05, 06, 09, 10a | B |
| ✅ | [11](11-parent-cancel.md) | #80 | Parent cancel before deadline, change requests, contact card | P0 | S | 06, 09, 13 | B |
| ✅ | [12](12-parent-swap.md) | #81 | Parent swap class (same week, free seat only) | P0 | M | 10, 11 | B |
| ✅ | [13](13-season-settings.md) | #82 | Opening time, deadlines, offer windows, countdown | P0 | S | — | B |
| ✅ | [14](14-auto-confirm-and-alerts.md) | #83 | Auto-confirm, "no lead" alert, duplicate-camper report | P0 | S | — | B |
| ✅ | [15](15-history-and-undo.md) | #84 | Admin history strip + revert | P0 | M | 05, 06 | B |
| ✅ | [16](16-wizard-resilience.md) | #85 | Wizard: URL steps, drafts, back guard, live fill, a11y | P0 | M | — | B |
| ⬜ | [17](17-fewer-round-trips.md) | #86 | Shared query cache, `register_camper()` RPC, volunteer home RPC | P1 | M | 16 | B |
| ✅ | [18](18-admin-paging.md) | #87 | Server-side paging + search for admin lists | P0 | S | — | B |
| ⬜ | [19](19-load-test-runbook-dry-run.md) | #88 | Load test, restore drill, PITR, runbooks, dry run | P0 | M | 01–18, L1–L3, L5, L6a | B |
| ⬜ | [29](29-laptop-loans.md) | #149 | Laptop loans per camper-week: cap per session, queue, roster column | P0 | M | 09 | B |
| 🟨 | [30](30-public-camp-page.md) | #150 | Public camp page (status, dates, location, courses, FAQ) + notify-me list | P1 | M | 09, 13 | B |
| 🟨 | [31](31-course-rules-in-the-db.md) | #151 | Course rules in the DB: grades, prerequisites, repeat warning, "place with" | P0 | M | 05 | B |
| ⬜ | [32](32-admin-register-on-behalf.md) | #152 | Admin register-on-behalf with named, logged overrides | P1 | M | 05, 31 | B |
| ⬜ | [33](33-health-and-accommodations.md) | #153 | Structured allergies, accommodations, lunch list | P0 | M | 04, L2 | B |
| ⬜ | [34](34-urgent-announcements-and-incidents.md) | #154 | Urgent announcements, week audiences, incident log, roll-call notes | P1 | M | 09 follow-up | B |
| ⬜ | [35](35-volunteer-onboarding.md) | #155 | Volunteer interviews + onboarding: private links, emails, checklist, profile | P1 | M | 09 | B |
| ⬜ | [36](36-authorized-pickups.md) | #156 | Authorized pickups + dated walk-home consent at dismissal | P1 | M | — | B |
| ⬜ | [B2](backlog-p2.md) | #157 | Volunteer hours certificate (promoted from P2) | P1 | S | 35 | B |
| ⬜ | [L1](L1-privacy-and-terms.md) | #89 | Website privacy policy, terms, 18+ guardian attestation | P0 | S | SCC review | Legal |
| ⬜ | [L2](L2-waivers-and-consents.md) | #90 | Versioned waiver, separate consents, signature record, receipt | P0 | M | 09, SCC's text | Legal |
| ⬜ | [L3](L3-photo-flag-on-rosters.md) | #91 | "No photos" flag on rosters | P0 | S | 04, L2 | Legal |
| ⬜ | [L4](L4-retention.md) | #92 | Retention policy + nightly anonymize job | P0 policy / P1 job | S | 05 | Legal |
| 🟨 | [L5](L5-breach-runbook.md) | #93 | Site security-incident runbook + access review | P0 | S | — | Legal |
| 🟨 | [L6a](L6a-accessibility-registration.md) | #111 | Accessibility pass on the registration flow (WCAG 2.1 AA) | P0 | S | 03, 10–12, 16, L1, L2 | Legal |
| ⬜ | [20](20-regions.md) | #94 | Regions + region-scoped admin RLS | P1 ★ | L | 05, 08 | C |
| ⬜ | [21](21-national-dashboard.md) | #95 | National dashboard | P1 ★ | M | 20 | C |
| ⬜ | [22](22-n-week-seasons.md) | #96 | Seasons with any number of weeks | P1 ★ | L | 20 | C |
| ⬜ | [23](23-per-region-forms.md) | #97 | Per-region districts, waivers, DB-enforced grade rules | P1 ★ | M | 20, L2 | C |
| ⬜ | [24](24-households.md) | #98 | Households, guardian invites, admin merge | P1 | M | 05 | C |
| ✅ | [25](25-volunteer-self-service.md) | #99 | Volunteer prefs, switch requests, "can't make it" | P1 | M | 14 | C |
| ⬜ | [26](26-docs-and-admin-guide.md) | #100 | Admin guide, architecture doc, new-region legal checklist | P1 ★ | M | 20–23 | C |
| 🟨 | [27](27-admin-mfa.md) | #101 | Admin MFA | P1 ★ | S | — | C |
| ⬜ | [28](28-data-deletion-requests.md) | #102 | Family data-deletion requests | P1 | S | 05, L4 | C |
| ⬜ | [L6](L6-accessibility.md) | #103 | Full accessibility audit, axe in CI, statement | P1 | M | L6a, 08 | C |
| ⬜ | [L7](L7-volunteer-clearances.md) | #104 | Volunteer clearances with expiry | P1 ★ | S | 20 | C |
| ⬜ | [P2](backlog-p2.md) | — | P2 backlog (9 mini-specs + decided-against list) | P2 | — | — | later |

**Target dates:** Phase A merged by **Nov 30**, Phase B + legal by **Jan 31**, dry run in the first week of February, registration opens on the date set in spec 13 (❓ not chosen yet). **Critical path:** 01 → 02 → 09 → 10 → 12 → 19, with L2 joining at 09.

**Go-live gate (decided 2026-10-17):** registration goes live when national provides DNS for `steelcitycodes.org` (spec 02 sending domain, the prod URL in 01) and the texts only SCC can supply (L1 approval, L2 waiver; Q-L9 for L7). **Until then, every spec that doesn't need national is built, in tracker order, so the app is as ready as possible.** Specs that wait on national are still built up to the switch-over (02 against a test sender, 01 in the account that has Pro). Specs 29–36 and B2 come from the [Denver inbox and Drive findings](../research/inbox-findings.md).

**Bugs found during the findings check: all fixed and live on the demo (2026-10-17).** [#143](https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/issues/143) demoted volunteers kept access → [PR #159](https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/pull/159) · [#145](https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/issues/145) past-season families in "parents"/"everyone" → [PR #161](https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/pull/161) · [#144](https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/issues/144) interview slots readable by all → [PR #163](https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/pull/163) · [#146](https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/issues/146) volunteer emails linked to /parent → [PR #164](https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/pull/164) · [#147](https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/issues/147) interview time zone → [PR #165](https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/pull/165) · [#148](https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/issues/148) emails promised but never sent → [PR #166](https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/pull/166).

## Non-code tasks (people, not PRs; these block specs)

Org-level compliance (insurance, licensing, counsel, volunteer screening) is **handled by SCC outside the site** and isn't tracked here. These are only the inputs the site needs. The website's own documents (privacy policy, terms, accessibility statement, data protection assessment, retention policy, incident runbook) **are** in scope: see plan §4.2.

| ✓ | Task | Owner ❓ | Needed by | Blocks |
|---|---|---|---|---|
| ⬜ | Get SCC's official waiver + consent text (in national's name) | Regional Director → SCC national | **Jan 5** | L2 |
| ⬜ | Website privacy policy + terms of use: Claude drafts from what the site collects; SCC reviews and approves | Claude → SCC national | Draft Nov 15 · approved Jan 5 | L1 |
| ⬜ | Data protection assessment for the site, 2 pages (Colorado minors' amendment) | Claude drafts, SCC reviews | Jan 15 | — |
| ⬜ | Decide who owns prod Supabase, Vercel and email-provider accounts (Q-H1); billing for a second Supabase project (Q-H3) | Regional Director + national | Oct 31 | 01 |
| ⬜ | DNS access for `steelcitycodes.org` (SPF/DKIM for system email; maybe a registration subdomain) (Q-H5) | National IT ❓ | Nov 15 | 02 |
| ⬜ | Sign vendor DPAs (Supabase, Vercel, email provider) as national | National | Jan 31 | — |
| ⬜ | Turn on Point-in-Time Recovery (paid add-on) for Feb–Aug | Account owner | Feb 1 | 19 |
| ⬜ | Does SCC want volunteer clearances recorded in the site? (Q-L9) | SCC national | Mar | L7 |
| ⬜ | SCC's retention policy, or sign-off on plan §4.3 | SCC national | Jan 15 | L4 |
| ⬜ | Peak 2027 numbers (Q-H4) and the registration opening date/time | Regional Director | Dec 1 | 13, 19 |
| ⬜ | 2027 laptop loaner count, and whether the host school lends them again (spec 29) | Regional Director | Jan 5 | 29 |
| ⬜ | Recruit 5 real parents for the February dry run | Regional Director | Jan 20 | 19 |

## Still-open questions

See the plan's [§6](../scc-improvement-plan.md#6-open-questions-for-office-hours-grouped-by-flow). Specs that depend on one say so under **Open questions**, with the default to use if nobody decides by the time the spec is built.
