import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronLeft, LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useVolunteerHome } from '../../hooks/useVolunteerHome'
import { AbsenceSection, PrefsSection, SwitchSection } from '../../components/VolunteerSelfService'
import { btnCls } from './parts'

// My profile (avatar menu): the occasional settings that used to sit between the daily tools.
export default function VolunteerProfile() {
  const { profile, user, signOut } = useAuth()
  const { assigned: { assignedSections } } = useVolunteerHome()
  const { hash } = useLocation()
  const daysOff = hash === '#days-off'

  // "Tell the camp" on Duties links here; bring that section into view.
  useEffect(() => {
    if (daysOff) document.getElementById('days-off')?.scrollIntoView({ block: 'start' })
  }, [daysOff])

  const name = profile?.display_name ?? 'Volunteer'
  const initials = name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase() || 'V'
  const current = assignedSections.length
    ? assignedSections.map(s => `${s.label}${s.week ? ` for Week ${s.week}` : ''}`).join(' and ')
    : null

  return (
    <>
      <Link to="/volunteer" className="-mt-2 mb-2 min-h-11 inline-flex items-center gap-1 font-sans font-semibold text-[15px] text-ink-muted hover:text-ink">
        <ChevronLeft size={17} /> Back
      </Link>
      <div className="flex items-center gap-4">
        <span className="w-14 h-14 rounded-full bg-role-volunteer-soft text-role-volunteer ring-[3px] ring-brand ring-offset-[3px] ring-offset-bg grid place-items-center font-sans font-bold text-lg shrink-0">
          {initials}
        </span>
        <div className="min-w-0">
          <h1 className="font-display font-bold text-2xl text-ink leading-tight">{name}</h1>
          <p className="font-sans text-[15px] text-ink-muted truncate">{user?.email}</p>
        </div>
      </div>

      <div className="mt-8 sm:grid sm:grid-cols-2 sm:gap-10 sm:items-start space-y-9 sm:space-y-0">
        <div className="space-y-9">
          <PrefsSection />
          <SwitchSection current={current} />
        </div>
        <div className="space-y-9">
          {user && <AbsenceSection userId={user.id} startOpen={daysOff} />}
          <button type="button" onClick={signOut} className={btnCls}><LogOut size={16} /> Sign out</button>
        </div>
      </div>
    </>
  )
}
