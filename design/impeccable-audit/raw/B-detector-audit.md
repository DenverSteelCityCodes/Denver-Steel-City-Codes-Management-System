# Assessment B: detector + browser evidence, and `/impeccable audit`

Steel City Codes // Denver, whole site. Run 2026-10-17 against the worktree at `47160cf` (latest `main`) and the live demo https://scc.haanie.com. Isolated from Assessment A: nothing else under `raw/` was read.

**Method, in short:** the CLI source scan, CLI URL scans of the four public pages at two sizes, then impeccable's own browser detector injected into every signed-in page through headless Playwright (25 routes × 390px and 1440px, plus a dark-mode pass at 390px). On top of that: the CLI run over the saved rendered HTML, axe-core (WCAG 2.0/2.1/2.2 A+AA plus best-practice) in light and dark, reflow checks at 320/375px and 200% text, a production build, eslint, and greps of the source. Every finding below was checked against the source line or a screenshot.

---

## (a) Detector summary

### What ran, and what worked

| Pass | Command / mechanism | Result |
|---|---|---|
| Source scan | `impeccable detect --json src/` (CLI 4.6.0, from the worktree root; no `.impeccable/config.json`, no inline ignores, `--no-config` gives the same result) | **Worked.** 124 TS/TSX/CSS files scanned, **1 finding**. `raw/detector-src.json` |
| URL scans, public pages | `impeccable detect --json <url>` and `--viewport 390x844`, for `/login`, `/signup`, `/forgot`, `/apply` | **Worked.** 8 scans, **1 finding each** (8 in all). `raw/detector-url-<page>.<desktop|390>.json` |
| Rendered scan, all routes (signed in) | Playwright logs in with the demo buttons ("Camp admin", "Parent", "Volunteer", "Volunteer applicant"), then on each route injects the detector's browser bundle (`src-impeccable/.../crates/live/assets/detect-antipatterns-browser.js`; the npm package ships only a native binary with no browser script, so the bundle comes from the skill source tree) with `addScriptTag` in a `bypassCSP` context, `__IMPECCABLE_CONFIG__ = {autoScan:false}`, then calls `window.impeccableDetectAsync()` | **Worked on 50 of 50** (25 routes × 390 and 1440). No `__impeccableCoreError` and no timeouts. Each result also holds DOM metrics (tap targets, input font size, headings, overflow, labels). `raw/B-rendered/browser/<role-route>.<m|d>.json` |
| Rendered HTML → CLI | The same run saved each page's DOM with every stylesheet inlined and scripts removed (`raw/B-rendered/rendered/*.html`, 50 files), then ran `impeccable detect --json raw/B-rendered/rendered/` | **Worked**, with a caveat: this is the CLI's *static* HTML engine, which has no layout, so it misfires on `cramped-padding` (see false positives). `raw/detector-rendered-html.json` (348 findings) |
| Dark-mode rendered scan | Same injection at 390px with `localStorage['scc-theme']='dark'` set before load, 25 routes | **Worked on 25 of 25.** `raw/B-axe-dark/axe-and-dark.json` (field `detector`), plus a full-page dark screenshot per route in `raw/B-axe-dark/*.dark.png` |
| axe-core 4.x (light + dark, 390px) | Installed into the scratchpad Playwright folder (the project's `axe-core` devDependency isn't present in the symlinked `node_modules`) | **Worked on 50 of 50.** `raw/B-axe-dark/axe-and-dark.json` |
| Live-server overlay / `[Human]` tab | n/a | **Not used.** This is a headless sub-agent with no visible browser to show anyone, so the overlay was injected straight into the page and results were read with `impeccableDetectAsync()`. No live server was started, so there is nothing to stop. Nothing was written to the project's HTML. |

Read-only rules were kept: the only clicks were on the demo-login buttons. No form was submitted, nothing was saved, claimed or posted, and roll call wasn't touched.

### Counts by rule

| Rule | Source scan | URL scans (8) | In-page rendered, light (50) | In-page, dark (25) | Static CLI on rendered HTML (50) | Verdict |
|---|---|---|---|---|---|---|
| `side-tab` | 1 | 0 | 0 | 0 | 0 | **True positive** |
| `cream-palette` | 0 | 8 | 50 | 4 (public pages only) | 50 | True detection of the pattern. **Not a defect**: it's the documented app background (`--bg #FAF6EF`, design_system.md §ink-50). A design-judgment call for A / the director. |
| `low-contrast` | 0 | 0 | 24 | 0 | 44 | **True positive** (2 distinct causes, below). The static engine's 22 extra hits are the same search box at 390px, where it's hidden in the drawer, so those extras are moot. |
| `skipped-heading` | 0 | 0 | 2 | 1 | 2 | **True positive** (1 cause) |
| `first-viewport-column-overflow` | 0 | 0 | 1 | 0 | 0 | **True positive** (verified in screenshot) |
| `cramped-padding` | 0 | 0 | 0 | 0 | 248 | **False positive** (static-engine artefact) |
| `em-dash-overuse` (advisory) | 0 | 0 | 0 | 0 | 4 | **False positive** for prose. The dashes are empty-cell placeholders (see P3-19). |

