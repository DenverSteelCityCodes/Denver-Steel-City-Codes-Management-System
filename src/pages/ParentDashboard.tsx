import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, CircleAlert, Clock, UserPlus, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useStudents } from '../hooks/useStudents'
import { useRegistrations, type RegistrationWithSection } from '../hooks/useRegistrations'
import { useMyRollCalls } from '../hooks/useMyRollCalls'
import { useSessions, activeCampYear } from '../hooks/useSessions'
import { useSeasonSettings } from '../hooks/useSeasonSettings'
import { useScheduleItems } from '../hooks/useScheduleItems'
import { useSectionLeadNames } from '../hooks/useSectionLeadNames'
import { useMyChanges } from '../hooks/useMyChanges'
import RegistrationCountdown from '../components/RegistrationCountdown'
import NotifyMeSwitch from '../components/NotifyMeSwitch'
import SignBand from '../components/SignBand'
import CamperRow from '../components/CamperRow'
import UrgentBanner from '../components/UrgentBanner'
import { listDrafts, clearDraft } from '../lib/registrationDraft'
import { formatDayLong, formatTime, formatTimeRange, localDateISO, ROLL_CALLS } from '../lib/campDay'
import { buildSubhead, camperFirstName, homeBand, rowRegistrations, type HomeBand } from '../lib/parentHome'
import { daysBetween } from '../lib/volunteerHome'
import { buttonClass } from '../lib/ui'
import type { RollCallMark, ScheduleItem, Student } from '../types/database'
import type { Session } from '../hooks/useSessions'
import { LatestUpdate, PageHead, Schedule, Sect, framedCls, mutedTextBtn, textBtn } from './parent/parts'

