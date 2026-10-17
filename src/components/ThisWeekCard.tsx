import { CalendarDays, MapPin, Clock, User } from 'lucide-react'
import { useSessions, formatSessionDates } from '../hooks/useSessions'
import { useScheduleItems } from '../hooks/useScheduleItems'
import { useSectionLeadNames } from '../hooks/useSectionLeadNames'
import DailySchedule, { ScheduleHeading } from './DailySchedule'
import { localDateISO, parseLocalDate, formatTimeRange, firstName, sessionOnDay } from '../lib/campDay'
import type { Student } from '../types/database'
import type { RegistrationWithSection } from '../hooks/useRegistrations'
import type { ReactNode } from 'react'

interface Props {
  students: Student[]
  registrations: RegistrationWithSection[]
  // Optional per-camper status line (today's roll calls), rendered under the schedule line.
  renderStatus?: (student: Student, reg: RegistrationWithSection) => ReactNode
}

// Parent "this week" card: which session is on (or next), each camper's class · time · room ·
// lead, and the day's schedule. Replaces the old session strip once camp is near.
export default function ThisWeekCard({ students, registrations, renderStatus }: Props) {
  const { sessions, loading } = useSessions()
  const { items } = useScheduleItems()
  const leadNames = useSectionLeadNames()
  if (loading) return null

  const today = localDateISO()
  const upcoming = sessions
    .filter(s => s.is_active && s.end_date >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
  const current = sessionOnDay(sessions, today) ?? upcoming[0] ?? null
  if (!current) return null

  const msPerDay = 86_400_000
  const daysToStart = Math.round((parseLocalDate(current.start_date).getTime() - parseLocalDate(today).getTime()) / msPerDay)
  const chip = daysToStart > 0
    ? { label: daysToStart === 1 ? 'Starts tomorrow' : `Starts in ${daysToStart} days`, cls: 'bg-info-soft text-info' }
    : { label: 'Happening now', cls: 'bg-success-soft text-success' }

  const inSession = (r: RegistrationWithSection, s: typeof current) =>
    r.sections?.session_id ? r.sections.session_id === s.id : r.sections?.week === upcoming.indexOf(s) + 1
  const active = registrations.filter(r => r.status === 'confirmed' || r.status === 'pending')
  const later = upcoming.filter(s => s.id !== current.id)
  const schedule = items.filter(i => i.session_id === current.id)

  return (
    <section aria-labelledby="this-week-heading" className="bg-surface border border-border rounded-xl shadow-sm mb-8 overflow-hidden">
      <div className="p-4 sm:p-5 flex items-center gap-4">
        <div className="w-11 h-11 rounded-full bg-brand-soft flex items-center justify-center shrink-0">
          <CalendarDays size={20} className="text-warning" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="this-week-heading" className="font-sans font-semibold text-base text-ink">
            {daysToStart > 0 ? 'Next up' : 'This week'} · {current.name}
          </h2>
          <p className="font-slab text-sm text-ink-muted">{formatSessionDates(current)}</p>
        </div>
        <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${chip.cls}`}>{chip.label}</span>
      </div>

      <ul className="border-t border-border divide-y divide-border">
        {students.map(st => {
          const reg = active.find(r => r.student_id === st.id && inSession(r, current))
          const wait = registrations.find(r => r.student_id === st.id && r.status === 'waitlisted' && inSession(r, current))
          const sec = reg?.sections
          const lead = reg ? leadNames.get(reg.section_id) : undefined
          return (
            <li key={st.id} className="px-4 sm:px-5 py-3">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-sans font-semibold text-sm text-ink">{firstName(st.full_name)}</span>
                {sec ? (
                  <span className="font-sans text-sm text-ink">{sec.classes?.name}{sec.label ? ` · ${sec.label}` : ''}</span>
                ) : wait ? (
                  <span className="font-sans text-sm text-ink-muted">on the waitlist for {wait.sections?.classes?.name ?? 'a class'}</span>
                ) : (
                  <span className="font-sans text-sm text-ink-muted">not registered for {current.name}</span>
                )}
              </div>
              {sec && (
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-sans text-xs text-ink-muted">
                  {sec.start_time && <span className="inline-flex items-center gap-1"><Clock size={12} /> {sec.days} · {formatTimeRange(sec.start_time, sec.end_time)}</span>}
                  {sec.room && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {sec.room}</span>}
                  {lead && <span className="inline-flex items-center gap-1"><User size={12} /> Lead: {lead}</span>}
                  {!sec.start_time && !sec.room && !lead && <span>Times and room will be posted here.</span>}
                </p>
              )}
              {reg && renderStatus?.(st, reg)}
            </li>
          )
        })}
      </ul>

      {later.length > 0 && (
        <ul className="border-t border-border px-4 sm:px-5 py-2.5 space-y-0.5">
          {later.flatMap(s => active.filter(r => inSession(r, s)).map(r => {
            const st = students.find(x => x.id === r.student_id)
            return (
              <li key={r.id} className="font-sans text-xs text-ink-muted">
                {firstName(st?.full_name)} is also in {r.sections?.classes?.name} · {s.name} ({formatSessionDates(s, false)})
              </li>
            )
          }))}
        </ul>
      )}

      <div className="border-t border-border bg-surface-sunken/60 px-4 sm:px-5 py-3">
        <ScheduleHeading>{daysToStart > 0 ? 'Daily schedule' : "Today's schedule"}</ScheduleHeading>
        <div className="mt-1">
          <DailySchedule items={schedule} emptyText="The daily schedule will be posted here before camp starts." />
        </div>
      </div>
    </section>
  )
}
