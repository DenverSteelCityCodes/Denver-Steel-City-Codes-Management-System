# What the Denver Discord server tells us (2021–2026)

**Source:** an export of the region's Discord server (Nov 1, 2026).
- 104 channels and threads, 104,939 messages, from 2021 to 2026.
- Three kinds of channel: **leadership channels** (directors, organizers and leads), **volunteer channels** (announcements and volunteer chat) and **school-year channels** (the clubs).

**Anonymized:** this file contains counts and patterns only, with no names, handles, email addresses, phone numbers, links or child details. Channels are described by kind, never by name. The raw export stays outside the repo, because the repo is public and many members are minors.

**Method:**
- The messages were split into **4,373 conversations**: a new conversation starts after a 6-hour gap in a channel or thread.
- **3,999** conversations were read and tagged against a fixed topic list. The other **374** were social only (greetings, memes, games). They were counted, not read.
- **3,098** of the tagged conversations are about work. The rest are social talk inside work channels.
- Findings from each theme were merged into **62 findings** (M01–M62). **1,323** conversations support at least one of them. One conversation can support several.
- Every count below is a number of **unique conversations**, never messages.

**Checked against the code:** every finding was compared with `origin/main` at `d046434` (Nov 1, 2026) by an independent code review, with spot checks of the cited lines. Where the review showed the app already does something, the finding below says so and asks only for what is missing. The review found 10 findings whose premise was wrong (section 7). The "In the code" column cites `file:line` at that commit.

## 1. Season numbers

From leadership chat. "About" marks a number someone estimated in chat, not a count. "Registered" is unique campers. The 2022–2025 totals were compiled by a lead from memory in 2026. 2021 uses the count posted in chat that summer, and 2026 uses the Drive roster's 205 unique campers ([inbox findings](inbox-findings.md) §5).

| Year | Registered | Cap | Opened | Closed | Show-up evidence | Volunteers and ratio |
|---|---|---|---|---|---|---|
| 2021 | About 80 | About 60 (per week or per camp was never settled) | Form held until a venue was confirmed (mid-April); date not recorded | About May 28 | About 80 signed up, about 65 attended (about 81%) | Not recorded for camp |
| 2022 | 108 | 100 (about 50 a week) | Apr 4 (about 15 on day one) | Apr 16 at 101; waitlisted families admitted in May | About 60 in week 1 and 80 in week 2 (late April); 63 week-1 certificates | 30 applied against a target of 25; about 1:5 to 1:7, 2–3 teachers a class |
| 2023 | 191 | About 200 a year | Mar 2 (the evening before the planned day) | Form shut about Apr 23, briefly reopened; officially closed May 13 with no waitlist | About 130 campers a week (early May) | 35 applied, about 30 needed a week; about 1:4 |
| 2024 | 156 | 150 (class cap 20) | Mar 9 (about 100 within a day) | At capacity about Mar 25; waitlist of 24 by May 13 | Draft rosters about 125 (week 1) and 129 (week 2) | About 22–24 teachers; a draft 1:9 was judged too high; target 1:6 to 1:8, no class worse than 1:7 |
| 2025 | 167 | 150 (class cap 20) | About Mar 1–4 | May 11; week 2 closed early (about May 4) and reopened without notice May 10 | About 100 by May 4 | Not recorded; late applications taken because of a shortage |
| 2026 | 205 | 200, first come first served (called both "200 per week" and "200 cap") | Mar 14 | May 11 or at the cap | Not recorded | Not recorded; target about 45 a week for 1:4 |

**What it shows:**
- Unique campers registered against the cap as stated that year: 2024 and 2025 ended over it (156 and 167 against 150 unique campers). 2026 ended about at the cap (205 against 200, which was stated both per week and overall).
- No year recorded a show rate after 2021, and no year recorded volunteers per week as a count.
- Camp was two one-week sessions in the first two weeks of June in every year checked: 2021–22, 2024 and 2026 (M59).

## 2. What the conversations are about

The biggest findings by conversations:

| Finding | Conversations |
|---|---|
| Volunteer onboarding chased one person at a time (M08) | 107 |
| Staffing math by hand: ratios, teachers per course, unassigned volunteers (M09) | 101 |
| Service hours: no attendance record, hand-made letters (M10) | 99 |
| Org accounts and shared logins tied to individuals (M01) | 86 |
| Interview notes, scores and decisions scattered (M11) | 82 |
| Every season rebuilt from memory (M12) | 77 |
| Families asking about dates; opening waits on the venue (M13) | 73 |
| Absences leave sections short of teachers (M14) | 73 |
| Who must interview changes every year (M15) | 73 |
| Volunteers don't know the day's plan (M16) | 70 |

