// Pure helpers behind the volunteer tabs (Today / Classes / Duties). No data fetching here.
import { formatTime, sessionDays } from './campDay'
import type { Session } from '../types/database'

interface SectionLike { session_id: string | null }

export type CampPhase =
  // One or more of your sections runs today.
  | { kind: 'today'; session: Session; day: number; days: number }
  // Your next section's week hasn't started yet.
  | { kind: 'upcoming'; session: Session }
  // Every week you were crewed for is over.
  | { kind: 'over' }
  // Sections aren't tied to a week yet.
  | { kind: 'unscheduled' }

// Where the volunteer is in the season, from their sections' sessions and today's date.
export function campPhase(sections: SectionLike[], sessions: Session[], today: string): CampPhase {
  const mine = sessions
    .filter(s => sections.some(sec => sec.session_id === s.id))
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
  if (mine.length === 0) return { kind: 'unscheduled' }
  const running = mine.find(s => s.start_date <= today && s.end_date >= today)
  if (running) {
    const days = sessionDays(running)
    // A weekend inside the week is still "this week", but not a numbered camp day.
    const idx = days.indexOf(today)
    return idx >= 0
      ? { kind: 'today', session: running, day: idx + 1, days: days.length }
      : { kind: 'upcoming', session: mine.find(s => s.start_date > today) ?? running }
  }
  const next = mine.find(s => s.start_date > today)
  return next ? { kind: 'upcoming', session: next } : { kind: 'over' }
}

// Whole days from `from` to `to` (both YYYY-MM-DD, local).
export function daysBetween(from: string, to: string): number {
  const [a, b] = [from, to].map(d => { const [y, m, dd] = d.split('-').map(Number); return Date.UTC(y, m - 1, dd) })
  return Math.round((b - a) / 86_400_000)
}

// "today", "tomorrow", "Monday" (within a week), else "Monday, June 8".
export function relativeDay(today: string, day: string): string {
  const n = daysBetween(today, day)
  const date = new Date(`${day}T12:00:00`)
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n > 1 && n < 7) return date.toLocaleDateString('en-US', { weekday: 'long' })
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

interface TimedItem { start_time: string; end_time: string | null }

// Minutes since midnight for 'HH:MM[:SS]'.
export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// The schedule block running at `minutes` (an item without an end runs until the next one starts).
export function currentItem<T extends TimedItem>(items: T[], minutes: number): T | null {
  const sorted = [...items].sort((a, b) => a.start_time.localeCompare(b.start_time))
  for (let i = 0; i < sorted.length; i++) {
    const start = toMinutes(sorted[i].start_time)
    const end = sorted[i].end_time ? toMinutes(sorted[i].end_time!) : sorted[i + 1] ? toMinutes(sorted[i + 1].start_time) : start
    if (minutes >= start && minutes < end) return sorted[i]
  }
  return null
}

interface SlotLike { id: string; slot_date: string; session_id: string | null }

export interface DutyWeek<T extends SlotLike> {
  key: string
  label: string
  days: { date: string; slots: T[] }[]
}

// Slots grouped into weeks (by session, in date order) and then by day. Slots without a session
// are grouped by the Monday of their week so nothing is ever dropped.
export function groupDutyWeeks<T extends SlotLike>(slots: T[], sessions: Session[]): DutyWeek<T>[] {
  const weeks = new Map<string, { label: string; start: string; byDay: Map<string, T[]> }>()
  for (const slot of slots) {
    const session = sessions.find(s => s.id === slot.session_id)
    const key = session?.id ?? `wk-${mondayOf(slot.slot_date)}`
    const label = session?.name ?? `Week of ${new Date(`${mondayOf(slot.slot_date)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    const start = session?.start_date ?? mondayOf(slot.slot_date)
    if (!weeks.has(key)) weeks.set(key, { label, start, byDay: new Map() })
    const byDay = weeks.get(key)!.byDay
    byDay.set(slot.slot_date, [...(byDay.get(slot.slot_date) ?? []), slot])
  }
  return [...weeks.entries()]
    .sort(([, a], [, b]) => a.start.localeCompare(b.start))
    .map(([key, w]) => ({
      key,
      label: w.label,
      days: [...w.byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, s]) => ({ date, slots: s })),
    }))
}

function mondayOf(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// "1 duty" / "2 duties"
export function countLabel(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

// "Room 102, Mon–Fri, 9:00 AM to 3:00 PM"
export function whereWhen(s: { room: string | null; days: string | null; start_time: string | null; end_time: string | null }): string {
  const time = s.start_time ? (s.end_time ? `${formatTime(s.start_time)} to ${formatTime(s.end_time)}` : formatTime(s.start_time)) : null
  return [s.room, s.days, time].filter(Boolean).join(', ')
}
