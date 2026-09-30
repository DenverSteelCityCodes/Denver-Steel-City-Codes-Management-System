import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { BrandBar } from '../components/Wordmark'
import { useSessions, activeCampYear, campSessions, formatSessionDates } from '../hooks/useSessions'
import { useFormConfig } from '../hooks/useFormConfig'

const GRADES = ['9th', '10th', '11th', '12th', 'College']
const SCHOOLS = [
  'Cherry Creek High School',
  'Grandview High School',
  'Smoky Hill High School',
  'Eaglecrest High School',
  'Rock Canyon High School',
  'Other',
]
const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const CS_LANGUAGES = ['Python', 'Java', 'HTML', 'CSS', 'JavaScript', 'CircuitPython', 'Other']
const FALLBACK_COURSES = [
  'Intro to Python',
  'Intermediate Python',
  'Intro to Java',
  'Intermediate Java',
  'Web Development',
  'Microcontrollers',
]

interface FormData {
  email: string
  password: string
  firstName: string
  lastName: string
  phone: string
  age: string
  grade: string
  school: string
  schoolOther: string
  shirtSize: string
  availabilityWeek1: boolean
  availabilityWeek2: boolean
  whyVolunteer: string
  previousScc: boolean | null
  csLanguages: string[]
  csClasses: string
  experienceChildren: string
  skillPython: number | null
  skillJava: number | null
  skillHtml: number | null
  skillCss: number | null
  skillJavascript: number | null
  skillMicrocontrollers: number | null
  courseFirst: string
  courseSecond: string
  otherCurricula: string
  volunteerSignature: string
  guardianSignature: string
  interviewConfirmed: boolean
}

const INITIAL: FormData = {
  email: '', password: '', firstName: '', lastName: '', phone: '',
  age: '', grade: '', school: '', schoolOther: '', shirtSize: '',
  availabilityWeek1: false, availabilityWeek2: false,
  whyVolunteer: '', previousScc: null,
  csLanguages: [], csClasses: '', experienceChildren: '',
  skillPython: null, skillJava: null, skillHtml: null,
  skillCss: null, skillJavascript: null, skillMicrocontrollers: null,
  courseFirst: '', courseSecond: '', otherCurricula: '',
  volunteerSignature: '', guardianSignature: '', interviewConfirmed: false,
}

