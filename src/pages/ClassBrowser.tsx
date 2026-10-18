import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, CircleCheck, Hourglass, Lock, Plus, Repeat } from 'lucide-react'
import { useClasses, type SectionWithCount } from '../hooks/useClasses'
import { useRefetchOnFocus } from '../hooks/useRefetchOnFocus'
import { useStudents } from '../hooks/useStudents'
import { useRegistrations } from '../hooks/useRegistrations'
import { useSessions, activeCampYear, campSessions } from '../hooks/useSessions'
import { useSeasonSettings, registrationIsOpen } from '../hooks/useSeasonSettings'
import RegistrationCountdown from '../components/RegistrationCountdown'
import NotifyMeSwitch from '../components/NotifyMeSwitch'
import ConfirmOnboardingPanel from '../components/ConfirmOnboardingPanel'
import ExceptionRequest from '../components/ExceptionRequest'
import { useMyChanges, exceptionKey } from '../hooks/useMyChanges'
import { useParentProfile } from '../hooks/useParentProfile'
import { useAuth } from '../context/AuthContext'
import { useFormConfig } from '../hooks/useFormConfig'
import { classRuleLine, courseRuleReason, isCourseRuleError, repeatWarning, takenClasses } from '../lib/courseRules'
import { formatTimeRange } from '../lib/campDay'
import { camperFirstName, holdsSeat } from '../lib/parentHome'
import { buttonClass } from '../lib/ui'
import type { OnboardingConfirmation, Student } from '../types/database'
import { ErrorLine, PageHead, Sect, Segmented, framedCls, labelCls, rowCls, textBtn } from './parent/parts'

