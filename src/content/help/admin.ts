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
                'On a laptop the menu down the left lists the five jobs (Today, Campers, Classes, Volunteers, Updates) and Setup, with each job\'s other pages under it: Attendance under Today, Interviews and Duties under Volunteers, Forms and Users & roles under Setup. On a phone the same six are tabs along the top, and the page you\'re on shows its other pages just below them.',
                'The bell in the top bar holds the same to-do list on every page, and the newest updates.',
                'The search box in the top bar finds pages (old names like Students or Sessions work too), classes, campers and volunteer applicants.',
                'Your name, **Dark mode** and **Sign out** are in the menu under your initials. Help is at the bottom of the left menu on a laptop, and in the menu under your initials on a phone.',
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
                'Open [[admin-users]] and tap **Parents**, or search their name or email.',
                'Tap **Change role** on their line and choose **Admin**.',
                'Read the confirmation under their name: they\'ll see every camper\'s details and can change anything, including other people\'s roles. Tap **Make admin**.',
                'Tell them to reload the page or sign in again: the change applies the next time they load a page. They\'re sent straight to **Set up two-step sign-in** and need an authenticator app on their phone (see [Sign in and two-step sign-in](/admin/help#getting-started)).',
                'Check [[admin-users]]: under **Admins**, their line says "two-step sign-in on" once they\'ve finished, and "two-step sign-in not set up" until then.',
              ],
            },
            {
              kind: 'system',
              items: [
                'If they were a volunteer, the confirmation names the class crews they\'ll leave. Their crew spots and upcoming duty slots are cleared in the same step.',
                'Nobody can change their own role, and the last admin can\'t be changed: their line says "Only admin, so the role stays". The database refuses it too.',
              ],
            },
          ],
        },
        {
          id: 'users-and-roles',
          title: 'Users & roles',
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
            { kind: 'p', text: 'To change a role, tap **Change role** on the person\'s line on [[admin-users]], pick the new role and confirm. The confirmation says what changes for them before anything happens.' },
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
                'On [[admin-sessions]], under **Weeks**, tap **Add a week** for each camp week. Give it a name (for example "Week 1"), a start and end date and the place, leave **Visible to families** ticked, and tap **Add week**. Week 1 and Week 2 are that year\'s first and second sessions by start date.',
                'Under each week, open **Daily schedule** and tap **Add a time block** (drop-off, lunch, pickup). Families see it on Home. Once one week has a schedule, the other week offers **Copy from** that week.',
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
                'A section left on **Both weeks** isn\'t tied to a camp week: it never appears on the attendance board and its crew never get a roll call. Pick Week 1 or Week 2.',
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
          keywords: 'applicant accept reject interview slot crew lead support auto-assign fill open spots matcher duty',
          body: [
            {
              kind: 'steps',
              heading: 'Applications',
              items: [
                'On [[admin-applications]], tap **Open applications** to start taking them at /apply. **Close applications** stops them.',
                'The list starts on **Pending**. Tap an applicant to read their application.',
                'To accept, choose **Junior** or **Senior** under **Accept as**, then tap the button that names them, for example **Accept Riley as junior**. Seniors can lead a class; juniors support. To turn them down, tap **Reject**, add a reason if you like, and tap **Reject Riley** to confirm.',
              ],
            },
            {
              kind: 'steps',
              heading: 'Interviews',
              items: [
                'On [[admin-interviews]], add times under **Slots** (date, Denver time, minutes) and tap **Add slot**.',
                'Applicants book and move their own interview from their application page. You can also book them yourself: under **Needs a time**, pick an open time next to their name and tap **Book**, or tap **Book** on an open slot and pick an applicant.',
                'After the interview, tap **Notes** on the booking, write the **Interview notes** and tap **Save notes**.',
                'Give each time its meeting link: fill **Meeting link** when you add slots (it stays filled for the next one), or tap **Link** on a slot. Only the applicant booked into that time sees it.',
                'If someone hasn\'t picked a time, tap **Nudge** next to their name under **Needs a time** to email them a reminder (once a day).',
              ],
            },
            {
              kind: 'steps',
              heading: 'Crews',
              items: [
                'To fill empty spots automatically, open [[admin-crew]] and use **Fill open spots**: pick the week and tap **Preview matches**. Check the table, then tap **Apply assignments**.',
                'To set a crew by hand, select the section on [[admin-classes]] (it sits in its week\'s column), open **Edit**, and choose the **Lead** and **Supports**. Each name says their level, whether they\'re free that week and what they already crew; free people are listed first. Tap **Save** (the button names the section).',
                'Daily jobs live on [[admin-duties]]: add a type under **Duty types**, then under **Add a duty slot** pick the duty, the date and how many volunteers, and tap **Add slot**. The grid shows each day\'s names, and "1 open" where a spot is free. Volunteers sign up themselves, and can drop a duty until 3 days before it. **Lock** on a slot stops volunteers joining or dropping it; you can still change it.',
                'To make everyone take a share, open **Duty rules** on [[admin-duties]]: set the duty minutes each volunteer needs per week (each duty type has a length, set in **Duty types**), the sign-up deadline and the drop lock, then tap **Save rules**. Volunteers still short get a reminder 2 days before the deadline. After it, **Short on duty minutes** lists them: choose a duty next to each name and tap **Assign**. They get an email.',
              ],
            },
            {
              kind: 'system',
              items: [
                'Accepting needs an account with the applicant\'s email; applying at /apply makes one. The app tells you if it\'s missing.',
                'Every decision is emailed to the applicant, one person per email: accepting sends a welcome with the onboarding checklist, rejecting a short, kind note (your reason stays with the admins).',
                'Applicants get an email when they book or move an interview (with a calendar invite), reminders 24 hours and 1 hour before, and an email when you add new times if they haven\'t booked yet (at most one a day).',
                '**Fill open spots** fills only empty spots: a senior as lead and a junior as support, from volunteers available that week who aren\'t on another crew that week. Existing crews are kept.',
                'Editing a section by hand doesn\'t check whether the volunteer is already on another crew that week. The **Week 1** and **Week 2** columns on [[admin-crew]] show who is where.',
              ],
            },
          ],
        },
        {
          id: 'loaner-laptops',
          title: 'Loaner laptops',
          keywords: 'laptop loaner chromebook queue cap hand out',
          body: [
            { kind: 'p', text: 'Families ask for a loaner laptop per camper and week, when they register or later on their Home page. Each week lends as many as you set; requests past that wait in a first-come queue. Loaners stay at camp.' },
            {
              kind: 'steps',
              items: [
                'Set each week\'s number on [[admin-sessions]]: tap **Edit** on the week and fill in **Loaner laptops**. The week\'s line shows how many are reserved, handed out and queued.',
                'Raising the number gives loaners to the queue at once, oldest request first, and emails those families. Lowering it takes nothing back.',
                'On [[admin-students]], the **Laptop** column and the CSV show each camper\'s laptop by week.',
                'On camp morning, tick each laptop as you hand it out under **Loaner laptops** on [[admin-attendance]].',
              ],
            },
            {
              kind: 'system',
              items: [
                'Cancelling a spot releases its laptop to the next camper in the queue. A laptop already handed out stays on the list until it\'s back.',
                'Families can release a laptop or leave the queue online until the week starts; after that, changes happen at check-in.',
              ],
            },
          ],
        },
        {
          id: 'volunteer-onboarding',
          title: 'Volunteer onboarding: the checklist, overdue items and removing someone',
          keywords: 'onboarding checklist overdue discord remind folder remove season removed photo bio meet the teachers',
          body: [
            {
              kind: 'steps',
              heading: 'The checklist',
              items: [
                'Open [[admin-onboarding]]. Under **Checklist items**, each item has what to do, an optional link and how many hours after acceptance it\'s due.',
                'To add one, fill **What to do**, **Link** (https://, or a page here like /volunteer/profile) and **Due within (hours)**, then tap **Add item**. **Edit** and **Delete** change or remove an item.',
                'Volunteers tick items on their Today page. Under **Every volunteer**, tap a name to see their list: **Mark done** ticks an item for them, **Confirm** checks one they ticked, **Undo** clears it.',
              ],
            },
            {
              kind: 'steps',
              heading: 'Overdue and removal',
              items: [
                '**Overdue** lists every item past its due time, by volunteer. It also shows on [[admin-today]].',
                'If someone has to come off the crew, tap **Remove from the season** under their name, write the **Reason** and tap **Remove** with their name. Their class spots and upcoming duties open up, they lose the volunteer pages, and they get an email with your reason.',
                'Fill the open spots on [[admin-crew]]. **Removed this season** keeps who was removed and why, with their history.',
              ],
            },
            {
              kind: 'system',
              items: [
                'An item is due its hours after the volunteer was accepted, or after the item was added if that came later. Volunteers accepted before the checklist existed have nothing overdue.',
                'Every change a removal makes carries the reason into History, so a section\'s History tab shows who left its crew and why.',
                'Accepting a new application from a removed volunteer puts them back on the crew.',
                'Parents with a camper in a week see that week\'s crew on their Meet the teachers page: preferred names, how to say them, bios, and photos only where the volunteer (and a guardian, under 18) agreed.',
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
                'Open [[admin-attendance]]. The sign at the top counts what needs you: campers unaccounted (in red), or sections with no roll call yet. Its first line says how many campers were present at the latest roll call, out of everyone today.',
                'Under **All sections**, problem sections come first. Each row shows the room, the lead and every roll call: "All 12 accounted for", "8/10 · 2 unaccounted", **No roll call yet** or "Later". Tap a section to see each camper\'s marks.',
                'Sections with **No roll call yet** are also listed with their room and lead, so you know who to call.',
                '**Unaccounted now** lists every missing camper across all sections, with their section, room, lead, any health note and a call link for each contact (for example **Call Linh Tran (parent)**). On a phone these dial straight away.',
                'For paper backups, open a section and tap **Print roster**. At the end of the week, open **Week export** at the bottom and tap **Download attendance CSV**.',
                'Crews can tag a mark **Late**, **Left early** or **Picked up by** someone. The tags show under the camper\'s name when you open a section, on **Unaccounted now** and in the CSV\'s **Notes** column.',
                '**Loaner laptops** lists each section\'s borrowed laptops. Tick a camper\'s box as you hand theirs out; untick it if you ticked the wrong one.',
              ],
            },
            {
              kind: 'system',
              items: [
                'Unaccounted means not marked present at the latest roll call taken in that section: marked absent ("Missed") or not marked at all ("Not marked at").',
                'The board refreshes every minute and when you come back to the tab; **Refresh now** reloads it at once.',
                'On camp days, **To do** and the bell show how many campers are unaccounted, or how many sections have no roll call yet.',
                'Admins can\'t mark roll call here. If a camper turns out to be in the room, the crew marks them on their Today page.',
              ],
            },
          ],
        },
        {
          id: 'dismissal-pickups',
          title: 'Dismissal: who collected each camper',
          keywords: 'pickup pick up collect release walk bike transit home alone consent admin ok dismissal csv',
          body: [
            { kind: 'p', text: 'Families list the adults who may collect each camper, and can say a camper may walk, bike or take transit home on their own, for a whole week or named days. At dismissal the crew taps who collected each camper.' },
            {
              kind: 'steps',
              items: [
                'Open [[admin-attendance]]. Under **Dismissal**, **Not collected yet** lists every camper still in a room whose dismissal has started, with who may collect them and their numbers.',
                'When a crew member calls about an adult who isn\'t on the list (or a camper leaving alone without consent for today), call the family. If it\'s fine, tell the crew to tap **An admin said OK**.',
                '**Released on an admin\'s OK** lists those releases and who recorded them, so you can follow up with the family.',
                'The **Week export** CSV has a **Collected by** column for each camper and day.',
              ],
            },
            {
              kind: 'system',
              items: [
                'The crew can\'t record a camper leaving on their own without the parent\'s consent for that day, or with an adult who isn\'t on that day\'s list, except as admin OK.',
                'Families change pickups on their Home page until the week ends. During camp week the section\'s lead gets an email about each change.',
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
                'On [[admin-updates]], choose who it goes to under **Send to**: everyone this season, this season\'s parents, all volunteers, one week\'s families, one week\'s crew, or one section\'s families.',
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
                'An urgent notice is different: the app emails it itself. See [when something urgent happens](/admin/help#urgent-notice).',
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
                '[[admin-emails]] lists the newest 50.',
                '**Waiting** means not sent yet. Waiting emails only go out once the camp\'s email service is connected; if they stay waiting, it isn\'t yet.',
                '**Sent** went out; **Failed** is retried twice, then shows on **To do**; **Skipped** had no address it could send to (demo addresses at example.com are skipped).',
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
                'Or fill every empty spot at once: on [[admin-crew]], use **Fill open spots** for that week, **Preview matches**, then **Apply assignments**.',
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
                'Look for their email on [[admin-emails]]: **Waiting** (not sent yet), **Sent**, **Failed** or **Skipped** (no usable address).',
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
          id: 'course-rules',
          title: 'When a family asks for an exception to a class\'s rules',
          keywords: 'prerequisite grade rule exception microcontrollers intermediate python place with friend sibling at risk',
          body: [
            { kind: 'p', text: 'A class can be limited to some grades (the grade the camper enters this fall) and can need another class first: a seat in it in an earlier week, or in a past summer. Set them under **Who can take it** when you edit the class on [[admin-classes]]. Families can\'t sign up or switch past them; the database refuses it.' },
            {
              kind: 'steps',
              heading: 'An exception request',
              items: [
                'It shows under **Change requests** on [[admin-students]], with the class, its rules and the camper\'s grade.',
                'To agree, open the camper below and use **Move to** to move their class that week into the one they asked for (admin moves skip the rules), then **Mark done**. To say no, **Decline**. Either way the family gets an email with your reply.',
                'A camper with no class that week has nothing to move yet: reply and ask the family to sign up for another class that week first.',
              ],
            },
            {
              kind: 'system',
              items: [
                '"Prerequisite at risk" on Today means a camper\'s earlier-week prerequisite was cancelled, or they missed every arrival roll call in it so far. Check with the family before their next class starts.',
                'Families can ask to be placed with a friend or sibling. Their request shows in each section\'s roster on [[admin-classes]], on the camper on [[admin-students]] and in its CSV.',
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
                'Open [[admin-attendance]]. The camper is listed under **Unaccounted now** with "Missed" or "Not marked at" and the roll call.',
                'Check with the section\'s lead first (the board shows their name). "Not marked" often means the crew hasn\'t tapped them yet.',
                'If the camper isn\'t there, tap a call link under their name (the emergency contact or the parent), right on the board.',
                'If they turn up, ask the crew to mark them present. The board updates within a minute, or tap **Refresh now**.',
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
          id: 'urgent-notice',
          title: 'When something urgent happens: a site hold, bad weather or an early dismissal',
          keywords: 'urgent emergency lockdown hold police weather storm early dismissal safety notice banner',
          body: [
            {
              kind: 'steps',
              items: [
                'Open [[admin-updates]]. Under **Send to**, pick who needs to know: usually **One week\'s families** and that week.',
                'Tick **Urgent safety notice**. Tap **Site hold**, **Weather** or **Early dismissal** to start from a prewritten message, then fill in the details (times, places).',
                'Tap **Send urgent notice**, read the sentence that appears under it, and tap **Send now**.',
              ],
            },
            {
              kind: 'system',
              items: [
                'The app emails every person in that audience at once, one email each, even people who turned off camp announcements. Urgent emails go before anything else waiting to send.',
                'It also shows in red at the top of their Home (parents) or Today (volunteers) page until midnight, Denver time.',
                'Only admins can send one. A sent email can\'t be taken back: to correct it, send another.',
                'Each email shows on [[admin-emails]] as **Urgent notice**.',
              ],
            },
          ],
        },
        {
          id: 'incident',
          title: 'When something happens to a camper: the incident log',
          keywords: 'incident injury behavior bullying conduct safety report log notify parent family tell',
          body: [
            { kind: 'p', text: 'Crews log injuries, behavior problems and anything unsafe from their Classes page, for their own section. Each crew member sees only their own entries; you see them all.' },
            {
              kind: 'steps',
              items: [
                'Open [[admin-attendance]] and scroll to **Incidents**, newest first. Each entry says what happened, what the crew did, the camper, the class, when and who logged it.',
                'To let the family know, tap **Tell the family**, write what they should hear in your own words, and tap **Email the family**.',
                'The entry then says **Family told** with the time. It can only be sent once.',
              ],
            },
            {
              kind: 'system',
              items: [
                'The email names the camper, the class, the day and the kind of incident, then your message. The crew\'s description is never sent.',
                'An entry about a camper with no word to the family after a day shows on **To do** and in the bell.',
                'Entries can\'t be deleted. Every change is kept in the history.',
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
                'Another admin opens [[admin-users]]. Under **Admins**, their line says "two-step sign-in on" and has **Reset two-step**.',
                'Tap **Reset two-step**, read the confirmation under their name, and tap **Reset two-step** in it.',
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
                'Tap **Change role**, choose **Parent** (or **Volunteer** if they\'ll crew), and confirm with **Make parent** (or **Make volunteer**).',
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
