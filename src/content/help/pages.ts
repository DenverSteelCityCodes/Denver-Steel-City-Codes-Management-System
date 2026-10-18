// The app pages help text links to, by the names people see in the menus today. Help writes
// [[students]] rather than "/admin/students", so when a page is renamed or moved it changes here
// once. The help tests check every `to` against the routes in App.tsx.

export interface HelpPage {
  label: string
  to: string
}

export const PAGES = {
  // Admin (menu labels in AdminLayout; Today is the Dashboard item)
  'admin-today': { label: 'Today', to: '/admin' },
  'admin-updates': { label: 'Updates', to: '/admin/updates' },
  'admin-students': { label: 'Students', to: '/admin/students' },
  'admin-volunteers': { label: 'Volunteers', to: '/admin/volunteers' },
  'admin-applications': { label: 'Volunteers › Applications', to: '/admin/volunteers?tab=applications' },
  'admin-users': { label: 'Users & roles', to: '/admin/users' },
  'admin-attendance': { label: 'Attendance', to: '/admin/attendance' },
  'admin-classes': { label: 'Classes', to: '/admin/classes' },
  'admin-sessions': { label: 'Sessions', to: '/admin/sessions' },
  'admin-duties': { label: 'Duty schedule', to: '/admin/duties' },
  'admin-interviews': { label: 'Interviews', to: '/admin/interviews' },
  'admin-forms': { label: 'Form editor', to: '/admin/forms' },
  'admin-help': { label: 'Admin help', to: '/admin/help' },

  // Parent (top tabs and the avatar menu in ParentLayout)
  'parent-home': { label: 'Home', to: '/parent' },
  'parent-classes': { label: 'Classes', to: '/parent/classes' },
  'parent-updates': { label: 'Updates', to: '/parent/updates' },
  'parent-family': { label: 'Family details', to: '/parent/family' },
  'parent-register': { label: 'Register a new camper', to: '/parent/register' },
  'parent-help': { label: 'Help', to: '/parent/help' },

  // Volunteer (top tabs and the avatar menu in VolunteerLayout)
  'volunteer-today': { label: 'Today', to: '/volunteer' },
  'volunteer-classes': { label: 'Classes', to: '/volunteer/classes' },
  'volunteer-duties': { label: 'Duties', to: '/volunteer/duties' },
  'volunteer-updates': { label: 'Updates', to: '/volunteer/updates' },
  'volunteer-profile': { label: 'My profile and availability', to: '/volunteer/profile' },
  'volunteer-help': { label: 'Help', to: '/volunteer/help' },

  // Signed out
  'login': { label: 'Sign in', to: '/login' },
  'forgot': { label: 'Forgot password', to: '/forgot' },
  'signup': { label: 'Create an account', to: '/signup' },
  'apply': { label: 'Volunteer application', to: '/apply' },
} satisfies Record<string, HelpPage>

export type PageKey = keyof typeof PAGES
