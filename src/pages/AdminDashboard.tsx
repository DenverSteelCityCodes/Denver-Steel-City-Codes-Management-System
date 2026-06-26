import { Link } from 'react-router-dom'
import { GraduationCap, Users, ClipboardList, List, CalendarDays, Shield, Settings2, Mic } from 'lucide-react'
import { useAdminStats } from '../hooks/useAdminStats'
import StatCard from '../components/StatCard'

export default function AdminDashboard() {
  const { stats, loading } = useAdminStats()

  const dash = loading || !stats
    ? { students: '—', classes: '—', volunteers: '—', confirmed: '—', waitlisted: '—' }
    : {
        students: stats.totalStudents,
        classes: stats.totalClasses,
        volunteers: stats.totalVolunteers,
        confirmed: stats.confirmedRegistrations,
        waitlisted: stats.waitlistedRegistrations,
      }

  return (
    <div className="min-h-screen bg-bg">
      <main className="max-w-[1200px] mx-auto px-6 py-10 space-y-10">
        <div>
          <h1 className="font-sans font-bold text-3xl text-ink mb-1">Admin Dashboard</h1>
          <p className="font-slab text-ink-muted text-lg">Manage classes, volunteers, and registrations.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Students" value={dash.students} icon={GraduationCap} />
          <StatCard label="Classes" value={dash.classes} icon={ClipboardList} iconColor="text-info" iconBg="bg-info-soft" />
          <StatCard label="Volunteers" value={dash.volunteers} icon={Users} iconColor="text-role-volunteer" iconBg="bg-role-volunteer-soft" />
          <StatCard label="Confirmed" value={dash.confirmed} icon={ClipboardList} iconColor="text-success" iconBg="bg-success-soft" />
          <StatCard label="Waitlisted" value={dash.waitlisted} icon={List} iconColor="text-ink-muted" iconBg="bg-surface-sunken" />
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link to="/admin/classes" className="group bg-surface border border-border rounded-xl shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:-translate-y-px transition">
            <div className="w-11 h-11 rounded-full bg-brand-soft flex items-center justify-center shrink-0">
              <ClipboardList size={20} className="text-warning" />
            </div>
            <div>
              <h2 className="font-sans font-semibold text-sm text-ink mb-0.5">Classes</h2>
              <p className="font-sans text-xs text-ink-muted">Create, edit, set capacity.</p>
            </div>
          </Link>

          <Link to="/admin/volunteers" className="group bg-surface border border-border rounded-xl shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:-translate-y-px transition">
            <div className="w-11 h-11 rounded-full bg-role-volunteer-soft flex items-center justify-center shrink-0">
              <Users size={20} className="text-role-volunteer" />
            </div>
            <div>
              <h2 className="font-sans font-semibold text-sm text-ink mb-0.5">Volunteers</h2>
              <p className="font-sans text-xs text-ink-muted">Roster, assignments, applications.</p>
            </div>
          </Link>

          <Link to="/admin/students" className="group bg-surface border border-border rounded-xl shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:-translate-y-px transition">
            <div className="w-11 h-11 rounded-full bg-success-soft flex items-center justify-center shrink-0">
              <GraduationCap size={20} className="text-success" />
            </div>
            <div>
              <h2 className="font-sans font-semibold text-sm text-ink mb-0.5">Students</h2>
              <p className="font-sans text-xs text-ink-muted">Manage registrations and rosters.</p>
            </div>
          </Link>

          <Link to="/admin/users" className="group bg-surface border border-border rounded-xl shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:-translate-y-px transition">
            <div className="w-11 h-11 rounded-full bg-role-admin-soft flex items-center justify-center shrink-0">
              <Shield size={20} className="text-role-admin" />
            </div>
            <div>
              <h2 className="font-sans font-semibold text-sm text-ink mb-0.5">Users &amp; roles</h2>
              <p className="font-sans text-xs text-ink-muted">Promote, demote, manage accounts.</p>
            </div>
          </Link>

          <Link to="/admin/sessions" className="group bg-surface border border-border rounded-xl shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:-translate-y-px transition">
            <div className="w-11 h-11 rounded-full bg-info-soft flex items-center justify-center shrink-0">
              <CalendarDays size={20} className="text-info" />
            </div>
            <div>
              <h2 className="font-sans font-semibold text-sm text-ink mb-0.5">Sessions</h2>
              <p className="font-sans text-xs text-ink-muted">Manage camp sessions and dates.</p>
            </div>
          </Link>

          <Link to="/admin/duties" className="group bg-surface border border-border rounded-xl shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:-translate-y-px transition">
            <div className="w-11 h-11 rounded-full bg-warning-soft flex items-center justify-center shrink-0">
              <List size={20} className="text-warning" />
            </div>
            <div>
              <h2 className="font-sans font-semibold text-sm text-ink mb-0.5">Duty schedule</h2>
              <p className="font-sans text-xs text-ink-muted">Daily volunteer duty slots.</p>
            </div>
          </Link>

          <Link to="/admin/interviews" className="group bg-surface border border-border rounded-xl shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:-translate-y-px transition">
            <div className="w-11 h-11 rounded-full bg-role-volunteer-soft flex items-center justify-center shrink-0">
              <Mic size={20} className="text-role-volunteer" />
            </div>
            <div>
              <h2 className="font-sans font-semibold text-sm text-ink mb-0.5">Interviews</h2>
              <p className="font-sans text-xs text-ink-muted">Schedule and record notes.</p>
            </div>
          </Link>

          <Link to="/admin/forms" className="group bg-surface border border-border rounded-xl shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:-translate-y-px transition">
            <div className="w-11 h-11 rounded-full bg-surface-sunken flex items-center justify-center shrink-0">
              <Settings2 size={20} className="text-ink-muted" />
            </div>
            <div>
              <h2 className="font-sans font-semibold text-sm text-ink mb-0.5">Form editor</h2>
              <p className="font-sans text-xs text-ink-muted">Configure fields and labels.</p>
            </div>
          </Link>
        </div>
      </main>
    </div>
  )
}
