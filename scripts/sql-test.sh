#!/usr/bin/env bash
# Runs SQL/RLS suites from test-plans/ and fails on any BAD (review pipeline stage 1,
# docs/review-pipeline.md). Each suite ends with `raise exception 'RESULTS …'`, so it rolls back.
#
#   scripts/sql-test.sh                                   every test-plans/*-tests.sql except
#                                                         camp-week-rls-tests.sql (older: it commits
#                                                         its own cleanup and prints a table; run it
#                                                         by hand in the SQL editor)
#   scripts/sql-test.sh test-plans/x-tests.sql …          just these
#   scripts/sql-test.sh --with migration_x.sql [--with …] test-plans/x-tests.sql
#       sends the migration(s) and the suite as ONE query, so an unapplied migration is tried
#       and rolled back with the suite (a dry run against the demo).
#
# Connection, first match wins:
#   DATABASE_URL                        psql (a local stack, or the demo's direct connection)
#   SUPABASE_PROJECT_REF + SUPABASE_ACCESS_TOKEN
#                                       the Management API's query endpoint (no psql needed;
#                                       mind its rate limit on long runs)
# Never point it at production: suites insert fixtures, and some need the demo seed
# (run `select private.reset_demo();` first).
set -euo pipefail

with=()
suites=()
while (($#)); do
  case "$1" in
    --with) with+=("$2"); shift 2 ;;
    -h|--help) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) suites+=("$1"); shift ;;
  esac
done
if ((${#suites[@]} == 0)); then
  shopt -s nullglob
  for f in test-plans/*-tests.sql; do
    [[ "$f" == */camp-week-rls-tests.sql ]] || suites+=("$f")
  done
fi
((${#suites[@]})) || { echo "No suites found (run from the repo root)." >&2; exit 2; }

run() {   # prints the database's message for the given files, sent as one query
  if [[ -n "${DATABASE_URL:-}" ]]; then
    cat "$@" | psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 2>&1 || true
  elif [[ -n "${SUPABASE_PROJECT_REF:-}" && -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
    python3 -c 'import json,sys; print(json.dumps({"query": "\n".join(open(f).read() for f in sys.argv[1:])}))' "$@" |
      curl -sS -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
        -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H 'Content-Type: application/json' --data @- |
      python3 -c 'import json,sys
d = sys.stdin.read()
try: print(json.loads(d).get("message", d))
except Exception: print(d)'
  else
    echo "Set DATABASE_URL, or SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN." >&2
    exit 2
  fi
}

failed=0
for suite in "${suites[@]}"; do
  out=$(run ${with[@]+"${with[@]}"} "$suite")
  ok=$(grep -cE '(^|[^A-Za-z])ok[[:space:]]*$' <<<"$out" || true)
  bad=$(grep -E 'BAD' <<<"$out" || true)
  if grep -q 'ThrottlerException' <<<"$out"; then
    printf 'RATE   %s: the API throttled this run; try again later\n' "$suite"; failed=1
  elif [[ -n "$bad" ]]; then
    printf 'FAIL   %s: %s ok\n%s\n' "$suite" "$ok" "$(sed 's/^/         /' <<<"$bad")"; failed=1
  elif ! grep -q 'RESULTS' <<<"$out" && ((ok == 0)); then
    # Neither the closing RESULTS raise nor any ok line: the suite itself errored.
    printf 'ERROR  %s\n%s\n' "$suite" "$(sed 's/^/         /' <<<"$out" | head -5)"; failed=1
  else
    printf 'pass   %s: %s ok\n' "$suite" "$ok"
  fi
done
exit "$failed"