**Distinct verified issues the detector found: 6** (1 side-tab, 2 low-contrast causes, 1 heading skip, 1 column overflow, plus cream as a design flag). 252 hits were false positives (248 cramped-padding + 4 em-dash).

### Each finding, verified in context

1. **side-tab**, `src/pages/ClassBrowser.tsx:393`. The `/parent/classes` toast is `rounded-xl shadow-lg … border-l-4 border-success|border-info`. **Verified TP.** It's the only toast in the app, it uses a coloured left stripe on a rounded card, and it sits at `fixed bottom-6` with no safe-area inset.
2. **cream-palette**, `body` on every page (rgb 250,246,239). **Verified, intentional.** Token `--bg` in `src/index.css:8`. In dark mode the 21 signed-in routes pass; the 4 public routes still report cream in "dark" because the theme is never applied there (see P2-7).
3. **low-contrast, admin search**, `src/components/AdminSearch.tsx:118` placeholder `text-white/40` on `bg-white/10` over ink: **3.5:1**. `:120` ⌘K `kbd` `text-white/50` on `bg-white/10`: **3.9:1**. Found on all 11 admin routes at 1440px. **Verified TP.**
4. **low-contrast, duty type field**, `src/pages/AdminDuties.tsx:142` "New duty type…" placeholder is the browser default `#93908c` on white, **3.2:1**. The input's `className` leaves out the `placeholder:text-ink-faint` that the other fields have, and its only visible label is that placeholder (the `<label>` is `sr-only`, :140). **Verified TP.**
5. **skipped-heading**, `/admin/attendance`: `<h1>Attendance` (`AdminAttendance.tsx:168`) then `<h3>End-of-week export` (`src/components/AttendanceExport.tsx:119`). **Verified TP.** axe reports the same thing (`heading-order`).
6. **first-viewport-column-overflow**, `/admin/duties` at 1440: `div.grid.grid-cols-1.lg:grid-cols-3` (`AdminDuties.tsx:103`). The slots column runs 339% of the viewport tall next to a 33% "Duty types" column. **Verified TP** in `before/admin-admin_duties.d.png`: about 3,000px of slot rows (10 days × 4 duties) next to a 4-row list. That's a long scrolling page, which goes against PRODUCT.md.
7. **cramped-padding** ×248 (static engine only), e.g. `listCls = 'bg-surface border … overflow-hidden'` in `pages/volunteer/parts.tsx:13`, admin card shells, `<dl>` on `/volunteer/profile`. **False positive.** The rows inside carry their own `px-4/px-5` padding. The layout-aware in-page engine flagged none of the 50 pages, and the screenshots show inset content.
8. **em-dash-overuse** (advisory) on `/admin/students` (62) and `/admin/volunteers` (10). **False positive** for prose. They're "—" placeholders in empty table cells (`before/admin-admin_students.txt`). There is a related screen-reader point in P3-19.

---

## (b) Audit report

### Audit Health Score

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | 3 | In the light theme, focus rings and input borders measure 1.65–1.89:1. Every text/background token pair passes AA. |
| 2 | Performance | 2 | One 904 KB JS chunk (234 KB gz) with no route splitting, so parents on phones download every admin page. |
| 3 | Theming | 3 | Every colour is a token (0 raw hex in components), but dark mode never reaches signed-out pages, flashes light on load, and leaves native controls light. |
| 4 | Responsive Design | 2 | The parent flow, where the rush happens, has 14px inputs (iOS zoom) and 24–34px tap targets. Volunteer screens already meet 44px. |
| 5 | Implementation Integrity | 3 | Tokens are coherent and the detector is nearly clean (1 source finding). Below them sits drift: 15 hand-copied input styles and 38 copies of the primary-button style. |
| **Total** | | **13/20** | **Acceptable (significant work needed)** |

### Implementation Integrity Verdict

**Pass, with drift at the component layer.** The source scan found **one** slop pattern in 124 files (the side-stripe toast). Colour runs entirely through a token layer (`src/index.css:7-60`, mapped into Tailwind with `@theme inline`), and the light theme's text pairs were raised to AA on purpose (the comments cite L6a). There are no raw hex values in components; the only hits are issue numbers like `#143` and print-only `#000/#fff` in `PrintRoster.tsx`. The ink bar, gold wordmark and warm ramp are applied the same way across all three role shells.

