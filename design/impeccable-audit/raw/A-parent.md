# Assessment A: Parent surfaces (design review)

Scope: `/parent` (Home), `/parent/classes` (class browser, yearly "Quick check", `?camper=` deep link), `/parent/register` (5-step wizard, every step), the parent shell, bell and avatar menu. Mode: **Operate**, phone-browser-first.

Evidence: source on latest `main` in the worktree; the supplied `before/` captures; and my own read-only captures at **375×667 (iPhone SE)** in light and dark, saved to `design/impeccable-audit/before/extra/A/` (`light-dash-*`, `light-bell`, `light-avatar`, `light-classes-*`, `light-quickcheck-*`, `light-wiz1..5-*`, `light-wiz1-error`, `light-dash-with-draft`, `light-desk-dash`, `dark-dash-*`). I filled wizard fields and pressed Next (which only validates), opened Noor's Quick check panel and pressed its button with the signature empty (which only runs client-side validation). I submitted nothing. The detector was not run or read.

Demo state: Taylor Brooks has three campers. **Maya** (12) is confirmed in Web Development in Week 1, and online changes are closed. **Eli** (9) is waitlisted for Intro to Python in Week 1. **Noor** (13) is not enrolled and must re-confirm her details for 2026. Week 1 starts in 2 days. Registration is open.

---

## 1. Design Specificity Verdict (unanchored)

**The brand is specific. The structure is generic.** The ink bar, the real `{STEEL CITY CODES} //DENVER` wordmark, gold kept to primaries, the cream ground and Josefin Sans/Slab tie the surfaces to this camp. Cover the wordmark, though, and the parent area reads as a stock "family portal" kit:

- Every region is the same white rounded rectangle with **both** a 1px border and `shadow-sm`. That covers 3 camper cards, the This-week card, the Updates card, the Contact card and every section card. DS §5.4 says to pick one edge, and these use both.
- **Uppercase icon eyebrows** head the regions ("📣 UPDATES FROM CAMP", "📞 YOUR CONTACT DETAILS", "🕒 DAILY SCHEDULE", "FROM CAMP", "YOUR CAMPERS"). The craft floor bans eyebrows outright.
- **Icon-in-a-tinted-disc tiles** carry no information. Examples: the calendar disc on This week, an identical megaphone disc on every update, the gold disc on the countdown, initials discs for children the parent named, and disc icons on bell rows.
- **Pills everywhere.** Maya's card alone has three: "Medical", "All set" and "Confirmed".

The product's distinctive truths are absent from the structure. A family's season is **campers × weeks**, and the database enforces **one class per camper per week**. Seats go **at a fixed minute**. A waitlist offer **has a clock**. Camp days have **three roll calls**. None of this shapes the layout. The class browser organises by *course* and labels sections in admin codes ("PY-A", "W1", "6 / 14"). The wizard organises by *week*. The rule that most governs a parent's choices appears only as an error line ("Already in Web Development this week").

**Missed signature move (Operate allows exactly one):** the **camper × week strip**. Each camper row shows two week slots. Each slot holds a class with its status, "waitlist", or "open → Register". This one device makes the per-week rule, the family status and the next action visible together. It replaces the rollup badge, the status subhead's job, most of the This-week rows and the "Already in X this week" errors. A second, cheaper brand note is the wordmark's `//` used as the meta separator ("Mon–Fri 9–3 // Room 202"). It earns its place only if the separator is applied consistently.

---

## 2. Nielsen's 10 heuristics (parent area)

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Strong status sentence ("Maya is all set for camp. One spot is on a waitlist. Noor isn't signed up yet."), seat counts refreshed every 30 s, live Denver-time countdown. Weak spots: an offer shows only an absolute deadline with no "9 h left"; class-browser results live in a 4-second toast; the dashboard countdown vanishes at opening time with no "Registration is open" moment (`ParentDashboard.tsx:114` passes no `onOpen`). |
| 2 | Match system / real world | 2 | Admin vocabulary leaks to parents: section codes "WEB-1", "PY-A"; week chips "W1/W2"; "6 / 14" instead of "8 spots left"; "Partly waitlisted"; "Not enrolled". "Student" and "camper" alternate within one wizard. Camp hours appear three different ways: step 4 says "8:00 AM – 4:00 PM" (hard-coded, `ParentRegistrationPage.tsx:857`), sections say 9:00–3:00, and the daily schedule says 8:30–3:30. |
| 3 | User control and freedom | 3 | Good: inline cancel, switch and decline with consequence-naming confirms; wizard Back; a device draft with Discard/Start over. Weak: the cancel and switch controls are 12px text links on 24px targets, and the Quick check offers only "Cancel" with no "save and come back". |
| 4 | Consistency and standards | 2 | There are two registration models. The browser is course-first with cards and repeated gold buttons; the wizard is week-first with radios. Waitlist status has three spellings ("Waitlisted" in the browser, "On waitlist" on cards, "on the waitlist for" on This week). Step names differ from their headings ("Camper"/"Student information", "Health and details"/"Medical & miscellaneous"). Button heights are 36, 40 and 44, with radii of 8 and 10. Nav is visible on desktop and gone on phones. "Browse classes" appears twice on desktop. |
| 5 | Error prevention | 2 | Good: ineligible classes are locked with a reason, same-week clashes are blocked, and the seat count is re-checked before submit. Bad: on step 5 the signature placeholders are the expected names ("Sam Brooks", "Taylor Brooks"), so the fields look already filled. The countdown promises "You can add your campers now" when the wizard cannot get past step 4 before opening. Required "enter None" fields carry no example. |
| 6 | Recognition rather than recall | 3 | Prefill is good: parent details in the wizard and last year's answers in the Quick check. But step 4 lists classes with no days, times or description, so the parent must remember them from the browser. The offer subhead says "Claim it below" for a button about 1,700px down on a phone. The Quick check banner says "we'll ask you to review them when you register", which sends the parent hunting for a review button. |
| 7 | Flexibility and efficiency | 2 | The `?camper=` deep link and draft resume help. Registering two children means running the full wizard twice and retyping both signatures, the laptop, lunch, how-heard, candy and prior-program answers. Success offers only "Back to dashboard". A returning camper's Quick check means scanning 13 fields to change usually none. |
| 8 | Aesthetic and minimalist design | 2 | Home is 2,745px tall at 390 wide (about 4.5 iPhone SE screens), and the camper cards (the point of the page) start around 1,700px. Eli's waitlist status is stated **five** times: subhead, This-week row, bell, rollup chip and per-class chip. The browser can stack five banners above the classes. |
| 9 | Error recovery | 2 | The wizard focuses the failing field, but the message sits at the bottom of the form, off-screen at 375, and the field shows only the focus ring with no invalid styling. The Quick check error is not announced, not tied to its field, and reports only the first gap ("Please answer the free/reduced lunch question" while the parent looks at the signature box). Raw server text leaks: "…couldn't be booked: ${regErr.message}". |
| 10 | Help and documentation | 3 | The camp email in the footer on every page, the deadline lines ("You can switch or cancel online until…" and "→ Request a change"), the medical footnote ("Shared with your camper's volunteers and camp admins only") and the "on this device" draft copy are all good. Missing: what happens next on a waitlist, meaning position, offer window and how the parent will hear. |
| **Total** | | **24/40** | **Acceptable**: a solid, careful foundation with significant hierarchy, density and phone-ergonomics debt. |

