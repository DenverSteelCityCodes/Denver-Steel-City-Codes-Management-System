import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, UserPlus, GraduationCap } from 'lucide-react'
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
import InlineConfirm from '../components/InlineConfirm'
import CamperRow from '../components/CamperRow'
import { listDrafts, clearDraft } from '../lib/registrationDraft'
import { formatDayLong, formatTime, formatTimeRange, localDateISO, ROLL_CALLS } from '../lib/campDay'
import { buildSubhead, camperFirstName, homeBand, rowRegistrations, type HomeBand } from '../lib/parentHome'
import { CAMP_SITE } from '../lib/campSite'
import type { RollCallMark, ScheduleItem, Student } from '../types/database'
import type { Session } from '../hooks/useSessions'
import { LatestUpdate, PageHead, ScheduleBlock, Sect, btnCls, linkCls, listCls, primaryCls } from './volunteer/parts'

// Parent Home (issue #167): the status sentence, one band for what matters right now, one row per
// camper (tap for the class and the change actions), then the day at camp and the latest update.
export default function ParentDashboard() {
  const { profile, user } = useAuth()
  const { students, loading } = useStudents()
  const { registrations, refetch } = useRegistrations()
  const myChanges = useMyChanges(students.length > 0)
  const changes = {
    ...myChanges,
    cancelSpot: async (id: string) => { await myChanges.cancelSpot(id); await refetch() },
    swapSpot: async (id: string, sectionId: string) => { await myChanges.swapSpot(id, sectionId); await refetch() },
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
      <RegistrationCountdown opensAt={season?.registration_opens_at} />
      <PageHead title={first ? `Hi, ${first}` : 'Hi'}>
        {!loading && (students.length ? buildSubhead(students, registrations) : null)}
      </PageHead>

      <div className="sm:grid sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] sm:gap-10 sm:items-start">
        <div>
          {band && <Band band={band} students={students} marks={marks} schedule={schedule} leadNames={leadNames}
            onAccept={async id => { await myChanges.acceptOffer(id); await refetch() }}
            onDecline={async id => { await myChanges.declineOffer(id); await refetch() }} />}

          {drafts.map(({ key, studentId, draft }) => (
            <div key={key} className="mt-6 bg-surface border border-border rounded-[14px] p-4">
              <p className="font-sans text-base text-ink">
                <span className="font-semibold">Finish registering {draft.name || 'your new camper'}.</span>{' '}
                <span className="text-ink-muted">You're on step {draft.step} of 5. Your answers are saved on this device.</span>
              </p>
              <div className="flex gap-2 mt-3">
                <Link to={`/parent/register?${studentId ? `studentId=${studentId}&` : ''}step=${draft.step}`} className={primaryCls}>Continue</Link>
                <button type="button" onClick={() => { clearDraft(key); setDrafts(d => d.filter(x => x.key !== key)) }} className={btnCls}>Discard</button>
              </div>
            </div>
          ))}

          {loading ? (
            <div className="mt-7 h-40 bg-surface-sunken rounded-[14px] animate-pulse" aria-busy="true" />
          ) : students.length > 0 && (
            <Sect title="Your campers" id="campers-h" action={<Link to="/parent/classes" className={linkCls}>Find a class</Link>}>
              <div className={listCls}>
                {students.map(s => (
                  <CamperRow key={s.id} student={s} regs={rowRegistrations(s.id, registrations)} sessions={sessions}
                    leadNames={leadNames} changes={changes} open={open === s.id} onToggle={() => setOpen(o => (o === s.id ? null : s.id))} />
                ))}
              </div>
            </Sect>
          )}
        </div>

        <div className="sm:pt-[18px]">
          {students.length > 0 && <ScheduleBlock items={schedule} live={band?.kind === 'campDay'} fold />}
          <LatestUpdate to="/parent/updates" />
        </div>
      </div>
    </>
  )
}