The drift sits below the tokens. There's no shared `Input`, `Button` or `Field` component. 15 files each define their own input class string, with heights split h-10 ×4, h-11 ×11, h-12 ×1, and text size split `text-sm` ×13 against `text-base` ×2. Only `VolunteerSelfService.tsx:16` and `pages/volunteer/parts.tsx:18` follow the 16px-input rule, so the rule lives in two copies instead of one primitive. The three layouts each carry their own theme toggle and header buttons, sized differently (Parent/Admin 34px, Volunteer 44px). The radius token `--radius: 0.625rem` exists, yet `rounded-[10px]` is hand-written 173 times, alongside five other arbitrary radii. Text comes in about 20 sizes, including 12.5, 13, 13.5, 15 and 16.5px. These are the root cause of the two P1 responsive findings.

### Executive Summary

- Audit Health Score: **13/20 (Acceptable)**
- Issues: **P0 0 · P1 3 · P2 11 · P3 6**
- Top issues:
  1. **[P1]** Signup, login, apply, parent registration, class browsing and the parent edit forms use **14px inputs**, so iOS Safari zooms on every field during the February rush.
  2. **[P1]** In the light theme, the **focus ring and field borders fail 3:1**. The ring is gold `#F1C446` on white at 1.65:1, and 11 inputs also drop their border on focus (`focus:border-transparent`).
  3. **[P1]** **Parent touch targets are under 44px**: header theme/bell buttons 34×34; "Request a change", "Leave the waitlist" and "Medical" 24px tall; ethnicity chips 30px; "Back to dashboard" 20px.
  4. **[P2]** **One 904 KB bundle** with no code splitting.
  5. **[P2]** **Dark mode stops at the role shells.** Login/signup/forgot/apply stay light, there's a light flash before mount, and with no `color-scheme` the date-picker icon renders black on dark.
- Next steps: build shared form and touch primitives (fixes 1–3 together), split the bundle by role, move theme setup into `index.html`/`main.tsx`, then fix the cluster of headings and ARIA issues.

### Detailed Findings by Severity

#### P1: Major

**[P1-1] Form inputs at 14px on the phone flows (iOS Safari zooms on focus)**
- **Location:** measured at 390px: `/signup` 3 inputs, `/login` 2, `/apply` 9, `/parent/register` 8, `/parent/classes` 2 (camper select and search). Source: `SignupPage.tsx:118,134,151`, `LoginPage.tsx:116,137`, `VolunteerApplyPage.tsx:393,395`, `ParentRegistrationPage.tsx:560,569`, `ClassBrowser.tsx:235`, `ConfirmOnboardingPanel.tsx:96` (yearly re-confirm), `ContactDetailsCard.tsx:49`, `StudentCard.tsx:342` (parent edit forms). The admin forms (`/admin/users` 76 fields, `/admin/forms` 20) do the same, but admins work on laptops.
- **Category:** Responsive
- **Impact:** On iPhone, every tap into a field zooms the page and leaves it zoomed, sideways-scrolled, in the 5-step wizard that most families open within the first 15 minutes. PRODUCT.md names 16px inputs as a standing instruction.
- **WCAG/Standard:** Project standard (PRODUCT.md "16px inputs"); iOS Safari behaviour.
- **Recommendation:** A single shared `Input`/`Select`/`Textarea` class at `text-base` (16px), keeping `sm:text-sm` only for admin-density screens. Delete the 15 local copies.
- **Suggested command:** `/impeccable adapt`

**[P1-2] Focus indicator and field boundaries fail non-text contrast in the light theme**
- **Location:** `focus:ring-2 focus:ring-brand` (45 uses) together with `focus:border-transparent` (11 inputs, e.g. `LoginPage.tsx:116`, `ParentRegistrationPage.tsx:560`, `VolunteerApplyPage.tsx:393`). Field border `--border-strong #CFC6B8` (`index.css:18`). Measured: gold ring on white **1.65:1**, on cream **1.53:1**; `--ring #E7B62C` on white 1.89:1; field border on white **1.69:1** in light and **1.65:1** in dark (`#4A3F33` on `#221C16`). The form-editor switch (`AdminFormEditor.tsx:16`) is off-state `#CFC6B8` on white at 1.69:1.
- **Category:** Accessibility
- **Impact:** Keyboard users and low-vision parents can't reliably see which field is active or where a field's edges are. On the 11 inputs that drop their border on focus, a pale yellow ring is the *only* boundary left. Dark mode's ring is fine (10.2:1).
- **WCAG/Standard:** 1.4.11 Non-text Contrast (AA), 2.4.7 Focus Visible (AA).
- **Recommendation:** Keep the border on focus and darken it (`focus:border-ink`). Draw the ring as an ink ring plus a gold halo (for example `focus-visible:ring-2 ring-ink ring-offset-2 ring-offset-brand`), or use a light-theme `--ring` ≥3:1. Raise `--border-strong` to ≥3:1 against `--surface` in both themes (light about `#948776`).
- **Suggested command:** `/impeccable harden`

