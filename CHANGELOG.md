# Changelog

All notable changes to the Steel City Codes Management System are documented here.
Release tags (`vX.Y.Z`) are rollback points: redeploy that commit in Vercel, then follow any down-steps in the release notes.

## [Unreleased]

### Added
- Spec 01 foundation: timestamped `supabase/migrations/`, CLI-friendly local setup, production cutover runbook, migration deploy workflow, Dependabot major-version ignore, and this changelog.
- Fresh-install fixes: move `offered` enum before migrations that reference it; create `pg_cron` in the notifications migration for local stacks; disable local analytics under Colima.

## [0.1.0] — pending tag after first prod deploy

Milestone tag created with `gh release create v0.1.0 --generate-notes` once `scc-prod` has received `supabase db push` and the production Vercel project deploys from `main`. See [docs/ops/production-cutover.md](docs/ops/production-cutover.md).
