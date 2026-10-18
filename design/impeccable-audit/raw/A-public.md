# Assessment A: design review of the signed-out surfaces

Scope: `/login` (with demo panel), `/signup`, `/forgot`, `/reset`, `/mfa`, `/unauthorized`, `/apply` (all four steps plus the closed, loading and submitted states).
Sources: `src/pages/LoginPage.tsx`, `SignupPage.tsx`, `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`, `MfaPage.tsx`, `UnauthorizedPage.tsx`, `VolunteerApplyPage.tsx`, `src/components/Wordmark.tsx`, `InterviewSlotPicker.tsx`, `src/lib/demo.ts`, `src/index.css`.
Evidence: the `before/public-*` captures, plus new read-only captures in `before/extra/A-apply-{1-error,1-other,2,3,4}.{m,d}.png` (375×812 and 1440×900), `A-apply-*.dark-*`, `A-login.dark-*`, `A-reset.*`, `A-forgot.*`. The wizard was driven with client-side "Next" only. One keyboard probe ran with every non-GET request aborted in the browser, so nothing reached the server. `/mfa` cannot be rendered on the demo because MFA is switched off there (`MfaGate.tsx`), so that page is reviewed from source only.
The detector was not run and its output was not read.

Mode: I agree with the brief, with one refinement. On the demo deploy the login page is **Persuade-first**: the demo list is the action a portfolio reviewer came for. The production login (no demo list) is plain Operate. The apply page's opening (title, dates, commitment) carries Persuade weight for a teenager deciding whether to bother. Steps 1–4 are Operate.

---

## 1. Design Specificity Verdict (unanchored)

**Verdict: category-interchangeable. The brand shows up only as a sticker on a stock auth template.**

Every signed-out screen uses the same scaffold: a 64px ink strip with a 32px wordmark, then a cream page, then one 384px white card with *both* a 1px border and a shadow, centered vertically. Inside the card sit a bold heading, a muted subtitle, inputs, a gold full-width button with a decorative icon, and a centered footnote link. Swap the PNG and the gold hex and this is any SaaS sign-in page from 2021. On desktop at 1440×900 that 384px column floats in about 1,050px of empty cream, and on `/login` the real **Sign in** button sits below the fold (y≈928).

Where the product does show through, it shows through **words, not design**:
- The demo blurbs ("Three campers: one confirmed, one waitlisted, one to re-confirm") are the most product-specific thing on these pages.
- The MFA rationale ("Admins can see every camper's medical details, so admin accounts need a second step") is product truth stated plainly.
- The apply form's school list (Cherry Creek, Grandview, Smoky Hill…) and "Volunteers stay 8:30 AM – 4:30 PM each day at Cherry Creek High School" belong to this camp. The second one, though, is buried as 12px helper text on step 2.

Missed opportunities for character, all within the brand kit and no new features:
- The wordmark's own grammar, `{STEEL CITY CODES} //DENVER`, is code syntax. Nothing else in the UI uses it. It is a ready-made signature move that the brand has already earned, so it is not a monospace costume.
- The ink is used only as a 64px strip. Ink is the one surface where gold may appear as text or graphic (gold on ink, never gold on white), so an **ink masthead** that holds the page title, dates and a gold progress rail would give the brand a real surface. It would also make the wizard's progress legible: gold on ink, instead of the current 40%-gold dots on cream at about 1.3:1.
- Josefin Slab ships in the font request (`index.html`) and is never used on these pages. For Operate that is correct (one family), so leave it out rather than add it. But the font request should then drop Slab.

The apply wizard does have one structural idea that is specific to the product: booking the interview inside the application ("SignUpGenius-style"). It is the best piece of design here and it is crammed into the bottom of an overloaded step 4 (see §6).

---

