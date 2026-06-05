import { Link } from 'react-router-dom'
import { ShieldCheck, GraduationCap, Users, ClipboardList, List } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAdminStats } from '../hooks/useAdminStats'
import StatCard from '../components/StatCard'

export default function AdminDashboard() {
  const { profile, signOut } = useAuth()
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
      <header className="h-16 bg-ink-900 flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center">
            <span className="font-sans font-bold text-brand-on text-sm">S</span>
          </div>
          <span className="font-sans font-bold text-white text-base tracking-tight">Steel City Codes</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-role-admin-soft text-role-admin">
            <ShieldCheck size={12} /> Admin
          </span>
          <span className="font-sans text-sm text-white/70">{profile?.display_name}</span>
          <button onClick={signOut} className="font-sans text-sm text-white/60 hover:text-white transition">
            Sign out
          </button>
        </div>
      </header>

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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to="/admin/classes"
            className="group bg-surface border border-border rounded-xl shadow-sm p-6 flex items-center gap-4 hover:shadow-md hover:-translate-y-px transition"
          >
            <div className="w-12 h-12 rounded-full bg-brand-soft flex items-center justify-center shrink-0">
              <ClipboardList size={22} className="text-warning" />
            </div>
            <div>
              <h2 className="font-sans font-semibold text-base text-ink group-hover:text-ink mb-0.5">Manage classes</h2>
              <p className="font-sans text-sm text-ink-muted">Create, edit, and delete classes. Set capacity.</p>
            </div>
          </Link>

          <Link
            to="/admin/volunteers"
            className="group bg-surface border border-border rounded-xl shadow-sm p-6 flex items-center gap-4 hover:shadow-md hover:-translate-y-px transition"
          >
            <div className="w-12 h-12 rounded-full bg-role-volunteer-soft flex items-center justify-center shrink-0">
              <Users size={22} className="text-role-volunteer" />
            </div>
            <div>
              <h2 className="font-sans font-semibold text-base text-ink group-hover:text-ink mb-0.5">Volunteers</h2>
              <p className="font-sans text-sm text-ink-muted">View roster and auto-assign to classes by week.</p>
            </div>
          </Link>
        </div>
      </main>
    </div>
  )
}
