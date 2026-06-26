# Steel City Codes — Parent Dashboard Redesign

**Handoff for Claude Code.** Author: design review. Scope: turn `ParentDashboard` from a thin
list of campers into a **reassuring parent hub** — status-at-a-glance camper cards, human
status copy, schedule detail, and a clear single primary action.

> **Read alongside this doc:**
> - `Parent Dashboard — Intended Design.html` — the **visual target**. Toggle **Redesign** /
>   **Annotated**; the legend maps each marker to the §s below.
> - `design_system.md` — canonical tokens/components. Build with semantic tokens, **never raw hex**.
>
> **Prerequisite:** the Tailwind-theme wiring from `CLAUDE_CODE_HANDOFF.md` §1 must be in place.

---

## TL;DR — design intent

Parents are **busy, non-technical, protective, often on a phone** (design_system §1 → *warmth,
clarity, zero friction, reassurance*). The current `src/pages/ParentDashboard.tsx` lists campers
with raw `pending` / `waitlisted` pills and crowds three look-alike buttons into the header. It's
functional but cold and anxiety-inducing — a parent can't tell at a glance *"is my kid all set?"*

| # | Problem | Severity | Fix in |
|---|---------|----------|--------|
| 1 | Raw lowercase status pills (`pending`, `waitlisted`) — no meaning, no reassurance | 🟠 | `StudentCard.tsx` |
| 2 | Camper card is bare — no schedule, no per-camper status summary | 🟠 | `StudentCard.tsx` |
| 3 | Three competing header buttons (Browse / Register / Add) | 🟡 | `ParentDashboard.tsx` |
| 4 | No session context (dates / time / location) | 🟡 | new strip + `useSessions` |
| 5 | Generic "S" mark instead of the wordmark; no notifications | 🟢 | shared top bar |
| 6 | h1 is 30px (DS h1 = 40px); subhead is generic, not status-aware | 🟢 | `ParentDashboard.tsx` |
| 7 | Medical flag is a bare icon — misses the §9 trust affordance | 🟢 | `StudentCard.tsx` |

---

## §1 — 🟠 Human status copy (`src/components/StudentCard.tsx`)

Today: `<span>{reg.status}</span>` renders the raw enum (`pending`, `waitlisted`) in lowercase.
DS §7.5 wants **Deep-on-Soft + an icon + a label**, and §10 wants **kind, plain language**. Map
each status to friendly copy + a Lucide icon + an optional sub-note:

```tsx
const STATUS = {
  confirmed:  { label: 'Confirmed',  cls: 'bg-success-soft text-success', icon: CircleCheck, note: null },
  pending:    { label: 'Spot held',  cls: 'bg-warning-soft text-warning', icon: Clock,       note: "We'll confirm soon" },
  waitlisted: { label: 'On waitlist',cls: 'bg-info-soft text-info',       icon: List,        note: '#{pos} in line' },
  cancelled:  { label: 'Cancelled',  cls: 'bg-danger-soft text-danger',   icon: CircleX,     note: null },
} as const
```
Render the chip as `inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs
font-semibold` (DS §7.5) with the 13px icon, and the note in `caption`/`text-ink-faint` beneath.
Waitlist position (`#2 in line`) needs the registration's queue rank — if it's not already
computed, derive it from `created_at` order within the section, or hide the note until the data
exists.

---

## §2 — 🟠 Richer camper cards (`StudentCard.tsx`)

Make each camper the centerpiece. Anatomy (see mockup):

- **Header:** avatar (initials on `role-parent-soft`) · name (`h3`/18px) · `Age N` muted ·
  optional medical chip (§7) · a right-aligned **status summary badge** that rolls up the
  camper's registrations:
  - all confirmed → `All set` (success, `circle-check`)
  - any pending/waitlisted → `Action pending` (warning, `clock`)
  - no registrations → `Not enrolled` (muted)
- **Enrollment rows** (one per registration): a category icon tile, class name + section
  (`reg.sections.classes.name · reg.sections.label`), a **schedule line**
  (`Week {n} · Mon–Fri · 9:00–12:00 · Lead {name}`), and the status chip from §1.
- **Footer** (`bg-surface-sunken`): per-camper actions — `Edit camper` (ghost) +
  **`Register for another class`** (secondary, deep-links to `/parent/classes?camper={id}`).

