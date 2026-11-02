# B2: Volunteer hours letters

**Status:** 🟨 in progress · **Issue:** #157 · **Priority:** P1 (promoted from P2 on 2026-10-17) · **Effort:** S · **Phase:** B
**Depends on:** 35 (legal name) · **Unblocks:** —
**Plan reference:** [backlog-p2.md § B2](backlog-p2.md)

## Why
- Teen volunteers need signed service-hour letters for school. In June 2026, 52 letters were written by hand, and some were still going out in September.
- Volunteers asked for their legal name on the letter, not a nickname.

## Decided rules
- **Hours for a week** = crewed minutes + duty minutes, over the days that week that have already happened (today included, Denver time).
  - **Crewed minutes:** each weekday (Mon–Fri) between the session's dates on which the volunteer leads or supports a section with set times, minus any day inside one of their `crew_absences`. Two sections on the same day count their overlapping time once.
  - **Duty minutes:** each duty slot they hold that week, using `duty_types.minutes`, minus absence days.
- **Section times are required.** A section without a start and end time adds nothing. The admin list says so, so the times get fixed before letters go out.
- **The `sections.days` text is not parsed.** Every section is assumed to run Mon–Fri. All sections are "Mon–Fri" today.
- **Removed volunteers** (`volunteers.removed_at`) aren't listed and can't sign in, so they get no letter from the site.
- **The letter uses the legal name** from the volunteer's profile (spec 35), or the account name when none is given. The admin list flags volunteers with no legal name on file.
- **When a letter is offered:** from the week's last day on. The letter says "has completed", so it isn't offered mid-week.
- **Rounding:** hours are shown to the nearest quarter hour (e.g. "32.5 hours").
- **Signer:** name and title live in `app_settings` (`hours_letter_signer_name`, `hours_letter_signer_title`). Admins edit them on the letters page. Until both are set, the letter shows a blank signature line with no name.
- **The database counts the hours.** The volunteer reads only their own; admins read everyone's.

## Scope: what to build
- `migration_volunteer_hours.sql`:
  - `private.volunteer_week_minutes(p_volunteer uuid, p_session uuid)` → crew minutes, duty minutes, crewed days, and sections without times.
  - `my_volunteer_hours()` → one row per week of the active camp year where the volunteer has hours or is crewed, with the letter details: legal name, week number and dates, totals, whether the letter is ready, and the signer.
  - `admin_volunteer_hours(p_session uuid)` → one row per volunteer crewed or on duty that week, with the same fields plus the "no legal name" and "section times missing" flags.
  - Both are SECURITY DEFINER with `search_path` set and execute granted to `authenticated` only. The admin one checks the caller's role.
- **Volunteer:** a "Service hours" section on Profile.
  - One line per week: hours, crewed days, duty minutes.
  - A "Letter" link once the week is over. The page notes which name the letter uses and where to change it.
- **Printable letter** at `/print/hours/:sessionId`, following the 2026 template:
  - today's date
  - "Volunteer Record / Service Hour Verification"
  - "This is to certify that <legal name> has completed <N> hours of service during Week <n> (<dates>) at Steel City Codes Denver."
  - contact `denver@steelcitycodes.org`
  - signature line with the signer's name and title.

  A volunteer sees their own letter. An admin opening the same route gets every volunteer's letter for that week, one per page (`?volunteer=<id>` narrows it to one).
- **Admin:** an "Hours" tab on Volunteers.
  - A week picker and a table: volunteer, legal name, crewed days, crew hours, duty hours, total, and flags.
  - The signer fields.
  - "Print all letters" and a per-row "Letter" link.

## Out of scope
- A signature image upload (the 2026 letters were signed by hand after printing).
- A letter covering several weeks at once (the template is per week).
- Recording actual sign-in and sign-out times for volunteers.

## Done when
- [x] A volunteer downloads (prints to PDF) a letter whose hours match the admin's Hours tab for that week and whose name is their legal name.
- [x] An admin prints every letter for a week at once, one per page.
- [x] Absence days, overlapping sections, sections without times and future days are handled as above (SQL scenario test).
- [x] build + lint + vitest pass; verified at 375 px and in dark mode. Print preview: not opened (the browser pane has no print dialog); the print styles follow `PrintRoster`.

## Build notes
- `test-plans/volunteer-hours-tests.sql` covers 13 cases: weekends inside the session dates, a day off, overlapping sections, a duty on the day off, a section saved without its session row, a section without times, a duty-only volunteer, a future week, the volunteer's own rows, the admin-only list, and removed volunteers.
- A section with no session counts in every week of this season when it's a "both weeks" section (`week` null), and only in its own week when `week` is set; the same rule as `sections_sync_session`.
- A crewed day needs a section with times. A volunteer whose only section has none shows 0 days and is flagged on the Hours tab.
- The letter's date is today in Denver, the same "today" the hours are counted to.
- `?volunteer=` on the letter page narrows an admin's letters to one person. A volunteer always gets only their own.
- The demo seed signs letters as the fictional "Jordan Lee, Regional Director". The demo weeks are always the current Mon–Fri, so demo hours build up on weekdays and letters unlock on Friday.
- Reviewed by Grok 4.7 (through Cursor). It confirmed no volunteer can read another's hours or name, and found 8 problems; all are fixed: week matching for sections without a session, crewed days for untimed sections, letters from the previous week flashing, the signer rule, the letter date's time zone, per-row "times missing" flags, `?volunteer=` for volunteers, and the missing SQL test file.
