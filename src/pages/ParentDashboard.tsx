import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarX, CircleAlert, ClipboardCheck, Clock, FilePen, GraduationCap, Plus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useStudents } from '../hooks/useStudents'
import { useRegistrations } from '../hooks/useRegistrations'
import { useSessions, activeCampYear, campSessions } from '../hooks/useSessions'
import { useSeasonSettings, registrationIsOpen } from '../hooks/useSeasonSettings'
import { useMyChanges } from '../hooks/useMyChanges'
import { useMyRollCalls } from '../hooks/useMyRollCalls'
import StudentCard from '../components/StudentCard'
import ThisWeekCard from '../components/ThisWeekCard'
import RollCallStatus from '../components/RollCallStatus'
import RegistrationCountdown from '../components/RegistrationCountdown'
import ParentSign from '../components/ParentSign'
import ParentConfirm from '../components/ParentConfirm'
import { firstName, formatTimeRange, localDateISO, timeAgo } from '../lib/campDay'
import { CAMP_TIME_ZONE } from '../lib/denverTime'
import { relativeDay } from '../lib/volunteerHome'
import { buttonClass } from '../lib/ui'
import { listDrafts, clearDraft } from '../lib/registrationDraft'
import { useParentShell, parentAudience } from '../lib/parentShell'
import {
  camperFirstName, decisions as listDecisions, nextCampDay, openWeeksLabel, roomFigure, statusSentence, timeLeft, weekLines, weekOf,
  type CampDay, type Decision,
} from '../lib/homeDecision'

type Draft = ReturnType<typeof listDrafts>[number]

// A clock for the offer figure, ticking once a minute.
function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(id)
  }, [ms])
  return now
}

