# Steel City Codes — Design System

> The single source of truth for building the Steel City Codes Registration & Management System.
> Built for **React + Tailwind CSS**. Every value below is a copy-pasteable token.
>
> **Personality:** Warm, playful, and trustworthy for parents & kids — calm, focused, and efficient for volunteers & admins. Bold gold energy, soft pastel support, never sterile.

---

## 0. Quick Start (for Claude Code)

1. Drop the `@theme` / CSS-variable block from **§3.5** into your global stylesheet (`index.css`).
2. Drop the Tailwind config from **§3.6** into `tailwind.config.js`.
3. Load the fonts from **§4.1** in `index.html`.
4. Build with the semantic tokens (`bg-surface`, `text-ink`, `bg-brand`, `text-role-parent`…), **never raw hex**.
5. Use the component recipes in **§7** as the canonical implementation of each UI piece.

**Three golden rules**
- **Gold is for emphasis, not surfaces.** Big gold fills = primary actions, brand moments, highlights. Don't flood screens with it.
- **Pastels are semantic, not decorative confetti.** Each pastel has a *job* (a role, a status, a category). Don't sprinkle them randomly.
- **Black text on gold. Never gold text on white** (fails contrast).

---

## 1. Brand Foundation

**Who we are:** A Denver youth coding program. We register students, recruit & interview volunteers, build classes, and run daily operations (attendance + checkout).

**Who uses the product:**
| Audience | Mindset | Design priority |
|---|---|---|
| **Parents** | Busy, non-technical, protective | Warmth, clarity, zero friction, reassurance |
| **Volunteers** | On their feet, often on mobile | Speed, big tap targets, glanceability |
| **Admins** | Power users, lots of data | Density, control, scannable tables |

**Voice:** Friendly and encouraging, plain-spoken, never jargon-y. "Let's get your camper signed up" not "Initiate enrollment workflow." See **§10**.

---

## 2. Logo & Brand Mark

The wordmark is `{ STEEL CITY CODES } //DENVER` — angular, condensed, with code-syntax flourishes (`{ }` braces, `//` comment slashes). File: `assets/sccdenver.png`.

**Usage**
- **Clear space:** keep padding ≥ the height of the `{` brace on all sides.
- **Min width:** 140px (full lockup). Below that, use just `{SCC}` in Josefin Sans 700.
- **On light backgrounds:** the gold mark is acceptable as a brand flourish, but for headers/nav prefer the mark on a **dark (ink) bar** for punch and contrast.
- **On dark backgrounds:** gold mark shines — this is the hero placement.
- **Don't:** recolor it, add shadows/gradients, stretch, or place gold-on-white as a primary readable element.

**Favicon / app icon:** `{ }` braces enclosing a gold square, or `S` in Josefin Sans Bold, gold on ink.

---

## 3. Color System

### 3.1 Raw Brand Palette (from the brand kit — do not use directly in components)

| Token | Hex | Notes |
|---|---|---|
| `gold` | `#F1C446` | The signature. Primary brand color. |
| `black` | `#000000` | Pure black — reserve for the logo & max-contrast moments. |
| `white` | `#FFFFFF` | Pure white. |
| `peach` | `#F8AE67` | Warm secondary |
| `pale-yellow` | `#FAE1A1` | Soft gold tint |
| `cream` | `#FFF1EA` | Warmest off-white |
| `lavender` | `#DBBFDD` | |
| `sky` | `#CEDDE8` | |
| `butter` | `#FFEBCA` | |
| `apricot` | `#FFCDA4` | |
| `rose` | `#E4A9A8` | |

### 3.2 Warm Neutral Ramp (the workhorse)

We use a **warm-tinted** gray ramp (a hint of the cream/brown family) so the UI feels friendly, not clinical. Defined in oklch for perceptual evenness.

