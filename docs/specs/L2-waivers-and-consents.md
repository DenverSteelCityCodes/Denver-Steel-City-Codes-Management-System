# L2: Versioned waiver, separate consents, signature record, emailed copy

**Status:** ⬜ not started · **Issue:** #90 · **Priority:** P0 · **Effort:** M (+ counsel text) · **Phase:** Legal
**Depends on:** 09, counsel-approved waiver text (by Jan 5) · **Unblocks:** L3, 23
**Plan reference:** Plan §4.1 rows: parent waiver, e-signatures, photo release; §1 flow P2

## Why
The waiver is hardcoded in `ParentRegistrationPage.tsx`. It says "Denver Summer Camp", bundles five consents, mentions refunds, and isn't stored by version: we can't show what a parent agreed to. Colorado allows a parent to waive a child's future negligence claims only if the decision is "voluntary and informed" ([C.R.S. 13-22-107](https://colorado.public.law/statutes/crs_13-22-107)) 🔎.

## Decided rules
- Waiver and consents are in **national's** name (Q-L1).
- Photo/media consent is a **separate opt-in, default off**, changeable later by the parent.

## Scope: what to build
- Table `waivers(id, year, kind check in (liability, medical_authorization, photo_media, technology_use, code_of_conduct), version int, title, body_md, required bool, published_at, retired_at)`; `chapter_id` in spec 23. Admin write; everyone reads published rows.
- Table `consents(id, student_id, waiver_id, granted bool, signer_profile uuid, typed_name text, camper_typed_name text, signed_at timestamptz, user_agent text, body_sha256 text)`. Parent inserts own (via RPC); admin reads; never updated (a change = a new row).
- Wizard step 5 and the yearly confirmation panel render the **active** waivers from the DB, one card each, with its own checkbox (photo/media: "Yes / No" radio, nothing preselected) and typed signatures.
- RPC `sign_consents(p_student_id, p_items jsonb, p_typed_name, p_camper_typed_name)` writes rows with a server-computed body hash; called in the registration transaction (spec 17) or right after.
- Receipt email (spec 09 template `consents_signed`) with the full text of what was signed, plus a "My camper's forms" view on the camper card listing signed versions and dates, where the photo choice can be changed (a new row).
- Demographic questions (ethnicity, gender, free/reduced lunch) labelled "Optional", with the purpose shown: "Used only for grant reporting, never shown to volunteers."
- Camper email field: remove it from the form (default), unless Q-L5 says it's needed. Keep the column for existing data until L4 clears it.
- Remove the hardcoded waiver text and the "Denver Summer Camp" wording from the page.

## Out of scope
- Per-chapter waiver versions (spec 23).

## Done when
- [ ] The waiver text shown comes from the DB; publishing a new version doesn't need a deploy.
- [ ] Every signature can be reproduced exactly: version, hash, who, when.
- [ ] Photo consent defaults to unanswered and must be chosen; it's changeable later.
- [ ] The parent receives an email copy.
- [ ] Counsel's sign-off on the text is noted in the PR.

## Tests and verification
- SQL: consents are insert-only for parents; hashes match bodies.
- Browser: wizard and yearly check at 375 px; receipt email on a phone.

## Open questions
- Q-L4 refunds (the current text mentions them). Q-L5 camper email. Q-L8 insurer wording.

## Notes for the builder
- Keep `students.waiver_signature/guardian_signature/waiver_signed_at` populated for now, for older screens, but treat `consents` as the record.
