import { Link } from 'react-router-dom'
import {
  GraduationCap, Users, LayoutGrid, List, CalendarDays, Shield, Settings2, Mic,
  CircleCheck, Clock, ClipboardCheck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAdminStats } from '../hooks/useAdminStats'
import { useVolunteerApplications } from '../hooks/useVolunteerApplications'
import { useAuth } from '../context/AuthContext'
import StatCard from '../components/StatCard'
import AdminNeedsAttention from '../components/AdminNeedsAttention'

function greeting(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

interface QuickLink {
  to: string
  label: string
  desc: string
  icon: LucideIcon
}

const QUICK_LINKS: QuickLink[] = [
  { to: '/admin/attendance', label: 'Attendance', desc: "Today's roll calls and who's unaccounted for.", icon: ClipboardCheck },
  { to: '/admin/classes', label: 'Classes', desc: 'Create, edit, set capacity.', icon: LayoutGrid },
  { to: '/admin/volunteers', label: 'Volunteers', desc: 'Roster, assignments, applications.', icon: Users },
  { to: '/admin/students', label: 'Students', desc: 'Manage registrations and rosters.', icon: GraduationCap },
  { to: '/admin/users', label: 'Users & roles', desc: 'Promote, demote, manage accounts.', icon: Shield },
  { to: '/admin/sessions', label: 'Sessions', desc: 'Manage camp sessions and dates.', icon: CalendarDays },
  { to: '/admin/duties', label: 'Duty schedule', desc: 'Daily volunteer duty slots.', icon: List },
  { to: '/admin/interviews', label: 'Interviews', desc: 'Schedule and record notes.', icon: Mic },
  { to: '/admin/forms', label: 'Form editor', desc: 'Configure fields and labels.', icon: Settings2 },
]

export default function AdminDashboard() {
  const { stats, loading } = useAdminStats()
  const { applications } = useVolunteerApplications()
  const { profile } = useAuth()

  const firstName = profile?.display_name?.split(' ')[0] ?? 'there'
  const ready = !loading && !!stats

  const dash = ready
    ? {
        students: stats.totalStudents,
        classes: stats.totalClasses,
        volunteers: stats.totalVolunteers,
        confirmed: stats.confirmedRegistrations,
        waitlisted: stats.waitlistedRegistrations,
      }
    : { students: '—', classes: '—', volunteers: '—', confirmed: '—', waitlisted: '—' }

  // Real, live context for the captions ------------------------------------
  const pendingReviews = applications.filter(a => a.status === 'pending').length
  const confirmedPct =
    ready && stats.totalRegistrations > 0
      ? Math.round((stats.confirmedRegistrations / stats.totalRegistrations) * 100)
      : null

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10 space-y-10">
      {/* Greeting */}
      <div>
        <h1 className="font-sans font-bold text-[40px] leading-[46px] tracking-[-0.01em] text-ink mb-1">
          {greeting(new Date().getHours())}, {firstName}
        </h1>
        <p className="font-slab text-ink-muted text-lg">Manage classes, volunteers, and registrations.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard label="Students" value={dash.students} icon={GraduationCap} />
        <StatCard
          label="Classes"
          value={dash.classes}
          icon={LayoutGrid}
          iconColor="text-info"
          iconBg="bg-info-soft"
        />
        <StatCard
          label="Volunteers"
          value={dash.volunteers}
          icon={Users}
          iconColor="text-role-volunteer"
          iconBg="bg-role-volunteer-soft"
          delta={
            ready
              ? pendingReviews > 0
                ? { text: `${pendingReviews} pending review`, tone: 'warn', icon: Clock }
                : { text: 'All applications reviewed', tone: 'muted' }
              : undefined
          }
        />
        <StatCard
          label="Confirmed"
          value={dash.confirmed}
          icon={CircleCheck}
          iconColor="text-success"
          iconBg="bg-success-soft"
          delta={
            confirmedPct !== null
              ? { text: `${confirmedPct}% of registrations`, tone: 'muted' }
              : undefined
          }
        />
        <StatCard
          label="Waitlisted"
          value={dash.waitlisted}
          icon={List}
          iconColor="text-ink-muted"
          iconBg="bg-surface-sunken"
          delta={ready ? { text: 'Awaiting open seats', tone: 'info' } : undefined}
        />
      </div>

      {/* Needs attention — the real work queue, above secondary navigation */}
      <AdminNeedsAttention />

      {/* Jump to — calm, neutral secondary nav (single gold hover accent) */}
      <div>
        <h2 className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted mb-3">Jump to</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {QUICK_LINKS.map(({ to, label, desc, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group bg-surface border border-border rounded-xl shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:-translate-y-px transition"
            >
              <div className="w-11 h-11 rounded-full bg-surface-sunken flex items-center justify-center shrink-0 transition group-hover:bg-brand-soft">
                <Icon size={20} className="text-ink-muted transition group-hover:text-warning" />
              </div>
              <div>
                <h3 className="font-sans font-semibold text-sm text-ink mb-0.5">{label}</h3>
                <p className="font-sans text-xs text-ink-muted">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