---

## 3. Cognitive load

| Check | Result | Evidence |
|---|---|---|
| Single focus | **Fail** | Home stacks This week, a daily schedule of 8 rows, 3 updates, campers and a contact card. The answer and the actions are last. |
| Chunking (≤4 per group) | **Fail** | Wizard step 1 has 10 controls, including 8 ethnicity chips. The Quick check is 13 fields plus an attestation in one block. The daily schedule is always 8 rows. |
| Grouping | Pass (one exception) | Cards group well. Exception: step 3 is literally "Medical & miscellaneous", where allergies sit beside "How did you hear about us?" and candy consent. |
| Visual hierarchy | **Fail** | The 32px "Welcome, Taylor" carries no information. A waitlist offer, the most time-critical item, renders inside a camper card below the fold. |
| One thing at a time | Pass (wizard) / Fail (Quick check) | The wizard paces well. The Quick check is a whole form inline, mid-list. |
| Minimal choices (≤4) | **Fail** | See the list below. |
| Working memory | **Fail** | "Claim it below". The Quick check error names a field 1,000px up. Step 4 lacks class times. The browser banner says "eligible sections are highlighted in green", so the parent has to remember a colour key. |
| Progressive disclosure | **Fail (mixed)** | The medical chip, switch-class and edit-camper panels disclose well. The daily schedule, locked section cards (full size, with capacity bars) and all updates are always expanded. |

**6 of 8 failed → high cognitive load.**

Decision points with more than 4 visible options:
- **Wizard step 1:** 10 inputs, plus 8 ethnicity chips (about 30px tall, `ParentRegistrationPage.tsx:733-742`).
- **Class browser with Noor selected:** about 8 identical gold "Register Noor Brooks" buttons in one scroll, plus the select and search.
- **Quick check panel:** 13 required inputs, an attestation and two buttons (`ConfirmOnboardingPanel.tsx:120-227`).
- **Bell:** 6 links (3 posts that duplicate Home, then 3 camper lines). The only actionable one, "Confirm Noor's details", comes last.
- **Desktop header plus page header:** 7 controls (Home, Browse classes, theme, bell, avatar, Browse classes again, Add camper).
- **A held-seat camper card before the deadline:** 5 actions (Medical, Switch class, Cancel this spot, Edit camper, Register for another class).

---

## 4. Emotional journey

**Opening night (the peak of anxiety).**
- *Before 7:00.* The countdown is excellent: Denver time, live, and announced to screen readers once a minute. But it says "You can add your campers now so you're ready", which is false. The wizard's step 4 refuses to advance until opening (`ParentRegistrationPage.tsx:388`). Nothing is saved to the account until submit, and a draft lives only on that device.
- *At 7:00.* The Home countdown silently disappears. There is no "It's open, register now" moment.
- *In the wizard.* About 17 fields come before the parent sees whether a seat exists (step 4 of 5). Every tap into a field zooms the page, because inputs compute to 14px. The honesty at submit ("Python just filled up. Submit again to join the waitlist…") is right, but it arrives at the worst moment.
- **Valley:** typing 40 fields twice for two kids while seats tick down.

**Peak and end (success).** "You're in!" with the camper's name is warm, and the waitlist variant is honest. But the card floats in a full-screen void (`min-h-screen` inside the shell, `:580`). It omits the thing the parent wants to screenshot: class, week, days, time and room. Its only action is "Back to dashboard". The end-moment for a two-child family is "now do it all again", with no on-ramp.

**Waitlist (valley).** Eli's card offers a single action, **"Leave the waitlist"**, with no reassurance. Nothing explains position, what happens when a seat frees (an offer held 48h, 12h in the final week), or how the family will hear. The subhead's "we'll reach out if a spot opens" appears only when *every* registration is waitlisted. Principle 1 ("No dead ends") is half-met: the parent can act, but the only act offered is to give up.

**Offer expiring (highest stakes).** The copy is good: "A spot opened up for Eli! Claim it by Fri, Oct 18, 7:00 PM (Denver time), or it goes to the next family." Placement fails it:
- The offer sits inside the camper card, below the This-week card and the updates.
- The bell's offer link goes to `/parent` (top of page), not to the card.
- There is no relative countdown, and the Sparkles icon adds nothing.
- On a phone this is a missed-seat risk.

**Camp week (reassurance).** This is the best moment in the product. The This-week card names the class, Mon–Fri 9:00–3:00, Room 202 and "Lead: Fiona", and the roll-call chips ("Arrival: present 9:05") give a parent at work real peace of mind. Two problems:
- The card shows two days *before* camp with the line "Today's roll calls will show here once the room takes them", so the word "today" is wrong.
- It pushes the campers below the fold all season long. It also renders an empty padded band when a later week has no registrations (`ThisWeekCard.tsx:92-103`, visible under "Noor not registered for Week 1").

---

## 5. What's working

1. **Status told as a sentence, plus honest mechanics.** `buildSubhead` (`ParentDashboard.tsx:24-60`) answers "is my kid set?" in plain words and is careful to say "all set" only for campers who hold a seat. Seat counts refresh on focus and every 30 s. The fill re-check before submit and the Denver-time stamps make the UI exactly as fair as the database (Principle 2).
2. **Modal-free self-service with consequence-naming confirms.** `RegistrationActions` and `SwitchClass` (`StudentCard.tsx:70-294`) handle cancel, switch, decline and request-a-change in place. Each confirm names what happens next ("The seat goes to the next family on the waitlist"), the safe option gets focus, focus is restored when a panel closes, and the deadline is explained. This is Principle 5 done right.
3. **A resilient wizard core.** The step is in the URL, the draft is saved per device with a resume banner and "Start over", parent details prefill from the profile, focus moves to the failing field, the step is announced, and step 4 picks the emptiest fitting section and locks ineligible classes with a reason ("Open to students entering grades 7–9"). The bones are right; the layout and order are not.

---

## 6. Priority issues

**[P1] Home inverts priority on the phone**
- **What:** In source order, Home runs header → countdown → drafts → This week (with an always-open 8-row schedule) → Updates (3 posts) → campers → contact (`ParentDashboard.tsx:84-189`). At 375 the first camper card begins around 1,700px.
- **Why it matters:** The parent's three questions are "is my kid set?", "do I need to do anything?" and "where/when?". Two of them sit below 2.5 screens of schedule and announcements. A time-boxed offer can be missed.
- **Fix:** Order Home as: things needing action → campers → this week (shown only within 7 days of a session, schedule collapsed). Move Updates to its own top tab and contact details under the avatar. Target: Home fits in about 1.5 screens at 375×667 for three campers.
- **Command:** `/impeccable layout`, then `/impeccable distill`