| Token | Light value | oklch | Use |
|---|---|---|---|
| `ink-950` | `#1A1613` | `oklch(0.21 0.012 60)` | Max-contrast headings, dark bars |
| `ink-900` | `#262019` | `oklch(0.27 0.014 60)` | Headings |
| `ink-700` | `#4A4138` | `oklch(0.40 0.018 60)` | Body text |
| `ink-500` | `#7A6E60` | `oklch(0.55 0.020 60)` | Secondary text, captions |
| `ink-400` | `#9C8F7E` | `oklch(0.65 0.020 65)` | Placeholder, disabled text |
| `ink-300` | `#CFC6B8` | `oklch(0.83 0.016 70)` | Borders (strong) |
| `ink-200` | `#E6DFD3` | `oklch(0.90 0.012 75)` | Borders, dividers |
| `ink-100` | `#F2ECE2` | `oklch(0.94 0.009 75)` | Subtle fills, hover |
| `ink-50`  | `#FAF6EF` | `oklch(0.97 0.007 80)` | App background tint |

### 3.3 Functional Accent Pairs

The brand kit gives soft tints only. For usable UI we pair each hue with a **deep, text-safe shade** (for icons, badge text, borders) and keep the soft tint for fills/backgrounds. We also **add a green and a clearer red** the kit lacks, tuned to match the pastel family (same lightness/chroma neighborhood).

| Hue | Soft (fill/bg) | Deep (text/icon/border) | Primary job |
|---|---|---|---|
| **Gold** | `#FAE1A1` | `#8A6D12` | Brand, primary actions, "pending" |
| **Peach** | `#FFCDA4` | `#9A4F1B` | Category accent, energy |
| **Rose** | `#E4A9A8` | `#9A3B3E` (→ red: `#B42318`) | Errors, cancelled, alerts |
| **Lavender** | `#DBBFDD` | `#6B4B72` | Parent role, waitlist |
| **Sky** | `#CEDDE8` | `#2D5E83` | Volunteer role, info |
| **Green** *(added)* | `#C2E6C9` | `#1E7A3E` | Success, confirmed, checked-in |

> Soft + Deep are designed so **Deep text on Soft fill ≥ 4.5:1** for badges. Verify any new pairing.

### 3.4 Semantic Tokens (USE THESE)

These map raw palette → meaning. Components reference *only* these. Light / Dark values both listed.

#### Surfaces & text
| Semantic token | Light | Dark | Meaning |
|---|---|---|---|
| `--bg` | `#FAF6EF` | `#171310` | App background |
| `--surface` | `#FFFFFF` | `#221C16` | Cards, sheets, inputs |
| `--surface-sunken` | `#F2ECE2` | `#100D0A` | Wells, table stripes, code |
| `--surface-raised` | `#FFFFFF` | `#2C251D` | Modals, popovers, dropdowns |
| `--ink` | `#262019` | `#F5EFE4` | Primary text |
| `--ink-muted` | `#7A6E60` | `#B9AD9C` | Secondary text |
| `--ink-faint` | `#9C8F7E` | `#8A7E6E` | Placeholder, disabled |
| `--border` | `#E6DFD3` | `#39302699` | Hairlines, dividers |
| `--border-strong` | `#CFC6B8` | `#4A3F33` | Input borders, emphasis |

#### Brand & interaction
| Semantic token | Light | Dark | Meaning |
|---|---|---|---|
| `--brand` | `#F1C446` | `#F1C446` | Gold — stays gold in both modes |
| `--brand-hover` | `#E7B62C` | `#F6CF5E` | Hover state of gold fills |
| `--brand-soft` | `#FCEFC4` | `#3A2F12` | Gold tint background |
| `--on-brand` | `#1A1613` | `#1A1613` | Text/icons on gold (always dark) |
| `--ring` | `#E7B62C` | `#F1C446` | Focus ring |

#### Status (semantic states)
| Token | Soft (bg) L / D | Deep (text) L / D | Used for |
|---|---|---|---|
| `--success` | `#C2E6C9` / `#16341F` | `#1E7A3E` / `#86E0A0` | Confirmed, checked-in, saved |
| `--warning` | `#FAE1A1` / `#3A2F12` | `#8A6D12` / `#F1C446` | Pending, attention, capacity warn |
| `--danger`  | `#F6D5D2` / `#3A1A1A` | `#B42318` / `#F0A19C` | Cancelled, errors, allergy/medical |
| `--info`    | `#CEDDE8` / `#16293A` | `#2D5E83` / `#9CCBEC` | Waitlist hints, neutral info |

### 3.5 Role Colors (color-coded throughout)

Each account tier owns a hue. Use for role badges, sidebar accents, avatar rings, dashboard headers.

