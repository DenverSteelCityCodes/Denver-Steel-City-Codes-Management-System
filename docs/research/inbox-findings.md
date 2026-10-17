# What the Denver inbox and Drive tell us (2021–2026)

**Source:** a Google Takeout of `denver@steelcitycodes.org` (Oct 17, 2026).
- 2,972 emails, after dropping spam and trash.
- 14 Drive files.
- A handful of attachments: the 2026–27 parents' flyer, the 2023 camp flyer, and one service-hour letter.

**Anonymized:** this file contains counts and patterns only, with no names, email addresses or child details. The raw export stays outside the repo, because the repo is public.

**Method:**
- The 2,972 emails form 1,682 Gmail threads.
- 1,150 of the emails are copies of 27 mass mailings. The registration confirmation alone was sent 204 times, the service-hour letter 52 times.
- **437 threads** involve a real person writing in. Each of those was read and tagged with one or more topics from a fixed list.
- Every count below is a number of **unique threads**, not messages. An earlier draft of this doc counted messages and overstated some topics about 2×.

**Checked against the code:** every finding was compared with `main` on Oct 17, 2026, so the "fixed by" column says what is actually built.

## 1. What people write about

Of the 437 threads, 276 are about summer camp, 69 about the school-year clubs, 53 about volunteering and 39 about the organization itself. 293 were started by parents. In 203 threads, staff had to fix a record by hand or hand-send something the app could do.

| Topic | Threads | In 2026 | Staff fixed by hand | Fixed by |
|---|---|---|---|---|
| "Am I registered? I got no confirmation" | 64 | 25 | 41 | ✅ 14 auto-confirm + dashboard status; emails go live with 02 |
| "When is camp / when does registration open / add me" | 64 | 21 | 31 | **30** public camp page + notify-me |
| Change class or week after registering | 52 | 24 | 43 | ✅ 12 (same week); **B10** both weeks at once |
| Logistics: times, building, what to bring, resend info | 50 | 16 | 21 | **30** public camp page |
| Laptops and devices | 50 | 39 | 42 | **29** laptop loans |
| Volunteer applications and interviews | 44 | 13 | 15 | **35** + bugs #144, #147, #148 |
| Cancellations (22 of 37 dropped one week of two) | 37 | 16 | 34 | ✅ 11 per-week cancel → ✅ 10 waitlist offers |
| Broken or confusing form and account links | 31 | 8 | 15 | ✅ the app replaces the forms; ✅ 03 password reset |
| Waitlist | 30 | 10 | 16 | ✅ 10, ✅ 10a |
| Late, after-close or walk-in registration | 29 | 3 | 12 | **32** admin register-on-behalf |
| Eligibility: grade, age, prerequisites | 29 | 7 | 14 | **31** course rules in the database |
| Same course picked for both weeks | 21 | 8 | 18 | **31** repeat-course warning |
| Place with a friend or sibling (or keep apart) | 21 | 9 | 18 | **31** "place with"; **B11** volunteer-sibling rule |
| Absences, late arrival, early pickup | 17 | 9 | 6 | **34** roll-call notes |
| Volunteer onboarding (forms, orientation, deadlines) | 14 | 3 | 7 | **35** |
| Health, accommodations, parent aide | 9 | 2 | 3 | **33** |
| Pickup people and walk/bike home | 8 | 3 | 5 | **36** (promoted from B6) |
| Duplicate submissions | 7 | 4 | 7 | ✅ 14 duplicate-camper report; 24 households |
| Lunch | 7 | 5 | 2 | **33** lunch list |
| Volunteer schedule changes | 7 | 2 | 2 | ✅ 25 |
| Incidents and safety | 4 | 2 | 0 | **34** |
| Volunteer hours letters (52 hand-made letters in 2026) | 3 | 3 | 3 | **B2** → P1 |

**When it happens:** 101 of the 276 summer-camp parent threads arrive in **May**, 48 in March and 42 in April. That is the stretch between registration closing and camp starting: confirmations, the laptop wave, cancellations and the kickoff email.

## 2. Edge cases worth designing for

**Registration and changes**
- **Missing records.** Families who believed they had registered had no record at all. A multi-page form was abandoned partway, or a sibling's submission was silently dropped. Staff reopened a closed form for single families days before camp.
- **The 2022 form bug.** The form left out the week-2 course question, so every two-week camper got the same course both weeks.
- **Repeat courses.** In later years staff caught same-course picks by hand and emailed screenshots to each family.
- **Swap mistakes.** A staff member moved a camper's week-1 class by hand and missed the matching week-2 change. Another time a class went over its cap to repair a mistake.
- **Conflicting capacity answers.** Some families were told a class was full while another got its "last spot".
- **The Microcontrollers rule.** It needs rising grade 7+ and Intermediate Python. Families found out after registering, and asked to waive it.
  - The app checks it in the browser and in swaps, but **not on insert** (spec 31 fixes this).
- **Grade wording drifted.** Different years said "currently grades 4–8" or "entering 5–9". The app already stores the grade the camper enters in the fall.
- **Volunteers' siblings.** They get reserved seats, but must not be placed in their volunteer sibling's section. Families asked for this twice.

**Laptops**
- In 2026 the district collected every student laptop for the summer. The camp could lend about 10 for roughly 120 campers a week, and staff gave them out in email order, reserving and releasing each one by hand.
- The coding platform was blocked on district student accounts. Staff found out on day 1.

