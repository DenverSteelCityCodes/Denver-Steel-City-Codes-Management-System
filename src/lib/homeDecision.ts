// Pure helpers behind the parent Home (issue #173): the one next decision for the sign band, the
// week lines on each camper and the status sentence under the greeting. No data fetching here, so
// tests run without the Supabase client.
import { formatTimeRange, sessionDays } from './campDay'
import { CAMP_TIME_ZONE } from './denverTime'
import { daysBetween } from './volunteerHome'
import type { RegistrationWithSection } from '../hooks/useRegistrations'
import type { ScheduleItem, Session, Student } from '../types/database'

type Reg = RegistrationWithSection

export const camperFirstName = (s: Pick<Student, 'first_name' | 'full_name'>) =>
  s.first_name?.trim() || s.full_name.trim().split(/\s+/)[0]

// Registrations auto-confirm (spec 14); a legacy 'pending' row holds a seat too.
export const holdsSeat = (r: Pick<Reg, 'status'>) => r.status === 'confirmed' || r.status === 'pending'

export const cancelledByCamp = (r: Pick<Reg, 'status' | 'cancel_reason'>) =>
  r.status === 'cancelled' && r.cancel_reason === 'section_cancelled'

// The camp year's weeks in date order (session N is sections.week N). Pass campSessions(sessions).
// A registration's week: the section's own number, else the place of its session. Null = both weeks.
export function weekOf(r: Reg, weeks: Session[]): number | null {
  if (r.sections?.week) return r.sections.week
  const i = weeks.findIndex(s => s.id === r.sections?.session_id)
  return i >= 0 ? i + 1 : null
}

// The sessions a registration runs in: its own session, its week's session, or every week.
export function sessionsOf(r: Reg, sessions: Session[], weeks: Session[]): Session[] {
  const own = r.sections?.session_id ? sessions.find(s => s.id === r.sections.session_id) : undefined
  if (own) return [own]
  const w = r.sections?.week
  if (w) return weeks[w - 1] ? [weeks[w - 1]] : []
  return weeks
}

// A week a family can still sign up for: shown for sign-up and not over yet.
const openWeek = (s: Session | undefined, today: string) => !!s && s.is_active && s.end_date >= today

// A class the camp cancelled still needs the family while its week can still be joined and the
// camper has nothing else that week: no seat, no waitlist place and no offer.
export function needsNewClass(r: Reg, all: Reg[], weeks: Session[], today: string): boolean {
  if (!cancelledByCamp(r)) return false
  const week = weekOf(r, weeks)
  if (weeks.length > 0 && !(week == null ? weeks.some(s => openWeek(s, today)) : openWeek(weeks[week - 1], today))) return false
  return !all.some(o => o.student_id === r.student_id && o.id !== r.id && o.status !== 'cancelled' &&
    (week == null || weekOf(o, weeks) == null || weekOf(o, weeks) === week))
}

// What Home shows for a camper: live registrations, plus camp cancellations still to replace.
export function liveRegistrations(studentId: string, all: Reg[], weeks: Session[], today: string): Reg[] {
  return all.filter(r => r.student_id === studentId && (r.status !== 'cancelled' || needsNewClass(r, all, weeks, today)))
}

export interface WeekLine {
  key: string
  label: string
  reg: Reg | null
}