**[P1-3] Parent screens' tap targets below 44px (the volunteer shell already meets it)**
- **Location:** measured at 390px on `/parent`: theme toggle and bell **34×34** (`ParentLayout.tsx:77`, `ParentBell.tsx:116`, both `p-2`); account button 46×40; "Medical" 76×24, "Request a change" 99×24, "Leave the waitlist" 98×24 (StudentCard text buttons); "Edit camper" 123×40; "Register for another class" 216×40; contact "Edit" 71×36; footer `denver@steelcitycodes.org` link 15px tall. On `/parent/register`: the eight ethnicity chips are **30px** tall (`ParentRegistrationPage.tsx:736`, `px-3 py-1.5 text-xs`), and "Back to dashboard" is **20px** tall (`ClassBrowser.tsx:217`, same in the wizard). The admin header is also 34px (`AdminLayout.tsx:133,147`). On `/volunteer/classes`, the roster's "Medical" buttons are 76×24. For comparison, `VolunteerLayout.tsx:84,90` use `w-11 h-11` / `h-11`, and four volunteer routes measured **0** targets under 44px.
- **Category:** Responsive
- **Impact:** Parents on phones mis-tap waitlist and change actions, which are among the few things they come back for. "Leave the waitlist" is a 24px text link sitting near other actions. The "Medical" toggle on the volunteer roster is safety information that a volunteer taps while standing.
- **WCAG/Standard:** Project standard 44px (PRODUCT.md). WCAG 2.5.8 Target Size (AA, 24px) is met exactly at the 24px items, so this is the project bar, not a WCAG fail. 2.5.5 (AAA, 44px) fails.
- **Recommendation:** Copy the volunteer shell's `w-11 h-11` header buttons into the Parent and Admin layouts. Give text-button actions `min-h-11 inline-flex items-center` (already defined as `linkCls` in `pages/volunteer/parts.tsx:16`) and chips `min-h-11`.
- **Suggested command:** `/impeccable adapt`

#### P2: Minor

