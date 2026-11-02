# L3: "No photos" flag on volunteer rosters

**Status:** ⬜ not started · **Issue:** #91 · **Priority:** P0 · **Effort:** S · **Phase:** Legal
**Depends on:** 04, L2 · **Unblocks:** —
**Plan reference:** Plan §4.1 photo/media row

## Why
A photo opt-out is useless if the crew taking photos can't see it.

## Decided rules
- Crew see a clear "No photos" marker on campers without photo consent (default for unanswered).

## Scope: what to build
- Add `photo_ok boolean` (latest `photo_media` consent; false if none) to `section_roster()`.
- Volunteer roster, roll-call rows and the print roster show a small camera-off icon plus the text "No photos" (not color-only).
- Admin camper detail shows the same flag.
- No photo uploads exist today. If they're ever added, warn on campers without consent before posting.

## Out of scope
- None.

## Done when
- [ ] Rosters on the phone and on paper show the flag; screen readers read "No photos".

## Tests and verification
- Browser: volunteer and print views.

## Open questions
- None.

## Notes for the builder
- None.

## From the Discord findings (2026-11-01)

From [the Discord findings](../research/discord-findings.md). Each item was checked against `main` at `d046434`, so it asks only for what is missing.

- [ ] The camper "No photos" flag also goes on the admin export used for social posting. (Discord M06)
- [ ] Camp photos stay out of the app; spec 26 documents the shared folder and posting rules. Volunteer profile photos (spec 35) are unaffected. (Discord M06)
- Volunteer consent to appear in social posts is a separate tick in spec 35 (Discord M06).
