# L6a: Accessibility pass on the registration flow (before February)

**Status:** ⬜ not started · **Issue:** #111 · **Priority:** P0 · **Effort:** S · **Phase:** Legal (before the dry run)
**Depends on:** 03, 10, 11, 12, 16, L1, L2 (the screens must exist first) · **Unblocks:** 19
**Plan reference:** Plan §4.1 accessibility (ADA) row; §1 cross-cutting accessibility

## Why
Parents register on their phones in February, and the registration flow is where an accessibility barrier stops a family from getting a spot. 🔎 ADA Title III likely applies to a public program run by a nonprofit, and WCAG 2.1 AA is the usual benchmark. The full site audit (L6) can wait for the handoff; these screens can't.

## Decided rules
- Split decided 2026-10-17: the registration-flow pass is **P0 before February**; the full audit and the accessibility statement stay **P1** (L6).
- Target: **WCAG 2.1 AA** on the screens in scope.

## Scope: what to build
- **Screens in scope:** sign up, sign in, forgot/reset password (03); parent dashboard and **camper card** actions (edit camper, cancel, switch class, accept/decline a waitlist offer, change request: 10–12); **class browser**; **registration wizard**, all 5 steps including the waiver and consents (16, L2); privacy and terms pages (L1).
- **Automated:** axe-core (dev dependency) run against each screen in light and dark mode at 375 px and desktop width. Fix every serious and critical finding.
- **Manual, on real devices:** complete a full registration (new account → camper → class → waiver → confirmation) and a waitlist accept and a cancel, (1) keyboard only on desktop, (2) VoiceOver on iPhone Safari, (3) TalkBack on Android Chrome.
- **Fix to AA:** text and control contrast in both themes (cream/gold tokens), visible focus, touch targets ≥ 24 px (44 px preferred on primary buttons), status never shown by color alone, form errors announced and focused, step progress announced ("Step 2 of 5"), toasts and countdowns in polite live regions, inline confirms reachable and dismissible by keyboard, 200% zoom and large text with no lost content or sideways scrolling, and `prefers-reduced-motion` respected for spinners and transitions.
- Record findings and fixes in a checklist in the PR (screen × check × result).

## Out of scope
- Volunteer, admin, apply and print-roster screens, axe in CI, and the public accessibility statement (all L6).

## Done when
- [ ] axe reports 0 serious/critical issues on every in-scope screen, both themes, both widths.
- [ ] A full registration, a waitlist accept and a cancel are completed with keyboard only, VoiceOver and TalkBack, with no help.
- [ ] Contrast of every text, icon and control on these screens meets AA in light and dark mode.
- [ ] Remaining minor issues are listed in the PR and copied into L6's known-issues list.
- [ ] Done before the spec 19 dry run, so the 5 test parents use the fixed flow.

## Tests and verification
- Screen-by-screen checklist in the PR, with axe output attached.
- Optional: ask one dry-run parent who uses a screen reader or magnification to take part (spec 19).

## Open questions
- None.

## Notes for the builder
- Contrast fixes stay within the v1.0 style guide. Adjust token shades, not the palette's identity, and record any token change in `design_system.md`.
- Several fixes overlap spec 16 (focused errors, step text). Whichever lands second checks the other's work rather than redoing it.
