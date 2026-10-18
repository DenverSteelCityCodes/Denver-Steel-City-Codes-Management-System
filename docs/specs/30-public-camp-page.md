# 30: Public camp page and "notify me" list

**Status:** 🟨 in review, PR_LINK · **Issue:** #150 · **Priority:** P1 · **Effort:** M · **Phase:** B
**Depends on:** 09, 13 · **Unblocks:** none
**Plan reference:** [inbox findings](../research/inbox-findings.md) §1

## Why
Two big groups of email this page would answer:
- **Dates and interest** (64 threads): "when is camp, when does registration open, add me to the list". These run from November to March.
- **Logistics** (50 threads): times, building, what to bring, lunch, "can you resend the kickoff email".

Families relied on out-of-date pages and flyers, and in one year two emails gave different start times.

The app has nothing public today:
- Signed-out visitors at `/` are sent to `/login` (`App.tsx:99`).
- `season_settings` can only be read by signed-in users (`migration_season_settings.sql:29`).
- The venue is hard-coded as "Cherry Creek High School" (`ParentRegistrationPage.tsx:857`, `VolunteerApplyPage.tsx:506`), even though construction forced building moves in past years.

## Decided rules
- One always-current public page per season. Emails link to it instead of repeating details.
- A "notify me" signup needs a confirmation click (double opt-in) before we send anything else, so the form can't be used to spam strangers.

## Scope: what to build
- `sessions.location text` (building and address). Replace the two hard-coded venue strings.
- `public_camp_info()` (SECURITY DEFINER, granted to `anon` and `authenticated`). It returns only non-personal data:
  - Season status: `upcoming` with `registration_opens_at`, `open`, `waitlist_only`, or `closed`.
  - Sessions: dates, hours and location.
  - Classes: name, grades, requirement note, and full / not full (no counts).
- Public route `/camp`, and signed-out `/` goes there instead of `/login`. It shows:
  - the status banner with the countdown (reuse `RegistrationCountdown`)
  - weeks, hours and location
  - courses with grade rules (from spec 31)
  - "Free", and an FAQ: devices (spec 29), lunch, drop-off and pickup policy, what to bring
  - "Notify me" and contact `denver@steelcitycodes.org`
- **Notify me.**
  - Table `interest_signups(id, email citext, year, created_at, confirmed_at, unsubscribed_at, notified_opening_at, notified_open_at, unique(email, year))`.
  - Anon RPC `join_interest_list(p_email)`: upserts and sends one `interest_confirm` email. Cap it at 1 per address per day, plus a global cap per minute.
  - Confirm and unsubscribe links use signed tokens.
  - Cron: `registration_opening_soon` when `registration_opens_at` is set or changed (deduped), and `registration_now_open` at the opening minute.
- Signed-in parents see a "Notify me" checkbox on the countdown card instead.

## Out of scope
- The organization's marketing site (steelcitycodes.org belongs to national).
- Translations (backlog).

## Done when
- [x] A signed-out phone visitor sees status, dates, location, courses and the FAQ with no login.
- [x] Changing `sessions.location` updates the page, the wizard and the volunteer apply page.
- [ ] A signup gets one confirm email. After confirming, exactly one "opening soon" and one "now open" email, each with a working unsubscribe. *(Queued exactly once each, with working tokens, in `test-plans/public-camp-page-tests.sql`. Real delivery waits on redeploying `send-notifications` with the new templates and on the provider key, spec 02.)*
- [x] `public_camp_info()` returns no personal data (SQL test as `anon`).

## Tests and verification
- SQL as `anon`: read `public_camp_info()`. Reading `season_settings` or `interest_signups` directly fails.
- Browser: 375 px, dark mode, keyboard-only signup.

## Open questions
- Should the page say "Registration full: join the waitlist" per class? Default: yes, with no numbers.

## Notes for the builder
- Delete interest signups 60 days after opening (added to L4).

## As built (2026-10-18)
What the build changed or settled, so the next reader doesn't have to diff it:
- **`migration_public_camp_page.sql`.** `sessions.location` was backfilled once with the venue the app used to hard-code, so nothing changed for families until an admin edits it (Setup › Sessions has a Place field). `anon` lost its unused table grant on `season_settings`, so a direct read now fails instead of returning no rows.
- **`interest_signups.email` is `text`, stored lower-cased and trimmed with a CHECK.** It gives citext's case-insensitive uniqueness without adding the extension. One extra column, `notified_opens_at`, records which opening time the last "opening soon" announced, so a changed time sends exactly one more.
- **Which camp.** `private.public_camp_year()`: the latest year with weeks on the sign-up forms until its last week ends, then the next year (with no weeks at all: this summer until the end of June, then next summer). The page, the list and the signed-in switch all use it.
- **Status** (`private.camp_status()`, the same rules `registrations_before_insert()` enforces): `upcoming` while no classes are set up or the opening time is ahead; `closed` when the camper form is switched off; `open` while any class has a seat (confirmed, pending and offered seats count); `waitlist_only` when every class is full.
- **What `public_camp_info()` returns**: weeks (name, dates, place, the days and hours classes run, from the earliest start to the latest end, and the daily schedule from `schedule_items`) and courses (name, description, age range, and per week whether every section is full). No section codes, rooms, crews, campers or counts. The open question's default is built: a full week shows "Week 1 is full: waitlist open", with no numbers.
- **Grade rules** still come from `src/lib/courseConstraints.ts` (the Microcontrollers note) until spec 31 moves them into the database; ages come from the sections.
- **Links.** Confirm and unsubscribe links carry `<signup id>.<HMAC>` signed with a Vault secret (`interest_link_key`, made by the migration). `/camp/confirm` and `/camp/unsubscribe` wait for a button press instead of acting on load, so a mail scanner that opens links can't confirm a stranger or unsubscribe anyone.
- **Caps.** One confirmation per address per Denver day (a dedupe key on the outbox), 20 a minute from the form in total. The form answers the same whether or not the address was already on the list.
- **Notices** (`private.send_interest_notices()`, pg_cron every minute): "opening soon" once per announced opening time, after the season settings have been still for 10 minutes so a typo fix doesn't send two; "now open" once, when the status turns open. Reserved `example.com` addresses are recorded as skipped, like every other email.
- **Signed-in parents** get an "Email me when it opens" switch on the countdown card (Home, Classes, wizard step 4) and on `/camp`. It uses the login email, which sign-up already confirmed, so there's no confirmation email.
- **FAQ** says only what the app already does: free; the registration form's laptop and free-lunch questions; the daily schedule; the three roll calls parents see on their dashboard; email the camp for anything else. No loaner or lunch promises beyond the form.
- **Demo:** `private.reset_demo()` seeds the place and clears the list nightly.
- **To ship:** redeploy `send-notifications` (three new templates: `interest_confirm`, `registration_opening_soon`, `registration_now_open`).
