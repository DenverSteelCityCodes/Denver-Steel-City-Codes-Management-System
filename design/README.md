# Design directives

These are the design-review **handoffs** and specs for Steel City Codes. They were authored in the Claude Design project **"Denver Steel City Codes Management System"** (id `9415e75b-20c1-4333-8b54-390e2e221ac2`, owner Haanie) and imported here so the whole team has them in version control — not just people with Claude Design access.

> **Source of truth.** These handoffs are the canonical directives. Build with the semantic tokens in `design_system.md` (repo root) — never raw hex.

## Contents

| File | What it directs | Status |
|------|-----------------|--------|
| [`CLAUDE_CODE_HANDOFF.md`](./CLAUDE_CODE_HANDOFF.md) | **Sprint 1** — wire Tailwind v4 tokens, fix volunteer sign-in (server-side `handle_new_user` trigger), fix class-list queries, ship the **classes → sections** model | ✅ Done in code |
| [`ADMIN_DASHBOARD_HANDOFF.md`](./ADMIN_DASHBOARD_HANDOFF.md) | **Admin dashboard redesign** — app-shell sidebar/top bar, "Needs attention" work queue, contextual stat cards | 🔧 In progress — epic #31 |
| [`PARENT_DASHBOARD_HANDOFF.md`](./PARENT_DASHBOARD_HANDOFF.md) | **Parent dashboard redesign** — human status copy, rich camper cards, parent shell + session strip | 🔧 In progress — epic #32 |

The intended-design **HTML mockups** (`Admin Dashboard — Intended Design.html`, `Parent Dashboard — Intended Design.html`, `Classes UI — Intended Design.html`, `Style Guide.html`) remain in the Claude Design project as the visual targets and can be exported from there.

## Related issues
- **#30** — build regression fix (`support_id` → `section_supports`) — resolved
- **#31** — Admin Dashboard redesign epic
- **#32** — Parent Dashboard redesign epic

## Accessing the live design project
Run `/design-login` (authorizes design-system scopes), then the `DesignSync` tool can read/update the project. The handoffs here are point-in-time copies; the Claude Design project is where they originated.