| Role | Soft | Deep | Rationale |
|---|---|---|---|
| **Admin** | `--brand-soft` `#FCEFC4` | `#8A6D12` | Gold = authority / the people who run it |
| **Volunteer** | sky `#CEDDE8` | `#2D5E83` | Calm, dependable, "on duty" blue |
| **Parent** | lavender `#DBBFDD` | `#6B4B72` | Soft, caring, family |

> **Class age-groups** can optionally use a rotating tint set: `peach → sky → lavender → green → butter`. Keep it consistent per group across the app.

### 3.6 CSS Variables (drop into `index.css`)

```css
:root {
  /* surfaces */
  --bg: #FAF6EF;
  --surface: #FFFFFF;
  --surface-sunken: #F2ECE2;
  --surface-raised: #FFFFFF;
  /* text */
  --ink: #262019;
  --ink-muted: #7A6E60;
  --ink-faint: #9C8F7E;
  --border: #E6DFD3;
  --border-strong: #CFC6B8;
  /* brand */
  --brand: #F1C446;
  --brand-hover: #E7B62C;
  --brand-soft: #FCEFC4;
  --on-brand: #1A1613;
  --ring: #E7B62C;
  /* status — soft (bg) */
  --success-soft: #C2E6C9; --success: #1E7A3E;
  --warning-soft: #FAE1A1; --warning: #8A6D12;
  --danger-soft:  #F6D5D2; --danger:  #B42318;
  --info-soft:    #CEDDE8; --info:    #2D5E83;
  /* roles */
  --role-admin-soft: #FCEFC4;     --role-admin: #8A6D12;
  --role-volunteer-soft: #CEDDE8; --role-volunteer: #2D5E83;
  --role-parent-soft: #DBBFDD;    --role-parent: #6B4B72;
  /* radius / shadow / motion (see §5–6) */
  --radius: 0.625rem;            /* 10px — the default */
  --shadow-sm: 0 1px 2px rgba(38,32,25,.06), 0 1px 3px rgba(38,32,25,.05);
  --shadow-md: 0 2px 6px rgba(38,32,25,.07), 0 6px 16px rgba(38,32,25,.06);
  --shadow-lg: 0 8px 28px rgba(38,32,25,.12);
  --ease: cubic-bezier(.2,.7,.3,1);
}

:root.dark, [data-theme="dark"] {
  --bg: #171310;
  --surface: #221C16;
  --surface-sunken: #100D0A;
  --surface-raised: #2C251D;
  --ink: #F5EFE4;
  --ink-muted: #B9AD9C;
  --ink-faint: #8A7E6E;
  --border: rgba(57,48,38,.6);
  --border-strong: #4A3F33;
  --brand: #F1C446;
  --brand-hover: #F6CF5E;
  --brand-soft: #3A2F12;
  --on-brand: #1A1613;
  --ring: #F1C446;
  --success-soft: #16341F; --success: #86E0A0;
  --warning-soft: #3A2F12; --warning: #F1C446;
  --danger-soft:  #3A1A1A; --danger:  #F0A19C;
  --info-soft:    #16293A; --info:    #9CCBEC;
  --role-admin-soft: #3A2F12;     --role-admin: #F1C446;
  --role-volunteer-soft: #16293A; --role-volunteer: #9CCBEC;
  --role-parent-soft: #2E2233;    --role-parent: #D6B6DC;
  --shadow-sm: 0 1px 2px rgba(0,0,0,.4);
  --shadow-md: 0 4px 12px rgba(0,0,0,.45);
  --shadow-lg: 0 12px 32px rgba(0,0,0,.55);
}
```