## 2. Nielsen's 10 heuristics (signed-out area)

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | The wizard's progress is four unlabeled dots: no step names, nothing announced, and completed dots are `bg-brand/40` on cream (≈1.3:1). `/apply` loads as a bare spinner without the brand bar (`VolunteerApplyPage.tsx:327-333`), then jumps. The demo-login feedback is a 16px spinner inside the icon tile. Good: button "Signing in…/Sending…/Saving…" states, and the resend countdown. |
| 2 | Match System / Real World | 3 | Mostly plain and warm. Leaks: "Welcome back" greets every first-time parent (`LoginPage.tsx:100`); "Sign up" doesn't say it makes a *parent* account; "Register to enroll your camper" uses two verbs where the product term is "register"; "CS languages", "Other curricula", the "Least/Greatest" scale; "Access denied". |
| 3 | User Control and Freedom | 2 | The wizard has Back and keeps state across steps, but a refresh, or iOS evicting the tab, loses all ~30 answers (`useState` only). `/unauthorized` offers only "Back to sign in", which bounces a signed-in user back to their own area without saying so. MFA's error state offers no retry, only Sign out. |
| 4 | Consistency and Standards | 2 | The apply form uses **six selection idioms**: checkbox cards, Yes/No buttons, pill chips, numbered circles, radio cards ×2 and slot buttons. Native selects render white and bold, unlike the inputs. Signup and apply handle "email already has an account" differently. Dark mode: signed-out pages ignore `scc-theme` on load (only the three layouts read it) but stay dark after an in-app sign-out. |
| 5 | Error Prevention | 2 | Placeholders look like filled values ("17", "Jane", "Smith", "••••••••", "Parent Name"). The same course can be picked as first and second choice. Age `min=14 max=25` is never enforced by the custom validation. No password reveal or confirm on signup and apply (reset has a confirm). "Pick your interview time *" is marked required even when no slots exist. |
| 6 | Recognition Rather Than Recall | 3 | Labels are persistent and step headings exist. But the dots don't say what's next or how far is left, and the skill scale's anchors are just "Least/Greatest", which says nothing about what 3 means. |
| 7 | Flexibility and Efficiency | 2 | Strong autocomplete attributes (`given-name`, `new-password`, `one-time-code`) and one-click demo seats. But Enter does not advance the wizard (Next is `type="button"`, and step 1's 7 text fields block implicit submit), there is no password reveal, and on mobile a teenager types their school's name when "Other". |
| 8 | Aesthetic and Minimalist Design | 2 | Ghost cards (border + shadow) everywhere, icon tiles on every status, icons inside every primary button, Unicode ⚠ ✓ ✕ glyphs, a gold border on the demo card, "15 min" repeated on 17 slot buttons, "Least…Greatest" repeated 6 times, the course list printed twice, and a 12px legal wall in a nested scroll box. |
| 9 | Error Recovery | 2 | The wizard shows **one error at a time, at the bottom, attached to no field**: no `aria-invalid`, no focus move. Raw Supabase strings reach users in signup (`SignupPage.tsx:49`), interview booking (`VolunteerApplyPage.tsx:315`), MFA (`MfaPage.tsx:36,46,60`) and the reset fallback (`ResetPasswordPage.tsx:39`). The best recovery is excellent: the expired or invalid reset link, forgot's rate-limit copy, apply's existing-account links, and the saved-but-not-booked retry. |
| 10 | Help and Documentation | 2 | Helper text is task-focused where it exists (signature, interview, reset). There is no way to contact the camp from login, signup or apply. `denver@steelcitycodes.org` appears only on the "Applications are closed" page. |
| **Total** | | **22/40** | **Acceptable**: significant improvements needed. The auth pages alone would score about 27. The apply wizard pulls the area down. |

---

## 3. Cognitive load

| Check | Result | Evidence |
|---|---|---|
| Single focus | **Fail** | `/login` (demo) shows 8 actions: 4 demo seats, a sign-in form, Forgot, Sign up and Apply. Two equal-weight cards compete. |
| Chunking (≤4 per group) | **Fail** | Apply step 1 has 10 required fields in one undifferentiated column. Step 3 has 6 skills × 5 buttons (30 targets) plus two course lists. Step 4 has waiver, two signatures and 17 slots. |
| Grouping | **Fail** | Step 1, "Account & contact info", mixes credentials (password) with shirt size, grade and school, so three different jobs share one group. |
| Visual hierarchy | Pass | Auth cards have one heading and one gold button, and the primary is always obvious. |
| One thing at a time | **Fail** | Step 4 asks the applicant to read a liability release, sign it, get a guardian to sign, and choose an interview, all in one scroll (about 1,800px at 375). |
| Minimal choices (≤4) | **Fail** | 17 interview slots, 7 language chips, 6 skill rows, 4–6 course radios ×2, and 8 actions on the login page. |
| Working memory | Pass | Nothing must be carried between steps. The dates are repeated in the header. |
| Progressive disclosure | Pass (partial) | "Other" school and the under-18 guardian signature are revealed correctly. The waiver and the skill grid are shown in full when they could be stepped. |

**Failed: 5 of 8, so high cognitive load**, almost entirely from `/apply`.

**Decision points with more than 4 visible options**
- `/login` (demo deploy): 8 parallel actions.
- Apply step 2, "CS languages you know": 7 chips (required).
- Apply step 3, skill levels: 30 rating buttons. First choice course: 4 here, 6 with the fallback list. Second choice: the same list again.
- Apply step 4, interview time: 17 buttons across 9 days.
- Apply step 1: shirt size (7 options including "Select…") and school (7), both in native selects, which is acceptable.

---

## 4. Emotional journey

**Parent at opening time (Feb, phone, anxious about seats).** They arrive at `/login`, are told "Welcome back", and have to find a 14px footnote "Sign up". Signup is three fields, which is the right weight. Then comes the **valley**: "Check your email… Click it to activate your account." They must leave the site, open mail, tap a link and sign in again while (they believe) seats are going. The copy never tells them that the link brings them back here, or what happens next. There is a second, silent valley: a returning 2026 family who re-signs up with the same email gets "Check your email" and **no email ever arrives**. With confirmations on, Supabase returns a user with `identities: []` and sends nothing. `/apply` handles this case (`VolunteerApplyPage.tsx:252`) and `/signup` doesn't. That is the worst possible moment for a silent failure.

**Teen volunteer.** The page opens on "2026 Volunteer Application" and immediately asks for name, email and **a password**, before saying what the commitment is (8:30–4:30 daily for a week, at Cherry Creek HS, plus a 15-minute online interview). That information is scattered across a step-2 helper line and step 4. On step 3 the phone scrolls sideways. The **highest-stakes moment** is step 4: a minor and a parent sign a liability and photo release. It is presented as 12px grey text in a 256px nested scroll box, with "Parent Name" as a placeholder, and no word on whether the guardian must type it themselves. It needs the most reassurance and gets the least.
**Peak:** "Interview booked: Mon, Oct 19, 4:00 PM" in a green band after submit. That is a real, earned peak.
**End:** weak. "Check your email for a confirmation link to activate your account" is mid-paragraph (`:378-380`), although activation is required to sign in and see or reschedule the interview. The last action offered is "Visit our website", which sends them off-site. The peak-end rule says this ending is what they remember: a paragraph and an exit.

**Portfolio reviewer.** A good first beat: "Try the demo" with four concrete seats sits above the fold on mobile and desktop. Then the page undersells: a tiny logo, a generic card, and huge empty margins at 1440. Click feedback is a small spinner inside a 36px tile. The end of this journey happens inside the app, outside this scope.

**Admin MFA.** Calm and justified. The rationale copy reassures *why*, and the QR code, manual key and "Lost your phone?" path are all present. "Lost your phone?" shows during first-time setup too, where it is noise.

**Wrong-door (`/unauthorized`).** A 56px red ✕ and "Access denied" for what is almost always a parent tapping an old admin or volunteer link. That is alarm out of proportion to the event.

---

## 5. What's working

1. **Recovery copy in the auth flows is genuinely good and product-honest.** Forgot never reveals whether an account exists, and says "It works for one hour" (`ForgotPasswordPage.tsx:45`). Reset tells apart an expired link from an invalid one and gives "Send a new link" as the primary action (`ResetPasswordPage.tsx:71-89`). Signup has a 60-second resend cooldown. Apply detects an existing account and offers Sign in / Forgot, and if the booking fails after the application saved, it retries the booking alone without re-creating the account (`:133-138, 228, 309-322`). This is careful, unusual work.
2. **The demo seats are told as stories, not roles.** Each blurb names the state worth seeing ("Application under review, with an interview you can reschedule"), so a reviewer knows what to look for before clicking. Keep this copy verbatim.
3. **Accessibility groundwork is real.** Every input has a `<label for>`, errors use `role="alert"`, focus moves to the heading on state change (`focusOnMount`), MFA refocuses the code field after a wrong code, autocomplete tokens are correct, and contrast tokens were raised to AA. The brand rule is respected: gold appears only as a fill under ink text, or on ink.

---

## 6. Priority issues

**[P1] 1. Step 3's skill grid breaks the page at phone width (and spills out of its card at desktop)**
- **What:** `SkillRating` (`VolunteerApplyPage.tsx:79-98`) is a fixed `w-48` label, then "Least", five 32px circles and "Greatest" in one row. At 375 the document is **522px wide** (measured), so the whole step scrolls sideways. At 1440 the "Greatest" anchors render outside the card's border (`A-apply-3.d.png`). The circles are 32px (under 44). Each is announced as "1, button" with no skill name and no pressed state, 30 times.
- **Why it matters:** the primary audience (teenagers on phones) hits a broken, sideways-scrolling page in the middle of the application. Screen-reader users can't tell which skill they are rating or what they picked.
- **Fix:** one legend above the group ("1 = never used it · 5 = could teach it"). Each skill becomes a two-line row: the name on its own line, then a full-width 5-segment control (each segment at least 44px tall, about 62px wide at 375) built on real `<input type="radio">` per skill inside a `fieldset`/`legend`, which supplies the name and the checked state. Remove the card wrapper (`:587`). "Leave blank if N/A" becomes a "Clear" text button on rows that have a value.
- **Command:** `/impeccable adapt` (then `harden` for semantics)

**[P1] 2. Every signed-out input is 14px, so iOS Safari zooms on focus**
- **What:** All input, select and textarea classes use `text-sm`: `LoginPage.tsx:116,137`, `SignupPage.tsx:118,134,151`, `ForgotPasswordPage.tsx:76`, `ResetPasswordPage.tsx:45`, `VolunteerApplyPage.tsx:393-395`. There is no global 16px override in `index.css`.
- **Why it matters:** it breaks the director's explicit 16px-input rule on exactly the pages parents and teens use on phones. Each focus zooms the layout and the user has to pinch back out, on every field of a 30-field form.
- **Fix:** one shared field class at `text-base` (16px), used by all seven files. Helper text goes to 14px minimum (currently `text-xs` 12px for signature, availability and waiver text). Replace `min-h-screen` with `min-h-dvh`.
- **Command:** `/impeccable adapt`

**[P1] 3. Wizard validation is whack-a-mole, and focus is lost between steps**
- **What:** `validateStep()` (`:173-205`) returns only the *first* failing field. The message renders once at the bottom (`:687-691`), is tied to no field, sets no `aria-invalid`, and doesn't move focus. On step 1 an applicant can press Next up to 10 times to discover 10 requirements; in `A-apply-1-error.m.png` the error "First name is required" sits about 600px below the First name field. On a successful Next, focus stays on the Next button at the bottom while the page smooth-scrolls to the top (`:212`), so screen readers don't hear the new step. On step 3→4 the Next button is swapped for Submit (different key) and focus drops to `<body>`. JS `behavior: 'smooth'` also ignores the reduced-motion CSS.
- **Why it matters:** this is the main cause of frustration and abandonment in a long form, and a WCAG 3.3.1/2.4.3 failure on a P0 accessibility flow (plan L6a).
- **Fix:** validate the whole step. Show the error text under each field (`aria-describedby`, `aria-invalid`, danger border), focus the first invalid field, and put a one-line count near the button ("2 answers need attention"). On a successful step change, focus the new step heading and scroll instantly when reduced motion is on.
- **Command:** `/impeccable harden` + `/impeccable clarify`

**[P1] 4. Step 4 puts the highest-stakes content in its most crowded, least legible form**
- **What:** One step holds the full liability and photo release at 12px muted text inside a `max-h-64` nested scroll box (`:640-649`), the volunteer signature, the guardian signature, and the interview picker, which is itself a sunken card containing 17 bordered buttons that each repeat "15 min" (`InterviewSlotPicker.tsx:54`) after the intro already said "about 15 minutes". At 375 the step is about 1,900px long. Separately, `PRODUCT.md` says the app "must not invent legal copy" and the plan says "show SCC's official waiver exactly". The provenance of this text is unverified.
- **Why it matters:** a minor and their parent are agreeing to a binding release. Nested scroll on iOS traps the thumb, and 12px Josefin is barely readable. The interview choice, the thing the applicant actually cares about, is the last thing on an exhausting page.
- **Fix:** split into two steps (5 total). This is a re-layout, not a feature. **Waiver:** release text in normal page flow at 16px with its six clauses as short bold-lead paragraphs, then the signature(s) directly under it. **Interview:** its own step, with days as 14px semibold headings, times as 44px buttons showing time only, the duration stated once, and no sunken card. When no slots are open, drop the `*` and show the empty message as plain text. Confirm the waiver text with SCC national before shipping.
- **Command:** `/impeccable distill` → `/impeccable layout`

**[P1] 5. Signup fails silently for existing emails and shows raw errors**
- **What:** `SignupPage.tsx:42-55` treats every non-error response as success and shows raw `signUpError.message` otherwise. With email confirmations on, an existing confirmed email returns `identities: []`, so the page says "Check your email" and nothing is sent. The same class of raw-string leak appears in apply booking (`:315`: "we couldn't book that time: {bookError.message}"), MFA (`MfaPage.tsx:36,46,60`) and reset (`ResetPasswordPage.tsx:39`).
- **Why it matters:** returning families at opening time wait for an email that never comes, then email the director. That is the inbox flood the product exists to prevent.
- **Fix:** reuse apply's detection and copy: "There's already an account with this email. Sign in, or reset your password if you've forgotten it," with both links inline. Map every remaining raw message to a plain sentence that names the recovery. Unknown errors become "That didn't work. Check your connection and try again; if it keeps happening, email denver@steelcitycodes.org."
- **Command:** `/impeccable harden` + `/impeccable clarify`

**[P1] 6. The doors in are mislabeled: "Welcome back" for newcomers, and an unlabeled "Sign up" that makes a parent account**
- **What:** `/login` greets everyone with "Welcome back / Sign in to your account" (`:100-101`). The only ways in for a new user are two footnotes: "Don't have an account? **Sign up**" and "Want to volunteer? **Apply here**" (`:161-172`). Signup's heading is "Create an account" and "Your name" (`SignupPage.tsx:102,108`), with nothing saying it is a parent or guardian account.
- **Why it matters:** a 15-year-old volunteer who taps "Sign up" creates a parent account and then can't find the application. A first-time parent reads "Welcome back" and doubts they're in the right place. Both lead to support emails.
- **Fix:** heading "Sign in" with no subtitle. Replace the two footnotes with one labelled block under the form: "New here?" followed by two full-width secondary links, "Register a camper (parents)" → `/signup` and "Apply to volunteer" → `/apply`. Signup becomes "Create a parent account", with the label "Your name" plus hint "Parent or guardian", and the subtitle "You'll add your campers after you sign in."
- **Command:** `/impeccable clarify`

**[P2] 7. Six selection idioms on one form, half without semantics**
- **What:** Availability is checkbox cards (`:515`), previous volunteering is Yes/No `<button>`s (`:534`), languages are pill `<button>`s (`:552`, about 34px tall), skills are numbered circles, courses are radio cards ×2 (`:600, :615`), and interview times are slot buttons. The Yes/No buttons and language chips expose no state (no `aria-pressed`, no input). The second-choice course list duplicates the first and accepts the same course twice (`:195-196`).
- **Why it matters:** each idiom must be learned anew, screen-reader users can't tell what's selected, and duplicate choices give admins worthless second-choice data.
- **Fix:** two idioms only. Choice rows for single or multi select (real radio/checkbox, 48px row, 20px control) and the segmented scale from issue 1. Languages become checkbox chips at 44px. Yes/No becomes a two-option radio row. **Merge** the course choices: a first-choice radio list, then "Second choice" as the same list with the first choice removed (or a select of the remaining courses).
- **Command:** `/impeccable polish` (after `harden`)

**[P2] 8. Decoration with no job (see the inventory in §8)**
- **What:** border + `shadow-sm` on every card (ghost card), circular icon tiles on every status (✓ `SignupPage.tsx:65`, Mail `ForgotPasswordPage.tsx:40`, CheckCircle2 `ResetPasswordPage.tsx:57`, ShieldCheck `MfaPage.tsx:70`, ✕ `UnauthorizedPage.tsx:9`, ClipboardList `VolunteerApplyPage.tsx:340`, CheckCircle2 `:362`), icons inside every primary button (LogIn, UserPlus, Mail, KeyRound, CheckCircle2), Unicode glyphs ⚠ ✓ ✕ standing in for icons, a gold border on the demo card (`LoginPage.tsx:67`), and role-tinted icon chips where "Camp admin" and "Volunteer applicant" are both gold/amber, the applicant borrowing the *warning* token as identity (`demo.ts:36`).
- **Why it matters:** none of it carries information the heading or label doesn't already carry. It is the main reason these pages read as a template, and the glyph icons render inconsistently across platforms.
- **Fix:** cut it all. Use one elevation: on mobile, no card at all (the form sits on the cream page); on desktop, a border-only panel. The error icon becomes lucide `AlertCircle` at 16px, or text only. Primary buttons are text only. The demo seats lose their tiles and get a right-aligned chevron, which becomes the spinner while signing in.
- **Command:** `/impeccable distill` + `/impeccable quieter`

**[P2] 9. Brand presence is a 32px logo strip, and the desktop composition wastes the screen**
- **What:** `BrandBar` (`Wordmark.tsx:11-18`) is a 64px sticky ink strip with an `h-8` PNG whose "//DENVER" renders about 6px tall at 390. It stays sticky on pages too short to scroll, and on `/apply` it costs 8% of the viewport on every step. At 1440 the login places a 384px column in an empty field, with Sign in below the fold.
- **Why it matters:** the demo login is the portfolio's first impression and the apply page is a teenager's. Both currently say "generic".
- **Fix:** the **ink masthead** signature move (§9): the ink surface grows to hold the page title (cream text), the context line, and on `/apply` a gold progress rail. It scrolls away with the page and is not sticky. The wordmark goes to `h-10` on mobile and `h-12` on desktop. Desktop login becomes two columns: ink left (wordmark plus demo seats), cream right (sign-in).
- **Command:** `/impeccable layout` (then `typeset`)

**[P2] 10. The apply page asks for a password before saying what the job is, and adults can't answer "grade"**
- **What:** The commitment (daily hours, location, week dates, interview) is spread across the subtitle, step 2's 12px helper (`:506`) and step 4's interview note. Step 1 leads with credentials. `GRADES` is 9th–12th or College only (`:11`), and grade is unconditionally required (`:181`), yet `PRODUCT.md` says "the rest are adults".
- **Why it matters:** a teen decides whether to finish in the first screen, and an adult volunteer is forced to give a false answer.
- **Fix:** move the existing commitment sentences into the masthead under the title (copy moved, not invented). Reorder step 1 as About you (name, age, grade, school), then Contact (email, phone), then "Create a password", with the hint "You'll use it to check your application and interview time". Move shirt size to the availability step ("camp details"). Grade: either add "Not in school" or have admins make it optional in the Form editor. That decision is the director's (see §10).
- **Command:** `/impeccable clarify` + `/impeccable onboard`

**[P2] 11. The apply success screen ends on an exit, with the critical step buried**
- **What:** The heading is "Application submitted!" with no focus management (`:365` has no `focusOnMount`, unlike every other success state). Email activation, which is required to sign in, is mid-paragraph (`:378-380`), and the final action is "Visit our website" (off-site).
- **Why it matters:** an applicant who misses the activation email can't reach their interview time or reschedule.
- **Fix:** heading "Application sent" (focused). Under it, three numbered next steps that the user really does need to follow in order: 1. "Confirm your email: open the link we sent to {email}." 2. "Your interview: {time} (online, about 15 minutes)", or "Pick a time from your dashboard once times are posted". 3. "We'll email you after your interview." The primary action is "Go to sign in". Drop "Visit our website" or demote it to a footer link.
- **Command:** `/impeccable clarify`

**[P3] 12. Smaller state and consistency gaps**
- Signed-out pages don't apply `scc-theme` on load. Dark-mode users get light pages after a reload, but dark ones after an in-app sign-out, because the layouts toggle `.dark` and never remove it. Fix: apply the stored theme (falling back to `prefers-color-scheme`) at the app root, not per layout.
- `/unauthorized`: the red ✕, "Access denied" and "Back to sign in" combination is alarming and misleading (see §9).
- MFA: hide "Lost your phone?" during first-time setup (`MfaPage.tsx:108`), and give the error state a "Try again" button.
- The `/apply` loading spinner renders without `BrandBar` (`:327-333`), so the ink bar pops in after load.
- Completed step dots `bg-brand/40` on cream are about 1.3:1, below 3:1 for state indicators.
- The login "Forgot password?" link has a 24px hit area (`LoginPage.tsx:125`, `min-h-6`).
- **Command:** `/impeccable polish`

---

## 7. Persona red flags

**Jordan (first-time parent, opening morning)**
- Reads "Welcome back" (`LoginPage.tsx:100`) on their first visit and hesitates. The way forward is the 14px footnote "Sign up".
- The login password field shows "••••••••" as a placeholder (`:136`), which looks already filled. Jordan presses Sign in and gets "Wrong email or password".
- Signup's "Your name": is it mine or my child's? Nothing says parent or guardian.
- "Click it to activate your account" doesn't say what happens next. The link lands on `/login`, Jordan has to sign in again, and nothing told them so.
- Returning parent who forgot they had an account: gets "Check your email" and nothing arrives (issue 5). Will email the director.

**Sam (screen reader, keyboard)**
- Step indicator: four `<div>`s with no text, so Sam never learns there are 4 steps or which step this is.
- Skill ratings: "1, button" ×30, with no skill name and no selected state. The Yes/No and language chips have no `aria-pressed`, so a selection is invisible to Sam.
- Next: focus stays on the bottom button while the content above changes. On step 3→4 focus drops to `<body>`.
- Errors: the alert announces "First name is required" but focus stays on Next, and the field has no `aria-invalid`. Sam must hunt for it.
- The waiver is a scrollable `<div>` without `tabindex`/`role="region"`/a label, so in Safari, keyboard users can't scroll it.
- "Application submitted!" heading isn't focused, so the success is announced only if Sam explores.
- Unicode "⚠" is read as "warning sign" before every error.

**Casey (one-handed, phone, interrupted)**
- Every field zooms the page on focus (14px inputs).
- Step 3 scrolls sideways (522px document at 375).
- A tab switch long enough for iOS to evict the page loses up to 30 answers. There is no draft.
- Step 4 is about 1,900px: waiver box, two signatures, 17 slots. The sticky 64px bar eats the top of every screen.
- Language chips are about 34px tall and the skill circles 32px, both under 44px.

**Riya, 15, applying on her phone between classes (project persona)**
- She has to create a password on screen one before learning it's 8:30–4:30 every day for a week at Cherry Creek. She finds that out on step 2, in 12px grey.
- "Current grade": fine. "Age" placeholder "17" looks pre-filled, so she may skip it.
- "CS languages you know *" is required. If she's never coded she has to pick something anyway, or wonder whether "Other" counts.
- Self-rating "Least … Greatest" with no definition of a 3.
- Step 4: a dense legal release she won't read at 12px. "Parent / guardian electronic signature" with placeholder "Parent Name". Nothing tells her that her parent must type it themselves, so she will type it.
- After submit, "Check your email for a confirmation link" is buried. If she misses it she can't sign in later to see her interview time.

**Dana, portfolio reviewer on a laptop (project persona)**
- Lands at 1440×900: a tiny logo top-left, two narrow cards in a sea of cream, and the real sign-in form cut off below the fold. The first impression is a template.
- The demo seats are excellent copy, but "Camp admin" and "Volunteer applicant" share a gold tint, so color doesn't separate the roles it pretends to.
- Click feedback is a 16px spinner in the icon tile, and the other three seats go to 60% opacity. That's acceptable but small, and there's no "Signing in as Parent…" text.
- Nothing on the page shows craft beyond a clean form. The brand's `{ } //` grammar, the one distinctive asset, is used nowhere.

---

## 8. Element-justification inventory

Verdicts: **Keep** (has a job), **Cut** (no job), **Merge** (duplicates another element's job), **Change** (has a job, does it badly).

### Shared shell (`Wordmark.tsx`)
| Element | Verdict | Note |
|---|---|---|
| Ink header bar, 64px, sticky (`:13`) | **Change** | Keep the ink. Drop `sticky` (no actions live in it) and grow it into the masthead that holds the page title (§9). |
| Wordmark PNG `h-8` (`:7`) | **Change** | Brand-required, but too small: "//DENVER" is about 6px. Use `h-10` on mobile and `h-12` on desktop. Alt text is correct. |
| Wordmark not linked | **Keep** | No signed-out home exists; a link would go nowhere new. |
| Cream page `bg-bg` | **Keep** | Brand ground. Must follow `scc-theme` in dark mode (currently it doesn't on load). |

### `/login` (`LoginPage.tsx`)
| Element | Verdict | Note |
|---|---|---|
| Vertical centering `justify-center` (`:64`) | **Change** | Top-align under the masthead. Centering pushes Sign in below the fold at 1440×900. |
| Demo card, gold border + shadow (`:67`) | **Change** | Grouping is needed, but the gold border is decoration. Use a section with a heading (mobile) or the ink column (desktop). |
| "Try the demo" heading (`:68`) | **Keep** | Names the section. |
| Demo intro paragraph (`:69-71`) | **Change** | Tighten to "A made-up camp with fictional data that resets every night." ("from any seat" is said by the list itself). |
| 4 demo seat buttons, bordered cards (`:76-92`) | **Change** | Keep the one-click job. Make them one list with hairline dividers, 64px rows, and a chevron. |
| Role icon tiles in role colors (`:83-86`, `demo.ts:21-36`) | **Cut** | They duplicate the label. Admin and applicant are both gold, and applicant uses the *warning* token. The spinner moves to the chevron slot. |
| Seat label (`:89`) | **Keep** | |
| Seat blurb (`:90`) | **Keep** | The best copy on the page. Raise from 12px to 14px. |
| Sign-in card border + shadow (`:99`) | **Change** | One elevation: none on mobile, border only on desktop. |
| "Welcome back" (`:100`) | **Change** | "Sign in". |
| "Sign in to your account" (`:101`) | **Cut** | Restates the heading. |
| Email label (`:105`) | **Keep** | |
| Email placeholder "you@example.com" (`:115`) | **Cut** | Repeats the label. |
| Email input 14px (`:116`) | **Change** | 16px. |
| Password label + inline "Forgot password?" (`:121-127`) | **Keep** / **Change** | Right placement. Hit area 24px → 44px via padding. |
| Password placeholder "••••••••" (`:136`) | **Cut** | Looks like a filled password. |
| Error line with "⚠" glyph (`:141-144`) | **Change** | Keep the message (good copy). Use a 16px drawn icon or none. |
| Sign in button (`:147-158`) | **Keep** | Primary. |
| LogIn icon in button (`:155`) | **Cut** | Decorative. |
| "Don't have an account? Sign up" (`:161-166`) | **Change** + **Merge** | Merge with the next row into a "New here?" block: "Register a camper (parents)". |
| "Want to volunteer? Apply here" (`:167-172`) | **Change** + **Merge** | "Apply to volunteer". Same block as above. |

### `/signup` (`SignupPage.tsx`)
| Element | Verdict | Note |
|---|---|---|
| Card border + shadow (`:101`) | **Change** | One elevation (as login). |
| "Create an account" (`:102`) | **Change** | "Create a parent account". |
| "Register to enroll your camper" (`:103`) | **Change** | "You'll add your campers after you sign in." (true to the flow; no "enroll"). |
| "Your name" label (`:107`) | **Change** | Add hint "Parent or guardian". |
| Name placeholder "Jane Smith" (`:117`) | **Cut** | Reads as a value. |
| Email field (`:122-136`) | **Keep** | 16px. Cut the placeholder. |
| Password placeholder "8+ characters" (`:150`) | **Change** | Move to persistent hint under the label: "At least 8 characters". |
| Error line raw message (`:155-158`) | **Change** | Mapped copy plus existing-account detection (issue 5). |
| UserPlus icon (`:169`) | **Cut** | |
| "Already have an account? Sign in" (`:175-180`) | **Keep** | |
| Success ✓ circle tile (`:65-67`) | **Cut** | The heading carries it. |
| "Check your email" (`:68`) | **Keep** | Focused. Good. |
| Confirmation body (`:69-71`) | **Change** | Add the next beat: "…Open it on this phone and you'll come back here to sign in." |
| Resend with 60s countdown (`:72-83`) | **Keep** | Good. Raise 12px → 14px and give it a 44px target. |
| "Back to sign in" (`:84-89`) | **Keep** | |

### `/forgot` (`ForgotPasswordPage.tsx`)
| Element | Verdict | Note |
|---|---|---|
| Heading + helper (`:59-60`) | **Keep** | Clear. |
| Email input, `autoFocus` (`:67-77`) | **Keep** | 16px. Cut the placeholder. |
| Mail icon in button (`:93`) | **Cut** | |
| "Remembered it? Sign in" (`:98-101`) | **Keep** | |
| Sent: Mail icon tile (`:40-42`) | **Cut** | |
| Sent: "If {email} has an account… one hour" (`:44-46`) | **Keep** | Exemplary, privacy-safe copy. |
| Sent: "Check your spam folder, or try again" (`:47-52`) | **Keep** | 14px, 44px target. |

### `/reset` (`ResetPasswordPage.tsx`)
| Element | Verdict | Note |
|---|---|---|
| Loading spinner (`:50-52`) | **Keep** | Short wait. Fine. |
| Invalid/expired state (`:71-89`) | **Keep** | Distinguishes the cause, names the recovery, and "Send a new link" is primary. |
| "For {email}. Use at least 8 characters." (`:95-97`) | **Keep** | |
| "New password" / "Type it again" (`:100-107`) | **Keep** | Plain labels. 16px inputs. |
| KeyRound icon (`:123`) | **Cut** | |
| Fallback error with raw message (`:39`) | **Change** | Plain sentence plus contact. |
| Done: CheckCircle2 tile (`:57-59`) | **Cut** | |
| Done: "Continue" (`:62-68`) | **Change** | "Go to my account". |

### `/mfa` (`MfaPage.tsx`, source only)
| Element | Verdict | Note |
|---|---|---|
| ShieldCheck tile in admin gold (`:70-72`) | **Cut** | Decorative. The heading says it. |
| Loading skeleton 160px (`:73`) | **Keep** | Reserves the QR space. |
| Error state with raw message, no retry (`:74-79`) | **Change** | Plain copy plus a "Try again" button. |
| Setup rationale (`:87-89`) | **Keep** | Product-true, reassuring. Trim the app list to three names. |
| QR image (`:90`) | **Keep** | |
| Manual key in mono (`:91-94`) | **Keep** | Mono is earned here (it's a code). Raise the helper to 14px. |
| "6-digit code" label + big tracked input (`:99-102`) | **Keep** | |
| "Lost your phone?…" (`:108-110`) | **Change** | Show only in verify mode. |
| "Sign out" (`:113-116`) | **Keep** | The escape hatch. |

### `/unauthorized` (`UnauthorizedPage.tsx`)
| Element | Verdict | Note |
|---|---|---|
| Red ✕ circle tile (`:9-11`) | **Cut** | Alarm out of proportion; a Unicode glyph used as an icon. |
| "Access denied" (`:12`) | **Change** | "This page isn't part of your account". |
| "You don't have permission…" (`:13-15`) | **Change** | "You're signed in as a {role}. Your pages are a tap away." If the role isn't available here, use "It belongs to a different kind of account." |
| "Back to sign in" (`:16-21`) | **Change** | "Go to my home page" → `/` (ProtectedRoute routes by role). |

### `/apply` (`VolunteerApplyPage.tsx`, `InterviewSlotPicker.tsx`)
| Element | Verdict | Note |
|---|---|---|
| Loading: bare spinner, no bar (`:327-333`) | **Change** | Render the masthead plus a field skeleton. |
| Closed: ClipboardList tile, gold icon on brand-soft (`:340-342`) | **Cut** | Decorative, and a gold graphic on a light surface. |
| Closed: heading + email copy (`:343-350`) | **Keep** | |
| Title "{year} Volunteer Application", centered (`:411-412`) | **Change** | Move into the masthead, left-aligned to match the form. Centered title over a left-aligned form creates two axes. |
| Subtitle "Denver Summer Camp · dates" (`:413-415`) | **Keep** | Add `text-wrap: balance` (desktop orphans "30"). |
| StepDots (`:102-115`, `:418`) | **Change** | Gold segmented rail on ink plus visible "Step 2 of 5 · Availability", with an `aria-current` step name. |
| Step h2s (`:425, 502, 583, 638`) | **Merge** | With the step label above. One heading per step. |
| First/last name grid (`:427-438`) | **Keep** | Fine at 375 (two 166px columns). Cut the "Jane"/"Smith" placeholders. |
| Email (`:440-444`) | **Keep** | |
| Password (`:446-450`) | **Change** | Move to the end of step 1 under "Create a password" with a purpose hint. Add a show/hide toggle. |
| Phone with "123-456-7890" placeholder (`:452-456`) | **Keep** | The placeholder is a legitimate format example. |
| Age input, placeholder "17" (`:460-462`) | **Change** | Cut the placeholder and enforce 14+ in validation (the HTML `min` is ignored). |
| Shirt size beside age (`:465-470`) | **Change** | Move to the camp-details step. It isn't contact info. |
| Grade select (`:473-479`) | **Change** | Adults have no truthful option (see §10). |
| School select + "Other" reveal (`:481-495`) | **Keep** | Good progressive disclosure. |
| Availability helper "8:30–4:30 at Cherry Creek" (`:506`) | **Change** | Move to the masthead. It is the commitment, not a footnote. |
| Availability checkbox cards (`:515-519`) | **Keep** | Good 48px targets. Checkbox 16px → 20px. |
| "Why volunteer" + "(2–3 sentences)" hint (`:525-527`) | **Keep** | Cut the placeholder sentence (the hint covers it). |
| Previous-SCC Yes/No buttons (`:530-546`) | **Change** | A real two-option radio row. |
| Language pill buttons (`:548-564`) | **Change** | Checkbox chips with state, 44px. |
| CS classes textarea (`:566-570`) | **Keep** | |
| Experience textarea (`:572-576`) | **Keep** | |
| Skills card wrapper (`:587`) | **Cut** | A container compensating for layout. |
| "(leave blank if N/A)" (`:586`) | **Change** | Fold into the legend: "Skip any you haven't used." |
| SkillRating row (`:79-98`) | **Change** | Issue 1. |
| "Least"/"Greatest" ×6 (`:82, 96`) | **Merge** | One legend above the group. |
| First-choice course radio cards (`:597-610`) | **Keep** | |
| Second-choice radio cards (`:612-625`) | **Merge** | The same list minus the first choice. Block duplicates. |
| Other curricula textarea (`:627-631`) | **Keep** | Optional. Cut the placeholder or keep it as an example (it is one). |
| Waiver nested scroll box, 12px (`:640-649`) | **Change** | In flow, 16px, its own step. Verify the text is SCC's official waiver. |
| Volunteer signature + binding note (`:651-656`) | **Keep** | Shorten the note: "Type your full legal name. This is your signature." |
| Guardian signature (`:658-665`) | **Keep** / **Change** | Helper: "Your parent or guardian types their own full name." Cut the "Parent Name" placeholder. |
| Interview sunken card (`:667`) | **Cut** | A card containing cards. Becomes its own step. |
| "Pick your interview time *" (`:668`) | **Change** | No `*` when there are no slots. It becomes the step heading. |
| Interview intro (`:669-671`) | **Keep** | It states the 15 minutes once. |
| Slot day labels 12px muted (`InterviewSlotPicker.tsx:36-38`) | **Change** | 14px semibold ink. They are the scan anchors. |
| Slot buttons with "15 min" each (`:43-55`) | **Change** | Time only, 44px. Duration stated once above. |
| Empty-slot box with CalendarClock (`:25-28`) | **Change** | Keep the message (good). Cut the box and icon inside the old sunken card. |
| Error line "⚠" at the bottom (`:687-691`) | **Change** | Per-field errors (issue 3). Keep a count near the button. |
| Existing-account Sign in · Forgot links (`:692-698`) | **Keep** | Good recovery. |
| Back / Next row (`:701-727`) | **Keep** | Chevrons earn their place (direction). |
| CheckCircle2 on Submit (`:723`) | **Cut** | |
| "Already have an account? Sign in" 12px faint (`:729-732`) | **Change** | Move to the masthead context line at 14px, where a returning applicant looks first. |
| Success: CheckCircle2 tile (`:362-364`) | **Cut** | |
| Success: "Application submitted!" (`:365`) | **Change** | "Application sent", focused on mount. |
| Success: booked-time green band (`:370-372`) | **Keep** | The peak. |
| Success: activation sentence mid-paragraph (`:378-380`) | **Change** | Numbered next steps (issue 11). |
| Success: "Visit our website" (`:381-386`) | **Change** | Replace with "Go to sign in". Off-site at most as a footer link. |

---

## 9. Redesign direction for the mockup

**System-wide (all signed-out screens)**
- **Signature move: the ink masthead.** The ink `BrandBar` stops being a 64px strip and becomes the top block of every signed-out page: the wordmark (`h-10` mobile, `h-12` desktop), then the page's H1 in cream (`#F5EFE4` on ink 950, Josefin Sans 700, 28px mobile / 32px desktop), then a one-line context in cream at 75% (14–16px). On `/apply` it also carries the gold progress rail. It is not sticky. Below it, everything sits on the cream ground. Gold appears only as button fill (ink text) and as the rail on ink. Gold text never touches white or cream.
- **Code-syntax accent (once, not everywhere):** only the step label uses the wordmark's `//` grammar, inline in the masthead and never as an eyebrow above a heading: `Step 2 of 5 // Availability`. Nowhere else.
- **No cards at 375.** Fields sit directly on cream with a 16px gutter. At ≥768 the form gets a single border-only panel (`--border`, radius 12, no shadow).
- **Type:** one family (Josefin Sans). Body and inputs at 16px, labels 15–16px semibold, helper 14px, nothing under 14px. Input height 48px.
- **Buttons:** text only, gold primary (48px, full width on mobile), secondary as outline. No icons except directional chevrons.
- **Errors:** inline under the field (danger text 14px plus a 16px drawn `AlertCircle`), field border in danger, `aria-invalid`.
- **Theme:** honor `scc-theme`, falling back to `prefers-color-scheme`. In dark mode the masthead stays ink and the ground becomes `--bg` dark. The masthead/ground contrast then comes from the wordmark and type, not the fill. Use a 1px `--border-strong` rule under the masthead in dark mode.
- `min-h-dvh`, and safe-area padding on the masthead (`env(safe-area-inset-top)`).

**`/login` (demo deploy)**
- *375:* Masthead: wordmark, then the H1 **"Try the demo"**, then the context line "A made-up camp. Fictional data, reset every night." Below on cream comes the **seat list**: four 64px rows, hairline dividers, label 16px semibold, blurb 14px muted, chevron right (the chevron becomes a spinner on tap, and the row label changes to "Signing in as Parent…"). Then a labelled divider "or sign in with email", then the form with no card: Email, Password (with "Forgot password?" right-aligned on the label row, 44px target) and a full-width gold **Sign in**. Then **New here?** with two outline buttons stacked: "Register a camper (parents)" and "Apply to volunteer". Removed: both card shells, the gold card border, the role-color tiles, "Welcome back", "Sign in to your account", the placeholders, the button icon.
- *Desktop (≥1024):* two columns at full viewport height. **Left 5/12: ink**, with the wordmark top-left, "Try the demo", the context line and the four seats rendered on ink (cream text, cream-50% blurbs, gold chevrons, hover = ink-900 row). **Right 7/12: cream**, with "Sign in" plus the form in a 400px column, vertically centered, and "New here?" beneath. Everything is above the fold at 1440×900.
- *Production (no demo):* the masthead holds the wordmark and H1 "Sign in" with the context "Denver summer coding camp" (confirm wording with the director). On desktop the ink column holds only the wordmark and that line.

**`/signup`**
- Masthead: H1 **"Create a parent account"**, context "You'll add your campers after you sign in."
- Fields: "Your name", hint "Parent or guardian"; Email; Password with the hint "At least 8 characters" and a show/hide toggle. Gold **Create account**. Footer: "Already have an account? Sign in" and "Volunteering instead? Apply here" (one line each, 14px).
- Success: the masthead H1 becomes **"Check your email"** (focused). Body: "We sent a link to **{email}**. Open it on this phone and you'll come back here to sign in." Then "Didn't get it? **Resend** (in 42s)" with the 44px target and "Back to sign in". No tile.
- Existing email: inline error under Email: "There's already an account with this email." with links **Sign in** · **Reset password**.

**`/forgot`**: the masthead H1 is "Forgot your password?" and the context is "We'll email you a link to choose a new one." There is one field and a gold **Send reset link**, with "Remembered it? Sign in" beneath. In the sent state the H1 becomes "Check your email" and the existing body copy is kept verbatim. No tile.

**`/reset`**: as is, minus tiles and icons. The invalid state's H1 lives in the masthead. In the done state the H1 is "Password updated" and the primary is **Go to my account**.

**`/mfa`**: the masthead H1 is "Set up two-step sign-in" or "Enter your code". The setup body keeps the medical-details rationale. The QR is centered at 176px with the manual key under it (mono, 15px, tap to select). Then the code field (48px tall, 24px tracked digits) and the primary. "Lost your phone?" appears only when verifying. "Sign out" is a text button at the bottom. The error state reads "We couldn't start two-step sign-in. Check your connection." with **Try again** (primary) and Sign out.

**`/unauthorized`**: the masthead H1 is **"This page isn't part of your account"** and the context is "It belongs to a different kind of account." On cream, a gold **Go to my home page** (→ `/`) with "Sign out" as a text link under it. No red, no ✕.

**`/apply`** (5 steps; re-layout only)
- **Masthead** (all steps): H1 "Volunteer application, {year}". Context, two lines of existing copy moved up: "Denver summer camp · {Week 1 dates} and {Week 2 dates}" / "Volunteers are at Cherry Creek High School, 8:30 AM – 4:30 PM each day, plus a 15-minute online interview." Then the **gold rail**: 5 segments, filled gold for done and current, ink-700 for upcoming, and under it "Step 2 of 5 // Availability" in cream 14px (an `aria-live` step name). The right-aligned link "Already applied? Sign in" appears on step 1 only.
- **Step 1 · About you:** First / Last (2-col), Age and Grade (2-col), School (+ Other), then a **Contact** subhead with Email and Phone, then **Create a password** with the hint "You'll use it to check your application and interview" and a show/hide toggle. No placeholders except phone format.
- **Step 2 · Availability:** Weeks (checkbox rows, 48px), T-shirt size (moved here; a native select is fine), "Why do you want to volunteer?" (hint "2–3 sentences"), "Volunteered with us before?" (two-option radio row).
- **Step 3 · Experience:** CS languages (checkbox chips, 44px), CS classes, experience with kids, the **skill scale** (legend "1 = never used · 5 = could teach it · skip any you haven't used", rows of name over a 5-segment control, no card), First-choice course (radio rows), Second choice (the same rows with the first choice removed, labelled "Second choice (different from your first)"), Other curricula.
  *If a step must shrink further, move the skills scale and courses into their own step.* Step 3 is the densest, but it reads as one topic.
- **Step 4 · Waiver:** release text in flow at 16px. The six clauses become short paragraphs with bold lead-ins, in a 65ch measure, with no nested scroll. Then "Your signature" (hint "Type your full legal name. This is your signature."). If under 18, add "Parent or guardian signature" (hint "Your parent or guardian types their own full name.").
- **Step 5 · Interview:** the H2 lives in the masthead step label. The intro is "Pick a time for a 15-minute online interview. You can change it later from your dashboard." Then days as 14px semibold headings and times as 44px buttons (time only) in a 3-up grid at 375. With no slots, plain text: "No interview times are open yet. Send your application now and we'll email you when times are posted." The primary becomes **Send application**, with no `*`.
- **Nav row:** Back (outline, left) and the primary (gold, right, `flex-1` on mobile). Above it, an error summary when needed: "2 answers need attention", which focuses the first invalid field.
- **Success:** the masthead H1 is **"Application sent"** (focused) and the context is "Thanks, {first name}." On cream, three numbered next steps: 1. "Confirm your email: open the link we sent to {email}. You need it to sign in." 2. The booked time in the green band ("Interview: Mon Oct 19, 4:00 PM, online, 15 minutes"), or "Pick an interview time from your dashboard once times are posted." 3. "We'll email you after your interview." The primary is **Go to sign in**.
- **Closed:** the masthead H1 is "Applications are closed". On cream: "Volunteer applications aren't open right now. Questions? Email denver@steelcitycodes.org." No tile.
- *Desktop:* the same single column at 640px max, left-aligned under a full-width masthead whose content aligns to the same 640px column. Choice rows with 2–4 short options (weeks, Yes/No) go 2-up. The slot grid goes 4-up.

---

## 10. Minor observations and questions

**Minor**
- The demo data reads oddly to a reviewer: "Denver *Summer* Camp · October 19 – October 23". The seed's session dates contradict the copy, and the interview slots fall inside the camp weeks. That is worth fixing in the seed, not the UI.
- The desktop apply subtitle orphans "30" on its own line, so it needs `text-wrap: balance`.
- `index.html` loads Josefin Slab (300–600) and no signed-out page uses it. Drop it from the request, or decide where it lives.
- Inputs use `focus:border-transparent` plus a gold ring. A 2px gold ring on white is about 1.6:1. Use the ink ring, or a gold ring with an ink inner border, for 3:1 focus visibility.
- Native selects render with a white background and bold "Select…" that differ from the inputs. Style them to match, or accept native and stop styling the inputs.
- The success "Application submitted!" exclamation is the only one in the product voice. The voice elsewhere is calm.
- Reset's done state uses `navigate('/')`, but the button says "Continue": name the destination.
- The login error copy points to "Forgot password?" **above**. That is correct now, but it breaks if the link moves. Say "use Forgot password" without a direction.
- `window.scrollTo({behavior:'smooth'})` (`VolunteerApplyPage.tsx:212,218`) ignores the reduced-motion CSS. Check `matchMedia`.
- The `vol-age` field is `type="number"` on iOS, so it brings the wrong keypad and a stepper. Use `inputMode="numeric"`.

**Questions to consider**
- Is the apply page's waiver SCC national's official text? If not, it is invented legal copy (`PRODUCT.md` forbids that) and should be a clearly labelled placeholder until L2 lands.
- Adults volunteer too. Should "Current grade" gain "Not in school", or become optional through the Form editor? Today an adult must pick a false answer.
- Should the volunteer's *parent* sign on the teen's phone at all? If yes, the guardian step needs one honest sentence about it; if no, that is a feature question outside this pass.
- On the production login (no demo), what one line should the ink column carry? Leave it empty, or use "Denver summer coding camp"? Only use product truth the director confirms.
- What would the demo login look like if the four seats *were* the page, with sign-in as a quiet secondary link (it is a portfolio demo, after all)?
- Draft persistence (sessionStorage) for `/apply` would fix Casey's lost-form problem, but it is arguably a new capability. Does the "no new features" rule count it as hardening or as a feature?
