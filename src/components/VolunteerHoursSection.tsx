import { Link } from 'react-router-dom'
import { CircleAlert, FileText } from 'lucide-react'
import { useMyVolunteerHours } from '../hooks/useMyVolunteerHours'
import { formatHours, formatWeekDates, hoursWord, letterDate, totalMinutes } from '../lib/volunteerHours'
import { parseLocalDate } from '../lib/campDay'

const h2 = 'text-[1.375rem] font-bold leading-[1.2] tracking-[-0.01em] text-ink'

// Profile › Service hours (spec B2): each week's hours so far, and its letter for school once the
// week is over. The letter's name is the legal name from the volunteer profile (spec 35), so it says which one it uses.
export default function VolunteerHoursSection() {
  const { weeks, loading, error, retry } = useMyVolunteerHours()

  if (loading) return <div className="h-32 bg-surface-sunken rounded animate-pulse" aria-busy="true" aria-label="Loading your hours" />
  if (error) {
    return (
      <section aria-labelledby="hours-heading" id="hours">
        <h2 id="hours-heading" className={h2}>Service hours</h2>
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm font-bold text-danger text-pretty">
          <CircleAlert size={16} strokeWidth={2.5} aria-hidden="true" className="shrink-0 mt-0.5" />
          Couldn't load your hours. Check your connection and try again.
        </p>
        <button type="button" onClick={retry} className="ui-btn ui-btn--text">Try again</button>
      </section>
    )
  }
  if (weeks.length === 0) return null

  const name = weeks[0]
  return (
    <section aria-labelledby="hours-heading" id="hours" className="scroll-mt-24">
      <h2 id="hours-heading" className={h2}>Service hours</h2>
      <p className="mt-1 text-ink-muted text-pretty">
        Each weekday you crew is 8 hours, minus days off. Duties count on days you aren't crewed. Each week's letter for school is ready from its last day.
      </p>

      <ul className="mt-3 border-y-2 border-ink">
        {weeks.map(w => (
          <li key={w.session_id} className="py-3 border-t border-border first:border-t-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <div className="min-w-0">
              <p className="font-bold">
                Week {w.week_number} <span className="font-normal text-ink-muted">· {formatWeekDates(w.start_date, w.end_date)}</span>
              </p>
              <p className="text-ink-muted">
                <b className="font-extrabold text-ink">{hoursWord(totalMinutes(w))}</b>
                {' '}· {w.crew_days} {w.crew_days === 1 ? 'day' : 'days'} crewed
                {w.duty_minutes > 0 && <> · {formatHours(w.duty_minutes)} h of duties</>}
              </p>
            </div>
            {w.letter_ready ? (
              <Link to={`/print/hours/${w.session_id}`} className="inline-flex items-center gap-1.5 min-h-11 font-bold underline underline-offset-[3px]">
                <FileText size={16} strokeWidth={2.5} aria-hidden="true" />
                Letter<span className="sr-only"> for Week {w.week_number}</span>
              </Link>
            ) : (
              <span className="text-sm text-ink-muted">Letter from {letterDate(parseLocalDate(w.end_date))}</span>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-2 text-sm text-ink-muted text-pretty">
        {name.has_legal_name
          ? <>Letters show your legal name, <b className="font-bold text-ink">{name.letter_name}</b>.</>
          : <>Letters show <b className="font-bold text-ink">{name.letter_name}</b>. Add your legal name under "Your volunteer profile" to use it instead.</>}
      </p>
    </section>
  )
}
