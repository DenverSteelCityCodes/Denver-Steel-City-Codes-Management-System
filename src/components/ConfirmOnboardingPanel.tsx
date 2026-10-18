import { useEffect, useRef, useState } from 'react'
import { GRADES } from '../lib/campers'
import { buttonClass } from '../lib/ui'
import { ErrorLine, Segmented, labelCls } from '../pages/parent/parts'
import type { Student, OnboardingConfirmation } from '../types/database'

// Saved parent details (parent_profiles + account name) used when the camper record has none.
export interface ParentDefaults {
  parent_name?: string | null
  parent_phone?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
  emergency_contact_relation?: string | null
}

interface Props {
  student: Student
  parentDefaults?: ParentDefaults
  campYear: number
  // The class is full, so confirming joins its waitlist.
  full?: boolean
  submitting?: boolean
  onConfirm: (fields: OnboardingConfirmation) => Promise<void> | void
  onClose: () => void
}

// Per-summer onboarding confirmation (#42). A camper can only be registered for a session once
// their onboarding has been reviewed and confirmed for the active camp year. This inline panel shows the
// camper's existing info (prefilled), lets the parent correct anything stale, re-sign the waiver,
// and explicitly attest it is current — the official form requires fresh info every summer.
// A missing answer is flagged under its own field (marked invalid and focused), not in a summary.
type ErrKey = keyof OnboardingConfirmation | 'attested'
const FIELD_ID: Partial<Record<ErrKey, string>> = {
  full_name: 'ob-1', grade: 'ob-2', shirt_size: 'ob-3', laptop_available: 'ob-4', parent_name: 'ob-5',
  parent_phone: 'ob-6', emergency_contact_name: 'ob-7', emergency_contact_phone: 'ob-8',
  emergency_contact_relation: 'ob-9', allergies: 'ob-10', medical_conditions: 'ob-11', free_reduced_lunch: 'ob-12',
  guardian_signature: 'ob-13', attested: 'ob-14',
}