**Health and safety**
- **A recurring aide.** A twice-exceptional camper's parent attends as an aide every year: a nearby workspace, a list of triggers, a call for every break. The details reached the teacher only because staff forwarded them by hand.
- **Unsafe lunch.** A free-lunch camper with a dye allergy refused the meals on offer.
- **A police hold.** The host school went on hold during week 2. Every family was emailed by hand.
- **A bullying notice.** One camper's parent heard about their own child from a neighbour, not from staff.
- **Volunteer conduct.** A volunteer showed an unsuitable video during a break.
- **A safety question.** A parent asked about volunteer background checks and CPR (see L7).

**Email itself**
- **Wrong child's name, twice.** Hand-edited emails to one family contained another family's child's name: once in a waitlist acceptance, once in resent kickoff info. The outbox templates (09) remove this risk.
- **Half a mail merge failed.** About half of one confirmation mail merge silently didn't send, and one confirmation listed the same class twice.
- **Years of bounces.** Mistyped addresses (".con", misspelled school domains) bounced for up to three seasons and nobody noticed (B12). Email-confirmed accounts prevent most of this.
- **A trailing space.** A trailing space in a spreadsheet dropped a volunteer from every mailing list.
- **Leaked meeting details.** One Zoom ID and passcode were reused for years and emailed to large groups. Some bulk emails showed every recipient.

## 3. Volunteers
- **Interviews:** application form → interview slot (15 min, video) → decision around May 3 → a checklist due within **24 hours** (info form with photo and bio, Discord, Remind, the shared folder) → orientation around May 30, with a video for anyone who misses it. People who miss the deadline are removed.
- **What went wrong:** "where's the interview link", expired sign-up pages, mixed-up times, an applicant who never booked and never heard back, and decisions that were never emailed.
- **Hours:** a flat 40 hours per week. 52 letters were made by hand in June 2026 and some were still going out in September. Volunteers asked for their legal name instead of a nickname.
- **The letter format** (from the attachment): date, "Volunteer Record / Service Hour Verification", "This is to certify that ‹name› has completed ‹N› hours of service during Week ‹n› (‹dates›) at Steel City Codes", the contact address, the signer's name and title, and a signature image. B2 reproduces this.

## 4. Out of scope for the app (decided 2026-10-17)
- **School-year clubs** (69 threads, plus 31 about club operations). In 2026–27 there are four weekly locations (three libraries and a charter school) with different days and times. Rooms change week to week, one club is limited to its host school, and partner schools send families their own forms. These stay on forms and email.
- **Grants and reimbursements.** The community foundation grant is about $2,000–2,500 a year, with a demographics follow-up and a final report. One check went to national's out-of-state address and took about 3 months to recover. Reimbursements were filed about 2 months after purchase.
- **Facility rental and partner outreach.** The district rental calendar opens around Mar 15, and construction forced building moves. Some outreach went unanswered for months.
- **National's virtual camp.** Parents emailed Denver for the class links, and only national had them.

**Naming:** SCC national calls each school-year club a **chapter**, with chapter heads, run under a Regional Director. So the plan now calls the Denver-level unit a **region** (spec 20).

## 5. The 2026 roster (Drive)
- **Size:** 205 unique campers, 290 enrollments. **61%** came both weeks. About 40% share a surname with another camper (an upper bound on siblings).
- **Courses by week (students):**

  | Course | Week 1 | Week 2 |
  |---|---|---|
  | Intro Python | 78 | 33 |
  | Intermediate Python | 24 | 44 |
  | Intro Java | 25 | 25 |
  | Intermediate Java | 4 | 18 |
  | Microcontrollers | 13 | 19 |
  | Web Dev | 21 | 26 |

  Week 1 is mostly intro and week 2 mostly intermediate, which confirms the intro → intermediate progression.
- **Sections** hold 4–17 campers with 3–4 teen teachers each, about 1 teacher per 4–5 campers.
- **Health tabs:** free text with merged cells. About 15% of campers list an allergy or diet, and about 10% a medical or learning need. A blank cell meant "none".
- **No IDs:** campers were matched across weeks by name. Booklet print counts were hand-entered and didn't add up.
- **The old mail-merge script** used New York time. The app uses America/Denver.

## 6. Bugs found in `main` while checking (filed Oct 17, 2026)
- [#143](https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/issues/143) Demoted volunteers keep volunteer access (P0)
- [#144](https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/issues/144) Interview slots and their notes are readable by every signed-in user
- [#145](https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/issues/145) "Parents" and "everyone" audiences include families from past seasons (P0)
- [#146](https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/issues/146) Change-request emails send volunteers to the parent dashboard
- [#147](https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/issues/147) Interview times show in the viewer's time zone
- [#148](https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/issues/148) The interview picker promises an email that is never sent

Smaller gaps folded into specs:
- The Microcontrollers rule is not enforced on insert (31).
- The yearly re-confirm saves only one of the two lunch answers (33).
- The laptop question means different things in two places (29).
- The venue is hard-coded (30).

## 7. Season calendar (as it actually ran)

| When | What happens |
|---|---|
| Nov–Feb | "When are the dates?"; grant applications; facility cost estimates |
| ~Mar 9–16 | Registration opens; volunteer applications; school outreach; grant award |
| Late Mar–Apr | Class changes, "am I registered?", device questions; interviews in the last week of April |
| ~May 3 | Volunteer decisions, then the 24-hour onboarding checklist |
| ~May 11 | Registration closes, then confirmations, the laptop wave, waitlist offers and cancellations (May is the busiest month) |
| ~May 27–30 | Kickoff email (lunch, pickup and placement requests follow); volunteer orientation |
| First two weeks of June | Camp; day-1 problems; Friday closing ceremony |
| Mid–late June | Hours letters, donor thank-yous, national virtual camp |