### 3.7 Tailwind Config (`tailwind.config.js`)

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: { DEFAULT: 'var(--surface)', sunken: 'var(--surface-sunken)', raised: 'var(--surface-raised)' },
        ink: { DEFAULT: 'var(--ink)', muted: 'var(--ink-muted)', faint: 'var(--ink-faint)' },
        border: { DEFAULT: 'var(--border)', strong: 'var(--border-strong)' },
        brand: { DEFAULT: 'var(--brand)', hover: 'var(--brand-hover)', soft: 'var(--brand-soft)', on: 'var(--on-brand)' },
        success: { DEFAULT: 'var(--success)', soft: 'var(--success-soft)' },
        warning: { DEFAULT: 'var(--warning)', soft: 'var(--warning-soft)' },
        danger:  { DEFAULT: 'var(--danger)',  soft: 'var(--danger-soft)' },
        info:    { DEFAULT: 'var(--info)',     soft: 'var(--info-soft)' },
        role: {
          admin: { DEFAULT: 'var(--role-admin)', soft: 'var(--role-admin-soft)' },
          volunteer: { DEFAULT: 'var(--role-volunteer)', soft: 'var(--role-volunteer-soft)' },
          parent: { DEFAULT: 'var(--role-parent)', soft: 'var(--role-parent-soft)' },
        },
      },
      fontFamily: {
        sans: ['"Josefin Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        slab: ['"Josefin Slab"', 'Georgia', 'serif'],
      },
      borderRadius: { DEFAULT: 'var(--radius)', lg: '0.875rem', xl: '1.125rem', '2xl': '1.5rem' },
      boxShadow: { sm: 'var(--shadow-sm)', md: 'var(--shadow-md)', lg: 'var(--shadow-lg)' },
      transitionTimingFunction: { brand: 'var(--ease)' },
      ringColor: { brand: 'var(--ring)' },
    },
  },
  plugins: [],
}
```

### 3.8 Contrast & accessibility rules
- Body text uses `--ink` on `--surface`/`--bg` → ≥ 7:1 (AAA).
- `--ink-muted` is for secondary text only, ≥ 4.5:1.
- **Never** put `--ink-faint` text on `--brand`. On gold, always use `--on-brand`.
- Status/role **badge text** uses the *Deep* shade on the *Soft* fill — verified ≥ 4.5:1.
- Don't communicate state with color alone — always pair with an icon or label (see §7.5).

---

## 4. Typography

### 4.1 Fonts

**Josefin Sans** — geometric, friendly, slightly retro. The whole UI: headings, body, buttons, labels.
**Josefin Slab** — its slab-serif sibling. Subheadings, eyebrows, pull quotes, and warm editorial moments on public/parent pages. **Not** for dense UI or tables.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Josefin+Sans:ital,wght@0,300..700;1,400&family=Josefin+Slab:wght@300..600&display=swap" rel="stylesheet">
```

> **Note:** Josefin runs *small* and *wide*. Bump sizes ~1 step vs. a typical UI font, and use weight 500–600 (not 400) for body so it doesn't feel thin. Tighten letter-spacing on large headings (`-0.01em`); add positive tracking to all-caps eyebrows (`+0.12em`).

### 4.2 Type Scale

| Token | Size / line-height | Weight | Font | Use |
|---|---|---|---|---|
| `display` | 56 / 60 | 700 | Sans | Hero on landing/login |
| `h1` | 40 / 46 | 700 | Sans | Page title |
| `h2` | 30 / 38 | 600 | Sans | Section heading |
| `h3` | 23 / 30 | 600 | Sans | Card title, subsection |
| `h4` | 19 / 26 | 600 | Sans | Group label, list header |
| `subhead` | 20 / 28 | 500 | **Slab** | Warm subheading under an h1/h2 |
| `body-lg` | 18 / 28 | 500 | Sans | Lead paragraphs, parent-facing copy |
| `body` | 16 / 25 | 500 | Sans | Default body |
| `body-sm` | 14 / 21 | 500 | Sans | Dense tables, secondary |
| `label` | 14 / 18 | 600 | Sans | Form labels, buttons |
| `caption` | 12.5 / 16 | 500 | Sans | Meta, timestamps, helper |
| `eyebrow` | 12 / 14, `+0.12em`, UPPERCASE | 600 | Sans | Section kickers, role tags |
| `mono` | 14 / 20 | — | `ui-monospace` | IDs, codes, medical fields |

Tailwind: define matching classes or use arbitrary values, e.g. `text-[40px] leading-[46px] font-bold tracking-[-0.01em]`.

### 4.3 Rules
- One `h1` per screen. Don't skip levels.
- `--ink` for headings, `--ink` or `--ink-muted` for body. Captions `--ink-muted`.
- Max line length 70ch for reading copy. Tables/forms can be wider.
- Numbers in tables: `font-variant-numeric: tabular-nums`.

---

## 5. Spacing, Layout & Shape

### 5.1 Spacing scale (4px base)
`0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96` (px) → Tailwind `0,0.5,1,2,3,4,5,6,8,10,12,16,20,24`.

