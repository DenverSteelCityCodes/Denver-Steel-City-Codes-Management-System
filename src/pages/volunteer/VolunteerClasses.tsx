import { useState } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, Megaphone, Phone, Printer } from 'lucide-react'
import { useVolunteerHome } from '../../hooks/useVolunteerHome'
import MedicalFlag from '../../components/MedicalFlag'
import { callTarget, healthNote, telHref } from '../../lib/campers'
import { formatDayLong, localDateISO } from '../../lib/campDay'
import { countLabel, whereWhen } from '../../lib/volunteerHome'
import { PageHead, Sect, btnCls, linkCls, listCls } from './parts'
import type { AssignedSection } from '../../hooks/useAssignedClass'

// Classes tab: one week at a time (volunteers think "week + my class"), the class details, and a
// read-only roster from section_roster() with health notes behind a tap (spec 04).
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
          const health = s.students.filter(st => healthNote(st)).length
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
              <Sect title={countLabel(s.students.length, 'camper', 'campers')} id={`roster-${s.id}`}
                action={health > 0 ? <span className="font-sans text-sm text-ink-muted">{countLabel(health, 'with a health note', 'with health notes')}</span> : undefined}
                className="sm:mt-0">
                {s.students.length === 0 ? (
                  <p className="font-sans text-[15px] text-ink-muted">No campers enrolled in this section yet.</p>
                ) : (
                  <div className={listCls}>
                    {s.students.map(st => {
                      const note = healthNote(st)
                      const call = callTarget(st)
                      const initials = st.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                      return (
                        <div key={st.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b border-border last:border-0">
                          <span aria-hidden="true" className="w-9 h-9 rounded-full bg-surface-sunken text-ink-muted grid place-items-center font-sans font-bold text-[13px] shrink-0">{initials}</span>
                          <span className="flex-1 min-w-0 flex items-center gap-x-2 gap-y-1 flex-wrap">
                            <span className="font-sans font-semibold text-base text-ink leading-tight">{st.full_name}</span>
                            <span className="font-sans text-sm text-ink-muted">{st.age}</span>
                            {note && <MedicalFlag info={note} footnote="Confidential — for camp staff only." />}
                          </span>
                          {call && (
                            <a href={telHref(call.number)} aria-label={`Call ${st.full_name}'s ${call.who}, ${call.number}`}
                              className="h-11 w-11 shrink-0 rounded-[10px] border border-border-strong bg-surface text-ink hover:bg-surface-sunken grid place-items-center transition">
                              <Phone size={17} />
                            </a>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </Sect>
            </div>
          )
        })}
      </div>
    </>
  )
}