// Parent Home (issue #167): the status sentence, one band for what matters right now, one row per
// camper (tap for the class and the change actions), then the day at camp and the latest update.
// The band is the junction sign (DESIGN.md): gold, with the number to act on at display scale; on
// a camp day it turns ink (the roll-call sign) with the pickup time in gold.
export default function ParentDashboard() {
  const { profile, user } = useAuth()
  const { students, loading } = useStudents()
  const { registrations, refetch } = useRegistrations()
  const myChanges = useMyChanges(students.length > 0)
  const changes = {
    ...myChanges,
    cancelSpot: async (id: string) => { await myChanges.cancelSpot(id); await refetch() },
    swapSpot: async (id: string, sectionId: string) => { await myChanges.swapSpot(id, sectionId); await refetch() },
    setPlaceWith: async (id: string, placeWith: string) => { await myChanges.setPlaceWith(id, placeWith); await refetch() },
  }
  const today = localDateISO()
  const marks = useMyRollCalls(today)
  const { sessions } = useSessions()
  const { settings: season } = useSeasonSettings(sessions.length > 0 ? activeCampYear(sessions) : null)
  const { items } = useScheduleItems()
  const leadNames = useSectionLeadNames()
  const [open, setOpen] = useState<string | null>(null)
  // Unfinished registrations saved on this device (spec 16).
  const [drafts, setDrafts] = useState(() => (user ? listDrafts(user.id) : []))

  const band = loading ? null : homeBand(students, registrations, sessions, today)
  // The schedule of the week the band is about, else the next active week.
  const bandSession = band?.kind === 'campDay' || band?.kind === 'upcoming' ? band.session : null
  const scheduleSession = bandSession ?? sessions.filter(s => s.is_active && s.end_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date))[0]
  const schedule = scheduleSession ? items.filter(i => i.session_id === scheduleSession.id) : []
  const first = profile?.display_name?.split(' ')[0]

  return (
    <>
      {/* An urgent notice from camp (spec 34) comes before everything else, until the end of its day. */}
      <UrgentBanner className="mt-4 mb-6" />
      <RegistrationCountdown opensAt={season?.registration_opens_at}><NotifyMeSwitch /></RegistrationCountdown>
      <PageHead title={first ? `Hi, ${first}` : 'Hi'}>
        {!loading && (students.length ? buildSubhead(students, registrations) : null)}
      </PageHead>

      <div className="lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-8 lg:items-start">
        <div className="min-w-0">
          {band && (
            <div className="mt-5">
              <Band band={band} today={today} students={students} marks={marks} schedule={schedule} leadNames={leadNames}
                onAccept={async id => { await myChanges.acceptOffer(id); await refetch() }}
                onDecline={async id => { await myChanges.declineOffer(id); await refetch() }} />
            </div>
          )}

          {drafts.length > 0 && (
            <ul aria-label="Unfinished registrations" className={`mt-8 ${framedCls}`}>
              {drafts.map(({ key, studentId, draft }) => (
                <li key={key} className="py-4 border-t-2 border-ink first:border-t-0">
                  <p className="text-lg font-bold leading-snug">Finish registering {draft.name || 'your new camper'}.</p>
                  <p className="mt-1 text-ink-muted">You're on step {draft.step} of 5. Your answers are saved on this device.</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                    <Link to={`/parent/register?${studentId ? `studentId=${studentId}&` : ''}step=${draft.step}`} className={buttonClass('ink')}>Continue</Link>
                    <button type="button" onClick={() => { clearDraft(key); setDrafts(d => d.filter(x => x.key !== key)) }} className={mutedTextBtn}>Discard</button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {loading ? (
            <div className="mt-10 h-40 rounded bg-surface-sunken animate-pulse" aria-busy="true" />
          ) : students.length > 0 && (
            <Sect title="Your campers" id="campers-h" action={<Link to="/parent/classes" className={textBtn}>Find a class</Link>}>
              <ul className={framedCls}>
                {students.map(s => (
                  <CamperRow key={s.id} student={s} regs={rowRegistrations(s.id, registrations)} sessions={sessions}
                    leadNames={leadNames} changes={changes} open={open === s.id} onToggle={() => setOpen(o => (o === s.id ? null : s.id))} />
                ))}
              </ul>
            </Sect>
          )}
        </div>

        <div className="min-w-0 lg:[&>section:first-child]:mt-5">
          {students.length > 0 && <Schedule items={schedule} live={band?.kind === 'campDay'} />}
          <LatestUpdate />
        </div>
      </div>
    </>
  )
}

// Controls that sit on a gold sign: ink stays ink at night (a bone button would vanish on gold),
// and focus rings are ink (the night ring is gold). `!` beats the unlayered global focus rule.
const onSignFocus = 'focus-visible:outline-brand-on!'
const onSignBtn = buttonClass('ink', `bg-brand-on text-brand ${onSignFocus}`)
const onSignText = buttonClass('text', `text-brand-on ${onSignFocus}`)

function Band({ band, today, students, marks, schedule, leadNames, onAccept, onDecline }: {
  band: NonNullable<HomeBand>
  today: string
  students: Student[]
  marks: RollCallMark[]
  schedule: ScheduleItem[]
  leadNames: Map<string, string>
  onAccept: (id: string) => Promise<void>
  onDecline: (id: string) => Promise<void>
}) {
  const nameOf = (r: RegistrationWithSection) => {
    const s = students.find(x => x.id === r.student_id)
    return s ? camperFirstName(s) : 'Your camper'
  }

  if (band.kind === 'register') return (
    <SignBand id="band" context="About ten minutes" figure={5} unit="steps" message="Register your first camper"
      sub="Your answers are saved on this device as you go, so you can finish later.">
      <ol className="mt-3 grid gap-1">
        {['The camper', 'You and an emergency contact', 'Health and details', 'Week and class', 'Waiver and consent'].map((t, i) => (
          <li key={t} className="flex gap-3"><span aria-hidden="true" className="w-3 font-extrabold">{i + 1}</span>{t}</li>
        ))}
      </ol>
      <Link to="/parent/register" className={`${onSignBtn} mt-4`}><UserPlus size={20} strokeWidth={2.25} aria-hidden="true" /> Start registering</Link>
    </SignBand>
  )

  if (band.kind === 'offer') return <OfferBand reg={band.reg} name={nameOf(band.reg)} onAccept={onAccept} onDecline={onDecline} />

  if (band.kind === 'cancelled') {
    const r = band.reg
    const cls = r.sections?.classes?.name ?? 'the class'
    const week = r.sections?.week ? ` for Week ${r.sections.week}` : ''
    const sub = `Sorry, the camp cancelled ${cls}${week}. ${nameOf(r)} is first in line for that week's waitlists. Pick another class.`
    return (
      <SignBand id="band" to={`/parent/classes?camper=${r.student_id}`} label={`${nameOf(r)}'s class was cancelled. ${sub}`}
        context={`${cls}${r.sections?.week ? `, Week ${r.sections.week}` : ''}`} message={`${nameOf(r)}'s class was cancelled`} sub={sub} />
    )
  }

  const sorted = [...schedule].sort((a, b) => a.start_time.localeCompare(b.start_time))
  const dropOff = sorted[0]
  const pickup = sorted.length > 1 ? sorted[sorted.length - 1] : null
  const where = (i: ScheduleItem) => (i.location ? ` in the ${i.location.toLowerCase()}` : '')

  if (band.kind === 'campDay') {
    const [time, meridiem] = pickup ? formatTime(pickup.start_time).split(' ') : []
    return (
      <InkSign id="band" context={`${formatDayLong(today)}, day ${band.day} of camp`} figure={time} unit={meridiem}
        message={pickup ? `${pickup.title}${where(pickup)}` : `Day ${band.day} of camp`}>
        <ul className="mt-3">
          {band.seats.map(r => {
            const mine = marks.filter(m => m.student_id === r.student_id && m.section_id === r.section_id)
            const arrival = mine.find(m => m.roll_call === 'arrival')
            const at = (m: RollCallMark) => formatTime(new Date(m.marked_at).toTimeString().slice(0, 5))
            const lead = leadNames.get(r.section_id)
            return (
              <li key={r.id} className="py-3 border-t border-on-shell-muted/40">
                <p className="text-lg font-bold leading-snug">
                  {arrival ? (arrival.present ? `${nameOf(r)} checked in at ${at(arrival)}` : `${nameOf(r)} was marked absent at arrival`) : `${nameOf(r)} hasn't been checked in yet`}
                </p>
                <p className="text-on-shell-muted">{[r.sections?.classes?.name, r.sections?.room && `in ${r.sections.room}`, lead && `with ${lead}`].filter(Boolean).join(' ')}</p>
                <ul aria-label={`${nameOf(r)}'s roll calls today`} className="mt-2 flex flex-wrap gap-2">
                  {ROLL_CALLS.map(rc => {
                    const m = mine.find(x => x.roll_call === rc.key)
                    const Icon = !m ? Clock : m.present ? Check : X
                    return (
                      <li key={rc.key} className={`inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-sm font-bold leading-none ${
                        !m ? 'text-on-shell-muted ring-2 ring-inset ring-on-shell-muted/60' : m.present ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
                        <Icon size={16} strokeWidth={2.5} aria-hidden="true" />
                        {rc.label}{m ? `, ${m.present ? at(m) : 'absent'}` : <span className="sr-only">, not yet</span>}
                      </li>
                    )
                  })}
                </ul>
              </li>
            )
          })}
        </ul>
      </InkSign>
    )
  }

  return <UpcomingBand session={band.session} today={today} dropOff={dropOff} pickup={pickup} where={where} />
}

function UpcomingBand({ session, today, dropOff, pickup, where }: { session: Session; today: string; dropOff?: ScheduleItem; pickup: ScheduleItem | null; where: (i: ScheduleItem) => string }) {
  const days = daysBetween(today, session.start_date)
  const b = 'font-bold text-brand-on'
  return (
    <SignBand id="band" context={session.location ? `At ${session.location}` : 'Before camp'} figure={days} unit={days === 1 ? 'day' : 'days'}
      message={`${session.name} starts ${formatDayLong(session.start_date)}`}
      sub={dropOff
        ? <>{dropOff.title} is <b className={b}>{formatTimeRange(dropOff.start_time, dropOff.end_time)}</b>{where(dropOff)}{pickup ? <>, and {pickup.title.toLowerCase()} starts at <b className={b}>{formatTime(pickup.start_time)}</b></> : null}.</>
        : 'The daily schedule will be posted here before camp.'} />
  )
}

// A waitlist offer (spec 10): claim it (confirms at once) or decline it (passes it on), asked inline
// on the sign. The figure is the time left, kept current while the page is open.
function OfferBand({ reg, name, onAccept, onDecline }: { reg: RegistrationWithSection; name: string; onAccept: (id: string) => Promise<void>; onDecline: (id: string) => Promise<void> }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  const confirmId = useId()
  const until = reg.offer_expires_at
    ? new Date(reg.offer_expires_at).toLocaleString('en-US', { timeZone: 'America/Denver', weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null
  const left = reg.offer_expires_at ? new Date(reg.offer_expires_at).getTime() - now : 0
  const figure = left <= 0 ? null : left >= 3_600_000 ? Math.floor(left / 3_600_000) : Math.ceil(left / 60_000)
  const where = `${reg.sections?.classes?.name ?? 'the class'}${reg.sections?.week ? `, Week ${reg.sections.week}` : ''}`

  async function run(fn: () => Promise<void>) {
    setBusy(true); setErr(null)
    try { await fn() } catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong') }
    finally { setBusy(false) }
  }

  return (
    <SignBand id="band" context={where} figure={figure} unit={left >= 3_600_000 ? 'h left' : 'min left'}
      message={`A spot opened for ${name}`}
      sub={until ? <>Claim it by <b className="font-bold text-brand-on">{until}</b> (Denver time), or it goes to the next family on the waitlist.</> : 'Claim it before the offer ends.'}>
      {confirming ? (
        <div role="group" aria-labelledby={confirmId} onKeyDown={e => { if (e.key === 'Escape') { setConfirming(false); setErr(null) } }}
          className="mt-3 rounded border-2 border-brand-on p-4">
          <p id={confirmId} className="font-bold text-pretty">Decline the spot in {where}? It goes to the next family, and {name} leaves this waitlist.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" autoFocus onClick={() => { setConfirming(false); setErr(null) }}
              className={buttonClass('secondary', `border-brand-on text-brand-on ${onSignFocus}`)}>Keep the offer</button>
            <button type="button" disabled={busy} aria-busy={busy} onClick={() => { void run(() => onDecline(reg.id)) }}
              className={buttonClass('danger', `bg-alarm border-alarm text-on-shell hover:bg-alarm/90 ${onSignFocus}`)}>
              {busy ? 'Declining…' : 'Decline spot'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <button type="button" disabled={busy} onClick={() => { void run(() => onAccept(reg.id)) }} className={onSignBtn}>
            <Check size={20} strokeWidth={2.5} aria-hidden="true" /> {busy ? 'Claiming…' : 'Claim the spot'}
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirming(true)} className={onSignText}>Decline</button>
        </div>
      )}
      {err && (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm font-bold">
          <CircleAlert size={16} strokeWidth={2.5} aria-hidden="true" className="shrink-0 mt-0.5" />{err}
        </p>
      )}
    </SignBand>
  )
}

// The ink sign (DESIGN.md › Sign Band, ink variant: camp-day roll call). The shared SignBand is
// gold only, so the camp-day band keeps this local copy of its grid with ink colours and a gold
// figure. A candidate to fold into SignBand as a variant.
function InkSign({ id, context, figure, unit, message, children }: { id: string; context: ReactNode; figure?: string; unit?: string; message: ReactNode; children?: ReactNode }) {
  const headingId = `${id}-h`
  return (
    <section id={id} aria-labelledby={headingId}
      className="grid grid-cols-[1fr_auto] items-end gap-x-4 gap-y-1 rounded p-4 bg-shell text-on-shell scroll-mt-32 md:scroll-mt-24 dark:ring-1 dark:ring-inset dark:ring-border">
      <span className="col-span-full text-sm font-bold text-on-shell-muted">{context}</span>
      {figure && (
        <span className="col-span-full font-extrabold text-[3.5rem] md:text-[4.5rem] leading-[0.92] tracking-[-0.03em] text-brand [font-variant-numeric:tabular-nums_lining-nums]">
          {figure}{unit && <small className="ml-[0.15em] text-[0.42em] tracking-normal font-extrabold">{unit}</small>}
        </span>
      )}
      <h2 id={headingId} tabIndex={-1} className="col-span-full text-[1.375rem] font-extrabold leading-[1.15] text-balance focus:outline-none">{message}</h2>
      {children && <div className="col-span-full">{children}</div>}
    </section>
  )
}
