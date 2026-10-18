import type { HelpGuide } from './types'

// /parent/help. Short and task-first for families on a phone. Every step matches the parent
// pages as they are (SignupPage, ParentRegistrationPage, ClassBrowser, ConfirmOnboardingPanel,
// ParentDashboard, CamperRow, ParentFamily, ParentUpdates). Nothing here promises an email: the
// camp's automatic emails only go out once its email provider is connected.

export const PARENT_GUIDE: HelpGuide = {
  role: 'parent',
  path: '/parent/help',
  title: 'Help',
  intro: 'Quick answers for families. Tap a question to open it. Still stuck? Email the camp at denver@steelcitycodes.org.',
  sections: [
    {
      id: 'signing-up',
      title: 'Signing up',
      topics: [
        {
          id: 'register-a-camper',
          title: 'Register a camper',
          keywords: 'sign up enroll wizard new camper',
          body: [
            {
              kind: 'steps',
              items: [
                'On [[parent-home]], tap **Start registering**. For another child later, open the menu under your initials and tap [[parent-register]].',
                'Fill in the five steps: the camper, you and an emergency contact, health and details, the week and class, and the waiver.',
                'On the week and class step, pick a week, then one class. Classes that don\'t fit your camper\'s age or grade, or that need another class first, are shown but locked with the reason.',
                'Tap **Submit registration**.',
              ],
            },
            {
              kind: 'system',
              items: [
                'If the class has a free seat, the spot is confirmed straight away: you\'ll see "You\'re in!".',
                'If it\'s full, your camper joins its waitlist: you\'ll see "You\'re on the waitlist".',
                'Your answers are saved on this phone or computer as you go, so you can tap **Save and exit** and finish later. Signatures aren\'t saved; you type them again at the end.',
              ],
            },
          ],
        },
        {
          id: 'before-opening',
          title: 'Registration isn\'t open yet',
          keywords: 'countdown opening time early',
          body: [
            { kind: 'p', text: 'Home shows when registration opens (Denver time) and a countdown. Spots are first come, first served.' },
            { kind: 'p', text: 'You can start the form ahead of time: the first steps are saved on this device. The week and class step waits until registration opens, then you can finish and submit.' },
          ],
        },
        {
          id: 'another-class',
          title: 'Sign up a camper you\'ve registered before',
          keywords: 'returning camper second week another class quick check',
          body: [
            {
              kind: 'steps',
              items: [
                'Open [[parent-classes]]. Under **Who is it for?**, pick your camper, and pick the week if there\'s a choice.',
                'Only classes that fit your camper are listed. Tap the **Register** button under the one you want (it shows your camper\'s name), or **Join the waitlist** if the class is full.',
                'Once each summer you\'re asked to check your camper\'s details first. Look them over, type your full legal name to sign again, tick the box and tap **Confirm and register**.',
              ],
            },
            { kind: 'p', text: 'Campers take one class a week. If your camper already has a class that week, switch it from Home instead.' },
          ],
        },
        {
          id: 'class-locked',
          title: 'A class is locked for your camper',
          keywords: 'grade prerequisite exception locked microcontrollers intermediate python repeat friend sibling place with',
          body: [
            { kind: 'p', text: 'Some classes are for certain grades (the grade your camper enters this fall), and some need another class first, earlier in the summer or in a past summer. A locked class says which.' },
            {
              kind: 'steps',
              heading: 'Think your camper is ready anyway?',
              items: [
                'Under the locked class, tap **Request an exception**.',
                'Tell the camp why (for example, a class they took at school), then tap **Send to the camp**. In the registration form, also pick a class for that week: the request goes with your registration when you submit.',
                'The camp reads every request and emails you. If they agree, they move your camper from their class that week into the one you asked for.',
              ],
            },
            {
              kind: 'list',
              items: [
                'Picking the same class for both weeks is allowed. You\'ll see a note suggesting the next class to try.',
                'To ask for your camper to be placed with a friend or sibling, fill in the last question on the week and class step. Until online changes close, change it from your camper on [[parent-home]].',
              ],
            },
          ],
        },
        {
          id: 'forgot-password',
          title: 'You forgot your password',
          keywords: 'reset password sign in',
          body: [
            {
              kind: 'steps',
              items: [
                'On the sign-in page, tap **Forgot password?**.',
                'Enter your email and tap **Send reset link**.',
                'Open the newest email and use its link within an hour. Each link works once.',
                'Choose a new password and tap **Save new password**.',
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'changes',
      title: 'Changes and waitlists',
      topics: [
        {
          id: 'spot-offered',
          title: 'A spot opened up for your camper',
          keywords: 'waitlist offer claim decline deadline',
          body: [
            { kind: 'p', text: 'When a seat frees up, the camp offers it to the next camper on that class\'s waitlist. Campers whose class the camp cancelled go first; after that it\'s the order families joined.' },
            {
              kind: 'steps',
              items: [
                'Open [[parent-home]]. The offer is at the top, with the time it ends (Denver time).',
                'Tap **Claim the spot** to take it. Your camper is confirmed straight away.',
                'Don\'t want it? Tap **Decline**, then **Decline spot**.',
              ],
            },
            {
              kind: 'system',
              items: [
                'If you don\'t answer in time, the offer ends and the spot goes to the next family. Your camper leaves that waitlist.',
                'Claiming a spot takes your camper off any other waitlist that week, since campers take one class a week.',
              ],
            },
          ],
        },
        {
          id: 'cancel-or-switch',
          title: 'Cancel or switch a class',
          keywords: 'drop change move class deadline',
          body: [
            {
              kind: 'steps',
              items: [
                'On [[parent-home]], tap your camper.',
                'Under the class, it says until when you can switch or cancel online.',
                'To move to another class the same week, tap **Switch class**, pick a class with spots left, then tap **Switch class** again to confirm.',
                'To give up the spot, tap **Cancel this spot**, then **Cancel spot**.',
              ],
            },
            {
              kind: 'system',
              items: [
                'The seat you leave goes to the next family on that class\'s waitlist.',
                'You can only switch to a class with a free seat that fits your camper. To change weeks, cancel and sign up for the other week.',
              ],
            },
          ],
        },
        {
          id: 'after-deadline',
          title: 'You need a change after the online deadline',
          keywords: 'late change request deadline passed',
          body: [
            {
              kind: 'steps',
              items: [
                'On [[parent-home]], tap your camper.',
                'Tap **Request a change**.',
                'Say what you\'d like to change and tap **Send to the camp**.',
              ],
            },
            { kind: 'p', text: 'The camp sees your request and gets back to you. Nothing changes until they make the change.' },
          ],
        },
        {
          id: 'leave-waitlist',
          title: 'Leave a waitlist',
          keywords: 'waitlist remove',
          body: [
            { kind: 'p', text: 'On [[parent-home]], tap your camper, tap **Leave the waitlist**, then **Leave waitlist**. You can do this at any time.' },
          ],
        },
        {
          id: 'update-details',
          title: 'Update contact, health or emergency details',
          keywords: 'phone email allergy medical grade edit',
          body: [
            {
              kind: 'steps',
              items: [
                'Open the menu under your initials and tap [[parent-family]].',
                'For your own details, tap **Edit**. For a camper, open them and tap the **Edit** button with their name.',
                'Change what you need and tap **Save**.',
              ],
            },
            { kind: 'p', text: 'The email here is where the camp writes to you. It doesn\'t change the email you sign in with.' },
            { kind: 'p', text: 'If a new grade no longer fits your camper\'s class, the save is refused. Email the camp so they can move your camper first.' },
          ],
        },
      ],
    },
    {
      id: 'camp-week',
      title: 'Camp week',
      topics: [
        {
          id: 'home-in-camp-week',
          title: 'What Home shows during camp',
          keywords: 'this week room lead roll call checked in schedule',
          body: [
            {
              kind: 'list',
              items: [
                'Before camp: the day camp starts and the daily schedule.',
                'Each camp day: whether your camper has been checked in, their class, room and the lead\'s first name.',
                'The three roll calls (arrival, after lunch, dismissal) with the time your camper was marked, or "absent".',
              ],
            },
          ],
        },
        {
          id: 'updates',
          title: 'Read updates from the camp',
          keywords: 'news messages announcements',
          body: [
            { kind: 'p', text: 'Open [[parent-updates]]. The camp director and your camper\'s class lead post there. The tab shows a number when there\'s something new. Updates are for families with a confirmed spot this season.' },
          ],
        },
        {
          id: 'contact-camp',
          title: 'Contact the camp',
          keywords: 'email question help late absent',
          body: [
            { kind: 'p', text: 'Email denver@steelcitycodes.org. The address is also at the bottom of every page.' },
          ],
        },
      ],
    },
  ],
}
