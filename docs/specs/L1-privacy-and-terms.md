# L1: Website privacy policy, terms of use, 18+ guardian attestation

**Status:** ⬜ not started · **Issue:** #89 · **Priority:** P0 · **Effort:** S (+ drafting and SCC review) · **Phase:** Legal
**Depends on:** SCC's review of the drafted documents (tracker non-code task) · **Unblocks:** 19
**Plan reference:** Plan §4.1 rows: CPA minors' amendment, accounts and age, controller; §6 Q-L1

## Why
We hold data on 9–14-year-old campers and accounts for 14–17-year-old volunteers, with no privacy notice or terms on the site. Colorado's 2025 minors' amendment has no size threshold 🔎. The site needs its own privacy policy and terms, describing exactly what the site collects and does. Claude drafts them; SCC reviews them so they're consistent with any SCC-wide policy.

## Decided rules
- Denver is a region; **national is the controller** (Q-L1). National's legal name goes on both documents.
- Contact for privacy questions and requests: `denver@steelcitycodes.org`.

## Scope: what to build
- Content: the website's own privacy policy and terms (Claude drafts from the site's actual data, plan §2.4, and its processors; SCC reviews), in `docs/legal/privacy-notice.md` and `docs/legal/terms.md`, with a version and effective date. The privacy notice covers: who we are; what we collect (camper, parent and volunteer lists from plan §2.4); why; who sees it (the who-sees-what table); processors (Supabase, Vercel, email provider; region); retention (plan §4.3); rights and how to ask; no sale, ads or trackers; children's data; changes.
- Pages `/privacy` and `/terms`, public, rendered from that content (no login needed), using the style guide's reading layout.
- Footer links on every page: login, signup, apply, and the parent, volunteer and admin layouts.
- Signup (parent): required checkbox "I'm 18 or older and the parent or legal guardian of the campers I register. I agree to the Terms and Privacy Notice." Store `profiles.terms_version` + `terms_accepted_at`, written via signup metadata in `handle_new_user()`.
- Volunteer apply: the same agreement; for under-18 applicants the existing guardian signature also covers the privacy notice (add the wording).
- Existing accounts: on the next sign-in, if `terms_version` is older than the current one → an inline banner (not a modal) asking them to accept.

## Out of scope
- The waiver (L2).

## Done when
- [ ] Both pages live, and linked from every footer and form.
- [ ] Signup is impossible without the attestation, and the DB stores the version accepted.
- [ ] SCC reviewed and approved both documents (who and when, noted in the PR).

## Tests and verification
- Browser: signup with and without the box; existing user re-accept banner.

## Open questions
- Postal address and the exact legal name of national ❓.

## Notes for the builder
- Keep the documents in the repo as Markdown, so national can update them through PRs, with version history.