**Default rhythm:** 4px micro, 8–12px intra-component, 16–24px between elements, 32–48px between sections, 64px+ page gutters.

### 5.2 Layout
- **Page max-width:** content `1200px`; reading/forms `640px`; centered with `--bg`.
- **App shell:** fixed left sidebar `260px` (collapses to `72px` icon-rail, then off-canvas drawer on mobile) + top bar `64px`.
- **Grid:** 12-col, 24px gutter desktop / 16px mobile.
- **Breakpoints:** `sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536`. **Mobile-first** — volunteers live on phones.
- **Density:** *Comfortable* is default (see §7). Tables offer a *Compact* row variant for admin rosters.

### 5.3 Radius (subtle rounding — softens the angular logo)
| Token | px | Use |
|---|---|---|
| `radius-sm` | 6 | Badges, chips, inputs-inline |
| `radius` (default) | 10 | Buttons, inputs, cards |
| `radius-lg` | 14 | Modals, large cards |
| `radius-xl` | 18 | Hero panels, sheets |
| `radius-full` | 9999 | Avatars, pills, toggles |

> Keep it consistent: a button and the input next to it share `radius`. Never mix sharp + very round in one cluster.

### 5.4 Borders & elevation
- Default border: `1px solid --border`. Inputs & emphasis: `--border-strong`.
- **Elevation is mostly borders + soft shadows, not heavy drop shadows** (keeps it clean & warm):
  - `shadow-sm` — resting cards, table container
  - `shadow-md` — dropdowns, popovers, hover-lift on interactive cards
  - `shadow-lg` — modals, toasts
- Don't stack shadow + strong border on the same element; pick one as the primary edge.

---

## 6. Motion

Fluid and clean — motion confirms actions, it never shows off.

| Token | Duration | Easing | Use |
|---|---|---|---|
| `fast` | 120ms | `--ease` | Hover, color, small toggles |
| `base` | 200ms | `--ease` | Buttons, dropdowns, tabs |
| `slow` | 320ms | `--ease` | Modals, drawers, page sections |

- `--ease: cubic-bezier(.2,.7,.3,1)` (gentle overshoot-free ease-out).
- Hover lift: `translateY(-1px)` + shadow step. Press: `translateY(0) scale(.99)`.
- Entrances: fade + 8px rise. Toasts: slide-in from edge.
- **Honor `prefers-reduced-motion`** — drop transforms, keep opacity.
- No infinite looping/spinning decoration. Loading spinners only while actually loading.

---

## 7. Components

> Each recipe lists anatomy, variants, states, and a Tailwind sketch. These are canonical — build them as reusable React components.

### 7.1 Buttons
**Sizes:** `sm` (h-9, text-sm, px-3) · `md` (h-11, text-[15px], px-4) · `lg` (h-12, text-base, px-5). All `rounded-[10px] font-semibold` (Josefin Sans 600).

| Variant | Look | Use |
|---|---|---|
| **Primary** | `bg-brand text-brand-on hover:bg-brand-hover shadow-sm` | The one main action per view |
| **Secondary** | `bg-surface text-ink border border-border-strong hover:bg-surface-sunken` | Secondary actions |
| **Ghost** | `text-ink hover:bg-surface-sunken` | Tertiary, toolbar |
| **Danger** | `bg-danger text-white hover:brightness-95` | Destructive (cancel registration, delete) |
| **Soft** | `bg-brand-soft text-[color:var(--warning)]` | Quiet emphasis |

States: hover (lift -1px), active (scale .99), focus (`ring-2 ring-brand ring-offset-2 ring-offset-bg`), disabled (`opacity-50 cursor-not-allowed`), loading (spinner + label, keep width).
Icon buttons: square, `rounded-[10px]`, 20px Lucide icon, min 40×40 tap target (44 on mobile).

