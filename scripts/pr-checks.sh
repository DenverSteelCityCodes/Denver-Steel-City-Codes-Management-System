#!/usr/bin/env bash
# PR checks (review pipeline stage 2, docs/review-pipeline.md): the house rules a script can see.
# CI runs it on every pull request (.github/workflows/pr-checks.yml); run it locally before opening:
#
#   BODY="$(cat pr-body.md)" scripts/pr-checks.sh            compares with origin/main
#
# Env: BODY (the PR description), AUTHOR (skips the issue rule for Dependabot), BASE (the commit
# to diff against; default: the merge base with origin/main).
# Escape hatch for a migration with nothing to test (a comment or header fix): a line in the body
# starting "No SQL test:" and the reason.
set -euo pipefail

body="${BODY:-}"
base="${BASE:-$(git merge-base origin/main HEAD)}"
errors=0
fail() { echo "::error::$1"; errors=$((errors + 1)); }

added=$(git diff --name-only --diff-filter=A "$base"...HEAD)
changed=$(git diff --name-only --diff-filter=AM "$base"...HEAD)
has() { grep -qxE "$1" <<<"$changed"; }

# 1. One PR closes one issue.
if [[ "${AUTHOR:-}" != "dependabot[bot]" ]] &&
   ! grep -qiE '(close[sd]?|fix(e[sd])?|resolve[sd]?):? +(#|https://github\.com/[^ ]+/issues/)[0-9]+' <<<"$body"; then
  fail 'The description must close its issue: "Closes #123".'
fi

# 2. Migrations come with their apply order and their tests.
new_migrations=$(grep -xE 'migration_[a-z0-9_]+\.sql' <<<"$added" || true)
any_migrations=$(grep -xE 'migration_[a-z0-9_]+\.sql' <<<"$changed" || true)
if [[ -n "$new_migrations" ]] && ! has 'docs/database\.md'; then
  fail "New migration(s) not listed in docs/database.md: $(tr '\n' ' ' <<<"$new_migrations")"
fi
if [[ -n "$any_migrations" ]] && ! has 'test-plans/.+-tests\.sql' && ! grep -qiE '^[-*[:space:]]*no sql test:' <<<"$body"; then
  fail "Migration(s) changed with no test-plans/*-tests.sql change: $(tr '\n' ' ' <<<"$any_migrations")(or add a 'No SQL test: <reason>' line to the description)"
fi

# 3. A new Edge Function is in the deploy list.
for fn in $(grep -oE '^supabase/functions/[^/]+/index\.ts$' <<<"$added" | cut -d/ -f3); do
  grep -q "$fn" docs/database.md || fail "New Edge Function '$fn' isn't named in docs/database.md."
done

if ((errors)); then
  echo "PR checks: $errors problem(s). See docs/review-pipeline.md › CI."
  exit 1
fi
echo "PR checks: ok"
