import { supabase } from './supabase'

// Conflict-checked saves (spec 07). The database stamps updated_at on every real change
// (migration_edit_conflicts.sql). A save only applies if the row still has the updated_at the form
// loaded; otherwise someone else saved in between, and we refuse instead of overwriting them.

// Readable names for the fields forms edit, used to say what the other person changed.
const FIELD_LABELS: Record<string, string> = {
  first_name: 'first name', last_name: 'last name', full_name: 'name', grade: 'grade', age: 'age',
  allergies: 'allergies', medical_conditions: 'medical conditions', medical_info: 'medical conditions',
  emergency_contact_name: 'emergency contact', emergency_contact_phone: 'emergency contact phone',
  emergency_contact_relation: 'emergency contact relationship', parent_name: 'parent name',
  parent_phone: 'parent phone', school_name: 'school', label: 'label', capacity: 'capacity',
  age_min: 'ages', age_max: 'ages', week: 'week', lead_id: 'lead', days: 'days',
  start_time: 'start time', end_time: 'end time', room: 'room', name: 'name',
  description: 'description', start_date: 'start date', end_date: 'end date', is_active: 'visibility',
  year: 'year',
}

export class EditConflictError extends Error {
  readonly latest: Record<string, unknown> | null
  constructor(message: string, latest: Record<string, unknown> | null) {
    super(message)
    this.name = 'EditConflictError'
    this.latest = latest
  }
}

function sameValue(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

// Update `table` row `original.id` with `patch`, but only if nobody changed it since `original`
// was loaded. Without an updated_at on `original` (older data), it falls back to a plain update.
// Returns the saved row. On a conflict, throws EditConflictError naming what changed and when.
export async function guardedUpdate<T extends Record<string, unknown>>(
  table: string,
  original: { id: string; updated_at?: string | null } & Record<string, unknown>,
  patch: Record<string, unknown>,
): Promise<T> {
  let query = supabase.from(table).update(patch).eq('id', original.id)
  if (original.updated_at) query = query.eq('updated_at', original.updated_at)
  const { data, error } = await query.select().maybeSingle()
  if (error) throw new Error(error.message)
  if (data) return data as T

  // No row matched: either it changed under us, or it's gone (or no longer visible to us).
  const { data: latest } = await supabase.from(table).select('*').eq('id', original.id).maybeSingle()
  if (!latest) {
    throw new EditConflictError("This record no longer exists. Reload the page to see what's there now.", null)
  }
  // Each field the other person changed, with its value now ("allergies (now "Peanuts")").
  const seen = new Set<string>()
  const changed: string[] = []
  for (const k of Object.keys(patch)) {
    if (k === 'updated_at' || sameValue((latest as Record<string, unknown>)[k], original[k])) continue
    const label = FIELD_LABELS[k] ?? k.replace(/_/g, ' ')
    if (seen.has(label)) continue
    seen.add(label)
    const v = (latest as Record<string, unknown>)[k]
    const shown = v === null || v === undefined || v === '' ? 'blank' : `"${String(v).slice(0, 40)}${String(v).length > 40 ? '…' : ''}"`
    changed.push(`${label} (now ${shown})`)
  }
  const when = latest.updated_at
    ? new Date(latest.updated_at as string).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null
  const what = changed.length === 0 ? 'this' : changed.length === 1 ? `the ${changed[0]}` : `the ${changed.slice(0, -1).join(', ')} and ${changed.at(-1)}`
  throw new EditConflictError(
    `Someone else changed ${what}${when ? ` at ${when}` : ''} while you were editing, so nothing was saved. ` +
    'Your edits are still here. Save again to replace their version, or cancel to keep it.',
    latest as Record<string, unknown>,
  )
}
