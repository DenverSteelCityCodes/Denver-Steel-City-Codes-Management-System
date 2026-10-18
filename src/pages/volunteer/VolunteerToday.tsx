import { Link } from 'react-router-dom'
import { PartyPopper } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useVolunteerHome } from '../../hooks/useVolunteerHome'
import { useDutySlots } from '../../hooks/useDutyRoles'
import { useScheduleItems } from '../../hooks/useScheduleItems'
import { useVolunteerPrefs, weeksLabel } from '../../hooks/useVolunteerPrefs'
import RollCallPanel from '../../components/RollCallPanel'
import OnboardingChecklist from '../../components/OnboardingChecklist'
import { formatDayLong, formatTime, localDateISO } from '../../lib/campDay'
import { campPhase, relativeDay } from '../../lib/volunteerHome'
import { ClassList, LatestUpdate, PageHead, ScheduleBlock, Sect, linkCls, listCls } from './parts'
import { MyDutyRow } from './VolunteerDuties'
import type { AssignedSection } from '../../hooks/useAssignedClass'

// Today tab: on a camp day, a one-sentence day header and the roll call; before camp, when and
// where to show up; before a class is assigned, what the camp will assign from.
export default function VolunteerToday() {
  const { assigned: { assignedSections }, sessions } = useVolunteerHome()
  const { user } = useAuth()
  const { slots } = useDutySlots()
  const { items } = useScheduleItems()
  const today = localDateISO()

  if (assignedSections.length === 0) return <AcceptedWelcome today={today} />

  const phase = campPhase(assignedSections, sessions, today)
  const myDuties = slots.filter(s => s.slot_date >= today && s.assignments?.some(a => a.volunteer_id === user?.id))
  const sorted = [...assignedSections].sort((a, b) => (a.week ?? 9) - (b.week ?? 9))

  if (phase.kind === 'today') {
    const running = assignedSections.filter(s => s.session_id === phase.session.id)
    const dutiesToday = myDuties.filter(s => s.slot_date === today).map(s => s.duty_type?.name).filter(Boolean)
    return (
      <>
        <PageHead dateline={formatDayLong(today)} title={`Day ${phase.day} of ${phase.session.name}`}>
          {dayLine(running)}
          {dutiesToday.length > 0 && <> You're also on <b>{dutiesToday.join(' and ')}</b>.</>}
        </PageHead>
        {/* One column until 1024px: the roll call needs the full width for its band and toggles. */}
        <div className="lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-10 lg:items-start">
          <div className="space-y-8 mt-6">
            {running.map(sec => <RollCallPanel key={sec.id} section={sec} showClass={running.length > 1} />)}
          </div>
          <div>
            {/* Spec 35: anything still open on the onboarding checklist; the roll call comes first. */}
            <OnboardingChecklist />
            <ScheduleBlock items={items.filter(i => i.session_id === phase.session.id)} live />
            <LatestUpdate />
          </div>
        </div>
      </>
    )
  }

  const next = phase.kind === 'upcoming' ? phase.session : null
  const firstItem = next ? items.filter(i => i.session_id === next.id).sort((a, b) => a.start_time.localeCompare(b.start_time))[0] : undefined
  const title = next ? `${next.name} starts ${relativeDay(today, next.start_date)}`
    : phase.kind === 'over' ? "That's a wrap" : 'Your classes'

  return (
    <>
      <PageHead dateline={formatDayLong(today)} title={title}>
        {next ? <>Your first day is <b>{formatDayLong(next.start_date)}</b>{firstItem ? <>, and the day starts at <b>{formatTime(firstItem.start_time)}</b></> : ''}. Roll calls open that morning, right here.</>
          : phase.kind === 'over' ? 'Camp is over for this year. Thank you for volunteering.'
            : "Your class isn't tied to a camp week yet. An admin will set that before camp."}
      </PageHead>
      <div className="sm:grid sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] sm:gap-10 sm:items-start">
        <div>
          <OnboardingChecklist />
          <Sect title="Your classes" action={<Link to="/volunteer/classes" className={linkCls}>Rosters</Link>}>
            <ClassList sections={sorted} />
          </Sect>
          {phase.kind !== 'over' && (
            <Sect title="Your duties" action={<Link to="/volunteer/duties" className={linkCls}>{myDuties.length ? 'Find more' : 'Sign up'}</Link>}>
              {myDuties.length > 0
                ? <div className={listCls}>{myDuties.map(s => <MyDutyRow key={s.id} slot={s} />)}</div>
                : <p className="font-sans text-[15px] text-ink-muted">You haven't signed up for any duties yet.</p>}
            </Sect>
          )}
        </div>
        <div>
          {next && <ScheduleBlock items={items.filter(i => i.session_id === next.id)} live={false} />}
          <LatestUpdate />
        </div>
      </div>
    </>
  )
}

// "You're leading Intro to Python, PY-B in Room 102 from 9:00 AM to 3:00 PM."
function dayLine(running: AssignedSection[]) {
  if (running.length !== 1) {
    return <>You're with <b>{running.map(s => `${s.class_name}, ${s.label}`).join(' and ')}</b> today.</>
  }
  const s = running[0]
  return (
    <>
      You're {s.is_lead ? 'leading' : 'supporting'} <b>{s.class_name}, {s.label}</b>
      {s.room ? ` in ${s.room}` : ''}
      {s.start_time ? ` from ${formatTime(s.start_time)}${s.end_time ? ` to ${formatTime(s.end_time)}` : ''}` : ''}.
    </>
  )
}

function AcceptedWelcome({ today }: { today: string }) {
  const { prefs } = useVolunteerPrefs()
  return (
    <>
      <PageHead dateline={formatDayLong(today)} title="You're on the crew">
        An admin will assign your class before camp starts. When they do, it shows up here and under Classes.
      </PageHead>
      <div className="sm:grid sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] sm:gap-10 sm:items-start">
        <div>
          <OnboardingChecklist />
          {prefs && (
            <Sect title="What we'll assign you from" action={<Link to="/volunteer/profile" className={linkCls}>Change</Link>}>
              <dl className="bg-surface border border-border rounded-[14px] p-4 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 font-sans text-base">
                <dt className="text-ink-muted">Weeks</dt><dd className="font-semibold text-ink">{weeksLabel(prefs)}</dd>
                <dt className="text-ink-muted">First choice</dt><dd className="font-semibold text-ink">{prefs.course_first_choice || 'No preference'}</dd>
                <dt className="text-ink-muted">Second choice</dt><dd className="font-semibold text-ink">{prefs.course_second_choice || 'No preference'}</dd>
              </dl>
            </Sect>
          )}
          <Sect title="Duties are open" action={<Link to="/volunteer/duties" className={linkCls}>Browse</Link>}>
            <p className="font-sans text-[15px] text-ink-muted flex items-start gap-2">
              <PartyPopper size={17} className="shrink-0 mt-0.5 text-role-volunteer" aria-hidden="true" />
              You can sign up for duty slots now, before your class is assigned.
            </p>
          </Sect>
        </div>
        <div><LatestUpdate /></div>
      </div>
    </>
  )
}
