# CLAUDE.md — Denver Steel City Codes Management System

Guidance for Claude Code (and any subagents) working in this repo. Read the **Workflow** section
before starting any non-trivial change — it is the house rule, not a suggestion.

## Project snapshot

- **Stack:** React 19 + Vite + TypeScript + Tailwind v4 + react-router-dom 7.
- **Backend:** hosted Supabase (project ref `rdckxazvoeixgwtjhrlf`), auth + Postgres + RLS.
- **Repo:** `DenverSteelCityCodes/Denver-Steel-City-Codes-Management-System`, default branch `main`.
- **Commands:** `npm run dev` (Vite, port 5173) · `npm run build` (`tsc -b && vite build`) ·
  `npm run lint` (eslint). Run the dev server with `preview_start {name: "dev"}`, never Bash.
- **Schema source of truth:** `src/types/database.ts`, kept in sync with `supabase/migrations/`.
  Read it before writing any query. (Note: it can lag — e.g. the `Student` type omits the
  extended registration columns that migration `20260611000000` actually adds. Trust the
  migrations for column existence.)

## Workflow — one atomic issue → one atomic PR → one worktree per session

Every unit of work is **atomic**: it addresses exactly one concern, tracked by one issue,
delivered by one branch, one PR. Do not bundle unrelated changes. This keeps review small,
history bisectable, and lets multiple sessions run in parallel without colliding.

### 1. Atomic issue (first)
Before writing code for a new piece of work, open a single, tightly-scoped GitHub issue:

```bash
gh issue create --title "<concise, single concern>" --body "<problem, acceptance criteria>"
```

- **One concern per issue.** If the ask spans several concerns (e.g. "fix registration bugs"),
  split it into one issue per concern and confirm the split with the user first.
- If the work already has an issue, reuse it — don't open a duplicate.
- Skip the issue only for trivial, no-review changes (typo, comment) — and say so.

### 2. Isolated worktree (one per session)
Each session does its work in its **own git worktree**, so concurrent sessions never share a
checkout or step on each other's branch. Create it off an up-to-date `main`:

```bash
git fetch origin
git worktree add ../Denver-SCC-worktrees/<issue-slug> -b feat/<issue-slug> origin/main
```

- Branch naming: `feat/<slug>` for features, `fix/<slug>` for fixes (matches existing history).
- `<issue-slug>` is a short kebab-case name tied to the issue (e.g. `issue-42-parent-email`).
- Worktrees live in the sibling `../Denver-SCC-worktrees/` dir, never inside the repo.
- When subagents do parallel file-mutating work, give each its own worktree
  (`Agent` with `isolation: "worktree"`).
- After the PR merges, clean up: `git worktree remove ../Denver-SCC-worktrees/<issue-slug>`.

### 3. Atomic PR (closes the issue)
One branch → one PR that **closes exactly one issue**:

```bash
gh pr create --base main --title "<type>: <concise summary>" \
  --body "Closes #<issue>.\n\n<what & why>"
```

- The PR body must `Closes #<issue>` so the issue auto-closes on merge.
- Keep the diff focused on that one issue. If you discover an unrelated problem mid-PR, file a
  **new** issue for it (or use the background-task chip) rather than expanding this PR.
- Before opening the PR: `npm run build` and `npm run lint` pass; verify previewable changes in
  the browser per the verification workflow.

### Commit & PR conventions
- Commit/push only when the user asks; never commit straight to `main` — always the feature
  branch in the worktree.
- End commit messages with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- End PR bodies with:
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
- Reference issues/PRs as full markdown links, not bare `#123`.

## Testing
Use the `/test-feature` skill for hybrid AI+human test passes. Test plans land in `test-plans/`.
Tag any DB test rows `[TEST]` and confirm before deleting.
