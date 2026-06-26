# Steel City Codes — Admin Dashboard Redesign

**Handoff for Claude Code.** Author: design review. Scope: rebuild `AdminDashboard` from a
flat link-launcher into a real **admin hub** — persistent app-shell nav, a *Needs attention*
work queue, and contextual stat cards.

> **Read alongside this doc:**
> - `Admin Dashboard — Intended Design.html` — the **visual target**. Open it and toggle the
>   **Redesign** / **Annotated** tabs; the Annotated legend maps every change to the §s below.
> - `design_system.md` — canonical tokens/components. Build with semantic tokens, **never raw hex**.
>
> **Prerequisite:** the Tailwind-theme wiring from `CLAUDE_CODE_HANDOFF.md` §1 must already be
> in place (so `bg-brand`, `bg-surface`, `text-ink`, role/status utilities resolve). If the
> current dashboard renders unstyled, fix that first — nothing below will look right otherwise.

---

## TL;DR — what's wrong with the current page

`src/pages/AdminDashboard.tsx` is a **launcher, not a dashboard**: a top bar, 5 bare stat
tiles, and 8 identical navigation cards. It answers "where can I go?" but never "what needs
me right now?" — wrong for an admin power-user (design_system §1: *density, control,
scannable*). It also ships several DS violations.

| # | Problem | Severity | Fix in |
|---|---------|----------|--------|
| 1 | No app-shell nav — every sub-page bounces back here to navigate | 🟠 | new `AdminLayout.tsx` + `App.tsx` routes |
| 2 | Page is pure navigation; no actionable/at-a-glance content | 🟠 | new *Needs attention* section + hook |
| 3 | Stat cards are bare numbers (DS §7.3 wants delta/caption) | 🟡 | `StatCard.tsx` + `AdminDashboard.tsx` |
| 4 | Duplicate icon: Classes & Confirmed both use `ClipboardList` | 🟡 | `AdminDashboard.tsx` |
| 5 | "Pastel confetti" link cards (DS §3 violation) + generic copy | 🟡 | `AdminDashboard.tsx` |
| 6 | h1 is `text-3xl` (30px) — DS h1 is 40px; no personalization/voice | 🟢 | `AdminDashboard.tsx` |
| 7 | Generic "S" mark instead of the real wordmark; no search/theme/avatar | 🟢 | `AdminLayout.tsx` top bar |

Do **§1 first** — once the shell exists, the dashboard body is free to hold real content.

---

## §1 — 🟠 App shell: a persistent sidebar + top bar

design_system §7.6 specifies a **fixed left sidebar (260px)** with grouped, role-aware nav,
an active item using `bg-brand-soft text-ink` + a **3px gold left indicator**, and a
user/role footer — plus a **64px top bar** with the logo on a dark ink bar. Today there's no
sidebar at all.

### Extract a shared `AdminLayout`
Create `src/components/AdminLayout.tsx` that renders top bar + sidebar + `<Outlet />`, and
wrap all `/admin/*` routes in it (in `App.tsx`). Every admin page then loses its bespoke
header and just renders page content — the dashboard included.

```tsx
// src/components/AdminLayout.tsx (sketch — see mockup for exact markup)
export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="h-16 bg-ink-950 flex items-center gap-4 px-5">
        <img src={logo} alt="Steel City Codes // Denver" className="h-[21px]" />
        {/* search (⌘K), spacer, theme toggle, bell w/ dot, avatar menu */}
      </header>
      <div className="flex flex-1 min-h-0">
        <AdminSidebar />
        <main className="flex-1 min-w-0 bg-bg px-8 py-7"><Outlet /></main>
      </div>
    </div>
  )
}
```

