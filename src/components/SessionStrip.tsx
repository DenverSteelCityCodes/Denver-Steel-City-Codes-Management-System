import { CalendarDays } from 'lucide-react'
import { useSessions } from '../hooks/useSessions'

// Parse a 'YYYY-MM-DD' date column as a *local* calendar day (not UTC midnight) so the
// "starts in N days" math doesn't drift by a day across timezones.
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function formatRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const sameYear = start.getFullYear() === end.getFullYear()
  const startStr = start.toLocaleDateString(undefined, opts)
  const endStr = end.toLocaleDateString(undefined, { ...opts, year: 'numeric' })
  return sameYear ? `${startStr} – ${endStr}` : `${start.toLocaleDateString(undefined, { ...opts, year: 'numeric' })} – ${endStr}`
}

// §4 session info strip. Reassurance for parents: which session, when. We only render fields
// that exist on `sessions` (name + dates) — there are no drop-off/location columns, so we don't
// invent them. The strip appears only when there's a real active session that hasn't ended.
export default function SessionStrip() {
  const { sessions, loading } = useSessions()
  if (loading) return null

  const today = startOfToday()
  // Active sessions still relevant (not already over), soonest first (hook orders by start_date).
  const session = sessions.find(s => s.is_active && parseLocalDate(s.end_date) >= today)
  if (!session) return null

  const start = parseLocalDate(session.start_date)
  const end = parseLocalDate(session.end_date)
  const msPerDay = 1000 * 60 * 60 * 24
  const daysToStart = Math.round((start.getTime() - today.getTime()) / msPerDay)

  const chip =
    daysToStart > 0
      ? {
          label: daysToStart === 1 ? 'Starts tomorrow' : `Starts in ${daysToStart} days`,
          cls: 'bg-info-soft text-info',
        }
      : { label: 'Happening now', cls: 'bg-success-soft text-success' }

  return (
    <div className="bg-surface border border-border rounded-xl shadow-sm p-4 flex items-center gap-4 mb-8">
      <div className="w-11 h-11 rounded-full bg-brand-soft flex items-center justify-center shrink-0">
        <CalendarDays size={20} className="text-warning" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-sans font-semibold text-base text-ink">{session.name}</h2>
          <span className="font-sans text-sm text-ink-muted">· {session.year}</span>
        </div>
        <p className="font-slab text-sm text-ink-muted">{formatRange(start, end)}</p>
      </div>
      <span
        className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${chip.cls}`}
      >
        {chip.label}
      </span>
    </div>
  )
}