function SkillRating({
  label, value, onChange,
}: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="font-sans text-sm text-ink w-48 shrink-0">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="font-sans text-xs text-ink-faint mr-1">Least</span>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n} type="button"
            onClick={() => onChange(value === n ? null : n)}
            className={`w-8 h-8 rounded-full text-xs font-bold transition border ${
              value === n
                ? 'bg-brand text-brand-on border-brand'
                : 'bg-surface border-border-strong text-ink hover:bg-surface-sunken'
            }`}
          >
            {n}
          </button>
        ))}
        <span className="font-sans text-xs text-ink-faint ml-1">Greatest</span>
      </div>
    </div>
  )
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all ${
            i + 1 === current ? 'w-6 bg-brand' : i + 1 < current ? 'w-2 bg-brand/40' : 'w-2 bg-border-strong'
          }`}
        />
      ))}
    </div>
  )
}

export default function VolunteerApplyPage() {
  const [applicationsOpen, setApplicationsOpen] = useState<boolean | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [courses, setCourses] = useState<string[]>(FALLBACK_COURSES)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>(INITIAL)
  const { sessions } = useSessions()
  const campYear = activeCampYear(sessions)
  const weeks = campSessions(sessions)
  // Labels / visibility / required-ness come from the admin Form editor.
  const { field: q } = useFormConfig('volunteer_application')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'volunteer_applications_open')
      .maybeSingle()
      .then(({ data }) => {
        setApplicationsOpen(data?.value === 'true')
        setSettingsLoading(false)
      })

    supabase
      .from('classes')
      .select('name')
      .order('name', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) setCourses(data.map(c => c.name))
      })
  }, [])

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function toggleLanguage(lang: string) {
    setForm(f => ({
      ...f,
      csLanguages: f.csLanguages.includes(lang)
        ? f.csLanguages.filter(l => l !== lang)
        : [...f.csLanguages, lang],
    }))
  }

  function validateStep(): string | null {
    if (step === 1) {
      if (!form.firstName.trim()) return `${q('firstName').label} is required`
      if (!form.lastName.trim()) return `${q('lastName').label} is required`
      if (!form.email.trim()) return `${q('email').label} is required`
      if (!form.password || form.password.length < 8) return 'Password must be at least 8 characters'
      if (!form.phone.trim()) return `${q('phone').label} is required`
      if (!form.age || isNaN(Number(form.age))) return `${q('age').label} is required`
      if (!form.grade) return `${q('grade').label} is required`
      if (!form.school) return `${q('school').label} is required`
      if (form.school === 'Other' && !form.schoolOther.trim()) return 'Please enter your school name'
      if (!form.shirtSize) return `${q('shirtSize').label} is required`
    }
    if (step === 2) {
      if (!form.availabilityWeek1 && !form.availabilityWeek2) return 'Please select at least one session'
      if (!form.whyVolunteer.trim()) return 'Please tell us why you want to volunteer'
      if (q('previousScc').required && form.previousScc === null) return `Please answer: ${q('previousScc').label}`
      if (q('csLanguages').required && form.csLanguages.length === 0) return `Please answer: ${q('csLanguages').label}`
      if (q('csClasses').required && !form.csClasses.trim()) return `Please answer: ${q('csClasses').label}`
      if (q('experienceChildren').required && !form.experienceChildren.trim()) return `Please answer: ${q('experienceChildren').label}`
    }
    if (step === 3) {
      if (!form.courseFirst) return 'Please select your first choice course'
      if (!form.courseSecond) return 'Please select your second choice course'
      if (q('otherCurricula').required && !form.otherCurricula.trim()) return `Please answer: ${q('otherCurricula').label}`
    }
    if (step === 4) {
      if (!form.volunteerSignature.trim()) return 'Your signature is required'
      if (Number(form.age) < 18 && !form.guardianSignature.trim()) return 'Parent/guardian signature is required for applicants under 18'
      if (!form.interviewConfirmed) return 'Please confirm that you have signed up for an interview slot'
    }
    return null
  }

  function handleNext() {
    const err = validateStep()
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
    const err = validateStep()
    if (err) { setError(err); return }
    setError(null)
    setSubmitting(true)

    // Profile is created server-side by handle_new_user trigger with role: 'volunteer'
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { display_name: `${form.firstName} ${form.lastName}`, role: 'volunteer' } },
    })

    if (signUpError) {
      setError(signUpError.message)
      setSubmitting(false)
      return
    }

    // When email confirmations are enabled, Supabase silently "succeeds" for
    // already-registered emails but returns identities: []. Catch this before
    // attempting the insert to avoid a raw 409 conflict.
    if (authData.user?.identities?.length === 0) {
      setError('An application has already been submitted with this email address. Check your inbox for a confirmation link.')
      setSubmitting(false)
      return
    }

    const schoolName = form.school === 'Other' ? form.schoolOther : form.school

    const { error: insertError } = await supabase.from('volunteer_applications').insert({
      user_id: authData.user?.id ?? null,
      first_name: form.firstName,
      last_name: form.lastName,
      email: form.email,
      phone: form.phone,
      age: Number(form.age),
      grade: form.grade,
      school: schoolName,
      shirt_size: form.shirtSize,
      availability_week_1: form.availabilityWeek1,
      availability_week_2: form.availabilityWeek2,
      why_volunteer: form.whyVolunteer,
      previous_scc_volunteer: q('previousScc').show ? form.previousScc === true : false,
      cs_languages: form.csLanguages,
      cs_classes: form.csClasses || null,
      experience_children: form.experienceChildren || null,
      skill_python: form.skillPython,
      skill_java: form.skillJava,
      skill_html: form.skillHtml,
      skill_css: form.skillCss,
      skill_javascript: form.skillJavascript,
      skill_microcontrollers: form.skillMicrocontrollers,
      course_first_choice: form.courseFirst,
      course_second_choice: form.courseSecond,
      other_curricula: form.otherCurricula || null,
      volunteer_signature: form.volunteerSignature,
      guardian_signature: form.guardianSignature || null,
      interview_confirmed: form.interviewConfirmed,
    })

    if (insertError) {
      const isDuplicate = insertError.code === '23505' || insertError.message?.includes('duplicate')
      setError(
        isDuplicate
          ? 'An application with this email has already been submitted.'
          : 'Something went wrong saving your application. Please try again.'
      )
      setSubmitting(false)
      return
    }

    setSubmitted(true)
  }

  if (settingsLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!applicationsOpen) {
    return (
      <div className="min-h-screen bg-bg flex flex-col">
      <BrandBar />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 text-center">
        <div className="w-14 h-14 rounded-full bg-brand-soft flex items-center justify-center mb-4 mx-auto">
          <ClipboardList size={24} className="text-brand" />
        </div>
        <h1 className="font-sans font-bold text-2xl text-ink mb-2">Applications are closed</h1>
        <p className="font-sans text-ink-muted text-sm max-w-xs">
          Volunteer applications for Denver Steel City Codes are not currently open. Check back later or email{' '}
          <a href="mailto:denver@steelcitycodes.org" className="text-ink font-semibold hover:underline">
            denver@steelcitycodes.org
          </a>{' '}
          with questions.
        </p>
      </main>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-bg flex flex-col">
      <BrandBar />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm bg-surface border border-border rounded-xl shadow-sm p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-success-soft flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-success" />
          </div>
          <h1 className="font-sans font-bold text-2xl text-ink mb-2">Application submitted!</h1>
          <p className="font-sans text-ink-muted text-sm mb-2">
            Thank you, <strong className="text-ink">{form.firstName}</strong>. We've received your application.
          </p>
          <p className="font-sans text-ink-muted text-sm mb-6">
            Check your email for a confirmation link to activate your account. You'll hear back after your interview.
          </p>
          <a
            href="https://www.steelcitycodes.org/camps"
            className="font-sans font-semibold text-sm text-ink hover:underline"
          >
            Visit our website
          </a>
        </div>
      </main>
      </div>
    )
  }

  const inputCls = 'w-full h-11 px-3.5 rounded-[10px] bg-surface border border-border-strong text-ink placeholder:text-ink-faint font-sans text-sm focus:outline-none focus:border-transparent focus:ring-2 focus:ring-brand transition'
  const labelCls = 'block font-sans font-semibold text-sm text-ink mb-1.5'
  const textareaCls = 'w-full px-3.5 py-2.5 rounded-[10px] bg-surface border border-border-strong text-ink placeholder:text-ink-faint font-sans text-sm focus:outline-none focus:border-transparent focus:ring-2 focus:ring-brand transition resize-none'

  // Question label from the Form editor, with the required marker / optional hint.
  const labelText = (key: string, hint?: string) => (
    <>
      {q(key).label}{q(key).required ? ' *' : <span className="font-normal text-ink-muted"> (optional)</span>}
      {hint && <span className="font-normal text-ink-muted"> ({hint})</span>}
    </>
  )

  return (
    <div className="min-h-screen bg-bg pb-16">
      {/* Header */}
      <BrandBar />

      <main className="max-w-lg mx-auto px-4 pt-10">
        <div className="text-center mb-8">
          <h1 className="font-sans font-bold text-2xl text-ink mb-1">{campYear} Volunteer Application</h1>
          <p className="font-sans text-ink-muted text-sm">
            Denver Summer Camp{weeks.length > 0 && <> · {weeks.map(w => formatSessionDates(w, false)).join(' & ')}</>}
          </p>
        </div>

        <StepDots current={step} total={4} />

        <form onSubmit={handleSubmit}>

          {/* ── Step 1: Account & Contact ── */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="font-sans font-bold text-lg text-ink">Account &amp; contact info</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="vol-first" className={labelCls}>{labelText('firstName')}</label>
                  <input id="vol-first" type="text" autoComplete="given-name" className={inputCls} placeholder="Jane" value={form.firstName}
                    onChange={e => set('firstName', e.target.value)} />
                </div>
                <div>
                  <label htmlFor="vol-last" className={labelCls}>{labelText('lastName')}</label>
                  <input id="vol-last" type="text" autoComplete="family-name" className={inputCls} placeholder="Smith" value={form.lastName}
                    onChange={e => set('lastName', e.target.value)} />
                </div>
              </div>

              <div>
                <label htmlFor="vol-email" className={labelCls}>{labelText('email')}</label>
                <input id="vol-email" type="email" autoComplete="email" className={inputCls} placeholder="you@example.com"
                  value={form.email} onChange={e => set('email', e.target.value)} />
              </div>

              <div>
                <label htmlFor="vol-password" className={labelCls}>Password *</label>
                <input id="vol-password" type="password" autoComplete="new-password" className={inputCls} placeholder="8+ characters"
                  minLength={8} value={form.password} onChange={e => set('password', e.target.value)} />
              </div>

              <div>
                <label htmlFor="vol-phone" className={labelCls}>{labelText('phone')}</label>
                <input id="vol-phone" type="tel" autoComplete="tel" className={inputCls} placeholder="123-456-7890"
                  value={form.phone} onChange={e => set('phone', e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="vol-age" className={labelCls}>{labelText('age')}</label>
                  <input id="vol-age" type="number" className={inputCls} placeholder="17" min={14} max={25}
                    value={form.age} onChange={e => set('age', e.target.value)} />
                </div>
                <div>
                  <label htmlFor="vol-shirt" className={labelCls}>{labelText('shirtSize')}</label>
                  <select id="vol-shirt" className={inputCls} value={form.shirtSize} onChange={e => set('shirtSize', e.target.value)}>
                    <option value="">Select…</option>
                    {SHIRT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="vol-grade" className={labelCls}>{labelText('grade')}</label>
                <select id="vol-grade" className={inputCls} value={form.grade} onChange={e => set('grade', e.target.value)}>
                  <option value="">Select…</option>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="vol-school" className={labelCls}>{labelText('school')}</label>
                <select id="vol-school" className={inputCls} value={form.school} onChange={e => set('school', e.target.value)}>
                  <option value="">Select…</option>
                  {SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {form.school === 'Other' && (
                <div>
                  <label htmlFor="vol-school-other" className={labelCls}>School name *</label>
                  <input id="vol-school-other" type="text" className={inputCls} placeholder="Your school"
                    value={form.schoolOther} onChange={e => set('schoolOther', e.target.value)} />
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Availability & Background ── */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="font-sans font-bold text-lg text-ink">Availability &amp; background</h2>

              <div>
                <p id="vol-availability" className={labelCls}>{labelText('availability')}</p>
                <p className="font-sans text-xs text-ink-muted mb-3">Volunteers stay 8:30 AM – 4:30 PM each day at Cherry Creek High School.</p>
                <div role="group" aria-labelledby="vol-availability" className="space-y-2">
                  {[
                    { key: 'availabilityWeek1' as const, session: weeks[0], fallback: 'Session 1' },
                    { key: 'availabilityWeek2' as const, session: weeks[1], fallback: 'Session 2' },
                  ].map(({ key, session, fallback }) => ({
                    key,
                    label: session ? `${session.name}: ${formatSessionDates(session, false)}` : fallback,
                  })).map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-3 p-3 rounded-[10px] border border-border-strong bg-surface cursor-pointer hover:bg-surface-sunken transition">
                      <input type="checkbox" className="w-4 h-4 accent-brand"
                        checked={form[key]} onChange={e => set(key, e.target.checked)} />
                      <span className="font-sans text-sm text-ink">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="vol-why" className={labelCls}>{labelText('whyVolunteer', '2–3 sentences')}</label>
                <textarea id="vol-why" className={textareaCls} rows={4} placeholder="Tell us what motivates you to teach and mentor students…"
                  value={form.whyVolunteer} onChange={e => set('whyVolunteer', e.target.value)} />
              </div>

              {q('previousScc').show && <div>
                <p id="vol-prev" className={labelCls}>{labelText('previousScc')}</p>
                <div role="group" aria-labelledby="vol-prev" className="flex gap-3">
                  {[{ v: true, label: 'Yes' }, { v: false, label: 'No' }].map(({ v, label }) => (
                    <button key={label} type="button"
                      onClick={() => set('previousScc', v)}
                      className={`flex-1 h-11 rounded-[10px] font-sans font-semibold text-sm border transition ${
                        form.previousScc === v
                          ? 'bg-brand text-brand-on border-brand'
                          : 'bg-surface border-border-strong text-ink hover:bg-surface-sunken'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>}

              {q('csLanguages').show && <div>
                <p id="vol-langs" className={labelCls}>{labelText('csLanguages')}</p>
                <div role="group" aria-labelledby="vol-langs" className="flex flex-wrap gap-2 mt-1">
                  {CS_LANGUAGES.map(lang => (
                    <button key={lang} type="button"
                      onClick={() => toggleLanguage(lang)}
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition ${
                        form.csLanguages.includes(lang)
                          ? 'bg-brand text-brand-on border-brand'
                          : 'bg-surface border-border-strong text-ink hover:bg-surface-sunken'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>}

              {q('csClasses').show && <div>
                <label htmlFor="vol-cs-classes" className={labelCls}>{labelText('csClasses')}</label>
                <textarea id="vol-cs-classes" className={textareaCls} rows={3} placeholder="e.g. AP Computer Science A, IB CS, etc."
                  value={form.csClasses} onChange={e => set('csClasses', e.target.value)} />
              </div>}

              {q('experienceChildren').show && <div>
                <label htmlFor="vol-experience" className={labelCls}>{labelText('experienceChildren')}</label>
                <textarea id="vol-experience" className={textareaCls} rows={4} placeholder="List relevant experiences in a few bullet points…"
                  value={form.experienceChildren} onChange={e => set('experienceChildren', e.target.value)} />
              </div>}
            </div>
          )}

          {/* ── Step 3: Skills & Course Preferences ── */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="font-sans font-bold text-lg text-ink">Skills &amp; course preferences</h2>

              {q('skills').show && <div>
                <p className={labelCls}>{q('skills').label} <span className="font-normal text-ink-muted">(leave blank if N/A)</span></p>
                <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
                  <SkillRating label="Python" value={form.skillPython} onChange={v => set('skillPython', v)} />
                  <SkillRating label="Java" value={form.skillJava} onChange={v => set('skillJava', v)} />
                  <SkillRating label="HTML" value={form.skillHtml} onChange={v => set('skillHtml', v)} />
                  <SkillRating label="CSS" value={form.skillCss} onChange={v => set('skillCss', v)} />
                  <SkillRating label="JavaScript" value={form.skillJavascript} onChange={v => set('skillJavascript', v)} />
                  <SkillRating label="Microcontrollers / CircuitPython" value={form.skillMicrocontrollers} onChange={v => set('skillMicrocontrollers', v)} />
                </div>
              </div>}

              <div>
                <p id="vol-course-1" className={labelCls}>{labelText('courseFirst')}</p>
                <div role="radiogroup" aria-labelledby="vol-course-1" className="space-y-2">
                  {courses.map(c => (
                    <label key={c} className={`flex items-center gap-3 p-3 rounded-[10px] border cursor-pointer transition ${
                      form.courseFirst === c ? 'border-brand bg-brand-soft' : 'border-border-strong bg-surface hover:bg-surface-sunken'
                    }`}>
                      <input type="radio" name="courseFirst" className="w-4 h-4 accent-brand"
                        checked={form.courseFirst === c} onChange={() => set('courseFirst', c)} />
                      <span className="font-sans text-sm text-ink">{c}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p id="vol-course-2" className={labelCls}>{labelText('courseSecond')}</p>
                <div role="radiogroup" aria-labelledby="vol-course-2" className="space-y-2">
                  {courses.map(c => (
                    <label key={c} className={`flex items-center gap-3 p-3 rounded-[10px] border cursor-pointer transition ${
                      form.courseSecond === c ? 'border-brand bg-brand-soft' : 'border-border-strong bg-surface hover:bg-surface-sunken'
                    }`}>
                      <input type="radio" name="courseSecond" className="w-4 h-4 accent-brand"
                        checked={form.courseSecond === c} onChange={() => set('courseSecond', c)} />
                      <span className="font-sans text-sm text-ink">{c}</span>
                    </label>
                  ))}
                </div>
              </div>

              {q('otherCurricula').show && <div>
                <label htmlFor="vol-other" className={labelCls}>{labelText('otherCurricula')}</label>
                <textarea id="vol-other" className={textareaCls} rows={3} placeholder="e.g. Game Development, Processing Graphics, Greenfoot…"
                  value={form.otherCurricula} onChange={e => set('otherCurricula', e.target.value)} />
              </div>}
            </div>
          )}

          {/* ── Step 4: Waiver & Submit ── */}
          {step === 4 && (
            <div className="space-y-6">
              <h2 className="font-sans font-bold text-lg text-ink">Waiver &amp; submit</h2>

              <div className="bg-surface border border-border rounded-xl p-4 max-h-64 overflow-y-auto space-y-3 text-xs font-sans text-ink-muted leading-relaxed">
                <p className="font-semibold text-ink text-sm">Waiver &amp; Release of Liability</p>
                <p>This Release and Waiver of Liability (the "Release") releases Steel City Codes ("Nonprofit"), a nonprofit corporation organized and existing under the laws of the State of Colorado, and each of its directors, officers, employees, and agents.</p>
                <p><strong className="text-ink">1) WAIVER &amp; RELEASE:</strong> I, the Volunteer, release and forever discharge and hold harmless Steel City Codes and its successors and assigns from any and all liability, claims, and demands of whatever kind or nature, either in law or in equity, which arise or may hereafter arise from the services I provide to Steel City Codes. I understand and acknowledge that this Release discharges Steel City Codes from any liability or claim that I may have against Steel City Codes with respect to bodily injury, personal injury, illness, death, or property damage that may result from the services I provide.</p>
                <p><strong className="text-ink">2) INSURANCE:</strong> I understand that Steel City Codes does not assume any responsibility for or obligation to provide me with financial or other assistance, including but not limited to medical, health, or disability benefits or insurance.</p>
                <p><strong className="text-ink">3) MEDICAL TREATMENT:</strong> I hereby Release and forever discharge Steel City Codes from any claim whatsoever which arises or may hereafter arise on account of any first-aid treatment or other medical services rendered in connection with an emergency during my tenure as a volunteer.</p>
                <p><strong className="text-ink">4) ASSUMPTION OF RISK:</strong> I understand that the services I provide to Steel City Codes may include activities that may be hazardous to me. As a volunteer, I hereby expressly assume risk of injury or harm from these activities.</p>
                <p><strong className="text-ink">5) PHOTOGRAPHIC RELEASE:</strong> I grant and convey to Steel City Codes all right, title, and interests in any photographs, images, video, or audio recordings of me made in connection with my providing volunteer services.</p>
                <p><strong className="text-ink">6) OTHER:</strong> I expressly agree that this Release is intended to be as broad and inclusive as permitted by the laws of the State of Colorado and shall be governed by and interpreted in accordance with the laws of the State of Colorado.</p>
              </div>

              <div>
                <label htmlFor="vol-signature" className={labelCls}>{labelText('volunteerSignature')}</label>
                <p className="font-sans text-xs text-ink-muted mb-2">Type your full legal name. This serves as your electronic signature and has the same binding effect as a handwritten signature.</p>
                <input id="vol-signature" type="text" className={inputCls} placeholder="Jane Smith"
                  value={form.volunteerSignature} onChange={e => set('volunteerSignature', e.target.value)} />
              </div>

              {Number(form.age) < 18 && (
                <div>
                  <label htmlFor="vol-guardian" className={labelCls}>{q('guardianSignature').label} *</label>
                  <p className="font-sans text-xs text-ink-muted mb-2">Required for applicants under 18. Parent or guardian must type their full name.</p>
                  <input id="vol-guardian" type="text" className={inputCls} placeholder="Parent Name"
                    value={form.guardianSignature} onChange={e => set('guardianSignature', e.target.value)} />
                </div>
              )}

              <div className="bg-surface-sunken border border-border rounded-xl p-4 space-y-3">
                <p className="font-sans font-semibold text-sm text-ink">Interview requirement</p>
                <p className="font-sans text-xs text-ink-muted">
                  Before submitting, you must sign up for a follow-up interview. Interviews are held online and take approximately 15 minutes. Sign up at:{' '}
                  <a
                    href="https://www.signupgenius.com/go/10C0B4EADAE2BA2FAC34-61881283-sccvolunteer"
                    target="_blank" rel="noreferrer"
                    className="text-brand hover:underline break-all"
                  >
                    SignUpGenius
                  </a>
                </p>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 mt-0.5 accent-brand"
                    checked={form.interviewConfirmed} onChange={e => set('interviewConfirmed', e.target.checked)} />
                  <span className="font-sans text-sm text-ink">
                    I confirm that I have signed up for an interview slot on SignUpGenius.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p role="alert" className="mt-4 text-danger text-sm font-sans flex items-center gap-1.5">
              <span>⚠</span> {error}
            </p>
          )}

          {/* Navigation */}
          <div className={`mt-8 flex gap-3 ${step > 1 ? 'justify-between' : 'justify-end'}`}>
            {step > 1 && (
              <button type="button" onClick={handleBack}
                className="h-11 px-5 bg-surface border border-border-strong text-ink font-sans font-semibold text-sm rounded-[10px] flex items-center gap-2 hover:bg-surface-sunken transition"
              >
                <ChevronLeft size={16} /> Back
              </button>
            )}
            {step < 4 ? (
              <button type="button" onClick={handleNext}
                className="h-11 px-6 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] flex items-center gap-2 shadow-sm transition"
              >
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button type="submit" disabled={submitting}
                className="h-11 px-6 bg-brand hover:bg-brand-hover text-brand-on font-sans font-semibold text-sm rounded-[10px] flex items-center gap-2 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting
                  ? <span className="w-4 h-4 rounded-full border-2 border-brand-on border-t-transparent animate-spin" />
                  : <CheckCircle2 size={16} />}
                {submitting ? 'Submitting…' : 'Submit application'}
              </button>
            )}
          </div>

          <p className="mt-6 text-center text-xs font-sans text-ink-faint">
            Already have an account?{' '}
            <Link to="/login" className="text-ink-muted hover:underline">Sign in</Link>
          </p>
        </form>
      </main>
    </div>
  )
}
