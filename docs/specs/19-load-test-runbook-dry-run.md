# 19: Load test, restore drill, runbooks, February dry run

**Status:** ⬜ not started · **Issue:** #88 · **Priority:** P0 · **Effort:** M · **Phase:** B
**Depends on:** 01–18, L1–L3, L5, L6a · **Unblocks:** registration opening
**Plan reference:** Plan §2.3 spike table and backups table, L5

## Why
The plan's load numbers are estimates. Before opening day we need proof the system holds, a tested way to recover, and a script for the day itself.

## Decided rules
- None.

## Scope: what to build
- Staging project with prod's schema, seeded by script: 600 parents (pre-confirmed accounts), 800 campers, 30 sections, 60 volunteers.
- k6 script: 500 virtual parents arriving over 15 minutes, each signing in, loading the dashboard and class browser, and registering 1–2 campers through the real API calls. Run from several IPs, or raise the per-IP auth limit on staging.
- Pass criteria: p95 per API call < 1.5 s, zero 5xx, **zero capacity overruns** (SQL check after the run), every confirmation email enqueued exactly once.
- Restore drill: restore last night's prod backup into a scratch project and time it; turn on PITR for Feb–Aug and practise a point-in-time restore on staging.
- Runbooks in `docs/runbooks/`: `registration-day.md` (T-7 days to T+2 hours checklist; who watches the Supabase, Auth and email-provider dashboards; levers: close the form, raise rate limits, move `registration_opens_at`; parent comms templates from `denver@steelcitycodes.org`) and `security-incident.md` (from L5).
- Temporarily raise the Auth per-IP sign-in/sign-up limit for registration week; write the revert date in the runbook.
- **Release freeze** (added 2026-10-17): tag `v1.0.0` once the load test and dry run pass; no deploys from 48 hours before registration opens until 48 hours after, except a fix the Regional Director approves. Write the freeze window and the rollback steps (redeploy the previous tag) into `registration-day.md`.
- Two weeks before camp: test the coding platform signed in as a district student account (it was blocked on day 1 in 2025).
- **Dry run** (after L6a's accessibility pass) on staging with 5 real parents on their own phones, moderated: watch, don't help. Log every hesitation and fix the top issues before opening.

## Out of scope
- None.

## Done when
- [ ] Load test passes the criteria twice, on the final pre-February build.
- [ ] Restore time recorded; PITR on.
- [ ] Both runbooks reviewed by the Regional Director.
- [ ] Dry-run findings filed as issues; P0 ones fixed.
- [ ] `v1.0.0` tagged; the freeze window is in the runbook.

## Tests and verification
- The k6 script and seed script are committed under `tools/loadtest/`.

## Open questions
- Peak numbers (Q-H4) change the k6 targets.

## Notes for the builder
- Never load-test prod. Never seed fake families into prod.