**[P1] No navigation on phones**
- **What:** The tabs are `hidden sm:inline-flex` (`ParentLayout.tsx:53-56`). Below 640px the bar holds only the wordmark, theme, bell and avatar. The wordmark isn't a link (`:62`).
- **Why it matters:** The brief requires top tabs. Leaving Classes or the wizard depends on a 14px "Back to dashboard" text link.
- **Fix:** Add top tabs on every width: **Home · Classes · Updates**, gold underline on ink, 44px tall. Make the wordmark link Home. Cut the per-page "Back to dashboard" links (`ClassBrowser.tsx:215`, `ParentRegistrationPage.tsx:657`) except the wizard's, which becomes "Save and exit".
- **Command:** `/impeccable adapt`

**[P1] Every parent form control is 14px, so iOS Safari zooms on focus**
- **What:** Computed input font-size is 14px. Affected:
  - wizard `inputCls`/`textareaCls` (`ParentRegistrationPage.tsx:560, 569`)
  - Quick check (`ConfirmOnboardingPanel.tsx:96`)
  - CamperEditor (`StudentCard.tsx:342`, also h-10)
  - ContactDetailsCard (`:49`, h-10)
  - browser select and search (`ClassBrowser.tsx:235, 252`)
  - request textarea (`StudentCard.tsx:192`)
- **Why it matters:** On opening night every field tap jolts the page. It breaks the standing 16px rule.
- **Fix:** Set `text-base` (16px) on every input, select and textarea, keep h-11, and make checkboxes and radios 20–24px inside 44px labels.
- **Command:** `/impeccable adapt`

**[P1] Opening-night copy and data aren't true**
- **What:** Three statements are false or contradictory:
  - (a) The countdown says "You can add your campers now so you're ready" (`RegistrationCountdown.tsx:37`), yet step 4 blocks Next until opening (`ParentRegistrationPage.tsx:388`). Its error, "You can finish the other steps now and submit once it opens", is also false, because step 5 is unreachable.
  - (b) Step 4 hard-codes "Camp is held at Cherry Creek High School, 8:00 AM – 4:00 PM each day." (`:857`), which contradicts the 9:00–3:00 sections and the 8:30–3:30 schedule.
  - (c) The Home countdown disappears at opening without a call to action.
- **Why it matters:** Principle 2 says "honestly, never optimistically". A parent who prepares at 6:50 finds she can't finish.
- **Fix:** Either let all five steps be completed before opening and gate only the Submit button ("Opens in 3 min · your answers are saved"), or change the copy to "Have each camper's grade, school, allergies and an emergency contact ready." Pull hours and location from section and session data, or cut the line. At opening, turn the countdown into "Registration is open" with the Register button.
- **Command:** `/impeccable clarify`, then `/impeccable harden`

**[P1] Wizard order and density work against the rush**
- **What:**
  - The class is chosen at step 4, after 17 or more fields.
  - Step 1 mixes required basics with optional grant demographics (8 chips plus free-text gender).
  - Step 3, "Medical & miscellaneous", mixes health with marketing ("How did you hear…") and candy consent.
  - The step dots and the "Step 1 of 5: Camper" line duplicate each other, and the step name differs from the heading.
- **Why it matters:** Time-to-seat is the product's February success metric. Grab-bag steps raise the error rate.
- **Fix:** Re-order with no new fields: **1 Camper → 2 Week & class → 3 Contacts (prefilled summary) → 4 Health & a few questions → 5 Review & sign**. Optional demographics go into a collapsed "Optional: for grant reporting" group on step 1. Use one progress element and one heading per step, named the same.
- **Command:** `/impeccable distill`, then `/impeccable layout`

**[P1] Error presentation and an error trap at the finish line**
- **What:**
  - In the wizard the failing field gets focus, but the message renders at the form bottom (`:949-954`) with a "⚠" glyph instead of a Lucide icon, and the field has no invalid styling (screenshot `light-wiz1-error.png`: only a gold focus ring).
  - The Quick check error (`ConfirmOnboardingPanel.tsx:208-210`) has no `role="alert"`, no field link and no focus move.
  - Step 5's signature placeholders equal the expected values (`:936, 943`), so the inputs look completed.
- **Why it matters:** Parents tap Submit on "filled" signatures, get an off-screen error and lose seconds while seats go.
- **Fix:** Show inline messages under each field (danger text with an icon, `border-danger`, `aria-invalid`) and keep the bottom summary only as a fallback. Remove value-like placeholders and put the instruction in the label ("Type Sam's full legal name"). Give the Quick check the same field-level treatment as the wizard.
- **Command:** `/impeccable harden`, then `/impeccable clarify`

**[P1] Two registration models, and the browser one is the weaker**
- **What:**
  - `/parent/classes` groups by course. Each section is a card showing an admin code ("JAVA-1"), a "W1" chip and a capacity bar with "6 / 14". There are no days, time or room.
  - Each section has its own gold "Register Noor Brooks" button.
  - Up to five banners stack: closed, eligibility ("highlighted in green"), countdown, Quick check notice, and "Select a camper above…" in warning yellow.
  - The result is a 4-second toast with a `border-l-4` stripe (`:392-399`), and errors auto-dismiss.
  - There is no h1.
  - A parent with a brand-new child who taps Classes finds no way to add them.
- **Why it matters:** The same decision (which class, which week) gets two different interfaces. Admin codes and fractions cost parents arithmetic and trust. Many gold primaries mean there is no primary.
- **Fix:** Rebuild Classes on the wizard's step-2 pattern:
  - camper chips → week toggle → radio rows "Intro to Python · Mon–Fri 9–3 · Room 101 · 7 spots left"
  - locked classes collapsed into one line
  - one gold "Register Noor for Intro to Python, Week 2" button
  - the result shown inline and persistent
  - a "New camper? Register a new camper" link
- **Command:** `/impeccable distill`, then `/impeccable layout`

**[P1] The yearly Quick check is a 13-field retype, triggered late**
- **What:** A banner promises a review "when you register". Tapping any Register then opens a full form above the list, scrolled into view. The form holds 13 required fields, a re-signature and an attestation. Its button, "Confirm & register", doesn't name the class.
- **Why it matters:** Most answers don't change year to year. Retyping and re-reading 13 fields on a phone is the slowest path for the most loyal families.
- **Fix:** When the selected camper needs confirmation, show it *first*, before the classes, as a read-only summary in three groups (Camper, Contacts, Health), each with "Change". Then the signature and attestation. The button reads "Details are right" and leads straight to class choice. The register button later names the class and week.
- **Command:** `/impeccable distill`, then `/impeccable onboard`

