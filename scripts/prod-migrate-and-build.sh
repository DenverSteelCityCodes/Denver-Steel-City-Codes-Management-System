#!/usr/bin/env bash
# Production (and staging) build entrypoint for Vercel (spec 01, #69).
# Runs `supabase db push` against the linked project BEFORE the SPA build, so a broken
# migration fails the deploy and the old frontend stays up with the old schema.
#
# Required Vercel env (Production project only — never set these on the demo project):
#   SUPABASE_ACCESS_TOKEN   personal access token or deploy token with db write
#   SUPABASE_PROJECT_REF    prod (or staging) project ref — NOT rdckxazvoeixgwtjhrlf
#
# Preview / demo builds omit those vars and skip the push (previews share the demo DB by
# convention until a staging project exists).
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
  echo "Pushing migrations via SUPABASE_DB_URL …"
  npx --yes supabase@2.106.0 db push --db-url "$SUPABASE_DB_URL" --yes
elif [[ -n "${SUPABASE_ACCESS_TOKEN:-}" && -n "${SUPABASE_PROJECT_REF:-}" ]]; then
  if [[ "$SUPABASE_PROJECT_REF" == "rdckxazvoeixgwtjhrlf" ]]; then
    echo "Refusing to db push to the public demo project from a prod/staging build." >&2
    exit 1
  fi
  echo "Pushing migrations to Supabase project $SUPABASE_PROJECT_REF …"
  if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
    npx --yes supabase@2.106.0 link --project-ref "$SUPABASE_PROJECT_REF" --password "$SUPABASE_DB_PASSWORD" --yes
  else
    npx --yes supabase@2.106.0 link --project-ref "$SUPABASE_PROJECT_REF" --yes
  fi
  npx --yes supabase@2.106.0 db push --yes
else
  echo "No SUPABASE_DB_URL / SUPABASE_ACCESS_TOKEN+PROJECT_REF — skipping db push (preview/demo build)."
fi

if [[ "${VITE_DEMO_MODE:-}" == "true" ]]; then
  npm run build:demo
else
  npm run build
fi
