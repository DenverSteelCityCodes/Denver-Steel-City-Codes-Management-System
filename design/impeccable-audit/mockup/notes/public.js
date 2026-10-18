window.SCC_SCREENS = window.SCC_SCREENS || [];
window.SCC_SCREENS.push(
  { file: 'public-login.html', role: 'Signed out', title: 'Demo sign-in', state: 'Demo deploy, four seats', replaces: '/login',
    notes: ['Sign: the junction. "Try the demo" with the four seats as destinations, existing blurbs kept verbatim (A-public §5.2), arrows locked to the right edge.',
      'Desktop: ink column (wordmark + junction) beside the floor column (sign-in); everything above the fold at 1440×900 (A-public P2 #9: Sign in was at y≈928).',
      'Cut: "Welcome back", "Sign in to your account", placeholders, button icon, role-colour tiles, both card shells (A-public P1 #6, P2 #8).',
      '"New here?" replaces two footnotes: "Register a camper (parents)" and "Apply to volunteer", so a teen can\'t make a parent account by mistake (A-public P1 #6).',
      'Sign in is the ink button: the yellow sign arrows are the demo\'s primary, so no yellow button competes. "Forgot password?" has a 44px target (A-public P3 #12).'] },

  { file: 'public-signup.html', role: 'Signed out', title: 'Create a parent account', state: 'Empty form', replaces: '/signup',
    notes: ['Heading says whose account it is; "Your name" gets the hint "Parent or guardian" (A-public P1 #6).',
      'Lede "You\'ll add your campers after you sign in." replaces "Register to enroll your camper" (two verbs, wrong term).',
      'Placeholders cut; "At least 8 characters" is a persistent hint; Show/Hide on the password; 16px inputs (A-public P1 #2, P2 #5).',
      'No card, no button icon. One yellow action. A "Volunteering instead?" line sends teens to /apply.'] },

  { file: 'public-signup-error.html', role: 'Signed out', title: 'Create a parent account', state: 'Email already has an account', replaces: '/signup (error)',
    notes: ['The silent failure is now said out loud: "There\'s already an account with this email." under the field, with Sign in and Reset your password beside it (A-public P1 #5).',
      'Error is inline under Email with aria-invalid and aria-describedby, drawn icon instead of the ⚠ glyph (A-public P1 #3, P2 #8).',
      'Same copy and recovery as the apply form\'s existing-account case, so the two flows finally agree (A-public §2 #4).'] },

  { file: 'public-signup-sent.html', role: 'Signed out', title: 'Check your email', state: 'Confirmation sent, resend counting down', replaces: '/signup (sent)',
    notes: ['Sign: the one next step, "Open the link in that email", and what happens after it (back here to sign in, then add campers) (A-public §4 valley).',
      'Resend keeps its 60-second cooldown (live countdown in the mockup) as a 44px text button at 16px, not 12px (A-public §8).',
      'Cut: the ✓ circle tile. Heading takes focus on arrival.'] },

  { file: 'public-forgot.html', role: 'Signed out', title: 'Forgot your password', state: 'Empty form', replaces: '/forgot',
    notes: ['Copy kept: it was clear. One field, one yellow action, "Remembered it? Sign in".',
      'Cut: placeholder, Mail icon in the button, card shell (A-public §8).'] },

  { file: 'public-forgot-sent.html', role: 'Signed out', title: 'Check your email', state: 'Reset link sent', replaces: '/forgot (sent)',
    notes: ['Privacy-safe copy kept verbatim: never says whether the account exists (A-public §5.1).',
      'Sign: the figure they act on is the one-hour window; "each link works once, use the newest" moved up from the reset page.',
      '"Try again" and "Back to sign in" are 44px links; the Mail tile is cut.'] },

  { file: 'public-reset.html', role: 'Signed out', title: 'Choose a new password', state: 'From a valid link', replaces: '/reset',
    notes: ['As is, minus the KeyRound icon and the card (A-public §9 /reset).',
      'Plain labels "New password" / "Type it again", 16px inputs, rule stated once in the lede.'] },

  { file: 'public-reset-expired.html', role: 'Signed out', title: 'This link has expired', state: 'Expired reset link', replaces: '/reset (expired)',
    notes: ['Existing recovery kept: names the cause and makes "Send a new link" the one primary (A-public §5.1).',
      'Cut: centred card and icon tile; the heading is the page title, left-aligned like every other screen.'] },

  { file: 'public-mfa.html', role: 'Signed out', title: 'Set up two-step sign-in', state: 'Admin, first-time setup', replaces: '/mfa',
    notes: ['Two numbered steps (scan, then enter the code), because the order matters; the medical-details rationale is kept (A-public §4 admin).',
      'QR is a drawn placeholder box; the manual key is in mono because it is a code, and selects in one tap (A-public §8 /mfa).',
      '"Lost your phone?" is hidden during setup, where it was noise (A-public P3 #12). ShieldCheck tile cut.',
      'Code field: 24px tracked digits, numeric keypad, one-time-code autofill.'] },

  { file: 'public-unauthorized.html', role: 'Signed out', title: "This page isn't part of your account", state: 'Parent opened an admin link', replaces: '/unauthorized',
    notes: ['No red ✕, no "Access denied": a wrong door is not an alarm (A-public §4 wrong-door, P3 #12).',
      'Sign: "Go to my home page" with the account it will open, instead of "Back to sign in" that bounced people without saying why.',
      'Sign out stays as a plain link for the shared-device case.'] },

  { file: 'public-apply-1.html', role: 'Signed out', title: 'Volunteer application · About you', state: 'Step 1 of 5, filled, one invalid field', replaces: '/apply (step 1)',
    notes: ['Sign carries the commitment before the password: Cherry Creek High School, 8:30 AM–4:30 PM each day, one or both weeks, a 15-minute interview (A-public P2 #10).',
      'Step rail is words plus segments: "Step 1 of 5 · About you" is the step\'s h2, announced (A-public §2 #1, §7 Sam).',
      'Reordered: about you, then contact, then "Create a password" with its purpose; shirt size moved to Availability (A-public P2 #10).',
      'Errors under the field with aria-invalid, plus "1 answer needs attention" by the button linking to it (A-public P1 #3).',
      'Grade options unchanged: adding "Not in school" is the director\'s call (A-public §10).'] },

  { file: 'public-apply-2.html', role: 'Signed out', title: 'Volunteer application · Availability', state: 'Step 2 of 5', replaces: '/apply (step 2)',
    notes: ['Weeks as two checkbox rows side by side on desktop; the 12px "8:30–4:30 at Cherry Creek" helper moved up into the sign (A-public P2 #10).',
      'Yes/No buttons became a real two-option radio row (A-public P2 #7).',
      '"Next: Experience" names where it goes; Back is on the left.'] },

  { file: 'public-apply-3.html', role: 'Signed out', title: 'Volunteer application · Experience', state: 'Step 3 of 5', replaces: '/apply (step 3)',
    notes: ['Skill scale fits 320px: name over a full-width 5-segment control of real radios, 44px tall; one legend instead of "Least/Greatest" ×6 (A-public P1 #1).',
      '"Clear" replaces "(leave blank if N/A)" and only shows on rated rows.',
      'Languages are checkbox chips with state, 44px (A-public P2 #7). Six selection idioms are down to two.',
      'Second choice is the same list with the first choice removed, so a course can\'t be picked twice (A-public P2 #7).',
      'Skills card wrapper cut.'] },

  { file: 'public-apply-4.html', role: 'Signed out', title: 'Volunteer application · Waiver', state: 'Step 4 of 5, applicant under 18', replaces: '/apply (step 4, waiver half)',
    notes: ['Waiver is its own step, in page flow at 16px in a 65ch measure; the nested 12px scroll box is gone (A-public P1 #4).',
      'Text is a labelled placeholder: PRODUCT.md forbids invented legal copy, so each clause only says what SCC national\'s wording will cover.',
      'Signatures sit right under it; the guardian hint says the parent types their own name (A-public §7 Riya).'] },

  { file: 'public-apply-5.html', role: 'Signed out', title: 'Volunteer application · Interview', state: 'Step 5 of 5, a time picked', replaces: '/apply (step 4, interview half)',
    notes: ['Interview is its own step, no sunken card (A-public P1 #4).',
      'One row per day; times only, 44px, aligned in columns so 4:30s line up; "15 minutes" stated once, not on 17 buttons.',
      'Times are real radios named with their day for screen readers. Primary becomes "Send application".'] },

  { file: 'public-apply-sent.html', role: 'Signed out', title: 'Application sent', state: 'Submitted with an interview booked', replaces: '/apply (submitted)',
    notes: ['Sign: the peak, the booked time at monumental size (A-public §4).',
      'Three numbered next steps; "Confirm your email" is first because sign-in depends on it (A-public P2 #11).',
      '"Go to sign in" replaces the off-site "Visit our website". No exclamation mark, no tile; heading takes focus.'] },

  { file: 'public-apply-closed.html', role: 'Signed out', title: 'Applications are closed', state: 'Applications closed', replaces: '/apply (closed)',
    notes: ['Quiet sign: the only next step is to email the Denver team, so the address is the message (A-public §9 closed).',
      'Gold icon on a light tile cut (A-public §8). Adds the two other doors: sign in, or register a camper.'] }
);