**Logo:** use `src/assets/sccdenver.png` (import it; don't reference a generic "S"). DS §2 —
gold mark on the ink bar is its hero placement.

**Sidebar groups** (icon from `lucide-react`, label, optional count badge):
- **Overview** — Dashboard `layout-dashboard` *(active here)*
- **People** — Students `graduation-cap` · Volunteers `users` · Users & roles `shield`
- **Program** — Classes `layout-grid` · Sessions `calendar-days` · Duty schedule `list-checks` · Interviews `mic`
- **Setup** — Form editor `settings-2`

Active item: `bg-brand-soft text-ink` with a `before:` 3px gold bar on the left edge. Count
badges (e.g. **6** pending volunteers, **4** interviews) use `bg-warning-soft text-warning`.
Footer: avatar (initials on `role-admin-soft`, gold ring) + name + Admin role chip + sign-out
icon button. Wire `signOut` from `useAuth()` to the footer button **and** the top-bar avatar
menu (currently the only place sign-out lives).

**Routing:** in `App.tsx`, nest the admin routes:
```tsx
<Route element={<ProtectedRoute role="admin" />}>
  <Route element={<AdminLayout />}>
    <Route path="/admin" element={<AdminDashboard />} />
    <Route path="/admin/classes" element={<AdminClasses />} />
    {/* …students, volunteers, users, sessions, duties, interviews, forms */}
  </Route>
</Route>
```
Then **delete the duplicated `<header>` block** from each admin page (Dashboard, Classes,
Students, …) — the layout owns it now.

**Mobile:** sidebar collapses to an off-canvas drawer behind a hamburger in the top bar
(DS §5.2 / §7.6). Top bar stays.

---

## §2 — 🟠 "Needs attention" — make it a real dashboard

The highest-value change. Above the navigation, surface a work queue built from data you
**already have hooks for**. Each item: a tinted icon tile, a headline with the count, a
one-line detail, and a single secondary CTA that deep-links into the relevant admin page.

| Item | Source | Detail line | CTA → |
|---|---|---|---|
| Class **full** / ≥90% | `useAdminClasses` (section fill, see CLAUDE_CODE_HANDOFF §5.3) | "At capacity (16/16) — 3 on waitlist" | `/admin/classes` |
| Volunteer applications pending | `useVolunteerApplications` (`status='pending'`) | "Awaiting review — oldest is 4 days old" | `/admin/volunteers` |
| Interviews to schedule | `useInterviews` (accepted, no interview row) | "Accepted applicants with no interview booked" | `/admin/interviews` |
| Placeable waitlisted campers | `useAdminClasses` + `useRegistrations` | "Spots opened up across 2 sections" | `/admin/students` |

Rules:
- **Render an item only when its count > 0.** If everything is clear, show one friendly empty
  state (DS §7.10): a `bg-brand-soft` icon chip + "You're all caught up ✨" (emoji only in
  friendly confirmations, per §10).
- The **full-class** item is the highest priority → give it the danger edge
  (`border-danger` + `ring-1 ring-danger`, `triangle-alert` icon, `Full` danger badge). The
  rest use `surface` cards with a tinted icon (warning / volunteer / info).
- Two-up grid on desktop (`sm:grid-cols-2`), stacked on mobile. CTAs are **Secondary** buttons
  (`btn-sm`), since the page's single Primary is "New class" up top (DS §7.1 — one primary per view).

A small `useAdminAttention()` hook that composes the existing hooks (or one batched query)
keeps `AdminDashboard.tsx` declarative. Loading → render 3–4 skeleton rows (DS §7.4), not a
spinner.

---

## §3 — 🟡 Stat cards with context (`StatCard.tsx`)

DS §7.3 defines a stat card as *eyebrow label + big number + **delta/caption*** . Add an
optional caption/trend to the component and pass real context.

```tsx
interface Props {
  label: string
  value: number | string
  icon: LucideIcon
  iconColor?: string
  iconBg?: string
  delta?: { text: string; tone?: 'up' | 'warn' | 'info' | 'muted'; icon?: LucideIcon }
}
```
Render `delta` under the value: `text-[12.5px]` with `tone` → `text-success` / `text-warning`
/ `text-info` / `text-ink-muted`, optional 14px leading icon. Keep `tabular-nums` on the value.

Suggested content (wire to `useAdminStats`, extend it where noted):
- **Students** 142 · `+8 this week` (up) — needs a 7-day delta in the stats hook
- **Classes** 12 · `28 sections · 2 weeks` (muted) — **icon → `layout-grid`** (fixes §4 duplicate)
- **Volunteers** 34 · `6 pending review` (warn) — count from `useVolunteerApplications`
- **Confirmed** 118 · `83% of registrations` (muted) — icon `circle-check`
- **Waitlisted** 9 · `3 placeable now` (info) — icon `list`

Layout unchanged (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4`). Optionally make a
card a `<Link>` that deep-links to a filtered list.

---

## §4 — 🟡 Calm the navigation grid + voice

- The 8 quick-link cards currently use a rainbow of soft fills (DS §3: *"pastels are
  semantic, not decorative confetti"*) with an inconsistent mapping (e.g. Classes = brand-soft
  bg + warning text). With the sidebar handling primary nav, **demote this grid** to a quiet
  secondary "Jump to" row: neutral `bg-surface` tiles, icon in a `bg-surface-sunken` chip that
  shifts to `bg-brand-soft text-warning` **on hover only**. One accent, no confetti.
- **h1 → 40px** (`text-[40px] leading-[46px] font-bold tracking-[-0.01em]`); it's currently
  `text-3xl` (30px), i.e. an h2.
- **Personalize + warm up the copy** (DS §10): `Good morning, {profile.display_name.split(' ')[0]}`
  with a Slab subhead carrying today's date + active session ("Summer 2026 — Week 1 starts
  Monday"). Keep the **New class** primary button in the header.

---

## §5 — Acceptance checklist
- [ ] All `/admin/*` pages render inside one shared shell; the sidebar is always present with
      a gold active indicator and the per-page bespoke `<header>` blocks are deleted.
- [ ] Top bar shows the real `sccdenver.png` wordmark, a search field, theme toggle, a
      notifications bell, and an avatar menu with working **Sign out**.
- [ ] Sidebar count badges reflect live pending volunteers / interviews.
- [ ] "Needs attention" lists only items with count > 0; a full class shows the danger
      treatment; each CTA deep-links to the right admin page; all-clear shows the empty state.
- [ ] Stat cards show a delta/caption; **Classes** uses `layout-grid` (no duplicate icon);
      numbers are `tabular-nums`; loading shows skeletons, not `—`.
- [ ] "Jump to" grid is neutral with a single gold hover accent (no multi-pastel cards).
- [ ] h1 renders at 40px and greets the admin by first name.
- [ ] Mobile: sidebar collapses to a drawer; layout doesn't overflow.
- [ ] `npm run build` (tsc) passes; no raw hex introduced — semantic tokens only.

---

## §6 — Suggested PR sequence (small, per PLAN.md)
1. **`feat/admin-shell`** — §1: `AdminLayout` + `AdminSidebar`, route nesting, strip per-page headers. Pure structure.
2. **`feat/admin-stat-context`** — §3 + §4 (stat captions, icon fix, h1/voice, calmed grid). Low-risk visual polish.
3. **`feat/admin-needs-attention`** — §2: `useAdminAttention` + the work-queue section. Depends on the section-fill data from `CLAUDE_CODE_HANDOFF.md` §5.3 for the capacity item.

PR 1 delivers the biggest usability win on its own and unblocks the rest. Tag AI-authored PRs
`[AI-Authored]` and update `PLAN.md` when the shell lands (it changes the routing model for
every admin page).
