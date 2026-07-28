import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useClasses } from '../hooks/useClasses'
import { useSessions } from '../hooks/useSessions'

const SCHOOL_DISTRICTS = [
  'Cherry Creek School District',
  'Douglas County School District',
  'Jefferson County Public Schools',
  'Adams 12 Five Star Schools',
  'Other',
]
const GRADES = ['4th', '5th', '6th', '7th', '8th']
const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL']
const ETHNIC_OPTIONS = [
  'American Indian or Alaska Native',
  'Asian',
  'Black or African American',
  'Hispanic or Latino',
  'Native Hawaiian or Other Pacific Islander',
  'White',
  'Two or more races',
  'Prefer not to say',
]
const HOW_HEARD = [
  'School announcement', 'Teacher/counselor', 'Friend or family',
  'Social media', 'Flyer', 'Returning camper', 'Other',
]

interface FormData {
  // Student info — the official form asks first/last separately; full_name is kept as the
  // canonical display value (composed from the two on submit).
  first_name: string
  last_name: string
  full_name: string
  email: string
  school_district: string
  school_name: string
  grade: string
  shirt_size: string
  laptop_available: boolean | null
  // Demographics
  ethnic_background: string[]
  gender: string
  // Parent / emergency contact
  parent_name: string
  parent_email: string
  parent_phone: string
  emergency_name: string
  emergency_phone: string
  emergency_relation: string
  // Medical
  allergies: string
  medical_conditions: string
  free_reduced_lunch: boolean | null
  lunch_provision: boolean
  other_info: string
  // Misc
  how_heard: string
  previous_program: boolean | null
  program_last_year: string
  candy_consent: boolean
  // Session preferences
  session1: boolean
  session2: boolean
  class_week1: string
  class_week2: string
  // Waiver
  waiver_signature: string
  guardian_signature: string
}

const PREVIOUS_PROGRAMS = ['Intro to Python', 'Intermediate Python', 'Intro to Java', 'Intermediate Java']

const INITIAL: FormData = {
  first_name: '', last_name: '', full_name: '', email: '', school_district: '', school_name: '', grade: '',
  shirt_size: '', laptop_available: null,
  ethnic_background: [], gender: '',
  parent_name: '', parent_email: '', parent_phone: '',
  emergency_name: '', emergency_phone: '', emergency_relation: '',
  allergies: '', medical_conditions: '', free_reduced_lunch: null, lunch_provision: false,
  other_info: '',
  how_heard: '', previous_program: null, program_last_year: '', candy_consent: false,
  session1: false, session2: false, class_week1: '', class_week2: '',
  waiver_signature: '', guardian_signature: '',
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`h-2 rounded-full transition-all ${
          i + 1 === current ? 'w-6 bg-brand' : i + 1 < current ? 'w-2 bg-brand/40' : 'w-2 bg-border-strong'
        }`} />
      ))}
    </div>
  )
}

