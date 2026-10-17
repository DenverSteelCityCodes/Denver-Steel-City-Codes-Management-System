# What the Denver inbox and Drive tell us (2021–2026)

Source: Google Takeout of `denver@steelcitycodes.org`, Oct 17 2026: about 2,950 emails and 14 Drive files. **Anonymized:** this file has counts and patterns only, with no names, emails or child details. The raw export stays outside the repo (the repo is public).

Counts are distinct threads (approximate), added up across the four email batches. Some threads may be counted twice where batches overlapped.

## 1. What generates the most email, and which spec fixes it

| # | Pain | ~Threads | Fixed by |
|---|---|---|---|
| 1 | **"Is my child registered? I got no confirmation"** (confirmations only went out after registration closed, about half of one mail merge failed to send, some went to spam, 4+ families who had "registered" had no record at all) | 60+ | 14 auto-confirm, 09 outbox, parent dashboard ✅ already |
| 2 | **Cancellations**, about half of them dropping just one of two weeks, many in the final 2 weeks; one cancellation was emailed but never recorded | 70+ | 06, 11 (must support **per-week** cancel and "which child?") |
| 3 | **Class or week changes** (wrong level picked, Java↔Python, different course in week 2; some families changed 3 times; ~60 "I've changed it in our system" replies) | 65+ | 12 swap; **gap:** a swap that moves *both weeks* at once |
| 4 | **Laptop loans** (schools collect laptops in May; there were 10–30 loaners, given first come first served, not allowed home; one approved loaner never reached the class) | 70+ | **gap → new spec** |
| 5 | **"When does registration open / add me to the list"** (Nov–Mar) | 45+ | **gap → interest list** (13 has the countdown only) |
| 6 | **Waitlist** (the policy changed every year, offers were hand-edited, one went out with the wrong child's details) | 40+ | 10, 10a ✅ planned |
| 7 | **Same course both weeks** (staff emailed each family to fix it) | 30+ | **gap → repeat-course warning** |
| 8 | **Group with friend/sibling** | 25+ | **gap → "place with" request** |
| 9 | **Late, after-close, or walk-in registration** | 15+ | **gap → admin "register on behalf"** that skips the deadline |
| 10 | **Duplicate submissions** (same child twice with different choices) | 8+ | 14 duplicate-camper report, 24 households |

## 2. Edge cases the specs don't cover yet

- **Eligibility.** Microcontrollers needs Intermediate Python **and** rising 7th grade or above (cap 20). Web Dev cap 25. The grade range drifted between "currently 4–8" and "entering 5–9" from year to year. Requests outside the range included a 3rd grader, a 14-year-old, and a request to waive the 7th-grade rule. → 23 should define **one** rule ("rising grade"), add per-course prerequisites, and allow an admin override that's recorded in the audit log. Also flag a missed prerequisite when a student skips week 1.
- **Volunteer's sibling.** Spots are reserved for volunteers' siblings, but a sibling must **not** be placed in the volunteer's own section. → a placement rule in assignments.
- **Accommodations.** A twice-exceptional camper's parent attends as an aide (needs a nearby workspace, wants to meet the teachers beforehand, and the same arrangement repeats each year). There are also ADHD, ASD, asthma, IEP/504 and vision notes. → a structured accommodations field visible only to the camper's assigned teachers (works with 04), plus a "parent on site" permission.
- **Allergies and diet.** Today these are free text mixing real allergies (nuts, EpiPen, penicillin) with preferences (halal, vegetarian). Blank means "none". → a structured list with severity and an EpiPen flag, kept separate from diet. Store "none" as an explicit answer.
- **Lunch.** Free lunch goes only to students eligible for free/reduced lunch. Parents misunderstood this, a lunch-ticket handoff failed, and there are allergy-safe meal needs. → an eligibility flag, a daily lunch roster, and a "no candy" flag.
- **Pickup.** Walk/bike-home permission (per day or for the week), grandparents, carpools, late carpools. A parent also asked directly about background checks. → **promote P2 B6** (authorized pickups) and add a dated "may leave alone" consent.
- **Partial attendance.** Late Monday, early Friday (missing the ceremony), day-1 illness, a whole week missed. → roll call needs late/early notes, and day-1 no-shows should free the seat for the waitlist.
- **Emergencies.** A swatting "hold" at the camp site and a secure-perimeter notice. → an **urgent broadcast** to every guardian of the current week, without waiting on the outbox queue.
- **Behavior/incidents.** A peer injury complaint escalated, and there was an inappropriate-video complaint. A warning → admin room → written notice policy exists only in email. → an incident log tied to the camper and the notification sent home.
- **Rooms change per session** (library chapters: 11 sessions across 4 rooms) and per week (camp). → location stored per section-week and per session, and a change notifies families.
- **Chapters limited to one school** and minimum enrollment to run a chapter → 20/23 chapter settings.
- **Language.** Several families write in Korean or Chinese, or in limited English. A funder sent bilingual notices. → plain-language emails with no image-only content; a Spanish version later.

## 3. Volunteer side

- The current flow is: application form → SignUpGenius interview slot (15 min, Zoom) → acceptance around May 3 → a checklist due within **24 hours** (info form with photo and bio for "Meet the Teachers", Discord, Remind, Drive access) → orientation around May 30, with a video for anyone who misses it. Volunteers who miss the deadline are removed.
- Problems: "where's the Zoom link" (~15), the sign-up page showing as expired, mixed-up times, one applicant never booked and never got a decision, rejections sent one at a time, acceptance emails sent with every recipient visible.
- Hours: a flat 40 per week. About 49 letters were written by hand on June 19, and some were still going out in September. Volunteers asked for their **legal name** rather than a nickname.
- → **Gaps:**
  - interview self-booking with reminders and a per-slot link
  - an onboarding checklist with deadlines
  - **promote P2 B2** (hours certificate) using a legal-name field
  - a teacher bio and photo plus name pronunciation (the "Meet the Teachers" PDF is a 20-page hand-made handout)
- Clearances are never mentioned in 5 years of email. That supports L7 (record them once national decides).

## 4. Operations outside registration (probably later or out of scope)

- **Grants.** The community foundation gives about $2,000–2,500 a year, with a demographics follow-up and a final report. The check went to national's Pennsylvania address and took about 3 months to recover. A simple grant tracker (deadline, report due, payment address) would help; the app's demographic aggregates could feed the report.
- **Reimbursements** were filed in a batch about 2 months after the June purchases, through national's form.
- **Facility.** The district rental calendar opens around Mar 15. Construction forced building moves. Rooms were confirmed the weekend before camp.
- **Partner outreach** went unanswered for months in places → a lightweight partner list with follow-up dates (backlog).
- **Former directors** still get parent emails → reply-to is always the chapter address (already a rule).

## 5. Roster data (for migration and the data model)

- 2026: **205 unique campers, 290 enrollments**. **61%** attended both weeks. About 40% share a surname with another camper (an upper bound on siblings).
- Courses by week (students): P1 78/33, P2 24/44, J1 25/25, J2 4/18, MC 13/19, WD 21/26. Sections hold 4–17 students, with 3–4 teen teachers each (about 1 per 4–5 students). Week 1 is intro-heavy and week 2 intermediate-heavy, confirming the intro→intermediate progression.
- Section codes look like `P1-1`, and the room changes by week.
- There are **no IDs**: students are matched across weeks by name, and a trailing-space bug once silently dropped a volunteer. Any import of past rosters needs fuzzy duplicate detection.
- The booklet count (one per enrollment plus teacher copies) can be calculated from enrollments instead of hand-entered formulas that don't add up.
- Camp schedule: Mon–Fri 9:00–3:15. Check-in 9:00–9:30, checkout 3:00–3:15. Volunteers start at 8:30. Kahoot assembly Monday, scavenger hunt Thursday, guest speakers + challenge + closing ceremony Friday.
- Use the **America/Denver** time zone everywhere (the old mail-merge script was set to New York time).

## 6. Season calendar (as it actually ran)

| When | What happens |
|---|---|
| Nov–Feb | "When are the dates?" emails; grant applications; facility cost estimates |
| ~Mar 9–16 | Registration opens; volunteer applications; school outreach; grant award |
| Late Mar–Apr | Changes, "am I registered?", laptop questions; interviews in the last week of April |
| ~May 3 | Volunteer decisions + 24 h onboarding checklist |
| ~May 11 | Registration closes → confirmations → laptop wave → waitlist offers → cancellations |
| ~May 27–30 | Kickoff email (lunch, pickup, pairing requests follow), orientation |
| First two weeks of June | Camp; day-1 problems; Friday ceremony |
| Mid–late June | Hours letters, donor thank-yous, national virtual camp promo |
| Aug–Oct | Chapter heads chosen, school-year chapters start; grant final report |

## 7. Security hygiene found in the inbox

- One Zoom meeting ID and passcode were reused for years and emailed to large groups.
- Bulk emails sometimes showed every recipient.
- The shared inbox holds third-party account codes and full parent mailing lists.
- Form editor links were sent to partners by mistake.

→ The outbox (09) should send one email per recipient, never a visible list. Interview links should be per slot. Point L5's access review at the shared inbox too.

## 8. Proposed tracker additions

New mini-specs to add to `docs/specs/` (priority to be decided):

1. **Laptop loans:** request per camper per week, editable after registration; an inventory cap per week; reserve, waitlist and release; shown on the roster. *(Top pain point, P0 candidate.)*
2. **Interest list / notify me:** a public sign-up that emails people when registration opens.
3. **Registration guardrails:** a repeat-course warning, per-course prerequisites, and a "place with friend/sibling" request.
4. **Admin register-on-behalf:** late and walk-in registrations that skip the deadline, recorded in the audit log.
5. **Health & accommodations:** structured allergies, diet, accommodations, lunch eligibility, no-candy; visible only to assigned teachers.
6. **Urgent broadcast + incident log.**
7. **Volunteer onboarding:** interview self-booking, checklist with deadlines, bio/photo/pronunciation, legal name.
8. Promote **P2 B6** (pickups) and **B2** (hours certificate) to P1.
9. Changes to existing specs: 11/12 handle per-week cancel and swap both weeks; 23 gets one "rising grade" rule plus prerequisites; 25 adds the volunteer-sibling placement rule.
