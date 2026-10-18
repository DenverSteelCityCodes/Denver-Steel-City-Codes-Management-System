import { ChevronDown } from 'lucide-react'
import { useScheduleItems } from '../hooks/useScheduleItems'
import { useSectionLeadNames } from '../hooks/useSectionLeadNames'
import DailySchedule from './DailySchedule'
import { firstName, sessionDays, sessionOnDay } from '../lib/campDay'
import { daysBetween, relativeDay } from '../lib/volunteerHome'
import { holdsSeat, scheduleSpan, sessionsOf } from '../lib/homeDecision'
import type { Session, Student } from '../types/database'
import type { RegistrationWithSection } from '../hooks/useRegistrations'
import type { ReactNode } from 'react'

interface Props {
  students: Student[]
  registrations: RegistrationWithSection[]
  sessions: Session[]
  // The camp year's weeks (campSessions), to place a section that only knows its week number.
  weeks: Session[]
  today: string
  // Today's roll calls for a camper, shown on camp days only.
  renderStatus?: (student: Student, reg: RegistrationWithSection) => ReactNode
}

// "Oct 19–23"
function shortDates(s: Session): string {
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', o)
  const sameMonth = s.start_date.slice(0, 7) === s.end_date.slice(0, 7)
  return `${fmt(s.start_date, { month: 'short', day: 'numeric' })}–${fmt(s.end_date, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' })}`
}

// This week on parent Home: shown only during a week one of the campers is in, or in the 7 days
// before it. Each camper's class, room and lead; today's roll calls on camp days; the daily
// schedule folded behind one line.
export default function ThisWeekCard({ students, registrations, sessions, weeks, today, renderStatus }: Props) {
  const { items } = useScheduleItems()
  const leadNames = useSectionLeadNames()

  const seats = registrations.filter(holdsSeat)
  const inSession = (r: RegistrationWithSection, s: Session) => sessionsOf(r, sessions, weeks).some(x => x.id === s.id)
  const running = sessionOnDay(sessions, today)
  const current = running && seats.some(r => inSession(r, running))
    ? running
    : sessions
      .filter(s => s.start_date > today && daysBetween(today, s.start_date) <= 7 && seats.some(r => inSession(r, s)))
      .sort((a, b) => a.start_date.localeCompare(b.start_date))[0]
  if (!current) return null

  const campDay = sessionDays(current).indexOf(today)
  const when = current.start_date > today
    ? `starts ${relativeDay(today, current.start_date)}`
    : campDay >= 0 ? `day ${campDay + 1} of ${sessionDays(current).length}` : 'this week'
  const rows = seats.filter(r => inSession(r, current))
  const schedule = items.filter(i => i.session_id === current.id)
  const span = scheduleSpan(schedule)

  return (
    <section aria-labelledby="this-week-h" id="this-week" className="scroll-mt-32 md:scroll-mt-24">
      <h2 id="this-week-h" className="text-[1.375rem] font-bold leading-[1.2] tracking-[-0.01em]">This week</h2>
      <p className="mt-1 text-sm text-ink-muted">
        {current.name}<span className="px-[0.35em]">·</span>{shortDates(current)}<span className="px-[0.35em]">·</span>{when}
      </p>
      <ul className="mt-3 border-y-2 border-ink">
        {rows.map(reg => {
          const st = students.find(s => s.id === reg.student_id)
          if (!st) return null
          const sec = reg.sections
          const lead = leadNames.get(reg.section_id)
          const where = [sec?.room, lead && `Lead ${lead}`].filter(Boolean).join(' · ')
          return (
            <li key={reg.id} className="py-3 border-t border-border first:border-t-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span><b>{firstName(st.full_name)}</b><span className="text-ink-muted px-[0.35em]">·</span>{sec?.classes?.name}</span>
                <span className={where ? '' : 'text-sm text-ink-muted'}>{where || 'Room and lead will be posted here.'}</span>
              </div>
              {campDay >= 0 && renderStatus?.(st, reg)}
            </li>
          )
        })}
      </ul>
      <details className="group mt-2">
        <summary className="flex items-center gap-2 min-h-11 font-bold cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <span>{campDay >= 0 ? "Today's schedule" : 'Daily schedule'}{span && <span className="font-normal text-ink-muted"><span className="px-[0.35em]">·</span>{span}</span>}</span>
          <ChevronDown size={20} strokeWidth={2.25} aria-hidden="true" className="ml-auto transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-1 mb-2">
          <DailySchedule items={schedule} emptyText="The daily schedule will be posted here before camp starts." />
        </div>
      </details>
    </section>
  )
}