// Classes tab (issue #167): pick the camper and the week first, then only the classes that camper
// can take that week. The rest fold away with the reason. The yearly check opens inside the class
// tapped, and the result shows in that class.
//
// Terminal Yellow: campers and weeks are segmented controls, the classes are rows on the floor
// between 2px ink rules, seats are an ink meter (never red or gold), and the only gold on the page
// is the yearly check's confirm button while it is open.
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
  // Exception requests for classes a camper's grade or prerequisite rules out (spec 31).
  const { exceptions, requestException } = useMyChanges(students.length > 0)

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
  // Sections whose sign-up the database refused under the class's own rules (spec 31).
  const [ruleErrors, setRuleErrors] = useState<Set<string>>(new Set())

  function pick(params: { camper?: string; week?: number }) {
    const next = new URLSearchParams(searchParams)
    if (params.camper) { next.set('camper', params.camper); next.delete('week') }
    if (params.week) next.set('week', String(params.week))
    setSearchParams(next, { replace: true })
    setPending(null)
    setErrors({})
    setRuleErrors(new Set())
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
      if (isCourseRuleError(err)) setRuleErrors(r => new Set(r).add(section.id))
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
        <Link to="/parent/register" className={buttonClass('primary', 'mt-5')}><Plus size={20} strokeWidth={2.25} aria-hidden="true" /> Register a camper</Link>
      </>
    )
  }

  const first = student ? camperFirstName(student) : 'your camper'
  const held = seatIn(student, week)
  // Course rules come from the class (spec 31): its grades this fall and the class to take first,
  // checked against everything the camper has taken. The database refuses the same classes.
  const taken = student ? takenClasses(registrations, student.id) : []
  const offeredIds = new Set(classes.filter(c => c.sections.some(s => s.week === week || s.week == null)).map(c => c.id))
  const rows = classes.flatMap(cls => cls.sections
    .filter(sec => sec.week === week || sec.week == null)
    .map(sec => {
      const target = { year: campYear, week: sec.week ?? null }
      const rule = student ? courseRuleReason(cls, classes, student.grade, taken, target) : null
      const live = student ? getRegistration(student.id, sec.id) : null
      // A class the camper is already in stays in the list, whoever placed them there.
      const reason = !student || (live && live.status !== 'cancelled') ? null
        : rule ?? (student.age < sec.age_min || student.age > sec.age_max ? `For ages ${sec.age_min} to ${sec.age_max}` : null)
      const repeat = student && !reason ? repeatWarning(cls, classes, student.grade, taken, target, offeredIds) : null
      return { cls, sec, reason, ruleBlocked: !!reason && reason === rule, repeat, ruleLine: classRuleLine(cls, classes) }
    }))
  const fits = rows.filter(r => !r.reason)
  const notFit = rows.filter(r => r.reason)

  return (
    <div className="max-w-[760px]">
      <RegistrationCountdown opensAt={season?.registration_opens_at} onOpen={() => { void refetchSeason() }}><NotifyMeSwitch /></RegistrationCountdown>
      <PageHead title="Find a class" />
      {!registrationOpen && (
        <p role="status" className="mt-3 font-bold text-pretty">
          Camper registration is closed right now. Existing registrations are unchanged.
        </p>
      )}

      <div className="mt-5">
        <p id="who-l" className={labelCls}>Who is it for?</p>
        <Segmented labelledBy="who-l" items={students.map(s => ({
          key: s.id, label: `${camperFirstName(s)}, ${s.age}`, on: s.id === student?.id, onClick: () => pick({ camper: s.id }),
        }))} />
        <p className="mt-1 text-sm text-ink-muted">
          New camper? <Link to="/parent/register" className={textBtn}>Register a new camper</Link>
        </p>
      </div>

      {weeks.length > 1 && (
        <div className="mt-4">
          <p id="week-l" className={labelCls}>Which week?</p>
          <Segmented labelledBy="week-l" items={weeks.map(w => ({
            key: String(w.n), on: week === w.n, onClick: () => pick({ week: w.n }),
            label: <>{w.session.name}<span className="block text-sm font-normal">{shortDates(w.session.start_date, w.session.end_date)}</span></>,
          }))} />
        </div>
      )}

      {held && (
        <p className="mt-5 text-pretty">
          {first} is in <b className="font-bold">{held.sections?.classes?.name}</b> this week. Campers take one class a week; to change it, open {first} on Home and tap Switch class.
        </p>
      )}

      <Sect title={classesLoading ? 'Classes' : `${fits.length} ${fits.length === 1 ? 'class' : 'classes'} for ${first}`} id="classes-h">
        {classesLoading ? (
          <div className="h-48 bg-surface-sunken rounded animate-pulse" aria-busy="true" />
        ) : fits.length === 0 ? (
          <p className="text-ink-muted">No class this week fits {first}'s age and grade.</p>
        ) : (
          <ul className={framedCls}>
            {fits.map(({ cls, sec, repeat, ruleLine }) => {
              const reg = student ? getRegistration(student.id, sec.id) : null
              const left = sec.capacity - sec.registered_count
              const full = left <= 0
              const pct = Math.min(100, Math.round((sec.registered_count / Math.max(sec.capacity, 1)) * 100))
              const time = sec.start_time ? `${sec.days}, ${formatTimeRange(sec.start_time, sec.end_time)}` : sec.days
              return (
                <li key={sec.id} className={`py-4 ${rowCls}`}>
                  <article aria-labelledby={`sec-${sec.id}`}>
                  <h3 id={`sec-${sec.id}`} className="text-lg font-bold leading-snug">{cls.name}, {sec.label}</h3>
                  {cls.description && <p className="mt-1 text-ink-muted text-pretty">{cls.description}</p>}
                  <p className="mt-2 leading-normal">
                    Ages {sec.age_min} to {sec.age_max}{ruleLine ? `. ${ruleLine}` : ''}
                    <br />{[time, sec.room].filter(Boolean).join(', ')}
                  </p>
                  {/* Same course both weeks: a warning in ink with a drawn icon, never a block (spec 31). */}
                  {repeat && !reg && (
                    <p className="mt-2 flex items-start gap-2 font-bold text-pretty">
                      <Repeat size={20} strokeWidth={2.25} aria-hidden="true" className="shrink-0 mt-0.5" />{repeat}
                    </p>
                  )}
                  {/* Seats as an ink meter: full is ink, never red (DESIGN.md › Colors). */}
                  <div className="mt-3 h-1 rounded-[2px] bg-border overflow-hidden" aria-hidden="true">
                    <div className={`h-full ${full ? 'bg-ink' : 'bg-ink-muted'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1.5 flex justify-between gap-3 text-sm">
                    <span className="font-bold">{full ? `Full${sec.waitlist_count ? `, ${sec.waitlist_count} on the waitlist` : ''}` : `${left} ${left === 1 ? 'spot' : 'spots'} left`}</span>
                    <span className="text-ink-muted">{sec.capacity} seats</span>
                  </p>

                  {reg && reg.status !== 'cancelled' ? (
                    <p role="status" className={`mt-3 flex items-start gap-2 font-bold ${holdsSeat(reg) ? 'text-success' : 'text-ink'}`}>
                      {holdsSeat(reg) ? <CircleCheck size={20} strokeWidth={2.25} aria-hidden="true" className="shrink-0 mt-0.5" /> : <Hourglass size={20} strokeWidth={2.25} aria-hidden="true" className="shrink-0 mt-0.5" />}
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
                      className={buttonClass('secondary', 'mt-3', true)}>
                      {busy === sec.id ? 'Registering…' : full ? 'Join the waitlist' : `Register ${first}`}
                    </button>
                  )}
                  {errors[sec.id] && <ErrorLine className="mt-2">{errors[sec.id]}</ErrorLine>}
                  {ruleErrors.has(sec.id) && student && (
                    <ExceptionRequest camper={first} className={cls.name} idPrefix={`exc-${sec.id}`}
                      sent={exceptions.has(exceptionKey(student.id, sec.id))}
                      onSend={m => requestException(student.id, sec.id, m)} />
                  )}
                  </article>
                </li>
              )
            })}
          </ul>
        )}
      </Sect>

      {notFit.length > 0 && (
        <details className="group mt-6">
          <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer min-h-11 flex items-center justify-between gap-3">
            <span className="font-bold">Not open to {first} ({notFit.length})</span>
            <ChevronDown size={20} strokeWidth={2.25} aria-hidden="true" className="text-ink-muted transition-transform group-open:rotate-180" />
          </summary>
          <ul className={`mt-2 ${framedCls}`}>
            {notFit.map(({ cls, sec, reason, ruleBlocked }) => (
              <li key={sec.id} className={`py-3 ${rowCls}`}>
                <div className="flex items-center gap-3">
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-ink-muted">{cls.name}, {sec.label}</span>
                    <span className="block text-sm text-ink-muted">{reason}</span>
                  </span>
                  <Lock size={16} strokeWidth={2.5} aria-hidden="true" className="text-ink-muted shrink-0" />
                </div>
                {/* The class's own rules refuse this camper: the family can ask the camp instead. */}
                {ruleBlocked && student && (
                  <ExceptionRequest camper={first} className={cls.name} idPrefix={`exc-${sec.id}`}
                    sent={exceptions.has(exceptionKey(student.id, sec.id))}
                    onSend={m => requestException(student.id, sec.id, m)} />
                )}
              </li>
            ))}
          </ul>
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
