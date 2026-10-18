// Camp-day helpers shared by the schedule, roll-call and update screens.
import type { RollCallKind, Session } from '../types/database'

export const ROLL_CALLS: { key: RollCallKind; label: string; short: string }[] = [
  { key: 'arrival', label: 'Arrival', short: 'Arr.' },
  { key: 'after_lunch', label: 'After lunch', short: 'Lunch' },
  { key: 'dismissal', label: 'Dismissal', short: 'Dism.' },
]

// Default roll-call tab by local time of day: Arrival until 11:30, After lunch until 14:30,
// Dismissal after. Minutes since local midnight.
export const AFTER_LUNCH_FROM_MIN = 11 * 60 + 30
export const DISMISSAL_FROM_MIN = 14 * 60 + 30

export function rollCallForTime(d: Date = new Date()): RollCallKind {
  const mins = d.getHours() * 60 + d.getMinutes()
  if (mins < AFTER_LUNCH_FROM_MIN) return 'arrival'
  if (mins < DISMISSAL_FROM_MIN) return 'after_lunch'
  return 'dismissal'
}

export function rollCallLabel(kind: RollCallKind): string {
  return ROLL_CALLS.find(r => r.key === kind)?.label ?? kind
}

// One camper in one roll call.
export function markKey(studentId: string, rollCall: RollCallKind): string {
  return `${studentId}:${rollCall}`
}

// Roll call saves each tap on its own while the volunteer keeps tapping, so a read of the marks can
// start before a write lands and come back after it. A guard maps a mark's key to the number of the
// first read sure to include this screen's write (Infinity while the write is still in flight).
// Reads are numbered in the order they start. Returns the keys this read must leave as they are on
// screen, and drops the guards it has caught up with.
export function heldKeys(guards: Map<string, number>, readSeq: number): Set<string> {
  const held = new Set<string>()
  for (const [key, firstRead] of guards) {
    if (readSeq >= firstRead) guards.delete(key)
    else held.add(key)
  }
  return held
}

// A fresh read of the marks, keeping the held ones (this screen's newer taps) as they are on screen.
export function mergeMarks<T extends { student_id: string; roll_call: RollCallKind }>(
  onScreen: T[], fresh: T[], held: Set<string>,
): T[] {
  if (held.size === 0) return fresh
  const isHeld = (m: T) => held.has(markKey(m.student_id, m.roll_call))
  return [...fresh.filter(m => !isHeld(m)), ...onScreen.filter(isHeld)]
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

// The session whose dates include the given day, else null. Deliberately ignores is_active:
// a week that is running is running, whether or not it is still shown for sign-ups.
export function sessionOnDay(sessions: Session[], dayISO: string): Session | null {
  return sessions.find(s => s.start_date <= dayISO && s.end_date >= dayISO) ?? null
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

// 'just now' · '12 min ago' · '3 h ago' · 'Mon 3:20 PM' · 'Sep 26'
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  const mins = Math.round((now.getTime() - then.getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24 && then.getDate() === now.getDate()) return `${hours} h ago`
  const days = Math.round((now.getTime() - then.getTime()) / 86_400_000)
  if (days < 7) return then.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
