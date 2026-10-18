# 09: Notifications outbox, sender and templates

**Status:** 🟨 outbox built ([PR #125](https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/pull/125)); sending waits for spec 02 · **Issue:** #77 · **Priority:** P0 · **Effort:** M · **Phase:** B: Feb-critical
**Depends on:** 02 · **Unblocks:** 10, 11, 12, 14, L2, and every notify-on-change rule
**Plan reference:** Plan §1 cross-cutting 'clear feedback', §1.5 cross-role table, §3 rank 1

## Why
The app sends no email of its own. Status changes reach a parent only when they next open the dashboard, and "Also email" opens one admin's personal mail client, with no record of what was sent.

## Decided rules
- Reply-to `denver@steelcitycodes.org` (per region after spec 20).
- Auto-confirm (Q-P4): the first email after a sign-up is "You're confirmed", not "We'll confirm soon".

## Scope: what to build
- Table `notifications(id, recipient_profile uuid, recipient_email text, template text, payload jsonb, status text check in (queued, sending, sent, failed, cancelled), attempts int, last_error text, dedupe_key text unique, created_at, sent_at)`. Admin read only; no client writes.
- `private.enqueue_notification(recipient, template, payload, dedupe_key)`. Recipient email = `parent_profiles.email`, else the login email (same rule as `update_recipient_emails()`).
- Triggers on `registrations` AFTER INSERT/UPDATE OF status, section_id: `registration_confirmed`, `registration_waitlisted`, `registration_moved`, `registration_cancelled` (body varies by `cancel_reason`). Spec 10 adds `waitlist_offer`, `offer_expiring`, `offer_expired`, `waitlist_withdrawn`.
- Edge Function `send-notifications`: claims up to 50 `queued` rows (`FOR UPDATE SKIP LOCKED`), renders the template, sends through the provider API, marks sent or failed, retries 3 times with backoff. Triggered every minute by `pg_cron` + `pg_net`.
- Templates (HTML + text, branded, short, mobile-first): what happened, which camper, class, week, time, room, what to do next (button to the dashboard), and the contact line.
- Announcements: "Also email" on updates now enqueues one `announcement` per recipient (audience from `update_recipient_emails`) instead of opening `mailto:`. Announcements carry an unsubscribe link (`email_opt_out` on parent_profiles) and the camp's postal address (CAN-SPAM). Transactional emails ignore the opt-out.
- Camp-week safety: when a parent edits a camper's allergies or medical conditions during or within 7 days before their session, email the section's lead and supports (`medical_changed`: camper name + "Allergy/medical info updated, check the roster"; no medical text in the email).
- Admin: a "Sent" log on the Updates page (who, template, status), and failed sends in the attention queue.

## Out of scope
- SMS (P2).
- Digest or batching preferences.

## Done when
- [ ] Registering a camper produces a confirmation email within 2 minutes.
- [ ] An admin move or cancel emails the parent once (dedupe key prevents doubles when two triggers fire).
- [ ] Provider outage: rows stay `queued`/`failed` and are retried; nothing is lost; the admin sees failures.
- [ ] Unsubscribed parents get no announcements but still get transactional mail.
- [ ] No email contains other families' data; announcements are sent one-per-recipient (no visible lists).

## Tests and verification
- SQL: each status change enqueues exactly one row with the right template.
- Staging: send to a test inbox for every template; screenshot each on a phone.

## Open questions
- Postal address for the footer ❓ (national's or Denver's).

## Notes for the builder
- Built 2026-10-17 (everything up to the provider). Outbox, registration triggers, templates (`supabase/functions/send-notifications/templates.ts`), the sender Edge Function (deployed to the demo project), the per-minute pg_cron job (via two Vault secrets), the admin email log on Updates, and the "emails couldn't be sent" attention item.
- **To start sending:** finish spec 02 (provider account, and SPF/DKIM on `steelcitycodes.org`), then set the Edge Function secrets `RESEND_API_KEY`, `NOTIFY_FROM` and `APP_URL`. Until then, emails wait in the queue and the log says so. The sender is written for Resend; another provider means changing one `fetch` call.
- Not queued: writes with no signed-in user and no reason (SQL editor, the nightly demo reset), and example.com addresses (recorded as "skipped").
- **Not built yet:** announcements via the outbox ("Also email" still opens the mail app, so no unsubscribe link is needed yet), and the in-camp-week `medical_changed` email to the lead. Both are small follow-ups once a provider is live. Specs 10–12 add their templates to `templates.ts`.
- Keep templates in one folder in the Edge Function, so national can edit the wording without touching logic.