// One line per week for a camper: each registration on its week, an empty "Not registered" line
// for a week they could still join, and one combined line when they have nothing at all.
export function weekLines(studentId: string, all: Reg[], weeks: Session[], today: string): WeekLine[] {
  const regs = liveRegistrations(studentId, all, weeks, today)
  const both = regs.filter(r => weekOf(r, weeks) == null)
  const lines: WeekLine[] = both.map(r => ({ key: r.id, label: weeks.length > 1 ? 'Both weeks' : 'Week 1', reg: r }))
  const nums = weeks.length > 0 ? weeks.map((_, i) => i + 1) : [...new Set(regs.map(r => weekOf(r, weeks)).filter((n): n is number => n != null))]
  const empty: number[] = []
  for (const n of nums) {
    const inWeek = regs.filter(r => weekOf(r, weeks) === n)
    inWeek.forEach(r => lines.push({ key: r.id, label: `Week ${n}`, reg: r }))
    if (inWeek.length === 0 && both.length === 0 && openWeek(weeks[n - 1], today)) {
      empty.push(n)
      lines.push({ key: `week-${n}`, label: `Week ${n}`, reg: null })
    }
  }
  if (regs.length === 0 && empty.length > 1) {
    return [{ key: 'none', label: `Weeks ${empty.join(', ')}`, reg: null }]
  }
  return lines
}

// "Week 1", "Weeks 1, 2": the weeks a camper could still join, for copy.
export function openWeeksLabel(weeks: Session[], today: string): string {
  const open = weeks.map((s, i) => (openWeek(s, today) ? i + 1 : 0)).filter(Boolean)
  if (open.length === 0) return 'this summer'
  return open.length === 1 ? `Week ${open[0]}` : `Week ${open.slice(0, -1).join(', ')} or Week ${open[open.length - 1]}`
}

