import { useEffect, useRef, useState } from 'react'
import { GRADES } from '../lib/campers'
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
  const [error, setError] = useState<string | null>(null)
  const panelRef = useRef<HTMLElement>(null)

  // It opens in place inside the class tapped, so bring it into view and put focus on it.
  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    panelRef.current?.focus({ preventScroll: true })
  }, [])

  function set<K extends keyof OnboardingConfirmation>(key: K, value: OnboardingConfirmation[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function validate(): string | null {
    if (!form.full_name?.trim()) return "Camper's name is required"
    if (!form.grade) return 'Grade is required'
    if (!form.shirt_size) return 'Shirt size is required'
    if (form.laptop_available === null || form.laptop_available === undefined)
      return 'Please answer the laptop question'
    if (!form.parent_name?.trim()) return 'Parent/guardian name is required'
    if (!form.parent_phone?.trim()) return 'Parent/guardian phone is required'
    if (!form.emergency_contact_name?.trim()) return 'Emergency contact name is required'
    if (!form.emergency_contact_phone?.trim()) return 'Emergency contact phone is required'
    if (!form.emergency_contact_relation?.trim()) return 'Emergency contact relationship is required'
    if (!form.allergies?.trim()) return 'Please note allergies/dietary restrictions (enter "None" if not applicable)'
    if (!form.medical_conditions?.trim()) return 'Please note medical conditions (enter "None" if not applicable)'
    if (form.free_reduced_lunch === null || form.free_reduced_lunch === undefined)
      return 'Please answer the free/reduced lunch question'
    if (!form.guardian_signature?.trim()) return 'Please re-sign as the guardian to confirm'
    if (!attested) return `Please confirm the information is accurate for the ${campYear} camp`
    return null
  }

  async function handleConfirm() {
    const err = validate()
    // A missing detail can only be fixed in the fields, so open them.
    if (err) { setError(err); if (!err.includes('re-sign') && !err.includes('confirm the information')) setEditing(true); return }
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

  const inputCls = 'w-full h-11 px-3.5 rounded-[10px] bg-surface border border-border-strong text-ink placeholder:text-ink-faint font-sans text-base focus:outline-none focus:ring-2 focus:ring-brand transition'
  const labelCls = 'block font-sans font-semibold text-sm text-ink mb-1.5'
  const yesNo = (val: boolean | null | undefined, target: boolean) =>
    `flex-1 h-11 rounded-[10px] font-sans font-semibold text-[15px] border transition ${
      val === target ? 'bg-brand text-brand-on border-brand' : 'bg-surface border-border-strong text-ink hover:bg-surface-sunken'
    }`

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      aria-labelledby="onboarding-title"
      onKeyDown={e => { if (e.key === 'Escape') onClose() }}
      className="mt-3 -mx-4 -mb-4 bg-info-soft px-4 py-4 scroll-mt-28 focus:outline-none"
    >
        <h4 id="onboarding-title" className="font-sans font-bold text-base text-ink">Is this still right for {student.first_name ?? student.full_name.split(' ')[0]}?</h4>
        <p className="font-sans text-[15px] text-ink">We ask once each summer, before the first class of {campYear}.</p>

        {!editing ? (
          <>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 font-sans text-[15px]">
              <dt className="text-ink-muted">Name</dt><dd className="text-ink font-semibold">{form.full_name}</dd>
              <dt className="text-ink-muted">Grade</dt><dd className="text-ink font-semibold">{form.grade ?? 'Missing'}</dd>
              <dt className="text-ink-muted">Shirt</dt><dd className="text-ink font-semibold">{form.shirt_size ?? 'Missing'}</dd>
              <dt className="text-ink-muted">Laptop</dt><dd className="text-ink font-semibold">{form.laptop_available == null ? 'Missing' : form.laptop_available ? 'Yes' : 'No'}</dd>
              <dt className="text-ink-muted">Guardian</dt><dd className="text-ink font-semibold">{[form.parent_name, form.parent_phone].filter(Boolean).join(', ') || 'Missing'}</dd>
              <dt className="text-ink-muted">Emergency</dt><dd className="text-ink font-semibold">{[form.emergency_contact_name, form.emergency_contact_relation, form.emergency_contact_phone].filter(Boolean).join(', ') || 'Missing'}</dd>
              <dt className="text-ink-muted">Health</dt><dd className="text-ink font-semibold">{[form.allergies, form.medical_conditions].filter(Boolean).join('; ') || 'Missing'}</dd>
              <dt className="text-ink-muted">Free lunch</dt><dd className="text-ink font-semibold">{form.free_reduced_lunch == null ? 'Missing' : form.free_reduced_lunch ? 'Yes' : 'No'}</dd>
            </dl>
            <button type="button" onClick={() => setEditing(true)} className="mt-1 min-h-11 font-sans text-[15px] font-semibold text-ink underline decoration-brand-hover decoration-2 underline-offset-4">Change something</button>
          </>
        ) : (
        <div className="mt-3 space-y-4">
          <div>
            <label htmlFor="ob-1" className={labelCls}>Camper's full name *</label>
            <input id="ob-1" className={inputCls} value={form.full_name ?? ''} onChange={e => set('full_name', e.target.value)} />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="ob-2" className={labelCls}>Grade entering fall {campYear} *</label>
              <select id="ob-2" className={inputCls} value={form.grade ?? ''} onChange={e => set('grade', e.target.value)}>
                <option value="">Select…</option>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="ob-3" className={labelCls}>Shirt size *</label>
              <select id="ob-3" className={inputCls} value={form.shirt_size ?? ''} onChange={e => set('shirt_size', e.target.value)}>
                <option value="">Select…</option>
                {['XS', 'S', 'M', 'L', 'XL'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <p id="ob-4" className={labelCls}>Can your camper bring a laptop each day? *</p>
            <div className="flex gap-2">
              <button type="button" className={yesNo(form.laptop_available, true)} onClick={() => set('laptop_available', true)}>Yes</button>
              <button type="button" className={yesNo(form.laptop_available, false)} onClick={() => set('laptop_available', false)}>No</button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="ob-5" className={labelCls}>Parent/guardian name *</label>
              <input id="ob-5" className={inputCls} value={form.parent_name ?? ''} onChange={e => set('parent_name', e.target.value)} />
            </div>
            <div>
              <label htmlFor="ob-6" className={labelCls}>Parent/guardian phone *</label>
              <input id="ob-6" type="tel" className={inputCls} value={form.parent_phone ?? ''} onChange={e => set('parent_phone', e.target.value)} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="ob-7" className={labelCls}>Emergency contact name *</label>
              <input id="ob-7" className={inputCls} value={form.emergency_contact_name ?? ''} onChange={e => set('emergency_contact_name', e.target.value)} />
            </div>
            <div>
              <label htmlFor="ob-8" className={labelCls}>Emergency contact phone *</label>
              <input id="ob-8" type="tel" className={inputCls} value={form.emergency_contact_phone ?? ''} onChange={e => set('emergency_contact_phone', e.target.value)} />
            </div>
          </div>

          <div>
            <label htmlFor="ob-9" className={labelCls}>Emergency contact relationship *</label>
            <input id="ob-9" className={inputCls} placeholder="e.g. Aunt, Grandparent" value={form.emergency_contact_relation ?? ''} onChange={e => set('emergency_contact_relation', e.target.value)} />
          </div>

          <div>
            <label htmlFor="ob-10" className={labelCls}>Allergies / dietary restrictions * <span className="font-normal text-ink-muted">(enter "None" if not applicable)</span></label>
            <input id="ob-10" className={inputCls} value={form.allergies ?? ''} onChange={e => set('allergies', e.target.value)} />
          </div>

          <div>
            <label htmlFor="ob-11" className={labelCls}>Medical conditions, learning needs, etc. * <span className="font-normal text-ink-muted">(enter "None" if not applicable)</span></label>
            <input id="ob-11" className={inputCls} value={form.medical_conditions ?? ''} onChange={e => set('medical_conditions', e.target.value)} />
          </div>

          <div>
            <p id="ob-12" className={labelCls}>Does your camper qualify for free/reduced lunch and need lunch provided? *</p>
            <div className="flex gap-2">
              <button type="button" className={yesNo(form.free_reduced_lunch, true)} onClick={() => set('free_reduced_lunch', true)}>Yes</button>
              <button type="button" className={yesNo(form.free_reduced_lunch, false)} onClick={() => set('free_reduced_lunch', false)}>No</button>
            </div>
          </div>

        </div>
        )}

        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor="ob-13" className={labelCls}>Type your full legal name to sign again *</label>
            <input id="ob-13" className={inputCls} placeholder="Type your full legal name" value={form.guardian_signature ?? ''} onChange={e => set('guardian_signature', e.target.value)} />
          </div>

          <label className="flex items-start gap-3 py-1 cursor-pointer">
            <input type="checkbox" className="w-5 h-5 mt-0.5 accent-brand shrink-0" checked={attested} onChange={e => setAttested(e.target.checked)} />
            <span className="font-sans text-[15px] text-ink">
              I confirm this information is accurate and up to date for the {campYear} Steel City Codes summer camp.
            </span>
          </label>

          {error && (
            <p role="alert" className="font-sans text-sm font-semibold bg-danger-soft text-danger px-3.5 py-2.5 rounded-[10px]">{error}</p>
          )}
        </div>

        <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-2">
          <button type="button" onClick={onClose} className="h-11 px-4 rounded-[10px] border border-border-strong bg-surface font-sans font-semibold text-[15px] text-ink hover:bg-surface-sunken transition">
            Not now
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="h-11 px-3 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-[15px] rounded-[10px] flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            {submitting && <span className="w-4 h-4 rounded-full border-2 border-brand-on border-t-transparent animate-spin" />}
            {submitting ? 'Confirming…' : full ? 'Confirm and join waitlist' : 'Confirm and register'}
          </button>
        </div>
    </section>
  )
}
