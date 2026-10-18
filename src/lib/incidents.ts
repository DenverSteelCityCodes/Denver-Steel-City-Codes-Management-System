import type { Incident, IncidentKind, IncidentLevel } from '../types/database'

// The incident log (spec 34): what kind of thing happened and how far it went.
export const INCIDENT_KINDS: { value: IncidentKind; label: string }[] = [
  { value: 'injury', label: 'Injury' },
  { value: 'behavior', label: 'Camper behavior' },
  { value: 'conduct', label: 'Crew conduct' },
  { value: 'safety', label: 'Safety' },
  { value: 'other', label: 'Something else' },
]

export const INCIDENT_LEVELS: { value: IncidentLevel; label: string }[] = [
  { value: 'note', label: 'Just a note' },
  { value: 'warning', label: 'Warning given' },
  { value: 'admin_room', label: 'Sent to the admin room' },
  { value: 'written_notice', label: 'Written notice' },
]

export const kindLabel = (k: IncidentKind) => INCIDENT_KINDS.find(x => x.value === k)?.label ?? 'Something else'
export const levelLabel = (l: IncidentLevel) => INCIDENT_LEVELS.find(x => x.value === l)?.label ?? 'Just a note'

// An incident with a camper whose family hasn't been told 24 hours after it was logged.
export function overdueParentNotice(i: Pick<Incident, 'student_id' | 'parent_notified_at' | 'created_at'>, now: number = Date.now()): boolean {
  return !!i.student_id && !i.parent_notified_at && now - new Date(i.created_at).getTime() >= 24 * 3600_000
}