**[P2] Status redundancy and decorative chrome**
- **What:**
  - Eli's waitlist status appears five times.
  - Noor shows the "Not enrolled" chip and then "Not enrolled in any class yet" (`StudentCard.tsx:411-420`).
  - Initials discs indent every card 56px on a 375 screen.
  - Every update repeats the same megaphone disc (`UpdatesFeed.tsx:64-66`).
  - The eyebrows have icons.
  - The countdown has a gold icon disc (`RegistrationCountdown.tsx:28`).
  - Cards use border plus shadow.
- **Why it matters:** "Justify every div". Each repeat dilutes the real signal and costs scroll.
- **Fix:** Use one status per registration. Cut the rollup badge, the avatar discs, the identical icon discs and the eyebrows (use plain h2s). Cards get a border only.
- **Command:** `/impeccable distill`, then `/impeccable quieter`

**[P2] High-stakes moments lack their next step**
- **What:**
  - The offer has no relative time and is buried.
  - The waitlist's only action is "Leave the waitlist".
  - The success screen lacks class details and "Register another camper".
  - "Change request sent. The camp will email you." is fine but 12px muted.
- **Fix:**
  - Pin offers to the top of Home with "Claim by Fri 7:00 PM · 9 h left" and Claim/Decline buttons in place.
  - Under a waitlist chip, explain the flow in one line: "If a seat opens we hold it for you for 48 hours. Watch the bell and your email." (Check the email claim is true first.)
  - Success shows class, week, days, time and room, with a gold "Register another camper" and a secondary "Go to Home".
- **Command:** `/impeccable clarify`, then `/impeccable onboard`

**[P2] Undersized targets on the self-service controls**
- **What:**
  - "Switch class", "Cancel this spot", "Leave the waitlist" and "Request a change" are 12px text on `min-h-6` (24px) targets (`StudentCard.tsx:148-158`).
  - The bell and theme buttons are about 34px (`ParentLayout.tsx:77`, `ParentBell.tsx:116`).
  - The InlineConfirm buttons are h-9.
  - The ethnicity chips are about 30px.
- **Fix:** Make all of them 44px, and use 14px text-buttons with a visible underline or secondary style.
- **Command:** `/impeccable adapt`

**[P2] Settings aren't under the avatar**
- **What:** The avatar menu holds a "Parent" role pill (with a heart icon) and Sign out (`ParentLayout.tsx:97-112`). Contact details are a card at the foot of Home (`ParentDashboard.tsx:187`). The theme toggle takes a top-bar slot.
- **Fix:** The avatar menu should hold the name and email, "Your contact details" (an inline page, not a modal), a Dark mode switch and Sign out. Cut the role pill.
- **Command:** `/impeccable layout`

**[P2] The bell lists news before actions, and some items aren't news**
- **What:**
  - The three "From camp" posts (duplicating Home) come before "Your campers".
  - The informational lines "Maya's spot … is confirmed" and "Eli is on the waitlist" count as entries.
  - The offer links to `/parent` top.
- **Fix:** Show items that need action first. Replace the posts with "3 new updates → Updates". Drop the state-only lines. Deep-link each item to its card anchor.
- **Command:** `/impeccable distill`

**[P3] Rendering slips**
- **What:**
  - The empty "later" `<ul>` band (`ThisWeekCard.tsx:92-103`).
  - The "Today's roll calls…" placeholder before camp starts (`RollCallStatus.tsx:8` via `ThisWeekCard.tsx:86`).
  - `cfg.note` is always null, so it is dead code (`StudentCard.tsx:20-27, 450-452`).
  - The success screen's `min-h-screen` sits inside the shell (`ParentRegistrationPage.tsx:580`).
  - The 2-column email field truncates at 375 ("demo.parent@examp", step 2 `:760-768`).
- **Command:** `/impeccable polish`

**[P3] Heading outline**
- **What:** Classes has no h1 (course names are the first h2s). The wizard has no h1. On Home, the camper `h3`s fall under the "Updates from camp" `h2`.
- **Fix:** One h1 per screen. Home's h2s become "Needs you", "Your campers" and "This week".
- **Command:** `/impeccable audit`

**[P3] Terminology drift**
- **What:** Student vs camper. Waitlisted, On waitlist and "on the waitlist". "Add camper" leads to a 5-step registration. "Partly waitlisted". "Not enrolled".
- **Fix:** Use "camper" everywhere. Use "On the waitlist". Rename the button "Register a new camper". Use "Not registered yet".
- **Command:** `/impeccable clarify`

**[P3] Banned or off-system details**
- **What:** The toast's `border-l-4` side stripe (`ClassBrowser.tsx:393`). The "⚠" glyph as an icon (`ParentRegistrationPage.tsx:951`). The "Almost full" fill in `--warning` renders as muddy olive on cream. The selected session card stacks a gold border, a brand-soft fill and a checkbox (`:872`), three signals for one state.
- **Command:** `/impeccable quieter`, then `/impeccable polish`

---

## 7. Persona red flags

**Jordan (first-timer).**
- Sees "Browse classes" and "Add camper" side by side, taps Browse classes, and finds the camper dropdown lacks the new child. There is no path from there to registration: a dead end.
- Reads "JAVA-1 · W1 · 6 / 14" and can't tell whether 6 is seats taken or left.
- The Quick check banner says "we'll ask you to review them when you register", so Jordan looks for a review button that doesn't exist until Register is tapped.
- Step 1's heading says "Student information" under a step called "Camper".
- On Eli's card the only offered action is "Leave the waitlist". Jordan doesn't know whether to wait, call or email.
- After registering from Classes, the only confirmation vanishes in 4 seconds.

**Sam (screen reader / keyboard / zoom).**
- The Quick check's Yes/No buttons have no `aria-pressed` and no group label (`ConfirmOnboardingPanel.tsx:144-148, 189-193`), unlike the wizard's.
- Its error is neither announced nor associated.
- At 200% zoom the wizard's bottom-of-form error is off-screen while focus sits on the field.
- The heading outline nests the camper cards under "Updates from camp".
- The bell and theme buttons are about 34px.
- The browser's "eligible sections are highlighted in green" claims a colour key, although the chips do carry text.
- The 4-second toast removes error text before it can be re-read.

**Casey (one-handed, interrupted).**
- No tabs on the phone.
- Every input zooms.
- The offer's Claim button is about 1,700px down.
- Cancel and switch are 24px targets.
- The toast sits at `bottom-6`, under iOS Safari's toolbar zone.
- The ethnicity chips are about 30px and tightly packed.
- The good news: the draft survives an app switch on the same device.

