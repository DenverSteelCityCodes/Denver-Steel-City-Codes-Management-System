import type { HelpGuide } from './types'

// /admin/help: the admin guide and the "when something goes wrong" playbook (issue #186).
// Every step was checked against the pages, hooks, RPCs and migrations on main (Oct 2026):
// AdminUsers, MfaPage, SeasonSettingsCard, AdminSessions, AdminClasses, AdminStudents,
// AdminChangeRequests, AdminVolunteers, AdminInterviews, AdminDuties, AdminAttendance,
// UpdateComposer, EmailLog, HistoryStrip, useAdminAttention and the migration_*.sql triggers.
// Automatic emails are queued in the outbox; nothing here says one was delivered, because
// delivery waits for the email provider (spec 02).

export const ADMIN_GUIDE: HelpGuide = {
  role: 'admin',
  path: '/admin/help',
  title: 'Admin help',
  intro: 'How to run the season, step by step, and what to do when something goes wrong. Open a question to see the steps; the links take you to the page.',
  sections: [
    {
      id: 'guide',
      title: 'Running the season',
      topics: [
        {
          id: 'getting-started',
          title: 'Sign in and two-step sign-in',
          keywords: 'mfa 2fa authenticator code login totp start',
          body: [
            { kind: 'p', text: 'Admins can see every camper\'s medical details, so an admin account needs a second step after the password: a 6-digit code from an authenticator app on your phone.' },
            {
              kind: 'steps',
              heading: 'The first time',
              items: [
                'Sign in with your email and password.',
                'The **Set up two-step sign-in** page opens. Scan its QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy and others work). If you can\'t scan, type the key shown under it into the app.',
                'Type the 6-digit code the app shows and tap **Turn on two-step sign-in**.',
              ],
            },
            {
              kind: 'steps',
              heading: 'Every time after that',
              items: [
                'Sign in with your email and password.',
                'On **Enter your code**, type the current 6-digit code and tap **Continue**. Codes change every 30 seconds.',
              ],
            },
            {
              kind: 'system',
              items: [
                'Until the code is entered, the database itself refuses admin data, not just the page.',
                'The public demo has this step switched off so its one-click admin login works.',
              ],
            },
            { kind: 'p', text: 'Lost your phone? See [When an admin is locked out of two-step sign-in](/admin/help#admin-locked-out).' },
          ],
        },
        {
          id: 'finding-your-way',
          title: 'Find your way around',
          keywords: 'dashboard today to do bell search menu rail tabs dark mode',
          body: [
            {
              kind: 'list',
              items: [
                '[[admin-today]] opens first. The gold sign says whether registration is open, with seats left. **To do** lists what needs a person, most serious first. **Seats** shows every section\'s fill and waitlist. It refreshes every minute and when you come back to the tab.',
                'On a laptop the menu down the left lists the five jobs (Today, Campers, Classes, Volunteers, Updates) and Setup, with each job\'s other pages under it: Attendance under Today, Interviews and Duties under Volunteers, Forms and Users and roles under Setup. On a phone the same six are tabs along the top, and the page you\'re on shows its other pages just below them.',
                'The bell in the top bar holds the same to-do list on every page, and the newest updates.',
                'The search box in the top bar finds pages (old names like Students or Sessions work too), classes, campers and volunteer applicants.',
                'Your name, **Dark mode**, Help and **Sign out** are in the menu under your initials.',
              ],
            },
          ],
        },
        {
          id: 'add-admin',
          title: 'Set up another admin',
          keywords: 'new admin promote invite helper role',
          body: [
            { kind: 'p', text: 'There are no invitations. A person first makes an ordinary account, then an admin promotes it. Keep at least two admins with two-step sign-in on, so one can always help the other.' },
            {
              kind: 'steps',
              items: [
                'Ask them to make an account at [Create an account](/signup) with the email they\'ll use for camp work, and to click the confirmation link. Use an account that isn\'t their own family\'s parent account: an account has one role, and an admin no longer sees the parent pages.',
                'Open [[admin-users]]. They\'re listed under **Parents**, with their email.',
                'In their **Role** menu, choose **Admin**.',
                'Read the confirmation under their name: they\'ll see every camper\'s details and can change anything, including other people\'s roles. Tap **Make admin**.',
                'Tell them to reload the page or sign in again: the change applies the next time they load a page. They\'re sent straight to **Set up two-step sign-in** and need an authenticator app on their phone (see [Sign in and two-step sign-in](/admin/help#getting-started)).',
                'Check [[admin-users]]: under **Admins**, their line says "Two-step sign-in: on" once they\'ve finished, and "not set up yet" until then.',
              ],
            },
            {
              kind: 'system',
              items: [
                'If they were a volunteer, the confirmation names the class crews they\'ll leave. Their crew spots and upcoming duty slots are cleared in the same step.',
                'Nobody can change their own role, and the last admin can\'t be changed: their line says "Only admin". The database refuses it too.',
              ],
            },
          ],
        },
        {
          id: 'users-and-roles',
          title: 'Users and roles',
          keywords: 'account parent volunteer admin access permissions',
          body: [
            {
              kind: 'list',
              items: [
                '**Parent** is what every new account gets at [Create an account](/signup). Parents see only their own family.',
                '**Volunteer** is what an account gets when someone applies at [the volunteer application](/apply). They see their application until you accept them; then they get the volunteer pages.',
                '**Admin** is only ever given by another admin on [[admin-users]].',
              ],
            },
            { kind: 'p', text: 'To change a role, pick it in the person\'s **Role** menu on [[admin-users]] and confirm. The confirmation says what changes for them before anything happens.' },
            { kind: 'p', text: 'Changing someone to **Volunteer** here doesn\'t make them crew. They get a class and duties only after you accept their application on [[admin-applications]].' },
          ],
        },
        {
          id: 'season-setup',
          title: 'Set up the season',
          keywords: 'sessions weeks classes sections schedule forms setup',
          body: [
            { kind: 'p', text: 'Work in this order: weeks, then classes and sections, then the daily schedule and forms, then the registration settings.' },
            {
              kind: 'steps',
              items: [
                'On [[admin-sessions]], tap **New session** for each camp week. Give it a name (for example "Week 1"), a start date and an end date, leave **Show on sign-up forms** ticked, and tap **Create session**. Week 1 and Week 2 are that year\'s first and second sessions by start date.',
                'Under each week, tap **Add a time block** for the daily schedule (drop-off, lunch, pickup). Families see it on Home. Once one week has a schedule, the other week offers **Copy from** that week.',
                'On [[admin-classes]], tap **New class**, enter the course name and the description parents see, and tap **Create class**. Its first section form opens.',
                'Fill in the section: a label, capacity, youngest and oldest age, **Week 1** or **Week 2**, days, room, times, and the lead and supports if you know them. Tap **Add section**. Add more with **Add section** in that class\'s week column.',
                'On [[admin-forms]], rename questions, hide optional ones and choose what\'s required. Changes apply to the live forms at once.',
                'Back on [[admin-sessions]], under **Registration**, set the **Opening time (Denver)**, the **Change deadline**, and the two waitlist offer windows. Tap **Save settings**.',
                'When everything is ready, turn on **Families can register** (see [Registration night](/admin/help#registration-night)).',
              ],
            },
            {
              kind: 'system',
              items: [
                'A section left on **Any** week isn\'t tied to a camp week: it never appears on the attendance board and its crew never get a roll call. Pick Week 1 or Week 2.',
                'Families only see classes whose age range fits their camper. Age comes from the grade they enter in the fall.',
              ],
            },
          ],
        },
        {
          id: 'registration-night',
          title: 'Registration night and the registration switch',
          keywords: 'open close switch opening time families can register rush',
          body: [
            { kind: 'p', text: 'Registration opens and closes in one place: **Families can register** under **Registration** on [[admin-sessions]].' },
            {
              kind: 'steps',
              heading: 'Before opening',
              items: [
                'On [[admin-sessions]], set **Opening time (Denver)** and tap **Save settings**.',
                'Turn on **Families can register**. The line under it should read "Opens by itself" with your date and time.',
                'Check [[admin-today]]: the gold sign shows the same opening time.',
              ],
            },
            {
              kind: 'steps',
              heading: 'While it\'s open',
              items: [
                'Watch [[admin-today]]: the sign counts seats left, campers placed and waitlisted, and **Seats** shows each section\'s fill and waitlist.',
                'To stop new sign-ups, turn **Families can register** off and tap **Close registration**.',
              ],
            },
            {
              kind: 'system',
              items: [
                'Nobody can register before the opening time or while the switch is off, even outside the app: the database refuses it.',
                'A free seat is confirmed at once. When a section is full, families join its waitlist in order.',
                'The database also enforces the age range and one class per camper per week, waitlists included.',
                'Each family gets a confirmation or waitlist email queued (see [Updates and email](/admin/help#updates-and-email)).',
                'Closing keeps every registration already made.',
              ],
            },
          ],
        },
        {
          id: 'waitlist-and-offers',
          title: 'Waitlist and seat offers',
          keywords: 'waitlist offer expire claim decline window queue order',
          body: [
            { kind: 'p', text: 'Seats are offered automatically. You don\'t pick who gets one unless you want to override the order.' },
            {
              kind: 'system',
              items: [
                'When a seat frees up (a family cancels or switches, you remove or move someone, an offer is declined or runs out, or you raise a section\'s capacity), the section\'s waitlist gets an offer at once.',
                'Order: campers whose class the camp cancelled go first, then everyone else in the order they joined. Campers who already hold a seat that week are skipped.',
                'The family sees a "spot opened" sign on Home with **Claim the spot** and **Decline**, and an offer email is queued, with a reminder when 6 hours are left.',
                'The window is the **Waitlist offer window** on [[admin-sessions]] (48 hours unless you change it), or the **Offer window in the final week** (12 hours) when the class\'s week starts within 7 days.',
                'An offer that runs out is cancelled and the seat goes to the next camper. Expired offers are cleared every 10 minutes.',
              ],
            },
            {
              kind: 'steps',
              heading: 'To see or override offers',
              items: [
                'On [[admin-students]], tap the **Offered** filter to see every open offer.',
                'To offer a seat to a particular camper, open them, choose **Offered** in **Status** and tap **Set status**. They get the normal window and the offer email. The waitlist order isn\'t checked.',
                'To place someone straight away, choose **Confirmed** instead and tap **Set status**. If the section is full, the confirmation warns that it will over-fill; tap **Set confirmed anyway** only if you mean it.',
              ],
            },
          ],
        },
        {
          id: 'change-requests',
          title: 'Change requests',
          keywords: 'late change after deadline parent request switch cancel volunteer switch',
          body: [
            { kind: 'p', text: 'Until the **Change deadline** (days before the week starts, set on [[admin-sessions]]), families cancel and switch classes themselves on Home. After it, they tap **Request a change** instead. Volunteers asking to switch classes send the same kind of request.' },
            {
              kind: 'steps',
              items: [
                'Open requests show on [[admin-today]] under **To do** ("open change requests"). Tap **Review requests**, or open [[admin-students]]: **Change requests** is at the top.',
                'Read the request. Then make the change yourself: open the camper below and use **Move to** (then **Move**) or **Status** (then **Set status**; **Cancelled** removes them from the class). For a volunteer, change their section on [[admin-classes]].',
                'Back in **Change requests**, type a **Reply** if you want to explain, then tap **Mark done**, or **Decline** if you can\'t make the change.',
              ],
            },
            {
              kind: 'system',
              items: [
                'Marking a request done doesn\'t change the registration; only your move or cancel does.',
                'The person who asked gets an email queued either way, with your reply.',
              ],
            },
          ],
        },
        {
          id: 'volunteer-pipeline',
          title: 'Volunteer applications, interviews and crews',
          keywords: 'applicant accept reject interview slot crew lead support auto-assign matcher duty',
          body: [
            {
              kind: 'steps',
              heading: 'Applications',
              items: [
                'On [[admin-applications]], tap **Open applications** to start taking them at /apply. **Close applications** stops them.',
                'The list starts on **Pending**. Tap an applicant to read their application.',
                'To accept, tap **Accept**, choose **Junior** or **Senior**, and tap **Confirm accept as junior** (or senior). Seniors can lead a class; juniors support. To turn them down, tap **Reject**, add a reason if you like, and tap **Confirm reject**.',
              ],
            },
            {
              kind: 'steps',
              heading: 'Interviews',
              items: [
                'On [[admin-interviews]], add times under **Add interview slot** (date, Denver time, minutes) and tap **Add slot**.',
                'Applicants book and move their own interview from their application page. You can also tap **Book** on an open slot and pick an applicant.',
                'After the interview, use the notes button on the booking to write **Interview notes** and tap **Save notes**.',
              ],
            },
            {
              kind: 'steps',
              heading: 'Crews',
              items: [
                'To fill empty spots automatically, open [[admin-volunteers]], go to **Auto-assign volunteers**, pick the week and tap **Preview matches**. Check the table, then tap **Apply assignments**.',
                'To set a crew by hand, select the section on [[admin-classes]] (it sits in its week\'s column), open **Edit**, and choose the **Lead** and **Supports**. Each name says their level, whether they\'re free that week and what they already crew; free people are listed first. Tap **Save** (the button names the section).',
                'Daily jobs live on [[admin-duties]]: add a duty type, then **Add duty slot** with a date and how many volunteers. Volunteers sign up themselves.',
              ],
            },
            {
              kind: 'system',
              items: [
                'Accepting needs an account with the applicant\'s email; applying at /apply makes one. The app tells you if it\'s missing.',
                'Accepting doesn\'t email the volunteer. Their page turns into the volunteer area the next time they open it; tell them yourself.',
                'Auto-assign fills only empty spots: a senior as lead and a junior as support, from volunteers available that week who aren\'t on another crew that week. Existing crews are kept.',
                'Editing a section by hand doesn\'t check whether the volunteer is already on another crew that week. The **Assigned to** column on the volunteer roster shows who is where.',
              ],
            },
          ],
        },
        {
          id: 'camp-week',
          title: 'Camp week: roll call, the attendance board and calling families',
          keywords: 'attendance roll call unaccounted board call parent emergency print roster export csv',
          body: [
            { kind: 'p', text: 'Crews take roll call on their phones three times a day: arrival, after lunch and dismissal. Leads and supports can both mark campers. You follow it on [[admin-attendance]].' },
            {
              kind: 'steps',
              items: [
                'Open [[admin-attendance]]. The top line counts campers today, present at the latest roll call, unaccounted, and sections with no roll call yet.',
                'Each section shows its lead, room and each roll call taken ("Arrival 12/12 · 9:04 AM"), or "not taken".',
                '"No roll call taken yet — call the lead" means the crew hasn\'t marked anyone today.',
                'Unaccounted campers are listed under their section with any health note and buttons to **Call parent** and call the emergency contact. On a phone these dial straight away.',
                'For paper backups, use the printer button on a section for its printable roster. At the end of the week, use **Download attendance CSV** at the bottom.',
              ],
            },
            {
              kind: 'system',
              items: [
                'Unaccounted means not marked present at the latest roll call taken in that section: marked absent ("Missed") or not marked at all ("Not marked at").',
                'The board refreshes every minute and when you come back to the tab; **Refresh** reloads it now.',
                'On camp days, **To do** and the bell show how many campers are unaccounted, or how many sections have no roll call yet.',
                'Admins can\'t mark roll call here. If a camper turns out to be in the room, the crew marks them on their Today page.',
              ],
            },
          ],
        },
        {
          id: 'updates-and-email',
          title: 'Updates and email',
          keywords: 'announcement post message email outbox log bcc mail',
          body: [
            {
              kind: 'steps',
              heading: 'Post an update',
              items: [
                'On [[admin-updates]], choose who it goes to under **Send to**: everyone this season, this season\'s parents, all volunteers, or one section\'s families.',
                'Write the message and tap **Post update**. Parents see it on their Updates tab and on Home; volunteers on their Updates tab and Today.',
                'To email it too, tick **Also email** before posting. After the post saves, your own mail app opens with every address in BCC (or the addresses are copied for you to paste).',
              ],
            },
            {
              kind: 'system',
              items: [
                'Section leads can post to their own section\'s families too.',
                'Posts can\'t be edited. To fix one, delete it with its trash button and post again.',
                '"Also email" goes out from your own mail app. The app doesn\'t send it or record it.',
              ],
            },
            {
              kind: 'p',
              text: 'Separately, the app queues an email to the family when a spot is confirmed, waitlisted, moved, cancelled or offered, when an offer is about to run out, when a section\'s lead changes, and when you resolve a change request.',
            },
            {
              kind: 'list',
              heading: 'Reading the email log',
              items: [
                '**Emails the app sent** at the bottom of [[admin-updates]] lists the newest 50.',
                '**queued** means not sent yet. Queued emails only go out once the camp\'s email provider is connected; if they stay queued, it isn\'t yet.',
                '**sent** went out; **failed** is retried twice, then shows on **To do**; **skipped** had no address it could send to (demo addresses at example.com are skipped).',
              ],
            },
          ],
        },
        {
          id: 'history-and-undo',
          title: 'History and undo',
          keywords: 'audit revert undo log who changed',
          body: [
            {
              kind: 'steps',
              items: [
                'For a camper: on [[admin-students]], open them and tap **Show history**. It covers their details and every registration.',
                'For a section: on [[admin-classes]], select the section and open its **History** tab.',
                'Each line says when, who and what changed. To undo an edit, tap **Revert** on it, then **Revert** again to confirm.',
              ],
            },
            {
              kind: 'system',
              items: [
                'A revert is saved as a new change, so it can be undone too.',
                'It\'s refused if the same fields changed again later (revert the newer change first), or if it would put a camper back into a cancelled or now-full section. Then use **Move to** or **Status** on the camper instead.',
                'Deletes can\'t be undone: empty sections and classes, sessions, duty and interview slots, and update posts.',
                'A cancelled section can\'t be un-cancelled in the app.',
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'playbook',
      title: 'When something goes wrong',
      intro: 'Each answer says what to do, step by step, and what the system already does for you.',
      topics: [
        {
          id: 'volunteer-sick',
          title: 'When a volunteer is sick on camp morning',
          keywords: 'absent cover replace crew lead support ill',
          body: [
            {
              kind: 'steps',
              items: [
                'If they told the camp in the app, [[admin-today]] shows "can\'t make it" under **To do**, with the names of senior volunteers who could cover. Tap **Find cover**; [[admin-classes]] opens at that class. If they texted you instead, open [[admin-classes]] yourself.',
                'Select their section and open **Edit**.',
                'Change the **Lead** (or remove them from **Supports** and add someone else) and tap **Save**. The **Lead** list shows who is free that week first.',
                'Call or text the volunteer who\'s covering. The app doesn\'t notify them.',
                'If nobody can cover today, a support can still take roll call: leads and supports both can.',
              ],
            },
            {
              kind: 'system',
              items: [
                'Cover suggestions are seniors available that week who aren\'t on another crew that week and haven\'t said they\'re away.',
                'The new crew member sees the class, its roster and roll call the next time they open their Today page.',
                'Families\' Home shows the new lead\'s first name. When the lead changes from one person to another, each family in the section gets an email queued.',
              ],
            },
          ],
        },
        {
          id: 'no-lead',
          title: 'When a section has no lead',
          keywords: 'unassigned crew missing lead',
          body: [
            {
              kind: 'steps',
              items: [
                '[[admin-today]] lists it under **To do** ("has no lead") while its week hasn\'t ended. Tap **Assign a lead**; [[admin-classes]] opens at that class, where the section says **No lead**.',
                'Select the section: it opens on **Edit**. Choose a **Lead** and tap **Save**.',
                'Or fill every empty spot at once: on [[admin-volunteers]], use **Auto-assign volunteers** for that week, **Preview matches**, then **Apply assignments**.',
              ],
            },
            {
              kind: 'system',
              items: [
                'Until there\'s a lead, the attendance board says "No lead assigned" for the section, and families\' Home shows no lead name.',
                'Supports on the crew can still see the roster and take roll call.',
              ],
            },
          ],
        },
        {
          id: 'section-cancelled',
          title: 'When a section must be cancelled',
          keywords: 'cancel class section remove delete',
          body: [
            {
              kind: 'steps',
              items: [
                'First move its crew if they\'re needed elsewhere: select the section on [[admin-classes]], open **Edit**, clear the **Lead** and **Supports** and tap **Save**. A cancelled section can\'t be edited.',
                'Still on **Edit**, tap **Remove section** at the bottom.',
                'Read the confirmation: it counts the campers with a spot and on the waitlist. Tap **Cancel section**.',
                'Post an update to the families if you want to explain (see [Updates and email](/admin/help#updates-and-email)).',
              ],
            },
            {
              kind: 'system',
              items: [
                'Every registration in it is kept as cancelled, so families keep their history.',
                'Families see on Home that the camp cancelled the class, with **Pick another class**, and they go first on that week\'s waitlists. Each gets an email queued.',
                'The section shows **Cancelled**, takes no new sign-ups, and you can still view and print its roster. Its crew stop seeing it.',
                'This can\'t be undone in the app. A section with no registrations at all is deleted instead.',
              ],
            },
          ],
        },
        {
          id: 'parent-no-email',
          title: 'When a parent never got the confirmation email or can\'t sign in',
          keywords: 'email missing spam password reset login verify',
          body: [
            { kind: 'p', text: 'Work out which email they mean. The sign-up email (to confirm their account) comes from the sign-in system. Confirmations of a spot come from the camp\'s own email queue.' },
            {
              kind: 'steps',
              heading: 'They can\'t sign in, or never got the sign-up email',
              items: [
                'Ask them to check spam. Right after signing up, the "Check your email" screen has **Resend the email**.',
                'Until they click that link, signing in says "Wrong email or password".',
                'If they forgot their password: **Forgot password?** on the sign-in page sends a reset link that works once, for an hour.',
                'On [[admin-users]] you can check that their account exists and which email it uses. Admins can\'t confirm accounts or change passwords in the app.',
              ],
            },
            {
              kind: 'steps',
              heading: 'They never got a spot confirmation',
              items: [
                'Their spot doesn\'t depend on the email: they can see it on their Home page. You can check it on [[admin-students]].',
                'Look for their email in **Emails the app sent** at the bottom of [[admin-updates]]: **queued** (not sent yet), **sent**, **failed**, or **skipped** (no usable address).',
                'Camp emails go to the email in their **Family details**, or their sign-in email if that\'s empty. If it\'s wrong, they fix it under **Family details** in their menu.',
              ],
            },
          ],
        },
        {
          id: 'late-change',
          title: 'When a family wants to switch or cancel after the deadline',
          keywords: 'change request late deadline move cancel',
          body: [
            {
              kind: 'steps',
              items: [
                'Their request shows under **Change requests** at the top of [[admin-students]] (and on **To do**).',
                'Decide. To switch them: open the camper, pick the new class in **Move to** (each choice shows its seats and ages) and tap **Move**. Read the confirmation (seats, ages, another class that week) and tap **Move** again.',
                'To cancel: choose **Cancelled** in that class\'s **Status**, tap **Set status**, then **Cancel seat** (or **Take off waitlist**).',
                'In **Change requests**, add a **Reply** and tap **Mark done**, or **Decline** with a reason.',
              ],
            },
            {
              kind: 'system',
              items: [
                'The seat they leave is offered to that section\'s waitlist straight away.',
                'A move keeps a confirmed seat confirmed. A waitlisted or cancelled registration moved into a section takes a seat there (it shows as pending).',
                'The family gets a "class change" or "cancelled" email queued, plus the reply to their request.',
                'A family who cancelled can\'t sign up again for that same section themselves. If they want back in, open the camper and set that cancelled registration to **Confirmed**.',
              ],
            },
          ],
        },
        {
          id: 'offer-expired',
          title: 'When a seat opens and the offer expires',
          keywords: 'waitlist offer missed late claim expired',
          body: [
            { kind: 'p', text: 'You usually do nothing: the next family on the waitlist gets the offer automatically.' },
            {
              kind: 'system',
              items: [
                'An offer that runs out is cancelled within 10 minutes, and the seat is offered to the next camper in line.',
                'The family is off that waitlist; their registration shows as cancelled on [[admin-students]].',
              ],
            },
            {
              kind: 'steps',
              heading: 'If the family missed it and you want to let them in anyway',
              items: [
                'On [[admin-students]], find the camper and open them.',
                'Check the class: the seat may already be on offer to the next family.',
                'In that class\'s **Status**, choose **Confirmed** (or **Offered** to give them a new window) and tap **Set status**. If the section is now full, the confirmation warns that it will over-fill.',
              ],
            },
          ],
        },
        {
          id: 'duplicate-camper',
          title: 'When the same family or camper appears twice',
          keywords: 'duplicate two accounts same name merge',
          body: [
            {
              kind: 'steps',
              items: [
                '[[admin-today]] lists "possible duplicate campers" under **To do**: the same name under different parent accounts, with the same grade or school. Tap **Review campers**; [[admin-students]] opens searched for that name.',
                'Open both records and compare the parent, grade, school and registrations.',
                'Ask the family which account they use, and tell them to sign in with that one from now on.',
                'On the record they don\'t use, set each class\'s **Status** to **Cancelled**, tap **Set status**, then **Cancel seat**.',
              ],
            },
            {
              kind: 'system',
              items: [
                'There\'s no merge. Removed registrations stay on file as cancelled, and their seats are offered to the waitlist.',
                'Each parent account only ever sees its own campers.',
              ],
            },
          ],
        },
        {
          id: 'grade-mismatch',
          title: 'When a camper\'s grade doesn\'t fit the class',
          keywords: 'age range grade wrong eligible',
          body: [
            { kind: 'p', text: 'A camper\'s age comes from the grade they enter in the fall. Families can only pick classes whose age range fits, and the database refuses the rest ("This section is for ages…").' },
            {
              kind: 'steps',
              items: [
                'If the grade was wrong and the family tries to fix it, the save is refused while the camper is in a class that doesn\'t fit the new age. They\'re told to contact the camp.',
                'On [[admin-students]], open the camper and use **Move to** to pick a class that fits (each choice shows its ages), then **Move**. The confirmation warns if the ages don\'t fit.',
                'Then ask the family to save the new grade in **Family details**.',
              ],
            },
            {
              kind: 'system',
              items: [
                'Admin moves aren\'t blocked by the age range; the confirmation only warns. That lets you make an exception on purpose.',
              ],
            },
          ],
        },
        {
          id: 'over-capacity',
          title: 'When a section is over capacity after a move',
          keywords: 'over full capacity overfill seats',
          body: [
            { kind: 'p', text: 'Moves and status changes by an admin can over-fill a section. The confirmation says so first ("is full… will over-fill it") and the button reads **Move and over-fill**.' },
            {
              kind: 'steps',
              items: [
                'To make room, select the section on [[admin-classes]], open **Edit**, raise **Capacity** and tap **Save**.',
                'Or move someone else out on [[admin-students]].',
              ],
            },
            {
              kind: 'system',
              items: [
                'While a section is over capacity, new sign-ups join its waitlist and no seat is offered.',
                'Raising capacity above the number of campers holding seats offers the new seats to the waitlist straight away.',
                'Lowering capacity never removes anyone; the form warns how many would be over.',
              ],
            },
          ],
        },
        {
          id: 'unaccounted',
          title: 'When a camper is unaccounted for at roll call',
          keywords: 'missing absent not marked safety call parent',
          body: [
            {
              kind: 'steps',
              items: [
                'Open [[admin-attendance]]. The camper is listed under their section with "Missed" or "Not marked at" and the roll call.',
                'Check with the section\'s lead first (the board shows their name). "Not marked" often means the crew hasn\'t tapped them yet.',
                'If the camper isn\'t there, tap **Call parent**, or the emergency contact\'s button, right on the board.',
                'If they turn up, ask the crew to mark them present. The board updates within a minute, or tap **Refresh**.',
              ],
            },
            {
              kind: 'system',
              items: [
                'Any health note shows in red next to the camper\'s name.',
                'On camp days, **To do** and the bell count unaccounted campers on every page.',
                'Families see each roll call on their Home page, including "absent".',
              ],
            },
          ],
        },
        {
          id: 'admin-locked-out',
          title: 'When an admin is locked out of two-step sign-in',
          keywords: 'lost phone authenticator mfa reset 2fa new phone',
          body: [
            {
              kind: 'steps',
              items: [
                'Make sure it\'s really them asking, for example by phone.',
                'Another admin opens [[admin-users]]. Under **Admins**, their line says "Two-step sign-in: on" with **Reset**.',
                'Tap **Reset**, read the confirmation, and tap **Reset two-step**.',
                'Tell them to sign in again. They set up two-step sign-in from scratch with their new phone.',
              ],
            },
            {
              kind: 'system',
              items: [
                'Their old authenticator is removed and they\'re signed out everywhere. The reset is recorded in the audit log.',
                'Nobody can reset their own: someone else has to vouch for them.',
                'If the only admin is locked out, there\'s no way back in through the app. Someone with access to the camp\'s Supabase project has to remove the authenticator there. That\'s why you keep two admins.',
              ],
            },
          ],
        },
        {
          id: 'remove-admin',
          title: 'When someone should no longer be an admin',
          keywords: 'demote remove admin access leave',
          body: [
            {
              kind: 'steps',
              items: [
                'Open [[admin-users]] and find them under **Admins**.',
                'In their **Role** menu, choose **Parent** (or **Volunteer** if they\'ll crew), and confirm with **Make parent** (or **Make volunteer**).',
                'They lose the admin pages the next time they load a page.',
              ],
            },
            {
              kind: 'system',
              items: [
                'You can\'t change your own role, and the last admin can\'t be removed. Make someone else an admin first.',
                'The app can\'t delete accounts. As a parent, they only see their own family\'s details.',
              ],
            },
          ],
        },
        {
          id: 'opened-wrong-time',
          title: 'When registration opened at the wrong time',
          keywords: 'early open mistake switch opening time close',
          body: [
            {
              kind: 'steps',
              items: [
                'On [[admin-sessions]], turn **Families can register** off and tap **Close registration**. New sign-ups stop at once.',
                'Decide what to do with sign-ups that came in early: keep them, or on [[admin-students]] set each one\'s **Status** to **Cancelled** and confirm (each family gets a cancellation email queued, and the seat is offered to that section\'s waitlist).',
                'Set the right **Opening time (Denver)** and tap **Save settings**.',
                'Turn **Families can register** back on. The line under it should read "Opens by itself" with the right time.',
                'Post an update to explain if families noticed (see [Updates and email](/admin/help#updates-and-email)).',
              ],
            },
            { kind: 'p', text: 'If only the time was wrong and it hasn\'t passed yet, just change **Opening time (Denver)** and save: nobody can register before it.' },
          ],
        },
      ],
    },
  ],
}
