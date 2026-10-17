# L6: WCAG 2.1 AA audit, fixes and accessibility statement

**Status:** ⬜ not started · **Issue:** #103 · **Priority:** P1 · **Effort:** M · **Phase:** C: Handoff
**Depends on:** none · **Unblocks:** —
**Plan reference:** Plan §4.1 accessibility row; §1 cross-cutting accessibility

## Why
Inputs have linked labels and alerts use `role=alert` (done in QA), but there's never been a full audit. 🔎 ADA Title III likely applies to a public program; WCAG 2.1 AA is the usual benchmark, and parents are mostly on phones.

## Decided rules
- None.

## Scope: what to build
- Automated pass with axe-core (dev dependency) on every route for each role and the public pages, run in CI after spec 08.
- Manual pass: keyboard only, and VoiceOver on iPhone, through signup, wizard, class browser, camper card actions (cancel, swap, offers), volunteer roll call, and admin Students.
- Fix everything at AA: contrast in both themes against the cream/gold palette, focus visibility, target sizes ≥ 24 px, no color-only status, live-region announcements for toasts.
- `/accessibility` statement: standard targeted, known issues, contact `denver@steelcitycodes.org`, response time.

## Out of scope
- None.

## Done when
- [ ] axe reports 0 serious/critical issues on every route.
- [ ] Manual pass findings fixed or listed in the statement.

## Tests and verification
- axe in CI; manual checklist in the PR.

## Open questions
- None.

## Notes for the builder
- Contrast fixes must stay within the v1.0 style guide. Adjust token shades, not the palette's identity, and record any token change in `design_system.md`.