**Opening-night parent (7:00 PM, iPhone SE 375×667, two kids).**
- At 6:50 she follows the countdown's "add your campers now", fills steps 1–3 for kid 1, and is stopped at step 4.
- At 7:00 Home's countdown just disappears. She re-enters the wizard via "Continue" on the draft banner (good).
- Each field tap zooms.
- Step 4 shows names, ages and seats but not times, and says camp runs 8–4.
- On step 5 both signature boxes look filled. She taps Submit and gets an error at the bottom.
- The success card offers only "Back to dashboard". She taps "Add camper" and retypes everything for kid 2 except the parent contacts: laptop, lunch, how-heard, prior program, candy and both signatures.
- Total: roughly 40 field interactions and 12 Next/Submit taps, during which the seat count she saw at step 4 for kid 2 may no longer hold.
- A sticky 64px ink bar plus Safari's chrome leaves about 540px of working height.

---

## 8. Element-justification inventory

Legend: **Keep** (it has a job) · **Cut** (no job) · **Merge** (duplicates another element's job) · **Change** (it has a job but does it badly).

### Shell: `ParentLayout.tsx`, `ParentBell.tsx`
- Ink top bar, sticky, 64px (`ParentLayout.tsx:61`): **Keep**. It carries the brand; reduce to 56px and add `env(safe-area-inset-top)`.
- Wordmark image (`:62`): **Change**. Make it a link to Home; keep it at h-8 (it meets the 140px minimum).
- Nav Home / Browse classes, hidden under 640px (`:53-71`): **Change**. Visible top tabs at all widths: Home · Classes · Updates.
- Nav icons, Home and GraduationCap (`:66, 69`): **Cut**. The labels are enough, and tabs read cleaner without icons at 375.
- Theme toggle in the bar (`:74-80`): **Merge** into the avatar menu as a "Dark mode" switch.
- Bell button, about 34px (`ParentBell.tsx:112-120`): **Change**. 44px target.
- Bell gold dot (`:119`): **Keep**. Gold on ink is a legitimate unread signal.
- Bell "From camp" eyebrow and 3 posts (`:123-136`): **Merge** with the Updates tab. Replace with "N new updates →".
- Bell "Your campers" eyebrow (`:138`): **Cut**. With actions only, no label is needed.
- Bell action rows (`:65-91`): **Keep**, ordered first, linking to card anchors (the offer currently links to `/parent`, `:79`).
- Bell info rows "is on the waitlist" and "is confirmed" (`:92-105`): **Cut**. They are state, not news; Home shows them.
- Bell row icon discs (`:152`): **Change**. Keep a 16px tone icon and drop the disc.
- Avatar button with gold `ring-2` (`ParentLayout.tsx:91`): **Change**. The ring is decoration; keep the initials and drop the ring.
- Avatar menu "Parent" role pill with heart (`:101-103`): **Cut**. Parents have one role.
- Avatar menu name (`:100`): **Keep**, and add the email beneath.
- Avatar menu Sign out (`:105-110`): **Keep**, at 44px rows. Add "Your contact details" and "Dark mode" above it.
- Footer camp email (`:123-126`): **Keep**. It is Principle 1's safety net and becomes reachable once pages are short.

### Home: `ParentDashboard.tsx`
- Page padding `py-10` (`:84`): **Change** to py-5 on mobile.
- h1 "Welcome, Taylor" at 32/40px (`:87-89`): **Change**. Shrink to a 22–24px "Hi, Taylor". The greeting is warmth, not content.
- Status subhead in Slab (`:90`, `buildSubhead`): **Keep**. It is the one-line answer. It becomes the only rollup.
- Header "Browse classes" secondary (`:96-102`): **Cut**. The Classes tab and the per-camper "Register" replace it.
- Header "Add camper" gold primary (`:104-110`): **Change**. Rename it "Register a new camper" and place it after the campers list as the page's single gold button.
- RegistrationCountdown (`:114`): **Keep**, but change the copy (§6) and add an at-open state.
- Draft banners (`:116-138`): **Keep**, in the "Needs you" group; button h-10 → h-11.
- ThisWeekCard (`:140-144`): **Change**. Show it only within 7 days of a session or during one.
- "Updates from camp" card with eyebrow and megaphone (`:146-151`): **Merge** into the Updates tab.
- Loading skeleton (`:153-157`): **Keep**.
- Empty state: icon disc, "No campers yet", "Add your first camper to get started." (`:159-172`): **Change**. The line duplicates the subhead (`:25`). Keep one, and keep the icon chip (DS §7.10).
- StudentCard list (`:174-184`): **Keep** and move it to the top under the "Your campers" h2.
- ContactDetailsCard (`:187-189`): **Merge** into the avatar menu's "Your contact details".

### This week: `ThisWeekCard.tsx`, `DailySchedule.tsx`, `RollCallStatus.tsx`
- Card with border and shadow (`ThisWeekCard.tsx:46`): **Change** to border only.
- Calendar icon disc (`:48-50`): **Cut**.
- "Next up · Week 1" heading and Slab dates (`:52-55`): **Keep**.
- "Starts in 2 days" / "Happening now" chip (`:57`): **Keep**. The relative time is reassuring.
- Per-camper rows (`:61-89`): **Keep** during camp week. Otherwise **Merge** into the camper rows, which already show class, time and room.
- Clock, MapPin and User micro-icons (`:80-82`): **Cut**. "Room 202" and "Lead: Fiona" are self-labelling.
- "Times and room will be posted here." (`:83`): **Keep**. It is an honest empty value.
- RollCallStatus chips (`RollCallStatus.tsx:11-24`): **Keep**. This is the camp-week reassurance.
- RollCallStatus placeholder (`:8`): **Change**. Render it on camp days only.
- "Also in …" later list (`ThisWeekCard.tsx:92-103`): **Change**. It renders an empty band; render only when it has items.
- Daily schedule block on a sunken band (`:105-110`): **Change**. Make it a collapsed `<details>` "Daily schedule · 8:30 AM – 3:30 PM".
- ScheduleHeading eyebrow with clock (`DailySchedule.tsx:28-33`): **Cut** the eyebrow style and icon; the disclosure label replaces it.

### Camper card: `StudentCard.tsx`, `MedicalFlag.tsx`, `InlineConfirm.tsx`
- Card container with border, shadow and overflow (`StudentCard.tsx:396`): **Change** to border only.
- Initials disc (`:399-401`): **Cut**. It costs 56px of width on 375, and the parent knows the child.
- Name h3 (`:406`): **Keep**. Make it 18px (DS h4).
- "Age 12" (`:407`): **Change** to "Entering 7th". Eligibility is grade-based and age is derived from grade.
- "Medical" danger chip (`:408`, `MedicalFlag.tsx:13-22`): **Change**. To a parent, red "Medical" reads as an alarm about their child. Use a neutral chip "Health info on file" and keep the expand and the footnote (`MedicalFlag.tsx:26`), which is the trust signal.
- Rollup badge "All set" / "On waitlist" / "Not enrolled" (`:411-416`): **Cut**. It duplicates the per-class chip and the subhead.
- "Not enrolled in any class yet" (`:420`): **Merge** with the Register action: "Not registered yet · Register for Week 1".
- Per-registration status chip (`:432-437`): **Keep**. It is the canonical status.
- Class line "Web Development · WEB-1 · Week 1" (`:438-442`): **Change**. Cut the section code and lead with the week: "Week 1 // Web Development".
- Days, time and room line (`:444-449`): **Keep**.
- `cfg.note` line (`:450-452`): **Cut**. It is dead.
- Action links "Switch class" / "Cancel this spot" / "Leave the waitlist" / "Request a change" (`:146-160`): **Change**. Make them 44px text-buttons at 14px.
- Deadline caption (`:161-165`): **Keep**. Make it 13px, `ink-muted`.
- Offer panel (`:107-135`): **Change**. Promote it to Home's "Needs you", with a relative countdown, and drop the Sparkles icon (`:26, 39`).
- "Cancelled by camp" note and link (`:454-462`): **Keep**. It is a model "no dead end" line.
- Change-request form (`:186-197`): **Keep**, with a 16px textarea.
- SwitchClass picker (`:206-294`): **Keep**. It shows spots left and a full-class explanation, which is good.
- InlineConfirm danger strip with TriangleAlert (`InlineConfirm.tsx:24-56`): **Keep**, with buttons h-9 → h-11.
- Footer band, sunken with border, holding "Edit camper" and "Register for another class" (`:476-493`): **Change**. It wraps to two rows on 375 and doubles the footer. Use one row of two text-buttons with no band: "Edit details" and "Register for a class".
- CamperEditor, 3-column grids with 14px h-10 inputs (`:342-375`): **Change**. 16px h-11, single column on mobile.

### Countdown: `RegistrationCountdown.tsx`
- brand-soft panel with border (`:27`): **Keep**. This is a legitimate "Committed" moment.
- Gold icon disc (`:28-30`): **Cut**.
- Headline "Registration opens … (Denver time)" (`:32`): **Keep**.
- "Spots are first come… add your campers now" (`:37`): **Change**. The copy is untrue (§6).

### Classes: `ClassBrowser.tsx`, `CapacityMeter.tsx`, `ConfirmOnboardingPanel.tsx`
- "Back to dashboard" (`ClassBrowser.tsx:215-220`): **Cut**. Tabs replace it.
- Missing h1: **Change**. Add "Register for a class".
- Closed notice (`:222-226`): **Keep**.
- Camper `<select>` with "Select a camper to enroll…" (`:231-241`): **Change**. Use segmented camper chips (3 kids or fewer); keep a select for 5 or more.
- Search courses (`:243-254`): **Cut**. Four courses don't need search.
- Gold eligibility banner, "highlighted in green" (`:258-262`): **Cut**. The row reasons do the job, and the banner relies on colour.
- Countdown (`:265`): **Keep**.
- Info "Quick check before you register…" banner (`:267-275`): **Merge** into the Quick check, shown first.
- Warning-yellow "Select a camper above…" (`:296-300`): **Cut**. Preselect the first camper, or use neutral helper text.
- Course h2 in Slab and its description (`:328-331`): **Keep**.
- `requirementNote` info pill (`:332-336`): **Merge**. It repeats the Microcontrollers description almost verbatim.
- Section card as a bordered, shadowed card (`:68`): **Change** to a radio row.
- Section code label "JAVA-1" (`:51, 70`): **Cut** for parents. Replace it with days, time and room.
- "W1/W2" chip (`:52-54, 71-73`): **Cut**. Group by week instead.
- Fit chip "Ages 11–14 · Noor Brooks fits" (`:76-80`): **Cut** when the camper fits (fitting is the default). Show reasons only for exceptions.
- Locked card at full size with capacity bar (`:47-64`): **Change**. Collapse to "2 classes aren't open to Noor ▸" with the reasons.
- CapacityMeter bar and "6 / 14" (`CapacityMeter.tsx:17-34`): **Change** for parents. Show "8 spots left" / "1 spot left" / "Full · join the waitlist" in words and drop the bar. The admin view keeps it.
- Per-card gold "Register {name}" (`ClassBrowser.tsx:101-109`): **Merge** into one gold submit naming the class and week.
- "Already in Web Development this week" (`:96-99`): **Keep** as the reason line in the week group header: "Noor is in Web Development this week".
- Registered status row "Confirmed · Maya Brooks" (`:84-92`): **Change**. Use the same chip component as the camper card.
- Toast, bottom-right, `border-l-4`, 4 seconds (`:392-399`): **Change**. Show the result inline and persistently on the row. Errors never auto-dismiss. No side stripe.
- Quick check panel header with ShieldCheck, title and explainer (`ConfirmOnboardingPanel.tsx:111-118`): **Keep** the title; shorten the explainer to one line.
- Quick check: 13 editable fields at once (`:120-199`): **Change**. Show a read-only summary in three groups, each with "Change".
- Yes/No toggle buttons (`:144-148, 189-193`): **Change**. Add `aria-pressed` and a group label, as the wizard has.
- "Re-sign as guardian" (`:196-199`): **Keep**.
- Attestation checkbox in a sunken box (`:201-206`): **Keep**. Make it 24px in a 44px row.
- Bottom error block (`:208-210`): **Change**. Field-level, `role="alert"`, with focus.
- "Cancel" / "Confirm & register" (`:213-226`): **Change**. "Details are right" leads to class choice; the class is confirmed later with its name.

### Wizard: `ParentRegistrationPage.tsx`
- "Back to dashboard" (`:657-662`): **Change**. "Save and exit"; the draft is real.
- StepDots, `aria-hidden` (`:122-132, 663`): **Merge** with the step label into one segmented progress bar.
- "Step 1 of 5: Camper" (`:664`): **Keep** as the visible label, and make it the step's h1 too.
- Per-step h2 that differs from the step name (`:677, 755, 792, 855, 920`): **Merge** into that h1.
- "Picked up where you left off… Start over" (`:665-670`): **Keep**.

Step 1, Camper:
- First and last name (`:679-690`): **Keep**. Change the placeholders "Jane"/"Smith", which read as values.
- Student email (`:691-695`): **Keep**; it is admin-configured.
- School district (`:696-702`) and school name (`:703-707`): **Keep**.
- Grade and shirt size (`:708-723`): **Keep**.
- Laptop yes/no (`:724-730`): **Keep**.
- Ethnicity chips (`:731-743`): **Change**. Move into a collapsed "Optional: for grant reporting" group, with 44px chips.
- Gender (`:744-748`): **Change**. Same optional group.

Step 2, Contacts:
- Parent name, email and phone (`:756-769`): **Change**. When prefilled, show a summary with "Edit". Give email full width at 375, since it truncates now.
- `<hr>` (`:770`): **Cut**. Spacing does its job.
- "Emergency contact" h3 (`:771`): **Keep**.
- Emergency fields (`:772-785`): **Change**. Same prefilled-summary treatment.

Step 3, Health and details:
- Allergies and medical textareas (`:793-800`): **Keep**, at 16px with "e.g. None, peanuts" examples.
- Other info (`:801-804`): **Keep**.
- Lunch yes/no and provision (`:805-818`): **Keep**.
- How heard, previous program and candy consent (`:819-848`): **Change**. Move them under a "A few more questions" sub-heading after the health block.
- 16px checkboxes (`:814, 844`): **Change**. 24px checkboxes in 44px rows.

Step 4, Week and class:
- Countdown (`:856`): **Keep**.
- "Camp is held at Cherry Creek High School, 8–4" (`:857`): **Cut**, or source it from data.
- Session card with checkbox, gold fill and border (`:872-877`): **Change**. Use one selection signal (the border) and the week as a toggle.
- Class radio rows showing ages and spots left (`:885-906`): **Keep**, and add days, time and room (existing data).
- Locked rows with Lock icon and reason (`:899-901`): **Keep**, but collapse them when there are more than 2.

Step 5, Review and sign:
- Nested-scroll waiver box, 12px muted (`:922-931`): **Change**. Use the full-height text at 15px, with headings in sentence case. Legal text is still pending from national.
- Two signatures whose placeholders equal the expected names (`:933-945`): **Change**. Remove the placeholders, put the name in the label, and keep the helper text.

Errors, actions and outcomes:
- Error `<p>` with "⚠" (`:949-954`): **Change**. Inline per field, with a Lucide icon.
- Back/Next row (`:956-979`): **Keep** in flow; no sticky bar, because of Safari's toolbar.
- Success card (`:578-603`): **Change**. Add the class, week, time and room, plus a gold "Register another camper" and a secondary "Go to Home". Drop `min-h-screen`.
- Closed and prefill-error screens (`:606-652`): **Keep**.

### Not in parent scope
`HistoryStrip.tsx` and `ClassCard.tsx` are not used on any parent route (`HistoryStrip` is used only by `AdminStudents` and `AdminClasses`; `ClassCard` by nothing). There is nothing to justify here. `ClassCard` looks orphaned.

---

## 9. Redesign direction (for the mockup)

Global rules:
- Mobile-first at 375 in both light and dark.
- Top tabs, no bottom bars.
- 16px inputs and 44px targets.
- No modals. Inline disclosure and confirms only.
- No new capabilities.
- Gold is reserved for one primary per view and for the brand bar accents. Gold text never sits on cream.
- Cards use a 1px border, no shadow, and a 12px radius.
- Plain sentence-case h2s replace the eyebrows.
- Meta separator: ` // ` (from the wordmark), used consistently.
- Status chip vocabulary: **Confirmed** (success), **On the waitlist** (info), **Spot offered** (brand-soft), **Cancelled / Cancelled by camp** (danger).

### Shell
- **375:** an ink bar (56px plus safe area) with the wordmark (a link Home) at left and bell (44px) and avatar (44px) at right. Directly beneath, a second ink row with three equal top tabs: **Home · Classes · Updates**, 44px tall, label-only, with the active tab marked by a 2px gold underline and white text.
- **Desktop:** tabs sit inline after the wordmark in a single 64px bar. Content is capped at 1040px.
- **Avatar menu (inline popover, not a modal):** name and email; "Your contact details" (goes to an inline page holding the existing ContactDetailsCard form); "Dark mode" switch; "Sign out".
- **Bell:**
  - items needing action, max 3: offer, Quick check, class cancelled by camp, each deep-linked to its card
  - one row "3 new updates → Updates"
  - "Nothing needs you right now" when empty
- Removed: the theme button in the bar, the role pill, the state-only bell lines, posts inside the bell.

### Home (`/parent`)

**375, top to bottom:**

1. **"Hi, Taylor"** (22px sans), followed by the status sentence (Slab, 17px, ink-muted). Copy example: "Maya is set for Week 1. Eli is on the waitlist. Noor isn't registered yet."

2. **Needs you.** Shown only when something does, at most 3 rows. Each is a bordered row with a one-line headline and one primary-sized control inline.
   - Offer, on a brand-soft fill: "**A spot opened for Eli in Intro to Python, Week 1.** Claim by Fri 7:00 PM · 9 h left", with [Claim the spot] in gold and [Decline] as a text-button. This is the view's only gold when present.
   - Quick check: "**Confirm Noor's details for 2026** before registering. It takes about a minute." with [Review].
   - Draft: "**Finish registering Sam.** Step 4 of 5, saved on this phone." with [Continue] and [Discard].
   - Pre-opening, the countdown takes this slot: "**Registration opens Sat, Feb 6 at 7:00 PM** (Denver) · in 2 h 14 min. Have each camper's grade, school, allergies and an emergency contact ready." At opening it becomes "**Registration is open.**" with [Register a camper].

3. **Your campers** (h2). One bordered block per camper, no avatar, with the signature **week strip**:
   ```
   Maya Brooks                      Entering 7th · Health info on file ▸
   Week 1  ✓ Confirmed   Web Development // Mon–Fri 9–3 // Room 202
   Week 2  Not registered                                  Register ›
   Online changes closed Oct 4 · Request a change
   ```
   - Each week line holds the chip, the class and the meta. The actions for that registration (Switch class, Cancel this spot, Leave the waitlist) sit as 44px text-buttons under the line. A waitlist line adds: "If a seat opens we'll hold it for you for 48 hours."
   - The card foot is one row: [Edit details] · [Register for a class], with no sunken band.
   - Collapsed height is about 120px per camper, so three campers fit on one screen.

4. **This week** (h2). Shown only within 7 days of a session or during it.
   - "Week 1 // Oct 19–23 // Starts Monday", with one line per confirmed camper: "Maya, Room 202, Lead Fiona".
   - Roll-call chips on camp days only.
   - `<details>` "Daily schedule · 8:30–3:30", collapsed.

5. **[Register a new camper]**: full-width gold, the page's only gold when no offer is present.

6. Footer: the camp email.

- **Desktop:** two columns at ≥1024. On the left (7/12): Needs you, then Your campers. On the right (5/12): This week with the schedule open, then "Latest from camp" (the newest update, linking to the Updates tab). The h1 row carries "Register a new camper" at the right.
- **Removed:** the Browse classes button, the Updates feed, the contact card, initials discs, the rollup badges, the calendar and megaphone discs, the eyebrows, the empty "later" band, and the pre-camp roll-call placeholder.

### Updates (`/parent` tab or `/parent/updates`)
- h1 "Updates from camp". A plain list where each item shows author bold // audience // time on the meta line, then the body at 16px. No icon discs and no Users icon.
- The empty state copy stays as is.
- Desktop: a 680px reading column.

### Classes (`/parent/classes`, honours `?camper=`)
- **375:**
  1. h1 "Register for a class". The closed notice or countdown appears here only when applicable.
  2. **Camper chips** (a segmented control of 3 or fewer, preselected from `?camper=` or the first camper), with a link under them: "New camper? Register a new camper".
  3. **If the camper needs the yearly check**, it appears here *before* any class:
     - "**Confirm Noor's details for 2026**", with "Camp needs current info every summer."
     - Three read-only groups (Camper: name, grade, shirt, laptop. Contacts: parent and emergency. Health: allergies, medical, lunch), each with a [Change] text-button that expands that group's fields in place.
     - Then "Re-sign as guardian" and the attestation.
     - [Details are right] in gold.
     - The class list stays dimmed and non-interactive until this is done, with the reason stated.
  4. **Week toggle**: "Week 1 · Oct 19–23 | Week 2 · Oct 26–30". If the camper already holds a seat that week, the group header says "Noor is in Web Development this week. Change it from Home." and the rows are disabled.
  5. **Class radio rows**, grouped by course name with the description in one muted line: "Intro to Python // Mon–Fri 9–3 // Room 101 // 7 spots left". A full class reads "Full · you'll join the waitlist". Ineligible classes collapse into one line, "2 classes aren't open to Noor ▸", which expands to "Microcontrollers: entering grades 7–9" and similar.
  6. One gold button, which appears once a row is selected: "**Register Noor for Intro to Python, Week 2**" (or "Join the waitlist for…").
  7. The result replaces the button inline and stays: "✓ Noor is in. Intro to Python // Week 2 // Mon–Fri 9–3 // Room 101", with [Register another camper] · [Go to Home]. Errors stay inline until dismissed.
- **Desktop:** a single 720px column. This is a task, not a catalogue.
- **Removed:** Back to dashboard, search, the eligibility and "select a camper" banners, the info notice, section codes, W chips, capacity bars, fit chips, repeated gold buttons, the toast and its side stripe.

### New-camper wizard (`/parent/register`)
Shared frame at 375:
- "Save and exit" text link at top-left.
- **One progress element**: a 5-segment bar plus an h1 "Step 2 of 5 · Week and class".
- Fields are single-column at 375 (two-column only for first/last name and for grade/shirt). All controls are 16px and 44px tall.
- Errors appear under the field with a Lucide alert icon and a red border. A summary at the bottom shows only when the field is off-screen.
- Back and Next sit in flow.
- Desktop: a 560px column with the same structure, and the progress bar shows step names.

- **Step 1 · Camper**:
  - first and last name (no name-like placeholders)
  - student email
  - school district and school name
  - grade (label: "Grade this fall") and shirt size
  - "Can Sam bring a laptop each day?" Yes/No
  - a collapsed `<details>` "Optional: for grant reporting" holding the ethnicity chips (44px) and gender
- **Step 2 · Week and class** (moved up, same component as the Classes tab):
  - week toggle → radio rows with days, time, room and spots left
  - a "Camp runs Mon–Fri. Times are listed per class." line only if it can be sourced from data
  - honest note: "Seats are held when you submit on step 5."
  - Before opening: rows are visible and selectable, and the countdown sits above them.
- **Step 3 · Contacts**:
  - when prefilled, a read-only summary: "Taylor Brooks // demo.parent@… // 303-555-0199" and "Emergency: Morgan Brooks (Aunt) // 720-555-0199", with [Edit] expanding the fields in place
  - when empty, the fields, with email full width
- **Step 4 · Health and a few questions**:
  - allergies and medical (label: "Allergies or dietary needs", helper: "Write 'None' if there aren't any")
  - other info
  - lunch Yes/No, plus provision
  - then the sub-heading "A few more questions": how heard, previous program (+ which), candy consent as a 24px checkbox in a 44px row
- **Step 5 · Review and sign**:
  - a compact summary: Sam Brooks // entering 6th // Week 1: Intro to Python, with [Edit] per step
  - the waiver text inline at 15px, not nested-scrolling
  - "Type Sam's full legal name" and "Type your full legal name" (no placeholders)
  - gold [Register Sam]. Before opening it is disabled with "Opens 7:00 PM · in 3 min · your answers are saved", which requires the step-4 gate to move to Submit (flagged in §10).
- **Success** (inside the shell, not full-screen):
  - h1 "Sam is in!" or "Sam is on the waitlist"
  - one line with the class // week // days // time // room
  - waitlist variant: "If a seat opens we'll hold it for 48 hours and let you know."
  - gold [Register another camper] (goes to the wizard with the parent details already saved), then secondary [Go to Home]
- **Copy changes**:
  - "Student information" → "Camper"
  - "Medical & miscellaneous" → "Health and a few questions"
  - "Submit registration" → "Register Sam"
  - "⚠ First name is required" → "Enter Sam's first name"
  - "Back to dashboard" → "Save and exit"

---

## 10. Minor observations and questions

**Minor observations**
- `--ink-muted` (#665A4C) and `--ink-faint` (#766959) are almost indistinguishable on cream. Two grey levels that look the same add noise; use one secondary grey for parents.
- In dark mode, card footers (`bg-surface-sunken`) are darker than the card and nearly as dark as the page, so the elevation reads inverted. This disappears once the footer band is cut.
- "Student's preferred email *" is required for rising 4th graders. It is admin-configurable, but question the default.
- The waiver text names "Denver Summer Camp" and bundles the photo release. The legal text is pending from national (PRODUCT.md), so the mockup should show a placeholder labelled as such and never final-looking text.
- `ClassBrowser` toasts are hard-coded 'info' for errors. Server error strings such as Postgres messages can surface verbatim (`ClassBrowser.tsx:187-189`, `ParentRegistrationPage.tsx:541`).
- The wizard success screen counts waitlisted results per submitted section, but a both-weeks class deduplicates to one registration, so "one class / the other" copy can mislead for that case (`:589-593`).
- `ParentBell` is remounted on every path change (`key={pathname}`), which refetches 4 hooks per navigation. That is acceptable, but under opening-night load it adds requests.
- The "Partly waitlisted" rollup label is awkward. It goes away when the rollup badge is cut.
- The Yes/No toggles use a gold fill for the selected state, which is fine. Twelve gold-filled toggles across a wizard dilute the "one gold primary" rule, so consider an ink outline with a check for the selected state.
- The camper `<select>` option text "(age 9)" uses derived age. Parents know grade, so show grade.

**Questions to consider**
- What if the **camper × week strip** were Home? Every status, the one-class-per-week rule and every next action would sit in one 120px block per child.
- Should a returning camper ever see a separate class browser, or should "Register for a class" open the same week/class step the wizard uses? This is the plan's Q-P1, and two pickers are the root of most consistency debt here.
- Could the yearly Quick check be "Nothing changed? Sign and continue" in one screen, with "Change" per group as the escape hatch?
- Why does a parent type the *student's* signature? If national's waiver needs only the guardian's, cut one field from every registration.
- Is the daily schedule useful to a parent eight months before camp, or only in the week it applies?
- Should the step-4 "not open yet" gate move to the Submit button, so the countdown's promise ("get ready now") becomes true without any new capability?
- Does the waitlist position exist in data the parent may read under RLS? If yes, "#2 in line" is the single most reassuring line the waitlist could show. If not, say "We'll offer seats in the order families joined."