### 7.2 Forms & Inputs
The product is registration-heavy — forms must feel effortless.
- **Field:** label (`label` token, `--ink`) → input → helper/error (`caption`).
- **Input:** `h-11 px-3.5 rounded-[10px] bg-surface border border-border-strong text-ink placeholder:text-ink-faint`. Focus: `border-transparent ring-2 ring-brand`.
- **Error:** `border-danger` + helper text in `--danger` + leading alert icon. Never color-only.
- **Select/Combobox:** match input; chevron icon; custom popover uses `surface-raised` + `shadow-md`.
- **Checkbox/Radio:** 20px, `radius-sm`/full, checked = `bg-brand` with `--on-brand` check. Big enough for kids' parents on mobile.
- **Toggle:** pill track, 44×24, knob slides, on = `bg-brand`.
- **Required:** `*` in `--danger` after label. **Optional:** "(optional)" in `--ink-muted`.
- **Medical/allergy fields:** flag with a `--danger`-soft container + heart/alert icon so volunteers spot them instantly. Treat as sensitive — see §9.
- **Multi-step registration:** use a stepper (§7.11). Autosave drafts. Inline validation on blur, not on every keystroke.

### 7.3 Cards
`bg-surface border border-border rounded-[14px] shadow-sm p-5/6`. Interactive cards: `hover:shadow-md hover:-translate-y-px transition`.
- **Stat card:** eyebrow label + big number (`h1`, tabular-nums) + delta/caption + optional Lucide icon in a tinted `rounded-full` chip.
- **Class card:** name (h3) + age-group tag + capacity meter (§7.9) + lead/support avatars + status.
- **Student/roster card (mobile):** avatar + name + age + status badge + medical flag.

### 7.4 Tables / Rosters (admin & volunteer)
The data backbone. Container: `bg-surface border border-border rounded-[14px] overflow-hidden shadow-sm`.
- **Header row:** `bg-surface-sunken`, `eyebrow`-style labels, `--ink-muted`, sticky on scroll.
- **Rows:** `h-14` comfortable / `h-11` compact. Divider `border-border`. Hover `bg-surface-sunken/60`. Zebra optional in compact.
- **Cells:** `body-sm`, tabular-nums for numbers, `px-4`.
- First column often an avatar + name; last column a row-action menu (kebab → `surface-raised` popover).
- **Selectable rows:** leading checkbox + a sticky bulk-action bar (for moving students/volunteers between classes).
- **Sort:** clickable header with chevron. **Filter/search:** toolbar above table.
- **Empty state** inside the table area (§7.10). **Loading:** skeleton rows, not a spinner.
- Mobile: tables collapse to the roster cards in §7.3.

### 7.5 Badges, Pills & Status
`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold`. **Always Deep text on Soft fill + a 14px icon or dot.**

| State | Token | Icon |
|---|---|---|
| Confirmed / Checked-in | `success` | check-circle |
| Pending | `warning` | clock |
| Waitlisted | `info` | list |
| Cancelled / Error | `danger` | x-circle |
| Checked-out | `ink-muted` on `surface-sunken` | log-out |

**Role badge:** `role-{tier}-soft` bg + `role-{tier}` text + dot. **Experience:** Senior = solid gold dot, Junior = outline dot.

### 7.6 Navigation / App Shell
- **Top bar (64px):** logo on an ink/dark bar (left) · page title or breadcrumb · search · theme toggle · notifications · avatar menu (right).
- **Sidebar (260px):** grouped nav items (icon + label), active item = `bg-brand-soft text-ink` with a 3px gold left indicator. Role-aware: each tier sees only its sections. Footer of sidebar shows current user + role badge.
- **Mobile:** top bar + hamburger → off-canvas drawer; or a bottom tab bar for volunteers (Attendance / Classes / Roles / Me) with 44px targets.
- **Breadcrumbs:** `body-sm`, `--ink-muted`, `/` separators echoing the logo's `//`.

### 7.7 Modals & Sheets
Center modal `max-w-lg bg-surface-raised rounded-[18px] shadow-lg p-6`, scrim `rgba(26,22,19,.5)` + slight blur. Title (h3) + close (X icon button) + body + right-aligned action row (Secondary + Primary). Slide+fade in (`slow`). Mobile: bottom sheet with grab handle. **Destructive confirms** use a danger-tinted icon and a Danger primary button.

### 7.8 Toasts / Feedback
Bottom-right stack, `surface-raised`, `shadow-lg`, `rounded-[12px]`, leading status icon, auto-dismiss 4s (errors persist). Success = green tint left border; error = danger. Use for "Camper registered ✓", "Attendance saved", "Volunteer assigned".

