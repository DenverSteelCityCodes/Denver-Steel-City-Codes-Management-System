# Parent swap: concurrency checks (spec 12)

These need two database connections at once, so they can't live in the rolled-back
`parent-swap-tests.sql` block. Run them against the **demo** only: the setup commits rows.

## Setup
Run `parent-swap-concurrency-setup.sql`. It creates a "Swap Race" class in Week 2 with four
sections, four campers under four different parents, and sets the change deadline to 0 days:

| Camper | Seat | Section capacities |
|---|---|---|
| Race 1, Race 2 | RA | RA 3, RB 1 (empty) |
| Race 3 | RD | RD 2 |
| Race 4 | RE | RE 2 |

The last query prints each camper's parent id, registration id and the RB/RD/RE ids.

## The two checks
Each connection runs, in one transaction:

```sql
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<parent id>","role":"authenticated"}', true);
select public.swap_my_registration('<registration id>', '<target section id>');
select pg_sleep(2);   -- hold the locks so the other connection overlaps
```

1. **Last seat:** Race 1 → RB and Race 2 → RB at the same time. Expected: one succeeds; the other
   gets "Swap Race RB is full. To join its waitlist you'd need to cancel your spot in Swap Race RA first."
2. **Crossing swaps:** Race 3 → RE and Race 4 → RD at the same time. Expected: both succeed, no
   deadlock (both sections are locked in id order).

## Cleanup
`select private.reset_demo(); delete from season_settings where year = <year>;` (only if the
year had no settings row before).

## Last run
2026-10-17 on the demo: last seat, one success and one "full" refusal; crossing swaps, both
succeeded with no deadlock.
