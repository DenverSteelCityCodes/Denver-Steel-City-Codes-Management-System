# 29: Laptop loans

**Status:** 🟨 in progress (phase 1: database, parents, crew; phase 2: admin screens) · **Issue:** #149 · **Priority:** P0 · **Effort:** M · **Phase:** B
**Depends on:** 09 (templates; sending waits on 02) · **Unblocks:** none
**Plan reference:** [inbox findings](../research/inbox-findings.md) §1

## Why
Laptops were one of the top reasons families wrote in (50 threads, 2021–2026). The pattern repeats every year:
- **Late demand.** Districts collect school laptops in May, after families have registered, so requests spike after the kickoff email.
- **First come first served.** There are 10–30 loaners borrowed from the host school, given out in request order, and they stay on site.
- **Lost track.** One approved loaner never reached its class.
- **Day-1 surprise.** The coding platform turned out to be blocked on district student accounts the morning camp started.

What exists today is `students.laptop_available` (`migration_student_registration.sql:12`):
- **Wrong granularity.** It's one yes/no per camper, not per week.
- **Two meanings.** The wizard asks "Does your student have access to a personal laptop?" (`formFields.ts:55`). The yearly re-confirm asks "Can your camper bring a laptop each day?"
- **Can't be changed.** The camper card (`StudentCard.tsx`) doesn't offer it after registering.
- **Not visible to staff.** No admin screen, CSV, or `section_roster()` shows it.

## Decided rules
- A loan belongs to one **registration** (one camper, one week). Parents can request or withdraw it until the session starts.
- Each session has a loaner cap set by an admin. Requests past the cap wait in a laptop queue, first come first served ❓ (confirm).
- Loaners stay on site. Say so next to the request button.
- Any device with a browser and a keyboard works. Chromebooks are fine; iPads only with a keyboard. Show this before the request button.

## Scope: what to build
- `sessions.laptop_loaners int not null default 0`.
- `laptop_loans(registration_id uuid pk references registrations on delete restrict, status text check in ('reserved','queued','handed_out','returned','released'), requested_at, handed_out_at, returned_at, updated_at)`.
  - RLS: a parent reads their own campers' rows. Admins have full access. No direct client writes.
  - Add to the audit trigger.
- RPCs (SECURITY DEFINER, `SET search_path`, granted to `authenticated` only):
  - `request_laptop(p_registration_id)`: own registration only, seat-holding status only, before the session starts. Locks the `sessions` row `FOR UPDATE`, then reserves if reserved < cap, otherwise queues.
  - `release_laptop(p_registration_id)`.
  - `admin_set_laptop_status(p_registration_id, p_status)` for handed out and returned.
- Trigger: when a registration is cancelled (spec 06 statuses) or the cap goes up, release its loan and promote the oldest queued request for that session.
- **Parent UI.**
  - Wizard step 1: replace the `laptop_available` question with "Will your camper need to borrow a laptop at camp?" A yes creates a request for each new registration.
  - Camper card: per week, "Laptop: Reserved / In the queue (#3) / Not needed", with Request or Release inline. No modals.
- **Volunteer roster.** `section_roster()` gains `laptop_loan text` (reserved or handed_out only), and the print roster gets a 💻 column.
- **Admin.**
  - Sessions page: "Loaners: 18 / 25 reserved, 4 queued" and the cap editor.
  - Students list and CSV: laptop column.
  - Camp-day board: a hand-out checklist per section with a handed_out tick.
- **Emails** (outbox): `laptop_reserved`, `laptop_queued`, `laptop_promoted`, `laptop_released`, all with dedupe keys.
- Stop asking `laptop_available`. Keep the column read-only for past seasons, and let L4 retention clear it.

## Out of scope
- Asset tags or serial numbers per machine.
- Take-home loans.

## Done when
- [ ] With a cap of N, request N+1 is queued. Releasing one promotes the oldest queued request and emails that family.
- [ ] Cancelling a registration releases its laptop.
- [ ] Lead teachers see 💻 for their own campers only. Parents see the status on the camper card.
- [ ] Admins see per-session counts and can tick hand-out.

## Tests and verification
- SQL: two concurrent `request_laptop` calls for the last loaner. Exactly one is reserved (add to the seat-race script from spec 08).
- SQL: cancel → release → promote cascade. A parent can't request for another family's registration.
- Browser: request, then release on the camper card at 375 px and in dark mode.

## Open questions
- How many loaners in 2027, and will the host school lend them again? ❓ (non-code task).
- Is FIFO the right order, or should free/reduced-lunch families go first? Default: FIFO.

## As built (phase 1)
- FIFO by request time, the spec's default. **In use** = reserved + handed out; released and returned don't count.
- A handed-out laptop is never released automatically (a cancelled spot keeps it `handed_out` until an admin marks it returned), so the camp doesn't lose track of a machine.
- `admin_set_laptop_status` also takes `reserved`, only to undo a hand-out ticked by mistake.
- Moving a camper to another week takes the request along, keeping its request time.
- A section with no week (runs both weeks) can't take a loan: the request explains and gives the camp's email.
- The yearly re-confirm (class browser) stops asking `laptop_available` and points to Home; a returning camper borrows from the camper card.
- `my_laptop_loans()` gives the parent each week's status, place in the queue, and whether it can still change.

## Notes for the builder
- Add to the registration-day runbook (19): test the coding platform on a district student account two weeks before camp.