export default function ParentRegistrationPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const studentId = searchParams.get('studentId')
  const { profile } = useAuth()
  const { classes } = useClasses()
  const { sessions } = useSessions()

  // Stamp the record with the active camp year (not the calendar year) so a camper who just
  // completed the full form is considered confirmed for this summer and isn't immediately
  // re-prompted by the per-summer onboarding gate (#42).
  const campYear =
    sessions.filter(s => s.is_active).reduce((max, s) => Math.max(max, s.year), 0) ||
    new Date().getFullYear()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>({ ...INITIAL, parent_name: profile?.display_name ?? '', parent_email: '' })
  // When re-registering an existing camper (?studentId=…), we update that student row for the
  // new camp year instead of inserting a duplicate. null = brand-new camper.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Display name derived from the split first/last fields (full_name is composed on submit).
  const studentFullName = `${form.first_name} ${form.last_name}`.trim()

  const classNames = classes.map(c => c.name)

  useEffect(() => {
    if (profile?.display_name) {
      setForm(f => ({ ...f, parent_name: profile.display_name }))
    }
  }, [profile])

  // Re-registration: prefill the form from the existing camper so the parent reviews and
  // updates rather than re-entering everything. Waiver signatures and session/class choices
  // are intentionally left blank — they must be provided fresh for the new camp year.
  useEffect(() => {
    if (!studentId) return
    let cancelled = false
    ;(async () => {
      const { data, error: fetchErr } = await supabase
        .from('students').select('*').eq('id', studentId).maybeSingle()
      if (cancelled || fetchErr || !data) return
      setEditingId(data.id)
      setForm(f => ({
        ...f,
        first_name: data.first_name ?? '',
        last_name: data.last_name ?? '',
        email: data.email ?? '',
        school_district: data.school_district ?? '',
        school_name: data.school_name ?? '',
        grade: data.grade ?? '',
        shirt_size: data.shirt_size ?? '',
        laptop_available: data.laptop_available ?? null,
        ethnic_background: data.ethnic_background ?? [],
        gender: data.gender ?? '',
        parent_name: data.parent_name ?? f.parent_name,
        parent_phone: data.parent_phone ?? '',
        emergency_name: data.emergency_contact_name ?? '',
        emergency_phone: data.emergency_contact_phone ?? '',
        emergency_relation: data.emergency_contact_relation ?? '',
        allergies: data.allergies ?? '',
        medical_conditions: data.medical_conditions ?? '',
        other_info: data.other_info ?? '',
        free_reduced_lunch: data.free_reduced_lunch ?? null,
        lunch_provision: data.lunch_provision ?? false,
        how_heard: data.how_heard ?? '',
        previous_program: data.previous_program ?? null,
        program_last_year: data.program_last_year ?? '',
        candy_consent: data.candy_consent ?? false,
      }))
    })()
    return () => { cancelled = true }
  }, [studentId])

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function toggleEthnic(val: string) {
    setForm(f => ({
      ...f,
      ethnic_background: f.ethnic_background.includes(val)
        ? f.ethnic_background.filter(e => e !== val)
        : [...f.ethnic_background, val],
    }))
  }

  function validate(): string | null {
    if (step === 1) {
      if (!form.first_name.trim()) return "Participant's first name is required"
      if (!form.last_name.trim()) return "Participant's last name is required"
      if (!form.email.trim()) return "Student's preferred email is required"
      if (!form.school_district) return 'School district is required'
      if (!form.school_name.trim()) return 'School name is required'
      if (!form.grade) return 'Grade is required'
      if (!form.shirt_size) return 'Shirt size is required'
      if (form.laptop_available === null) return 'Please answer the laptop availability question'
    }
    if (step === 2) {
      if (!form.parent_name.trim()) return 'Parent/guardian name is required'
      if (!form.parent_email.trim()) return 'Parent/guardian email is required'
      if (!form.parent_phone.trim()) return 'Parent/guardian phone is required'
      if (!form.emergency_name.trim()) return 'Emergency contact name is required'
      if (!form.emergency_phone.trim()) return 'Emergency contact phone is required'
      if (!form.emergency_relation.trim()) return 'Emergency contact relationship is required'
    }
    if (step === 3) {
      if (!form.allergies.trim()) return 'Please note allergies/dietary restrictions (enter "None" if not applicable)'
      if (!form.medical_conditions.trim()) return 'Please note medical conditions (enter "None" if not applicable)'
      if (form.free_reduced_lunch === null) return 'Please answer the lunch eligibility question'
      if (!form.how_heard) return 'Please tell us how you heard about Steel City Codes'
      if (form.previous_program === null) return 'Please answer whether your student participated last year'
    }
    if (step === 4) {
      if (!form.session1 && !form.session2) return 'Please select at least one session'
      if (form.session1 && !form.class_week1) return 'Please select a class for Session 1'
      if (form.session2 && !form.class_week2) return 'Please select a class for Session 2'
    }
    if (step === 5) {
      if (!form.waiver_signature.trim()) return 'Waiver signature is required'
      if (!form.guardian_signature.trim()) return 'Guardian electronic signature is required'
    }
    return null
  }

  function handleNext() {
    const err = validate()
    if (err) { setError(err); return }
    setError(null)
    setStep(s => s + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleBack() {
    setError(null)
    setStep(s => s - 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setError(null)
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setSubmitting(false); return }

    const studentPayload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      full_name: `${form.first_name.trim()} ${form.last_name.trim()}`.trim(),
      age: gradeToAge(form.grade),
      medical_info: form.medical_conditions || null,
      email: form.email || null,
      school_district: form.school_district,
      school_name: form.school_name.trim(),
      grade: form.grade,
      shirt_size: form.shirt_size,
      laptop_available: form.laptop_available,
      ethnic_background: form.ethnic_background.length > 0 ? form.ethnic_background : null,
      gender: form.gender || null,
      parent_name: form.parent_name.trim(),
      parent_phone: form.parent_phone.trim(),
      emergency_contact_name: form.emergency_name.trim(),
      emergency_contact_phone: form.emergency_phone.trim(),
      emergency_contact_relation: form.emergency_relation.trim(),
      allergies: form.allergies || null,
      medical_conditions: form.medical_conditions || null,
      other_info: form.other_info || null,
      free_reduced_lunch: form.free_reduced_lunch,
      lunch_provision: form.lunch_provision,
      how_heard: form.how_heard,
      previous_program: form.previous_program,
      program_last_year: form.previous_program ? form.program_last_year || null : null,
      candy_consent: form.candy_consent,
      waiver_signature: form.waiver_signature.trim(),
      guardian_signature: form.guardian_signature.trim(),
      waiver_signed_at: new Date().toISOString(),
      registration_year: campYear,
    }

    // Re-registration updates the existing camper for the new year; a brand-new camper inserts.
    const { data: student, error: studentErr } = editingId
      ? await supabase.from('students').update(studentPayload).eq('id', editingId).select().single()
      : await supabase.from('students').insert({ parent_id: user.id, ...studentPayload }).select().single()

    if (studentErr) {
      setError('Failed to save registration. Please try again.')
      setSubmitting(false)
      return
    }

    // Create registrations for selected sessions
    const regsToCreate: { student_id: string; section_id: string; status: string }[] = []

    if (form.session1 && form.class_week1) {
      const section = findSectionForClass(form.class_week1, 1)
      if (section) regsToCreate.push({ student_id: student.id, section_id: section, status: 'pending' })
    }
    if (form.session2 && form.class_week2) {
      const section = findSectionForClass(form.class_week2, 2)
      if (section) regsToCreate.push({ student_id: student.id, section_id: section, status: 'pending' })
    }

    if (regsToCreate.length > 0) {
      await supabase.from('registrations').insert(regsToCreate)
    }

    setSubmitted(true)
  }

  function gradeToAge(grade: string): number {
    const map: Record<string, number> = { '4th': 9, '5th': 10, '6th': 11, '7th': 12, '8th': 13 }
    return map[grade] ?? 10
  }

  function findSectionForClass(className: string, week: 1 | 2): string | null {
    const cls = classes.find(c => c.name === className)
    if (!cls) return null
    const section = cls.sections.find(s => s.week === week || s.week === null)
    return section?.id ?? null
  }

  const inputCls = 'w-full h-11 px-3.5 rounded-[10px] bg-surface border border-border-strong text-ink placeholder:text-ink-faint font-sans text-sm focus:outline-none focus:border-transparent focus:ring-2 focus:ring-brand transition'
  const labelCls = 'block font-sans font-semibold text-sm text-ink mb-1.5'
  const textareaCls = 'w-full px-3.5 py-2.5 rounded-[10px] bg-surface border border-border-strong text-ink placeholder:text-ink-faint font-sans text-sm focus:outline-none focus:border-transparent focus:ring-2 focus:ring-brand transition resize-none'
  const yesNoCls = (val: boolean | null, target: boolean) =>
    `flex-1 h-11 rounded-[10px] font-sans font-semibold text-sm border transition ${
      val === target ? 'bg-brand text-brand-on border-brand' : 'bg-surface border-border-strong text-ink hover:bg-surface-sunken'
    }`

  if (submitted) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm bg-surface border border-border rounded-xl shadow-sm p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-success-soft flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-success" />
          </div>
          <h1 className="font-sans font-bold text-2xl text-ink mb-2">Registration submitted!</h1>
          <p className="font-sans text-ink-muted text-sm mb-6">
            <strong className="text-ink">{studentFullName}</strong> has been registered. Your registration is pending confirmation from our team.
          </p>
          <button
            onClick={() => navigate('/parent')}
            className="h-11 px-6 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] transition"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-8 pb-16">
        {/* Contextual back — the shell's top nav owns primary navigation now. */}
        <button
          onClick={() => navigate('/parent')}
          className="inline-flex items-center gap-1.5 font-sans text-sm font-semibold text-ink-muted hover:text-ink transition mb-6"
        >
          <ArrowLeft size={16} /> Back to dashboard
        </button>
        <StepDots current={step} total={5} />

        <form onSubmit={handleSubmit}>

          {/* Step 1: Student info */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="font-sans font-bold text-lg text-ink">Student information</h2>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>First name *</label>
                  <input type="text" className={inputCls} placeholder="Jane"
                    value={form.first_name} onChange={e => set('first_name', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Last name *</label>
                  <input type="text" className={inputCls} placeholder="Smith"
                    value={form.last_name} onChange={e => set('last_name', e.target.value)} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Student's preferred email *</label>
                <input type="email" className={inputCls} placeholder="student@example.com"
                  value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>School district *</label>
                <select className={inputCls} value={form.school_district} onChange={e => set('school_district', e.target.value)}>
                  <option value="">Select…</option>
                  {SCHOOL_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>School name *</label>
                <input type="text" className={inputCls} placeholder="e.g. Campus Middle School"
                  value={form.school_name} onChange={e => set('school_name', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Grade (entering fall) *</label>
                  <select className={inputCls} value={form.grade} onChange={e => set('grade', e.target.value)}>
                    <option value="">Select…</option>
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Shirt size *</label>
                  <select className={inputCls} value={form.shirt_size} onChange={e => set('shirt_size', e.target.value)}>
                    <option value="">Select…</option>
                    {SHIRT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Does your student have access to a personal laptop? *</label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => set('laptop_available', true)} className={yesNoCls(form.laptop_available, true)}>Yes</button>
                  <button type="button" onClick={() => set('laptop_available', false)} className={yesNoCls(form.laptop_available, false)}>No</button>
                </div>
              </div>
              <div>
                <label className={labelCls}>Ethnic background <span className="font-normal text-ink-muted">(optional — for grant reporting only)</span></label>
                <div className="flex flex-wrap gap-2">
                  {ETHNIC_OPTIONS.map(opt => (
                    <button key={opt} type="button" onClick={() => toggleEthnic(opt)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                        form.ethnic_background.includes(opt) ? 'bg-brand text-brand-on border-brand' : 'bg-surface border-border-strong text-ink hover:bg-surface-sunken'
                      }`}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Gender <span className="font-normal text-ink-muted">(optional)</span></label>
                <input type="text" className={inputCls} placeholder="e.g. Female, Male, Non-binary, Prefer not to say"
                  value={form.gender} onChange={e => set('gender', e.target.value)} />
              </div>
            </div>
          )}

          {/* Step 2: Parent & Emergency contact */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-sans font-bold text-lg text-ink">Parent &amp; emergency contact</h2>
              <div>
                <label className={labelCls}>Parent / guardian name *</label>
                <input type="text" className={inputCls} value={form.parent_name} onChange={e => set('parent_name', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Parent email *</label>
                  <input type="email" className={inputCls} value={form.parent_email} onChange={e => set('parent_email', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Parent phone *</label>
                  <input type="tel" className={inputCls} placeholder="303-555-0100" value={form.parent_phone} onChange={e => set('parent_phone', e.target.value)} />
                </div>
              </div>
              <hr className="border-border" />
              <h3 className="font-sans font-semibold text-base text-ink">Emergency contact</h3>
              <div>
                <label className={labelCls}>Emergency contact name *</label>
                <input type="text" className={inputCls} value={form.emergency_name} onChange={e => set('emergency_name', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Emergency phone *</label>
                  <input type="tel" className={inputCls} value={form.emergency_phone} onChange={e => set('emergency_phone', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Relationship *</label>
                  <input type="text" className={inputCls} placeholder="e.g. Aunt, Grandparent" value={form.emergency_relation} onChange={e => set('emergency_relation', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Medical & misc */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-sans font-bold text-lg text-ink">Medical &amp; miscellaneous</h2>
              <div>
                <label className={labelCls}>Allergies / dietary restrictions * <span className="font-normal text-ink-muted">(enter "None" if not applicable)</span></label>
                <textarea className={textareaCls} rows={2} value={form.allergies} onChange={e => set('allergies', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Medical conditions, learning disabilities, etc. * <span className="font-normal text-ink-muted">(enter "None" if not applicable)</span></label>
                <textarea className={textareaCls} rows={3} value={form.medical_conditions} onChange={e => set('medical_conditions', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Other information about participant <span className="font-normal text-ink-muted">(optional)</span></label>
                <textarea className={textareaCls} rows={2} value={form.other_info} onChange={e => set('other_info', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Is your student eligible for free / reduced lunch? *</label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => set('free_reduced_lunch', true)} className={yesNoCls(form.free_reduced_lunch, true)}>Yes</button>
                  <button type="button" onClick={() => set('free_reduced_lunch', false)} className={yesNoCls(form.free_reduced_lunch, false)}>No</button>
                </div>
              </div>
              {form.free_reduced_lunch && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-brand" checked={form.lunch_provision}
                    onChange={e => set('lunch_provision', e.target.checked)} />
                  <span className="font-sans text-sm text-ink">I would like Steel City Codes to provide lunch for my student.</span>
                </label>
              )}
              <div>
                <label className={labelCls}>How did you hear about Steel City Codes? *</label>
                <select className={inputCls} value={form.how_heard} onChange={e => set('how_heard', e.target.value)}>
                  <option value="">Select…</option>
                  {HOW_HEARD.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Did your student participate in Steel City Codes last year? *</label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => set('previous_program', true)} className={yesNoCls(form.previous_program, true)}>Yes</button>
                  <button type="button" onClick={() => set('previous_program', false)} className={yesNoCls(form.previous_program, false)}>No</button>
                </div>
              </div>
              {form.previous_program === true && (
                <div>
                  <label className={labelCls}>Which program did they take?</label>
                  <select className={inputCls} value={form.program_last_year} onChange={e => set('program_last_year', e.target.value)}>
                    <option value="">Select…</option>
                    {PREVIOUS_PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              )}
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-brand" checked={form.candy_consent}
                  onChange={e => set('candy_consent', e.target.checked)} />
                <span className="font-sans text-sm text-ink">I consent to my student receiving small candy treats during camp activities.</span>
              </label>
            </div>
          )}

          {/* Step 4: Session & class selection */}
          {step === 4 && (
            <div className="space-y-6">
              <h2 className="font-sans font-bold text-lg text-ink">Session &amp; class selection</h2>
              <p className="font-sans text-sm text-ink-muted">Camp is held at Cherry Creek High School, 8:00 AM – 4:00 PM each day.</p>

              {[
                { key: 'session1' as const, classKey: 'class_week1' as const, label: 'Session 1: June 1 – June 5, 2026', week: 1 as const },
                { key: 'session2' as const, classKey: 'class_week2' as const, label: 'Session 2: June 8 – June 12, 2026', week: 2 as const },
              ].map(({ key, classKey, label }) => (
                <div key={key} className={`border rounded-[14px] p-4 transition ${form[key] ? 'border-brand bg-brand-soft' : 'border-border bg-surface'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 accent-brand" checked={form[key]}
                      onChange={e => { set(key, e.target.checked); if (!e.target.checked) set(classKey, '') }} />
                    <span className="font-sans font-semibold text-sm text-ink">{label}</span>
                  </label>
                  {form[key] && (
                    <div className="mt-3">
                      <label className={labelCls}>Class preference *</label>
                      {classNames.length === 0 ? (
                        <p className="font-sans text-xs text-ink-muted">Loading classes…</p>
                      ) : (
                        <div className="space-y-2">
                          {classNames.map(c => (
                            <label key={c} className={`flex items-center gap-3 p-2.5 rounded-[10px] border cursor-pointer transition ${
                              form[classKey] === c ? 'border-brand bg-surface' : 'border-border-strong bg-surface hover:bg-surface-sunken'
                            }`}>
                              <input type="radio" name={classKey} className="w-4 h-4 accent-brand"
                                checked={form[classKey] === c} onChange={() => set(classKey, c)} />
                              <span className="font-sans text-sm text-ink">{c}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Step 5: Waiver */}
          {step === 5 && (
            <div className="space-y-6">
              <h2 className="font-sans font-bold text-lg text-ink">Waiver &amp; consent</h2>

              <div className="bg-surface border border-border rounded-xl p-4 max-h-64 overflow-y-auto space-y-3 text-xs font-sans text-ink-muted leading-relaxed">
                <p className="font-semibold text-ink text-sm">Steel City Codes 2026 Participant Waiver</p>
                <p>This Release and Waiver of Liability releases Steel City Codes ("Nonprofit"), its directors, officers, employees, and agents from any liability arising from your student's participation in the Denver Summer Camp program.</p>
                <p><strong className="text-ink">ASSUMPTION OF RISK:</strong> I acknowledge that participation in the Steel City Codes program involves physical and other risks. I voluntarily assume all risks associated with my student's participation.</p>
                <p><strong className="text-ink">MEDICAL AUTHORIZATION:</strong> I authorize Steel City Codes staff to seek emergency medical treatment for my student if I cannot be reached. I agree to be responsible for any medical costs incurred.</p>
                <p><strong className="text-ink">PHOTO/MEDIA RELEASE:</strong> I grant Steel City Codes the right to use photographs and video taken at camp activities for educational and promotional purposes.</p>
                <p><strong className="text-ink">TECHNOLOGY ADDENDUM:</strong> I understand my student will use computers and technology during camp. I agree to the acceptable use policy for these resources.</p>
                <p><strong className="text-ink">CODE OF CONDUCT:</strong> I agree that my student will follow the Steel City Codes Code of Conduct. Violations may result in dismissal from the program without refund.</p>
                <p>By signing below, I confirm that I have read, understood, and agree to all terms above.</p>
              </div>

              <div>
                <label className={labelCls}>Student / registrant signature *</label>
                <p className="font-sans text-xs text-ink-muted mb-2">Type the student's full legal name as an electronic signature.</p>
                <input type="text" className={inputCls} placeholder={studentFullName || 'Student full name'}
                  value={form.waiver_signature} onChange={e => set('waiver_signature', e.target.value)} />
              </div>

              <div>
                <label className={labelCls}>Parent / guardian signature *</label>
                <p className="font-sans text-xs text-ink-muted mb-2">Type your full legal name to confirm your consent on behalf of your student.</p>
                <input type="text" className={inputCls} placeholder={form.parent_name || 'Parent/guardian full name'}
                  value={form.guardian_signature} onChange={e => set('guardian_signature', e.target.value)} />
              </div>
            </div>
          )}

          {error && (
            <p className="mt-4 text-danger text-sm font-sans flex items-center gap-1.5">⚠ {error}</p>
          )}

          <div className={`mt-8 flex gap-3 ${step > 1 ? 'justify-between' : 'justify-end'}`}>
            {step > 1 && (
              <button type="button" onClick={handleBack}
                className="h-11 px-5 bg-surface border border-border-strong text-ink font-sans font-semibold text-sm rounded-[10px] flex items-center gap-2 hover:bg-surface-sunken transition">
                <ChevronLeft size={16} /> Back
              </button>
            )}
            {step < 5 ? (
              <button type="button" onClick={handleNext}
                className="h-11 px-6 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] flex items-center gap-2 shadow-sm transition">
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button type="submit" disabled={submitting}
                className="h-11 px-6 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] flex items-center gap-2 shadow-sm transition disabled:opacity-50">
                {submitting
                  ? <span className="w-4 h-4 rounded-full border-2 border-brand-on border-t-transparent animate-spin" />
                  : <CheckCircle2 size={16} />}
                {submitting ? 'Submitting…' : 'Submit registration'}
              </button>
            )}
          </div>
        </form>
    </div>
  )
}
