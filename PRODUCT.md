# Product

<!-- impeccable:product-schema 1 -->

> Written 2026-10-17 by Claude from confirmed sources (docs/scc-improvement-plan.md, docs/specs/, design_system.md, CLAUDE.md, the live demo and the director's standing instructions). The director asked for the context to be supplied rather than interviewed for. Facts marked *(inferred)* were not confirmed in words.

## Platform

web

## Users

Three roles share one site. Each arrives in a different situation:

- **Parents and guardians** register their kids (rising 4th–9th graders, "campers") for a free summer coding camp. They are busy, often non-technical, and use **phone Safari or Chrome**, not an installed app. Registration opens at a fixed time in February 2027 and most families arrive in the first 15 minutes. Jobs: create an account, register a camper (5-step wizard) or re-register a returning camper, re-confirm details each camp year, see status (confirmed / waitlisted / offered), accept or decline a waitlist offer within 48 hours (12 hours in the final week), cancel or swap a class until 14 days before the session, see camp-week info (class, time, room, lead's first name, today's roll call), read updates.
- **Volunteers** teach the classes. Many are **teenagers (14–17)** with their own accounts; the rest are adults. Phone browser, often on their feet in a classroom. Jobs: apply and book an interview (signed out), wait as an applicant (interview time, reschedule), then once accepted: take roll call three times a day, see their section's roster with allergies and emergency phone numbers, claim duty slots, read updates, set availability and course preferences, request a switch. Admins assign them; they never self-pick.
- **Admins** (the Regional Director and 2–5 helpers) run the season from a **laptop**. Jobs: set up sessions/classes/sections, open registration at a set time, review volunteer applications and interviews, crew sections (with an auto-matcher pairing a senior and a junior per section), manage registrations, waitlist and change requests, post updates, watch camp-day roll call ("unaccounted" board), export attendance, manage users and roles, review history and undo.
- *(Later, after handoff)* a **national team** view across regions. Not built.

## Product Purpose

The site replaces email, spreadsheets and phone calls for running Steel City Codes' Denver summer camp: families get a seat without emailing the director, volunteers know where to be and who's in their room, and admins can run a season (and hand it to the national team) without being the bottleneck. Success in February: every family who wants a seat gets one or a fair, automatic waitlist place, with no lost registrations and no inbox flood.

## Positioning

A free, volunteer-taught coding camp run by a small regional team, where the database enforces the rules (capacity, age/grade fit, one class per week, waitlist order) so fairness doesn't depend on whoever is at the keyboard. The camp-week tools (roll call, allergies on the roster, the "unaccounted" board) exist because the same people who register kids also have to keep them safe in a room.

## Operating Context

- Season: two one-week sessions ("Week 1", "Week 2") in summer; classes (courses) split into sections (a week, days, time, room, capacity, age range, a lead and supports).
- Parents arrive in a rush at opening time on phones; they come back rarely (status checks, offers, camp week).
- Volunteers use it daily during camp week, standing in a classroom, with kids in front of them; roll call happens at fixed times.
- Admins use it in long sessions at a desk before the season and in bursts during camp week.
- Email is sent from the region's address `denver@steelcitycodes.org`; the in-app bell and updates feed also carry news.
- A public demo runs at scc.haanie.com with one-click demo logins for each role and fictional data that resets nightly; the director also shows it in their portfolio.

## Capabilities and Constraints

- React 19 + Vite + TypeScript + Tailwind v4 SPA on Supabase (auth, Postgres, RLS); no server code of its own. Deployed to Vercel.
- Terminology in use: camper, parent, volunteer (lead / support; senior / junior), applicant, session ("Week 1"), class (a course), section (one class in one week), seat, waitlist, offer, roll call, duty, update, region (Denver is a region of national SCC; "chapter" means a school-year club and is out of scope).
- Decided: auto-confirm (no pending step); parent self-cancel/swap until 14 days before; waitlist offers expire in 48h (12h final week); same-week waitlist backups blocked; fixed-time opening, no lottery; volunteers set preferences, admins assign.
- Standing instructions from the director: **no modals** (inline editing and inline confirms); **mobile-browser-first** for parents and volunteers (top tabs, not bottom bars, because iOS Safari's toolbar steals taps near the bottom edge; 16px inputs; 44px targets; `dvh` and safe-area padding; check at 375px in light and dark); profile and settings edits live under the avatar menu; avoid long scrolling pages; **UX passes add no new features**.
- Undecided: whether "pending" should exist at all in the UI (auto-confirm makes it vestigial); SMS (P2); the national view.

## Brand Commitments

- Name: **Steel City Codes // Denver**. Wordmark `{STEEL CITY CODES} //DENVER` in gold on ink (`assets/sccdenver.png`); never on the cream page or recolored.
- Brand gold `#F1C446` with ink text on it; never gold text on white.
- Josefin Sans / Josefin Slab come from the brand kit *(inferred: kit fonts; not confirmed as mandatory for UI text)*.
- Voice: friendly, plain-spoken, never jargon ("Let's get your camper signed up", not "Initiate enrollment workflow"). Warm for parents and kids; calm and efficient for volunteers and admins.

## Evidence on Hand

- Demo data only (73 campers, 9 sections, 28 volunteer applications, all fictional). No real testimonials, photos, metrics or partner logos exist; never fabricate them.
- The official waiver text, privacy policy and terms are pending from SCC national; the app must not invent legal copy.

## Product Principles

1. **No dead ends.** Every status a family or volunteer sees comes with the next thing they can do, or who to contact.
2. **The rules live in the system.** The UI shows the same fairness the database enforces (seats left, waitlist position, deadlines) honestly, never optimistically.
3. **Safety information wins the screen.** Allergies, medical flags, emergency contacts and who is unaccounted outrank everything else where they appear.
4. **Built for the phone in someone's hand.** Parents and volunteers act from a phone browser in a hurry; admins get density on a laptop.
5. **Nothing irreversible without a word first.** Inline confirmation and undo instead of interruptions.

## Accessibility & Inclusion

WCAG 2.1 AA is the target (specs L6, L6a). Many users are kids' parents on small phones; many volunteers are teenagers. Contrast tokens were raised to AA on 2026-10-17. Respect reduced motion. Dark mode is supported via a theme toggle.
