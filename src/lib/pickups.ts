// Authorized pickups and walk-home consent (spec 36). The database decides who may collect a camper
// (migration_authorized_pickups.sql); these helpers only word it and shape the lists. Pure, so the
// tests run without the Supabase client.
import { campSessions } from './campYear'
import { parseLocalDate, sessionDays } from './campDay'
import type { LeaveMode, ReleaseMode, Session } from '../types/database'

// One adult on a camper's pickup list, as section_roster() and dismissal_board() return it. The
// phone is null for crew who don't lead the section.
export interface PickupAdult {
  name: string
  relation: string
  phone: string | null
  days: string[] | null
}

export const LEAVE_MODES: { key: LeaveMode; label: string }[] = [
  { key: 'walk', label: 'Walk' },
  { key: 'bike', label: 'Bike' },
  { key: 'transit', label: 'Transit' },
  { key: 'other', label: 'Other' },
]

// "walks home", for "Maya walks home on her own".
export function leaveVerb(mode: LeaveMode | string | null | undefined): string {
  if (mode === 'walk') return 'walks home'
  if (mode === 'bike') return 'bikes home'
  if (mode === 'transit') return 'takes transit home'
  return 'leaves'
}

// "walk home", for "they may walk home on their own".
export function leaveInfinitive(mode: LeaveMode | string | null | undefined): string {
  if (mode === 'walk') return 'walk home'
  if (mode === 'bike') return 'bike home'
  if (mode === 'transit') return 'take transit home'
  return 'leave'
}

// The crew's one-tap label for a camper allowed to go on their own today.
export function leaveChip(mode: LeaveMode | string | null | undefined): string {
  if (mode === 'walk') return 'Walking home'
  if (mode === 'bike') return 'Biking home'
  if (mode === 'transit') return 'Taking transit'
  return 'On their own'
}

