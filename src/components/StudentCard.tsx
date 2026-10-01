import { useState } from 'react'
import { CircleCheck, Clock, List, CircleX, Pencil, GraduationCap, Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { GRADES, gradeToAge, realNote } from '../lib/campers'
import type { Student, RegistrationStatus } from '../types/database'
import type { RegistrationWithSection } from '../hooks/useRegistrations'
import MedicalFlag from './MedicalFlag'

// Human-friendly status copy (DS §7.5 Deep-on-Soft chips, §10 warm voice).
// note: an optional reassuring sub-line shown beneath the chip.
const STATUS_CONFIG: Record<
  RegistrationStatus,
  { label: string; className: string; Icon: LucideIcon; note: string | null }
> = {
  confirmed: { label: 'Confirmed', className: 'bg-success-soft text-success', Icon: CircleCheck, note: null },
  pending: { label: 'Spot held', className: 'bg-warning-soft text-warning', Icon: Clock, note: "We'll confirm soon" },
  waitlisted: { label: 'On waitlist', className: 'bg-info-soft text-info', Icon: List, note: null },
  cancelled: { label: 'Cancelled', className: 'bg-danger-soft text-danger', Icon: CircleX, note: null },
}

// Rollup status badge (DS §7.5) that summarizes all of a camper's registrations
// into a single at-a-glance signal — the "is my kid all set?" answer (§2).
function rollupStatus(
  registrations: RegistrationWithSection[],
): { label: string; className: string; Icon: LucideIcon | null } {
  const active = registrations.filter(r => r.status !== 'cancelled')
  if (active.length === 0) {
    return { label: 'Not enrolled', className: 'bg-surface-sunken text-ink-muted', Icon: null }
  }
  const needsAction = active.some(r => r.status === 'pending' || r.status === 'waitlisted')
  if (needsAction) {
    return { label: 'Action pending', className: 'bg-warning-soft text-warning', Icon: Clock }
  }
  return { label: 'All set', className: 'bg-success-soft text-success', Icon: CircleCheck }
}

type CamperPatch = Partial<Omit<Student, 'id' | 'parent_id' | 'created_at'>>

interface Props {
  student: Student
  registrations: RegistrationWithSection[]
  onSave?: (id: string, patch: CamperPatch) => Promise<void>
}

// Inline editor for the details parents actually change mid-year (name, grade, health, emergency
// contact). The full yearly review still happens in the registration flow.
function CamperEditor({ student, onSave, onDone }: { student: Student; onSave: Props['onSave']; onDone: () => void }) {
  const [first, ...rest] = student.full_name.split(' ')
  const [form, setForm] = useState({
    first_name: student.first_name ?? first ?? '',
    last_name: student.last_name ?? rest.join(' '),
    grade: student.grade ?? '',
    allergies: student.allergies ?? '',
    medical_conditions: student.medical_conditions ?? student.medical_info ?? '',
    emergency_contact_name: student.emergency_contact_name ?? '',
    emergency_contact_phone: student.emergency_contact_phone ?? '',
    emergency_contact_relation: student.emergency_contact_relation ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim()) { setErr("Your camper's first and last name are required"); return }
    if (!form.emergency_contact_name.trim() || !form.emergency_contact_phone.trim()) { setErr('An emergency contact name and phone are required'); return }
    setSaving(true)
    setErr(null)
    try {
      const age = gradeToAge(form.grade)
      await onSave?.(student.id, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        full_name: `${form.first_name.trim()} ${form.last_name.trim()}`,
        grade: form.grade || null,
        ...(age ? { age } : {}),
        allergies: form.allergies.trim() || null,
        medical_conditions: form.medical_conditions.trim() || null,
        medical_info: form.medical_conditions.trim() || null,
        emergency_contact_name: form.emergency_contact_name.trim(),
        emergency_contact_phone: form.emergency_contact_phone.trim(),
        emergency_contact_relation: form.emergency_contact_relation.trim() || null,
      })
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong')
      setSaving(false)
    }
  }

  const input = 'w-full h-10 px-3 rounded-[8px] bg-surface border border-border-strong text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand'
  const label = 'block font-sans text-xs font-semibold text-ink-muted mb-1'
  const id = (k: string) => `camper-${student.id}-${k}`

  return (
    <form onSubmit={submit} onKeyDown={e => { if (e.key === 'Escape') onDone() }} className="px-5 py-4 bg-surface-sunken border-t border-border space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label htmlFor={id('first')} className={label}>First name</label><input id={id('first')} autoFocus className={input} value={form.first_name} onChange={e => set('first_name', e.target.value)} /></div>
        <div><label htmlFor={id('last')} className={label}>Last name</label><input id={id('last')} className={input} value={form.last_name} onChange={e => set('last_name', e.target.value)} /></div>
        <div>
          <label htmlFor={id('grade')} className={label}>Grade (entering fall)</label>
          <select id={id('grade')} className={input} value={form.grade} onChange={e => set('grade', e.target.value)}>
            <option value="">Select…</option>
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor={id('allergies')} className={label}>Allergies / dietary restrictions</label><input id={id('allergies')} className={input} placeholder="None" value={form.allergies} onChange={e => set('allergies', e.target.value)} /></div>
        <div><label htmlFor={id('medical')} className={label}>Medical conditions</label><input id={id('medical')} className={input} placeholder="None" value={form.medical_conditions} onChange={e => set('medical_conditions', e.target.value)} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label htmlFor={id('ec-name')} className={label}>Emergency contact</label><input id={id('ec-name')} className={input} value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} /></div>
        <div><label htmlFor={id('ec-phone')} className={label}>Their phone</label><input id={id('ec-phone')} type="tel" className={input} value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} /></div>
        <div><label htmlFor={id('ec-rel')} className={label}>Relationship</label><input id={id('ec-rel')} className={input} value={form.emergency_contact_relation} onChange={e => set('emergency_contact_relation', e.target.value)} /></div>
      </div>
      {err && <p role="alert" className="font-sans text-sm text-danger">{err}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="h-10 px-4 rounded-[8px] border border-border-strong bg-surface font-sans font-semibold text-sm text-ink hover:bg-surface-sunken transition">Cancel</button>
        <button type="submit" disabled={saving} className="h-10 px-4 rounded-[8px] bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm flex items-center gap-1.5 transition disabled:opacity-50">
          <Check size={15} /> {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}

export default function StudentCard({ student, registrations, onSave }: Props) {
  const [editing, setEditing] = useState(false)
  const medicalNote = [
    realNote(student.allergies) && `Allergies: ${realNote(student.allergies)}`,
    (realNote(student.medical_conditions) ?? realNote(student.medical_info)) && `Medical: ${realNote(student.medical_conditions) ?? realNote(student.medical_info)}`,
  ].filter(Boolean).join(' · ')
  const initials = student.full_name
    .split(/\s+/)
    .map(n => n.match(/\p{L}/u)?.[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'

  const rollup = rollupStatus(registrations)
  const RollupIcon = rollup.Icon

  return (
    <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-role-parent-soft flex items-center justify-center shrink-0">
            <span className="font-sans font-semibold text-sm text-role-parent">{initials}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <h3 className="font-sans font-semibold text-base text-ink truncate">{student.full_name}</h3>
                <span className="text-xs font-sans text-ink-muted shrink-0">Age {student.age}</span>
                {medicalNote && <MedicalFlag info={medicalNote} />}
              </div>
              {/* Rollup status badge: all confirmed → All set, any pending/waitlisted → Action pending, none → Not enrolled */}
              <span
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${rollup.className}`}
              >
                {RollupIcon && <RollupIcon size={13} />}
                {rollup.label}
              </span>
            </div>

            {registrations.length === 0 ? (
              <p className="text-sm font-sans text-ink-muted mt-1">Not enrolled in any class yet</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {registrations.map(reg => {
                  const cfg = STATUS_CONFIG[reg.status]
                  const Icon = cfg.Icon
                  const week = reg.sections?.week
                  return (
                    <li key={reg.id}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.className}`}
                        >
                          <Icon size={13} />
                          {cfg.label}
                        </span>
                        <span className="text-sm font-sans text-ink-muted truncate">
                          {reg.sections?.classes?.name ?? '—'}
                          {reg.sections?.label ? ` · ${reg.sections.label}` : ''}
                          {week ? ` · Week ${week}` : ''}
                        </span>
                      </div>
                      {/* SCHEDULE LINE PLACEHOLDER — render days · times · lead volunteer here once the
                          `sections` table gains start_time / end_time / weekdays columns. Times are
                          deferred (no such columns exist yet); do not fabricate them. */}
                      {cfg.note && (
                        <p className="mt-0.5 ml-1 text-xs font-sans text-ink-faint">{cfg.note}</p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Footer: per-camper actions (DS §7.1). Ghost Edit + secondary Register; the single gold
          primary (Add camper) lives in the dashboard header. */}
      {editing && <CamperEditor student={student} onSave={onSave} onDone={() => setEditing(false)} />}

      <div className="bg-surface-sunken border-t border-border px-4 sm:px-5 py-3 flex flex-wrap items-center justify-end gap-2">
        {onSave && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-expanded={editing}
            className="h-10 px-3 text-sm font-sans font-semibold text-ink-muted rounded-[8px] hover:bg-surface hover:text-ink flex items-center gap-1.5 transition"
          >
            <Pencil size={14} /> Edit camper
          </button>
        )}
        <Link
          to={`/parent/classes?camper=${student.id}`}
          className="h-10 px-3.5 bg-surface border border-border-strong text-ink font-sans font-semibold text-sm rounded-[8px] hover:bg-surface-sunken flex items-center gap-1.5 transition shadow-sm"
        >
          <GraduationCap size={14} /> Register for another class
        </Link>
      </div>
    </div>
  )
}
