import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, CircleCheck, Info, List, Lock, Plus } from 'lucide-react'
import { useClasses, type SectionWithCount } from '../hooks/useClasses'
import { useRefetchOnFocus } from '../hooks/useRefetchOnFocus'
import { useStudents } from '../hooks/useStudents'
import { useRegistrations } from '../hooks/useRegistrations'
import { useSessions, activeCampYear, campSessions } from '../hooks/useSessions'
import { useSeasonSettings, registrationIsOpen } from '../hooks/useSeasonSettings'
import RegistrationCountdown from '../components/RegistrationCountdown'
import ConfirmOnboardingPanel from '../components/ConfirmOnboardingPanel'
import { useParentProfile } from '../hooks/useParentProfile'
import { useAuth } from '../context/AuthContext'
import { useFormConfig } from '../hooks/useFormConfig'
import { courseConstraint, gradeBlockReason } from '../lib/courseConstraints'
import { formatTimeRange } from '../lib/campDay'
import { camperFirstName, holdsSeat } from '../lib/parentHome'
import type { OnboardingConfirmation, Student } from '../types/database'
import { PageHead, Sect, btnCls, listCls, primaryCls } from './volunteer/parts'

// Classes tab (issue #167): pick the camper and the week first, then only the classes that camper
// can take that week. The rest fold away with the reason. The yearly check opens inside the class
// tapped, and the result shows in that class.
export default function ClassBrowser() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { classes, loading: classesLoading, refetch: refetchClasses } = useClasses()
  // Keep "spots left" honest during the opening rush: refresh seat counts every 30 s and on focus (spec 16).
  useRefetchOnFocus(refetchClasses, 30_000)
  const { students, loading: studentsLoading, confirmOnboarding } = useStudents()
  const { registrations, registerStudent, getRegistration } = useRegistrations()
  const { sessions, loading: sessionsLoading } = useSessions()
  const { profile } = useAuth()
  const { profile: parentProfile } = useParentProfile()
  // "Close form" in the admin form editor closes registration here too (the database enforces it).
  const { enabled: registrationOpen } = useFormConfig('student_registration')

  // Active camp year: the year of the open session(s). Campers re-confirm their details every
  // summer before they can register (#42). Register stays disabled until sessions load, so a quick
  // click can't skip the confirmation.
  const campYear = activeCampYear(sessions)
  const { settings: season, refetch: refetchSeason } = useSeasonSettings(sessions.length > 0 ? campYear : null)
  const isOpen = registrationIsOpen(season)
  const weeks = campSessions(sessions).map((s, i) => ({ n: i + 1, session: s })).filter(w => w.session.is_active)

  const student = students.find(s => s.id === searchParams.get('camper')) ?? students[0]
  // A seat this camper holds in a given week (a both-weeks section counts for every week).
  const seatIn = (st: Student | undefined, week: number) => st && registrations.find(r =>
    r.student_id === st.id && holdsSeat(r) && r.year === campYear && !!r.sections &&
    (r.sections.week == null || r.sections.week === week))
  // Start on the first week the camper isn't in yet.
  const firstFree = weeks.find(w => !seatIn(student, w.n))?.n ?? weeks[0]?.n ?? 1
  const week = Number(searchParams.get('week')) || firstFree

  const [pending, setPending] = useState<string | null>(null)        // section awaiting the yearly check
  const [busy, setBusy] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function pick(params: { camper?: string; week?: number }) {
    const next = new URLSearchParams(searchParams)
    if (params.camper) { next.set('camper', params.camper); next.delete('week') }
    if (params.week) next.set('week', String(params.week))
    setSearchParams(next, { replace: true })
    setPending(null)
    setErrors({})
  }

  const needsConfirmation = !!student && student.registration_year !== campYear

  async function doRegister(section: SectionWithCount) {
    if (!student) return
    setBusy(section.id)
    setErrors(e => ({ ...e, [section.id]: '' }))
    try {
      await registerStudent(student.id, section.id, section.registered_count, section.capacity)
      void refetchClasses()   // fill meters now include this camper
    } catch (err) {
      // The server enforces age range and capacity; show its reason rather than a generic error.
      const reason = err instanceof Error ? err.message : ''
      setErrors(e => ({ ...e, [section.id]: reason.includes('duplicate key')
        ? `${camperFirstName(student)} is already registered for that class.`
        : reason || 'Something went wrong. Please try again.' }))
    } finally {
      setBusy(null)
    }
  }

  function handleRegister(section: SectionWithCount) {
    if (!student || sessionsLoading) return
    if (!registrationOpen) { setErrors(e => ({ ...e, [section.id]: 'Camper registration is closed right now.' })); return }
    if (needsConfirmation) { setPending(section.id); return }
    void doRegister(section)
  }

  // After the parent reviews, edits and re-signs, save it and stamp the year, then register.
  async function handleConfirm(section: SectionWithCount, fields: OnboardingConfirmation) {
    if (!student) return
    setBusy(section.id)
    try {
      await confirmOnboarding(student.id, fields, campYear)
      setPending(null)
      await doRegister(section)
    } catch {
      setErrors(e => ({ ...e, [section.id]: 'Could not save your confirmation. Please try again.' }))
    } finally {
      setBusy(null)
    }
  }

  if (!studentsLoading && students.length === 0) {
    return (
      <>
        <PageHead title="Find a class">Classes are picked as part of registering a camper.</PageHead>
        <Link to="/parent/register" className={`${primaryCls} mt-5`}><Plus size={16} /> Register a camper</Link>
      </>
    )
  }

  const first = student ? camperFirstName(student) : 'your camper'
  const held = seatIn(student, week)
  const rows = classes.flatMap(cls => {
    const constraint = courseConstraint(cls.name)
    return cls.sections
      .filter(sec => sec.week === week || sec.week == null)
      .map(sec => {
        const reason = !student ? null
          : student.age < sec.age_min || student.age > sec.age_max ? `For ages ${sec.age_min} to ${sec.age_max}`
          : gradeBlockReason(constraint, student.grade)
        return { cls, sec, constraint, reason }
      })
  })
  const fits = rows.filter(r => !r.reason)
  const notFit = rows.filter(r => r.reason)

  return (
    <div className="max-w-[760px]">
      <RegistrationCountdown opensAt={season?.registration_opens_at} onOpen={() => { void refetchSeason() }} />
      <PageHead title="Find a class" />
      {!registrationOpen && (
        <p role="status" className="mt-4 font-sans text-[15px] text-ink bg-surface border border-border rounded-[12px] px-4 py-3">
          Camper registration is closed right now. Existing registrations are unchanged.
        </p>
      )}

      <div className="mt-5">
        <p id="who-l" className="font-sans text-sm font-semibold text-ink-muted mb-1.5">Who is it for?</p>
        <div role="group" aria-labelledby="who-l" className="flex flex-wrap gap-2">
          {students.map(s => {
            const on = s.id === student?.id
            const ini = s.full_name.split(/\s+/).map(n => n.match(/\p{L}/u)?.[0] ?? '').join('').toUpperCase().slice(0, 2)
            return (
              <button key={s.id} type="button" aria-pressed={on} onClick={() => pick({ camper: s.id })}
                className={`h-11 pl-1.5 pr-3.5 rounded-full border inline-flex items-center gap-2 font-sans font-semibold text-[15px] transition ${
                  on ? 'bg-ink border-ink text-bg' : 'bg-surface border-border-strong text-ink hover:bg-surface-sunken'}`}>
                <span aria-hidden="true" className="w-8 h-8 rounded-full bg-role-parent-soft text-role-parent grid place-items-center text-xs font-bold">{ini}</span>
                {camperFirstName(s)}, {s.age}
              </button>
            )
          })}
          <Link to="/parent/register" className="h-11 px-3.5 rounded-full border border-dashed border-border-strong inline-flex items-center gap-1.5 font-sans font-semibold text-[15px] text-ink-muted hover:text-ink hover:bg-surface-sunken transition">
            <Plus size={16} /> New camper
          </Link>
        </div>
      </div>

      {weeks.length > 1 && (
        <div className="mt-4">
          <p id="week-l" className="font-sans text-sm font-semibold text-ink-muted mb-1.5">Which week?</p>
          <div role="group" aria-labelledby="week-l" className="grid grid-flow-col auto-cols-fr border border-border-strong rounded-[10px] overflow-hidden bg-surface">
            {weeks.map(w => (
              <button key={w.n} type="button" aria-pressed={week === w.n} onClick={() => pick({ week: w.n })}
                className={`min-h-12 py-1 border-l first:border-l-0 border-border-strong font-sans font-semibold text-[15px] leading-tight transition ${
                  week === w.n ? 'bg-ink text-bg' : 'text-ink hover:bg-surface-sunken'}`}>
                {w.session.name}
                <span className="block font-medium text-[13px] opacity-80">{shortDates(w.session.start_date, w.session.end_date)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {held && (
        <p className="mt-4 flex items-start gap-2.5 bg-surface border border-border rounded-[12px] px-4 py-3 font-sans text-[15px] text-ink">
          <Info size={17} className="shrink-0 mt-0.5 text-ink-muted" />
          <span>{first} is in <b className="font-semibold">{held.sections?.classes?.name}</b> this week. Campers take one class a week; to change it, open {first} on Home and tap Switch class.</span>
        </p>
      )}

      <Sect title={classesLoading ? 'Classes' : `${fits.length} ${fits.length === 1 ? 'class' : 'classes'} for ${first}`} id="classes-h">
        {classesLoading ? (
          <div className="h-48 bg-surface-sunken rounded-[14px] animate-pulse" aria-busy="true" />
        ) : fits.length === 0 ? (
          <p className="font-sans text-[15px] text-ink-muted">No class this week fits {first}'s age and grade.</p>
        ) : (
          <div className={listCls}>
            {fits.map(({ cls, sec, constraint }) => {
              const reg = student ? getRegistration(student.id, sec.id) : null
              const left = sec.capacity - sec.registered_count
              const full = left <= 0
              const pct = Math.min(100, Math.round((sec.registered_count / Math.max(sec.capacity, 1)) * 100))
              const time = sec.start_time ? `${sec.days}, ${formatTimeRange(sec.start_time, sec.end_time)}` : sec.days
              return (
                <article key={sec.id} className="p-4 border-b border-border last:border-0">
                  <h3 className="font-sans text-[17.5px] font-bold text-ink leading-snug">{cls.name}, {sec.label}</h3>
                  {cls.description && <p className="mt-1 font-sans text-[15px] text-ink-muted leading-normal">{cls.description}</p>}
                  <p className="mt-2 font-sans text-[14.5px] text-ink leading-normal">
                    Ages {sec.age_min} to {sec.age_max}{constraint?.requirementNote ? `. ${constraint.requirementNote}` : ''}
                    <br />{[time, sec.room].filter(Boolean).join(', ')}
                  </p>
                  <div className="mt-2.5 h-1.5 rounded-full bg-surface-sunken overflow-hidden" aria-hidden="true">
                    <div className={`h-full rounded-full ${full ? 'bg-danger' : left <= 2 ? 'bg-brand-hover' : 'bg-success'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 flex justify-between font-sans text-sm text-ink-muted">
                    <span>{full ? `Full${sec.waitlist_count ? `, ${sec.waitlist_count} on the waitlist` : ''}` : `${left} ${left === 1 ? 'spot' : 'spots'} left`}</span>
                    <span>{sec.capacity} seats</span>
                  </p>

                  {reg && reg.status !== 'cancelled' ? (
                    <p role="status" className={`mt-3 flex items-start gap-2 font-sans text-[15px] font-semibold ${holdsSeat(reg) ? 'text-success' : 'text-info'}`}>
                      {holdsSeat(reg) ? <CircleCheck size={18} className="shrink-0 mt-0.5" /> : <List size={18} className="shrink-0 mt-0.5" />}
                      {holdsSeat(reg) ? `${first} is in. Their spot is confirmed.`
                        : reg.status === 'offered' ? `A spot opened for ${first}. Claim it on Home.`
                        : `${first} is on the waitlist. We'll email you if a spot opens.`}
                    </p>
                  ) : held ? null : pending === sec.id && student ? (
                    <ConfirmOnboardingPanel
                      key={`${student.id}-${sec.id}`}
                      student={student}
                      parentDefaults={{
                        parent_name: profile?.display_name,
                        parent_phone: parentProfile?.phone,
                        emergency_contact_name: parentProfile?.emergency_contact_name,
                        emergency_contact_phone: parentProfile?.emergency_contact_phone,
                        emergency_contact_relation: parentProfile?.emergency_contact_relation,
                      }}
                      campYear={campYear}
                      full={full}
                      submitting={busy === sec.id}
                      onConfirm={fields => handleConfirm(sec, fields)}
                      onClose={() => setPending(null)}
                    />
                  ) : (
                    <button type="button" onClick={() => handleRegister(sec)} disabled={!!busy || sessionsLoading || !isOpen}
                      className={`${btnCls} w-full mt-3`}>
                      {busy === sec.id ? 'Registering…' : full ? 'Join the waitlist' : `Register ${first}`}
                    </button>
                  )}
                  {errors[sec.id] && <p role="alert" className="mt-2 font-sans text-sm text-danger">{errors[sec.id]}</p>}
                </article>
              )
            })}
          </div>
        )}
      </Sect>

      {notFit.length > 0 && (
        <details className="group mt-7">
          <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer min-h-11 flex items-center justify-between gap-3">
            <span className="font-sans text-[15px] font-semibold text-ink">Not open to {first} ({notFit.length})</span>
            <ChevronDown size={16} aria-hidden="true" className="text-ink-muted transition group-open:rotate-180" />
          </summary>
          <div className={`${listCls} mt-2`}>
            {notFit.map(({ cls, sec, reason }) => (
              <div key={sec.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
                <span className="flex-1 min-w-0">
                  <span className="block font-sans text-base font-semibold text-ink">{cls.name}, {sec.label}</span>
                  <span className="block font-sans text-sm text-ink-muted">{reason}</span>
                </span>
                <Lock size={16} aria-hidden="true" className="text-ink-muted shrink-0" />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

// "Oct 19 to 23" (or "Oct 30 to Nov 3")
function shortDates(start: string, end: string): string {
  const a = new Date(`${start}T12:00:00`), b = new Date(`${end}T12:00:00`)
  const m = (d: Date) => d.toLocaleDateString('en-US', { month: 'short' })
  return `${m(a)} ${a.getDate()} to ${m(a) === m(b) ? '' : `${m(b)} `}${b.getDate()}`
}
