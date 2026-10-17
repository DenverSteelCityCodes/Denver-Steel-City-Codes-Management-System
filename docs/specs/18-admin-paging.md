# 18: Server-side paging and search for admin lists

**Status:** ⬜ not started · **Issue:** #87 · **Priority:** P0 · **Effort:** S · **Phase:** B
**Depends on:** none · **Unblocks:** —
**Plan reference:** Plan §2.3 'what breaks first' #4

## Why
Admin Students and Users fetch every row. 🔎 Supabase's API returns at most 1,000 rows by default (`max_rows`), so past that, rows silently go missing.

## Decided rules
- None.

## Scope: what to build
- RPC `admin_students_page(p_search text, p_status text[], p_section uuid, p_week int, p_offset int, p_limit int)` returning rows plus a total count; trigram or `lower()` index on `students.full_name`.
- AdminStudents: 50 per page, search box (debounced), filters, "Showing 51–100 of 734".
- AdminUsers: the same pattern over profiles + `admin_user_emails`.
- ⌘K AdminSearch queries the server instead of filtering loaded rows.
- CSV exports page through all rows (the pattern `AttendanceExport` already uses with `.range()`).

## Out of scope
- None.

## Done when
- [ ] Seed 2,000 campers on staging: totals are correct, every camper is findable by search, and exports contain all 2,000.
- [ ] First page loads in < 1 s.

## Tests and verification
- SQL: RPC admin-only.
- Browser: paging, search, filters, 375 px.

## Open questions
- Check the actual `max_rows` setting in the dashboard (API settings) and record it.

## Notes for the builder
- None.