const bandCls = 'mt-6 -mx-4 sm:mx-0 sm:rounded-[14px] bg-ink-950 dark:bg-surface-raised dark:border-y sm:dark:border dark:border-border-strong text-white px-4 sm:px-6 py-5'
const bandText = 'mt-1.5 font-sans text-[15.5px] leading-normal text-white/80 [&_b]:text-white [&_b]:font-semibold'
const ghostOnBand = 'h-11 px-4 rounded-[10px] border border-white/35 text-white font-sans font-semibold text-[15px] inline-flex items-center justify-center gap-1.5 hover:bg-white/10 transition disabled:opacity-50'

function Band({ band, students, marks, schedule, leadNames, onAccept, onDecline }: {
  band: NonNullable<HomeBand>
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
    <section aria-labelledby="band-h" className={bandCls}>
      <h2 id="band-h" className="font-sans text-[21px] font-bold leading-tight">Register your first camper</h2>
      <p className={bandText}>Five short steps, about ten minutes. Your answers are saved on this device as you go, so you can finish later.</p>
      <ol className="mt-3 space-y-1.5">
        {['The camper', 'You and an emergency contact', 'Health and details', 'Week and class', 'Waiver and consent'].map((t, i) => (
          <li key={t} className="flex items-center gap-2.5 font-sans text-[15px] text-white/85">
            <span aria-hidden="true" className="w-6 h-6 rounded-full border border-white/35 grid place-items-center text-[13px] font-bold">{i + 1}</span>{t}
          </li>
        ))}
      </ol>
      <Link to="/parent/register" className={`${primaryCls} mt-4`}><UserPlus size={16} /> Start registering</Link>
    </section>
  )

  if (band.kind === 'offer') return <OfferBand reg={band.reg} name={nameOf(band.reg)} onAccept={onAccept} onDecline={onDecline} />

  if (band.kind === 'cancelled') {
    const r = band.reg
    return (
      <section aria-labelledby="band-h" className={bandCls}>
        <h2 id="band-h" className="font-sans text-[21px] font-bold leading-tight">{nameOf(r)}'s class was cancelled</h2>
        <p className={bandText}>Sorry, the camp cancelled <b>{r.sections?.classes?.name ?? 'the class'}</b>{r.sections?.week ? ` for Week ${r.sections.week}` : ''}. {nameOf(r)} is first in line for that week's waitlists.</p>
        <Link to={`/parent/classes?camper=${r.student_id}`} className={`${primaryCls} mt-4`}><GraduationCap size={16} /> Pick another class</Link>
      </section>
    )
  }

  const sorted = [...schedule].sort((a, b) => a.start_time.localeCompare(b.start_time))
  const dropOff = sorted[0]
  const pickup = sorted.length > 1 ? sorted[sorted.length - 1] : null
  const where = (i: ScheduleItem) => (i.location ? ` in the ${i.location.toLowerCase()}` : '')

  if (band.kind === 'campDay') return (
    <section aria-labelledby="band-h" className={bandCls}>
      <h2 id="band-h" className="font-sans text-[21px] font-bold leading-tight">{formatDayLong(localDateISO())}: day {band.day} of camp</h2>
      {pickup && <p className={bandText}>{pickup.title} starts at <b>{formatTime(pickup.start_time)}</b>{where(pickup)}.</p>}
      {band.seats.map(r => {
        const mine = marks.filter(m => m.student_id === r.student_id && m.section_id === r.section_id)
        const arrival = mine.find(m => m.roll_call === 'arrival')
        const time = (m: RollCallMark) => formatTime(new Date(m.marked_at).toTimeString().slice(0, 5))
        const lead = leadNames.get(r.section_id)
        return (
          <div key={r.id} className="mt-3 pt-3 border-t border-white/15">
            <p className="font-sans text-[17px] font-semibold">
              {arrival ? (arrival.present ? `${nameOf(r)} checked in at ${time(arrival)}` : `${nameOf(r)} was marked absent at arrival`) : `${nameOf(r)} hasn't been checked in yet`}
            </p>
            <p className="font-sans text-[15px] text-white/80">{[r.sections?.classes?.name, r.sections?.room && `in ${r.sections.room}`, lead && `with ${lead}`].filter(Boolean).join(' ')}</p>
            <ul aria-label={`${nameOf(r)}'s roll calls today`} className="mt-2 flex flex-wrap gap-1.5">
              {ROLL_CALLS.map(rc => {
                const m = mine.find(x => x.roll_call === rc.key)
                return (
                  <li key={rc.key} className={`inline-flex items-center gap-1 h-8 px-3 rounded-full font-sans text-sm font-semibold ${
                    !m ? 'border border-white/25 text-white/80' : m.present ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
                    {m?.present && <Check size={14} aria-hidden="true" />}
                    {rc.label}{m ? `, ${m.present ? time(m) : 'absent'}` : ''}
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </section>
  )

  return <UpcomingBand session={band.session} dropOff={dropOff} pickup={pickup} where={where} />
}

function UpcomingBand({ session, dropOff, pickup, where }: { session: Session; dropOff?: ScheduleItem; pickup: ScheduleItem | null; where: (i: ScheduleItem) => string }) {
  return (
    <section aria-labelledby="band-h" className={bandCls}>
      <h2 id="band-h" className="font-sans text-[21px] font-bold leading-tight">{session.name} starts {formatDayLong(session.start_date)}</h2>
      <p className={bandText}>
        At <b>{CAMP_SITE}</b>.{' '}
        {dropOff ? <>{dropOff.title} is <b>{formatTimeRange(dropOff.start_time, dropOff.end_time)}</b>{where(dropOff)}{pickup ? <>, and {pickup.title.toLowerCase()} starts at <b>{formatTime(pickup.start_time)}</b></> : null}.</>
          : 'The daily schedule will be posted here before camp.'}
      </p>
    </section>
  )
}

// A waitlist offer (spec 10): claim it (confirms at once) or decline it (passes it on), asked inline.
function OfferBand({ reg, name, onAccept, onDecline }: { reg: RegistrationWithSection; name: string; onAccept: (id: string) => Promise<void>; onDecline: (id: string) => Promise<void> }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const until = reg.offer_expires_at
    ? new Date(reg.offer_expires_at).toLocaleString('en-US', { timeZone: 'America/Denver', weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null
  const where = `${reg.sections?.classes?.name ?? 'the class'}${reg.sections?.week ? `, Week ${reg.sections.week}` : ''}`

  async function run(fn: () => Promise<void>) {
    setBusy(true); setErr(null)
    try { await fn() } catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong') }
    finally { setBusy(false) }
  }

  return (
    <section aria-labelledby="band-h" className={bandCls}>
      <h2 id="band-h" className="font-sans text-[21px] font-bold leading-tight">A spot opened for {name}</h2>
      <p className={bandText}><b>{where}</b>.{until ? <> Claim it by <b>{until}</b> (Denver time), or it goes to the next family on the waitlist.</> : ' Claim it before the offer ends.'}</p>
      {confirming ? (
        <div className="mt-4 -mx-4 sm:mx-0 sm:rounded-[10px] overflow-hidden">
          <InlineConfirm
            message={`Decline the spot in ${where}? It goes to the next family, and ${name} leaves this waitlist.`}
            confirmLabel="Decline spot"
            cancelLabel="Keep the offer"
            busy={busy}
            onConfirm={() => { void run(() => onDecline(reg.id)) }}
            onCancel={() => { setConfirming(false); setErr(null) }}
          />
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => { void run(() => onAccept(reg.id)) }} className={primaryCls}>
            <Check size={16} /> {busy ? 'Claiming…' : 'Claim the spot'}
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirming(true)} className={ghostOnBand}>Decline</button>
        </div>
      )}
      {err && <p role="alert" className="mt-2 font-sans text-sm text-white">{err}</p>}
    </section>
  )
}

