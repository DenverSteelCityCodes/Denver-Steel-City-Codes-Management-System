// Parent screens for the mockup hub. Each note justifies the screen against raw/A-parent.md.
window.SCC_SCREENS = window.SCC_SCREENS || [];
window.SCC_SCREENS.push(
  { file: 'parent-home.html', role: 'Parent', title: 'Home', state: 'Week 1 starts Monday', replaces: '/parent',
    notes: [
      'Sign: the one next decision. Noor needs a class: confirm her details, then pick one, with the number that makes it urgent (21 spots left in the Week 1 classes that fit her). Maya is already set, so her room moved onto her own Week 1 line.',
      'A-parent P1 "Home inverts priority": the decision first, then campers, then this week. Updates moved to their own tab; contact details went under the avatar.',
      'The camper × week strip shows one status per registration. Cut: rollup badges, initials discs, icon eyebrows (P2 status redundancy).',
      'The 8-row daily schedule is folded into a disclosure. Latest from camp is one line that points to Updates.',
      'The waitlist line says what happens next (48 h hold, email), so "Leave the waitlist" is no longer the only act (P2 next step).',
      'Top tabs at every width with a 44px avatar (P1 no phone nav). The bell was cut: it opened the same posts as the Updates tab, so the unread marker now sits on that tab. Register a new camper sits after the campers.'
    ] },

  { file: 'parent-home-offer.html', role: 'Parent', title: 'Home: spot offered', state: 'A waitlist seat is held for Eli, 9 h left', replaces: '/parent (offer panel in the camper card)',
    notes: [
      'A-parent P2 "High-stakes moments": the offer becomes the sign, with the relative clock (9 h) and the deadline. It used to sit in a camper card about 1,700px down.',
      'Claim is the ink button on the sign. Decline is a text button with an inline confirm that names the consequence. No modal.',
      'Claiming flips the figure to Room 101 with the split-flap swap, and Eli\'s week line turns to Confirmed in place.',
      'Sparkles icon cut. The week strip says "Spot offered" once and links back to the sign.',
      'The window is 12 h because Week 1 is in its final week (48 h otherwise, per PRODUCT.md).'
    ] },

  { file: 'parent-home-opening.html', role: 'Parent', title: 'Home: before opening', state: 'Registration opens at 7:00 PM, in 2 hours', replaces: '/parent (RegistrationCountdown)',
    notes: [
      'A-parent P1 "Opening-night copy isn\'t true": the old countdown said "add your campers now" while step 4 blocked Next. The sign now says only what is true and what to have ready.',
      'Proposed change (A-parent §6 P1 and §10): the wizard should let parents fill in every step before opening and gate only the final Register button ("Opens 7:00 PM · your answers are saved"). This screen shows that promise; shipping it means moving the step-4 gate to Register.',
      'At 7:00 the sign should turn into "Registration is open" with Register a camper, instead of disappearing (P1 c).',
      'Campers collapse to one line each. This summer lists the weeks and which classes fit which ages, so families decide before the rush.',
      'No yellow button: the sign holds the time; the two preparations are ink.'
    ] },

  { file: 'parent-updates.html', role: 'Parent', title: 'Updates', state: 'Three posts from camp', replaces: '/parent (Updates card) and the posts inside the bell',
    notes: [
      'A-parent P1: Updates moved off Home into their own top tab.',
      'A plain list: author // audience // time, then the post at 16px. Megaphone discs, eyebrows and the Users icon cut (P2 decorative chrome).',
      'Section codes cut from audiences ("Web Development, Week 1", not "WEB-1").',
      'No sign: nothing here needs a decision.'
    ] },

  { file: 'parent-contact.html', role: 'Parent', title: 'Your contact details', state: 'From the avatar menu; #maya, #eli, #noor open that camper', replaces: '/parent ContactDetailsCard and the camper card\'s CamperEditor',
    notes: [
      'A-parent P2 "Settings aren\'t under the avatar": contact details are a page reached from the avatar menu, not a card at the foot of Home.',
      'Home\'s per-camper Edit links land on #maya, #eli or #noor and open that camper\'s fields in place. No modal.',
      'Every field is 16px and 48px tall (P1 14px inputs). Single column at 375 except short pairs; the email gets full width (P3 truncation).',
      'Health facts are plain words, not a red "Medical" chip that reads as an alarm to a parent (A-parent §8).',
      'Saves are ink: a page of equal forms has no single primary action.'
    ] },

  { file: 'parent-classes.html', role: 'Parent', title: 'Register for a class', state: 'Noor, after her yearly check', replaces: '/parent/classes',
    notes: [
      'A-parent P1 "Two registration models": rebuilt on the wizard\'s week-and-class pattern (camper, then week, then class), the same rows as step 2.',
      'Rows give days, time, room and spots left in words. Cut: section codes, W chips, capacity bars, fit chips. A full class is ink: "Full · you\'ll join the waitlist".',
      'One gold button names camper, class and week, and appears once a class is picked (it replaces about 8 repeated gold buttons).',
      'Classes a camper can\'t take fold into one disclosure with reasons (pick Eli to see it). The eligibility, "select a camper" and info banners are cut.',
      'Rules are shown, not errored: Maya\'s taken week and Eli\'s waitlisted week say why and give the way out.',
      'Camper preselected from ?camper= or #name; "New camper?" links to the wizard (Jordan\'s dead end, §7).'
    ] },

  { file: 'parent-classes-quickcheck.html', role: 'Parent', title: 'Yearly check', state: 'Confirm Noor\'s details for 2026, before her class', replaces: '/parent/classes ConfirmOnboardingPanel',
    notes: [
      'A-parent P1 "Quick check is a 13-field retype, triggered late": it now comes first, as a read-only summary in three groups, each with Change.',
      'Health is open because one answer is missing (free or reduced lunch). The other groups stay read-only.',
      'The re-sign label carries the instruction, with no name-like placeholder. The attestation is a 22px checkbox in a 52px row.',
      '"Details are right" is the one gold action and leads straight to Noor\'s classes, which wait below with the reason stated.',
      'Yes/No is the segmented control with aria-pressed and a group label (Sam persona, §7).'
    ] },

  { file: 'parent-classes-done.html', role: 'Parent', title: 'Registered', state: 'Noor is in Intro to Python, Week 1', replaces: '/parent/classes toast',
    notes: [
      'A-parent P1: the 4-second toast with its side stripe is replaced by a result that stays where the button was. Errors would stay too.',
      'It carries what a parent screenshots: class // week // days and time // room, plus drop-off.',
      'Register another camper (gold) and Go to Home: no dead end for a two-kid family (§4 peak and end).',
      'Week 2 stays one tap away on the same page.'
    ] },

  { file: 'parent-register-1.html', role: 'Parent', title: 'New camper: 1 Camper', state: 'Step 1 of 5, with one field error', replaces: '/parent/register (step 1)',
    notes: [
      'A-parent P1 "Wizard order and density": reordered to Camper, Week and class, Contacts, Health, Review and sign. No new fields.',
      'The sign is the one progress element: rail, step number and step name. The dots, "Step 1 of 5: Camper" and "Student information" are merged.',
      'The error sits under its field with an icon, a red border and aria-invalid, and names the fix. It used to sit at the form bottom (P1 errors).',
      'Optional ethnicity and gender fold into "Optional: for grant reporting"; the 30px chips become 52px checkbox rows.',
      'First/last and grade/shirt pair up at 375; everything else is one column, 16px, 48px.',
      '"Back to dashboard" becomes "Save and exit", because the draft is saved on this device.'
    ] },

  { file: 'parent-register-2.html', role: 'Parent', title: 'New camper: 2 Week and class', state: 'Step 2 of 5', replaces: '/parent/register (old step 4)',
    notes: [
      'Class choice moves from step 4 to step 2, so a parent sees whether a seat exists before typing health details (time-to-seat).',
      'The same rows as the Classes tab: days, time, room, spots left. Microcontrollers folds away with its reason.',
      'The hard-coded "Cherry Creek High School, 8:00 AM – 4:00 PM" is cut; times come from each class (P1 b).',
      'Honest note in the sign: the seat is held only when you register, at step 5.',
      'A week toggle replaces the session cards that stacked a checkbox, a gold fill and a border for one state (P3).'
    ] },

  { file: 'parent-register-3.html', role: 'Parent', title: 'New camper: 3 Contacts', state: 'Step 3 of 5, prefilled', replaces: '/parent/register (old step 2)',
    notes: [
      'Prefilled from the account and shown as a summary. Edit opens the fields in place (A-parent §9).',
      'The email gets full width when edited; it truncated at 375 before (P3).',
      'Back is a text link and Next names the next step.'
    ] },

  { file: 'parent-register-4.html', role: 'Parent', title: 'New camper: 4 Health', state: 'Step 4 of 5', replaces: '/parent/register (old step 3)',
    notes: [
      '"Medical & miscellaneous" is split: health first, then "A few more questions" (how heard, last year, candy).',
      'Helpers say "Write None if there aren\'t any" instead of a bare required star.',
      'Candy consent is a 22px checkbox in a 52px row (it was 16px).',
      'The sign carries the existing trust line: shared only with Sam\'s volunteers and camp admins.'
    ] },

  { file: 'parent-register-5.html', role: 'Parent', title: 'New camper: 5 Review and sign', state: 'Step 5 of 5', replaces: '/parent/register (step 5)',
    notes: [
      'A summary per step with Edit, so a parent checks before signing.',
      'The waiver is labelled as placeholder text pending SCC national\'s official waiver. No final-looking legal copy (PRODUCT.md), and no nested scroll box.',
      'Signature labels carry the instruction. The "Sam Brooks" / "Taylor Brooks" placeholders that looked already filled are gone (P1 error trap).',
      'The gold button names camper, class and week. Before opening it would be disabled with "Opens 7:00 PM · your answers are saved" (see Home: before opening).'
    ] },

  { file: 'parent-register-done.html', role: 'Parent', title: 'Sam is in!', state: 'Registered from the wizard', replaces: '/parent/register (success card)',
    notes: [
      'A-parent P2: success now carries room, day, time and drop-off in the sign. It used to be a card floating in a full-screen void.',
      'Register another camper is the gold action, with Go to Home beside it; the contacts carry over.',
      'Inside the shell with tabs; no min-h-screen.'
    ] }
);
