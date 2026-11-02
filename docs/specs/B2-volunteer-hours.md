# B2: Volunteer hours letters

**Status:** 🟨 in progress · **Issue:** #157 · **Priority:** P1 (promoted from P2 on 2026-10-17) · **Effort:** S · **Phase:** B
**Depends on:** 35 (legal name) · **Unblocks:** —
**Plan reference:** [backlog-p2.md § B2](backlog-p2.md)

## Why
- Teen volunteers need signed service-hour letters for school. In June 2026, 52 letters were written by hand, and some were still going out in September.
- Volunteers asked for their legal name on the letter, not a nickname.

## Decided rules
- **Hours for a week** (director, 2026-11-01, plan Q-D2a): the advertised 40 hours per camp week, as **8 hours per crewed day**, over the days that week that have already happened (today included, Denver time).
  - **Crewed day:** a weekday (Mon–Fri) between the session's dates on which the volunteer leads or supports a section, minus any day inside one of their `crew_absences`. Section times and the number of sections that day don't matter.
  - **Duties:** a duty held on a day that isn't a crewed day (a duty-only volunteer, or a weekend duty) adds its `duty_types.minutes`, except on an absence day. A crewed day's duties are inside its 8 hours, so a crewed week never goes past 40.
- **The `sections.days` text is not parsed.** Every section is assumed to run Mon–Fri. All sections are "Mon–Fri" today.
- **Removed volunteers** (`volunteers.removed_at`) aren't listed and can't sign in, so they get no letter from the site.
- **The letter uses the legal name** from the volunteer's profile (spec 35), or the account name when none is given. The admin list flags volunteers with no legal name on file.
- **When a letter is offered:** from the week's last day on. The letter says "has completed", so it isn't offered mid-week.
- **Rounding:** hours are shown to the nearest quarter hour (e.g. "32.5 hours").
- **Signer:** name and title live in `app_settings` (`hours_letter_signer_name`, `hours_letter_signer_title`). Admins edit them on the letters page. Until both are set, the letter shows a blank signature line with no name.
- **The database counts the hours.** The volunteer reads only their own; admins read everyone's.

## Scope: what to build
- `migration_volunteer_hours.sql`:
  - `private.volunteer_week_hours(p_volunteer uuid, p_session uuid)` → whether crewed, crewed days, crew minutes (days × 480) and duty minutes.
  - `my_volunteer_hours()` → one row per week of the active camp year where the volunteer has hours or is crewed, with the letter details: legal name, week number and dates, totals, whether the letter is ready, and the signer.
  - `admin_volunteer_hours(p_session uuid)` → one row per volunteer crewed or on duty that week, with the same fields plus the "no legal name" flag.
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
  - A week picker and a table: volunteer, legal name, crewed days, crew hours, duty hours, total, and the "no legal name" flag.
  - The signer fields.
  - "Print all letters" and a per-row "Letter" link.

## Out of scope
- A signature image upload (the 2026 letters were signed by hand after printing).
- A letter covering several weeks at once (the template is per week).
- Recording actual sign-in and sign-out times for volunteers.
- The rest of the Discord follow-ups in [backlog-p2.md § B2](backlog-p2.md): the bonding deduction (needs spec 35's event sign-in), orientation credit (Q-D2), admin adjustments and partial days, week roles (spec 39), "Report a mistake", a letter ID, emailed letters and multi-season totals.

## Done when
- [x] A volunteer downloads (prints to PDF) a letter whose hours match the admin's Hours tab for that week and whose name is their legal name.
- [x] An admin prints every letter for a week at once, one per page.
- [x] Absence days, two sections on one day, sections without times, duties on and off crewed days and future days are handled as above (SQL scenario test).
- [x] build + lint + vitest pass; verified at 375 px and in dark mode. Print preview: not opened (the browser pane has no print dialog); the print styles follow `PrintRoster`.

## Build notes
- `test-plans/volunteer-hours-tests.sql` covers 13 cases: weekends inside the session dates, a day off, two sections on one day, duties on a crewed day, the day off and a Saturday, a section saved without its session row, a section without times (a full week is 40 hours), a duty-only volunteer, a future week, the volunteer's own rows, the admin-only list, and removed volunteers.
- A section with no session counts in every week of this season when it's a "both weeks" section (`week` null), and only in its own week when `week` is set; the same rule as `sections_sync_session`.
- Built first on section clock time; switched to 8 hours per crewed day on 2026-11-02, when the Discord findings (#213) recorded the director's 40-hours-a-week rule. The "section times missing" flag went with it.
- The letter's date is today in Denver, the same "today" the hours are counted to.
- `?volunteer=` on the letter page narrows an admin's letters to one person. A volunteer always gets only their own.
- The demo seed signs letters as the fictional "Jordan Lee, Regional Director". The demo weeks are always the current Mon–Fri, so demo hours build up on weekdays and letters unlock on Friday.
- Reviewed by Grok 4.7 (through Cursor). It confirmed no volunteer can read another's hours or name, and found 8 problems; all are fixed: week matching for sections without a session, crewed days for untimed sections, letters from the previous week flashing, the signer rule, the letter date's time zone, per-row "times missing" flags, `?volunteer=` for volunteers, and the missing SQL test file.
