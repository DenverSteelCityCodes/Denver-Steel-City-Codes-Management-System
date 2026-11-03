# Review pipeline

Every pull request goes through the same five stages, in order. A stage a machine can check is checked in CI; the rest are written in the PR so a reviewer can see they happened. This app holds children's medical notes and family contacts, so a PR that skips a stage doesn't merge.

| # | Stage | Who | Checked by |
|---|---|---|---|
| 1 | Author checks | the author (person or Claude session) | the PR template's checklist |
| 2 | CI | GitHub Actions | `Lint, test, build` and `PR checks` (required) |
| 3 | Code review | `/code-review` in Claude Code, plus a person for sensitive changes | the PR's **Review** section |
| 4 | Merge gate | the Regional Director | branch protection on `main` |
| 5 | After merge | whoever merges | the spec tracker and the demo |

## 1. Author checks (before opening the PR)

One issue, one worktree, one PR ([CLAUDE.md](../CLAUDE.md) › Workflow). Then:

```bash
npm run lint && npm test && npm run build
```

- **Database changes:** every new rule has a suite in `test-plans/<name>-tests.sql`. Run it, plus the suites for any function or trigger you changed, with [`scripts/sql-test.sh`](../scripts/sql-test.sh). Before the migration is applied, prepend it with `--with`, so the whole run rolls back:
  ```bash
  scripts/sql-test.sh --with migration_x.sql test-plans/x-tests.sql test-plans/course-rules-tests.sql
  ```
  A suite that already fails on `main` is noted in the PR, not hidden.
- **UI changes:** checked in the browser for each affected role, at 375 px and in dark mode, with a screenshot in the PR ([DESIGN.md](../DESIGN.md)).
- **Migrations and Edge Functions:** listed in [docs/database.md](database.md) in apply order.

## 2. CI (automatic, required)

Two required checks:

- **Lint, test, build** ([`ci.yml`](../.github/workflows/ci.yml), every PR and every push to `main`): eslint, Vitest (with `TZ=Asia/Tokyo`) and the production build.
- **PR checks** ([`pr-checks.yml`](../.github/workflows/pr-checks.yml) running [`scripts/pr-checks.sh`](../scripts/pr-checks.sh), PRs only, re-run when the description is edited): the house rules a script can see. Run it locally first with `BODY="$(cat body.md)" scripts/pr-checks.sh`.
  - The body closes an issue (`Closes #123`), unless the PR is from Dependabot.
  - A new root `migration_*.sql` is listed in `docs/database.md`, and any new or changed one comes with a change to a `test-plans/*-tests.sql` (or a `No SQL test: <reason>` line in the description, for a comment or header fix).
  - A new Edge Function in `supabase/functions/` is named in `docs/database.md`.

The SQL suites join CI when spec 01 moves migrations into `supabase/migrations/` and CI can start a local stack ([testing.md](testing.md)).

## 3. Code review

Run Claude Code's review on the branch after CI is green:

```
/code-review high
```

Use `max` (or `/code-review ultra` for a multi-agent pass) when the PR touches any of:

- RLS policies, `SECURITY DEFINER` functions, grants, or anything in `private`/`audit`
- Edge Functions, auth, MFA, or the service role
- data a family or volunteer sees about someone else (rosters, emails, exports)

For each finding: fix it in the PR, or answer it in the PR's **Review** section (why it isn't a bug, or the follow-up issue it became). Paste the level and the outcome there, e.g. `high · 3 findings: 2 fixed, 1 answered`. A finding is never silently dropped.

A person reviews too when the PR changes who can read children's data, sends a new kind of email to families, or changes a legal text (the L-specs). CODEOWNERS requests them automatically.

## 4. Merge gate

- `main` is protected: a PR is required, `Lint, test, build` and `PR checks` must pass, and force pushes and deletion are off.
- The Regional Director merges, or says in the conversation that a session may. Approval for one PR never covers the next.
- Merge with a merge commit (the history keeps each PR's commits).

## 5. After merge

- Apply the PR's migrations to the demo in the order `docs/database.md` gives, then redeploy the frontend and any changed Edge Function (the demo has no Git deploys yet).
- Tick the spec in [specs/README.md](specs/README.md) and set the spec's **Status** to ✅ with the PR link.
- Remove the worktree: `git worktree remove ../Denver-SCC-worktrees/<slug>`.
