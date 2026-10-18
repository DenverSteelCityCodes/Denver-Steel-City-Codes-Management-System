import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, ChevronRight, ChevronLeft, CheckCircle2, CircleAlert, FilePenLine, Lock, Repeat } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useClasses, type SectionWithCount } from '../hooks/useClasses'
import { useRegistrations } from '../hooks/useRegistrations'
import { useSessions, activeCampYear, campSessions as activeSessions, formatSessionDates } from '../hooks/useSessions'
import { useSeasonSettings, registrationIsOpen } from '../hooks/useSeasonSettings'
import RegistrationCountdown from '../components/RegistrationCountdown'
import NotifyMeSwitch from '../components/NotifyMeSwitch'
import { formatCampDateTime } from '../lib/denverTime'
import { useParentProfile } from '../hooks/useParentProfile'
import { useFormConfig } from '../hooks/useFormConfig'
import { courseRuleReason, repeatWarning, takenClasses, type TakenClass } from '../lib/courseRules'
import { GRADES, gradeToAge } from '../lib/campers'
import { draftKey, readDraft, writeDraft, clearDraft } from '../lib/registrationDraft'
import { fetchSectionFill } from '../lib/sectionFill'
import { placeSentence } from '../lib/campSite'
import { formatTimeRange } from '../lib/campDay'
import { buttonClass } from '../lib/ui'
import { ErrorLine, Segmented, hintCls, labelCls } from './parent/parts'

const SCHOOL_DISTRICTS = [
  'Cherry Creek School District',
  'Douglas County School District',
  'Jefferson County Public Schools',
  'Adams 12 Five Star Schools',
  'Other',
]
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
  // "Place with" a friend or sibling (spec 31), saved on each registration.
  place_with: string
  // A request for an exception to a class's rules, per week (spec 31), sent with the registration.
  exception1: ExceptionDraft | null
  exception2: ExceptionDraft | null
  // Waiver
  waiver_signature: string
  guardian_signature: string
}

// The class a family asks to be let into although its grade or prerequisite rules them out, the
// section the request is about, and why (spec 31). Sent once the camper is saved.
interface ExceptionDraft {
  classId: string
  sectionId: string
  name: string
  message: string
}

const PREVIOUS_PROGRAMS = ['Intro to Python', 'Intermediate Python', 'Intro to Java', 'Intermediate Java']

// One selectable class for a given week: the section the camper would join, or why they can't.
// ruleBlocked: the class's own rules refuse the camper, so the family may request an exception
// about `exceptionSection` instead. repeat: the same course in the other week (a warning).
interface ClassOption {
  classId: string
  name: string
  section: SectionWithCount | null
  reason: string | null
  full: boolean
  ruleBlocked: boolean
  exceptionSection: SectionWithCount | null
  repeat: string | null
}

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
  place_with: '', exception1: null, exception2: null,
  waiver_signature: '', guardian_signature: '',
}

const STEP_NAMES = ['Camper', 'Parent and emergency contact', 'Health and details', 'Session and class', 'Waiver and consent']

// Form key → the control (or button group label) a validation error points at.
const FIELD_IDS: Record<string, string> = {
  first_name: 'reg-first', last_name: 'reg-last', email: 'reg-email', school_district: 'reg-district',
  school_name: 'reg-school', grade: 'reg-grade', shirt_size: 'reg-shirt', laptop_available: 'reg-laptop',
  ethnic_background: 'reg-ethnic', gender: 'reg-gender', parent_name: 'reg-parent-name',
  parent_email: 'reg-parent-email', parent_phone: 'reg-parent-phone', emergency_name: 'reg-emergency-name',
  emergency_phone: 'reg-emergency-phone', emergency_relation: 'reg-emergency-relation',
  allergies: 'reg-allergies', medical_conditions: 'reg-medical', other_info: 'reg-other',
  free_reduced_lunch: 'reg-lunch', how_heard: 'reg-how-heard', previous_program: 'reg-previous',
  candy_consent: 'reg-candy', waiver_signature: 'reg-waiver-sig', guardian_signature: 'reg-guardian-sig',
  place_with: 'reg-place-with', exception1: 'reg-exception-1', exception2: 'reg-exception-2',
}

// Yes / No as a segmented control: the selected answer fills ink, never gold.
function YesNo({ id, value, invalid, onChange }: { id: string; value: boolean | null; invalid: boolean; onChange: (v: boolean) => void }) {
  return (
    <Segmented labelledBy={id} invalid={invalid} describedBy={invalid ? 'reg-error' : undefined}
      items={[true, false].map(v => ({ key: String(v), label: v ? 'Yes' : 'No', on: value === v, onClick: () => onChange(v) }))} />
  )
}

// The step rail inside the sticky step sign (DESIGN.md › Sign Band: wizards add 6px segments).
function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <div aria-hidden="true" className="grid gap-1 mt-3" style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`h-1.5 rounded-[1px] ${i < current ? 'bg-brand-on' : 'bg-brand-on/20'}`} />
      ))}
    </div>
  )
}

