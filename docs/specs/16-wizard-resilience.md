# 16: Registration wizard: survives back, reload and expired sessions

**Status:** ✅ [PR #124](https://github.com/DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System/pull/124) · **Issue:** #85 · **Priority:** P0 · **Effort:** M · **Phase:** B
**Depends on:** none · **Unblocks:** 17
**Plan reference:** Plan flow P2 friction table, §2.2 half-finished forms / back button / expired session

## Why
The 5-step wizard keeps everything in memory. The phone back button, a reload, or an app switch that kills the tab loses every step. Seat counts are loaded once, so a class shown as open can be full by step 5. Errors appear at the bottom and aren't focused.

## Decided rules
- Consents and the waiver move to spec L2. This spec doesn't change the waiver step's content.

## Scope: what to build
- Step in the URL (`?step=2`), one history entry per step: browser back goes back a step, never out of the wizard.
- Draft saved to localStorage per account + camper (`scc-draft:<userId>:<studentId|new>`), on every step change and debounced on input. Typed signatures are **not** saved. Cleared on submit and on sign-out.
- Dashboard card "Finish registering Maya: you're on step 3 of 5" when a draft exists, with Discard.
- Leaving the wizard with unsaved changes (in-app navigation) → inline "Leave without finishing? Your answers are saved on this device" (react-router `useBlocker`), not a browser dialog.
- Live seats: refetch `section_fill_counts()` when entering step 4 and right before submit; if a chosen class just filled, say so on step 4 ("Python A just filled. Pick another or join the waitlist").
- Class browser: refresh `section_fill_counts()` every 30 s while the page is visible, so "spots left" stays honest during the opening rush.
- Session expiry: if a submit fails on auth, show inline "Sign in again to finish. Your answers are saved" with a link back to the same step after login.
- Accessibility: move focus to the error (`role=alert`, `tabIndex=-1`); "Step 2 of 5: Parent and emergency contact" as text alongside the dots.

## Out of scope
- The transactional submit (spec 17).

## Done when
- [ ] Reload on any step returns to that step with the answers intact (except signatures).
- [ ] Back moves one step at a time on iOS Safari and Android Chrome.
- [ ] A class that fills mid-wizard is caught on step 4 or at submit, with clear copy.
- [ ] Errors are announced by VoiceOver and focused.

## Tests and verification
- Manual matrix: iOS Safari, Android Chrome, desktop Chrome; reload/back/expired-token cases.
- Vitest for draft serialize/clear.

## Open questions
- None.

## Notes for the builder
- Built 2026-10-17, **changed from the spec**: no "Leave without finishing?" prompt. react-router's `useBlocker` only works with a data router, and the app uses `<BrowserRouter>`. Since every answer is saved as a draft on the device, leaving loses nothing; switching routers can come later if wanted. Submit now re-validates **all** steps, because a link or reload can land on step 5 directly. Drafts are cleared on submit and on sign-out (they can hold health details). The "just filled up" check and the expired-sign-in message are code-reviewed but weren't triggered live (both need a second actor or an expired token).
- localStorage can throw in private mode. Wrap every access, as `AdminLayout` already does.
