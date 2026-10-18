import { useState } from 'react'
import { Check } from 'lucide-react'
import { GRADES, gradeToAge } from '../lib/campers'
import type { Student } from '../types/database'

export type CamperPatch = Partial<Omit<Student, 'id' | 'parent_id' | 'created_at'>>

// 16px so iOS Safari doesn't zoom the page when the field is focused.
const input = 'ui-input'
const label = 'block font-sans text-sm font-semibold text-ink-muted mb-1'

// Inline editor for the details parents actually change mid-year (name, grade, health, emergency
// contact). The full yearly review still happens in the registration flow.
export default function CamperEditor({ student, onSave, onDone }: { student: Student; onSave: (id: string, patch: CamperPatch) => Promise<void>; onDone: () => void }) {
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
      await onSave(student.id, {
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

  const id = (k: string) => `camper-${student.id}-${k}`

  return (
    <form onSubmit={submit} onKeyDown={e => { if (e.key === 'Escape') onDone() }} className="space-y-3.5">
      <div className="grid grid-cols-2 gap-3">
        <div><label htmlFor={id('first')} className={label}>First name</label><input id={id('first')} autoFocus className={input} value={form.first_name} onChange={e => set('first_name', e.target.value)} /></div>
        <div><label htmlFor={id('last')} className={label}>Last name</label><input id={id('last')} className={input} value={form.last_name} onChange={e => set('last_name', e.target.value)} /></div>
      </div>
      <div>
        <label htmlFor={id('grade')} className={label}>Grade (entering fall)</label>
        <select id={id('grade')} className={input} value={form.grade} onChange={e => set('grade', e.target.value)}>
          <option value="">Select…</option>
          {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <div><label htmlFor={id('allergies')} className={label}>Allergies or dietary needs</label><input id={id('allergies')} className={input} placeholder="None" value={form.allergies} onChange={e => set('allergies', e.target.value)} /></div>
      <div><label htmlFor={id('medical')} className={label}>Medical conditions</label><input id={id('medical')} className={input} placeholder="None" value={form.medical_conditions} onChange={e => set('medical_conditions', e.target.value)} /></div>
      <div><label htmlFor={id('ec-name')} className={label}>Emergency contact</label><input id={id('ec-name')} className={input} value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label htmlFor={id('ec-phone')} className={label}>Their phone</label><input id={id('ec-phone')} type="tel" className={input} value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} /></div>
        <div><label htmlFor={id('ec-rel')} className={label}>Relationship</label><input id={id('ec-rel')} className={input} value={form.emergency_contact_relation} onChange={e => set('emergency_contact_relation', e.target.value)} /></div>
      </div>
      {err && <p role="alert" className="font-sans text-sm text-danger">{err}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="h-11 px-4 rounded-[10px] border border-border-strong bg-surface font-sans font-semibold text-[15px] text-ink hover:bg-surface-sunken transition">Cancel</button>
        <button type="submit" disabled={saving} className="ui-btn ui-btn--primary">
          <Check size={16} /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}
