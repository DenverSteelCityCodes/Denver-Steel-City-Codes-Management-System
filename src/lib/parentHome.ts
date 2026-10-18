// Pure helpers behind the parent Home tab (issue #167). No data fetching here.
import { campSessions } from '../hooks/useSessions'
import { sessionDays } from './campDay'
import type { RegistrationWithSection } from '../hooks/useRegistrations'
import type { Session, Student } from '../types/database'

export const camperFirstName = (s: Pick<Student, 'first_name' | 'full_name'>) =>
  s.first_name?.trim() || s.full_name.split(' ')[0]

// Registrations auto-confirm (spec 14); a legacy 'pending' row holds a seat too.
export const holdsSeat = (r: Pick<RegistrationWithSection, 'status'>) => r.status === 'confirmed' || r.status === 'pending'

export const byCamp = (r: Pick<RegistrationWithSection, 'status' | 'cancel_reason'>) =>
  r.status === 'cancelled' && r.cancel_reason === 'section_cancelled'

// The session a registration's section runs in: by session_id, else by week number (session N =
// week N of the active year). Null for a both-weeks section.
export function sessionOf(r: RegistrationWithSection, sessions: Session[]): Session | null {
  const sec = r.sections
  if (!sec) return null
  if (sec.session_id) return sessions.find(s => s.id === sec.session_id) ?? null
  return sec.week ? campSessions(sessions)[sec.week - 1] ?? null : null
}

// "Week 1", from the section, else the session's own name.
export function weekName(r: RegistrationWithSection, sessions: Session[]): string {
  if (r.sections?.week) return `Week ${r.sections.week}`
  return sessionOf(r, sessions)?.name ?? 'Both weeks'
}

// A class the camp cancelled still needs the family when the camper holds no other seat that week.
export function needsNewClass(r: RegistrationWithSection, all: RegistrationWithSection[]): boolean {
  if (!byCamp(r)) return false
  return !all.some(o => o.student_id === r.student_id && o.id !== r.id && holdsSeat(o) &&
    (o.sections?.week == null || r.sections?.week == null || o.sections.week === r.sections.week))
}

// What a camper's row shows: the registrations that are still live, or that the camp cancelled
// and the family still has to replace. Oldest week first.
export function rowRegistrations(studentId: string, all: RegistrationWithSection[]): RegistrationWithSection[] {
  return all
    .filter(r => r.student_id === studentId && (r.status !== 'cancelled' || needsNewClass(r, all)))
    .sort((a, b) => (a.sections?.week ?? 0) - (b.sections?.week ?? 0))
}

export type Tone = 'ok' | 'wait' | 'offer' | 'danger' | 'none'

// One word per camper: the "is my kid all set?" answer.
export function rollup(regs: RegistrationWithSection[]): { label: string; tone: Tone } {
  const live = regs.filter(r => r.status !== 'cancelled')
  if (live.some(r => r.status === 'offered')) return { label: 'Spot offered', tone: 'offer' }
  if (regs.some(byCamp) && !live.some(holdsSeat)) return { label: 'Pick a class', tone: 'danger' }
  if (live.length === 0) return { label: 'Not signed up', tone: 'none' }
  if (live.every(r => r.status === 'waitlisted')) return { label: 'On the waitlist', tone: 'wait' }
  return { label: 'All set', tone: 'ok' }
}

// Status-aware subhead (DS §10): a warm, one-line rollup of real enrollment status.
export function buildSubhead(students: Student[], registrations: RegistrationWithSection[]): string {
  if (students.length === 0) return ''

  const active = registrations.filter(r => r.status !== 'cancelled')
  if (active.length === 0) {
    return students.length === 1
      ? "Your camper isn't signed up yet. Find a class when you're ready."
      : "No sign-ups yet. Find a class for each camper when you're ready."
  }

  const offered = active.find(r => r.status === 'offered')
  if (offered) {
    const who = students.find(s => s.id === offered.student_id)
    return `A spot opened up for ${who ? camperFirstName(who) : 'your camper'}. Claim it before the offer ends.`
  }
  const waitlisted = active.filter(r => r.status === 'waitlisted').length
  const confirmedIds = new Set(active.filter(holdsSeat).map(r => r.student_id))
  const unenrolled = students.filter(s => !active.some(r => r.student_id === s.id))

  const subject = students.length === 1 ? 'Your camper is' : 'Your campers are'
  const waitNote = waitlisted > 0 ? ` ${waitlisted === 1 ? 'One spot is' : `${waitlisted} spots are`} on a waitlist.` : ''
  const unenrolledNote = unenrolled.length === 0 ? ''
    : unenrolled.length === 1 ? ` ${camperFirstName(unenrolled[0])} isn't signed up yet.`
    : ` ${unenrolled.length} campers aren't signed up yet.`

  if (confirmedIds.size === 0) return `${subject} on a waitlist. We'll email you if a spot opens.${unenrolledNote}`
  // Only say "all set" for the campers who actually have a confirmed spot.
  const lead = confirmedIds.size === students.length
    ? `${subject} all set for camp.`
    : confirmedIds.size === 1
      ? `${camperFirstName(students.find(s => confirmedIds.has(s.id))!)} is all set for camp.`
      : `${confirmedIds.size} of your campers are all set for camp.`
  return `${lead}${waitNote}${unenrolledNote}`
}

// The one band at the top of Home: whatever matters most right now.
export type HomeBand =
  | { kind: 'offer'; reg: RegistrationWithSection }
  | { kind: 'cancelled'; reg: RegistrationWithSection }
  | { kind: 'campDay'; session: Session; day: number; seats: RegistrationWithSection[] }
  | { kind: 'upcoming'; session: Session }
  | { kind: 'register' }
  | null

export function homeBand(students: Student[], registrations: RegistrationWithSection[], sessions: Session[], today: string): HomeBand {
  if (students.length === 0) return { kind: 'register' }
  const offer = registrations.find(r => r.status === 'offered')
  if (offer) return { kind: 'offer', reg: offer }
  const cancelled = registrations.find(r => needsNewClass(r, registrations))
  if (cancelled) return { kind: 'cancelled', reg: cancelled }

  const seats = registrations.filter(holdsSeat)
  const running = sessions.find(s => sessionDays(s).includes(today) && seats.some(r => sessionOf(r, sessions)?.id === s.id))
  if (running) {
    return {
      kind: 'campDay', session: running, day: sessionDays(running).indexOf(today) + 1,
      seats: seats.filter(r => sessionOf(r, sessions)?.id === running.id),
    }
  }
  const next = sessions
    .filter(s => s.start_date > today && seats.some(r => sessionOf(r, sessions)?.id === s.id))
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0]
  return next ? { kind: 'upcoming', session: next } : null
}