### 7.9 Capacity / Progress Meter
For class fill (`registrations / capacity`). Track `bg-surface-sunken rounded-full h-2`, fill `bg-brand`. **At ≥90% → fill `--warning`; full → `--danger`** + "Full" badge → new registrations auto-route to waitlist (per §schema). Show `12 / 20` in caption with tabular-nums.

### 7.10 Empty States
Centered: a soft Lucide icon in a `rounded-full bg-brand-soft` chip + short friendly headline (Slab subhead) + one-line guidance + primary CTA. e.g. "No campers yet — Add your first student to get started."

### 7.11 Stepper (multi-step flows)
Registration & interview scheduling. Horizontal on desktop, vertical on mobile. Steps: complete = gold filled circle w/ check, current = gold ring, upcoming = `border-strong` outline. Connecting line `--border`, fills gold as you progress.

### 7.12 Avatars
`rounded-full`, initials on a tint derived from the person's role (role-soft bg, role text). Sizes 24/32/40/56. Stacked avatars for class lead+support with `-ml-2 ring-2 ring-surface`. Senior volunteers get a small gold ring.

### 7.13 Attendance Control (the daily driver)
The most-used volunteer screen — optimize ruthlessly for speed on mobile.
- Big roster list; each student row has a large **Check-in / Check-out** segmented toggle (44px+).
- Tap = instant optimistic update + toast + timestamp; state colors: in = `success`, out = `ink-muted`.
- Sticky header: class name, date, present/total count, "Mark all present".
- Medical-flag students show a `--danger` heart icon — tap reveals info.

---

## 8. Iconography
- **Library:** [Lucide](https://lucide.dev) (`lucide-react`). Clean, friendly line icons that suit Josefin.
- **Size:** 16 (inline), 20 (buttons/inputs), 24 (nav). **Stroke:** 2 (1.75 at large sizes).
- Match text color (`currentColor`) unless semantic.
- **Anchor set:** `graduation-cap` (students), `hand-heart`/`users` (volunteers), `shield-check` (admin), `calendar-check` (attendance), `log-out` (checkout), `clipboard-list` (registration), `layout-grid` (classes), `heart-pulse` (medical), `bell`, `settings`, `sun`/`moon` (theme).
- Never use emoji as UI icons. No multicolor/3D icon packs.

---

## 9. Privacy, Safety & Sensitive Data
This app holds **children's data** — treat it as the highest-trust context.
- **Medical/allergy info:** visually flagged (danger-soft container + icon), shown only to that child's parent, assigned-class volunteers, and admins (mirrors the RLS policies in `schema.sql`). Never in list previews — behind a tap/expand.
- Don't display full student data in screenshots, toasts, or analytics.
- Always show *who can see this* affordances on sensitive forms.
- Confirmations for anything destructive or that moves a child between classes.

---

## 10. Voice & Content
- **Warm, plain, encouraging.** Short sentences. Address parents as "you," kids as "your camper/student."
- **Buttons = verbs:** "Register camper", "Save attendance", "Assign volunteer". Not "Submit".
- **Errors are kind & actionable:** "That class is full — want to join the waitlist?" not "Error 409."
- **Empty states invite action.** **Success is celebrated** lightly ("You're all set! 🎉" sparingly — emoji only in friendly confirmations, never in nav/labels).
- Sentence case everywhere except the `eyebrow`/all-caps kickers and the logo.
- Numbers & dates: friendly formats — "Week 1 · Mon–Fri", "Jun 4, 2026", "9:02 AM".

---

## 11. Do / Don't (cheat sheet)
✅ Gold for the single primary action, brand bars, highlights.
✅ Pastels with meaning — role, status, category.
✅ Warm neutrals for 90% of surfaces & text.
✅ Big tap targets & mobile-first for volunteer/parent flows.
✅ Icon **and** label for every status.

❌ Gold backgrounds everywhere / gold text on white.
❌ Random pastel decoration with no meaning.
❌ Pure `#000` body text (use `--ink`) or cold gray neutrals.
❌ Tiny Josefin at weight 300 for body (looks thin — use 500+).
❌ Heavy drop shadows, gradients, or emoji in the UI chrome.
❌ Showing medical info in lists or to unauthorized roles.

---

*Pair this doc with `Style Guide.html` for a live, interactive reference of every token and component above.*
