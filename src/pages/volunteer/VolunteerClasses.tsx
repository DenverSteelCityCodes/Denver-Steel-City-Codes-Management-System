import { useState } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, HeartPulse, Laptop, Megaphone, Printer } from 'lucide-react'
import { useVolunteerHome } from '../../hooks/useVolunteerHome'
import HealthNotes from '../../components/HealthNotes'
import IncidentLog from '../../components/IncidentLog'
import CallLink from '../../components/CallLink'
import { callLines, healthLines } from '../../lib/campers'
import { rosterLaptopLabel } from '../../lib/laptopLoans'
import { formatDayLong, localDateISO } from '../../lib/campDay'
import { countLabel, whereWhen } from '../../lib/volunteerHome'
import { PageHead, Sect, btnCls, linkCls } from './parts'
import type { AssignedSection } from '../../hooks/useAssignedClass'

// Classes tab: one week at a time (volunteers think "week + my class"), the class details, and a
// read-only roster from section_roster(). Every health note and who to call is on screen, never
// behind a tap (DESIGN.md › Roll Call; issue #172).
export default function VolunteerClasses() {
  const { assigned: { assignedSections }, sessions } = useVolunteerHome()
  const [pick, setPick] = useState<string | null>(null)

  if (assignedSections.length === 0) {
    return (
      <div className="pt-4">
        <span className="w-13 h-13 rounded-full bg-role-volunteer-soft text-role-volunteer grid place-items-center mb-3"><GraduationCap size={22} /></span>
        <PageHead title="No class assigned yet">An admin will assign you to a section before camp starts.</PageHead>
      </div>
    )
  }

  const sessionOf = (s: AssignedSection) => sessions.find(x => x.id === s.session_id) ?? null
  // Group by week (session), in date order; sections without a week go last.
  const groups = new Map<string, AssignedSection[]>()
  for (const s of [...assignedSections].sort((a, b) => (sessionOf(a)?.start_date ?? '9').localeCompare(sessionOf(b)?.start_date ?? '9'))) {
    const key = s.session_id ?? 'none'
    groups.set(key, [...(groups.get(key) ?? []), s])
  }
  const keys = [...groups.keys()]
  const key = pick && groups.has(pick) ? pick : keys[0]
  const today = localDateISO()

  return (
    <>
      {keys.length > 1 && (
        <div role="group" aria-label="Week" className="grid grid-flow-col auto-cols-fr border border-border-strong rounded-[10px] overflow-hidden bg-surface mb-6">
          {keys.map(k => {
            const session = sessions.find(x => x.id === k)
            return (
              <button key={k} type="button" aria-pressed={k === key} onClick={() => setPick(k)}
                className={`h-11 px-2 font-sans font-semibold text-[15px] border-l border-border-strong first:border-l-0 truncate transition ${
                  k === key ? 'bg-ink text-bg' : 'text-ink hover:bg-surface-sunken'}`}>
                {session ? `${session.name}, ${new Date(`${session.start_date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'No week yet'}
              </button>
            )
          })}
        </div>
      )}

      <div className="space-y-12">
        {groups.get(key)!.map(s => {
          const session = sessionOf(s)
          const live = !!session && session.start_date <= today && session.end_date >= today
          const withNotes = s.students.filter(st => healthLines(st).length > 0)
          return (
            <div key={s.id} className="sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] sm:gap-10 sm:items-start">
              <div>
                <PageHead title={`${s.class_name}, ${s.label}`}>
                  You {s.is_lead ? 'lead' : 'support'} this class. {whereWhen(s)}. Ages {s.age_min} to {s.age_max}.
                </PageHead>
                <div className="flex flex-wrap gap-2 mt-4">
                  <Link to={`/print/roster/${s.id}`} className={btnCls}><Printer size={16} /> Paper roster</Link>
                  {s.is_lead && (
                    <Link to="/volunteer/updates" state={{ compose: s.id }} className={btnCls}><Megaphone size={16} /> Post to families</Link>
                  )}
                </div>
                <p className="font-sans text-[15px] text-ink-muted mt-3">
                  {live ? <>Take today's roll call on <Link to="/volunteer" className={linkCls}>Today</Link>.</>
                    : session && session.start_date > today ? `Roll calls open ${formatDayLong(session.start_date)}.`
                      : session ? `${session.name} is over.` : 'This section is not scheduled for a camp week yet.'}
                </p>
              </div>
              {/* The roster (health notes, who to call) first; the incident log under it (spec 34). */}
              <div>
                <Sect title={countLabel(s.students.length, 'camper', 'campers')} id={`roster-${s.id}`} className="sm:mt-0">
                  {withNotes.length > 0 && (
                    <p className="flex items-start gap-1.5 font-bold text-danger -mt-1 mb-3">
                      <HeartPulse size={16} strokeWidth={2.5} className="shrink-0 mt-[3px]" aria-hidden="true" />
                      <span>
                        Health notes:{' '}
                        {withNotes.map((st, i) => (
                          <span key={st.id}>{i > 0 && ', '}<a href={`#camper-${st.id}`} className="underline underline-offset-[3px]">{st.full_name}</a></span>
                        ))}
                      </span>
                    </p>
                  )}
                  {s.students.length === 0 ? (
                    <p className="text-ink-muted">No campers enrolled in this section yet.</p>
                  ) : (
                    <ul className="border-y-2 border-ink">
                      {s.students.map(st => {
                        const health = healthLines(st)
                        const calls = callLines(st)
                        const laptop = rosterLaptopLabel(st.laptop_loan)
                        return (
                          <li key={st.id} id={`camper-${st.id}`} className="py-3 border-t border-border first:border-t-0 scroll-mt-16">
                            <p className="font-bold text-lg leading-[1.3] text-ink">{st.full_name}</p>
                            {health.length > 0 && <HealthNotes lines={health} className="mt-1" />}
                            {calls.length > 0 ? (
                              <div className="flex flex-col items-start lg:flex-row lg:flex-wrap lg:gap-x-6">
                                {calls.map(c => <CallLink key={c.number} call={c} />)}
                              </div>
                            ) : (
                              <p className="mt-1 text-ink-muted">No phone number on file. Tell an admin.</p>
                            )}
                            {laptop && (
                              <p className="mt-1 flex items-center gap-1.5 font-bold">
                                <Laptop size={16} strokeWidth={2.5} aria-hidden="true" className="shrink-0" />{laptop}
                              </p>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </Sect>
                <IncidentLog sectionId={s.id} sectionName={`${s.class_name}, ${s.label}`} students={s.students} />
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
