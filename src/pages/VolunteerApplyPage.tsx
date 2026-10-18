import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CircleAlert, FilePenLine } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useSessions, activeCampYear, campSessions } from '../hooks/useSessions'
import type { Session } from '../hooks/useSessions'
import { useFormConfig } from '../hooks/useFormConfig'
import { useOpenInterviewSlots } from '../hooks/useOpenInterviewSlots'
import InterviewSlotPicker from '../components/InterviewSlotPicker'
import Button from '../components/Button'
import { Input, Select, Textarea } from '../components/Field'
import SignBand from '../components/SignBand'
import PublicShell, { AsideLine, ContactLink, PageHead } from '../components/PublicShell'
import { ChoiceRow, FieldError, FormError, FormField, PasswordInput, Spinner } from '../components/PublicForm'
import type { FieldA11y } from '../components/PublicForm'
import {
  CS_LANGUAGES, FALLBACK_COURSES, GRADES, INITIAL_FORM, MIN_AGE, SCHOOLS, SHIRT_SIZES, SKILLS, STEPS, STEP_COUNT,
  applicationRow, needsGuardian, secondChoices, validateStep,
} from '../lib/applyForm'
import type { ApplyForm } from '../lib/applyForm'
import { GENERIC_ERROR, authErrorMessage, classifyAuthError, isExistingAccount } from '../lib/authErrors'
import { CAMP_SITE } from '../lib/campSite'
import { CAMP_TIME_ZONE, formatCampTime } from '../lib/denverTime'
import { focusOnMount } from '../lib/focus'
import { buttonClass } from '../lib/ui'

// Short names for the "answers need attention" line under each step.
const SHORT: Record<string, string> = {
  firstName: 'First name', lastName: 'Last name', age: 'Age', grade: 'Grade', school: 'School', schoolOther: 'School name',
  email: 'Email', phone: 'Phone', password: 'Password', availability: 'Weeks', shirtSize: 'T-shirt size',
  whyVolunteer: 'Why you want to volunteer', previousScc: 'Volunteered before', csLanguages: 'Languages',
  csClasses: 'Classes taken', experienceChildren: 'Experience', courseFirst: 'First choice', courseSecond: 'Second choice',
  otherCurricula: 'Other classes', volunteerSignature: 'Your signature', guardianSignature: 'Guardian signature',
  interviewSlotId: 'Interview time',
}

// "Oct 19–23", or "Jun 29 – Jul 3" across a month.
function shortDates(s: Session) {
  const a = new Date(s.start_date + 'T12:00:00'), b = new Date(s.end_date + 'T12:00:00')
  const m = (d: Date) => d.toLocaleDateString('en-US', { month: 'short' })
  return a.getMonth() === b.getMonth() ? `${m(a)} ${a.getDate()}–${b.getDate()}` : `${m(a)} ${a.getDate()} – ${m(b)} ${b.getDate()}`
}

const longDay = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: CAMP_TIME_ZONE, weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(iso))

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// The first control inside a field, so a failed step can put focus on what needs fixing.
function focusField(key: string) {
  document.querySelector(`[data-field="${key}"]`)?.querySelector<HTMLElement>('input, select, textarea, [role="radio"]')?.focus()
}

function Subhead({ id, children }: { id?: string; children: ReactNode }) {
  return <h3 id={id} className="mt-10 mb-3 text-lg font-bold">{children}</h3>
}

