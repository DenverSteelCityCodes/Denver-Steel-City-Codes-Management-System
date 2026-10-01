// Camp-day helpers shared by the schedule, roll-call and update screens.
import type { RollCallKind, Session } from '../types/database'

export const ROLL_CALLS: { key: RollCallKind; label: string; short: string }[] = [
  { key: 'arrival', label: 'Arrival', short: 'Arr.' },
  { key: 'after_lunch', label: 'After lunch', short: 'Lunch' },
  { key: 'dismissal', label: 'Dismissal', short: 'Dism.' },
]

export function rollCallLabel(kind: RollCallKind): string {
  return ROLL_CALLS.find(r => r.key === kind)?.label ?? kind
}

// Local calendar date as YYYY-MM-DD (never toISOString, which drifts to UTC after ~6 pm Denver).
export function localDateISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Parse a YYYY-MM-DD column as a local calendar day.
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// 'HH:MM[:SS]' → '9:00 AM'
export function formatTime(t: string | null | undefined): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`
}

// '9:00 AM – 3:00 PM' (or just the start when there's no end).
export function formatTimeRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return ''
  return end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start)
}

// 'Wednesday, September 30'
export function formatDayLong(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

// The session whose dates include the given day, else null.
export function sessionOnDay(sessions: Session[], dayISO: string): Session | null {
  return sessions.find(s => s.is_active && s.start_date <= dayISO && s.end_date >= dayISO) ?? null
}

// Camp days (Mon–Fri) of a session as YYYY-MM-DD strings.
export function sessionDays(session: Pick<Session, 'start_date' | 'end_date'>): string[] {
  const days: string[] = []
  const d = parseLocalDate(session.start_date)
  const end = parseLocalDate(session.end_date)
  while (d <= end) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) days.push(localDateISO(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

// First name for a greeting or a roster line.
export function firstName(full: string | null | undefined): string {
  return (full ?? '').trim().split(/\s+/)[0] ?? ''
}
