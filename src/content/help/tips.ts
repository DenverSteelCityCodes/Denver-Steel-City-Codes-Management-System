import type { HelpTip } from './types'

// Contextual tips (issue #186) for the confusing bits, keyed so a page adopts one with
// <HowItWorks tip="registration-switch" /> right under the control named in `where`.
// Each was checked against the code on main; `more` opens the help topic that says more.
// None is placed on a page yet: the pages belong to other work in flight.

export const TIPS = {
  'registration-switch': {
    role: 'admin',
    where: 'Sessions › Registration › Families can register',
    body: [
      'Families can register only while this is on and the opening time, if you set one, has passed. The database checks both, so nobody gets in early, even outside the app.',
      'Turning it off stops new sign-ups and waitlist joins. Registrations already made stay as they are.',
    ],
    more: '/admin/help#registration-night',
  },
  'change-deadline': {
    role: 'admin',
    where: 'Sessions › Registration › Change deadline',
    body: [
      'Until this many days before a class\'s week starts, families cancel or switch classes themselves on Home. After it, they can only send a change request, which shows at the top of [[admin-students]].',
    ],
    more: '/admin/help#change-requests',
  },
  'offer-windows': {
    role: 'admin',
    where: 'Sessions › Registration › Waitlist offer window and Offer window in the final week',
    body: [
      'When a seat frees up, it\'s offered to the next camper on that section\'s waitlist, who has this many hours to claim it. The final-week window applies when the class\'s week starts within 7 days.',
      'An offer that runs out goes to the next camper. A changed window applies to offers made after you save.',
    ],
    more: '/admin/help#waitlist-and-offers',
  },
  'section-week': {
    role: 'admin',
    where: 'Classes › a section › Edit › Week',
    body: [
      'Pick Week 1 or Week 2. A section on **Both weeks** isn\'t tied to a camp week: its campers can\'t take another class in either week, it never shows on the attendance board, and its crew never get a roll call.',
    ],
    more: '/admin/help#season-setup',
  },
  'remove-section': {
    role: 'admin',
    where: 'Classes › a section › Edit › Remove section, or Remove on a class',
    body: [
      'A section with no registrations is deleted. One with registrations is cancelled instead: every registration is kept as cancelled, and families are told on Home and go first on that week\'s waitlists.',
      'A cancelled section can\'t be edited or brought back, so move its crew first.',
    ],
    more: '/admin/help#section-cancelled',
  },
  'admin-move': {
    role: 'admin',
    where: 'Campers › a camper › Move to',
    body: [
      'Admin moves skip the checks families get: a move can over-fill a section, break its age range or give a camper a second class that week. The confirmation names each problem before anything changes.',
      'A confirmed seat stays confirmed. The seat left behind is offered to that section\'s waitlist.',
    ],
    more: '/admin/help#late-change',
  },
  'auto-assign': {
    role: 'admin',
    where: 'Volunteers › Crew › Fill open spots',
    body: [
      'Fills only empty spots in the chosen week: a senior as lead and a junior as support, from volunteers available that week who aren\'t on another crew that week. Existing crews are kept.',
      'Nothing changes until you tap **Apply assignments**.',
    ],
    more: '/admin/help#volunteer-pipeline',
  },
  'attendance-unaccounted': {
    role: 'admin',
    where: 'Attendance › Unaccounted now',
    body: [
      'A camper is unaccounted when they weren\'t marked present at the latest roll call taken in their section: marked absent, or not marked at all.',
      'Sections with no roll call yet today aren\'t counted here; they say "No roll call yet". The board refreshes every minute.',
    ],
    more: '/admin/help#unaccounted',
  },
  'email-log': {
    role: 'admin',
    where: 'Updates › Sent emails',
    body: [
      'The app queues an email when a spot is confirmed, waitlisted, moved, cancelled or offered, and when a change request is resolved. **Waiting** means not sent yet: emails only go out once the camp\'s email service is connected.',
      '**Also email** on a post opens your own mail app instead, so those emails never show here.',
    ],
    more: '/admin/help#updates-and-email',
  },
  'role-change': {
    role: 'admin',
    where: 'Users & roles › Change role',
    body: [
      'A new role applies the next time the person loads a page. A new admin can see every camper\'s medical details and is asked to set up two-step sign-in.',
      'A volunteer moved to another role leaves every crew spot and upcoming duty. Nobody can change their own role, and the last admin can\'t be changed.',
    ],
    more: '/admin/help#add-admin',
  },
  'roll-call': {
    role: 'volunteer',
    where: 'Today › roll call',
    body: [
      'Every tap saves on its own. Tap a camper again to switch between **Present** and **Absent**.',
      'The **Mark all** button only fills campers with no mark yet, so it never undoes a tap.',
    ],
    more: '/volunteer/help#take-roll-call',
  },
  'online-changes': {
    role: 'parent',
    where: 'Home › a camper › Switch class and Cancel this spot',
    body: [
      'You can switch or cancel online until the date shown. After that, **Request a change** sends a message to the camp instead.',
      'A seat you give up goes to the next family on that class\'s waitlist.',
    ],
    more: '/parent/help#cancel-or-switch',
  },
} satisfies Record<string, HelpTip>

export type TipKey = keyof typeof TIPS
