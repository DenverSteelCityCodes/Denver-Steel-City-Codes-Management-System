import { ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function AdminDashboard() {
  const { profile, signOut } = useAuth()

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
          <button
            onClick={signOut}
            className="font-sans text-sm text-white/60 hover:text-white transition"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-10">
        <h1 className="font-sans font-bold text-3xl text-ink mb-2">Admin Dashboard</h1>
        <p className="font-slab text-ink-muted text-lg mb-8">Manage classes, volunteers, and registrations.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Students', value: '—' },
            { label: 'Active Classes', value: '—' },
            { label: 'Volunteers', value: '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-surface border border-border rounded-xl shadow-sm p-6">
              <p className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted mb-2">{label}</p>
              <p className="font-sans font-bold text-4xl text-ink tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 bg-surface border border-border rounded-xl shadow-sm p-8 text-center">
          <p className="font-sans text-ink-muted text-sm">
            Full admin tools coming in <strong className="text-ink">PR 4</strong>.
          </p>
        </div>
      </main>
    </div>
  )
}
