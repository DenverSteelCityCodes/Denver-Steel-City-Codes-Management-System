import type { HelpGuide } from './types'

// /volunteer/help. Short and task-first: many volunteers are teenagers reading on a phone in a
// classroom. Every step matches the volunteer pages as they are (VolunteerToday, RollCallPanel,
// VolunteerClasses, VolunteerDuties, VolunteerSelfService, VolunteerApplicant).

export const VOLUNTEER_GUIDE: HelpGuide = {
  role: 'volunteer',
  path: '/volunteer/help',
  title: 'Help',
  intro: 'How to do the things you came here for. Tap a question to open it.',
  sections: [
    {
      id: 'camp-week',
      title: 'Camp week',
      topics: [
        {
          id: 'take-roll-call',
          title: 'Take roll call',
          keywords: 'attendance present absent arrival lunch dismissal mark all',
          body: [
            { kind: 'p', text: 'Roll call happens three times a day: **Arrival**, **After lunch** and **Dismissal**. Leads and supports can both take it.' },
            {
              kind: 'steps',
              items: [
                'Open [[volunteer-today]]. On a camp day your class and its roll call are at the top.',
                'Check the roll call tab. It picks the one for the time of day (Arrival until 11:30, After lunch until 2:30, then Dismissal). Tap another tab to switch.',
                'If everyone is in the room, tap the **Mark all** button, then tap whoever is missing to mark them **Absent**.',
                'Or go down the list: tap **Mark present** for each camper. Tapping again switches between **Present** and **Absent**.',
              ],
            },
            {
              kind: 'system',
              items: [
                'Every tap saves on its own. There is no submit button.',
                'When everyone has a mark, the band says the roll call is done, with how many were present and absent.',
                'Admins see your marks on their attendance board. Anyone not marked present shows up there as unaccounted.',
              ],
            },
            {
              kind: 'steps',
              heading: 'Add a note: late, left early, picked up',
              items: [
                'Mark the camper first. Then tap **Add notes: late, left early, picked up** above the list.',
                'Tap **Late** or **Left early** under the camper. To say who picked them up, type the name under **Picked up by** and tap **Save**.',
                'Tap **Done adding notes** to go back to the plain list. The note stays under the camper\'s name, and admins see it on their board.',
              ],
            },
          ],
        },
        {
          id: 'log-incident',
          title: 'Log an incident',
          keywords: 'incident injury hurt behavior bullying unsafe report admin',
          body: [
            { kind: 'p', text: 'If a camper gets hurt, something unsafe happens, or there\'s a behavior problem in your class, write it down while it\'s fresh. In an emergency, get help first.' },
            {
              kind: 'steps',
              items: [
                'Open [[volunteer-classes]] and find your class.',
                'Under **Incidents**, tap **Log an incident**.',
                'Pick the camper (or none), what happened and what you did, check the time, and describe it. Stick to what you saw.',
                'Tap **Save to the log**.',
              ],
            },
            {
              kind: 'system',
              items: [
                'Admins see it right away and decide whether to tell the family. If they do, they write the email themselves; what you wrote isn\'t sent.',
                'You see only your own entries, and you can\'t change one after saving. Tell an admin if something needs fixing.',
              ],
            },
          ],
        },
        {
          id: 'dismissal-pickup',
          title: 'At dismissal: record who collected each camper',
          keywords: 'pickup pick up release collect parent grandparent walk bike transit home alone admin ok',
          body: [
            { kind: 'p', text: 'A camper goes home only with their parent, an adult the parent listed for today, or on their own when the parent said yes for today. At dismissal you record who collected each camper.' },
            {
              kind: 'steps',
              items: [
                'On the **Dismissal** tab, mark everyone present as usual. Each present camper then asks **Who\'s collecting** them.',
                'When an adult arrives, tap their name: the parent, or an adult on today\'s list ("today only" means the parent added them just for today). If the parent said the camper may go on their own today, tap **Walking home** (or biking, or transit).',
                'Someone who isn\'t on the list? Tap **Someone else**, type their name and check with an admin before the camper leaves. If the admin says it\'s fine, tap **An admin said OK**. The same goes for **On their own** when the parent hasn\'t said yes for today.',
                'Tapped the wrong one? Tap **Undo** next to "Collected by".',
              ],
            },
            {
              kind: 'system',
              items: [
                'The list under each camper is today\'s. Families can change it until the week ends, even on the day, and the lead gets an email when they do.',
                'Leads see a call link for each adult on the list.',
                'Admins see who hasn\'t been collected yet, and every admin OK, on their attendance board.',
              ],
            },
          ],
        },
        {
          id: 'roll-call-save-failed',
          title: 'A roll call tap says "Couldn\'t save"',
          keywords: 'error offline wifi connection',
          body: [
            { kind: 'p', text: 'The tap didn\'t reach the camp\'s system, so the row went back to how it was. Nothing is saved for later: you need to tap it again.' },
            {
              kind: 'steps',
              items: [
                'Check your phone has signal or wifi.',
                'Tap the camper again.',
                'If the list looks out of date, tap **Refresh** under it.',
              ],
            },
          ],
        },
        {
          id: 'allergies-and-calls',
          title: 'Find allergies and who to call',
          keywords: 'health medical emergency phone parent roster',
          body: [
            {
              kind: 'steps',
              items: [
                'Open [[volunteer-classes]]. Your class roster lists every camper.',
                'Allergies and medical notes are in red under the camper\'s name. The line at the top names every camper who has one.',
                'Each camper has call links: the emergency contact first, then the parent if their number is different. Tap one to call.',
              ],
            },
            { kind: 'p', text: 'During roll call, campers you mark **Absent** show their call links right in the list.' },
            { kind: 'p', text: 'If a camper says "No phone number on file", tell an admin.' },
            { kind: 'p', text: 'A camper borrowing one of the camp\'s laptops that week says **Loaner laptop to hand out** (or **handed out**). Loaners stay at camp.' },
          ],
        },
        {
          id: 'paper-roster',
          title: 'Print a paper roster',
          keywords: 'print backup paper sheet',
          body: [
            {
              kind: 'steps',
              items: [
                'Open [[volunteer-classes]] and tap **Paper roster**.',
                'Tap **Print**. The sheet has health notes, emergency contacts, who borrows a loaner laptop and boxes for each roll call.',
              ],
            },
            { kind: 'p', text: 'The sheet is for camp staff only. Shred it after the camp week.' },
          ],
        },
        {
          id: 'post-to-families',
          title: 'Post an update to your class\'s families',
          keywords: 'message announce parents lead',
          body: [
            { kind: 'p', text: 'Only a class\'s lead can post to its families.' },
            {
              kind: 'steps',
              items: [
                'Open [[volunteer-updates]] and tap **Post to your class\'s families** (or tap **Post to families** on [[volunteer-classes]]).',
                'Write the message and tap **Post update**. Families see it on their Updates tab.',
                'To email it too, tick **Also email them** before posting. Your own mail app opens with the families\' addresses, and you send it from there.',
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'plans-change',
      title: 'When plans change',
      topics: [
        {
          id: 'cant-make-it',
          title: 'You can\'t make a day',
          keywords: 'sick absent away day off cover',
          body: [
            {
              kind: 'steps',
              items: [
                'Open [[volunteer-profile]] from the menu under your initials.',
                'Under **Days you can\'t make it**, tap **Add a day**.',
                'Pick the first day, and the last day if it\'s more than one. Add a note if it helps.',
                'Tap **Tell the camp**.',
              ],
            },
            { kind: 'p', text: 'Admins see it on their to-do list so they can find cover for your class. If it\'s the same morning, also tell the camp directly so they hear in time.' },
            { kind: 'p', text: 'Changed your mind? Remove the day from the same list.' },
          ],
        },
        {
          id: 'switch-class',
          title: 'You want a different class',
          keywords: 'switch change section course',
          body: [
            { kind: 'p', text: 'Admins choose who teaches each class, but you can ask.' },
            {
              kind: 'steps',
              items: [
                'Open [[volunteer-profile]].',
                'Under **Switch classes**, tap **Ask to switch**.',
                'Say which class you\'d like and why, then tap **Send request**.',
              ],
            },
            { kind: 'p', text: 'An admin looks at it and gets back to you. Your class stays the same unless they change it.' },
          ],
        },
        {
          id: 'weeks-and-courses',
          title: 'Change your weeks or course choices',
          keywords: 'availability preferences week first choice',
          body: [
            {
              kind: 'steps',
              items: [
                'Open [[volunteer-profile]].',
                'Under **Availability and courses**, tap **Edit**.',
                'Tick the weeks you can help and pick a first and second course choice.',
                'Tap **Save availability**.',
              ],
            },
            { kind: 'p', text: 'Admins use these when they assign classes. They don\'t move you out of a class you already have; for that, ask to switch.' },
          ],
        },
        {
          id: 'duties',
          title: 'Sign up for a duty, or drop one',
          keywords: 'duty slot check-in lunch claim cancel',
          body: [
            {
              kind: 'steps',
              heading: 'To sign up',
              items: [
                'Open [[volunteer-duties]].',
                'Under **Find a duty**, pick a week and a day.',
                'Tap **Sign up** on a slot with a seat open.',
              ],
            },
            {
              kind: 'steps',
              heading: 'To drop one',
              items: [
                'On [[volunteer-duties]], tap **Cancel** on your duty.',
                'Tap **Drop duty** to confirm.',
              ],
            },
            { kind: 'p', text: 'A full slot can\'t take more people. Drop duties as early as you can so someone else can take them.' },
          ],
        },
      ],
    },
    {
      id: 'applying',
      title: 'Applying',
      topics: [
        {
          id: 'interview-time',
          title: 'Book or change your interview time',
          keywords: 'interview reschedule move',
          body: [
            {
              kind: 'steps',
              items: [
                'Sign in. Your application page shows your interview time.',
                'Tap **Change time** (or pick a time if you haven\'t booked one).',
                'Pick a new time, then tap the button that names it, like **Move to Thu, Oct 22, 4:30 PM** (or **Book …** if you hadn\'t booked one). Your current time is marked **Your time**. To keep it, tap **Keep** and your current time.',
              ],
            },
            { kind: 'p', text: 'Times are Denver time. If no times are open, we email you when new ones are posted.' },
            {
              kind: 'system',
              items: [
                'Booking or moving your time sends you an email with a calendar invite, and reminders come 24 hours and 1 hour before.',
                'The meeting link shows on your application page (**Join the interview**) and in those emails. It\'s just for you, so please don\'t share it.',
              ],
            },
          ],
        },
        {
          id: 'application-status',
          title: 'Where your application stands',
          keywords: 'accepted decision waiting status',
          body: [
            { kind: 'p', text: 'Your application page shows each step: application received, interview, decision, and your class.' },
            { kind: 'p', text: 'Once you\'re accepted, the page turns into your volunteer area with the Today, Classes, Duties and Updates tabs. An admin assigns your class before camp starts.' },
            { kind: 'p', text: 'Every decision comes by email too: accepted (with your onboarding checklist) or not this year.' },
          ],
        },
        {
          id: 'onboarding-checklist',
          title: 'Finish your onboarding checklist',
          keywords: 'checklist onboarding discord remind folder due overdue welcome',
          body: [
            {
              kind: 'steps',
              items: [
                'Open [[volunteer-today]]. **Your onboarding checklist** lists what the camp needs from you, each with when it\'s due (Denver time).',
                'Do each one. If it has a link, tap **Open the link** (or **Open it** for a page in this app).',
                'Tick the box next to it. To untick, tap it again.',
              ],
            },
            {
              kind: 'system',
              items: [
                'Each item is due a set time after you were accepted. Admins see anything past due.',
                '"Done, checked by the camp" means an admin confirmed it. The checklist leaves Today once everything is done.',
              ],
            },
          ],
        },
        {
          id: 'volunteer-profile',
          title: 'Fill in your profile and photo',
          keywords: 'profile bio photo picture preferred name pronunciation legal name consent guardian meet the teachers',
          body: [
            {
              kind: 'steps',
              items: [
                'Open [[volunteer-profile]] from your avatar.',
                'Under **Your volunteer profile**, tap **Fill in your profile** (or **Edit**).',
                'Add your **Preferred name**, **How to say it** if people often get it wrong, your **Legal name** and a **Short bio** (up to 300 characters).',
                'To add a photo, tap **Choose a photo**, then tick **Parents of campers in my weeks may see my photo.** If you\'re under 18, type the name of the parent or guardian who agrees.',
                'Tap **Save profile**.',
              ],
            },
            {
              kind: 'system',
              items: [
                'Parents of campers in your weeks see your preferred name, how to say it, your bio and (only with consent) your photo on their Meet the teachers page. Rosters use your preferred name.',
                'Your legal name is only for the camp\'s letters and your service-hours certificate.',
                'Untick the consent box, or tap **Remove photo**, and parents stop seeing it right away.',
              ],
            },
          ],
        },
      ],
    },
  ],
}
