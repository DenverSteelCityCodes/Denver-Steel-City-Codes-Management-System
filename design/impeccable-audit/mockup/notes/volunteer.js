window.SCC_SCREENS = window.SCC_SCREENS || [];
window.SCC_SCREENS.push(
  { file: 'volunteer-today.html', role: 'Volunteer', title: 'Today: camp day', state: 'Mon Oct 19, 9:05 AM, Arrival roll call, Andre marked absent', replaces: '/volunteer',
    notes: [
      'Sign: one sticky ink row holding the roll-call tabs (44px) and the live 0/9 count; the 170px "Day 1 of Week 1" head became one dateline (A-volunteer P1-2).',
      'Mark-all moved out of the sticky region into the flow, with "Then tap whoever is missing." under it; it reads "Mark the other 8 present" because a mark already exists and Mark all never overwrites it.',
      'Health notes always on the row, split Allergy / Medical; the 24px "Medical" chip and per-note "Confidential" footnote are cut (P1-1). Andre\'s peanut allergy is the critique\'s own example, added to show the split.',
      'Absent rows tint and name who answers: "Call Grandpa Tran (emergency) · 720-555-0137" instead of a bare phone icon (P1-3).',
      'Cut: initials discs, ages, the gold "0" block, the update card and megaphone. "Updated 9:06 · Refresh" replaces the muted Refresh (P2-6); "Now" is weight plus the word, no side stripe (P3-13).'
    ] },
  { file: 'volunteer-today-done.html', role: 'Volunteer', title: 'Today: roll call done', state: 'Arrival complete, 9/9 at 9:05', replaces: '/volunteer',
    notes: [
      'The sign settles to "✓ 9/9 · 9:05" and the Arrival tab carries the ✓; the finish lands at thumb height instead of 14px muted text (A-volunteer section 4, peak-end).',
      'Mark-all and its hint are gone; one calm green line says "Arrival roll call done" and names the next roll call.',
      'Toggles stay live, so a late correction is still one tap.'
    ] },
  { file: 'volunteer-today-precamp.html', role: 'Volunteer', title: 'Today: before camp', state: 'Saturday Oct 17, Week 1 starts Monday', replaces: '/volunteer',
    notes: [
      'Sign: "Week 1 starts Monday" with 8:30 AM, Monday Oct 19 and Room 102: the best copy in the old screen, now the headline (A-volunteer P2-4).',
      'Merged: the two identical Week 1 / Week 2 class rows into one "Weeks 1 and 2" decision; the row links to Class, so "Rosters" is cut.',
      'The duty shows what it involves (the existing duty description) plus the 8:15 crew huddle from the latest update.',
      'Folded: the 8-row schedule; the update is one line. About 1.2 phone screens instead of 1430px.'
    ] },
  { file: 'volunteer-class.html', role: 'Volunteer', title: 'Class roster', state: 'PY-B, Week 1, 9 campers', replaces: '/volunteer/classes',
    notes: [
      '"Health notes: Andre Tran, Kai Lopez" under the count names who, as anchors (A-volunteer P1-1).',
      'Every row shows its health note and both call lines with contact, relationship and number; the icon-only phone column is cut (P1-3).',
      'Meta sentence became one line: "You lead · Room 102 · Mon–Fri 9:00–3:00 · ages 11–13"; "Post to families" lives on Updates only.',
      'Desktop: the roster is a light table (Camper | Health | Call); phone: the same table reflows to rows. Tab renamed "Class".'
    ] },
  { file: 'volunteer-duties.html', role: 'Volunteer', title: 'Duties', state: 'Cancel confirm open, Monday selected', replaces: '/volunteer/duties',
    notes: [
      'Inline confirm with 48px "Keep it" / "Drop duty" (was 36px), copy kept word for word.',
      'Day tiles are one segmented strip; selected is ink, not gold, and the unexplained dot became the third line "You\'re on" (A-volunteer P2-5, P2-8).',
      'Each slot shows what the duty involves (duty_types.description), then "1 of 2 open", muted "Full" or a green "You\'re on"; "2 of 2 seats taken" and the grey pill are cut.',
      'Sign up is ink on every slot so no day shows four gold buttons; tap a day tile to see its slots.'
    ] },
  { file: 'volunteer-updates.html', role: 'Volunteer', title: 'Updates', state: 'Lead composer open with a draft', replaces: '/volunteer/updates',
    notes: [
      'H1 visually hidden: the active tab already says Updates (A-volunteer P3-11).',
      'The class select and the textarea label merged into one control: "To: families in [PY-B, Week 1]".',
      'Cut: the gold composer border, the always-on 0/2000 counter, megaphone circles and the feed card. "Also email" is a 52px row; the post button names its audience.',
      'Opener is a secondary button and hides while the composer is open.'
    ] },
  { file: 'volunteer-profile.html', role: 'Volunteer', title: 'Profile and availability', state: 'Add-a-day form open', replaces: '/volunteer/profile',
    notes: [
      'Reached from the avatar menu; Dark mode moved into that menu (A-volunteer P2-10).',
      'Cut: Back link, the double-ring avatar, the page\'s Sign out and the second "admins assign" sentence.',
      'Switch is one sentence: "You\'re in PY-B for Weeks 1 and 2. Ask an admin to switch."',
      'Availability is a plain list with an inline edit form; days-off form inline with 16px inputs.'
    ] },
  { file: 'volunteer-applicant.html', role: 'Volunteer applicant', title: 'Application waiting room', state: 'Interview booked Tue Oct 20, 4:00 PM', replaces: '/volunteer (applicant)',
    notes: [
      'Sign: the interview time at monumental scale with "Change time" on it: the one next thing (A-volunteer P2-7).',
      'Cut: "Here\'s where everything stands." The numbered steps stay because order carries meaning.',
      'No dead ends: "Questions? denver@steelcitycodes.org" closes the page.',
      'How to join "online" is not written: the critique says ask the director first.'
    ] },
  { file: 'volunteer-applicant-change.html', role: 'Volunteer applicant', title: 'Change interview time', state: 'Thu Oct 22, 4:30 PM picked', replaces: '/volunteer (applicant, Change time)',
    notes: [
      'One row per day with 44px time chips, chunked by week; "15 min" on every chip is cut (A-volunteer P2-7).',
      'The current slot is in the list and labelled "Your time" (it was missing).',
      'Full-width confirm names the new time; "Keep Tue, Oct 20, 4:00 PM" is a text link under it.'
    ] },
  { file: 'volunteer-print-roster.html', role: 'Volunteer', title: 'Paper roster', state: 'Screen preview; print is landscape', replaces: '/print/roster/:sectionId',
    notes: [
      'Columns reordered: health sits next to the camper, age folds into the camper cell (A-volunteer P3-12).',
      'Print: landscape Letter, white header, black hairlines, confidentiality line once.',
      'Toolbar: Lucide Back, the one gold Print, and parent emails grouped as "Copy · Email".'
    ] }
);
