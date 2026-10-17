# L6: Full accessibility audit, axe in CI, and accessibility statement

**Status:** ⬜ not started · **Issue:** #103 · **Priority:** P1 · **Effort:** M · **Phase:** C: Handoff
**Depends on:** L6a, 08 · **Unblocks:** —
**Plan reference:** Plan §4.1 accessibility row; §1 cross-cutting accessibility

## Why
L6a covers the registration flow before February. This spec finishes the rest of the site for the handoff. 🔎 ADA Title III likely applies to a public program; WCAG 2.1 AA is the usual benchmark.

## Decided rules
- Split decided 2026-10-17: the registration flow is L6a (P0); everything else is here (P1).

## Scope: what to build
- axe-core in CI (after spec 08) on **every** route for each role, including the L6a screens, so they don't regress.
- Manual pass (keyboard only, VoiceOver on iPhone) on the screens L6a didn't cover: volunteer apply, volunteer dashboard and roll call, print roster, admin dashboard, Students, Classes, Sessions, Updates and Attendance.
- Fix everything at AA: contrast in both themes against the cream/gold palette, focus visibility, target sizes ≥ 24 px, no color-only status, live-region announcements for toasts.
- `/accessibility` statement: standard targeted, known issues, contact `denver@steelcitycodes.org`, response time.

## Out of scope
- The registration-flow screens' manual pass (done in L6a).

## Done when
- [ ] axe in CI reports 0 serious/critical issues on every route and blocks regressions.
- [ ] Manual pass findings fixed or listed in the statement (including any left from L6a).
- [ ] `/accessibility` statement published and linked from every footer.

## Tests and verification
- axe in CI; manual checklist in the PR.

## Open questions
- None.

## Notes for the builder
- Contrast fixes must stay within the v1.0 style guide. Adjust token shades, not the palette's identity, and record any token change in `design_system.md`.
