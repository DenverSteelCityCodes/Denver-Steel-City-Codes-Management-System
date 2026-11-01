# P2 backlog: mini-specs

**Status:** ⬜ none started · These come after the handoff work unless a decision moves one up. Each mini-spec is enough to open an issue from. When one is picked up, copy it into its own numbered spec file using the full template, and add it to the [tracker](README.md).

## B1. SMS reminders
- **For:** parents. **Why:** email is missed; comparables offer SMS ([SignUpGenius](https://www.signupgenius.com/blog/new-feature-text-messaging), [VolunteerHub](https://support.volunteerhub.com/support/solutions/articles/60000610954-can-i-send-text-messages-to-volunteers-through-volunteerhub-)).
- **Build:** opt-in checkbox with TCPA consent wording (from SCC); `parent_profiles.sms_opt_in_at`; an SMS channel in the spec 09 outbox (Twilio or similar) for three templates only: offer made, offer expiring, camp starts tomorrow. Quiet hours 9 pm–8 am Denver. STOP handling.
- **Done when:** opted-in parents get those three texts; nobody else does; STOP works.

## B2. Volunteer hours certificate (→ P1, 2026-10-17)
- **For:** teen volunteers (school service hours). **Why:** 52 letters were made by hand in June 2026, some still going out in September; volunteers asked for their legal name instead of a nickname.
- **Build:** hours = crewed days × section hours (from `sections` times, `sessions` dates, crew in `sections.lead_id` / `section_supports`, minus `crew_absences`), plus duty slots. A "My hours" card and a printable letter matching the 2026 template: date, "Volunteer Record / Service Hour Verification", "This is to certify that <legal name> has completed <N> hours of service during Week <n> (<dates>) at Steel City Codes", contact `denver@steelcitycodes.org`, signer name and title from settings, optional signature image. Admin: generate all letters for a week at once.
- **Done when:** a volunteer downloads a letter whose hours match the admin's records and whose name is their legal name (spec 35).

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

---

## B10. Move both weeks in one step (follow-up to spec 12)
- **Why:** swaps are same-week only, and changing weeks means cancel then re-register, risking the seat. In 2026 a staff member moved a camper's week-1 class by hand and missed the matching week-2 change.
- **Build:** `swap_my_two_weeks(p_reg_week1, p_target1, p_reg_week2, p_target2)`: both moves in one transaction or neither, free seats only, same deadline and course rules as spec 12 and 31.
- **Done when:** a two-week change either fully succeeds or leaves both registrations untouched.

## B11. Volunteer-sibling placement rule and transport note (follow-up to spec 25)
- **Why:** seats are reserved for volunteers' siblings, but a sibling must not be in their volunteer-sibling's section (asked for by families twice). Volunteers also share rides.
- **Build:** `volunteer_family_links(volunteer_id, student_id)` set by admins; the matcher and section builder warn when a linked camper and volunteer share a section. A free-text `transport_note` on volunteer availability.
- **Done when:** assigning a volunteer to their sibling's section shows a warning.

## B12. Bounce tracking (follow-up to spec 09)
- **Why:** typo addresses (".con", misspelled school domains) bounced on every bulk email for up to three seasons and nobody noticed. Accounts are email-confirmed, which prevents most of this, but a second guardian's or volunteer's address can still go bad.
- **Build:** the provider's bounce/complaint webhook (Edge Function, signed) marks `notifications` as bounced and the address as undeliverable; an attention item lists them; the parent sees "We couldn't email you, please check your address" on the dashboard.
- **Done when:** a test bounce appears in the attention queue within a minute.

## B13. Translated parent emails
- **Why:** several families wrote in Chinese, Korean or limited English, and a funder sends bilingual notices.
- **Build:** a `parent_profiles.language` choice and translated versions of the transactional templates (Spanish first); no machine translation of free text.
- **Done when:** a parent who picks Spanish gets every transactional email in Spanish.

## B14. Full form builder (parked 2026-10-19)
- **Why:** the Forms page can only rename questions, hide unlocked ones and set required. The director asked for full editing (add questions, edit choices, help text, order, steps, unlock locked questions). Office hours (2026-10-19) decided to keep the structure in code for February: the director is the only editor until handoff and can change code in minutes, the opening-day flow must not gain a new failure mode, and the future editors aren't named yet. Specs [39](39-form-answers-shown-and-exported.md) and [40](40-editable-answer-choices.md) took the parts that matter now.
- **Pick up when:** a named person after handoff (national or another region) needs to change questions without a developer.
- **Build (from the 2026-10-19 research: ACTIVE Camps, CampMinder, Jumbula, UltraCamp, Jotform, Typeform, Google Forms, Tally):**
  - A locked core (camper name, grade, volunteer email/age, one signature) plus custom questions on top. Every camp product works this way; ACTIVE says some questions "cannot be removed or edited" because accounts and waivers depend on them. The director asked to unlock everything else, with a typed confirmation before hiding allergies, medical or emergency contact.
  - Six custom types: short text, long text, single choice, checkboxes, yes/no, date (plus a text-only info block). No file upload, matrix or payment.
  - Draft, Preview (the real wizard in preview mode), Publish. Each publish freezes a `form_versions` row; each registration/application stores the version it used, and the server validates against that version, so a family mid-wizard finishes on the version they started (director chose this).
  - Custom answers in a JSONB column with the question wording copied in (`{"q_7f3": {"label", "value", "display"}}`); permanent ids for questions and options; "delete" becomes archive once answers exist; block deleting a question another question's show-if depends on.
  - Reorder with up/down buttons and "Move to step" (WCAG 2.5.7), no drag. A question opens in place (no modal).
  - Answers appear on camper detail, application review, both CSVs, and the volunteer roster when marked.
  - Phase 2: one-level show-if ("show only if [choice] is [option]"), then per-session questions. Never a shared question library across seasons (ACTIVE's trap).
  - The director also wanted waiver text and health questions in the editor: that means rewriting [L2](L2-waivers-and-consents.md) and [33](33-health-and-accommodations.md) around form versions. Decide that when this is picked up, after counsel has seen the waiver.
  - Keep custom questions to about 10 per form (CampMinder: every added question lowers completion).
- **Done when:** a non-developer adds a question, publishes, a family answers it, and the answer is on camper detail and in the CSV.

## Decided against (recorded so nobody re-proposes them by accident)

| Idea | Decision (2026-10-16) |
|---|---|
| Early registration window for returning families | No: one fixed opening time for everyone (Q-R1) |
| Lottery for oversubscribed classes | No: first come, first served (Q-R1) |
| Volunteers self-pick crew spots | No: preferences + admin assigns (Q-V1) |
| Same-week waitlist backups | No: blocked (Q-W4) |
| Manual "confirm" step for registrations | No: auto-confirm (Q-P4) |
| Virtual waiting room / queue for the opening rush | Not needed at our scale (plan §2.3); revisit only if the spec 19 load test fails |
