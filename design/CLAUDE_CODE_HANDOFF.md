# Steel City Codes — Sprint 1 Fix & Sections Feature

**Handoff for Claude Code.** Author: design review. Scope: fix "classes don't show up
anywhere" + ship the **classes → sections** model + bring the Classes UI up to the
intended design.

> **Read these alongside this doc:**
> - `Classes UI — Intended Design.html` — the **visual target** for every screen below
>   (open it in a browser; toggle the three tabs: Admin · Parent · Editors).
> - `design_system.md` — the canonical token/component spec. Build with semantic tokens,
>   never raw hex.

---

## TL;DR — what's actually wrong

The UI looked broken **mostly for one reason**: the design-system tokens were never wired
into Tailwind, so almost no branded utility class produced any CSS. On top of that, two
data-layer queries error out, so the `classes` list comes back empty for both admins and
parents even when rows exist. Then there's the new requirement: classes need multiple
**sections**, each with its own age range and capacity.

Work in this order — **§1 first**, because until Tailwind is wired up you can't visually
trust anything else.

| # | Problem | Severity | Fix in |
|---|---------|----------|--------|
| 1 | Tailwind v4 ignores `tailwind.config.js` → custom utilities don't exist | 🔴 Blocker | `src/index.css` |
| 2 | `ink-900` / `ink-950` utilities used but never defined | 🔴 | `src/index.css` |
| 3 | Admin class list query throws (bad FK hint) → list always empty | 🟠 | `useAdminClasses.ts` |
| 4 | Parent class list query throws (filter on aggregate embed) → list always empty | 🟠 | `useClasses.ts` |
| 5 | Classes need sections (age range + capacity per section) | 🟡 Feature | schema + types + hooks + pages |
| 6 | **Volunteer accounts always become parents — no real volunteer sign-in** | 🔴 | `AuthContext.tsx` + signup/apply + DB trigger |

---

## §0 — 🔴 Volunteer accounts always turn into parents

### Why it happens
The role is **hardcoded to `'parent'` in two places**, and there is no server-side mechanism
to honor the role a person signed up as:

1. `src/pages/SignupPage.tsx` → `profiles.insert({ …, role: 'parent' })`.
2. `src/context/AuthContext.tsx` → `loadProfile()`'s fallback auto-creates a missing profile
   as `role: 'parent'`.

That fallback exists because the **client-side profile insert is blocked by RLS before email
confirmation** — the `self_insert_profile` policy needs `id = auth.uid()`, i.e. an active
session, which doesn't exist until the user confirms their email. So in practice:

- A volunteer applies on `/apply` → `VolunteerApplyPage` calls `auth.signUp(...)` and inserts
  a `volunteer_applications` row **but never creates a profile**.
- When the applicant first authenticates (after email confirm), `loadProfile` finds no
  profile and **auto-creates one as `'parent'`**. → They are now a parent.
- The *only* path to `volunteer` is the admin opening the application and clicking Accept
  (`acceptApplication` upserts role → volunteer + inserts a `volunteers` row). That path
  (a) throws `"No linked account"` whenever `app.user_id` is null (e.g. the email already had
  an account), and (b) even on success only flips the role on the volunteer's *next* sign-in.

Net result: there is effectively **no reliable way to sign in as a volunteer.**

### The fix — create profiles server-side from signup metadata (standard Supabase pattern)
A trigger on `auth.users` creates the profile automatically, reading the intended role from
the signup metadata. It runs `SECURITY DEFINER` (bypasses RLS), works *before* email
confirmation, and lets us delete BOTH the client-side insert and the parent-hardcoded
fallback.

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1), 'User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'parent')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

Then on the client:
- **`SignupPage`** (parents): `signUp({ …, options: { data: { display_name, role: 'parent' } } })`.
  **Delete** the subsequent `profiles.insert`.
- **`VolunteerApplyPage`**: `signUp({ …, options: { data: { display_name, role: 'volunteer' } } })`.
  Keep the `volunteer_applications` insert.
- **`AuthContext.loadProfile`**: **remove** the parent-hardcoded auto-create block entirely.
  The trigger guarantees a profile exists; if one is genuinely missing, show a graceful
  loading/empty state instead of minting a parent.

