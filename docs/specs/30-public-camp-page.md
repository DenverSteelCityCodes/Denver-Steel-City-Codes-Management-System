# 30: Public camp page and "notify me" list

**Status:** ⬜ not started · **Issue:** #150 · **Priority:** P1 · **Effort:** M · **Phase:** B
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
- [ ] A signed-out phone visitor sees status, dates, location, courses and the FAQ with no login.
- [ ] Changing `sessions.location` updates the page, the wizard and the volunteer apply page.
- [ ] A signup gets one confirm email. After confirming, exactly one "opening soon" and one "now open" email, each with a working unsubscribe.
- [ ] `public_camp_info()` returns no personal data (SQL test as `anon`).

## Tests and verification
- SQL as `anon`: read `public_camp_info()`. Reading `season_settings` or `interest_signups` directly fails.
- Browser: 375 px, dark mode, keyboard-only signup.

## Open questions
- Should the page say "Registration full: join the waitlist" per class? Default: yes, with no numbers.

## Notes for the builder
- Delete interest signups 60 days after opening (add to L4).