**Data note:** the schedule fields (week, weekdays, start/end time, lead volunteer) aren't all on
`RegistrationWithSection` yet. Extend the select in `useRegistrations` to pull `sections.week`
and any `start_time`/`end_time`/`weekdays` columns (add them to `sections` if they don't exist —
flag this; it may be a small schema add). Lead name comes from `sections.lead → volunteers →
profiles.display_name`. Until those exist, render only the fields you have and omit the rest —
don't fabricate times.

---

## §3 — 🟡 Action hierarchy + voice (`ParentDashboard.tsx`)

- **One primary** (DS §7.1). Keep the gold **Add camper** in the header; move **Register** onto
  each camper card (§2) where it has context. Keep **Browse classes** as a single secondary.
  This removes the row of three same-weight buttons.
- **h1 → 40px** (`text-[40px] leading-[46px] font-bold tracking-[-0.01em]`); currently `text-3xl`.
- **Status-aware subhead** instead of "Manage your camper's enrollment." Compute a one-line
  rollup from registrations — e.g. *"Both campers are signed up — one spot still to confirm,"* or
  *"Add your first camper to get started"* when empty. Slab, `text-ink-muted`, voice §10.
- Keep the existing empty state — it already matches §7.10; just bump its heading and warm the copy.

---

## §4 — 🟡 Session info strip (optional — needs data)

A `bg-surface` strip above the camper list: calendar icon tile + **session name** + dates,
drop-off time, location + a "Starts in N days" `info` chip. This is exactly the reassurance
parents want, but it depends on real session data — pull the active session from `useSessions`
(name, start/end dates) and any drop-off/location fields. **If those fields don't exist, ask the
product owner before inventing them; ship the strip only once the data is real.** Don't hard-code
placeholder dates into the build.

---

## §5 — 🟢 Shared top bar + medical affordance

- **Top bar:** reuse the same shell pattern as the admin redesign — the real
  `src/assets/sccdenver.png` wordmark on the `bg-ink-950` bar, a notifications bell (parents care
  about status changes), and the avatar menu (initials on `role-parent-soft`). A light inline nav
  (Home · Browse classes) is enough — parents don't need the admin sidebar. If you build a
  `ParentLayout`, the `signOut` action lives in the avatar menu.
- **Medical flag (§9):** the bare `HeartPulse` icon becomes a labelled `danger-soft` chip
  ("Allergy info on file") **plus** a small caption "Medical details are visible only to camp
  staff." Keep the actual details behind a tap/expand — never in the list preview (§9). This is a
  trust signal for protective parents, not just an icon.

---

## §6 — Acceptance checklist
- [ ] Status chips read as friendly labels + icon (Confirmed / Spot held / On waitlist /
      Cancelled), never the raw lowercase enum.
- [ ] Each camper card shows a rollup status badge (All set / Action pending / Not enrolled) and,
      where data exists, per-class schedule detail.
- [ ] Header has exactly one gold primary (Add camper) + one secondary (Browse classes);
      "Register for another class" lives on each camper card and deep-links with the camper id.
- [ ] h1 is 40px; the subhead reflects real enrollment status; empty state warm and intact.
- [ ] Top bar shows the wordmark, a notifications bell, and a parent-tinted avatar menu with
      working sign-out.
- [ ] Medical info shows the labelled chip + "visible only to staff" note; details stay behind a
      tap; nothing sensitive in list previews (§9).
- [ ] Session strip appears only when backed by real `useSessions` data (no hard-coded dates).
- [ ] Mobile: cards stack, header buttons wrap cleanly, tap targets ≥44px (§5.2). Parents live on
      phones — verify at 375px width.
- [ ] `npm run build` passes; semantic tokens only, no raw hex.

---

## §7 — Suggested PR sequence
1. **`feat/parent-status-copy`** — §1 + §7: humanize `StudentCard` status chips + medical
     affordance. Self-contained, immediate clarity win.
2. **`feat/parent-camper-cards`** — §2 + §3: richer cards, schedule detail, action hierarchy,
     h1/voice. (Coordinate the §2 schema/select additions with whoever owns `sections`.)
3. **`feat/parent-shell-session`** — §5 top bar/layout + §4 session strip (ship the strip only
     once session data is wired).

PR 1 alone removes the biggest "cold and confusing" friction. Tag AI-authored PRs `[AI-Authored]`
and update `PLAN.md` if the §2 `sections` schedule fields require a migration.
