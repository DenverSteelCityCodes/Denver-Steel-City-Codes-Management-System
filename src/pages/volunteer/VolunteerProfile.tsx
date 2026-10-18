import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useVolunteerHome } from '../../hooks/useVolunteerHome'
import { AbsenceSection, PrefsSection, SwitchSection } from '../../components/VolunteerSelfService'
import VolunteerProfileSection from '../../components/VolunteerProfileSection'
import type { AssignedSection } from '../../hooks/useAssignedClass'

// "PY-B for Weeks 1 and 2", or "PY-B for Week 1 and JV-A for Week 2".
function placement(sections: AssignedSection[]): string | null {
  if (sections.length === 0) return null
  const byLabel = new Map<string, number[]>()
  for (const s of sections) byLabel.set(s.label, [...(byLabel.get(s.label) ?? []), ...(s.week ? [s.week] : [])])
  const and = (parts: string[]) => parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
  return and([...byLabel].map(([label, weeks]) => {
    const sorted = [...new Set(weeks)].sort((a, b) => a - b)
    return sorted.length === 0 ? label : `${label} for ${sorted.length === 1 ? 'Week' : 'Weeks'} ${and(sorted.map(String))}`
  }))
}

// My profile (avatar menu): the occasional settings that used to sit between the daily tools. The
// tabs stay in view, so there's no Back link; Sign out lives in the avatar menu only.
export default function VolunteerProfile() {
  const { profile, user } = useAuth()
  const { assigned: { assignedSections } } = useVolunteerHome()
  const { hash } = useLocation()
  const daysOff = hash === '#days-off'

  // "Tell the camp" on Duties links here; bring that section into view.
  useEffect(() => {
    if (daysOff) document.getElementById('days-off')?.scrollIntoView({ block: 'start' })
  }, [daysOff])

  return (
    <>
      <h1 className="font-display font-bold text-[1.75rem] leading-[1.15] tracking-[-0.01em] text-balance text-ink">{profile?.display_name ?? 'Volunteer'}</h1>
      <p className="mt-1 text-ink-muted break-all">{user?.email}</p>

      <div className="mt-8 lg:grid lg:grid-cols-2 lg:gap-10 lg:items-start space-y-10 lg:space-y-0">
        <div className="space-y-10">
          <VolunteerProfileSection />
          <PrefsSection />
          <SwitchSection current={placement(assignedSections)} />
        </div>
        {user && <AbsenceSection userId={user.id} startOpen={daysOff} />}
      </div>
    </>
  )
}