export default function ParentRegistrationPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const studentId = searchParams.get('studentId')
  const { profile, user } = useAuth()
  const { classes, loading: classesLoading, refetch: refetchClasses } = useClasses()
  // A returning camper's classes, this year and past ones, for prerequisites and repeats (spec 31).
  const { registrations } = useRegistrations()
  const { sessions, loading: sessionsLoading } = useSessions()
  const { profile: parentProfile, saveProfile } = useParentProfile()
  // Labels / visibility / required-ness come from the admin Form editor; `enabled` opens/closes it.
  const { field: q, enabled: registrationOpen, loading: formConfigLoading, loadError: formConfigError } = useFormConfig('student_registration')

  // Stamp the record with the active camp year (not the calendar year) so a camper who just
  // completed the full form is considered confirmed for this summer and isn't immediately
  // re-prompted by the per-summer onboarding gate (#42).
  const campYear = activeCampYear(sessions)
  const { settings: season, refetch: refetchSeason } = useSeasonSettings(sessions.length > 0 ? campYear : null)
  const campSessions = activeSessions(sessions)
  // Where camp is, from each week's sessions.location (spec 30).
  const placeLine = placeSentence(campSessions.filter(s => s.is_active))
  // The step lives in the URL (?step=3), so the browser's back button and a reload keep the
  // parent where they were (spec 16). Answers are kept as a draft on this device.
  const step = Math.min(5, Math.max(1, Number(searchParams.get('step')) || 1))
  const myDraftKey = user ? draftKey(user.id, studentId) : null
  const [restoredDraft] = useState(() => (myDraftKey ? readDraft(myDraftKey) : null))
  const [form, setForm] = useState<FormData>(() => ({
    ...INITIAL, parent_name: profile?.display_name ?? '', parent_email: '',
    // A new camper's draft restores right away; a re-registration's restores over the prefill below.
    ...(!studentId && restoredDraft ? (restoredDraft.form as Partial<FormData>) : {}),
  }))
  // Set when a chosen class filled up after the parent picked it; the next submit goes ahead.
  const [fullAcknowledged, setFullAcknowledged] = useState(false)
  const [authExpired, setAuthExpired] = useState(false)
  const errorRef = useRef<HTMLParagraphElement>(null)
  // True once the parent typed or moved between steps in this visit (or a draft was restored).
  const dirty = useRef(!!restoredDraft)

  function goToStep(n: number, replace = false) {
    dirty.current = true
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      if (n <= 1) p.delete('step')
      else p.set('step', String(n))
      return p
    }, { replace })
    if (n === 4) void refetchClasses()   // seat counts can change while a parent fills steps 1–3
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }
  // When re-registering an existing camper (?studentId=…), we update that student row for the
  // new camp year instead of inserting a duplicate. null = brand-new camper.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorField, setErrorField] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [waitlistedCount, setWaitlistedCount] = useState(0)
  const [registeredCount, setRegisteredCount] = useState(0)
  // Exception requests sent with the registration, and any that couldn't be sent (spec 31).
  const [exceptionsSent, setExceptionsSent] = useState<string[]>([])
  const [exceptionErrors, setExceptionErrors] = useState<string[]>([])
  // Re-registration prefill status, keyed by studentId + attempt so Retry refetches. Until it has
  // loaded, the form isn't shown — submitting a blank form would insert a duplicate camper.
  const [prefillAttempt, setPrefillAttempt] = useState(0)
  const [camperPrefill, setCamperPrefill] = useState<{ key: string; error: string | null } | null>(null)
  const camperPrefillKey = `${studentId}:${prefillAttempt}`
  const camperPrefillPending = !!studentId && camperPrefill?.key !== camperPrefillKey
  const camperPrefillError = studentId && !camperPrefillPending ? camperPrefill?.error ?? null : null

  // Display name derived from the split first/last fields (full_name is composed on submit).
  const studentFullName = `${form.first_name} ${form.last_name}`.trim()
  const studentFirst = form.first_name.trim() || 'your camper'

  // Prefill parent details once they load (#54) — adjusted during render rather than in an
  // effect. Only empty fields are filled, so nothing the parent typed is overwritten.
  const prefillKey = [profile?.display_name, parentProfile?.updated_at, user?.email].join('|')
  const [prefilledKey, setPrefilledKey] = useState('')
  if (prefillKey !== prefilledKey) {
    setPrefilledKey(prefillKey)
    setForm(f => ({
      ...f,
      parent_name: f.parent_name || profile?.display_name || '',
      parent_email: f.parent_email || parentProfile?.email || user?.email || '',
      parent_phone: f.parent_phone || parentProfile?.phone || '',
      emergency_name: f.emergency_name || parentProfile?.emergency_contact_name || '',
      emergency_phone: f.emergency_phone || parentProfile?.emergency_contact_phone || '',
      emergency_relation: f.emergency_relation || parentProfile?.emergency_contact_relation || '',
    }))
  }

  // What the camper has taken, for course rules (spec 31): a returning camper's registrations, and
  // for Week 2 the Week 1 class picked here (it counts as taken when it has a free seat, the same
  // as the database, which sees Week 1 first in the same request).
  const takenBefore = (week: 1 | 2): TakenClass[] => {
    const mine = studentId ? takenClasses(registrations, studentId) : []
    if (week !== 2 || !form.session1 || !form.class_week1) return mine
    const pick = classOptions(1).find(o => o.section?.id === form.class_week1)
    return pick?.section ? [...mine, { classId: pick.classId, year: campYear, week: pick.section.week, seat: !pick.full }] : mine
  }

  // Classes the camper can pick for a week. A class with no section that week isn't offered at
  // all; one whose rules (grades this fall, a class to take first) or age bands don't fit the
  // camper is shown locked with the reason. The rules come from the class (spec 31), and the
  // database refuses the same ones.
  function classOptions(week: 1 | 2): ClassOption[] {
    const camperAge = gradeToAge(form.grade)
    const taken = takenBefore(week)
    const offered = new Set(classes.filter(c => c.sections.some(s => s.week === week || s.week === null)).map(c => c.id))
    return classes.flatMap((c): ClassOption[] => {
      const weekSections = c.sections.filter(s => s.week === week || s.week === null)
      if (weekSections.length === 0) return []
      const fits = weekSections.filter(s => camperAge !== null && camperAge >= s.age_min && camperAge <= s.age_max)
      // Prefer the emptiest fitting section so siblings/friends spread before anyone is waitlisted.
      const best = [...fits].sort((a, b) => a.registered_count / a.capacity - b.registered_count / b.capacity)[0]
      // Judged on the section the camper would join, as the database does: a both-weeks section
      // (week null) isn't "after" Week 1, so only a past summer meets its prerequisite.
      const target = { year: campYear, week: (best ?? weekSections[0]).week }
      const rule = courseRuleReason(c, classes, form.grade, taken, target)
      if (rule) {
        return [{ classId: c.id, name: c.name, section: null, full: false, reason: rule, ruleBlocked: true,
          exceptionSection: best ?? weekSections[0], repeat: null }]
      }
      if (!best) {
        const ages = [...new Set(weekSections.map(s => `${s.age_min}–${s.age_max}`))].join(', ')
        return [{ classId: c.id, name: c.name, section: null, full: false, reason: `Ages ${ages}`, ruleBlocked: false, exceptionSection: null, repeat: null }]
      }
      return [{ classId: c.id, name: c.name, section: best, reason: null, full: best.registered_count >= best.capacity,
        ruleBlocked: false, exceptionSection: null, repeat: repeatWarning(c, classes, form.grade, taken, target, offered) }]
    })
  }

  // The week's exception request, while its class still rules the camper out.
  function exceptionFor(week: 1 | 2): ExceptionDraft | null {
    const ex = week === 1 ? form.exception1 : form.exception2
    if (!ex) return null
    return classOptions(week).some(o => o.ruleBlocked && o.classId === ex.classId) ? ex : null
  }

  function isSelectable(week: 1 | 2, sectionId: string) {
    return classOptions(week).some(o => o.section?.id === sectionId)
  }

  // Re-registration: prefill the form from the existing camper so the parent reviews and
  // updates rather than re-entering everything. Waiver signatures and session/class choices
  // are intentionally left blank — they must be provided fresh for the new camp year.
  useEffect(() => {
    if (!studentId) return
    let cancelled = false
    const key = `${studentId}:${prefillAttempt}`
    ;(async () => {
      const { data, error: fetchErr } = await supabase
        .from('students').select('*').eq('id', studentId).maybeSingle()
      if (cancelled) return
      if (fetchErr || !data) {
        setCamperPrefill({
          key,
          error: fetchErr
            ? `Couldn't load your camper's details: ${fetchErr.message}`
            : "We couldn't find that camper on your account.",
        })
        return
      }
      setEditingId(data.id)
      setCamperPrefill({ key, error: null })
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
        // Unfinished answers from this device win over what's on file.
        ...(restoredDraft ? (restoredDraft.form as Partial<FormData>) : {}),
      }))
    })()
    return () => { cancelled = true }
  }, [studentId, prefillAttempt, restoredDraft])

  // Draft: saved (debounced) only once the parent has typed something or moved between steps in
  // this visit. Landing on ?step=5 alone (a reload after submitting, a remount) must not save an
  // empty draft.
  useEffect(() => {
    if (!myDraftKey || submitted || !dirty.current) return
    const t = window.setTimeout(() => writeDraft(myDraftKey, form as unknown as Record<string, unknown>, step), 400)
    return () => window.clearTimeout(t)
  }, [form, step, myDraftKey, submitted])

  // A link or reload that lands past step 1 with nothing filled in starts at step 1 instead.
  useEffect(() => {
    if (step > 1 && !restoredDraft && !studentId) { goToStep(1, true); dirty.current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, [])

  // Errors are announced and focused, so screen-reader users hear them (spec 16).
  // A known field gets the focus (marked invalid and described by the message); otherwise the message.
  useEffect(() => {
    if (!error) return
    const el = errorField ? document.getElementById(errorField) : null
    const target = el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)
      ? el
      : errorField ? document.querySelector<HTMLElement>(`[aria-labelledby="${errorField}"] button, [aria-labelledby="${errorField}"] input`) : null
    ;(target ?? errorRef.current)?.focus()
  }, [error, errorField])

  // A new step is announced: focus moves to its "Step N of 5" line (not on first load).
  const stepRef = useRef<HTMLHeadingElement>(null)
  const firstStep = useRef(true)
  useEffect(() => {
    if (firstStep.current) { firstStep.current = false; return }
    stepRef.current?.focus({ preventScroll: true })
  }, [step])

  // "Save and exit" writes the draft now (the debounced save may not have run yet) and goes Home.
  function saveAndExit() {
    if (myDraftKey && !submitted && dirty.current) writeDraft(myDraftKey, form as unknown as Record<string, unknown>, step)
    navigate('/parent')
  }

  function startOver() {
    if (myDraftKey) clearDraft(myDraftKey)
    dirty.current = false
    setForm({ ...INITIAL, parent_name: profile?.display_name ?? '', parent_email: parentProfile?.email || user?.email || '' })
    setError(null)
    goToStep(1, true)
  }

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    dirty.current = true
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

  // The field each validation error is about, so it can be focused and marked invalid (L6a).
  const failedField = useRef<string | null>(null)
  const fail = (key: string, message: string) => { failedField.current = FIELD_IDS[key] ?? null; return message }

  function validate(s: number = step): string | null {
    const stepNow = s
    failedField.current = null
    if (stepNow === 1) {
      if (!form.first_name.trim()) return fail('first_name', `${q('first_name').label} is required`)
      if (!form.last_name.trim()) return fail('last_name', `${q('last_name').label} is required`)
      if (q('email').required && !form.email.trim()) return fail('email', `${q('email').label} is required`)
      if (q('school_district').required && !form.school_district) return fail('school_district', `${q('school_district').label} is required`)
      if (q('school_name').required && !form.school_name.trim()) return fail('school_name', `${q('school_name').label} is required`)
      if (!form.grade) return fail('grade', `${q('grade').label} is required`)
      if (q('shirt_size').required && !form.shirt_size) return fail('shirt_size', `${q('shirt_size').label} is required`)
      if (q('laptop_available').required && form.laptop_available === null) return fail('laptop_available', `Please answer: ${q('laptop_available').label}`)
      if (q('ethnic_background').required && form.ethnic_background.length === 0) return fail('ethnic_background', `Please answer: ${q('ethnic_background').label}`)
      if (q('gender').required && !form.gender.trim()) return fail('gender', `${q('gender').label} is required`)
    }
    if (stepNow === 2) {
      if (!form.parent_name.trim()) return fail('parent_name', `${q('parent_name').label} is required`)
      if (!form.parent_email.trim()) return fail('parent_email', `${q('parent_email').label} is required`)
      if (!form.parent_phone.trim()) return fail('parent_phone', `${q('parent_phone').label} is required`)
      if (!form.emergency_name.trim()) return fail('emergency_name', `${q('emergency_name').label} is required`)
      if (!form.emergency_phone.trim()) return fail('emergency_phone', `${q('emergency_phone').label} is required`)
      if (!form.emergency_relation.trim()) return fail('emergency_relation', `${q('emergency_relation').label} is required`)
    }
    if (stepNow === 3) {
      if (!form.allergies.trim()) return fail('allergies', `${q('allergies').label}: enter "None" if not applicable`)
      if (!form.medical_conditions.trim()) return fail('medical_conditions', `${q('medical_conditions').label}: enter "None" if not applicable`)
      if (q('other_info').required && !form.other_info.trim()) return fail('other_info', `Please answer: ${q('other_info').label}`)
      if (q('free_reduced_lunch').required && form.free_reduced_lunch === null) return fail('free_reduced_lunch', `Please answer: ${q('free_reduced_lunch').label}`)
      if (q('how_heard').required && !form.how_heard) return fail('how_heard', `Please answer: ${q('how_heard').label}`)
      if (q('previous_program').required && form.previous_program === null) return fail('previous_program', `Please answer: ${q('previous_program').label}`)
      if (q('candy_consent').required && !form.candy_consent) return fail('candy_consent', `Please confirm: ${q('candy_consent').label}`)
    }
    if (stepNow === 4) {
      if (!campSessions.some(s => s.is_active)) return "Registration isn't open yet. No camp sessions are scheduled."
      if (!registrationIsOpen(season)) return `Registration opens ${formatCampDateTime(season!.registration_opens_at!)} (Denver time). Your answers are saved on this device, so you can pick the class here once it opens.`
      if (!form.session1 && !form.session2) return 'Please select at least one session'
      // Every chosen week needs a class booked. An exception request goes alongside it (spec 31): if
      // the camp agrees, an admin moves that class into the one asked for.
      if (form.session1 && !isSelectable(1, form.class_week1)) return `Please select a class for ${campSessions[0]?.name ?? 'Session 1'}`
      if (form.session2 && !isSelectable(2, form.class_week2)) return `Please select a class for ${campSessions[1]?.name ?? 'Session 2'}`
      if (q('place_with').required && !form.place_with.trim()) return fail('place_with', `${q('place_with').label} is required`)
      // A class whose section runs both weeks fills both weeks: it can't be paired with another.
      if (form.session1 && form.session2 && form.class_week1 !== form.class_week2) {
        const both = classes.find(c => c.sections.some(s =>
          s.week === null && (s.id === form.class_week1 || s.id === form.class_week2)))
        if (both) return `${both.name} runs both weeks, so it can't be combined with a different class. Pick it for both sessions, or choose another class.`
      }
    }
    if (stepNow === 5) {
      if (!form.waiver_signature.trim()) return fail('waiver_signature', `${q('waiver_signature').label} is required`)
      if (!form.guardian_signature.trim()) return fail('guardian_signature', `${q('guardian_signature').label} is required`)
    }
    return null
  }

  function handleNext() {
    const err = validate()
    if (err) { setError(err); setErrorField(failedField.current); return }
    setError(null); setErrorField(null)
    goToStep(step + 1)
  }

  function handleBack() {
    setError(null); setErrorField(null)
    goToStep(step - 1, true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Every step, not just this one: a reload or a link can land on step 5 directly.
    for (let s2 = 1; s2 <= 5; s2++) {
      const err = validate(s2)
      if (err) { setError(err); setErrorField(failedField.current); if (s2 !== step) goToStep(s2); return }
    }
    setError(null); setErrorField(null)
    setSubmitting(true)

    // Seats change while a parent fills the form: say so if a chosen class just filled.
    if (!fullAcknowledged) {
      const fill = await fetchSectionFill().catch(() => null)
      const chosen = [form.session1 && form.class_week1, form.session2 && form.class_week2].filter(Boolean) as string[]
      const nowFull = chosen
        .map(id => classes.flatMap(c => c.sections.map(sec => ({ c, sec }))).find(x => x.sec.id === id))
        .filter((x): x is { c: (typeof classes)[number]; sec: SectionWithCount } => !!x)
        .filter(x => x.sec.registered_count < x.sec.capacity && (fill?.get(x.sec.id)?.active ?? 0) >= x.sec.capacity)
      if (nowFull.length > 0) {
        setFullAcknowledged(true)
        setSubmitting(false)
        void refetchClasses()
        setError(`${nowFull.map(x => x.c.name).join(' and ')} just filled up. Submit again to join the waitlist, or go back to step 4 to pick another class.`)
        return
      }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      // The answers are already saved as a draft on this device.
      setAuthExpired(true)
      setError('Your sign-in expired. Your answers are saved on this device: sign in again and you can pick up where you left off.')
      setSubmitting(false)
      return
    }
    // Re-registering a camper whose details never loaded must not fall through to an insert.
    if (studentId && !editingId) { setError("Your camper's details haven't loaded yet."); setSubmitting(false); return }

    const studentPayload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      full_name: `${form.first_name.trim()} ${form.last_name.trim()}`.trim(),
      age: gradeToAge(form.grade) ?? 10,
      medical_info: form.medical_conditions || null,
      email: form.email || null,
      school_district: form.school_district || null,
      school_name: form.school_name.trim() || null,
      grade: form.grade,
      shirt_size: form.shirt_size || null,
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
      how_heard: form.how_heard || null,
      previous_program: form.previous_program,
      program_last_year: form.previous_program ? form.program_last_year || null : null,
      candy_consent: form.candy_consent,
      waiver_signature: form.waiver_signature.trim(),
      guardian_signature: form.guardian_signature.trim(),
    }

    // Re-registration updates the existing camper for the new year; a brand-new camper inserts.
    // registration_year + waiver_signed_at are stamped only once a class is booked (below), so a
    // rejected class doesn't leave the camper "confirmed for this summer" with nothing booked. A new
    // camper inserts with null explicitly — the column defaults to a fixed year.
    const { data: student, error: studentErr } = editingId
      ? await supabase.from('students').update(studentPayload).eq('id', editingId).select().single()
      : await supabase.from('students').insert({ parent_id: user.id, ...studentPayload, registration_year: null }).select().single()

    if (studentErr) {
      // P0001 = a rule the database explains itself (e.g. the new age doesn't fit the camper's
      // current class); anything else is a generic failure.
      setError(studentErr.code === 'P0001' ? studentErr.message : 'Failed to save registration. Please try again.')
      setSubmitting(false)
      return
    }
    // From here on a retry must update this camper, not insert a second copy — including after a
    // reload, so the new camper's id goes into the URL like a re-registration's.
    setEditingId(student.id)
    if (!studentId) {
      setCamperPrefill({ key: `${student.id}:${prefillAttempt}`, error: null })
      setSearchParams(prev => {
        const p = new URLSearchParams(prev)
        p.set('studentId', student.id)
        return p
      }, { replace: true })
    }

    // Remember the parent's contact details for next time (#52, #54). Not fatal if it fails —
    // the same details are already on the camper record.
    await saveProfile({
      email: form.parent_email.trim(),
      phone: form.parent_phone.trim(),
      emergency_contact_name: form.emergency_name.trim(),
      emergency_contact_phone: form.emergency_phone.trim(),
      emergency_contact_relation: form.emergency_relation.trim(),
    }).catch(() => {})

    // One registration per chosen section. Dedupe: a section with week === null serves both
    // sessions, and (student_id, section_id) is UNIQUE. Status is decided server-side
    // (pending, or waitlisted when the section is full).
    const sectionIds = new Set<string>()
    if (form.session1 && form.class_week1) sectionIds.add(form.class_week1)
    if (form.session2 && form.class_week2) sectionIds.add(form.class_week2)
    // Week 1 goes first: a Week 1 class can be the prerequisite of the Week 2 one (spec 31).
    const placeWith = form.place_with.trim() || null
    const regsToCreate = [...sectionIds].map(section_id => ({ student_id: student.id, section_id, place_with: placeWith }))
    const exceptionsToSend = ([1, 2] as const).map(exceptionFor).filter((x): x is ExceptionDraft => !!x && !!x.message.trim())

    if (regsToCreate.length > 0) {
      const { data: regs, error: regErr } = await supabase
        .from('registrations').insert(regsToCreate).select('status')
      if (regErr) {
        // Stay on this step with the server's reason; editingId is set, so resubmitting (after
        // going Back to change the class) updates this camper rather than inserting another.
        setError(regErr.code === '23505'
          ? `${studentFullName} is already registered for that class.`
          : regErr.hint === 'course_rule'
            ? `Your camper's details are saved, but the class couldn't be booked: ${regErr.message.replace(/\s*Request an exception\?$/, '')} Go back to step 4 to pick another class or request an exception.`
            : `Your camper's details are saved, but the class couldn't be booked: ${regErr.message}. Go back to change the class, then submit again.`)
        setSubmitting(false)
        return
      }
      setWaitlistedCount((regs ?? []).filter(r => r.status === 'waitlisted').length)
      setRegisteredCount((regs ?? []).length)

      // A class is booked: now mark the camper confirmed for this summer. Not fatal if it fails —
      // the booking stands, and the worst case is a re-confirmation prompt later.
      await supabase.from('students')
        .update({ registration_year: campYear, waiver_signed_at: new Date().toISOString() })
        .eq('id', student.id)
    }

    // Exception requests go once the camper (and any Week 1 class) is saved, so the database
    // judges them on the same facts. One failing doesn't undo the registration.
    const sent: string[] = []
    const failed: string[] = []
    for (const ex of exceptionsToSend) {
      const { error: exErr } = await supabase.rpc('request_exception', {
        p_student_id: student.id, p_section_id: ex.sectionId, p_message: ex.message.trim(),
      })
      if (exErr) failed.push(`We couldn't send your request about ${ex.name}: ${exErr.message} You can ask again from Classes.`)
      else sent.push(ex.name)
    }
    setExceptionsSent(sent)
    setExceptionErrors(failed)

    // Done: the draft (under the new camper's key or the original one) is no longer needed.
    if (user) { clearDraft(draftKey(user.id, null)); clearDraft(draftKey(user.id, student.id)) }
    setSubmitted(true)
  }

  const inputCls = 'ui-input'
  // Question label from the Form editor, with the required marker / optional hint.
  const labelText = (key: string, hint?: string) => (
    <>
      {q(key).label}{q(key).required ? ' *' : <span className="font-normal text-ink-muted"> (optional)</span>}
      {hint && <span className="font-normal text-ink-muted"> ({hint})</span>}
    </>
  )
  const textareaCls = 'ui-input resize-none'
  const invalidProps = (id: string) => error && errorField === id
    ? { 'aria-invalid': true as const, 'aria-describedby': 'reg-error' }
    : {}
  // A blocking error: red 14px 700 with an icon. It sits under the field it is about (DESIGN.md ›
  // Inputs); one that isn't about a field on screen sits above the buttons.
  const errorLine = (className: string) => (
    <p id="reg-error" ref={errorRef} role="alert" tabIndex={-1} className={`flex items-start gap-1.5 text-sm font-bold text-danger text-pretty focus:outline-none ${className}`}>
      <CircleAlert size={16} strokeWidth={2.5} aria-hidden="true" className="shrink-0 mt-0.5" />
      <span>{error}{authExpired && <> <Link to="/login" className="underline underline-offset-[3px]">Sign in again</Link></>}</span>
    </p>
  )
  const shown = new Set<string>()
  const fieldError = (id: string) => {
    shown.add(id)
    return error && errorField === id ? errorLine('mt-1.5') : null
  }
  // Choice rows (DESIGN.md › Inputs): real checkboxes and radios in 52px white rows; the selected
  // row gets a 2px ink frame.
  const choiceCls = 'flex items-center gap-3 min-h-[52px] px-4 py-2 rounded border-2 border-border bg-surface cursor-pointer has-[input:checked]:border-ink has-[input:disabled]:opacity-55 has-[input:disabled]:cursor-not-allowed'
  const checkRowCls = 'flex items-start gap-3 min-h-11 py-2.5 cursor-pointer'
  const pageTitle = 'font-display font-bold text-[1.75rem] leading-[1.15] tracking-[-0.01em] text-balance'

  if (submitted) {
    const asked = exceptionsSent.length > 0
      ? `We sent your request about ${exceptionsSent.join(' and ')} to the camp. They'll email you.` : null
    return (
      <div className="max-w-[640px] mx-auto">
          <h1 className={`${pageTitle} flex items-center gap-2`}>
            <CheckCircle2 size={28} strokeWidth={2.25} aria-hidden="true" className="text-success shrink-0" />
            {registeredCount === 0 && exceptionsSent.length > 0 ? 'Request sent' : waitlistedCount > 0 && waitlistedCount === registeredCount ? "You're on the waitlist" : "You're in!"}
          </h1>
          <p className="mt-2 text-pretty">
            {registeredCount === 0 && exceptionsSent.length > 0 ? (
              <><strong className="font-bold">{studentFullName}</strong>'s details are saved.</>
            ) : waitlistedCount === 0 ? (
              <><strong className="font-bold">{studentFullName}</strong>'s spot is confirmed. You'll find the class, time and room on Home.</>
            ) : waitlistedCount === registeredCount ? (
              <>That class is full, so <strong className="font-bold">{studentFullName}</strong> is on the waitlist. We'll reach out if a spot opens.</>
            ) : (
              <><strong className="font-bold">{studentFullName}</strong>'s spot is confirmed in one class. The other was full, so they're on its waitlist. We'll reach out if a spot opens.</>
            )}
            {asked && <> {asked}</>}
          </p>
          {exceptionErrors.map(e => <ErrorLine key={e} className="mt-2">{e}</ErrorLine>)}
          <button type="button" onClick={() => navigate('/parent')} className={buttonClass('primary', 'mt-5')}>
            Back to Home
          </button>
      </div>
    )
  }

  if (!formConfigLoading && !registrationOpen) {
    return (
      <div className="max-w-[640px] mx-auto">
        <h1 className={pageTitle}>{formConfigError ? "Couldn't load the form" : 'Registration is closed'}</h1>
        <p className="mt-2 text-ink-muted text-pretty">
          {formConfigError
            ? 'Check your connection and reload the page to try again.'
            : "Camper registration isn't open right now. Your existing campers and registrations are unchanged."}
        </p>
        <button type="button" onClick={() => navigate('/parent')} className={buttonClass('primary', 'mt-5')}>
          Back to Home
        </button>
      </div>
    )
  }

  if (camperPrefillPending || camperPrefillError) {
    return (
      <div className="max-w-[640px] mx-auto">
        {camperPrefillError ? (
          <>
            <h1 className={pageTitle}>Couldn't load your camper</h1>
            <p role="alert" className="mt-2 text-ink-muted text-pretty">{camperPrefillError}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => setPrefillAttempt(a => a + 1)} className={buttonClass('primary')}>
                Retry
              </button>
              <button type="button" onClick={() => navigate('/parent')} className={buttonClass('secondary')}>
                Back to Home
              </button>
            </div>
          </>
        ) : (
          <div role="status" className="flex justify-center py-10">
            <span aria-hidden="true" className="w-8 h-8 rounded-full border-2 border-ink border-t-transparent animate-spin" />
            <span className="sr-only">Loading your camper's details</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-[640px] mx-auto">
        {/* Sticky step sign: where you are, and a way out that keeps the draft. Gold, full bleed and
            square on a phone (DESIGN.md › Sign Band, sticky); under the bar from 768px. */}
        <div className="sticky top-0 md:top-16 z-20 -mx-4 md:mx-0 -mt-5 md:-mt-8 mb-6 px-4 md:px-5 pt-1 pb-3 bg-brand text-brand-on md:rounded-b">
          <div className="flex items-center justify-between gap-3">
            <p aria-hidden="true" className="text-sm font-bold text-brand-on-muted">Step {step} of 5</p>
            <button type="button" onClick={saveAndExit} className={buttonClass('text', 'text-brand-on focus-visible:outline-brand-on!')}>
              Save and exit
            </button>
          </div>
          <h1 ref={stepRef} tabIndex={-1} className={`${pageTitle} focus:outline-none`}>
            <span className="sr-only">Step {step} of 5: </span>{STEP_NAMES[step - 1]}
          </h1>
          <StepBar current={step} total={5} />
        </div>
        {restoredDraft && (
          <p role="status" className="-mt-2 mb-6 text-sm text-ink-muted">
            Picked up where you left off (saved {new Date(restoredDraft.savedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}).{' '}
            <button type="button" onClick={startOver} className={buttonClass('text', 'text-ink')}>Start over</button>
          </p>
        )}

        <form onSubmit={handleSubmit}>

          {/* Step 1: Student info */}
          {step === 1 && (
            <div className="space-y-5">

              <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                <div>
                  <label htmlFor="reg-first" className={labelCls}>{labelText('first_name')}</label>
                  <input id="reg-first" {...invalidProps('reg-first')} type="text" autoComplete="off" className={inputCls}
                    value={form.first_name} onChange={e => set('first_name', e.target.value)} />
                  {fieldError('reg-first')}
                </div>
                <div>
                  <label htmlFor="reg-last" className={labelCls}>{labelText('last_name')}</label>
                  <input id="reg-last" {...invalidProps('reg-last')} type="text" autoComplete="off" className={inputCls}
                    value={form.last_name} onChange={e => set('last_name', e.target.value)} />
                  {fieldError('reg-last')}
                </div>
              </div>
              {q('email').show && <div>
                <label htmlFor="reg-email" className={labelCls}>{labelText('email')}</label>
                <input id="reg-email" {...invalidProps('reg-email')} type="email" autoComplete="off" className={inputCls}
                  value={form.email} onChange={e => set('email', e.target.value)} />
                {fieldError('reg-email')}
              </div>}
              {q('school_district').show && <div>
                <label htmlFor="reg-district" className={labelCls}>{labelText('school_district')}</label>
                <select id="reg-district" {...invalidProps('reg-district')} className={inputCls} value={form.school_district} onChange={e => set('school_district', e.target.value)}>
                  <option value="">Select…</option>
                  {SCHOOL_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {fieldError('reg-district')}
              </div>}
              {q('school_name').show && <div>
                <label htmlFor="reg-school" className={labelCls}>{labelText('school_name')}</label>
                <input id="reg-school" {...invalidProps('reg-school')} type="text" className={inputCls} placeholder="e.g. Campus Middle School"
                  value={form.school_name} onChange={e => set('school_name', e.target.value)} />
                {fieldError('reg-school')}
              </div>}
              <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                <div>
                  <label htmlFor="reg-grade" className={labelCls}>{labelText('grade')}</label>
                  <select id="reg-grade" {...invalidProps('reg-grade')} className={inputCls} value={form.grade} onChange={e => set('grade', e.target.value)}>
                    <option value="">Select…</option>
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  {fieldError('reg-grade')}
                </div>
                {q('shirt_size').show && <div>
                  <label htmlFor="reg-shirt" className={labelCls}>{labelText('shirt_size')}</label>
                  <select id="reg-shirt" {...invalidProps('reg-shirt')} className={inputCls} value={form.shirt_size} onChange={e => set('shirt_size', e.target.value)}>
                    <option value="">Select…</option>
                    {SHIRT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {fieldError('reg-shirt')}
                </div>}
              </div>
              {q('laptop_available').show && <div>
                <p id="reg-laptop" className={labelCls}>{labelText('laptop_available')}</p>
                <YesNo id="reg-laptop" value={form.laptop_available} invalid={!!error && errorField === 'reg-laptop'} onChange={v => set('laptop_available', v)} />
                {fieldError('reg-laptop')}
              </div>}
              {q('ethnic_background').show && <div>
                <p id="reg-ethnic" className={labelCls}>{labelText('ethnic_background', 'for grant reporting only')}</p>
                <div role="group" aria-labelledby="reg-ethnic" {...invalidProps('reg-ethnic')} className="flex flex-wrap gap-2">
                  {ETHNIC_OPTIONS.map(opt => {
                    const on = form.ethnic_background.includes(opt)
                    return (
                      <button key={opt} type="button" aria-pressed={on} onClick={() => toggleEthnic(opt)}
                        className={`min-h-11 px-3.5 py-2 rounded border-2 font-bold text-left inline-flex items-center gap-1.5 transition-colors ${
                          on ? 'bg-ink border-ink text-bg' : 'bg-surface border-border-strong text-ink hover:border-ink'}`}>
                        {on && <Check size={16} strokeWidth={2.5} aria-hidden="true" className="shrink-0" />}{opt}
                      </button>
                    )
                  })}
                </div>
                {fieldError('reg-ethnic')}
              </div>}
              {q('gender').show && <div>
                <label htmlFor="reg-gender" className={labelCls}>{labelText('gender')}</label>
                <input id="reg-gender" {...invalidProps('reg-gender')} type="text" className={inputCls} placeholder="e.g. Female, Male, Non-binary, Prefer not to say"
                  value={form.gender} onChange={e => set('gender', e.target.value)} />
                {fieldError('reg-gender')}
              </div>}
            </div>
          )}

          {/* Step 2: Parent & Emergency contact */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label htmlFor="reg-parent-name" className={labelCls}>{labelText('parent_name')}</label>
                <input id="reg-parent-name" {...invalidProps('reg-parent-name')} type="text" autoComplete="name" className={inputCls} value={form.parent_name} onChange={e => set('parent_name', e.target.value)} />
                {fieldError('reg-parent-name')}
              </div>
              {/* Email gets the full width on a phone so it never truncates. */}
              <div className="grid min-[480px]:grid-cols-2 gap-x-4 gap-y-5">
                <div>
                  <label htmlFor="reg-parent-email" className={labelCls}>{labelText('parent_email')}</label>
                  <input id="reg-parent-email" {...invalidProps('reg-parent-email')} type="email" autoComplete="email" className={inputCls} value={form.parent_email} onChange={e => set('parent_email', e.target.value)} />
                  {fieldError('reg-parent-email')}
                </div>
                <div>
                  <label htmlFor="reg-parent-phone" className={labelCls}>{labelText('parent_phone')}</label>
                  <input id="reg-parent-phone" {...invalidProps('reg-parent-phone')} type="tel" autoComplete="tel" className={inputCls} placeholder="303-555-0100" value={form.parent_phone} onChange={e => set('parent_phone', e.target.value)} />
                  {fieldError('reg-parent-phone')}
                </div>
              </div>
              <h2 className="pt-5 border-t-2 border-ink text-lg font-bold">Emergency contact</h2>
              <div>
                <label htmlFor="reg-emergency-name" className={labelCls}>{labelText('emergency_name')}</label>
                <input id="reg-emergency-name" {...invalidProps('reg-emergency-name')} type="text" className={inputCls} value={form.emergency_name} onChange={e => set('emergency_name', e.target.value)} />
                {fieldError('reg-emergency-name')}
              </div>
              <div className="grid min-[480px]:grid-cols-2 gap-x-4 gap-y-5">
                <div>
                  <label htmlFor="reg-emergency-phone" className={labelCls}>{labelText('emergency_phone')}</label>
                  <input id="reg-emergency-phone" {...invalidProps('reg-emergency-phone')} type="tel" className={inputCls} value={form.emergency_phone} onChange={e => set('emergency_phone', e.target.value)} />
                  {fieldError('reg-emergency-phone')}
                </div>
                <div>
                  <label htmlFor="reg-emergency-relation" className={labelCls}>{labelText('emergency_relation')}</label>
                  <input id="reg-emergency-relation" {...invalidProps('reg-emergency-relation')} type="text" className={inputCls} placeholder="e.g. Aunt, Grandparent" value={form.emergency_relation} onChange={e => set('emergency_relation', e.target.value)} />
                  {fieldError('reg-emergency-relation')}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Medical & misc */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <label htmlFor="reg-allergies" className={labelCls}>{labelText('allergies', 'enter "None" if not applicable')}</label>
                <textarea id="reg-allergies" {...invalidProps('reg-allergies')} className={textareaCls} rows={2} value={form.allergies} onChange={e => set('allergies', e.target.value)} />
                {fieldError('reg-allergies')}
              </div>
              <div>
                <label htmlFor="reg-medical" className={labelCls}>{labelText('medical_conditions', 'enter "None" if not applicable')}</label>
                <textarea id="reg-medical" {...invalidProps('reg-medical')} className={textareaCls} rows={3} value={form.medical_conditions} onChange={e => set('medical_conditions', e.target.value)} />
                {fieldError('reg-medical')}
              </div>
              {q('other_info').show && <div>
                <label htmlFor="reg-other" className={labelCls}>{labelText('other_info')}</label>
                <textarea id="reg-other" {...invalidProps('reg-other')} className={textareaCls} rows={2} value={form.other_info} onChange={e => set('other_info', e.target.value)} />
                {fieldError('reg-other')}
              </div>}
              {q('free_reduced_lunch').show && <div>
                <p id="reg-lunch" className={labelCls}>{labelText('free_reduced_lunch')}</p>
                <YesNo id="reg-lunch" value={form.free_reduced_lunch} invalid={!!error && errorField === 'reg-lunch'} onChange={v => set('free_reduced_lunch', v)} />
                {fieldError('reg-lunch')}
              </div>}
              {form.free_reduced_lunch && q('lunch_provision').show && (
                <label className={checkRowCls}>
                  <input type="checkbox" className="w-6 h-6 shrink-0" checked={form.lunch_provision}
                    onChange={e => set('lunch_provision', e.target.checked)} />
                  <span className="text-pretty">{q('lunch_provision').label}</span>
                </label>
              )}
              {q('how_heard').show && <div>
                <label htmlFor="reg-how-heard" className={labelCls}>{labelText('how_heard')}</label>
                <select id="reg-how-heard" {...invalidProps('reg-how-heard')} className={inputCls} value={form.how_heard} onChange={e => set('how_heard', e.target.value)}>
                  <option value="">Select…</option>
                  {HOW_HEARD.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                {fieldError('reg-how-heard')}
              </div>}
              {q('previous_program').show && <div>
                <p id="reg-previous" className={labelCls}>{labelText('previous_program')}</p>
                <YesNo id="reg-previous" value={form.previous_program} invalid={!!error && errorField === 'reg-previous'} onChange={v => set('previous_program', v)} />
                {fieldError('reg-previous')}
              </div>}
              {form.previous_program === true && q('previous_program').show && (
                <div>
                  <label htmlFor="reg-previous-program" className={labelCls}>Which program did they take?</label>
                  <select id="reg-previous-program" {...invalidProps('reg-previous-program')} className={inputCls} value={form.program_last_year} onChange={e => set('program_last_year', e.target.value)}>
                    <option value="">Select…</option>
                    {PREVIOUS_PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  {fieldError('reg-previous-program')}
                </div>
              )}
              {q('candy_consent').show && (
                <div>
                  <label className={checkRowCls}>
                    <input id="reg-candy" {...invalidProps('reg-candy')} type="checkbox" className="w-6 h-6 shrink-0" checked={form.candy_consent}
                      onChange={e => set('candy_consent', e.target.checked)} />
                    <span className="text-pretty">{q('candy_consent').label}{q('candy_consent').required && ' *'}</span>
                  </label>
                  {fieldError('reg-candy')}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Session & class selection */}
          {step === 4 && (
            <div className="space-y-6">
              <RegistrationCountdown opensAt={season?.registration_opens_at} onOpen={() => { void refetchSeason() }}><NotifyMeSwitch /></RegistrationCountdown>
              {/* Hours vary by class, so each class row shows its own days, time and room. */}
              {placeLine && <p className="text-ink-muted">{placeLine}</p>}

              {sessionsLoading || classesLoading ? (
                <p className="text-ink-muted">Loading sessions…</p>
              ) : !campSessions.some(s => s.is_active) ? (
                <p className="font-bold">Registration isn't open yet. No camp sessions are scheduled for {campYear}.</p>
              ) : campSessions.map((session, i) => {
                if (!session.is_active) return null
                const week = (i + 1) as 1 | 2
                const key = week === 1 ? 'session1' as const : 'session2' as const
                const classKey = week === 1 ? 'class_week1' as const : 'class_week2' as const
                const exKey = week === 1 ? 'exception1' as const : 'exception2' as const
                const options = classOptions(week)
                const ex = exceptionFor(week)
                const exId = `reg-exception-${week}`
                return (
                  <div key={session.id}>
                    <label className={choiceCls}>
                      <input type="checkbox" className="w-[22px] h-[22px] shrink-0" checked={form[key]}
                        onChange={e => { set(key, e.target.checked); if (!e.target.checked) { set(classKey, ''); set(exKey, null) } }} />
                      <span className="font-bold">{session.name}: {formatSessionDates(session)}</span>
                    </label>
                    {form[key] && (
                      <fieldset className="mt-4">
                        <legend className={labelCls}>Class preference *</legend>
                        {options.length === 0 ? (
                          <p className="text-sm text-ink-muted">No classes are offered this session yet.</p>
                        ) : (
                          <div className="grid gap-2">
                            {options.map(o => {
                              const sec = o.section
                              const selected = !!sec && form[classKey] === sec.id
                              const spotsLeft = sec ? sec.capacity - sec.registered_count : 0
                              const when = sec ? [sec.days, sec.start_time && formatTimeRange(sec.start_time, sec.end_time), sec.room].filter(Boolean).join(', ') : ''
                              const exSection = o.exceptionSection
                              return (
                                <div key={o.classId}>
                                  <label className={choiceCls}>
                                    <input type="radio" name={classKey} className="w-[22px] h-[22px] shrink-0" disabled={!sec}
                                      checked={selected} onChange={() => sec && set(classKey, sec.id)} />
                                    <span className="flex-1 min-w-0">
                                      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                                        <span className="font-bold">{o.name}</span>
                                        {sec && <span className="text-sm font-bold">{o.full ? 'Full, joins the waitlist' : `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`}</span>}
                                      </span>
                                      <span className="block text-sm text-ink-muted">
                                        {o.reason
                                          ? <span className="inline-flex items-start gap-1"><Lock size={14} strokeWidth={2.5} aria-hidden="true" className="shrink-0 mt-[3px]" /> {o.reason}</span>
                                          : [`Ages ${sec!.age_min}–${sec!.age_max}`, when].filter(Boolean).join(' · ')}
                                      </span>
                                      {/* Same course both weeks: a warning in ink with a drawn icon, never a block (spec 31). */}
                                      {o.repeat && (
                                        <span className="mt-1 flex items-start gap-1.5 text-sm font-bold text-ink text-pretty">
                                          <Repeat size={16} strokeWidth={2.5} aria-hidden="true" className="shrink-0 mt-px" />{o.repeat}
                                        </span>
                                      )}
                                    </span>
                                  </label>
                                  {/* The class's own rules rule the camper out: the family can ask the camp for an
                                      exception, sent with this registration (spec 31). */}
                                  {o.ruleBlocked && exSection && (ex?.classId === o.classId ? (
                                    <div className="mt-3 mb-2 space-y-2">
                                      <label htmlFor={exId} className={labelCls}>Why is {studentFirst} ready for {o.name}?</label>
                                      <p id={`${exId}-hint`} className={hintCls}>
                                        For example, a class they took at school. It goes to the camp with this registration, and they'll email you. Pick a class for this week too: if the camp agrees, they'll move {studentFirst} into {o.name}.
                                      </p>
                                      <textarea id={exId} rows={3} maxLength={1000} className={textareaCls}
                                        aria-invalid={error && errorField === exId ? true : undefined}
                                        aria-describedby={[`${exId}-hint`, error && errorField === exId ? 'reg-error' : ''].filter(Boolean).join(' ')}
                                        value={ex.message} onChange={e => set(exKey, { ...ex, message: e.target.value })} />
                                      {fieldError(exId)}
                                      <button type="button" onClick={() => set(exKey, null)} className={buttonClass('text', 'text-ink-muted font-semibold')}>
                                        Don't ask<span className="sr-only"> about {o.name}</span>
                                      </button>
                                    </div>
                                  ) : (
                                    <button type="button" className={buttonClass('text', 'px-1')}
                                      onClick={() => {
                                        set(exKey, { classId: o.classId, sectionId: exSection.id, name: o.name, message: '' })
                                        requestAnimationFrame(() => document.getElementById(exId)?.focus())
                                      }}>
                                      Request an exception<span className="sr-only"> for {o.name}</span>
                                    </button>
                                  ))}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </fieldset>
                    )}
                  </div>
                )
              })}
              {/* "Place with" (spec 31): one request, saved on each class booked here. */}
              {(form.session1 || form.session2) && q('place_with').show && (
                <div>
                  <label htmlFor="reg-place-with" className={labelCls}>{labelText('place_with')}</label>
                  <p id="reg-place-with-hint" className={`${hintCls} mb-2`}>Their name. The camp reads every request but can't promise a placement.</p>
                  <input id="reg-place-with" type="text" maxLength={100} autoComplete="off" className={inputCls}
                    aria-invalid={error && errorField === 'reg-place-with' ? true : undefined}
                    aria-describedby={['reg-place-with-hint', error && errorField === 'reg-place-with' ? 'reg-error' : ''].filter(Boolean).join(' ')}
                    value={form.place_with} onChange={e => set('place_with', e.target.value)} />
                  {fieldError('reg-place-with')}
                </div>
              )}
            </div>
          )}

          {/* Step 5: Waiver */}
          {step === 5 && (
            <div className="space-y-6">
              {/* The official waiver is still coming from SCC national (PRODUCT.md), so the text sits
                  in a dashed "not final" frame (DESIGN.md › Shapes) and says so. */}
              <section aria-labelledby="waiver-h">
                <h2 id="waiver-h" className="text-lg font-bold">Steel City Codes {campYear} participant waiver</h2>
                <div className="mt-3 max-w-[65ch] rounded border-2 border-dashed border-border-strong p-4 space-y-3 text-pretty">
                  <p className="flex items-start gap-2 font-bold">
                    <FilePenLine size={20} strokeWidth={2.25} aria-hidden="true" className="shrink-0 mt-0.5" />
                    Placeholder text. Steel City Codes national is writing the official waiver, and it will replace this.
                  </p>
                  <p>This Release and Waiver of Liability releases Steel City Codes ("Nonprofit"), its directors, officers, employees, and agents from any liability arising from your student's participation in the Denver Summer Camp program.</p>
                  <p><b className="font-bold">Assumption of risk.</b> I acknowledge that participation in the Steel City Codes program involves physical and other risks. I voluntarily assume all risks associated with my student's participation.</p>
                  <p><b className="font-bold">Medical authorization.</b> I authorize Steel City Codes staff to seek emergency medical treatment for my student if I cannot be reached. I agree to be responsible for any medical costs incurred.</p>
                  <p><b className="font-bold">Photo and media release.</b> I grant Steel City Codes the right to use photographs and video taken at camp activities for educational and promotional purposes.</p>
                  <p><b className="font-bold">Technology addendum.</b> I understand my student will use computers and technology during camp. I agree to the acceptable use policy for these resources.</p>
                  <p><b className="font-bold">Code of conduct.</b> I agree that my student will follow the Steel City Codes Code of Conduct. Violations may result in dismissal from the program without refund.</p>
                  <p>By signing below, I confirm that I have read, understood, and agree to all terms above.</p>
                </div>
              </section>

              {/* No placeholders here: a placeholder that equals the expected name looks already signed. */}
              <div>
                <label htmlFor="reg-waiver-sig" className={labelCls}>{labelText('waiver_signature')}</label>
                <p className={`${hintCls} mb-2`}>Type the student's full legal name as an electronic signature.</p>
                <input id="reg-waiver-sig" {...invalidProps('reg-waiver-sig')} type="text" autoComplete="off" className={inputCls}
                  value={form.waiver_signature} onChange={e => set('waiver_signature', e.target.value)} />
                {fieldError('reg-waiver-sig')}
              </div>

              <div>
                <label htmlFor="reg-guardian-sig" className={labelCls}>{labelText('guardian_signature')}</label>
                <p className={`${hintCls} mb-2`}>Type your full legal name to confirm your consent on behalf of your student.</p>
                <input id="reg-guardian-sig" {...invalidProps('reg-guardian-sig')} type="text" autoComplete="off" className={inputCls}
                  value={form.guardian_signature} onChange={e => set('guardian_signature', e.target.value)} />
                {fieldError('reg-guardian-sig')}
              </div>
            </div>
          )}

          {error && !(errorField && shown.has(errorField)) && errorLine('mt-5')}

          {/* Back and Continue in flow (Safari's toolbar owns the bottom edge); a 2px rule closes the form. */}
          <div className="mt-8 pt-5 border-t-2 border-ink flex gap-3">
            {step > 1 && (
              <button type="button" onClick={handleBack} className={buttonClass('secondary', 'px-4')}>
                <ChevronLeft size={20} strokeWidth={2.25} aria-hidden="true" /> Back
              </button>
            )}
            {step < 5 ? (
              // Distinct keys: without them React reuses the Next <button> as Submit and the click
              // that lands on the last step can fire a submit.
              <button key="next" type="button" onClick={handleNext} className={buttonClass('primary', 'flex-1')}>
                Continue <ChevronRight size={20} strokeWidth={2.25} aria-hidden="true" />
              </button>
            ) : (
              <button key="submit" type="submit" disabled={submitting} className={buttonClass('primary', 'flex-1')}>
                {submitting
                  ? <span aria-hidden="true" className="w-4 h-4 rounded-full border-2 border-brand-on border-t-transparent animate-spin" />
                  : <CheckCircle2 size={20} strokeWidth={2.25} aria-hidden="true" />}
                {submitting ? 'Submitting…' : 'Submit registration'}
              </button>
            )}
          </div>
        </form>
    </div>
  )
}
