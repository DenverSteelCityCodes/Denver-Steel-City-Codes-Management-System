# 36: Authorized pickups and walk-home consent

**Status:** 🟨 in review · **Issue:** #156 · **Priority:** P1 · **Effort:** M · **Phase:** B (before go-live)
**Depends on:** 04 ✅, 05 ✅ · **Unblocks:** none
**Plan reference:** [inbox findings](../research/inbox-findings.md) §2; promotes backlog B6 (decided 2026-10-17)

## Why
- **Pickup arrangements live in email.** There were 8 pickup threads in five years: a relative picking up on two days, carpool adults signing a camper out, a camper biking or walking home alone, and alternate adults for drop-off.
- **The written permission policy has nowhere to live.** The kickoff email requires a parent to sign the camper out, or written permission to leave alone. That written permission arrives by email and never reaches the volunteer at the door.
- **The dismissal roll call can't record who picked up.** It exists (`roll_call_marks.roll_call = 'dismissal'`, `migration_camp_week_ops.sql:67-78`), but only as present/absent.

## Decided rules
- Parents list the adults who may pick up each camper. The parent account holder is always allowed.
- Leaving alone (walk, bike, transit) needs a **dated consent** from the parent: for the whole session or for specific days. With no consent, a camper is released only to a listed adult.
- At dismissal, the volunteer records **who** collected each camper (a listed adult, or "left alone (consented)"). An unlisted adult means the volunteer checks with an admin. The app never blocks a release, it records it.

## Scope: what to build
- **Pickups table:** `authorized_pickups(id, student_id, name, relation, phone, days date[] null, created_at, updated_at)`. `days` null = any day; else only those dates (built: the "Done when" needs a Wednesday-only grandparent, which the original column list couldn't hold).
  - RLS: the parent owns it; admins have full access; volunteers read through the roster RPC only.
  - Audited.
- **Release consents:** `release_consents(id, student_id, session_id, mode text check in ('walk','bike','transit','other'), days date[] null (null = every day of the session), note, consented_by, consented_at)`. Same RLS and audit.
- **Parent UI:** a "Pickup" section on the camper card, editable until the end of the session, so a same-day change still works.
  - Pickup adults: name, relation, phone.
  - "May leave on their own": session or specific days, how they get home.
- **Wizard:** a short step after emergency contacts, which can be skipped ("Only I will pick up").
- **Volunteer roster:** `section_roster()` gains `pickup_adults jsonb` (name and relation, plus phone for the lead only) and `may_leave_alone_today bool`.
- **Dismissal roll call:** `roll_call_marks.released_to text` and `released_mode text check in ('listed_adult','parent','alone','admin_ok')`.
  - Built: `released_ok_by` names the admin who said OK. A recorded release stands until it is undone on purpose (no overwrite, no marking absent while collected), and release changes are audited.
  - Picking a listed adult is one tap.
  - "Someone else" asks for a name and shows "Check with an admin first".
- **Admin:** today's dismissal board shows unreleased campers and any `admin_ok` releases. The CSV includes who collected each camper.
- **Email:** when a parent adds a same-day pickup adult or consent during camp week, email the section lead (`pickup_changed`, outbox). Built: at most one per camper, section and 10 minutes, saying only that the list changed (the roll call shows the current list).

## Out of scope
- ID scanning or QR codes.
- Custody orders (handled by staff and the parent directly; the accommodations field in 33 can flag "see admin").

## Done when
- [ ] A parent adds a grandparent for Wednesday only, and the lead sees it on Wednesday's dismissal list.
- [ ] A camper with no consent can't be marked "left alone" without the "admin ok" path.
- [ ] Dismissal records who collected every camper. The admin board shows anyone not yet released.
- [ ] RLS: a volunteer sees pickup adults only for their own section's seated campers.

## Tests and verification
- SQL: the RLS matrix (parent, own-section lead, other-section volunteer, admin); the dated-consent check by day.
- Browser: the dismissal roll call at 375 px, one-handed.

## Open questions
- Does national have a release policy (minimum age to leave alone, ID check)? ❓ Default: Denver's kickoff-email rule.
