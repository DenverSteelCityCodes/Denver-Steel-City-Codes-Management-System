# Camp-week gap audit — 2026-09-30

Walk of one season on branch `feat/camp-week-ops` (stacked on `fix/qa-hardening`, PR #57).
"Today" = how the operation happens before this branch. "Close with" = the smallest change that
gives the app a record or a one-tap channel. ✅ = built on this branch; 📱 = deliberately left to
text/email/phone (the app only puts the channel one tap away); ⏭ = out of scope.

| Phase | Operation | Who | Today | Close with | |
|---|---|---|---|---|---|
| Setup | Create sessions, courses, sections (ages, capacity, week, crew) | Admin | App (`/admin/sessions`, `/admin/classes`) | — | ✅ existing |
| Setup | Give each section days, times, room (#41) | Admin | Nothing: sections have no schedule columns | `sections.days/start_time/end_time/room`, editable in the section form | ✅ |
| Setup | Daily camp schedule (drop-off, blocks, lunch, pickup) | Admin | Nothing; sent by email as prose | `schedule_items` per session, inline editor on `/admin/sessions` | ✅ |
| Setup | Volunteer duty slots | Admin | App (`/admin/duties`) | — | ✅ existing |
| Registration | Register, waitlist, confirm, move, cancel | Parent, admin | App | — | ✅ existing |
| Registration | Collect emergency contacts, allergies, medical | Parent | App | — | ✅ existing |
| Volunteers | Apply, interview, accept, match crews | Applicant, admin | App | — | ✅ existing |
| Pre-camp | "What's my kid's class, when, where, who's teaching?" | Parent | Email/text from admin | Parent dashboard "This week" card: class · time · room · lead's first name + the day's schedule | ✅ |
| Pre-camp | Welcome / logistics message to everyone or one section | Admin | Email blast from a personal inbox, no record | `updates` table; compose on `/admin/updates`; shows on dashboards + bells; "Also email" opens the mail client with recipients filled (clipboard fallback) | ✅ |
| Pre-camp | Per-section parent email list | Admin, lead | Hand-built from spreadsheets | "Copy all emails" on the printable roster and on updates | ✅ |
| Camp day: drop-off | Who has arrived? | Volunteer | Check-in button per camper (one state, no named moment) | Named roll calls (arrival / after lunch / dismissal): mark all present, untick the missing | ✅ |
| Camp day: drop-off | Camper not here; call parent | Volunteer, admin | Phone | `tel:` on every roster row (existing) + on the admin "unaccounted" board | ✅ |
| Camp day: drop-off | Parent running late tells camp | Parent | Text/call to admin | 📱 keep: phone number of the camp is the channel; a late-arrival form adds no record anyone acts on | 📱 |
| Camp day: class | Lead sees roster, allergies, medical, emergency phone | Volunteer | App | — | ✅ existing |
| Camp day: class | Paper fallback when phones/Wi-Fi fail | Volunteer, admin | None | Printable section roster with emergency contacts + medical flags (`/print/roster/:sectionId`) | ✅ |
| Camp day: lunch | Headcount after lunch | Volunteer | Nothing | "After lunch" roll call | ✅ |
| Camp day: after lunch | Is every camper accounted for across camp? | Admin | Walk the rooms / text leads | `/admin/attendance`: live board of unaccounted campers per section with parent `tel:`; refetch on focus + 60 s poll | ✅ |
| Camp day: pickup | Dismissal headcount / release | Volunteer | Check-out button | "Dismissal" roll call | ✅ |
| Camp day: pickup | Parent: "is my camper checked in / dismissed?" | Parent | Text the lead | Parent dashboard shows today's roll-call status per camper | ✅ |
| Camp day: pickup | Someone other than the parent picks up | Parent, volunteer | Text/call | 📱 keep: authorised-pickup lists need ID checks that no app field replaces; emergency contact is already on the roster | 📱 |
| Camp day: any | "What we did today" to the section's parents | Lead | Nothing, or a group text | Lead posts a section update from the volunteer dashboard; parents see it on their dashboard + bell | ✅ |
| Camp day: any | Incident / injury report | Volunteer | Call admin | 📱 keep: phone first; a written incident form is a liability document the owner should design | 📱 (owner decision) |
| Camp day: any | Volunteer is sick / can't come | Volunteer | Text admin | 📱 keep: text; admin reassigns in `/admin/classes` (existing) | 📱 |
| End of week | Attendance record for the week | Admin | Nothing | CSV export per session from `/admin/attendance` (camper, section, day, each roll call) | ✅ |
| End of week | Thank-you / survey to families | Admin | Email | Post an update with "Also email" | ✅ (via updates) |
| Next year | Roll sessions forward, parents re-confirm campers | Admin, parent | App (sessions + yearly confirmation) | — | ✅ existing |
| Next year | Archive this year's roll calls | Admin | — | Marks are keyed by date; CSV export is the archive | ✅ |
| Any | Push / SMS / chat / photos / payments / calendar sync | — | — | ⏭ out of scope by brief | ⏭ |

## Decisions taken without the owner (simplest option picked)

1. Roll calls are a fixed set of three (`arrival`, `after_lunch`, `dismissal`). Admin-editable
   roll-call names would need another table and editor for little gain.
2. A section's schedule is `days` (free text, default "Mon–Fri"), `start_time`, `end_time`, `room`.
   No per-day variation; camp weeks are uniform.
3. The daily schedule is per session (same every day of that week). A per-day schedule can be
   added later by giving `schedule_items` a `day` column.
4. Updates have four audiences: everyone, parents, volunteers, one section. Leads may post only to
   their own section. Updates can be deleted by their author or an admin; no editing.
5. "Also email" is client-side only: `mailto:` with BCC filled when the list fits in a URL
   (under about 1,800 characters), otherwise the addresses are copied to the clipboard.
6. The old check-in / check-out buttons are replaced by roll calls on the volunteer dashboard.
   The `attendance_logs` table and its policies stay (nothing else reads them).
7. Demo seed: Week 1 is the current Mon–Fri (next Mon–Fri when reset on a weekend), Week 2 the
   week after. Roll calls are seeded for the days already past this week plus this morning's
   arrival, with a few campers left unaccounted so the admin board has something to show.