// The status sentence under the greeting: one short clause per camper (three or fewer), else counts.
export function statusSentence(students: Student[], all: Reg[], weeks: Session[], today: string): string {
  if (students.length === 0) return ''
  const per = students.map(s => {
    const regs = liveRegistrations(s.id, all, weeks, today)
    const name = camperFirstName(s)
    const seats = regs.filter(holdsSeat)
    const weeksSet = seats.map(r => weekOf(r, weeks))
    const setFor = weeksSet.includes(null) || (weeks.length > 1 && weeksSet.length >= weeks.length)
      ? 'both weeks'
      : weeksSet.length > 0 ? `Week ${[...new Set(weeksSet)].sort().join(' and Week ')}` : ''
    if (regs.some(r => r.status === 'offered')) return { kind: 'offer', text: `A spot opened for ${name}.` }
    if (regs.some(r => needsNewClass(r, all, weeks, today))) return { kind: 'cancelled', text: `${name}'s class was cancelled.` }
    if (seats.length > 0) {
      const waiting = regs.some(r => r.status === 'waitlisted')
      return { kind: 'set', text: `${name} is set for ${setFor}${waiting ? ' and on a waitlist' : ''}.` }
    }
    if (regs.some(r => r.status === 'waitlisted')) return { kind: 'wait', text: `${name} is on the waitlist.` }
    return { kind: 'none', text: `${name} isn't registered yet.` }
  })
  if (students.length <= 3) return per.map(p => p.text).join(' ')
  const count = (k: string) => per.filter(p => p.kind === k).length
  const one = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`
  const needClass = count('cancelled') + count('none')
  return [
    count('offer') && `${one(count('offer'), 'spot has', 'spots have')} opened.`,
    count('set') && `${one(count('set'), 'camper is', 'campers are')} set.`,
    count('wait') && `${one(count('wait'), 'is', 'are')} on a waitlist.`,
    needClass && `${one(needClass, 'needs', 'need')} a class.`,
  ].filter(Boolean).join(' ')
}

// Everything on Home that needs the parent, most urgent first. The first one becomes the sign.
export type Decision =
  | { kind: 'offer'; student: Student; reg: Reg }
  | { kind: 'cancelled'; student: Student; reg: Reg }
  | { kind: 'reconfirm'; student: Student; registered: boolean }
  | { kind: 'register'; student: Student }

export function decisions(
  students: Student[], all: Reg[], weeks: Session[],
  // registrationOpen: the opening time has passed and the admin's registration switch is on.
  { campYear, registrationOpen, today }: { campYear: number; registrationOpen: boolean; today: string },
): Decision[] {
  const byId = new Map(students.map(s => [s.id, s]))
  const out: Decision[] = []
  // Offers first, the one that runs out soonest at the top.
  all.filter(r => r.status === 'offered' && byId.has(r.student_id))
    .sort((a, b) => (a.offer_expires_at ?? '9').localeCompare(b.offer_expires_at ?? '9'))
    .forEach(reg => out.push({ kind: 'offer', student: byId.get(reg.student_id)!, reg }))
  all.filter(r => byId.has(r.student_id) && needsNewClass(r, all, weeks, today))
    .forEach(reg => out.push({ kind: 'cancelled', student: byId.get(reg.student_id)!, reg }))
  // Before registration opens there's nothing to pick yet; the countdown takes the sign instead.
  const canRegister = registrationOpen && weeks.some(s => openWeek(s, today))
  if (!canRegister) return out
  // Every camper re-confirms their details once per camp year (#42) before registering, so all the
  // re-confirms come before any "pick a class".
  const registered = (s: Student) => liveRegistrations(s.id, all, weeks, today).length > 0
  students.filter(s => s.registration_year !== campYear)
    .forEach(s => out.push({ kind: 'reconfirm', student: s, registered: registered(s) }))
  students.filter(s => s.registration_year === campYear && !registered(s))
    .forEach(s => out.push({ kind: 'register', student: s }))
  return out
}

export interface CampDay {
  day: string
  session: Session
  // Camp day number within the session (1-based) when the day is today, else null.
  dayNumber: number | null
  daysAway: number
  seats: { reg: Reg; student: Student }[]
}

// The next camp day (today included) on which one of the campers holds a seat.
export function nextCampDay(students: Student[], all: Reg[], sessions: Session[], weeks: Session[], today: string): CampDay | null {
  const byId = new Map(students.map(s => [s.id, s]))
  let best: { day: string; session: Session } | null = null
  const seats = all.filter(r => holdsSeat(r) && byId.has(r.student_id))
  for (const r of seats) {
    for (const s of sessionsOf(r, sessions, weeks)) {
      const day = sessionDays(s).find(d => d >= today)
      if (day && (!best || day < best.day)) best = { day, session: s }
    }
  }
  if (!best) return null
  const { day, session } = best
  const days = sessionDays(session)
  return {
    day, session,
    dayNumber: day === today ? days.indexOf(day) + 1 : null,
    daysAway: daysBetween(today, day),
    seats: seats
      .filter(r => sessionsOf(r, sessions, weeks).some(s => s.id === session.id))
      .map(reg => ({ reg, student: byId.get(reg.student_id)! })),
  }
}

// The figure on a room sign: "Room 202" → "202"; anything else stays as written.
export function roomFigure(room: string): string {
  return room.replace(/^room\s+/i, '')
}

// "Fri 7:00 PM (Denver time)": when an offer runs out, in camp time whatever the phone's clock says.
export function offerDeadline(iso: string): string {
  const when = new Intl.DateTimeFormat('en-US', { timeZone: CAMP_TIME_ZONE, weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
  return `${when} (Denver time)`
}

// "9 h" / "40 min" left on an offer; null once it has run out.
export function timeLeft(expiresAt: string | null | undefined, now: number): { value: number; unit: 'h' | 'min' } | null {
  if (!expiresAt) return null
  const ms = new Date(expiresAt).getTime() - now
  if (ms <= 0) return null
  const minutes = Math.floor(ms / 60_000)
  return minutes >= 60 ? { value: Math.floor(minutes / 60), unit: 'h' } : { value: Math.max(1, minutes), unit: 'min' }
}

// "8:30 AM – 3:30 PM": the daily schedule from the first block's start to the last block's end.
export function scheduleSpan(items: Pick<ScheduleItem, 'start_time' | 'end_time'>[]): string {
  if (items.length === 0) return ''
  const starts = items.map(i => i.start_time).sort()
  const end = items.map(i => i.end_time ?? i.start_time).sort().at(-1)
  return formatTimeRange(starts[0], end)
}