export default function ConfirmOnboardingPanel({ student, parentDefaults, campYear, full = false, submitting, onConfirm, onClose }: Props) {
  const [form, setForm] = useState<OnboardingConfirmation>({
    full_name: student.full_name,
    grade: student.grade ?? null,
    shirt_size: student.shirt_size ?? null,
    laptop_available: student.laptop_available ?? null,
    parent_name: student.parent_name ?? parentDefaults?.parent_name ?? null,
    parent_phone: student.parent_phone ?? parentDefaults?.parent_phone ?? null,
    emergency_contact_name: student.emergency_contact_name ?? parentDefaults?.emergency_contact_name ?? null,
    emergency_contact_phone: student.emergency_contact_phone ?? parentDefaults?.emergency_contact_phone ?? null,
    emergency_contact_relation: student.emergency_contact_relation ?? parentDefaults?.emergency_contact_relation ?? null,
    allergies: student.allergies ?? null,
    medical_conditions: student.medical_conditions ?? student.medical_info ?? null,
    free_reduced_lunch: student.free_reduced_lunch ?? null,
    guardian_signature: null, // always re-signed for the new year
  })
  const [attested, setAttested] = useState(false)
  // Read-only summary first; the fields open on "Change something", or right away when a required
  // answer is missing (it can only be filled in there).
  const [editing, setEditing] = useState(() =>
    [form.full_name, form.grade, form.shirt_size, form.parent_name, form.parent_phone, form.emergency_contact_name,
      form.emergency_contact_phone, form.emergency_contact_relation, form.allergies, form.medical_conditions]
      .some(v => !v?.trim()) || form.laptop_available == null || form.free_reduced_lunch == null)
  const [error, setError] = useState<{ key: ErrKey; msg: string } | null>(null)
  const panelRef = useRef<HTMLElement>(null)

  // It opens in place inside the class tapped, so bring it into view and put focus on it.
  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    panelRef.current?.focus({ preventScroll: true })
  }, [])

  // The field an error is about takes focus (a yes/no group focuses its first button).
  useEffect(() => {
    if (!error) return
    const el = document.getElementById(FIELD_ID[error.key] ?? '')
    const target = el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) ? el : document.querySelector<HTMLElement>(`[aria-labelledby="${FIELD_ID[error.key]}"] button`)
    target?.focus()
  }, [error])

  function set<K extends keyof OnboardingConfirmation>(key: K, value: OnboardingConfirmation[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function validate(): { key: ErrKey; msg: string } | null {
    const e = (key: ErrKey, msg: string) => ({ key, msg })
    if (!form.full_name?.trim()) return e('full_name', "Camper's name is required")
    if (!form.grade) return e('grade', 'Grade is required')
    if (!form.shirt_size) return e('shirt_size', 'Shirt size is required')
    if (form.laptop_available === null || form.laptop_available === undefined)
      return e('laptop_available', 'Please answer the laptop question')
    if (!form.parent_name?.trim()) return e('parent_name', 'Parent/guardian name is required')
    if (!form.parent_phone?.trim()) return e('parent_phone', 'Parent/guardian phone is required')
    if (!form.emergency_contact_name?.trim()) return e('emergency_contact_name', 'Emergency contact name is required')
    if (!form.emergency_contact_phone?.trim()) return e('emergency_contact_phone', 'Emergency contact phone is required')
    if (!form.emergency_contact_relation?.trim()) return e('emergency_contact_relation', 'Emergency contact relationship is required')
    if (!form.allergies?.trim()) return e('allergies', 'Please note allergies/dietary restrictions (enter "None" if not applicable)')
    if (!form.medical_conditions?.trim()) return e('medical_conditions', 'Please note medical conditions (enter "None" if not applicable)')
    if (form.free_reduced_lunch === null || form.free_reduced_lunch === undefined)
      return e('free_reduced_lunch', 'Please answer the free/reduced lunch question')
    if (!form.guardian_signature?.trim()) return e('guardian_signature', 'Please re-sign as the guardian to confirm')
    if (!attested) return e('attested', `Please confirm the information is accurate for the ${campYear} camp`)
    return null
  }

  async function handleConfirm() {
    const err = validate()
    // A missing detail can only be fixed in the fields, so open them.
    if (err) { setError(err); if (err.key !== 'guardian_signature' && err.key !== 'attested') setEditing(true); return }
    setError(null)
    await onConfirm({
      ...form,
      full_name: form.full_name?.trim() ?? '',
      parent_name: form.parent_name?.trim() ?? null,
      parent_phone: form.parent_phone?.trim() ?? null,
      emergency_contact_name: form.emergency_contact_name?.trim() ?? null,
      emergency_contact_phone: form.emergency_contact_phone?.trim() ?? null,
      emergency_contact_relation: form.emergency_contact_relation?.trim() ?? null,
      allergies: form.allergies?.trim() ?? null,
      medical_conditions: form.medical_conditions?.trim() ?? null,
      guardian_signature: form.guardian_signature?.trim() ?? null,
    })
  }

  const inputCls = 'ui-input'
  // Marks the field an error is about and points it at the message under it.
  const invalid = (key: ErrKey) => error?.key === key ? { 'aria-invalid': true as const, 'aria-describedby': 'ob-err' } : {}
  const errorUnder = (key: ErrKey) => error?.key === key && <ErrorLine id="ob-err" className="mt-1.5">{error.msg}</ErrorLine>
  const yesNo = (key: 'laptop_available' | 'free_reduced_lunch', labelId: string) => (
    <Segmented labelledBy={labelId} invalid={error?.key === key} items={[true, false].map(v => ({
      key: String(v), label: v ? 'Yes' : 'No', on: form[key] === v, onClick: () => set(key, v),
    }))} />
  )
  const missing = <span className="text-ink-muted">Missing</span>

  // In place inside the class tapped: a 2px ink frame, the one task on the page while it's open.
  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      aria-labelledby="onboarding-title"
      onKeyDown={e => { if (e.key === 'Escape') onClose() }}
      className="mt-4 rounded border-2 border-ink p-4 scroll-mt-28 focus:outline-none"
    >
        <h4 id="onboarding-title" className="text-lg font-bold leading-snug">Is this still right for {student.first_name ?? student.full_name.split(' ')[0]}?</h4>
        <p className="mt-1 text-ink-muted">We ask once each summer, before the first class of {campYear}.</p>

        {!editing ? (
          <>
            <dl className="mt-3 grid grid-cols-[fit-content(8.5rem)_1fr] gap-x-4 gap-y-1.5">
              <dt className="text-sm text-ink-muted pt-0.5">Name</dt><dd className="min-w-0 break-words font-bold">{form.full_name}</dd>
              <dt className="text-sm text-ink-muted pt-0.5">Grade</dt><dd className="font-bold">{form.grade ?? missing}</dd>
              <dt className="text-sm text-ink-muted pt-0.5">Shirt</dt><dd className="font-bold">{form.shirt_size ?? missing}</dd>
              <dt className="text-sm text-ink-muted pt-0.5">Laptop</dt><dd className="font-bold">{form.laptop_available == null ? missing : form.laptop_available ? 'Yes' : 'No'}</dd>
              <dt className="text-sm text-ink-muted pt-0.5">Guardian</dt><dd className="min-w-0 break-words font-bold">{[form.parent_name, form.parent_phone].filter(Boolean).join(', ') || missing}</dd>
              <dt className="text-sm text-ink-muted pt-0.5">Emergency</dt><dd className="min-w-0 break-words font-bold">{[form.emergency_contact_name, form.emergency_contact_relation, form.emergency_contact_phone].filter(Boolean).join(', ') || missing}</dd>
              <dt className="text-sm text-ink-muted pt-0.5">Health</dt><dd className="min-w-0 break-words font-bold">{[form.allergies, form.medical_conditions].filter(Boolean).join('; ') || missing}</dd>
              <dt className="text-sm text-ink-muted pt-0.5">Free lunch</dt><dd className="font-bold">{form.free_reduced_lunch == null ? missing : form.free_reduced_lunch ? 'Yes' : 'No'}</dd>
            </dl>
            <button type="button" onClick={() => setEditing(true)} className={buttonClass('text', 'mt-1')}>Change something</button>
          </>
        ) : (
        <div className="mt-4 space-y-5">
          <div>
            <label htmlFor="ob-1" className={labelCls}>Camper's full name *</label>
            <input id="ob-1" {...invalid('full_name')} className={inputCls} value={form.full_name ?? ''} onChange={e => set('full_name', e.target.value)} />
            {errorUnder('full_name')}
          </div>

          <div className="grid grid-cols-2 items-end gap-x-4 gap-y-5">
            <div>
              <label htmlFor="ob-2" className={labelCls}>Grade entering fall {campYear} *</label>
              <select id="ob-2" {...invalid('grade')} className={inputCls} value={form.grade ?? ''} onChange={e => set('grade', e.target.value)}>
                <option value="">Select…</option>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              {errorUnder('grade')}
            </div>
            <div>
              <label htmlFor="ob-3" className={labelCls}>Shirt size *</label>
              <select id="ob-3" {...invalid('shirt_size')} className={inputCls} value={form.shirt_size ?? ''} onChange={e => set('shirt_size', e.target.value)}>
                <option value="">Select…</option>
                {['XS', 'S', 'M', 'L', 'XL'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {errorUnder('shirt_size')}
            </div>
          </div>

          <div>
            <p id="ob-4" className={labelCls}>Can your camper bring a laptop each day? *</p>
            {yesNo('laptop_available', 'ob-4')}
            {errorUnder('laptop_available')}
          </div>

          <div className="grid min-[480px]:grid-cols-2 gap-x-4 gap-y-5">
            <div>
              <label htmlFor="ob-5" className={labelCls}>Parent/guardian name *</label>
              <input id="ob-5" {...invalid('parent_name')} className={inputCls} value={form.parent_name ?? ''} onChange={e => set('parent_name', e.target.value)} />
              {errorUnder('parent_name')}
            </div>
            <div>
              <label htmlFor="ob-6" className={labelCls}>Parent/guardian phone *</label>
              <input id="ob-6" {...invalid('parent_phone')} type="tel" className={inputCls} value={form.parent_phone ?? ''} onChange={e => set('parent_phone', e.target.value)} />
              {errorUnder('parent_phone')}
            </div>
          </div>

          <div className="grid min-[480px]:grid-cols-2 gap-x-4 gap-y-5">
            <div>
              <label htmlFor="ob-7" className={labelCls}>Emergency contact name *</label>
              <input id="ob-7" {...invalid('emergency_contact_name')} className={inputCls} value={form.emergency_contact_name ?? ''} onChange={e => set('emergency_contact_name', e.target.value)} />
              {errorUnder('emergency_contact_name')}
            </div>
            <div>
              <label htmlFor="ob-8" className={labelCls}>Emergency contact phone *</label>
              <input id="ob-8" {...invalid('emergency_contact_phone')} type="tel" className={inputCls} value={form.emergency_contact_phone ?? ''} onChange={e => set('emergency_contact_phone', e.target.value)} />
              {errorUnder('emergency_contact_phone')}
            </div>
          </div>

          <div>
            <label htmlFor="ob-9" className={labelCls}>Emergency contact relationship *</label>
            <input id="ob-9" {...invalid('emergency_contact_relation')} className={inputCls} placeholder="e.g. Aunt, Grandparent" value={form.emergency_contact_relation ?? ''} onChange={e => set('emergency_contact_relation', e.target.value)} />
            {errorUnder('emergency_contact_relation')}
          </div>

          <div>
            <label htmlFor="ob-10" className={labelCls}>Allergies / dietary restrictions * <span className="font-normal text-ink-muted">(enter "None" if not applicable)</span></label>
            <input id="ob-10" {...invalid('allergies')} className={inputCls} value={form.allergies ?? ''} onChange={e => set('allergies', e.target.value)} />
            {errorUnder('allergies')}
          </div>

          <div>
            <label htmlFor="ob-11" className={labelCls}>Medical conditions, learning needs, etc. * <span className="font-normal text-ink-muted">(enter "None" if not applicable)</span></label>
            <input id="ob-11" {...invalid('medical_conditions')} className={inputCls} value={form.medical_conditions ?? ''} onChange={e => set('medical_conditions', e.target.value)} />
            {errorUnder('medical_conditions')}
          </div>

          <div>
            <p id="ob-12" className={labelCls}>Does your camper qualify for free/reduced lunch and need lunch provided? *</p>
            {yesNo('free_reduced_lunch', 'ob-12')}
            {errorUnder('free_reduced_lunch')}
          </div>

        </div>
        )}

        <div className="mt-5 space-y-3">
          <div>
            <label htmlFor="ob-13" className={labelCls}>Type your full legal name to sign again *</label>
            <input id="ob-13" {...invalid('guardian_signature')} className={inputCls} autoComplete="off" value={form.guardian_signature ?? ''} onChange={e => set('guardian_signature', e.target.value)} />
            {errorUnder('guardian_signature')}
          </div>

          <div>
            <label className="flex items-start gap-3 min-h-11 py-2 cursor-pointer">
              <input id="ob-14" {...invalid('attested')} type="checkbox" className="w-6 h-6 shrink-0" checked={attested} onChange={e => setAttested(e.target.checked)} />
              <span className="text-pretty">
                I confirm this information is accurate and up to date for the {campYear} Steel City Codes summer camp.
              </span>
            </label>
            {errorUnder('attested')}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-2">
          <button type="button" onClick={onClose} className={buttonClass('secondary')}>
            Not now
          </button>
          <button type="button" onClick={handleConfirm} disabled={submitting} className={buttonClass('primary', 'px-3')}>
            {submitting && <span aria-hidden="true" className="w-4 h-4 rounded-full border-2 border-brand-on border-t-transparent animate-spin" />}
            {submitting ? 'Confirming…' : full ? 'Confirm and join waitlist' : 'Confirm and register'}
          </button>
        </div>
    </section>
  )
}