Of the 62 findings, 43 draw more than half their conversations from leadership channels, 13 from volunteer channels and 1 (M10) from school-year channels; the other 5 (M14, M18, M19, M24, M52) are mixed, with no kind over half. The school-year channels were used only where a lesson carries over to camp (for example, half of M10's evidence is club service hours).

## 3. Findings, by the spec they change

Status words: **built** (the app does it), **partly** (some of it is built), **spec only** (planned in a spec, not built), **missing** (nothing yet). Longer build notes for each finding are in the spec's "From the Discord findings" section.

### Spec 09: email outbox

| Finding | Conv. | Years | What to change | In the code |
|---|---|---|---|---|
| M50 Families admitted late, or whose email went to spam, miss earlier announcements | 15 | 2022, 2024, 2026 | When a seat starts being held after a week's announcements or the kickoff went out, queue those to that family once and show them on their dashboard. A "Resend to this family" action on the sent log. Ship B12 before camp week. Every mass email goes one per family through the outbox. | Partly. Individual notices and a sent/failed log exist (`migration_notifications.sql:72`, `src/components/EmailLog.tsx:39`). Ordinary week announcements still open the admin's mail app (`src/components/UpdateComposer.tsx:115`). No catch-up, resend or bounce webhook. |

### Spec 10: waitlist offers (merged)

| Finding | Conv. | Years | What to change | In the code |
|---|---|---|---|---|
| M27 Waitlist run as side forms and sheet rows | 53 | 2022–26 | Offers keep running after a session starts, per spec 10's decided rules. A 2025-06-09 chat decision to stop joins and offers at session start is open question Q-D14. Staff and volunteer families queue behind the waitlist unless an admin names an override (spec 32). | Partly. Offers, 48-hour windows and the decided order are built (`migration_waitlist_offers.sql:53`, `:192`). `/camp` already shows waitlist-only and full states (`migration_public_camp_page.sql:98`, `:150`). No session-start cutoff. |

### Spec 11: change requests (merged)

| Finding | Conv. | Years | What to change | In the code |
|---|---|---|---|---|
| M17 Double, conflicting and missed replies to families from a shared inbox | 69 | 2021–26 | Don't build a help desk. Add a "claimed by" owner to change requests and the other admin queues (laptops, pickups, absences) so two admins never work one request. The family page lists every email sent to that family, plus short contact notes. Spec 26: run the shared address as a collaborative inbox with individual logins and retire the chat-forwarding bot. | Partly. Requests already have open/done/declined, a resolution note, resolver and time, and resolution emails go through the outbox (`migration_parent_changes.sql:78`, `:130`). No owner or per-family history. |

### Spec 12: parent swap (merged)

| Finding | Conv. | Years | What to change | In the code |
|---|---|---|---|---|
| M37 Class and week changes done by hand; rosters go stale | 28 | 2021–26 | Parent swaps stay same-week (decided); parent cross-week moves are open question Q-D15, and B10 covers both weeks at once. A phone-sized admin quick move at the check-in desk. When an admin moves, adds or cancels a camper inside the change window or during camp week, email both section leads and tag the camper "joined today" or "moved out" on the roll call and print roster. Add `withdrawn` to change-request status. | Partly. Parents swap within a week (`migration_parent_swap.sql:54`). Admins can already move a registration to any section, including the other week (`src/hooks/useAdminStudents.ts:166`). No lead emails, tags or withdrawn state. |

### Spec 13: season settings (merged)

| Finding | Conv. | Years | What to change | In the code |
|---|---|---|---|---|
| M21 Volunteer application window: no fixed close, late applicants handled ad hoc | 65 | 2021–26 | Scheduled open and close times for volunteer applications, shown on `/apply` and `/camp`. After the close, an optional "late application" that lands marked late for one-click decision. An optional per-week target that switches the form to a standby list. A volunteer option on notify-me (30). A receipt email and draft autosave (35). | Partly. A manual switch is enforced in RLS (`migration_security_hardening.sql:220`). The apply page has a success screen (`src/pages/VolunteerApplyPage.tsx:396`) and College is a grade option (`src/lib/applyForm.ts:6`). No schedule, late or standby path, or receipt email. |
| M22 Registration close and late exceptions handled by hand | 63 | 2021–26 | `season_settings.registration_closes_at`, enforced for non-admins like the opening time. After it, `/camp` and the class browser say "Registration closed" with notify-me and "Request a late spot". A required reason on the emergency form switch, shown in History. A family's late request goes to spec 11's queue; the only insert is spec 32's `admin_register()`, behind the waitlist unless an admin names an override. | Partly. Opening time and the emergency switch are enforced (`migration_one_class_per_week.sql:95`, `:106`), and switch flips are already audited (`migration_audit_log.sql:88`). No closing time (`migration_season_settings.sql:14`) and no named-override register. |
| M30 Caps set by gut; no season capacity picture | 51 | 2021–26 | Extend the dashboard grid with unique campers per week, rooms and crewed volunteers, and pace against last year. A pre-opening warning for sections with no room. An optional per-week camper cap that warns, never blocks. Make an audited capacity raise the only way admins overfill. | Partly; premise wrong. Live seat totals and a week/course/section grid exist (`src/pages/AdminDashboard.tsx:55`, `:87`). Capacity is required and positive (`migration_sections.sql:15`). Audited raises already trigger offers (`migration_waitlist_offers.sql:113`). Admins can still overfill directly (`src/pages/AdminStudents.tsx:166`). |

### Spec 14: alerts and duplicates (merged)

| Finding | Conv. | Years | What to change | In the code |
|---|---|---|---|---|
| M14 Absences, late arrivals and withdrawals leave sections short | 73 | 2021–26 | A minimum-present check: "Section below minimum crew on <date>" (crew minus absences against spec 39's minimum, default 2), with cover suggestions that know the course's language and list senior floaters first. Spec 25: arrive-late and leave-early times, a "running late" note, an email to co-crew on each absence, and self-service "Withdraw my application" and "Step down for the season". | Partly; premise wrong. The alert already fires for lead **and** support absences (`migration_volunteer_role_gate.sql:167`, `src/hooks/useAdminAttention.ts:223`). Admins can already add absences for anyone (`migration_volunteer_self_service.sql:81`). Volunteers can already add a week through availability (`migration_volunteer_role_gate.sql:39`). |
| M28 No confirmations and fragile forms | 52 | 2021–26 | Covered by 14, 16, 09, 18 and 31. Left: the venue and bring list in the confirmation email (09, 30) and registration as one write (17). | Partly; overstated. Auto-confirm, the confirmation template, drafts, search and DB course rules exist (`migration_one_class_per_week.sql:130`, `src/lib/registrationDraft.ts:1`). Saves are still separate writes (`src/pages/ParentRegistrationPage.tsx:653`). The confirmation lacks venue and bring list (`supabase/functions/send-notifications/templates.ts:31`, `:140`). |
| M40 Duplicates from nicknames, misspellings and two guardians | 26 | 2021–26 | A tolerant match (same last name plus the same grade or school, or a shared phone or emergency contact) at add-camper time and in spec 32, including two camper rows under one parent. Build spec 24 before February; its merge keeps the earliest seat and sends the family a change request to pick the class. | Partly. The report matches normalized full names across parents with the same grade or school (`migration_auto_confirm.sql:35`). It misses nicknames, typos and same-parent duplicates. Date of birth isn't collected (Q-P2), so it can't be used yet. |

### Spec 19: load test and runbooks

| Finding | Conv. | Years | What to change | In the code |
|---|---|---|---|---|
| M51 Opening-day volume is small | 15 | 2022–26 | No change. Day one has ranged from about 15 signups (2022) to about 100 (2024), far below the 500-parent test, which supports the deferred waiting room. | Partly. The scheduled opening and serialized capacity checks exist (`migration_one_class_per_week.sql:73`, `:95`). The load test itself is not built (`docs/specs/19-load-test-runbook-dry-run.md:15`). |

### Spec 29: laptop loans

| Finding | Conv. | Years | What to change | In the code |
|---|---|---|---|---|
| M02 Loaners after the start: late requests, daily hand-out, chargers, damage | 50 | 2021–26 | Close the waitlist gap: a "needs a laptop" answer for a waitlisted week becomes a request when the offer is claimed. Record the charger and a "damaged" status with a note. An end-of-week "not returned" list and a per-section end-of-day count. Show crew their section's loaner count on Today. | Partly; premise partly wrong. Admins can already request after the start and hand out over the cap (`migration_laptop_loans.sql:207`, `:304`) from the attendance board (`src/pages/AdminAttendance.tsx:331`). The waitlist gap is real (`src/pages/ParentRegistrationPage.tsx:688`). |

### Spec 30: public camp page

| Finding | Conv. | Years | What to change | In the code |
|---|---|---|---|---|
| M13 Families ask about dates months early; opening waits on the venue | 73 | 2021–26 | Add the usual "first two weeks of June" line to the unset-dates state (information, never invented dates). Use the same "Place to be announced" wording in the wizard and emails. Queue one `location_changed` email when an admin first sets or changes a session's location. A pre-opening checklist card (spec 13). | Partly; premise wrong. `/camp` already says the dates aren't set and offers notify-me (`src/pages/CampPage.tsx:137`, `:179`). Location is nullable and shows "Place to be announced" (`migration_public_camp_page.sql:33`, `src/pages/CampPage.tsx:265`). The confirmation omits the venue (`migration_notifications.sql:98`). |
| M36 Venue facts change every year; site disruptions reach families by hand | 38 | 2021–26 | A season venue record (building and rooms). "Rooms needed vs booked" on Classes. A per-day location (spec 40's day table) shown on `/camp` and Today, which prompts a spec 34 notice. An internet-outage plan in 19 and 26. | Partly. Session location, section rooms, schedule-item locations and urgent notices exist (`migration_public_camp_page.sql:33`, `migration_camp_week_ops.sql:38`, `:46`). No venue record or per-day location. |

### Spec 31: course rules

| Finding | Conv. | Years | What to change | In the code |
|---|---|---|---|---|
| M05 Prerequisites, repeats and kit-limited caps checked from memory | 33 | 2021–26 | Import 2026 completions as past-year registrations. The existing exception request stays as it is. A reverse-order warning and admin list. `classes.default_capacity` so new sections of a kit-limited course inherit their cap. | Partly. Prerequisites accept an earlier week this year **or any past year** (`migration_course_rules.sql:153`). Exception requests (`:213`), repeat warnings and an at-risk report (`src/lib/courseRules.ts:111`, `migration_course_rules.sql:313`) exist. Only campers with no in-app history are stuck in 2027. |
| M31 Device and platform needs discovered late | 51 | 2021–26 | Show the class requirement note in the wizard's course choice and in confirmation and kickoff emails. Offer a loaner only where the class allows it (29), with a suggested cap of about 25% of campers. Add a venue-network check to spec 19. | Partly; premise partly wrong. The note already shows in the class browser and on `/camp`, which has device and bring-list FAQs (`src/lib/courseRules.ts:92`, `src/pages/CampPage.tsx:288`, `:322`). District-account testing is already in spec 19 (`docs/specs/19-load-test-runbook-dry-run.md:21`). The wizard doesn't show it (`src/pages/ParentRegistrationPage.tsx:1196`). |
| M49 Grade wording drifted; out-of-range children registered | 16 | 2021–22, 2024–26 | One season-level eligible range, stored as the fall grade and enforced on insert for every class; a class's `grades_allowed` narrows it. All wording comes from that setting. Current 9th graders are pointed to `/apply`. | Partly. Rising-grade wording is central (`src/lib/formFields.ts:53`). Section age bands are enforced (`migration_one_class_per_week.sql:121`), but they check age only, so a section whose band includes a 2nd grader's age admits one. No season range. |
| M61 "Place with" requests kept as sheet notes | 8 | 2022–25 | No change. B11 still holds the volunteer-sibling warning. | Built (`migration_course_rules.sql:54`, `:248`; `src/pages/AdminStudents.tsx:384`). |

### Spec 33: health and lunch

| Finding | Conv. | Years | What to change | In the code |
|---|---|---|---|---|
| M03 Allergies and support needs don't reach whoever hands out food | 42 | 2022–26 | Quick-pick allergens (peanut, tree nut, gluten, dairy, egg, food dye) before free text, and gluten-free, nut-free and no-dye diets. Badges and candy consent (never lunch eligibility) on the lunch list and a per-section food sheet for snacks and prizes. An admin to-do to brief the lead when a parent or aide will be on site. | Spec only. Rosters show free text today (`migration_authorized_pickups.sql:357`, `src/pages/PrintRoster.tsx:188`). The "parent or aide on site" wording is already in spec 33 (`docs/specs/33-health-and-accommodations.md:35`). |
| M34 Provided lunch counted by hand | 41 | 2021–26 | Admin lunch totals per session and day (diet and allergy counts), ready the day before for 24-hour preorders. Lunch duty can mark "forgot lunch". An end-of-lunch "not handed out" list. | Partly; premise partly wrong. Eligibility and "wants lunch" are already separate answers (`migration_student_registration.sql:22`, `src/pages/ParentRegistrationPage.tsx:1103`), and eligibility stays off crew rosters (`migration_authorized_pickups.sql:353`). Lunch list unbuilt. |
| M54 Health info doesn't follow campers when classes merge or a substitute covers | 9 | 2022–23, 2025–26 | A dated, audited cover or merge set by an admin gives that day's roster, with badges, to the substitute or host crew, ending at midnight. Class candy and anaphylaxis counts on Today. | Missing. Roster access follows crew assignment only (`migration_authorized_pickups.sql:378`). |

### Spec 34: announcements, incidents, roll calls

| Finding | Conv. | Years | What to change | In the code |
|---|---|---|---|---|
| M07 No "past families" audience for the yearly opening email | 12 | 2023–26 | A "Past families" audience for announcements only. It respects `email_opt_out`, drops families whose campers are all too old, and merges with notify-me signups. Opt-out covers announcements only; safety and transactional mail still go. | Partly. `email_opt_out` and notify-me with an opening notice exist (`migration_notifications.sql:47`, `migration_public_camp_page.sql:21`). Family audiences are current-season only (`migration_volunteer_onboarding.sql:917`). |
| M19 Must-read notices missed; emoji as read receipts | 67 | 2021–26 | "Needs confirmation" on crew updates with a "Got it" per volunteer, "12 of 15 confirmed" and a once-a-day nudge. A correction replaces the old notice on Today. Every crew update emailed through the outbox. Volunteer audiences limited to this season's accepted volunteers. | Partly. Urgent crew notices use the outbox (`migration_volunteer_onboarding.sql:940`); ordinary "Also email" is a mail link (`src/components/UpdateComposer.tsx:115`). Volunteer audiences include past seasons (`migration_volunteer_onboarding.sql:922`). |
| M32 Volunteer conduct, rejections and removals not recorded | 50 | 2021–26 | Link an incident to a subject volunteer (admin-only for conduct) and to several sections. A volunteer's admin record lists incidents, dated warnings and an end-of-camp evaluation. Reapplication review shows all of it. A "Do not re-accept" flag. | Partly. Conduct incidents, private volunteer notes and removal reasons exist (`migration_urgent_and_incidents.sql:294`, `migration_review_hardening.sql:117`, `migration_volunteer_onboarding.sql:313`). |
| M41 Camper behaviour and injuries handled by message, with no running count | 21 | 2021–26 | Levels `parent_called` and `sent_home`, kind `property`. A behaviour-incident count per camper per week; any discipline ladder is SCC to confirm (Q-D16). A "see admin before class" marker (no details) on a later section's roster. Duty-slot holders can report. Same-day parent notice for injuries. | Partly. Kinds, levels, parent notice and audit exist (`migration_urgent_and_incidents.sql:288`, `:376`). The untold alert waits 24 hours (`src/hooks/useAdminAttention.ts:184`). |
| M44 Planned absences and early pickups arrive by email | 20 | 2021–26 | A parent "Tell the camp" on the camper card (absent, arriving late, leaving early) that shows on the roll call and admin board. A weekly show rate (B17). | Partly; premise partly wrong. Crew **and admins** write roll-call notes (`migration_urgent_and_incidents.sql:435`). Parents can't, and the setter needs an existing mark (`:449`). |
| M47 A school hold coordinated in chat with conflicting instructions | 17 | 2021–23, 2026 | A crew "Site hold" template, acknowledgement on urgent crew notices with a list of unconfirmed sections, an "All clear" that ends the banner, and a venue emergency card on Today. | Partly. Urgent crew notices and a same-day banner exist; the hold text is family-facing (`src/lib/urgent.ts:9`, `:25`). |
| M55 Post-camp survey, recap and lost-and-found sent late by hand | 28 | 2021–24, 2026 | A scheduled `camp_survey` email the day after camp, reusable announcement drafts, and a lost-and-found template with a claim deadline. | Missing. Week audiences exist (`migration_volunteer_onboarding.sql:932`). |
| M62 Attendance link changed daily | 8 | 2021–23 | No change. B9 (drop `attendance_logs`) is still to do. | Built. Today opens the day's roll calls (`src/pages/volunteer/VolunteerToday.tsx:49`); `attendance_logs` remains (`schema.sql:57`). |

**Edge cases that matter for building 34:**
- During a hold, crew can't leave their rooms, so acknowledgement must work from a phone in one tap, and the director needs the list of rooms nobody has confirmed.
- A behaviour record must follow a camper from week 1 to week 2 without showing week-1 details to the new crew.
- Complaints arrive through other channels (a lead's family, a personal messaging app). An admin needs to record them against the camper.

### Spec 35: volunteer interviews and onboarding

| Finding | Conv. | Years | What to change | In the code |
|---|---|---|---|---|
| M04 Vetting gaps: side-door volunteers, age, unsigned forms | 37 | 2021–26 | Date of birth and "graduated / adult" status; a minimum volunteer grade above the top camper grade. Prior applications shown on review. A verified "signed volunteer agreement" task required before crewing, leads and organizers included. Adults on crew per day. Clearances wait on Q-L9. | Partly; premise partly wrong. The form already asks age, grade (College included) and signatures, with a guardian under 18 (`src/lib/applyForm.ts:6`, `:90`, `:139`). The crewing guard only refuses removed volunteers (`migration_volunteer_onboarding.sql:703`). |
| M08 Onboarding items chased one person at a time | 107 | 2021–26 | Optional fixed due dates; reminder emails before due and once overdue, and "Remind all overdue". A yearly "Confirm your profile" task. A "No chat app" flag. A clear-face photo hint. An admin crew directory. | Partly; premise partly wrong. Editable help links, due times, done and verified states and removal from the overdue list exist (`migration_volunteer_onboarding.sql:444`, `src/components/AdminOnboarding.tsx:255`). Removal already emails (`:692`). |
| M11 Interview notes, scores and decisions scattered | 82 | 2021–26 | A season question list; per-interviewer rubric scores and a recommendation; a non-final "hold" status; a required admin-only decline reason; a "needs a strong co-teacher" flag; a "decision sent" status. | Partly; premise wrong. Bookings have private admin notes and accepted volunteers an admin-only notes table (`migration_interviews.sql:22`, `migration_review_hardening.sql:117`). Decisions email one by one (`migration_volunteer_onboarding.sql:606`). |
| M15 Who must interview changes every year | 73 | 2021–26 | A per-season interview rule (everyone / new only / waive with N accepted seasons) with a "Returning: N seasons" badge. Waived applicants skip booking and get a receipt email. An audited admin override. | Partly. The applicant status tracker exists (`src/pages/volunteer/VolunteerApplicant.tsx:55`); only a "volunteered before" yes/no is stored (`schema.sql:88`). |
| M18 Orientation RSVPs by emoji; attendance never recorded | 68 | 2021–26 | An event task type (dates, place, RSVP), reminders, bulk attendance that ticks the task and feeds B2, and an automatic make-up task. | Missing (`migration_volunteer_onboarding.sql:444`). |
| M20 Folders and links shared one email at a time | 65 | 2021–26 | A "Crew resources" list by audience (all crew, course, week). An optional "email for shared folders". A Share card with QR codes for `/camp` and `/apply`. A "not re-applied" CSV. | Partly. Folder links are onboarding tasks and `/camp` and `/apply` are stable routes (`migration_volunteer_onboarding.sql:502`, `src/App.tsx:74`). |
| M23 Interview booking: broken links, no-shows, lost reschedules | 63 | 2021–26 | Parallel panels per slot, a cancellation cutoff, notices when an admin edits a booked slot, and an interview outcome (attended / no-show / missed by us) with one rebook email. | Partly; premise wrong. One booking per slot and per application, application first, future slots only and self-move are built (`migration_interviews.sql:24`, `migration_interview_self_booking.sql:26`). Moves email (`migration_volunteer_onboarding.sql:153`), and "times not posted yet" exists (`src/pages/volunteer/VolunteerApplicant.tsx:164`). |
| M24 Returning volunteers re-enter everything | 58 | 2021–26 | "Apply again for <season>", prefilled, one per season. Graduation year. A "Past volunteers" audience and an "applications are open" email with applied/not-applied tracking. | Missing. Existing accounts are told to sign in or use another email (`src/pages/VolunteerApplyPage.tsx:281`). |
| M26 No interviewer roster; conflicts of interest | 55 | 2022–26 | Interviewers per slot (lead or shadow), at least two, recusal, an alert for a booked slot with no lead interviewer. | Missing (`migration_interviews.sql:6`). |
| M39 Volunteer policies typed from memory and never acknowledged | 27 | 2021–26 | A versioned volunteer handbook (SCC's text) and a "Read and acknowledge" task that reopens on a new version. No vaccination or test records. | Missing; premise wrong. Applicants already sign a volunteer waiver, with a guardian under 18 (`src/pages/VolunteerApplyPage.tsx:654`, `src/lib/applyForm.ts:139`). |
| M43 Fields leads wished the application had | 21 | 2022–24, 2026 | Preferred camper age, preferred role, an admin-only "rather not pair with", other youth programs, shirt size on the profile, a role description above the form. Demographics only after L1 review. | Partly; premise wrong. Languages, six skill ratings, motivation, child experience, shirt size, course ranks and phone are already collected (`schema.sql:78`, `:82`, `:87`). |
| M45 Contact details travel through personal channels | 20 | 2021–23, 2025–26 | Opt-in co-crew and lead contacts, visible to that section's crew only. An RLS test that parents can't read volunteer contacts. An on-duty lead phone on Today. Class emails through the outbox. | Partly. `meet_the_crew()` shows no contacts (`migration_volunteer_onboarding.sql:793`). The print roster offers parent-email copying (`src/pages/PrintRoster.tsx:115`). |

**Edge cases that matter for building 35:**
- A volunteer accepted late (week 2 only, after orientation, during camp) needs due dates counted from crewing, and an automatic orientation make-up.
- A waived interview never waives the application, the signed agreement or (if Q-L9 says so) clearances.
- An interviewer related to an applicant must be able to recuse, and the slot then shows as uncovered.
- A removed or "do not re-accept" volunteer who applies again is shown with their history, not silently accepted by another lead.

### Spec 36: authorized pickups

| Finding | Conv. | Years | What to change | In the code |
|---|---|---|---|---|
| M46 Pickup and walk-home permission on paper and in chat | 18 | 2021–24, 2026 | No change. Curbside drop-off and late parents are procedures, not records. | Built (`migration_authorized_pickups.sql:60`, `:115`, `:261`). |

### Spec 38: duty minimums

| Finding | Conv. | Years | What to change | In the code |
|---|---|---|---|---|
| M33 Lunch and duty supervision planned in docs and chat | 43 | 2021–26 | A minimum and a post label per duty slot, with a "needs N more" badge. A room-check type and zero-minute one-day activity types. An admin duty roll call that feeds minutes and B2. "Offer my slot" (B5), with admin approval inside the 3-day lock. | Partly. Custom dated duties, capacity, locks and weekly minutes exist (`migration_duties.sql:22`, `migration_duty_minimums.sql:22`). Today's length check is 5–480 minutes (`migration_duty_minimums.sql:23`). |

### B2: volunteer hours certificate

| Finding | Conv. | Years | What to change | In the code |
|---|---|---|---|---|
| M10 Service hours: no attendance record, flat credits, hand-made letters | 99 | 2021–26 | 40 hours per camp week (8 per crewed day), as advertised. An admin screen for absences and partial days, past dates included, and a "did not run" flag on a camp day. Audited adjustments with a reason. The bonding deduction from that 40; whether orientation is credited on top is open (Q-D2). "Report a mistake", an hours lock, letters a school can check, bulk send, multi-season totals. | Partly; premise wrong. Admins can already insert and edit absences for anyone, past dates included (`migration_volunteer_self_service.sql:81`); only volunteers are limited to today or later (`migration_volunteer_role_gate.sql:34`). Missing: the admin screen and all of B2, which is unbuilt. |

**Decided 2026-11-01:** The weekly credit is 40 hours per camp week (8 per crewed day). The bonding rule (director, 2026-11-01) deducts 5 hours per week volunteered from that 40 when the volunteer never attended bonding. Whether orientation is credited on top stays an open question (Q-D2). Bonding attendance needs a sign-in record (M18's event task) for this to be automatic.

### L3: photo flag

| Finding | Conv. | Years | What to change | In the code |
|---|---|---|---|---|
| M06 Photo opt-outs live in leads' heads | 27 | 2021–24 | Keep L3, and add the camper flag to the export used for social posts. A separate volunteer "OK to appear in camp social posts" tick, off by default. No camp photos stored in the app (profile photos stay). | Spec only. Volunteer photo consent covers parent viewing only (`src/components/VolunteerProfileSection.tsx:156`). |

### L5: security runbook and access review

| Finding | Conv. | Years | What to change | In the code |
|---|---|---|---|---|
| M01 Org accounts and logins tied to individuals | 86 | 2021–26 | An accounts-and-renewals register (domain, Supabase, Vercel, email provider, shared mailbox, social account), each with two owners, a renewal date and authenticator 2FA; recovery codes in an org password manager only for services that issue them. Supabase Auth has none, so app admin recovery stays another admin's reset with at least two MFA-enrolled admins (27). Confirm the domain is renewed before spec 02 relies on it. | Partly. Admin TOTP, MFA status and colleague recovery exist (`migration_admin_mfa.sql:20`, `:32`, `:50`). The runbook reviews shared credentials and dashboard access (`docs/runbooks/security-incident.md:128`). Two admins are only recommended (`docs/specs/27-admin-mfa.md:38`). |
| M35 Leadership turns over every summer; access never removed | 41 | 2021–26 | Invites, a 60-day inactivity flag and a "review by" date on Users. The L5 review also runs in June at handoff. Volunteer access ends with the season unless accepted again (needs a decision). | Partly. Users and roles, promotion, MFA status and last sign-in exist (`src/pages/AdminUsers.tsx:112`, `src/hooks/useAdminUsers.ts:45`). Role changes are audited and release crew and duties (`migration_volunteer_role_gate.sql:208`). The runbook review already runs when someone leaves (`docs/runbooks/security-incident.md:121`). |

### Spec 22: seasons with any number of weeks

| Finding | Conv. | Years | What to change | In the code |
|---|---|---|---|---|
| M59 Two one-week sessions every year | 14 | 2021–22, 2024, 2026 | No change. Denver runs the first two weeks of June, so spec 22 stays P1 (answers part of Q-H4). | Built for two weeks (`migration_sections.sql:16`). |

### Spec 25: volunteer self-service (merged)

| Finding | Conv. | Years | What to change | In the code |
|---|---|---|---|---|
| M29 Assignment quality depends on leads' memory | 52 | 2021–26 | Make the matcher and crew editor use the skill ratings and course ranks the app already has. Warn on a low self-rating, two part-timers together, an all-part-time crew, an avoid-pair, or no experienced volunteer. Per-day availability. An admin note on each crew assignment. | Partly; premise wrong. Languages, six 1–5 skill ratings and ranked courses are collected and shown to admins (`schema.sql:89`, `src/pages/AdminVolunteers.tsx:175`). The matcher ignores them (`src/lib/volunteerMatcher.ts:59`). |
| M38 Volunteers learn their class only by asking | 27 | 2021–26 | `crew_assigned` and `crew_changed` emails to the volunteer, co-crew names on the card, a "published on" date, and a refresh after changes (17). | Partly. Cards already show class, section, week, room and times (`src/hooks/useAssignedClass.ts:153`). The `new_lead` email goes to families only (`migration_volunteer_self_service.sql:149`). |

### Spec 26: admin guide

| Finding | Conv. | Years | What to change | In the code |
|---|---|---|---|---|
| M12 Every season rebuilt from memory | 77 | 2021–26 | "Start next season": copy classes and rules, sections (capacity and room, no crew), duty rules, onboarding tasks and email and form text; shift dates; copy no family data. Season notes. A dated season calendar and a year-end handoff checklist. Built before go-live like everything else (Q-G1); first used in summer 2027. | Partly. CSV exports exist (`src/pages/AdminStudents.tsx:382`, `src/pages/AdminVolunteers.tsx:25`, `src/components/AttendanceExport.tsx:50`). Spec 26 already lists setup and wrap-up checklists (`docs/specs/26-docs-and-admin-guide.md:14`). No season copy. |

### New spec 39: staffing board

| Finding | Conv. | Years | What to change | In the code |
|---|---|---|---|---|
| M09 Staffing math by hand: ratios, teachers per course, unassigned volunteers, room clashes | 101 | 2021–26 | Per week: campers per crew for each section against a target, teachers needed per course against crewed and willing volunteers, accepted volunteers with no section, and a database refusal of two sections in one room. | Partly. Seats, capacity, crew and a crew picker grouped by availability exist (`src/hooks/useAdminClasses.ts:77`, `src/lib/sectionCrew.ts:74`). Sections already have rooms (`migration_camp_week_ops.sql:42`). No ratios, demand or clash check. |
| M53 Non-teaching week roles (admin room, floater, check-in) are invisible | 10 | 2022, 2024–25 | A per-week role outside sections (admin room, floater; check-in stays a duty type), counted on the board, suggested first as cover (seniors only until Q-V2), and credited by B2. | Missing. Check-in exists as a duty type, not a week role (`migration_duties.sql:13`). |

### New spec 40: crew day plan

| Finding | Conv. | Years | What to change | In the code |
|---|---|---|---|---|
| M16 Volunteers don't know the day's plan: call time, entrance, lunch, changes | 70 | 2021–26 | Per camp day: crew call time, meeting point and any location change; crew-only schedule items; a "Before camp" card and crew FAQ; a night-before email; "assignment viewed". | Partly; premise partly wrong. Today already shows room, teaching times, duties and the day's schedule (`src/pages/volunteer/VolunteerToday.tsx:38`, `:105`). The schedule is shared with parents and public (`migration_public_camp_page.sql:132`). No crew call time or crew-only items. |

### New spec 41: on-call help

| Finding | Conv. | Years | What to change | In the code |
|---|---|---|---|---|
| M48 No on-call path when a teacher needs help; requests sat for hours | 17 | 2021–26 | A "Need help" button on Today that reaches whoever holds today's on-call duty (or all admins) and stays open until someone taps "On my way". | Missing. An admin can create an "On-call" duty type, but nothing routes to it (`migration_duties.sql:22`). |

### P2 backlog: B14–B20

| Finding | Conv. | Years | What to change | In the code |
|---|---|---|---|---|
| M52 Registered campers who never came kept their seats (B14) | 14 | 2021–25 | A "still coming?" email before the change deadline, a day-one "absent, no note" list, and an admin "mark no-show and release" if leads decide seats can move after day one. | Partly. Cancelling already frees and offers a seat (`migration_waitlist_offers.sql:98`). The "one in five" rate is an estimate from chat, not app data. |
| M42 Camper certificates made by hand the night before (B15) | 21 | 2021–25 | One print-ready PDF per section from roll calls, reissue on demand. | Missing. Roll calls supply the data (`migration_camp_week_ops.sql:67`); B2's renderer doesn't exist yet. |
| M25 Day-of printables rebuilt by hand and stale (B16) | 56 | 2021–26 | A print pack from live data: check-in sheet, door signs, name tags, loaner labels, allergy sheet, booklet counts, "changes since last print". | Partly. A live section print roster exists (`src/pages/PrintRoster.tsx:149`, `:157`); it doesn't render pickups. |
| M56 Season numbers compiled by hand (B17) | 28 | 2021–26 | A season report: registered, attended, show rate, repeat campers, fill, loans, lunches, volunteers and hours, year over year, with CSV. | Partly. Referral answers (`src/pages/ParentRegistrationPage.tsx:46`) and the attendance CSV exist (`src/components/AttendanceExport.tsx:122`). Optional gender and background fields already exist (`migration_student_registration.sql:13`). |
| M57 Platform accounts and booklet counts rebuilt from the roster (B18) | 25 | 2021–26 | A per-week roster CSV laid out for bulk platform accounts, a materials-count card, and the season's platform in settings. | Partly. The camper CSV omits camper email (`src/pages/AdminStudents.tsx:382`). |
| M60 Shirt counts compiled by hand (B19) | 11 | 2022–23, 2026 | A per-week size tally from seated campers and crewed volunteers, two-week campers once, with a diff. | Partly; premise partly wrong. Sizes are already collected on registration and the application (`migration_student_registration.sql:11`, `schema.sql:82`). |
| M58 Donation asks at fixed moments, never tied to a seat (B20) | 17 | 2022–26 | Only if Q-P5 is answered yes: a static `donation_url` setting on `/camp` and the post-camp email, never near a seat. | Missing (`migration_season_settings.sql:14`). |

## 4. What's new

**New specs** (Phase B, not started):
- [39](../specs/39-staffing-board.md) **Staffing board.** Campers per crew per section against a target, teachers per course, unassigned volunteers, a room-clash refusal and non-teaching week roles (M09, M53).
- [40](../specs/40-crew-day-plan.md) **Crew day plan.** Call time, meeting point, crew-only schedule items, crew FAQ and a night-before email on volunteer Today (M16).
- [41](../specs/41-on-call-help.md) **On-call help.** A "Need help" button that reaches today's on-call admin and shows "On my way" (M48).

**New P2 backlog items** ([backlog-p2.md](../specs/backlog-p2.md)):
- **B14** Still-coming check and no-show release (M52).
- **B15** Camper certificates from roll calls (M42).
- **B16** Print pack: check-in sheets, signs, tags, labels, from live data (M25).
- **B17** Season report: show rate, repeats, fill, year over year (M56).
- **B18** Roster exports for platform accounts and materials counts (M57).
- **B19** Shirt size tally (M60).
- **B20** Donation link (M58).

Every other finding extends an existing spec. Each spec lists its additions in a "From the Discord findings (2026-11-01)" section, or "Follow-ups from the Discord findings" for specs already merged.

## 5. Needs a decision

The leads changed these rules from year to year. Each has a recommended default, which a spec uses if nobody decides first. They are also in the plan's [§6](../scc-improvement-plan.md#still-open) as Q-D1 to Q-D16.

| # | Question | What the leads did, by year | Recommended default |
|---|---|---|---|
| Q-D1 | Who must interview? | 2022: everyone, returners included; from Apr 2022 to 2025: returners exempt (2024: trusted referrals too; 2025: returners re-interviewed if they taught poorly); 2026: every past volunteer after a problem volunteer, leads exempt; 2026-05-03 (chat): from 2027, 2+ prior seasons skip | Waive with 2+ prior accepted seasons (the 2026-05-03 chat rule); anyone with a conduct note or "do not re-accept" flag interviews (spec 35, M15) |
| Q-D2 | How are service hours credited, and can they be docked? | 2021: teaching time only; 2022: an 8-hour day; 2023: planning counts; 2024–26: a flat 40 a week, on flyers; 2025: minus poor attendance; 2026: bonding deduction | The weekly credit is 40 hours per camp week (8 per crewed day). The bonding rule (director, 2026-11-01) deducts 5 hours per week volunteered from that 40 when the volunteer never attended bonding. Whether orientation is credited on top stays an open question (Q-D2). Admin adjustments only with a written reason, audited; prep and setup count only if logged as events (B2, M10) |
| Q-D3 | Ratio and minimum crew per section | 2021: about 1:6; 2022: 1:5 to 1:7, two teachers present; 2024: 1:6 to 1:8, none worse than 1:7; 2026: 1:4, 3 teachers for specialty courses | Target 1:4, minimum 2 crew per section, 3 for Microcontrollers. Warnings, never blocks (spec 39) |
| Q-D4 | Late volunteer applications | 2022: declined; 2023: reopened while slots remained, none for week 2; 2024: considered with an interview; 2025: accepted by email because of a shortage, still interviewed | Accept after the close as "late" for an admin decision, still under the interview rule; an admin can limit late applications to weeks marked short (spec 13, M21) |
| Q-D5 | Is orientation required for returners? | 2021: required for all; 2022: returners may skip; 2023 and 2025: required, absentees make it up | Required for everyone; absentees and late accepts get a make-up task due before day one; the per-event "returners may skip" toggle defaults off (spec 35, M18) |
| Q-D6 | Camper grade range | 2021: incoming 4th–8th; 2022: up to current 8th; 2024: current 4th–8th; 2025: 4th and up, 9th graders are volunteer age; 2026: entering 5th–9th | Entering grades 5–9 in the fall, stored as the fall grade; current 9th graders are pointed to volunteering (spec 31, M49) |
| Q-D7 | Is the cap per week or per camp, and do volunteers gate seats? | 2021: 60, unclear; 2022: 100, waitlist only with a volunteer surplus; 2023: about 200, closed once for lack of volunteers; 2024–25: 150 unique campers; 2026: "200 per week" and "200 cap" both used | The cap is per week and section capacity is the only hard limit. Offers stay automatic as built; a section under ratio shows on the staffing board instead of pausing offers (specs 10, 13, 39) |
| Q-D8 | Which duplicate registration wins? | 2021: the highlighted class; 2024: ask the family, delete if the classes match; 2026: keep the latest; spec 24: keep the earliest | Keep the earliest seat (first come, first served) and send the family a change request to pick the class (spec 24, M40) |
| Q-D9 | Open registration before the venue is confirmed? | 2021: no; 2024: opened early because of parent emails; 2026: release waited on facilities, opening with the location unspecified debated | Allow it. "Place to be announced" is already built; add the `location_changed` email. The pre-opening checklist warns but doesn't block on the venue (spec 30, M13) |
| Q-D10 | Volunteer access after the season | 2023: past volunteers moved to a "retired" chat role; 2024: retired organizers removed; 2025: a removed volunteer still had access; 2026: nobody removed, retired role keeps access | In-app volunteer access to current-season views ends with the season unless the person is accepted again; profiles and history stay. Chat alumni are outside the app (L5, M35) |
| Q-D11 | Can a volunteer be moved out of a course they listed? | 2025: yes, out of specialized classes, and volunteers should ask if they can't teach it; 2026: assigned outside preferences to cover demand, then a volunteer who listed a class keeps it | The apply form says "we may place you in any course you pick". A low self-rating warns the admin, never blocks; a move gets an admin note (spec 25, M29) |
| Q-D12 | Who is exempt from vetting? | 2021: organizers had a free pass; 2022: every new volunteer applies and interviews; 2023: all sign-ups through the official form; 2026: leads exempt from interviews, six volunteers joined week 2 without signed forms | Everyone crewed, leads and organizers included, has an accepted application and a verified signed agreement for the season. The interview waiver is separate. Clearances follow Q-L9 (spec 35, L7, M04) |
| Q-D13 | Official channel for volunteer notices | 2022–24: a text-alert app, required at onboarding; 2023: chat and email; 2026: group chat replaces the text-alert app | App email through the outbox is the one official channel, with "Got it" on must-read notices. Chat stays informal. Volunteer SMS waits; B1 stays parents-only until decided, with guardian consent for minors if extended (spec 34, B1, M19) |
| Q-D14 | Should waitlist joins and offers stop once a session starts? | 2025-06-09 (chat): stop at session start. Spec 10's decided rules (Q-W2) keep offers moving, and the built expiry email says families can rejoin | Keep the decided rules until §6 records a change. B14's day-two release then frees and offers a seat like any cancellation (spec 10, B14, M27, M52) |
| Q-D15 | May parents move a registration to the other week themselves? | 2021–26: week changes made by hand on request. Spec 12's decided rules are same-week only | Keep same-week only; changing weeks stays cancel-and-register, or B10 for both weeks in one step (spec 12, M37) |
| Q-D16 | Is there a written camper discipline ladder? | 2026: a "three strikes, then the admin room" rule mentioned in chat | SCC to confirm. Until SCC writes a rule, the app counts behaviour incidents per camper per week and encodes no next step (spec 34, M41) |

## 6. Safety and privacy practices to fix

These came up again and again from 2021 to 2026. The dated list stays with the director, outside this public repo; here are the practices the app and the runbooks should make routine.

- **Org accounts.** Every org account (domain and DNS, email, social) belongs to the region, with two named owners and authenticator 2FA, and recovery codes in an org password manager for services that issue them (app admins recover through another admin's reset). Rotate shared credentials at every handoff, and never share them in chat or sheets (L5, M01).
- **Access when people leave.** Remove server, drive and site access for anyone who leaves, and review who is in staff spaces each season (L5, M35).
- **Camper data.** Rosters and family contacts live only in the site, scoped to each section; no lists in chat or open spreadsheets, and camper login details never in chat. Record do-not-contact requests (04, 33, 34, L4, M07).
- **Volunteer contact.** Families reach staff only through the region address. Volunteers' personal numbers stay off shared sheets and are never given to families (35, M45).
- **Supervision.** A minimum headcount at lunch and duty posts, no camper alone in a room, a way for a teacher to call for help, and urgent notices that each class acknowledges during a hold (38, 41, 34).
- **Allergies.** Allergy and diet details go with whoever serves food or covers a class (33, M03, M54).
- **Vetting.** No volunteer works with campers before signed forms and the agreed screening, and interviewers step aside for people they're related to (35, L7, M04, M26).
- **Photos.** Opt-outs show on rosters, and volunteers consent before their photo is posted (L3, M06).

## 7. What the code review corrected

These findings claimed something was missing that the app already does. Each is rewritten above to ask only for the gap.

| Finding | The claim | What the code does |
|---|---|---|
| M10 | Admins can't record past-date absences | They can (`migration_volunteer_self_service.sql:81`). Missing: an admin screen and the B2 math |
| M13 | No "dates not set" state; location can't be "to be confirmed" | Both exist (`src/pages/CampPage.tsx:137`, `:265`) |
| M14 | The coverage alert fires only for the lead | It fires for lead and support absences (`src/hooks/useAdminAttention.ts:223`). Missing: a minimum-present check |
| M17 | Change requests have no handled state | They have done and declined, with resolver and time (`migration_parent_changes.sql:78`). Missing: an owner |
| M23 | Booking rules, reschedules and "no slots" messaging are missing | One booking per slot and application, future slots only, self-move with email and "times not posted yet" all exist (`migration_interview_self_booking.sql:26`) |
| M28 | Specs 09, 14, 16, 18, 31 replaced all of it | Registration still saves in separate writes (spec 17), and the confirmation lacks venue and bring list |
| M29 | The application has no language skill levels | It collects six 1–5 ratings (`schema.sql:89`); the matcher ignores them (`src/lib/volunteerMatcher.ts:59`) |
| M30 | No live seat counts; sections can lack a capacity | Live counts exist and capacity is required (`src/pages/AdminDashboard.tsx:87`, `migration_sections.sql:15`) |
| M39 | Volunteers agree to nothing in writing | They sign a waiver on the application (`src/pages/VolunteerApplyPage.tsx:654`) |
| M43 | The application lacks languages, motivation and shirt size | All are collected (`schema.sql:78`–`:87`) |

Partial corrections folded into the rows above: M02 (admins can already hand out loaners after the start), M04 (age and College are already asked), M08 (done states and removal emails exist), M11 (private interview notes exist), M16 (Today already shows the room), M31 (the device note already shows on `/camp`), M34 (the lunch answers are already split), M44 (admins can write roll-call notes), M60 (shirt sizes are already collected).

## 8. Out of scope for the app

Most of the server is school-year club work, which stayed out (decided 2026-10-17, [inbox findings](inbox-findings.md) §4). It was used only where a lesson carries over to camp.
- **School-year clubs:** recruiting club heads, sign-up sheets, library room booking, rides, closures, school-only eligibility.
- **Grants and money:** grant applications and reports, bank accounts, reimbursements, budgets and donor tracking. National holds the money. The app supplies season numbers (B17) and at most a donation link (B20, only if Q-P5 says yes).
- **Facility rental:** venue hunting, booking portals, fees, keys, insurance, hiring the paid on-site adult. The app stores only the location, rooms and per-day notes.
- **National's programs:** the virtual summer camp, monthly regional check-ins, national's accounts and award forms (the app exports verified hours, B2).
- **Also out:** curriculum and coding-platform choice, shirt vendors and supplies (a size tally is in, B19), photo galleries and social posting (consent flags only), chat-server administration and bots, a help desk inside the app, volunteer social events, and vaccination records.