// A group of real radios or checkboxes with its question, hint and error (DESIGN.md › Choice rows).
function ChoiceGroup({ field, legend, hint, error, children }: {
  field: string
  legend: ReactNode
  hint?: ReactNode
  error?: string
  children: (a11y: Pick<FieldA11y, 'aria-describedby' | 'aria-invalid'>) => ReactNode
}) {
  const hintId = hint ? `${field}-hint` : undefined
  const errorId = error ? `${field}-err` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <fieldset data-field={field} aria-describedby={describedBy} className="min-w-0">
      <legend className="mb-2 font-bold">{legend}</legend>
      {hint && <p id={hintId} className="-mt-1 mb-3 text-sm text-ink-muted text-pretty">{hint}</p>}
      {children({ 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {error && <div className="mt-2"><FieldError id={errorId}>{error}</FieldError></div>}
    </fieldset>
  )
}

// The application's sign: on step 1 it carries the commitment (where, when, which weeks), then
// it slims to the step label and the rail. The step label is the step's heading and takes focus
// when the step changes.
function StepSign({ step, headingRef, commitment }: {
  step: number
  headingRef: React.RefObject<HTMLHeadingElement | null>
  commitment?: { message: string; sub: string }
}) {
  return (
    <section aria-labelledby="step-h" className="grid gap-y-1 rounded bg-brand text-brand-on p-4">
      {commitment && (
        <>
          <p className="text-[1.375rem] font-extrabold leading-[1.15] text-balance">{commitment.message}</p>
          <p className="mt-1 text-brand-on-muted text-pretty">{commitment.sub}</p>
        </>
      )}
      <h2 id="step-h" ref={headingRef} tabIndex={-1} className={`${commitment ? 'mt-3 ' : ''}text-lg font-extrabold leading-snug focus:outline-none`}>
        Step {step} of {STEP_COUNT} · {STEPS[step - 1]}
      </h2>
      <div aria-hidden="true" className="mt-2 grid grid-flow-col gap-1">
        {STEPS.map((name, i) => <span key={name} className={`h-1.5 rounded-[1px] ${i < step ? 'bg-brand-on' : 'bg-brand-on/20'}`} />)}
      </div>
    </section>
  )
}

// 1–5 on real radios: one joined, full-width control per skill. Fits 320px.
function SkillScale({ name, label, value, onChange }: { name: string; label: string; value: number | null; onChange: (v: number | null) => void }) {
  const firstRef = useRef<HTMLInputElement>(null)
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{label}</legend>
      {/* The visible name shares its row with Clear, which a legend can't hold without renaming the group. */}
      <div className="flex items-center justify-between gap-3 min-h-11">
        <span aria-hidden="true" className="font-bold">{label}</span>
        {value !== null && (
          <button
            type="button"
            onClick={() => { onChange(null); firstRef.current?.focus() }}
            className={buttonClass('text', 'font-semibold text-ink-muted hover:text-ink')}
          >
            Clear<span className="sr-only"> {label} rating</span>
          </button>
        )}
      </div>
      <div className="mt-1 grid grid-cols-5 gap-[2px] bg-ink border-2 border-ink rounded overflow-hidden">
        {[1, 2, 3, 4, 5].map(n => (
          <label
            key={n}
            className="relative grid place-items-center min-h-11 bg-surface font-bold cursor-pointer has-checked:bg-shell has-checked:text-on-shell dark:has-checked:bg-ink dark:has-checked:text-bg has-focus-visible:z-10 has-focus-visible:outline-2 has-focus-visible:outline-current has-focus-visible:-outline-offset-[6px]"
          >
            <input
              ref={n === 1 ? firstRef : undefined}
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="absolute inset-0 w-full h-full m-0 opacity-0 cursor-pointer"
            />
            {n}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

type Load = 'loading' | 'open' | 'closed' | 'error'
type FormFailure = { message: string; recovery?: 'existing' | 'duplicate' }

export default function VolunteerApplyPage() {
  const [load, setLoad] = useState<Load>('loading')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [courses, setCourses] = useState<string[]>(FALLBACK_COURSES)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<ApplyForm>(INITIAL_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState<FormFailure | null>(null)
  const { sessions } = useSessions()
  const campYear = activeCampYear(sessions)
  const weeks = campSessions(sessions)
  // Labels / visibility / required-ness come from the admin Form editor.
  const { field: q } = useFormConfig('volunteer_application')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  // Interview times are booked in-app (SignUpGenius-style) as the last step.
  const { slots: openSlots, error: slotsError, refetch: refetchSlots } = useOpenInterviewSlots()
  // Set once the account + application are saved, so a failed booking can be retried alone.
  const [applicationSaved, setApplicationSaved] = useState(false)
  const [booked, setBooked] = useState<{ time: string; minutes: number | null } | null>(null)
  // The account signUp created in this page session. If the application insert then fails, a
  // retry reuses it — calling signUp again would fail with "already registered" and strand them.
  const [createdAccount, setCreatedAccount] = useState<{ email: string; userId: string | null } | null>(null)

  // Focus follows the work: the new step's heading after Next/Back, the first field to fix after
  // a step that didn't pass.
  const stepHeadingRef = useRef<HTMLHeadingElement>(null)
  const pendingFocus = useRef<'step' | string | null>(null)
  useEffect(() => {
    const target = pendingFocus.current
    if (!target) return
    pendingFocus.current = null
    if (target === 'step') stepHeadingRef.current?.focus({ preventScroll: true })
    else focusField(target)
  }, [step, errors])

  useEffect(() => {
    let cancelled = false
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'volunteer_applications_open')
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setLoad('error')
        else setLoad(data?.value === 'true' ? 'open' : 'closed')
      })

    supabase
      .from('classes')
      .select('name')
      .order('name', { ascending: true })
      .then(({ data }) => {
        if (!cancelled && data && data.length > 0) setCourses(data.map(c => c.name))
      })
    return () => { cancelled = true }
  }, [loadAttempt])

  function set<K extends keyof ApplyForm>(key: K, value: ApplyForm[K]) {
    setForm(f => ({ ...f, [key]: value }))
    // An answer being fixed loses its error as soon as it changes.
    setErrors(e => {
      if (!(key in e)) return e
      const next = { ...e }
      delete next[key]
      return next
    })
  }

  function setFirstChoice(course: string) {
    setForm(f => ({ ...f, courseFirst: course, courseSecond: f.courseSecond === course ? '' : f.courseSecond }))
    setErrors(e => {
      const next = { ...e }
      delete next.courseFirst
      return next
    })
  }

  function toggleLanguage(lang: string) {
    set('csLanguages', form.csLanguages.includes(lang) ? form.csLanguages.filter(l => l !== lang) : [...form.csLanguages, lang])
  }

  const activeWeeks = weeks.filter(w => w.is_active)
  const slotMinutes = openSlots && openSlots.length > 0 && openSlots.every(s => s.duration_minutes === openSlots[0].duration_minutes)
    ? openSlots[0].duration_minutes
    : null
  const hasSlots = !!openSlots && openSlots.length > 0

  function goTo(next: number) {
    setErrors({})
    setFailure(null)
    pendingFocus.current = 'step'
    setStep(next)
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' })
  }

  function showErrors(errs: Record<string, string>) {
    pendingFocus.current = Object.keys(errs)[0] ?? null
    setErrors(errs)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    const errs = validateStep(step, form, q, { hasSlots, weekCount: activeWeeks.length || 2 })
    if (Object.keys(errs).length > 0) { showErrors(errs); return }
    if (step < STEP_COUNT) { goTo(step + 1); return }
    await send()
  }

  async function send() {
    setFailure(null)
    setSubmitting(true)

    if (!applicationSaved) {
      let userId: string | null
      if (createdAccount && createdAccount.email === form.email) {
        userId = createdAccount.userId
      } else {
        // Profile is created server-side by handle_new_user trigger with role: 'volunteer'
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            data: { display_name: `${form.firstName} ${form.lastName}`, role: 'volunteer' },
            emailRedirectTo: `${window.location.origin}/login`,
          },
        })

        // An existing account (a parent, or an earlier applicant) with this email. It says nothing
        // about an application existing.
        if (isExistingAccount(authData?.user, signUpError)) {
          setFailure({
            message: "There's already an account with this email. If you applied before, sign in to check on it. Otherwise, use a different email.",
            recovery: 'existing',
          })
          setSubmitting(false)
          return
        }
        if (signUpError) {
          const kind = classifyAuthError(signUpError)
          setSubmitting(false)
          if (kind === 'weak-password' || kind === 'breached-password') {
            // The password lives on step 1: go back there and say what's wrong with it.
            pendingFocus.current = 'password'
            setStep(1)
            setErrors({ password: authErrorMessage(signUpError) })
            return
          }
          setFailure({ message: authErrorMessage(signUpError) })
          return
        }
        userId = authData.user?.id ?? null
        setCreatedAccount({ email: form.email, userId })
      }

      const { error: insertError } = await supabase.from('volunteer_applications').insert(applicationRow(form, userId, q('previousScc').show))

      if (insertError) {
        const isDuplicate = insertError.code === '23505' || insertError.message?.includes('duplicate')
        setFailure(isDuplicate
          ? { message: 'An application with this email has already been sent. Sign in to check on it.', recovery: 'duplicate' }
          : { message: GENERIC_ERROR })
        setSubmitting(false)
        return
      }

      setApplicationSaved(true)
    }

    if (form.interviewSlotId) {
      const slot = openSlots?.find(s => s.id === form.interviewSlotId)
      const { data: slotTime, error: bookError } = await supabase.rpc('book_my_interview', {
        p_slot_id: form.interviewSlotId,
        p_email: form.email.trim(),
      })
      if (bookError) {
        setFailure({ message: "Your application is saved, but we couldn't book that time. Someone may have just taken it: pick another time below." })
        set('interviewSlotId', '')
        refetchSlots()
        setSubmitting(false)
        return
      }
      setBooked({ time: slotTime as string, minutes: slot?.duration_minutes ?? null })
    }

    setSubmitted(true)
  }

  function switchEmail() {
    setFailure(null)
    pendingFocus.current = 'email'
    setStep(1)
    setErrors({ email: 'Use a different email, or sign in if you applied before.' })
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' })
  }

  const title = `Volunteer application, ${campYear}`

  if (load === 'loading') {
    return (
      <PublicShell>
        <div role="status" aria-label="Loading the application" className="animate-pulse">
          <div className="h-8 w-3/4 max-w-sm rounded bg-surface-sunken" />
          <div className="mt-5 h-36 rounded bg-surface-sunken" />
          <div className="mt-8 h-12 rounded bg-surface-sunken" />
        </div>
      </PublicShell>
    )
  }

  if (load === 'error') {
    return (
      <PublicShell>
        <PageHead title={title} lede="We couldn't load the application. Check your connection and try again." ledeRole="alert" />
        <Button variant="primary" onClick={() => { setLoad('loading'); setLoadAttempt(a => a + 1) }}>Try again</Button>
      </PublicShell>
    )
  }

  if (load === 'closed') {
    return (
      <PublicShell footer={false}>
        <PageHead title="Applications are closed" lede="Volunteer applications aren't open right now. Check back later." />
        <p>Questions about volunteering? Email <ContactLink /></p>
        <div className="mt-6">
          <AsideLine>Already applied? <Link to="/login" className={buttonClass('text')}>Sign in</Link></AsideLine>
          <AsideLine>Registering a camper? <Link to="/signup" className={buttonClass('text')}>Create a parent account</Link></AsideLine>
        </div>
      </PublicShell>
    )
  }

  if (submitted) {
    const [clock, meridiem] = booked ? formatCampTime(booked.time).split(/\s+/) : []
    const steps: { what: string; why: ReactNode }[] = [
      { what: 'Confirm your email', why: <>Open the link we sent to <strong className="text-ink [overflow-wrap:anywhere]">{form.email.trim()}</strong>. You need it to sign in.</> },
      booked
        ? { what: 'Sign in to see your interview', why: 'Your dashboard shows the time and lets you pick another one.' }
        : { what: 'Pick an interview time', why: 'Sign in once times are posted and choose one from your dashboard.' },
      { what: 'Hear back after your interview', why: "We'll email you after your interview." },
    ]
    return (
      <PublicShell>
        <PageHead title="Application sent" lede={`Thanks, ${form.firstName.trim()}. Here's what happens next.`} headingRef={focusOnMount} />
        {booked && (
          <SignBand
            context={`Interview booked · online${booked.minutes ? ` · ${booked.minutes} minutes` : ''} · Denver time`}
            figure={clock}
            unit={meridiem}
            message={longDay(booked.time)}
            sub="You can change the time from your dashboard once you sign in."
          />
        )}
        <ol aria-label="Next steps" className={`${booked ? 'mt-8 ' : ''}border-b-2 border-ink`}>
          {steps.map((s, i) => (
            <li key={s.what} className="grid grid-cols-[40px_1fr] gap-x-4 py-4 border-t-2 border-ink">
              <span aria-hidden="true" className="w-10 h-10 grid place-items-center border-2 border-ink rounded text-lg font-extrabold leading-none">{i + 1}</span>
              <div className="min-w-0">
                <p className="text-lg font-bold leading-snug text-pretty">{s.what}</p>
                <p className="mt-1 text-ink-muted text-pretty">{s.why}</p>
              </div>
            </li>
          ))}
        </ol>
        <Link to="/login" className={buttonClass(booked ? 'ink' : 'primary', 'mt-8', true)}>Go to sign in</Link>
      </PublicShell>
    )
  }

  const errorKeys = Object.keys(errors)
  const commitment = step === 1
    ? {
        message: `${CAMP_SITE}, 8:30 AM–4:30 PM each day`,
        sub: [
          activeWeeks.length > 0
            ? `${activeWeeks.map(w => `${w.name} (${shortDates(w)})`).join(', ')}${activeWeeks.length > 1 ? ' or both' : ''}, plus`
            : 'Plus',
          slotMinutes ? `a ${slotMinutes}\u2011minute online interview.` : 'a short online interview.',
        ].join(' '),
      }
    : undefined

  // Questions whose wording the admin sets in the Form editor; "(optional)" when it isn't required.
  const label = (key: string) => q(key).label
  const optional = (key: string) => !q(key).required

  return (
    <PublicShell>
      <PageHead
        title={title}
        lede={step === 1 ? <>Already applied? <Link to="/login" className={buttonClass('text')}>Sign in</Link></> : undefined}
      />
      <StepSign step={step} headingRef={stepHeadingRef} commitment={commitment} />

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
        {step === 1 && (
          <>
            <div className="grid gap-5 min-[480px]:grid-cols-2">
              <div data-field="firstName">
                <FormField id="vol-first" label={label('firstName')} error={errors.firstName}>
                  {a => <Input {...a} type="text" autoComplete="given-name" value={form.firstName} onChange={e => set('firstName', e.target.value)} />}
                </FormField>
              </div>
              <div data-field="lastName">
                <FormField id="vol-last" label={label('lastName')} error={errors.lastName}>
                  {a => <Input {...a} type="text" autoComplete="family-name" value={form.lastName} onChange={e => set('lastName', e.target.value)} />}
                </FormField>
              </div>
            </div>
            <div className="grid gap-5 min-[480px]:grid-cols-2">
              <div data-field="age">
                <FormField id="vol-age" label={label('age')} hint={`Volunteers are ${MIN_AGE} or older`} error={errors.age}>
                  {a => <Input {...a} type="text" inputMode="numeric" autoComplete="off" maxLength={3} value={form.age} onChange={e => set('age', e.target.value)} />}
                </FormField>
              </div>
              <div data-field="grade">
                <FormField id="vol-grade" label={label('grade')} hint="This school year" error={errors.grade}>
                  {a => (
                    <Select {...a} value={form.grade} onChange={e => set('grade', e.target.value)}>
                      <option value="">Choose…</option>
                      {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                    </Select>
                  )}
                </FormField>
              </div>
            </div>
            <div data-field="school">
              <FormField id="vol-school" label={label('school')} error={errors.school}>
                {a => (
                  <Select {...a} value={form.school} onChange={e => set('school', e.target.value)}>
                    <option value="">Choose…</option>
                    {SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
                  </Select>
                )}
              </FormField>
            </div>
            {form.school === 'Other' && (
              <div data-field="schoolOther">
                <FormField id="vol-school-other" label="School name" error={errors.schoolOther}>
                  {a => <Input {...a} type="text" value={form.schoolOther} onChange={e => set('schoolOther', e.target.value)} />}
                </FormField>
              </div>
            )}

            <Subhead>Contact</Subhead>
            <div data-field="email">
              <FormField id="vol-email" label={label('email')} error={errors.email}>
                {a => <Input {...a} type="email" autoComplete="email" inputMode="email" value={form.email} onChange={e => set('email', e.target.value)} />}
              </FormField>
            </div>
            <div data-field="phone">
              <FormField id="vol-phone" label={label('phone')} error={errors.phone}>
                {a => <Input {...a} type="tel" autoComplete="tel" inputMode="tel" placeholder="123-456-7890" value={form.phone} onChange={e => set('phone', e.target.value)} />}
              </FormField>
            </div>

            <Subhead>Create a password</Subhead>
            <div data-field="password">
              <FormField id="vol-password" label="Password" hint="At least 8 characters. You'll use it to check your application and interview time." error={errors.password}>
                {a => <PasswordInput {...a} autoComplete="new-password" value={form.password} onChange={e => set('password', e.target.value)} />}
              </FormField>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <ChoiceGroup field="availability" legend={label('availability')} hint={activeWeeks.length > 1 ? 'Pick one or both.' : undefined} error={errors.availability}>
              {a => (
                <div className="grid gap-2 min-[480px]:grid-cols-2">
                  {[
                    { key: 'availabilityWeek1' as const, session: weeks[0], fallback: 'Session 1' },
                    { key: 'availabilityWeek2' as const, session: weeks[1], fallback: 'Session 2' },
                  ].filter(({ session }) => !session || session.is_active).map(({ key, session, fallback }) => (
                    <ChoiceRow key={key} type="checkbox" {...a} checked={form[key]} onChange={e => set(key, e.target.checked)}>
                      <span className="block font-bold">{session ? session.name : fallback}</span>
                      {session && <span className="block text-sm text-ink-muted">{shortDates(session)}</span>}
                    </ChoiceRow>
                  ))}
                </div>
              )}
            </ChoiceGroup>
            <div data-field="shirtSize">
              <FormField id="vol-shirt" label={label('shirtSize')} error={errors.shirtSize}>
                {a => (
                  <Select {...a} value={form.shirtSize} onChange={e => set('shirtSize', e.target.value)}>
                    <option value="">Choose…</option>
                    {SHIRT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </Select>
                )}
              </FormField>
            </div>
            <div data-field="whyVolunteer">
              <FormField id="vol-why" label={label('whyVolunteer')} hint="2–3 sentences" error={errors.whyVolunteer}>
                {a => <Textarea {...a} rows={4} value={form.whyVolunteer} onChange={e => set('whyVolunteer', e.target.value)} />}
              </FormField>
            </div>
            {q('previousScc').show && (
              <ChoiceGroup field="previousScc" legend={<>{label('previousScc')}{optional('previousScc') && <span className="font-normal text-ink-muted"> (optional)</span>}</>} error={errors.previousScc}>
                {a => (
                  <div className="grid gap-2 grid-cols-2">
                    {[{ v: true, text: 'Yes' }, { v: false, text: 'No' }].map(({ v, text }) => (
                      <ChoiceRow key={text} type="radio" name="previousScc" value={text} {...a} checked={form.previousScc === v} onChange={() => set('previousScc', v)}>{text}</ChoiceRow>
                    ))}
                  </div>
                )}
              </ChoiceGroup>
            )}
          </>
        )}

        {step === 3 && (
          <>
            {q('csLanguages').show && (
              <ChoiceGroup
                field="csLanguages"
                legend={<>{label('csLanguages')}{optional('csLanguages') && <span className="font-normal text-ink-muted"> (optional)</span>}</>}
                hint={q('csLanguages').required ? "Pick every one you've used." : 'Pick any. New to coding? Leave them all empty.'}
                error={errors.csLanguages}
              >
                {a => (
                  <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))]">
                    {CS_LANGUAGES.map(lang => (
                      <ChoiceRow key={lang} type="checkbox" {...a} className="min-h-11 px-3 py-1" checked={form.csLanguages.includes(lang)} onChange={() => toggleLanguage(lang)}>{lang}</ChoiceRow>
                    ))}
                  </div>
                )}
              </ChoiceGroup>
            )}
            {q('csClasses').show && (
              <div data-field="csClasses">
                <FormField id="vol-cs-classes" label={label('csClasses')} optional={optional('csClasses')} hint="For example: AP Computer Science A." error={errors.csClasses}>
                  {a => <Textarea {...a} rows={2} className="min-h-20" value={form.csClasses} onChange={e => set('csClasses', e.target.value)} />}
                </FormField>
              </div>
            )}
            {q('experienceChildren').show && (
              <div data-field="experienceChildren">
                <FormField id="vol-experience" label={label('experienceChildren')} optional={optional('experienceChildren')} hint="A few short lines is plenty." error={errors.experienceChildren}>
                  {a => <Textarea {...a} rows={3} value={form.experienceChildren} onChange={e => set('experienceChildren', e.target.value)} />}
                </FormField>
              </div>
            )}

            {q('skills').show && (
              <section aria-labelledby="skills-h">
                <Subhead id="skills-h">{label('skills')}</Subhead>
                <p id="skills-hint" className="text-sm text-ink-muted text-pretty">1 = just starting · 5 = could teach it. Skip any you haven't used.</p>
                <ul className="mt-1">
                  {SKILLS.map(s => (
                    <li key={s.key} className="pt-3 pb-4 border-t border-border first:border-t-0">
                      <SkillScale name={s.key} label={s.label} value={form[s.key]} onChange={v => set(s.key, v)} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <Subhead>Which class would you like to teach?</Subhead>
            <ChoiceGroup field="courseFirst" legend={label('courseFirst')} error={errors.courseFirst}>
              {a => (
                <div className="grid gap-2 min-[480px]:grid-cols-2">
                  {courses.map(c => (
                    <ChoiceRow key={c} type="radio" name="courseFirst" value={c} {...a} checked={form.courseFirst === c} onChange={() => setFirstChoice(c)}>{c}</ChoiceRow>
                  ))}
                </div>
              )}
            </ChoiceGroup>
            <ChoiceGroup field="courseSecond" legend={label('courseSecond')} hint="Different from your first choice." error={errors.courseSecond}>
              {a => (
                <div className="grid gap-2 min-[480px]:grid-cols-2">
                  {secondChoices(courses, form.courseFirst).map(c => (
                    <ChoiceRow key={c} type="radio" name="courseSecond" value={c} {...a} checked={form.courseSecond === c} onChange={() => set('courseSecond', c)}>{c}</ChoiceRow>
                  ))}
                </div>
              )}
            </ChoiceGroup>
            {q('otherCurricula').show && (
              <div data-field="otherCurricula">
                <FormField id="vol-other" label={label('otherCurricula')} optional={optional('otherCurricula')} hint="For example: game development, Processing, Greenfoot." error={errors.otherCurricula}>
                  {a => <Textarea {...a} rows={2} className="min-h-20" value={form.otherCurricula} onChange={e => set('otherCurricula', e.target.value)} />}
                </FormField>
              </div>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <section aria-labelledby="waiver-h" className="max-w-[65ch]">
              <h3 id="waiver-h" className="text-lg font-bold">Volunteer waiver and release</h3>
              {/* A dashed frame means "not final" (DESIGN.md › Shapes). */}
              <p className="mt-3 flex items-start gap-3 px-4 py-3 border-2 border-dashed border-ink rounded">
                <FilePenLine size={20} strokeWidth={2.25} aria-hidden="true" className="shrink-0 mt-0.5" />
                <span><b>Placeholder text.</b> Steel City Codes national's official volunteer waiver replaces this section before applications open.</span>
              </p>
              <div className="mt-4 space-y-3 text-pretty">
                <p>This Release and Waiver of Liability (the "Release") releases Steel City Codes ("Nonprofit"), a nonprofit corporation organized and existing under the laws of the State of Colorado, and each of its directors, officers, employees, and agents.</p>
                <p><b>Waiver and release.</b> I, the Volunteer, release and forever discharge and hold harmless Steel City Codes and its successors and assigns from any and all liability, claims, and demands of whatever kind or nature, either in law or in equity, which arise or may hereafter arise from the services I provide to Steel City Codes. I understand and acknowledge that this Release discharges Steel City Codes from any liability or claim that I may have against Steel City Codes with respect to bodily injury, personal injury, illness, death, or property damage that may result from the services I provide.</p>
                <p><b>Insurance.</b> I understand that Steel City Codes does not assume any responsibility for or obligation to provide me with financial or other assistance, including but not limited to medical, health, or disability benefits or insurance.</p>
                <p><b>Medical treatment.</b> I hereby Release and forever discharge Steel City Codes from any claim whatsoever which arises or may hereafter arise on account of any first-aid treatment or other medical services rendered in connection with an emergency during my tenure as a volunteer.</p>
                <p><b>Assumption of risk.</b> I understand that the services I provide to Steel City Codes may include activities that may be hazardous to me. As a volunteer, I hereby expressly assume risk of injury or harm from these activities.</p>
                <p><b>Photo release.</b> I grant and convey to Steel City Codes all right, title, and interests in any photographs, images, video, or audio recordings of me made in connection with my providing volunteer services.</p>
                <p><b>Governing law.</b> I expressly agree that this Release is intended to be as broad and inclusive as permitted by the laws of the State of Colorado and shall be governed by and interpreted in accordance with the laws of the State of Colorado.</p>
              </div>
            </section>

            <Subhead>Sign</Subhead>
            <div data-field="volunteerSignature">
              <FormField id="vol-signature" label={label('volunteerSignature')} hint="Type your full legal name. This is your signature." error={errors.volunteerSignature}>
                {a => <Input {...a} type="text" autoComplete="name" value={form.volunteerSignature} onChange={e => set('volunteerSignature', e.target.value)} />}
              </FormField>
            </div>
            {needsGuardian(form) && (
              <div data-field="guardianSignature">
                <FormField id="vol-guardian" label={label('guardianSignature')} hint="Needed because you're under 18. Your parent or guardian types their own full name." error={errors.guardianSignature}>
                  {a => <Input {...a} type="text" autoComplete="off" value={form.guardianSignature} onChange={e => set('guardianSignature', e.target.value)} />}
                </FormField>
              </div>
            )}
          </>
        )}

        {step === 5 && (
          <section aria-labelledby="vol-interview" data-field="interviewSlotId">
            <h3 id="vol-interview" className="text-lg font-bold text-balance">
              {hasSlots ? `Pick a time for your ${slotMinutes ? `${slotMinutes}\u2011minute ` : ''}online interview` : 'Your online interview'}
            </h3>
            {hasSlots && <p className="mt-1 text-sm text-ink-muted">You can change it later from your dashboard.</p>}
            <div className="mt-4">
              {openSlots === null && slotsError ? (
                <p className="text-ink-muted text-pretty">We couldn't load interview times. You can still send your application and book a time from your dashboard later.</p>
              ) : openSlots === null ? (
                <div role="status" aria-label="Loading interview times" className="h-24 rounded bg-surface-sunken animate-pulse" />
              ) : (
                <InterviewSlotPicker
                  slots={openSlots}
                  value={form.interviewSlotId}
                  onChange={id => set('interviewSlotId', id)}
                  labelledBy="vol-interview"
                />
              )}
            </div>
            {errors.interviewSlotId && <div className="mt-3"><FieldError id="interviewSlotId-err">{errors.interviewSlotId}</FieldError></div>}
          </section>
        )}

        {errorKeys.length > 0 && (
          <div role="alert" className="!mt-8 flex flex-wrap items-center gap-x-2 text-sm font-bold text-danger">
            <CircleAlert size={16} strokeWidth={2.5} aria-hidden="true" className="shrink-0" />
            <span>{errorKeys.length === 1 ? '1 answer needs attention:' : `${errorKeys.length} answers need attention:`}</span>
            {errorKeys.map((k, i) => (
              <span key={k}>
                <button type="button" onClick={() => focusField(k)} className={buttonClass('text', 'text-sm text-danger')}>{SHORT[k] ?? k}</button>
                {i < errorKeys.length - 1 && ','}
              </span>
            ))}
          </div>
        )}

        {failure && (
          <div className="!mt-8">
            <FormError
              actions={failure.recovery && (
                <>
                  <Link to="/login" className={buttonClass('text')}>Sign in</Link>
                  {failure.recovery === 'existing' && (
                    <>
                      <Link to="/forgot" className={buttonClass('text')}>Forgot your password?</Link>
                      <button type="button" onClick={switchEmail} className={buttonClass('text')}>Use a different email</button>
                    </>
                  )}
                </>
              )}
            >
              {failure.message}
            </FormError>
          </div>
        )}

        <div className={`${errorKeys.length > 0 || failure ? '!mt-3' : '!mt-8'} flex items-center gap-3 pt-5 border-t-2 border-ink`}>
          {step > 1 && (
            <Button variant="secondary" onClick={() => goTo(step - 1)} disabled={submitting}>
              <ChevronLeft size={18} strokeWidth={2.5} aria-hidden="true" />Back
            </Button>
          )}
          <Button type="submit" variant="primary" className="flex-1 sm:flex-none sm:ml-auto sm:min-w-[220px]" disabled={submitting}>
            {step < STEP_COUNT
              ? <>Next: {STEPS[step]}<ChevronRight size={18} strokeWidth={2.5} aria-hidden="true" /></>
              : submitting
                ? <><Spinner />Sending…</>
                : applicationSaved
                  ? (form.interviewSlotId ? 'Book this time' : 'Finish without a time')
                  : 'Send application'}
          </Button>
        </div>
      </form>
    </PublicShell>
  )
}