// "Fri 7:00 PM", in camp time.
const campWhen = (iso: string) => new Intl.DateTimeFormat('en-US', { timeZone: CAMP_TIME_ZONE, weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
const campTime = (iso: string) => new Intl.DateTimeFormat('en-US', { timeZone: CAMP_TIME_ZONE, hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
const classOf = (d: { reg: { sections: { classes: { name: string } | null } | null } }) => d.reg.sections?.classes?.name ?? 'a class'
const h2 = 'text-[1.375rem] font-bold leading-[1.2] tracking-[-0.01em]'

// The waitlist offer on the sign: the hours left at monumental scale, claim (ink) or decline with an
// inline confirm. The only gold on the view is the sign itself.
function OfferSign({ d, now, onClaim, onDecline }: {
  d: Extract<Decision, { kind: 'offer' }>; now: number
  onClaim: () => Promise<void>; onDecline: () => Promise<void>
}) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const name = camperFirstName(d.student)
  const week = d.reg.sections?.week ? `, Week ${d.reg.sections.week}` : ''
  const left = timeLeft(d.reg.offer_expires_at, now)
  const until = d.reg.offer_expires_at ? campWhen(d.reg.offer_expires_at) : null
  const room = d.reg.sections?.room

  async function run(fn: () => Promise<void>) {
    setBusy(true); setErr(null)
    try { await fn(); setConfirming(false) } catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong') }
    finally { setBusy(false) }
  }

  return (
    <ParentSign
      id="offer"
      ctx={`${name} · ${classOf(d)}${week}`}
      fig={left ? { value: String(left.value), unit: left.unit } : null}
      msg={until ? `Claim the spot by ${until}` : 'Claim the spot'}
      sub={`A seat opened${room ? ` in ${room}` : ''} and it's held for ${name}.${until && d.reg.offer_expires_at ? ` After ${campTime(d.reg.offer_expires_at)} it goes to the next family on the waitlist.` : ''}`}
    >
      {confirming ? (
        <ParentConfirm
          tone="sign"
          message={`Decline the spot in ${classOf(d)}? It goes to the next family on the waitlist.`}
          confirmLabel="Decline the spot" cancelLabel="Keep the offer" busy={busy}
          onConfirm={() => { void run(onDecline) }}
          onCancel={() => { setConfirming(false); setErr(null) }}
        />
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <button type="button" disabled={busy} onClick={() => { void run(onClaim) }} className={buttonClass('ink', 'dark:bg-ink-950 dark:text-brand')}>
            {busy ? 'Claiming…' : `Claim ${name}'s spot`}
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirming(true)} className={buttonClass('text', 'text-brand-on')}>Decline</button>
        </div>
      )}
      {err && (
        <p role="alert" className="mt-2 flex items-start gap-1.5 font-bold">
          <CircleAlert size={16} strokeWidth={2.5} className="shrink-0 mt-1" aria-hidden="true" /> {err}
        </p>
      )}
    </ParentSign>
  )
}

// The next camp day as a sign: the room is the figure, then where and when.
function CampDaySign({ day, today }: { day: CampDay; today: string }) {
  const when = relativeDay(today, day.day)
  const When = when.charAt(0).toUpperCase() + when.slice(1)
  const first = day.seats[0]
  const sec = first.reg.sections
  const start = [...day.seats].map(s => s.reg.sections?.start_time).filter((t): t is string => !!t).sort()[0]
  const startLabel = start ? formatTimeRange(start, null) : ''
  const ctx = day.dayNumber
    ? `${day.session.name}, day ${day.dayNumber} of camp`
    : `${day.session.name} starts ${when}`
  if (day.seats.length === 1) {
    const name = camperFirstName(first.student)
    return (
      <ParentSign
        id="next-day"
        ctx={`${name} · ${sec?.classes?.name ?? 'Class'} · ${ctx}`}
        fig={sec?.room ? { value: roomFigure(sec.room) } : startLabel ? { value: startLabel.replace(/ (AM|PM)$/, ''), unit: startLabel.slice(-2) } : null}
        msg={sec?.room
          ? `${sec.room}, ${When.toLowerCase() === 'today' ? 'today' : When}${startLabel ? ` ${startLabel}` : ''}`
          : `${When}${startLabel ? ` at ${startLabel}` : ''}`}
        sub={sec?.room ? (sec.start_time ? `${sec.days} ${formatTimeRange(sec.start_time, sec.end_time)}` : undefined) : 'The room will be posted here.'}
      />
    )
  }
  return (
    <ParentSign
      id="next-day"
      ctx={ctx}
      fig={startLabel ? { value: startLabel.replace(/ (AM|PM)$/, ''), unit: startLabel.slice(-2) } : null}
      msg={day.seats.map(s => `${camperFirstName(s.student)}: ${s.reg.sections?.room ?? 'room to come'}`).join(' · ')}
      sub={`${When}. Each camper's class and lead are under This week.`}
    />
  )
}

// One line of "Needs you" (DESIGN.md › Decision List): pictogram, the decision, why, one action.
function DecisionRow({ icon: Icon, what, why, children }: { icon: LucideIcon; what: string; why: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[40px_1fr] gap-x-4 gap-y-2 py-4 border-t-2 border-ink first:border-t-0">
      <span aria-hidden="true" className="w-10 h-10 grid place-items-center rounded bg-shell text-white dark:bg-[#2E2A25]">
        <Icon size={22} strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-[1.3] text-pretty">{what}</p>
        <p className="mt-1 text-ink-muted text-pretty">{why}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">{children}</div>
      </div>
    </li>
  )
}

// Parent Home (issue #173): the one next decision in the gold sign, then the campers with one line
// per week, then this week (only near a session, schedule folded). Posts live on the Updates tab
// and contact details under the avatar.
export default function ParentDashboard() {
  const { profile, user } = useAuth()
  const { students, loading: studentsLoading, updateStudent } = useStudents()
  const { registrations, loading: regsLoading, refetch: refetchRegistrations } = useRegistrations()
  const { sessions, loading: sessionsLoading } = useSessions()
  const campYear = activeCampYear(sessions)
  const { settings: season, refetch: refetchSeason } = useSeasonSettings(sessions.length > 0 ? campYear : null)
  const myChanges = useMyChanges(students.length > 0)
  const changes = {
    ...myChanges,
    cancelSpot: async (id: string) => { await myChanges.cancelSpot(id); await refetchRegistrations() },
    acceptOffer: async (id: string) => { await myChanges.acceptOffer(id); await refetchRegistrations() },
    declineOffer: async (id: string) => { await myChanges.declineOffer(id); await refetchRegistrations() },
    swapSpot: async (id: string, sectionId: string) => { await myChanges.swapSpot(id, sectionId); await refetchRegistrations() },
  }
  const today = localDateISO()
  const todayMarks = useMyRollCalls(today)
  const { posts } = useParentShell()
  const now = useNow(60_000)
  // Unfinished registrations saved on this device (spec 16).
  const [drafts, setDrafts] = useState<Draft[]>(() => (user ? listDrafts(user.id) : []))
  const discard = (key: string) => { clearDraft(key); setDrafts(d => d.filter(x => x.key !== key)) }

  const weeks = campSessions(sessions)
  // This camp year's registrations; last summer's don't describe this summer's weeks.
  const regs = sessions.length > 0 ? registrations.filter(r => r.year == null || r.year === campYear) : registrations
  const ready = !studentsLoading && !regsLoading && !sessionsLoading
  const open = registrationIsOpen(season, now)
  const counting = ready && !!season?.registration_opens_at && !open
  const list = ready ? listDecisions(students, regs, weeks, { campYear, registrationOpen: open, today }) : []
  const campDay = ready ? nextCampDay(students, regs, sessions, weeks, today) : null
  const weeksLabel = openWeeksLabel(weeks, today)
  const reconfirmIds = new Set(list.filter(d => d.kind === 'reconfirm').map(d => d.student.id))
  if (ready && sessions.length > 0 && open) {
    students.filter(s => s.registration_year !== campYear).forEach(s => reconfirmIds.add(s.id))
  }

  // The sign: an offer or a cancelled class first; before opening, the countdown; then the rest of
  // the decisions, an unfinished registration, or (when nothing needs the parent) the next camp day.
  const urgent = list[0] && (list[0].kind === 'offer' || list[0].kind === 'cancelled')
  const signDecision = urgent || !counting ? list[0] ?? null : null
  const restDecisions = signDecision ? list.slice(1) : list
  const signDraft = !signDecision && !counting ? drafts[0] ?? null : null
  const restDrafts = signDraft ? drafts.slice(1) : drafts

  function signFor(d: Decision): ReactNode {
    const name = camperFirstName(d.student)
    const pick = `/parent/classes?camper=${d.student.id}`
    switch (d.kind) {
      case 'offer':
        return <OfferSign d={d} now={now} onClaim={() => changes.acceptOffer(d.reg.id)} onDecline={() => changes.declineOffer(d.reg.id)} />
      case 'cancelled':
        return <ParentSign to={pick} ctx={`${name} · ${classOf(d)}, Week ${weekOf(d.reg, weeks) ?? ''}`.replace(/, Week $/, '')}
          msg={`Pick another class for ${name}`} sub="The camp cancelled this class. You're first in line for that week's waitlists." />
      case 'reconfirm':
        return <ParentSign to={pick}
          ctx={d.registered ? `${name} · yearly check for ${campYear}` : `${name} · not registered for ${weeksLabel}`}
          msg={d.registered ? `Confirm ${name}'s details for ${campYear}` : `Confirm ${name}'s details, then pick a class`}
          sub="Camp needs current details every summer." />
      case 'register':
        return <ParentSign to={pick} ctx={`${name} · not registered for ${weeksLabel}`} msg={`Pick a class for ${name}`}
          sub="Seats go first come, first served." />
    }
  }

  function rowFor(d: Decision): ReactNode {
    const name = camperFirstName(d.student)
    const pick = `/parent/classes?camper=${d.student.id}`
    switch (d.kind) {
      case 'offer':
        return (
          <DecisionRow key={d.reg.id} icon={Clock} what={`A spot opened for ${name} in ${classOf(d)}`}
            why={`Claim it${d.reg.offer_expires_at ? ` by ${campWhen(d.reg.offer_expires_at)}` : ''}, or it goes to the next family.`}>
            <a href={`#camper-${d.student.id}`} className={buttonClass('ink')}>Claim or decline</a>
          </DecisionRow>
        )
      case 'cancelled':
        return (
          <DecisionRow key={d.reg.id} icon={CalendarX} what={`${name}'s ${classOf(d)} class was cancelled`} why="You're first in line for that week's waitlists.">
            <Link to={pick} className={buttonClass('ink')}>Pick another class</Link>
          </DecisionRow>
        )
      case 'reconfirm':
        return (
          <DecisionRow key={`re-${d.student.id}`} icon={ClipboardCheck} what={`Confirm ${name}'s details for ${campYear}`}
            why={d.registered ? 'Camp needs current details every summer.' : 'Camp needs current details every summer. Then pick a class.'}>
            <Link to={pick} className={buttonClass('ink')}>Review {name}'s details</Link>
          </DecisionRow>
        )
      case 'register':
        return (
          <DecisionRow key={`reg-${d.student.id}`} icon={GraduationCap} what={`${name} isn't registered yet`} why={`Pick a class for ${weeksLabel}.`}>
            <Link to={pick} className={buttonClass('ink')}>Pick a class</Link>
          </DecisionRow>
        )
    }
  }

  const draftLink = (dr: Draft) => `/parent/register?${dr.studentId ? `studentId=${dr.studentId}&` : ''}step=${dr.draft.step}`
  const draftName = (dr: Draft) => dr.draft.name || 'your new camper'

  let sign: ReactNode = null
  if (!ready) sign = <div className="h-40 rounded bg-surface-sunken animate-pulse" aria-hidden="true" />
  else if (signDecision) sign = signFor(signDecision)
  else if (counting) sign = <RegistrationCountdown sign opensAt={season?.registration_opens_at} onOpen={() => { void refetchSeason() }} />
  else if (signDraft) {
    sign = (
      <ParentSign id="draft" ctx={`Step ${signDraft.draft.step} of 5 · saved on this device`} msg={`Finish registering ${draftName(signDraft)}`}>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link to={draftLink(signDraft)} className={buttonClass('ink', 'dark:bg-ink-950 dark:text-brand')}>Continue</Link>
          <button type="button" onClick={() => discard(signDraft.key)} className={buttonClass('text', 'text-brand-on')}>Discard</button>
        </div>
      </ParentSign>
    )
  } else if (students.length === 0) {
    sign = <ParentSign to="/parent/register" ctx="No campers yet" msg="Register your first camper"
      sub="Five short steps. Have their grade, school, allergies and an emergency contact ready." />
  } else if (campDay) sign = <CampDaySign day={campDay} today={today} />

  const needsYou = restDecisions.length + restDrafts.length > 0 && (
    <section aria-labelledby="needs-h">
      <h2 id="needs-h" className={h2}>Needs you</h2>
      <ul className="mt-3 border-y-2 border-ink">
        {restDecisions.map(rowFor)}
        {restDrafts.map(dr => (
          <DecisionRow key={dr.key} icon={FilePen} what={`Finish registering ${draftName(dr)}`} why={`Step ${dr.draft.step} of 5, saved on this device.`}>
            <Link to={draftLink(dr)} className={buttonClass('ink')}>Continue</Link>
            <button type="button" onClick={() => discard(dr.key)} className={buttonClass('text', 'text-ink-muted font-semibold')}>Discard</button>
          </DecisionRow>
        ))}
      </ul>
    </section>
  )

  const offerInSign = signDecision?.kind === 'offer' ? signDecision.reg.id : null
  const latest = posts[0]

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-8 pt-5 md:pt-8 pb-12">
      <h1 className="font-display text-[1.75rem] leading-[1.15] font-bold tracking-[-0.01em] text-balance">
        Hi, {firstName(profile?.display_name) || 'there'}
      </h1>
      {ready && students.length > 0 && <p className="mt-2 text-ink-muted text-pretty">{statusSentence(students, regs, weeks)}</p>}

      {sign && <div className="mt-5">{sign}</div>}

      <div className="mt-8 grid gap-10 lg:grid-cols-[7fr_5fr] lg:gap-x-8 lg:items-start">
        <div className="grid gap-10 min-w-0">
          {needsYou}
          {(!ready || students.length > 0) && (
            <section aria-labelledby="campers-h">
              <h2 id="campers-h" className={h2}>Your campers</h2>
              {!ready ? (
                <div className="mt-3 grid gap-3" aria-busy="true">
                  {[1, 2].map(i => <div key={i} className="h-28 rounded bg-surface-sunken animate-pulse" />)}
                </div>
              ) : (
                <ul className="mt-1 border-b-2 border-ink">
                  {students.map(student => (
                    <StudentCard
                      key={student.id}
                      student={student}
                      lines={weekLines(student.id, regs, weeks, today)}
                      needsReconfirm={reconfirmIds.has(student.id)}
                      offerInSign={offerInSign}
                      onSave={async (id, patch) => { await updateStudent(id, patch) }}
                      changes={changes}
                    />
                  ))}
                </ul>
              )}
              {/* New campers go through the full registration (waiver + emergency contact). Gold only when
                  nothing else on the view is. */}
              <Link to="/parent/register" className={buttonClass(sign ? 'secondary' : 'primary', 'mt-6')}>
                <Plus size={20} strokeWidth={2.25} aria-hidden="true" /> Register a new camper
              </Link>
            </section>
          )}
        </div>

        {ready && (
          <div className="grid gap-10 min-w-0">
            <ThisWeekCard
              students={students}
              registrations={regs}
              sessions={sessions}
              weeks={weeks}
              today={today}
              renderStatus={(st, reg) => <RollCallStatus marks={todayMarks.filter(m => m.student_id === st.id && m.section_id === reg.section_id)} />}
            />
            {latest && (
              <section aria-labelledby="latest-h">
                <h2 id="latest-h" className={h2}>Latest from camp</h2>
                <Link to="/parent/updates" className="mt-3 grid gap-1 py-3 border-y-2 border-ink no-underline">
                  <span className="text-sm text-ink-muted">
                    <b className="text-ink">{latest.author_name}</b><span className="px-[0.35em]">·</span>{parentAudience(latest)}<span className="px-[0.35em]">·</span>{timeAgo(latest.created_at)}
                  </span>
                  <span className="line-clamp-2">{latest.body}</span>
                  <span className="inline-flex items-center gap-1.5 min-h-11 font-bold underline underline-offset-[3px]">
                    All updates <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
                  </span>
                </Link>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
