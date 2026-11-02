# P2 backlog: mini-specs

**Status:** ⬜ none started · These come after the handoff work unless a decision moves one up. Each mini-spec is enough to open an issue from. When one is picked up, copy it into its own numbered spec file using the full template, and add it to the [tracker](README.md).

## B1. SMS reminders
- **For:** parents. **Why:** email is missed; comparables offer SMS ([SignUpGenius](https://www.signupgenius.com/blog/new-feature-text-messaging), [VolunteerHub](https://support.volunteerhub.com/support/solutions/articles/60000610954-can-i-send-text-messages-to-volunteers-through-volunteerhub-)).
- **Build:** opt-in checkbox with TCPA consent wording (from SCC); `parent_profiles.sms_opt_in_at`; an SMS channel in the spec 09 outbox (Twilio or similar) for three templates only: offer made, offer expiring, camp starts tomorrow. Quiet hours 9 pm–8 am Denver. STOP handling.
- **Done when:** opted-in parents get those three texts; nobody else does; STOP works.
- **Discord M19 (2026-11-01):** proposes extending SMS to opted-in volunteers (guardian consent under 18) for urgent and day-of notices. Waits on Q-D13; until then, parents only.

## B2. Volunteer hours certificate (→ P1, 2026-10-17)
- **Promoted:** the full build spec is [B2-volunteer-hours.md](B2-volunteer-hours.md).
- **For:** teen volunteers (school service hours). **Why:** 52 letters were made by hand in June 2026, some still going out in September; volunteers asked for their legal name instead of a nickname.
- **Build:** hours = 8 per crewed day (from `sessions` dates, crew in `sections.lead_id` / `section_supports`, minus `crew_absences`), plus duties on days not crewed (see the Discord findings below). A "My hours" card and a printable letter matching the 2026 template: date, "Volunteer Record / Service Hour Verification", "This is to certify that <legal name> has completed <N> hours of service during Week <n> (<dates>) at Steel City Codes", contact `denver@steelcitycodes.org`, signer name and title from settings, optional signature image. Admin: generate all letters for a week at once.
- **Done when:** a volunteer downloads a letter whose hours match the admin's records and whose name is their legal name (spec 35).
- **From the Discord findings (2026-11-01).** From [the Discord findings](../research/discord-findings.md), checked against `main` at `d046434`. B2 itself is unbuilt; these extend it.
  - [x] The weekly credit is 40 hours per camp week (8 per crewed day); built in [B2-volunteer-hours.md](B2-volunteer-hours.md). The bonding deduction (5 hours off per week, director 2026-11-01) is its own item below; orientation credit waits on Q-D2. (Discord M10; Q-D2, Q-D2a)
  - [ ] An admin screen to record absences and partial days for any crew member, past dates included. The database already allows this for admins (`migration_volunteer_self_service.sql:81`); only volunteers are limited to today or later. A "did not run / ran partly" flag on a camp day, so a hold or closure counts for no one. (Discord M10)
  - [ ] Audited admin adjustment lines per volunteer per week, with a required reason. (Discord M10)
  - [ ] The bonding deduction as an automatic adjustment line from bonding sign-in (spec 35's event task): 5 hours off the week's 40 per week volunteered. Credit for other events (prep, setup) only if logged as events; orientation credit waits on Q-D2. (Discord M10, M18)
  - [ ] Week roles (admin room, floater; spec 39) earn the same daily credit as section crew. (Discord M53)
  - [ ] Spec 38's duty roll call decides which duty minutes count. (Discord M33)
  - [ ] "Report a mistake" on My hours creates a change request (kind `hours`); hours lock at a cutoff before the bulk run. (Discord M10)
  - [ ] Letters show hours per week and date range, the verifier's name, title and org email, and a short letter ID a school can check without emailing. (Discord M10)
  - [ ] Generate and email all letters for a week from the last camp day. (Discord M10)
  - [ ] Multi-season totals on My hours and a per-volunteer CSV for award forms, within L4. (Discord M10)
  - [ ] One letter renderer shared with B15 (camper certificates). (Discord M42)

## B3. Self-host the Josefin fonts
- **Why:** Google Fonts sends visitors' IP addresses to Google (privacy, §2.4).
- **Build:** add the font files to `public/fonts`, `@font-face` in `index.css`, remove the Google `<link>`s from `index.html`. Visually identical.
- **Done when:** no request to `fonts.googleapis.com` or `fonts.gstatic.com`; the type renders the same.

## B4. Server-side "seen" state for bells
- **Why:** the parent bell's "seen" marker is per device (localStorage), so a parent sees old items as new on their laptop.
- **Build:** `notification_reads(profile_id, last_seen_at)`; the bell reads and writes it.
- **Done when:** marking seen on the phone clears it on the laptop.

## B5. Duty reminders and swaps
- **For:** volunteers. **Build:** a reminder email the day before a claimed duty slot (outbox); "Offer my slot" lets another volunteer claim it, and capacity is still enforced by the existing trigger.
- **Done when:** reminders go out; a swap completes without an admin.
- **Discord M33 (2026-11-01):** proposes promoting this to P1. A swap inside spec 37's 3-day lock needs admin approval (Q-V4), so "without an admin" holds only outside the lock. See spec 38's Discord section.

## B6. Authorized-pickup list → promoted to spec [36](36-authorized-pickups.md) (2026-10-17)

## B7. Magic-link sign-in (Q-A2)
- **Build:** "Email me a sign-in link" on `/login` (`signInWithOtp`), alongside passwords. Uses the spec 02 templates.
- **Done when:** a parent can sign in with no password from a phone.

## B8. First login lands in the wizard (Q-A1)
- **Build:** if a parent has no campers and no draft, the first visit to `/parent` goes straight to `/parent/register` with a short welcome line.
- **Done when:** a brand-new family reaches step 1 without hunting for "Add camper".

## B9. Drop the unused `attendance_logs` table
- **Context:** replaced by roll calls (camp-week audit, owner decision 5). Nothing reads it.
- **Build:** export it once (CSV) for the record, then drop the table and its policies in a migration.
- **Discord M62 (2026-11-01):** still to do; the table is still defined (`schema.sql:57`).

---

## B10. Move both weeks in one step (follow-up to spec 12)
- **Why:** swaps are same-week only, and changing weeks means cancel then re-register, risking the seat. In 2026 a staff member moved a camper's week-1 class by hand and missed the matching week-2 change.
- **Build:** `swap_my_two_weeks(p_reg_week1, p_target1, p_reg_week2, p_target2)`: both moves in one transaction or neither, free seats only, same deadline and course rules as spec 12 and 31.
- **Done when:** a two-week change either fully succeeds or leaves both registrations untouched.

## B11. Volunteer-sibling placement rule and transport note (follow-up to spec 25)
- **Why:** seats are reserved for volunteers' siblings, but a sibling must not be in their volunteer-sibling's section (asked for by families twice). Volunteers also share rides.
- **Build:** `volunteer_family_links(volunteer_id, student_id)` set by admins; the matcher and section builder warn when a linked camper and volunteer share a section. A free-text `transport_note` on volunteer availability.
- **Done when:** assigning a volunteer to their sibling's section shows a warning.
- **Discord M26 (2026-11-01):** the same family link also warns when an interviewer is linked to the applicant (spec 35).

## B12. Bounce tracking (follow-up to spec 09)
- **Why:** typo addresses (".con", misspelled school domains) bounced on every bulk email for up to three seasons and nobody noticed. Accounts are email-confirmed, which prevents most of this, but a second guardian's or volunteer's address can still go bad.
- **Build:** the provider's bounce/complaint webhook (Edge Function, signed) marks `notifications` as bounced and the address as undeliverable; an attention item lists them; the parent sees "We couldn't email you, please check your address" on the dashboard.
- **Done when:** a test bounce appears in the attention queue within a minute.
- **Discord M07, M50 (2026-11-01):** ship before camp week. It also marks stale addresses for spec 34's "Past families" audience.

## B13. Translated parent emails
- **Why:** several families wrote in Chinese, Korean or limited English, and a funder sends bilingual notices.
- **Build:** a `parent_profiles.language` choice and translated versions of the transactional templates (Spanish first); no machine translation of free text.
- **Done when:** a parent who picks Spanish gets every transactional email in Spanish.

---

B14–B20 come from [the Discord findings](../research/discord-findings.md) (2026-11-01), checked against `main` at `d046434`. All seven are P2.

## B14. Still-coming check and no-show release (Discord M52)
- **For:** admins and waitlisted families. **Why:** about 15 of 80 registered campers didn't come in 2021, and in 2024 week-1 no-show seats sat empty while a waitlist existed (14 conversations, 2021–2025). No-shows stayed on rosters and certificates until pruned by hand. The "one in five" figure is a chat estimate, not app data.
- **Already built:** a parent or admin cancellation frees the seat and offers it on (`migration_parent_changes.sql:39`, `migration_waitlist_offers.sql:98`).
- **Build:**
  - A `still_coming` email about 17 days before each session, so it lands before the 14-day change deadline (Q-W1), with a one-tap link to the existing parent cancel. After the deadline, a release goes through "Request a change".
  - After the day-one arrival roll call, an admin attention list "Seated, absent on day 1, no note", to contact.
  - An admin "Mark no-show and release" from day two (cancel reason `no_show`), which frees the seat and offers it like any cancellation (spec 10's final-week window). Q-D14 asks whether offers stop at session start; until §6 says so, they don't.
- **Done when:** a parent releases a seat from the email and the next waitlisted camper gets an offer; the day-one list shows only seated campers marked absent with no note.
- **Open question:** may a seat be released from day two at all? ❓ Default: yes, admin action only.

## B15. Camper certificates (Discord M42)
- **For:** campers and leads. **Why:** every camp week from 2021 to 2025 ended with certificates built per class in a design tool from the roster, not attendance, and colour-printed on volunteers' home printers the night before (a 63-page job in 2022). No-shows were pruned by hand, a moved camper was left off, a class had the wrong course name (21 conversations).
- **Already built:** roll calls and historical attendance (`migration_camp_week_ops.sql:67`, `src/components/AttendanceExport.tsx:84`). B2's renderer isn't built either, so B2 and B15 share one renderer, whichever lands first.
- **Build:** one print-ready PDF per section from roll-call data. The rule is a season setting (default: at least one arrival roll call "present"; one-day attendees flagged for the lead to decide). Each page shows the camper's name as registered, the course actually attended, week and dates, the crew as signers and an optional signature image from settings. Works in black and white. "Print all sections for the week", and reissue one camper's certificate after camp. No camper data leaves the app.
- **Done when:** a section's PDF includes exactly the campers who meet the rule, each with the course they attended.
- **Open question:** campers have no preferred-name field. ❓ Default: the registered name.

## B16. Print pack (Discord M25)
- **For:** admins on camp days. **Why:** each week leads hand-built check-in sheets, door signs, name tags, computer labels and allergy sheets from a master sheet, then hand-corrected them after every change (56 conversations, 2021–2026).
- **Already built:** a live per-section print roster with room, health, contacts, loaners and three roll-call boxes (`src/pages/PrintRoster.tsx:149`, `:157`). It doesn't render the pickup adults its RPC returns.
- **Build:** per session, from live data:
  - an alphabetical check-in sheet (section, room, course, a column per day, authorized pickups from 36)
  - door signs per section (double-sided between weeks)
  - name tags (name and room)
  - loaner labels (29) for that week's registrants only
  - a per-section allergy sheet (33) with "No photos" marks (L3)
  - per-class headcounts for printing booklets
  - "Changes since last print" per week (joined, moved, cancelled), from a stored print timestamp, so reprints are targeted
- **Done when:** after one camper moves, "changes since last print" lists exactly that move, and every sheet reflects it.

## B17. Season report (Discord M56)
- **For:** leads, national and funders. **Why:** leads rebuilt the same numbers every year from memory and spreadsheets: totals by year, registered against attended, grant figures reused from an older year (28 conversations).
- **Already built:** fixed "How did you hear" choices, stored (`src/pages/ParentRegistrationPage.tsx:46`; required by default, `src/lib/formFields.ts:70`); the attendance CSV; live seat totals. Optional gender and ethnic-background fields already exist on campers (`migration_student_registration.sql:13`).
- **Build:** per year and week: registered, waitlisted, attended at the arrival roll call (show rate), unique campers against enrollments, share attending both weeks, repeat campers, grade mix, fill by class, laptop loans, lunches provided, volunteers and hours, referral source, and year-over-year totals. CSV export. Spec 21 can reuse it. Totals are stored per year before L4 anonymizes records.
- **Privacy:** demographic fields about minors (the existing ones included) are optional, need an SCC decision with a stated purpose and L1 review, and are only ever reported in aggregate.
- **Done when:** the report for a demo season matches hand counts from the roster and roll calls.

## B18. Roster exports for platform accounts and materials (Discord M57)
- **For:** admins before day one. **Why:** day one usually starts with campers creating coding-platform accounts; in 2025 leads pre-created accounts the night before because district emails were blocked. Booklet counts disagreed with registrations (25 conversations).
- **Already built:** a camper CSV with camper, class, section, week and status, but no camper email (`src/pages/AdminStudents.tsx:382`); enrollment counts (`src/hooks/useAdminClasses.ts:91`). The district-account test is already in spec 19.
- **Build:** a per-week roster CSV laid out for bulk account creation (camper, section, week, the camper's own email where given; admins only, crew never see it); a "materials per course" count card; a season setting naming the coding platform used.
- **Done when:** the CSV imports into a spreadsheet with one row per seated camper for the chosen week.
- **Open question:** camper email is still Q-P3/Q-L5. This gives it a purpose but doesn't settle it.

## B19. Shirt size tally (Discord M60)
- **For:** admins ordering shirts. **Why:** shirt orders were sized by hand and placed before rosters were final, then broke with drops and late adds; 37 volunteer shirts needed rush shipping in 2023 (11 conversations).
- **Already built:** camper registration and the volunteer application already collect shirt size, and the application CSV includes it (`migration_student_registration.sql:11`, `schema.sql:82`, `src/pages/AdminVolunteers.tsx:84`).
- **Build:** volunteers can edit their size on the profile (spec 35); an admin "Shirt sizes" export per week from seated campers plus crewed volunteers and week roles, counting a two-week camper once, with a "since last export" diff.
- **Done when:** the tally matches the seated and crewed lists, and a camper in both weeks counts once.

## B20. Donation link (Discord M58)
- **For:** families. **Why:** camp is free and funded by donations and a grant. Leads put a donation link at fixed moments, and refused a family's offer to pay for a waitlist spot (17 conversations). National holds the money.
- **Build:** an admin setting `donation_url` (a static link; no payments, no donation log) shown on `/camp` after registration closes and in the post-camp email. Never in waitlist offers, the confirmation email or any step that affects a seat.
- **Done when:** the link shows only in those two places.
- **Blocked on Q-P5:** build only after SCC answers yes to donations being in scope. If yes, the static link only.

## Decided against (recorded so nobody re-proposes them by accident)

| Idea | Decision (2026-10-16) |
|---|---|
| Early registration window for returning families | No: one fixed opening time for everyone (Q-R1) |
| Lottery for oversubscribed classes | No: first come, first served (Q-R1) |
| Volunteers self-pick crew spots | No: preferences + admin assigns (Q-V1) |
| Same-week waitlist backups | No: blocked (Q-W4) |
| Manual "confirm" step for registrations | No: auto-confirm (Q-P4) |
| Virtual waiting room / queue for the opening rush | Not needed at our scale (plan §2.3); revisit only if the spec 19 load test fails |
