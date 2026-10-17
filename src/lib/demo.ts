// Demo mode (portfolio / test environment): the login page offers one-click sign-in as each role.
// Enabled only when the build sets VITE_DEMO_MODE=true and provides the demo accounts — see
// .env.example. These accounts are public by design; the demo database is reset every night.
import type { LucideIcon } from 'lucide-react'
import { ShieldCheck, Heart, Users, ClipboardList } from 'lucide-react'

export interface DemoAccount {
  key: 'admin' | 'parent' | 'volunteer' | 'applicant'
  label: string
  blurb: string
  icon: LucideIcon
  tone: string
  email: string
  password: string
}

const env = import.meta.env

const ALL: DemoAccount[] = [
  {
    key: 'admin', label: 'Camp admin', icon: ShieldCheck, tone: 'bg-role-admin-soft text-role-admin',
    blurb: 'Run the camp: classes, rosters, volunteers, interviews.',
    email: env.VITE_DEMO_ADMIN_EMAIL, password: env.VITE_DEMO_ADMIN_PASSWORD,
  },
  {
    key: 'parent', label: 'Parent', icon: Heart, tone: 'bg-role-parent-soft text-role-parent',
    blurb: 'Three campers: one confirmed, one waitlisted, one to re-confirm.',
    email: env.VITE_DEMO_PARENT_EMAIL, password: env.VITE_DEMO_PARENT_PASSWORD,
  },
  {
    key: 'volunteer', label: 'Volunteer', icon: Users, tone: 'bg-role-volunteer-soft text-role-volunteer',
    blurb: 'Lead a section: take attendance, see allergies, pick duties.',
    email: env.VITE_DEMO_VOLUNTEER_EMAIL, password: env.VITE_DEMO_VOLUNTEER_PASSWORD,
  },
  {
    key: 'applicant', label: 'Volunteer applicant', icon: ClipboardList, tone: 'bg-warning-soft text-warning',
    blurb: 'Application under review, with an interview you can reschedule.',
    email: env.VITE_DEMO_APPLICANT_EMAIL, password: env.VITE_DEMO_APPLICANT_PASSWORD,
  },
]

export const DEMO_MODE = env.VITE_DEMO_MODE === 'true'
export const DEMO_ACCOUNTS: DemoAccount[] = DEMO_MODE ? ALL.filter(a => a.email && a.password) : []