**[P2-4] One 904 KB JavaScript chunk, no route-level code splitting**
- **Location:** `src/App.tsx:1-34` imports all 30 pages eagerly. `vite build` output: `index-*.js 904.40 kB │ gzip 233.76 kB`, `index-*.css 58 kB │ gzip 10.8 kB`, and Vite's own ">500 kB chunk" warning.
- **Category:** Performance
- **Impact:** A parent on a phone at opening time parses every admin page (form editor, matcher, attendance export) before the wizard can run. The cost is roughly 3× the JS a parent needs, on the network and the CPU, at the moment that matters most.
- **Recommendation:** Use `React.lazy` per role section (admin/*, volunteer/*, parent/*, apply) behind a `Suspense` fallback that has text. Keep auth pages in the entry chunk.
- **Suggested command:** `/impeccable optimize`

**[P2-5] Missing `<h1>` on two parent pages, a heading skip in admin, h2 before h1 on login**
- **Location:** `/parent/classes`: headings start at `<h2>` class names (`ClassBrowser.tsx:328`), no page title. `/parent/register` form state: the first heading is `<h2>Student information` (`ParentRegistrationPage.tsx:677`); the h1 only exists in the closed/done states (:585, :609, :630). `/admin/attendance` h1→h3 (`AttendanceExport.tsx:119`). `/login`: `<h2>Try the demo` comes before `<h1>Welcome back` in DOM order. axe: `page-has-heading-one` ×2, `heading-order` ×1. The detector caught `skipped-heading`.
- **Category:** Accessibility
- **Impact:** Screen-reader users who move by heading land on parent pages with no page title, and the wizard step isn't announced as a heading. Programmatic focus goes to the "Step 1 of 5" `<p>` instead (:664).
- **WCAG/Standard:** 1.3.1 Info and Relationships, 2.4.6 Headings and Labels (AA).
- **Recommendation:** Add a visible or `sr-only` h1 per page ("Browse classes", "Register a camper"), make the step label the h1 or put it inside one, make AttendanceExport's heading an h2, and put the login form's h1 first in DOM order.
- **Suggested command:** `/impeccable harden`

**[P2-6] Admin Volunteers tabs have no tablist, and the roster table can't be scrolled by keyboard**
- **Location:** `AdminVolunteers.tsx:485` `role="tab"` buttons with no `role="tablist"` parent (axe `aria-required-parent`, critical, 2 nodes). `:576` `<div className="overflow-x-auto">` isn't focusable (axe `scrollable-region-focusable`).
- **Category:** Accessibility
- **Impact:** Assistive technology announces orphan tabs with no group or position. Keyboard users can't scroll the wide table horizontally.
- **WCAG/Standard:** 4.1.2 Name, Role, Value (A), 2.1.1 Keyboard (A).
- **Recommendation:** Wrap the tabs in `role="tablist"` with `aria-controls`/`tabpanel`, as `RollCallPanel.tsx:77` already does, or use plain buttons with `aria-pressed`. Add `tabIndex={0}`, `role="region"` and an `aria-label` to the scroll container.
- **Suggested command:** `/impeccable harden`

**[P2-7] Dark mode doesn't reach signed-out pages, flashes light on load, and leaves native controls light**
- **Location:** The theme class is toggled only inside `ParentLayout.tsx:15-32`, `VolunteerLayout.tsx:32-44` and `AdminLayout.tsx:35-73`, in a `useEffect` after mount. `index.html` and `main.tsx` set nothing, and no `prefers-color-scheme` is read anywhere. With `scc-theme=dark`, `/login`, `/signup`, `/forgot` and `/apply` measured `html.dark = false` (axe-and-dark.json). `color-scheme` computes to `normal`, so the native date picker's calendar icon on `/admin/duties` renders black on the dark field (`raw/B-axe-dark/admin-duties-date-dark.png`), and pickers, scrollbars and select popups stay light. The theme logic is copied three times with different error handling: Admin wraps `localStorage` in try/catch, Parent and Volunteer don't. Dark header `#1A1613` against dark `--bg #171310` is 1.03:1, so the bar has no edge.
- **Category:** Theming
- **Impact:** A volunteer or parent who picks dark gets a cream login screen and a light flash on every reload, plus near-invisible native control icons. PRODUCT.md asks for checks "at 375px in light and dark".
- **Recommendation:** Read `scc-theme` in a small inline script in `index.html` (before paint) and set `.dark` and `color-scheme` on `<html>`. Add `:root{color-scheme:light} :root.dark{color-scheme:dark}` to `index.css`. Move the toggle into one `useTheme` hook. Give the dark header a 1px `--border-strong` bottom edge.
- **Suggested command:** `/impeccable colorize`

**[P2-8] Gold used as text and loading signal on light surfaces**
- **Location:** `AdminVolunteers.tsx:707` applicant initials `text-brand` on `bg-brand-soft`: **1.44:1**. Full-page loaders `ProtectedRoute.tsx:16`, `MfaGate.tsx:32` and `VolunteerApplyPage.tsx:330` are gold rings on cream at 1.53:1, with no text and no `role="status"`. `VolunteerApplyPage.tsx:341` gold icon on brand-soft (decorative).
- **Category:** Accessibility / Theming
- **Impact:** The initials can't be read. It also breaks the brand rule "gold never as text on white", which the rest of the codebase keeps (only 3 `text-brand` uses; RollCallPanel's gold on ink is fine at 10.9:1). Screen readers hear nothing on the loaders.
- **WCAG/Standard:** 1.4.3 Contrast (AA), 4.1.3 Status Messages (AA); brand commitment.
- **Recommendation:** Initials in `text-role-admin` (`#715709`, 5.3:1 on brand-soft) or ink. Loaders become `role="status"` with visible or `sr-only` "Loading…" and an ink or `--ink-muted` ring.
- **Suggested command:** `/impeccable colorize`

**[P2-9] The global reduced-motion kill freezes every spinner into a broken ring**
- **Location:** `src/index.css:137-144`, `*{animation-duration:.01ms!important; transition-duration:.01ms!important}`. It touches 27 `animate-spin` and 35 `animate-pulse` uses.
- **Category:** Accessibility
- **Impact:** Users with reduced motion on see the busy states on login, demo login, re-confirm, update send and CSV export (`LoginPage.tsx:85,153`, `ConfirmOnboardingPanel.tsx:223`, `UpdateComposer.tsx:141`, `AttendanceExport.tsx:140`) as a static three-quarter circle, which reads as a stuck icon. The full-page loaders (P2-8) give no other cue. Freezing the pulse skeletons and making transitions instant is fine.
- **WCAG/Standard:** audit.md motion rule (an intentional alternative, not a global 0.01ms kill); 2.3.3 (AAA) intent.
- **Recommendation:** Scope the rule to `.animate-pulse` and transitions. Under `prefers-reduced-motion`, show spinners as a slow opacity fade or swap them for "Saving…"/"Loading…" text on the button.
- **Suggested command:** `/impeccable animate`

**[P2-10] Placeholder-as-label contrast in the admin tools**
- **Location:** Admin header search placeholder 3.5:1 and ⌘K hint 3.9:1 (`AdminSearch.tsx:118,120`, on all 11 admin routes at desktop); duty type placeholder 3.2:1 browser default (`AdminDuties.tsx:142`). These are the detector findings, verified. Separately, the DOM metrics found the `/admin/students` search (`AdminStudents.tsx:412-414`) has **no label at all**, only a placeholder, with no `<label>`, `aria-label` or `id`. axe passes it because it accepts placeholder as a name.
- **Category:** Accessibility
- **Impact:** In both fields the placeholder is the only visible label, so its contrast is the label's contrast.
- **WCAG/Standard:** 1.4.3 Contrast (AA).
- **Recommendation:** `placeholder:text-white/65` and `text-white/70` on the ink search; add `placeholder:text-ink-faint` to the duty field (or let a shared Input carry it); give the students search an `sr-only` label or `aria-label`.
- **Suggested command:** `/impeccable harden`

**[P2-11] Accessible names don't contain the visible text (label in name)**
- **Location:** The account button's visible text is the initials ("TB", "JR") but its name is "Account menu" (`ParentLayout.tsx:89`, `VolunteerLayout.tsx:90`, `AdminLayout.tsx:158`), on every signed-in route. Volunteer duty-day buttons show "Mon 19" but are named "Monday, October 19, 1 open" (6). Admin class expanders, 5. axe `label-content-name-mismatch` (serious) on 21 of 21 signed-in routes.
- **Category:** Accessibility
- **Impact:** Voice-control users ("tap TB", "tap Mon 19") can't operate these controls.
- **WCAG/Standard:** 2.5.3 Label in Name (A).
- **Recommendation:** Name the avatar "Account menu, TB" or `aria-hidden` the initials. Start the day-button names with the visible text ("Mon 19, 1 open…").
- **Suggested command:** `/impeccable harden`

**[P2-12] Headers and detail rows don't reflow when text is enlarged**
- **Location:** Measured at 320 and 375px. At default size there's **0px** horizontal overflow on all 13 sampled routes; at 390px, 0 on all 25. With root font size at 200%, 12 of 13 overflow by 73–269px. The headers are the cause: the avatar + bell + theme row doesn't wrap (`ParentLayout.tsx:88`, `VolunteerLayout.tsx:90`). So are the `/parent` contact `<dd>` values and the `/admin/classes` capacity rows. `body{font-size:16px}` is in px (`index.css:126`).
- **Category:** Responsive
- **Impact:** Parents who use larger text sizes have to scroll sideways to reach the menu and bell.
- **WCAG/Standard:** 1.4.4 Resize Text (AA) and 1.4.10 Reflow (AA), under text-only scaling.
- **Recommendation:** Let the header actions shrink (`min-w-0`, hide the name and chevron under `sm`, which is already done for the chevron), let `<dd>` wrap (`break-words`), and use `font-size:100%` on body.
- **Suggested command:** `/impeccable adapt`

**[P2-13] Hand-copied component styles have drifted (the root cause of P1-1, P1-3 and P2-10)**
- **Location:** 15 local input class constants (`grep "const input"`): heights h-10/h-11/h-12, text-sm ×13 against text-base ×2, `focus:border-transparent` in 11. 38 copies of `bg-brand hover:bg-brand-hover`. No `Button`/`Input`/`Field` in `src/components/`. `rounded-[10px]` ×173, `[8px]` ×66, `[14px]` ×42, `[6px]`, `[12px]`, `[3px]`, while `--radius` is defined (`index.css:43`). Text sizes: `text-xs` ×217 plus `text-[11px]`, `[12.5px]`, `[13px]`, `[13.5px]`, `[15px]` ×32, `[16.5px]`, `[17px]`, `[19px]`, about 20 in all. The `Wordmark` component (`Wordmark.tsx:6`) is bypassed by all three layouts, which import the PNG directly.
- **Category:** Implementation Integrity
- **Impact:** Each fix has to be made 15–38 times, and the copies already disagree: two follow the 16px rule, thirteen don't.
- **Recommendation:** Extract `Input`, `Select`, `Textarea`, `Button` (primary/secondary/text) and `IconButton` (44px) components, a radius scale (`rounded-sm/md/lg` mapped to tokens), and a type scale of about 6 steps.
- **Suggested command:** `/impeccable extract`

**[P2-14] The duty schedule runs about 3,000px tall on desktop**
- **Location:** `AdminDuties.tsx:103` (`grid lg:grid-cols-3`). The detector reported `first-viewport-column-overflow` (339% vs 33%). Verified in `before/admin-admin_duties.d.png`: 40 slot rows for 10 days next to a 4-row type list.
- **Category:** Responsive / Implementation Integrity
- **Impact:** Goes against "avoid long scrolling pages". The admin has to scroll the whole fortnight to find one day's open slot, while two-thirds of the width is empty below the type list.
- **Recommendation:** Group the slots by day in a compact grid (days × duty types) or with a day picker. The volunteer side already uses a day strip on `/volunteer/duties`.
- **Suggested command:** `/impeccable layout`

#### P3: Polish

**[P3-15] Side-stripe toast.** `ClassBrowser.tsx:393` `border-l-4` on a rounded card (detector `side-tab`), the only toast in the app, `fixed bottom-6` with no `env(safe-area-inset-bottom)`. Use the app's inline status pattern, or a full-border status chip. *Implementation Integrity.* `/impeccable polish`

**[P3-16] Oversized wordmark image.** `assets/sccdenver.png` is 4168×1123 (49 KB) but displays at about 119×32 with no `width`/`height`, so the header shifts when it loads. Export a 2× PNG at about 240×64, or an SVG, and set its dimensions. *Performance.* `/impeccable optimize`

**[P3-17] Safe-area padding is inert.** `env(safe-area-inset-bottom)` is used once (`VolunteerLayout.tsx:131`), but `index.html` has no `viewport-fit=cover`, so it always resolves to 0. The parent shell has none. Harmless today (the browser keeps content inside the safe area), but PRODUCT.md asks for safe areas, so either commit to `viewport-fit=cover` with insets on the sticky bars, or drop the dead code. Also, 18 `min-h-screen` (100vh) against 1 `min-h-dvh`. *Responsive.* `/impeccable adapt`

**[P3-18] Link only distinguished by colour.** `VolunteerApplyPage.tsx:731` "Sign in" is `text-ink-muted hover:underline` inside a sentence (axe `link-in-text-block`, 1.4.1). Underline it at rest. *Accessibility.* `/impeccable polish`

**[P3-19] Empty cells read as "em dash".** `/admin/students` (62) and `/admin/volunteers` (10) use a bare "—" for empty values, which screen readers announce. Use `<span aria-hidden>—</span><span class="sr-only">None</span>`. *Accessibility.* `/impeccable clarify`

**[P3-20] The form-editor switch is small and animates `left`.** `AdminFormEditor.tsx:16-19`: a 36×20 track, the knob animated with `transition-all` on `left` (a layout property), and the off-state track at 1.69:1. Use a 44px hit area, `translate-x`, and a ≥3:1 track. *Performance / Accessibility.* `/impeccable polish`

### Patterns & Systemic Issues

- **There are no shared form or touch primitives.** 15 input class copies, 38 primary-button copies and three layout headers explain P1-1, P1-2 (the `focus:border-transparent` copies), P1-3, P2-10 and P2-13. Fixing the primitives once closes five findings.
- **The light theme's non-text contrast was never raised along with the text.** The 2026-10-17 pass raised every *text* pair to AA (all 20 measured pairs ≥4.5:1, see below), but the ring, field borders, switch track and gold-on-light loaders sit at 1.4–1.9:1.
- **The parent shell trails the volunteer shell.** The volunteer layout already has 44px header buttons, `min-h-11` link actions, `text-base` inputs and safe-area padding. The parent layout and parent pages have none of these, although parents are also phone-first and arrive in the biggest rush.
- **Theme setup lives in React components, not the document.** That's why signed-out pages ignore it, why it flashes, and why `color-scheme` never gets set.

### Positive Findings

- **The token discipline is excellent.** Zero raw colours in 124 component files, every surface and status colour goes through `index.css` variables, and dark mode is a pure token swap. Only 5 `dark:` overrides exist in the whole codebase.
- **Measured text contrast passes AA everywhere it's used**, in both themes:

  | Pair | Light | Dark |
  |---|---|---|
  | ink / bg | 14.96 | 16.14 |
  | ink-muted / bg · surface · sunken | 6.22 · 6.71 · 5.71 | 8.37 · 7.64 · 8.78 |
  | ink-faint / bg · surface · sunken | 4.95 · 5.34 · 4.54 | 5.90 · 5.39 · 6.19 |
  | on-brand / brand (buttons) | 10.89 | 10.89 |
  | success · warning · danger · info · parent text on their soft pills | 5.26 · 5.33 · 4.81 · 4.98 · 5.09 | 8.53 · 7.98 · 7.66 · 8.61 · 8.32 |
  | white/50–85 on ink header | 5.30–13.14 | same |

  `ink-faint` on `surface-sunken` (4.54) passes with almost no margin. `--ink-400`/`--ink-500` would fail as text, but they appear nowhere as text (0 uses).
- **axe is nearly clean.** On the 4 public pages, light and dark, 0 violations except one `link-in-text-block`. Only one placeholder-only field (the admin students search, P2-10); no unnamed buttons and no images without alt on any of the 25 routes (DOM metrics). `lang="en"` and one `<main>` everywhere.
- **The ARIA work is careful.** 82 live regions or `role=status/alert` uses, the registration wizard focuses the step and errors (`ParentRegistrationPage.tsx:664,950`), `aria-pressed` toggle groups with `role="group"` labelling, a proper `role="switch"`, and a `tablist` in RollCallPanel.
- **It's responsive at default text size:** 0px horizontal overflow at 320, 375, 390 and 1440 on every route measured. **The volunteer shell is a model** for the rest: 0 targets under 44px on 5 volunteer routes, top tabs 48px tall, `text-base` inputs.
- **Clean code health.** eslint shows 0 errors (4 `exhaustive-deps` warnings in hooks), `noUnusedLocals`/`noUnusedParameters` are on, so there are no unused imports. Fonts load with `display=swap` and preconnect.

## Recommended Actions

1. **[P1] `/impeccable extract`**: build shared `Input`/`Select`/`Textarea` (16px, border kept on focus), `Button`, and a 44px `IconButton`. Replace the 15 input and 38 button copies. This is the root fix for P1-1, P1-3, P2-10 and P2-13.
2. **[P1] `/impeccable adapt`**: bring the parent shell and parent pages up to the volunteer shell: 44px header buttons, `min-h-11` text actions ("Request a change", "Leave the waitlist", "Medical", "Back to dashboard"), 44px chips; and fix header wrapping at 200% text (P2-12).
3. **[P1] `/impeccable harden`**: make the focus ring and field borders ≥3:1 in light; then the tablist and scroll region on `/admin/volunteers`, page h1s on `/parent/classes` and `/parent/register`, the h2 in AttendanceExport, label-in-name on the avatar and day buttons, and the placeholder contrast (P1-2, P2-5, P2-6, P2-10, P2-11).
4. **[P2] `/impeccable optimize`**: split the bundle by role with `React.lazy` (P2-4), and right-size the wordmark (P3-16).
5. **[P2] `/impeccable colorize`**: apply the theme before paint for every route, set `color-scheme`, use one `useTheme` hook, give the dark header an edge, and fix gold initials and loaders (P2-7, P2-8).
6. **[P2] `/impeccable animate`**: replace the global reduced-motion kill with per-pattern alternatives, so spinners become text or a fade (P2-9).
7. **[P2] `/impeccable layout`**: compress the duty schedule into a day grid or day picker (P2-14).
8. **[P3] `/impeccable polish`**: final pass on the side-stripe toast, the "Sign in" underline, the switch, empty-cell dashes and safe-area cleanup (P3-15, 17–20).

You can ask me to run these one at a time, all at once, or in any order you prefer.

Re-run `/impeccable audit` after fixes to see your score improve.

---

### Run notes

- **Target:** whole site. Source `src/` at `47160cf`, live demo https://scc.haanie.com (fictional data, captured 2026-10-17 around 21:40 local).
- **Ignore list:** no `.impeccable/critique/ignore.md`, no detector config. During this run another agent created `.impeccable/questions/` and `.impeccable/mocks/` in the worktree; they hold no detector config and didn't affect the scans (`--no-config` gives identical source results).
- **Independence:** nothing under `raw/` written by others was read.
- **CLI detector:** impeccable 4.6.0 (native darwin-arm64 binary). The browser bundle was taken from the skill source tree (`crates/live/assets/detect-antipatterns-browser.js`), whose engine version is 0.1.15. The two can differ slightly in rules, but both ran without errors.
- **Browser:** headless Chromium (Playwright `chrome-headless-shell-1243`). Touch was emulated (`isMobile`, `hasTouch`) for layout only; no gestures were synthesized and none were needed (no custom drag or slider surfaces exist apart from the native date input).
- **No live server was started and the project's HTML was not modified.** The scripts live in the scratchpad: `pw/b-scan.mjs`, `pw/b-axe.mjs`, `pw/b-reflow.mjs`, `pw/b-dateshot.mjs`, `b/contrast.mjs`. The build went to `scratchpad/b/dist` (`vite build --outDir`), not into the worktree.