### Product decision — when does an applicant *become* a volunteer? (pick one)
- **Option A — role flips only on admin acceptance** (closest to current intent). Applicants
  sign up with metadata `role: 'parent'` and can't reach the volunteer area until accepted.
  Downside: they look like parents in the meantime and pollute parent data.
- **Option B — recommended — applicant is a `volunteer` from signup, gated "pending".** The
  trigger sets `role: 'volunteer'`; they can sign in and see the volunteer dashboard in a
  **pending** state ("Application under review — interview pending"). The `volunteers` row
  (experience level) + class assignment only appear once an admin Accepts. Gate real
  volunteer features on the **existence of a `volunteers` row** (or `application.status =
  'accepted'`), not on the role string alone; show rejected applicants a "not approved"
  state. `useAssignedClass` already returns `null` when unassigned — add a pending banner to
  `VolunteerDashboard` for the no-`volunteers`-row case. This makes "sign in as a volunteer"
  work immediately while keeping parents and volunteers cleanly separated.

### Also fix
- `acceptApplication` should handle `app.user_id == null` gracefully: if the applicant's
  email already had an account, link by email or ask them to sign in first — don't dead-end.
- `LoginPage` / `AuthContext` call `navigate()` during render; move redirects into an effect
  (minor, not the bug, but clean it up while you're here).

---

## §1 — 🔴 BLOCKER: wire the design tokens into Tailwind v4

### Why the UI looks unstyled
The project runs **Tailwind v4** (`@tailwindcss/vite`, `@import "tailwindcss"` in
`src/index.css`). **Tailwind v4 does not read `tailwind.config.js` automatically.** That
config file defines every brand color (`bg`, `surface`, `ink`, `brand`, `role`, status…),
but because it's never loaded, utilities like `bg-brand`, `bg-surface`, `text-ink`,
`text-ink-muted`, `border-border`, `bg-ink-900` **generate no CSS at all**.

Result: layout/spacing utilities (`flex`, `h-16`, `rounded-xl`, `px-6`) work, so the page
has structure — but the dark top bars are transparent, primary buttons have no fill, cards
have no surface color or border, badges are colorless. That is the "CC struggled with the
UI" symptom.

### The fix (canonical, v4-native): add a `@theme inline` block to `src/index.css`
Keep the existing `:root` / `[data-theme="dark"]` variable blocks **exactly as they are**
(they're the runtime source of truth and power dark mode). Add a `@theme inline` block that
maps those variables to Tailwind's color namespace. `inline` means the generated utilities
emit `var(--…)` references rather than baking in a hex value — so dark mode keeps working by
swapping the variables.

Also add the missing **ink ramp** (`ink-50`…`ink-950`, from `design_system.md` §3.2) since
the app already references `ink-900` and `ink-950`.

```css
@import "tailwindcss";

/* 1. Add the ink ramp to BOTH :root and the dark block (values from design_system.md §3.2).
      In :root { … } add: */
  --ink-950:#1A1613; --ink-900:#262019; --ink-700:#4A4138; --ink-500:#7A6E60;
  --ink-400:#9C8F7E; --ink-300:#CFC6B8; --ink-200:#E6DFD3; --ink-100:#F2ECE2; --ink-50:#FAF6EF;
/* (the existing --ink / --ink-muted / --ink-faint stay too) */

/* 2. After the :root and [data-theme="dark"] blocks, add this mapping: */
@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface-sunken: var(--surface-sunken);
  --color-surface-raised: var(--surface-raised);

  --color-ink: var(--ink);
  --color-ink-muted: var(--ink-muted);
  --color-ink-faint: var(--ink-faint);
  --color-ink-950: var(--ink-950);
  --color-ink-900: var(--ink-900);
  --color-ink-700: var(--ink-700);
  --color-ink-500: var(--ink-500);
  --color-ink-400: var(--ink-400);
  --color-ink-300: var(--ink-300);
  --color-ink-200: var(--ink-200);
  --color-ink-100: var(--ink-100);
  --color-ink-50:  var(--ink-50);

  --color-border: var(--border);
  --color-border-strong: var(--border-strong);

  --color-brand: var(--brand);
  --color-brand-hover: var(--brand-hover);
  --color-brand-soft: var(--brand-soft);
  --color-brand-on: var(--on-brand);

  --color-success: var(--success);          --color-success-soft: var(--success-soft);
  --color-warning: var(--warning);          --color-warning-soft: var(--warning-soft);
  --color-danger:  var(--danger);           --color-danger-soft:  var(--danger-soft);
  --color-info:    var(--info);             --color-info-soft:    var(--info-soft);

  --color-role-admin: var(--role-admin);            --color-role-admin-soft: var(--role-admin-soft);
  --color-role-volunteer: var(--role-volunteer);    --color-role-volunteer-soft: var(--role-volunteer-soft);
  --color-role-parent: var(--role-parent);          --color-role-parent-soft: var(--role-parent-soft);

  --radius: 0.625rem;
  --font-sans: "Josefin Sans", ui-sans-serif, system-ui, sans-serif;
  --font-slab: "Josefin Slab", Georgia, serif;

  --shadow-sm: var(--shadow-sm);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);

  --ease-brand: var(--ease);
}
```

**Naming notes (so existing class names keep working):**
- `--color-brand-on` makes `text-brand-on` / `bg-brand-on` work (code uses `text-brand-on`).
- `--color-surface-sunken` → `bg-surface-sunken`; `--color-surface-raised` → `bg-surface-raised`.
- The ink ramp makes `bg-ink-900`, `bg-ink-950`, and the opacity form `bg-ink-950/50` resolve.
- Font families: `font-sans` / `font-slab` already match the config.

**Then delete `tailwind.config.js`** (v4 doesn't use it; leaving it is misleading) **OR**, if
you'd rather keep a JS config, skip the `@theme` block and instead add **one line** after the
import: `@config "../tailwind.config.js";` — but you still must add the `ink-50…950` ramp to
that config's `colors.ink`. **Pick one approach, not both.** The `@theme inline` route is
recommended — tokens live next to their variable definitions.

### Verify §1 before moving on
Run `npm run dev` and confirm: top bars are dark (`--ink-950`), the "New class" button is
gold with dark text, cards have white surfaces + hairline borders, role chips are tinted.
If any of those are still missing, the mapping name is wrong — check the `--color-*` key
against the utility the component uses.

---

## §2 — 🟠 Admin classes never load (`src/hooks/useAdminClasses.ts`)

### Bug
The select embeds volunteer names via:
```ts
lead:profiles!classes_lead_id_fkey(display_name),
support:profiles!classes_support_id_fkey(display_name),
```
But in `schema.sql`, `classes.lead_id` and `classes.support_id` reference **`volunteers(id)`**,
not `profiles`. The constraint `classes_lead_id_fkey` points at `volunteers`, so asking
PostgREST to follow it into `profiles` throws *"Could not find a relationship …"*. The whole
query errors, `setError` fires, and `classes` stays `[]` — so a freshly created class never
appears (the row IS inserted; only the **list query** fails).

### Fix
`volunteers.id` **is** `profiles.id` (shared PK). Hop classes → volunteers → profiles:
```ts
const { data, error } = await supabase
  .from('classes')
  .select(`
    *,
    lead:volunteers!classes_lead_id_fkey ( profile:profiles ( display_name ) ),
    support:volunteers!classes_support_id_fkey ( profile:profiles ( display_name ) ),
    registrations(count)
  `)
  .order('name', { ascending: true })
```
Then read `c.lead?.profile?.display_name`. **Important:** once §5 (sections) lands, lead/
support move to the **section** level and this hook changes shape entirely (see §5.4) — so
if you're doing §5 in the same PR, you may skip patching the old shape and go straight to
the section-aware query. If §5 is a later PR, apply this fix now so admins aren't blocked.

---

## §3 — 🟠 Parent classes never load (`src/hooks/useClasses.ts`)

### Bug
```ts
.from('classes')
.select(`*, registrations(count)`)
.in('registrations.status', ['confirmed', 'pending'])
```
You can't filter on a column (`registrations.status`) of an embed that's only present as an
aggregate (`registrations(count)`) — PostgREST errors, and the parent class list comes back
empty. Even when it doesn't hard-error, the count ignores the filter.

### Fix
Filter the count inside the embed instead of at the top level, and alias it:
```ts
.from('classes')
.select(`*, registrations(count)`)   // count of ALL regs
```
…or, to count only active ones, use an inner-embed filter alias:
```ts
.select(`*, active:registrations!inner(count)`)
.in('active.status', ['confirmed', 'pending'])
```
Simplest robust option that doesn't drop empty classes: fetch the plain count and treat
`waitlisted`/`cancelled` separately in JS, or compute the active count with a SQL view (see
§5.3 — the `class_section_fill` view makes this clean once sections exist). **Note:** classes
with **zero** registrations must still appear — don't let an inner join hide them on the
parent browse screen.

---

## §4 — 🟡 FEATURE: classes → sections

A **class** is a course (e.g. "Intro to Python"). A **section** is one offering of that
course with **its own age range, capacity limit**, optional week, and its own lead/support
crew. Registrations and attendance attach to a **section**, not a class.

See `Classes UI — Intended Design.html` → **Editors** tab → "Model at a glance" for the
one-paragraph version, and the **Admin** / **Parent** tabs for the screens.

### Decisions baked into this spec (flag if you want them changed)
- Class loses `age_group` and `capacity`; gains optional `description`. Age + limit live on sections.
- Section has `label`, `age_min`, `age_max`, `capacity`, nullable `week` (1 or 2), nullable `lead_id`/`support_id` (→ `volunteers`).
- A class's "X / Y enrolled" shown to admins = **sum across its sections** (derived).
- Capacity / waitlist logic runs **per section**.
- Eligibility: a camper may register for a section only if `age_min ≤ student.age ≤ age_max`.
- The volunteer auto-matcher pairs senior+junior **per section** (was per class).

---

## §5 — Implementation detail for sections

### §5.1 Schema migration (`schema.sql` + a migration script)
Write this as a forward migration. Order matters (drop dependents' FKs, repoint, backfill).

```sql
-- 1. New table: sections
CREATE TABLE sections (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    age_min     SMALLINT NOT NULL CHECK (age_min > 0 AND age_min < 18),
    age_max     SMALLINT NOT NULL CHECK (age_max >= age_min AND age_max < 18),
    capacity    SMALLINT NOT NULL CHECK (capacity > 0),
    week        SMALLINT CHECK (week IN (1, 2)),          -- nullable
    lead_id     UUID REFERENCES volunteers(id) ON DELETE SET NULL,
    support_id  UUID REFERENCES volunteers(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON sections (class_id);

-- 2. classes loses age_group/capacity/lead/support, gains description.
--    (If there is existing data, first create one default section per class
--     copying its old age_group→label and capacity, then drop the columns.)
ALTER TABLE classes ADD COLUMN description TEXT;
ALTER TABLE classes DROP COLUMN age_group, DROP COLUMN capacity,
                    DROP COLUMN lead_id,   DROP COLUMN support_id;

-- 3. registrations + attendance point at a section instead of a class.
ALTER TABLE registrations ADD COLUMN section_id UUID REFERENCES sections(id) ON DELETE CASCADE;
-- backfill section_id from class_id via the default section, then:
ALTER TABLE registrations DROP COLUMN class_id;
ALTER TABLE registrations ADD CONSTRAINT registrations_student_section_key UNIQUE (student_id, section_id);
ALTER TABLE registrations ALTER COLUMN section_id SET NOT NULL;
CREATE INDEX ON registrations (section_id);

ALTER TABLE attendance_logs ADD COLUMN section_id UUID REFERENCES sections(id) ON DELETE CASCADE;
-- backfill, then:
ALTER TABLE attendance_logs DROP COLUMN class_id;
CREATE INDEX ON attendance_logs (section_id);
```

### §5.2 RLS for sections (mirror the `classes` policies)
```sql
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_sections" ON sections FOR ALL
  USING (auth_user_role() = 'admin') WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY "parent_read_sections" ON sections FOR SELECT
  USING (auth_user_role() = 'parent');

CREATE POLICY "volunteer_read_assigned_sections" ON sections FOR SELECT
  USING (lead_id = auth.uid() OR support_id = auth.uid());
```
Update `registrations` / `attendance_logs` policies that referenced `classes c WHERE c.id =
class_id` to join through `sections s WHERE s.id = section_id` (volunteer-assignment checks
now read `s.lead_id` / `s.support_id`). Parents keep registering/reading via the
`students.parent_id = auth.uid()` ownership check (unchanged). **Verify a parent can SELECT a
class with zero sections** so empty courses still render.

### §5.3 Helpful view for fill counts (optional but recommended)
```sql
CREATE VIEW section_fill AS
  SELECT s.*,
         COUNT(r.id) FILTER (WHERE r.status IN ('confirmed','pending')) AS registered_count
  FROM sections s LEFT JOIN registrations r ON r.section_id = s.id
  GROUP BY s.id;
```
This removes the count-embedding pain from §3 entirely — query `section_fill` instead of
hand-rolling `registrations(count)` filters.

### §5.4 TypeScript types (`src/types/database.ts`)
```ts
export interface Class {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface Section {
  id: string
  class_id: string
  label: string
  age_min: number
  age_max: number
  capacity: number
  week: 1 | 2 | null
  lead_id: string | null
  support_id: string | null
  created_at: string
}
```
Remove `age_group`, `capacity`, `lead_id`, `support_id` from `Class`. Update `Registration`
and `AttendanceLog` to use `section_id` instead of `class_id`.

### §5.5 Hooks
- **`useAdminClasses`** → returns classes each with a nested `sections[]`, each section
  carrying `registered_count` and resolved lead/support display names. Add
  `createSection / updateSection / deleteSection` plus the existing
  `createClass / updateClass / deleteClass`. Class-level enrolled = `sum(section.registered_count)`,
  class-level capacity = `sum(section.capacity)`.
  ```ts
  .from('classes')
  .select(`
    *,
    sections (
      *,
      lead:volunteers!sections_lead_id_fkey ( profile:profiles ( display_name ) ),
      support:volunteers!sections_support_id_fkey ( profile:profiles ( display_name ) ),
      registrations(count)
    )
  `)
  .order('name')
  ```
- **`useClasses`** (parent) → same nested shape, no admin-only volunteer joins needed; just
  `sections(*, registrations(count))`. Drop the broken `.in('registrations.status', …)`.
- **`useRegistrations`** → `register(studentId, sectionId, …)`; capacity check uses the
  section's count/capacity; status `waitlisted` when full. Reads join
  `sections ( label, age_min, age_max, capacity, classes ( name ) )`.
- **`useAssignedClass`** → becomes "assigned section(s)": find sections where
  `lead_id = user.id OR support_id = user.id`; roster comes from registrations on that
  `section_id`. A volunteer may lead more than one section — return an array.
- **`useAdminStats`** → "Classes" stat can stay a class count, or add a "Sections" stat.
- **`volunteerMatcher`** (`src/lib/volunteerMatcher.ts`) → iterate **sections** (optionally
  filtered by `week`) instead of classes; assign `lead_id`/`support_id` on the section.
  `AdminVolunteers.tsx`'s apply step calls `updateSection` per section.

---

## §6 — UI spec (match `Classes UI — Intended Design.html`)

### §6.1 Admin · Manage classes — `src/pages/AdminClasses.tsx`
Replace the flat `DataTable` with an **expandable class list**:
- Each **class** is a `bg-surface border border-border rounded-[14px]` panel with a header
  row: chevron (rotates on open) · class name (`h3`, 19px/600) · a "N sections" chip
  (`bg-surface-sunken text-ink-muted`) · a small fill meter showing summed
  `enrolled / capacity` · edit + delete icon-buttons. Clicking the header (not the action
  buttons) toggles the section list.
- Expanded body (`bg-surface-sunken`, top hairline): an **eyebrow** "Sections" label, then
  one row per section laid out as a 5-col grid:
  `label (+ week badge) | age chip "Ages 8–10" | capacity meter (n/cap, "Almost full"≥90%, "Full → waitlist"=100%) | crew avatars + names | edit/delete`.
  Capacity colors: `--brand` < 90%, `--warning` 90–99%, `--danger` at 100% (CapacityMeter
  already encodes this — reuse it).
- A dashed **"Add section to {class}"** button closes each expanded panel.
- Crew avatars: 30px round, role-volunteer tint, **senior gets a gold ring**
  (`ring-2 ring-brand`), overlapped `-ml-2 ring-2 ring-surface` (design_system §7.12).
- Empty state when no classes: friendly Lucide chip + "No classes yet — create your first
  course." (design_system §7.10).

### §6.2 Class editor & Section editor (modals) — Editors tab
Two separate dialogs (`bg-surface-raised rounded-[18px] shadow-lg`, scrim
`bg-ink-950/50`):
- **Class editor:** `name` (required) + `description` (optional textarea, helper "Shown to
  parents above the section list"). No age/capacity fields. After save, prompt to add sections.
- **Section editor:** `label` (required) · `min age` + `max age` (two-col number inputs, with
  a live "Eligible: Ages 8–10" preview chip) · `capacity` · `week` (segmented Week 1 / Week 2)
  · `lead` + `support` selects (volunteers, optional). Validate `age_max ≥ age_min` and
  `capacity ≥ 1` on blur; kind inline errors (design_system §7.2).

### §6.3 Parent · Browse classes — `src/pages/ClassBrowser.tsx` + `ClassCard`/new `SectionCard`
- Keep the camper picker + search toolbar. When a camper is selected, show the gold info
  banner: "Showing eligibility for {name} (age {n})…".
- Group results by **class** (course name `h2` + description in Slab), then a responsive grid
  of **section cards**:
  - Eligible section (camper age within range): green "Ages 8–10 · {name} fits" chip,
    capacity meter, primary **"Register {name}"** button — or the status line
    (Confirmed/Pending/Waitlisted) if already registered. Full section → button label
    becomes **"Join waitlist"**.
  - Ineligible section (age outside range): dimmed card (`opacity-72 bg-surface-sunken`),
    a neutral lock chip "Ages 11–13", and a muted "Not eligible for {name} (age {n})" line
    instead of a button. Still visible, never registerable.
- `ClassCard` becomes a course wrapper; introduce a `SectionCard` for the inner cards. All
  registration calls pass `section_id`.

### §6.4 Volunteer & attendance (downstream, smaller)
`VolunteerDashboard` / attendance now key off **section** rather than class — show the
section label + its parent class name in the header ("Intro to Python · Beginners A"). The
`AttendanceRow` / check-in logic is otherwise unchanged; just thread `section_id`.

---

## §7 — Acceptance checklist
- [ ] **§1 verify:** dark top bars, gold primary buttons, white cards w/ borders, tinted role chips all render. No unstyled gray screens.
- [ ] **§0 verify:** a new volunteer applicant can sign in and lands on the **volunteer** experience (not parent); a parent signup lands on parent. No account silently becomes a parent.
- [ ] A volunteer applicant whose email already exists is handled gracefully (no "No linked account" dead-end).
- [ ] Admin creates a class → it appears immediately in the list (no refresh).
- [ ] Admin adds 2+ sections with different age ranges + capacities to one class; the class header shows summed enrolled/capacity and "N sections".
- [ ] Section capacity meter turns warning at ≥90% and danger/"Full" at 100%.
- [ ] Parent sees the new class + its sections; sections outside the selected camper's age are visible but dimmed and non-registerable.
- [ ] Registering a camper into an eligible section works; a full section routes to waitlist.
- [ ] A class with **zero** sections still renders for both admin and parent (no crash, no disappearing).
- [ ] Volunteer auto-match assigns lead/support **per section** by week; volunteer dashboard shows their assigned section + class name.
- [ ] RLS: a parent can read classes/sections but cannot read another parent's registrations; a volunteer reads only their assigned section's roster.
- [ ] `npm run build` (tsc) passes — types updated everywhere `class_id` / `age_group` / class `capacity` were used.

---

## §8 — Suggested PR sequence (keep them small, per PLAN.md)
1. **`fix/tailwind-theme`** — §1 + §2 ink ramp. Pure styling; unblocks visual review.
2. **`fix/auth-roles`** — §0: `handle_new_user` trigger + signup/apply metadata + remove the parent-hardcoded inserts. Restores volunteer sign-in.
3. **`fix/classes-list-queries`** — §2 + §3. Classes show up again on the *current* schema.
4. **`feat/sections-schema`** — §5.1–5.3 migration + RLS + view (DB only).
5. **`feat/sections-types-hooks`** — §5.4–5.5.
6. **`feat/sections-ui`** — §6 (admin list, editors, parent browse) to match the mockup.
7. **`feat/sections-volunteer-attendance`** — §6.4 + matcher.

PRs 1–3 can ship before 4–7 to immediately fix the two "it's broken" reports (unstyled UI,
volunteers-as-parents) and "classes don't show up." Tag AI-authored PRs `[AI-Authored]` and
update `PLAN.md`'s schema section when §5 lands.
