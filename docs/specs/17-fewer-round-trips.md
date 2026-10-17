# 17: Fewer round trips: shared cache and transactional RPCs

**Status:** ⬜ not started · **Issue:** #86 · **Priority:** P1 (first to cut) · **Effort:** M · **Phase:** B
**Depends on:** 16 · **Unblocks:** —
**Plan reference:** Plan §2.3 measured table

## Why
Measured 2026-10-16: the parent dashboard makes ~12 calls (dev showed 23), because `students`, `registrations` and `sessions` are fetched separately by the layout, bell, This-week card and page. The admin dashboard makes ~27. Single queries take 90–220 ms; pages take 1–3 s because calls queue. The wizard submit is four separate writes with no transaction, and guardian contact is required only in the UI.

## Decided rules
- None.

## Scope: what to build
- Add `@tanstack/react-query` (exact version pinned). Move `useStudents`, `useRegistrations`, `useSessions`, `useUpdates`, `useClasses` and the admin hooks onto shared query keys, so one fetch serves every component; invalidate after mutations. Replace `useRefetchOnFocus` with the library's focus and interval refetch, keeping the same intervals.
- `register_camper(p_student jsonb, p_parent_profile jsonb, p_section_ids uuid[], p_camp_year int)` RPC: one transaction that upserts the camper, upserts parent_profiles, inserts registrations, and stamps `registration_year`/`waiver_signed_at`. Server-side requirement of parent phone/email and an emergency contact name/phone (closes the 'missing guardian contact: UI only' gap). The wizard calls it once.
- `my_volunteer_home()` RPC: assigned sections + rosters (via `section_roster`) in one call, replacing the sections → registrations waterfall.
- Admin dashboard: one `admin_dashboard_counts()` RPC for the stat cards and attention counts.

## Out of scope
- Realtime subscriptions.

## Done when
- [ ] Measured with the plan §2.3 method (resource timing, production build): parent dashboard ≤ 5 API calls and ≤ 600 ms warm; volunteer dashboard ≤ 3 calls; admin dashboard ≤ 8 calls.
- [ ] A failed registration leaves nothing half-saved.
- [ ] Missing guardian contact is refused by the DB.

## Tests and verification
- Before/after timing table in the PR.
- SQL: `register_camper` rollback on a capacity/age failure.

## Open questions
- None.

## Notes for the builder
- If time runs short before February, cut this first. The app works without it, just slower.
