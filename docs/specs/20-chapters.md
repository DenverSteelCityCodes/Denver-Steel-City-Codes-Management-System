# 20: Chapters and chapter-scoped admin access

**Status:** ⬜ not started · **Issue:** #94 · **Priority:** P1 ★ handoff · **Effort:** L · **Phase:** C: Handoff
**Depends on:** 05, 08 · **Unblocks:** 21, 22, 23, L7
**Plan reference:** Plan §1.4 N1, §2.4 hardcoded table

## Why
There's no chapter concept anywhere. One admin role sees everything; the time zone, contact, wordmark and settings are Denver's.

## Decided rules
- Denver is a chapter of national (Q-L1). Denver's row: contact `denver@steelcitycodes.org`, time zone America/Denver.

## Scope: what to build
- `chapters(id, slug, name, time_zone, contact_email, logo_url, postal_address, created_at)`; seed Denver.
- `chapter_id not null` on top-level tables: `sessions, classes, duty_types, interview_slots, volunteer_applications, updates, schedule_items, form_configs, app_settings, season_settings, waivers` (children inherit through their parent rows). Profiles get a `home_chapter_id`; students inherit from the registering parent's chapter.
- Roles: `chapter_admins(chapter_id, profile_id)`, `national_admins(profile_id)`. Helpers `private.is_chapter_admin(chapter_id)` and `private.is_national_admin()`. Rewrite every `auth_user_role() = 'admin'` policy to be chapter-scoped (national: read all; write only where national needs it, Q-N2).
- The client resolves the chapter from the URL (❓ Q-N3: subdomain vs. path, e.g. `/denver`) and passes it to queries; branding, contact and time zone come from the row.
- Replace `'America/Denver'` in `roll_call_day_ok()` with the section's chapter time zone.
- Backfill all existing rows to Denver.

## Out of scope
- The national dashboard UI (spec 21).

## Done when
- [ ] A second test chapter's admin can't see or change Denver's data by any API path; Denver works exactly as before.
- [ ] Every RLS test runs for two chapters.

## Tests and verification
- Expand the SQL suite: every table, every role, cross-chapter attempts.

## Open questions
- Q-N2 what national can see and edit; Q-N3 one app with chapters (assumed) and the URL scheme.

## Notes for the builder
- The biggest change in the plan. Land it as several PRs if needed: schema + backfill, then policies table by table, then the client.
