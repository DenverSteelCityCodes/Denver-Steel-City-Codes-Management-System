// Volunteer onboarding (spec 35): the checklist's due times, the profile's limits, and the small
// checks the admin forms make before the database does. Times are Denver times.
import { campDateKey, formatCampTime } from './denverTime'

export interface ChecklistItem {
  key: string
  label: string
  help_url: string | null
  due_at: string | null
  done_at: string | null
  verified: boolean
}

export const BIO_MAX = 300

// "Overdue since Mon, Oct 19 at 3:00 PM" · "Due today at 10:00 PM" · "Due tomorrow at 9:00 AM" ·
// "Due Wed, Oct 21 at 9:00 AM". Null when there's no due time (accepted before checklists).
export function dueLabel(dueISO: string | null, now: Date = new Date()): string | null {
  if (!dueISO) return null
  const due = new Date(dueISO)
  const at = formatCampTime(dueISO)
  const dueDay = campDateKey(dueISO)
  const today = campDateKey(now.toISOString())
  const tomorrow = campDateKey(new Date(now.getTime() + 86_400_000).toISOString())
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', weekday: 'short', month: 'short', day: 'numeric' }).format(due)
  if (due.getTime() <= now.getTime()) return `Overdue since ${dueDay === today ? 'today' : day} at ${at}`
  if (dueDay === today) return `Due today at ${at}`
  if (dueDay === tomorrow) return `Due tomorrow at ${at}`
  return `Due ${day} at ${at}`
}

// When an item is due for one volunteer: N hours after they were accepted, or after the item was
// added if that came later (mirrors private.task_due_at() in the database). Null when the
// volunteer was accepted before checklists existed.
export function taskDueAt(acceptedAt: string | null | undefined, taskCreatedAt: string, hours: number): string | null {
  if (!acceptedAt) return null
  const start = Math.max(new Date(acceptedAt).getTime(), new Date(taskCreatedAt).getTime())
  return new Date(start + hours * 3_600_000).toISOString()
}

export function isOverdue(item: Pick<ChecklistItem, 'due_at' | 'done_at'>, now: Date = new Date()): boolean {
  return !item.done_at && !!item.due_at && new Date(item.due_at).getTime() <= now.getTime()
}

// Where a volunteer's checklist stands: how many are done, how many are late, and the next open
// item by due time (items with no due time last).
export function checklistState(items: ChecklistItem[], now: Date = new Date()) {
  const open = items.filter(i => !i.done_at)
  const next = [...open].sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999'))[0] ?? null
  return {
    done: items.length - open.length,
    total: items.length,
    overdue: open.filter(i => isOverdue(i, now)).length,
    complete: items.length > 0 && open.length === 0,
    next,
  }
}

// A help link an admin may set: https, or a path inside this app (never javascript: or //host).
// Mirrors the database check on onboarding_tasks.
export function validHelpUrl(url: string): boolean {
  return /^https:\/\/[^\s<>"]+$/.test(url) || /^\/[A-Za-z0-9][^\s<>"]*$/.test(url)
}

// A meeting link: https only (interview_slot_links refuses anything else).
export function validMeetingUrl(url: string): boolean {
  return /^https:\/\/[^\s<>"]+$/.test(url) && url.length <= 500
}

// "24 hours" · "2 days" · "36 hours"
export function hoursLabel(h: number): string {
  if (h % 24 === 0) return `${h / 24} ${h === 24 ? 'day' : 'days'}`
  return `${h} ${h === 1 ? 'hour' : 'hours'}`
}

// Who sees the volunteer's photo, in one sentence (the database decides; this explains it).
export function photoStatus(p: { hasPhoto: boolean; consent: boolean; needsGuardian: boolean; guardianName: string }): string | null {
  if (!p.hasPhoto) return null
  if (!p.consent) return 'Only you and the camp admins see your photo.'
  if (p.needsGuardian && !p.guardianName.trim()) return "Parents won't see your photo until a parent or guardian agrees below."
  return 'Parents of campers in your weeks see it on Meet the teachers.'
}

export function bioProblem(bio: string): string | null {
  const n = bio.trim().length
  return n > BIO_MAX ? `Keep your bio to ${BIO_MAX} characters. It's ${n} now.` : null
}

// Initials for a crew member without a photo: "Sam" → "S", "Mary Kate" → "MK".
export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'
}
