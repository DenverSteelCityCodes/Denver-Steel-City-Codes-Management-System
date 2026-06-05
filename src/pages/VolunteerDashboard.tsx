import { Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function VolunteerDashboard() {
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
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-role-volunteer-soft text-role-volunteer">
            <Users size={12} /> Volunteer
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
        <h1 className="font-sans font-bold text-3xl text-ink mb-2">My Class</h1>
        <p className="font-slab text-ink-muted text-lg mb-8">Attendance and check-out for today.</p>

        <div className="bg-surface border border-border rounded-xl shadow-sm p-8 text-center">
          <p className="font-sans text-ink-muted text-sm">
            Attendance tools coming in <strong className="text-ink">PR 5</strong>.
          </p>
        </div>
      </main>
    </div>
  )
}