// "Wed, Oct 21"
export function shortDay(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// The days of a pickup adult or a consent in a phrase: `every` for null, else "Wed, Oct 21 only"
// or "Mon, Oct 19 and Wed, Oct 21".
export function daysPhrase(days: string[] | null | undefined, every = 'Any day'): string {
  if (!days || days.length === 0) return every
  const list = [...days].sort().map(shortDay)
  if (list.length === 1) return `${list[0]} only`
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
}

// Is this adult (or consent) good for that day?
export function onDay(days: string[] | null | undefined, day: string): boolean {
  return !days || days.includes(day)
}

// What the crew sees once a camper has been collected.
export function releaseLine(mode: ReleaseMode, releasedTo: string | null | undefined, okBy?: string | null): string {
  const who = releasedTo?.trim() || 'someone'
  if (mode === 'alone') return who.startsWith('On their own') ? `Left ${who.charAt(0).toLowerCase()}${who.slice(1)}` : 'Left on their own'
  if (mode === 'parent') return `Collected by ${who} (parent)`
  if (mode === 'admin_ok') return `Collected by ${who}, OK'd by ${okBy?.trim() || 'an admin'}`
  return `Collected by ${who}`
}

// The attendance CSV's "Collected by" cell.
export function releaseCell(mode: ReleaseMode | null | undefined, releasedTo: string | null | undefined, okBy?: string | null): string {
  if (!mode || !releasedTo) return ''
  if (mode === 'parent') return `${releasedTo} (parent)`
  if (mode === 'admin_ok') return `${releasedTo} (admin OK: ${okBy ?? '?'})`
  return releasedTo
}

// A pickup adult as a parent types it.
export interface PickupDraft {
  name: string
  relation: string
  phone: string
}

export type PickupField = keyof PickupDraft

// The first thing wrong with a pickup adult, worded for the parent; null when it can be saved.
// Same limits as the table's checks.
export function pickupDraftError(d: PickupDraft): { field: PickupField; message: string } | null {
  if (!d.name.trim()) return { field: 'name', message: 'Enter their name' }
  if (d.name.trim().length > 100) return { field: 'name', message: 'Keep the name under 100 characters' }
  if (!d.relation.trim()) return { field: 'relation', message: 'Say how they know your camper, e.g. Grandparent or Carpool' }
  if (d.relation.trim().length > 50) return { field: 'relation', message: 'Keep this under 50 characters' }
  const digits = d.phone.replace(/\D/g, '').length
  if (!d.phone.trim()) return { field: 'phone', message: 'Enter a phone number the crew can call' }
  if (digits < 7 || digits > 15 || d.phone.trim().length > 30) return { field: 'phone', message: 'Enter a full phone number' }
  return null
}

interface SeatLike {
  status: string
  sections: { session_id: string | null; week: number | null } | null
}

// The weeks a camper's Pickup section covers: weeks the camper holds a seat in that haven't ended
// (a family can change pickup on the day itself), in date order. A both-weeks section covers both.
export function openWeeks(regs: SeatLike[], sessions: Session[], today: string): Session[] {
  const ids = new Set<string>()
  const camp = campSessions(sessions)
  for (const r of regs) {
    if (r.status !== 'confirmed' && r.status !== 'pending') continue
    const sec = r.sections
    if (!sec) continue
    if (sec.session_id) ids.add(sec.session_id)
    else if (sec.week) { const s = camp[sec.week - 1]; if (s) ids.add(s.id) }
    else for (const s of camp) ids.add(s.id)
  }
  return sessions
    .filter(s => ids.has(s.id) && s.end_date >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
}

// Camp days still to come (today included) in these weeks: what a dated adult or consent can pick.
export function daysAhead(weeks: Pick<Session, 'start_date' | 'end_date'>[], today: string): string[] {
  return [...new Set(weeks.flatMap(w => sessionDays(w)).filter(d => d >= today))].sort()
}

// ── Admin dismissal board ──

export interface DismissalRow {
  section_id: string
  section_label: string
  class_name: string
  room: string | null
  lead_name: string | null
  student_id: string
  full_name: string
  parent_name: string | null
  parent_phone: string | null
  // The dismissal mark: null = not marked yet.
  present: boolean | null
  released_to: string | null
  released_mode: ReleaseMode | null
  released_ok_by?: string | null
  marked_at: string | null
  marked_by_name: string | null
  pickup_adults: PickupAdult[] | null
  may_leave_alone: boolean
  leave_alone_mode: string | null
}

export interface DismissalSection {
  id: string
  label: string
  className: string
  room: string | null
  leadName: string | null
  campers: number
}

export interface DismissalSummary {
  total: number
  released: number
  // Sections whose dismissal has begun (any camper marked at dismissal).
  started: DismissalSection[]
  // Sections with no dismissal mark yet.
  notStarted: DismissalSection[]
  // Campers in a started section who are in the room (present or not yet marked) and not released.
  waiting: DismissalRow[]
  // Releases recorded on an admin's OK, newest first.
  adminOk: DismissalRow[]
}

export function summarizeDismissal(rows: DismissalRow[]): DismissalSummary {
  const bySection = new Map<string, DismissalRow[]>()
  for (const r of rows) bySection.set(r.section_id, [...(bySection.get(r.section_id) ?? []), r])
  const started: DismissalSection[] = []
  const notStarted: DismissalSection[] = []
  const waiting: DismissalRow[] = []
  for (const list of bySection.values()) {
    const first = list[0]
    const sec: DismissalSection = {
      id: first.section_id, label: first.section_label, className: first.class_name,
      room: first.room, leadName: first.lead_name, campers: list.length,
    }
    if (list.some(r => r.present != null)) {
      started.push(sec)
      waiting.push(...list.filter(r => r.present !== false && !r.released_mode))
    } else {
      notStarted.push(sec)
    }
  }
  const byLabel = (a: DismissalSection, b: DismissalSection) => a.label.localeCompare(b.label)
  return {
    total: rows.length,
    released: rows.filter(r => r.released_mode).length,
    started: started.sort(byLabel),
    notStarted: notStarted.sort(byLabel),
    waiting: waiting.sort((a, b) => a.section_label.localeCompare(b.section_label) || a.full_name.localeCompare(b.full_name)),
    adminOk: rows.filter(r => r.released_mode === 'admin_ok').sort((a, b) => (b.marked_at ?? '').localeCompare(a.marked_at ?? '')),
  }
}
