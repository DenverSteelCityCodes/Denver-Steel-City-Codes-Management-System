# P2 backlog: mini-specs

**Status:** ⬜ none started · These come after the handoff work unless a decision moves one up. Each mini-spec is enough to open an issue from. When one is picked up, copy it into its own numbered spec file using the full template, and add it to the [tracker](README.md).

## B1. SMS reminders
- **For:** parents. **Why:** email is missed; comparables offer SMS ([SignUpGenius](https://www.signupgenius.com/blog/new-feature-text-messaging), [VolunteerHub](https://support.volunteerhub.com/support/solutions/articles/60000610954-can-i-send-text-messages-to-volunteers-through-volunteerhub-)).
- **Build:** opt-in checkbox with TCPA consent wording (counsel); `parent_profiles.sms_opt_in_at`; an SMS channel in the spec 09 outbox (Twilio or similar) for three templates only: offer made, offer expiring, camp starts tomorrow. Quiet hours 9 pm–8 am Denver. STOP handling.
- **Done when:** opted-in parents get those three texts; nobody else does; STOP works.

## B2. Volunteer hours certificate
- **For:** teen volunteers (school service hours).
- **Build:** hours = crewed days × section hours (from `sections.start_time/end_time` and roll-call days), plus duty slots; a "My hours" card and a printable or PDF certificate signed by the chapter; admin can adjust (logged).
- **Done when:** a volunteer downloads a certificate matching the admin's records.

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

## B6. Authorized-pickup list
- **Context:** deliberately left to phone + ID check in the camp-week audit. Revisit with national's safety policy ([CampMinder example](https://help.campminder.com/en/articles/7238589-get-to-know-paperless-attendance)).
- **Build (if approved):** `authorized_pickups(student_id, name, relation, phone)` edited by parents; shown on the dismissal roll call; the volunteer ticks which adult picked up (recorded on the mark).
- **Done when:** dismissal records who picked each camper up.

## B7. Magic-link sign-in (Q-A2)
- **Build:** "Email me a sign-in link" on `/login` (`signInWithOtp`), alongside passwords. Uses the spec 02 templates.
- **Done when:** a parent can sign in with no password from a phone.

## B8. First login lands in the wizard (Q-A1)
- **Build:** if a parent has no campers and no draft, the first visit to `/parent` goes straight to `/parent/register` with a short welcome line.
- **Done when:** a brand-new family reaches step 1 without hunting for "Add camper".

## B9. Drop the unused `attendance_logs` table
- **Context:** replaced by roll calls (camp-week audit, owner decision 5). Nothing reads it.
- **Build:** export it once (CSV) for the record, then drop the table and its policies in a migration.

---

## Decided against (recorded so nobody re-proposes them by accident)

| Idea | Decision (2026-10-16) |
|---|---|
| Early registration window for returning families | No: one fixed opening time for everyone (Q-R1) |
| Lottery for oversubscribed classes | No: first come, first served (Q-R1) |
| Volunteers self-pick crew spots | No: preferences + admin assigns (Q-V1) |
| Same-week waitlist backups | No: blocked (Q-W4) |
| Manual "confirm" step for registrations | No: auto-confirm (Q-P4) |
| Virtual waiting room / queue for the opening rush | Not needed at our scale (plan §2.3); revisit only if the spec 19 load test fails |
