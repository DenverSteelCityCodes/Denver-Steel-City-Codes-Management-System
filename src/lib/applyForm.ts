// The volunteer application (/apply): its answers, its five steps, whole-step validation and the
// row it writes. Kept apart from the page so the rules and the saved data are testable.
import type { ResolvedField } from './formFields'
import { emailProblem } from './authErrors'

export const GRADES = ['9th', '10th', '11th', '12th', 'College']
export const SCHOOLS = [
  'Cherry Creek High School',
  'Grandview High School',
  'Smoky Hill High School',
  'Eaglecrest High School',
  'Rock Canyon High School',
  'Other',
]
export const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
export const CS_LANGUAGES = ['Python', 'Java', 'HTML', 'CSS', 'JavaScript', 'CircuitPython', 'Other']
export const FALLBACK_COURSES = [
  'Intro to Python',
  'Intermediate Python',
  'Intro to Java',
  'Intermediate Java',
  'Web Development',
  'Microcontrollers',
]
export const MIN_AGE = 14

export interface ApplyForm {
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
  interviewSlotId: string
}

export type SkillKey = 'skillPython' | 'skillJava' | 'skillHtml' | 'skillCss' | 'skillJavascript' | 'skillMicrocontrollers'
export const SKILLS: { key: SkillKey; label: string }[] = [
  { key: 'skillPython', label: 'Python' },
  { key: 'skillJava', label: 'Java' },
  { key: 'skillHtml', label: 'HTML' },
  { key: 'skillCss', label: 'CSS' },
  { key: 'skillJavascript', label: 'JavaScript' },
  { key: 'skillMicrocontrollers', label: 'Microcontrollers / CircuitPython' },
]

export const INITIAL_FORM: ApplyForm = {
  email: '', password: '', firstName: '', lastName: '', phone: '',
  age: '', grade: '', school: '', schoolOther: '', shirtSize: '',
  availabilityWeek1: false, availabilityWeek2: false,
  whyVolunteer: '', previousScc: null,
  csLanguages: [], csClasses: '', experienceChildren: '',
  skillPython: null, skillJava: null, skillHtml: null,
  skillCss: null, skillJavascript: null, skillMicrocontrollers: null,
  courseFirst: '', courseSecond: '', otherCurricula: '',
  volunteerSignature: '', guardianSignature: '', interviewSlotId: '',
}

export const STEPS = ['About you', 'Availability', 'Experience', 'Waiver', 'Interview'] as const
export const STEP_COUNT = STEPS.length

// Whole numbers only: "15", not "15.5" or "fifteen".
export function parseAge(raw: string): number | null {
  const t = raw.trim()
  return /^\d{1,3}$/.test(t) ? Number(t) : null
}

// Applicants under 18 need a parent or guardian to sign too. An age not entered yet asks for it,
// so the signature isn't skipped by a blank.
export function needsGuardian(form: Pick<ApplyForm, 'age'>): boolean {
  const age = parseAge(form.age)
  return age === null || age < 18
}

// The second choice never repeats the first.
export function secondChoices(courses: string[], first: string): string[] {
  return courses.filter(c => c !== first)
}

type FieldLookup = (key: string) => ResolvedField

// Every problem on one step at once, keyed by the field it belongs to, in page order (the first
// key is the field that gets focus). Messages say what to do, in the applicant's words.
export function validateStep(step: number, form: ApplyForm, q: FieldLookup, opts: { hasSlots: boolean; weekCount: number }): Record<string, string> {
  const e: Record<string, string> = {}
  if (step === 1) {
    if (!form.firstName.trim()) e.firstName = 'Enter your first name.'
    if (!form.lastName.trim()) e.lastName = 'Enter your last name.'
    const age = parseAge(form.age)
    if (!form.age.trim()) e.age = 'Enter your age.'
    else if (age === null) e.age = 'Enter your age as a number, like 16.'
    else if (age < MIN_AGE) e.age = `Volunteers are ${MIN_AGE} or older.`
    if (!form.grade) e.grade = 'Choose your grade.'
    if (!form.school) e.school = 'Choose your school.'
    else if (form.school === 'Other' && !form.schoolOther.trim()) e.schoolOther = "Type your school's name."
    const emailErr = emailProblem(form.email)
    if (emailErr) e.email = emailErr
    if (!form.phone.trim()) e.phone = 'Enter a phone number we can reach you on.'
    if (!form.password) e.password = 'Choose a password.'
    else if (form.password.length < 8) e.password = 'Use at least 8 characters.'
  }
  if (step === 2) {
    if (!form.availabilityWeek1 && !form.availabilityWeek2) e.availability = opts.weekCount > 1 ? 'Pick at least one week.' : 'Tick the week to say you can come.'
    if (!form.shirtSize) e.shirtSize = 'Choose a T-shirt size.'
    if (!form.whyVolunteer.trim()) e.whyVolunteer = 'Tell us in a sentence or two why you want to volunteer.'
    if (q('previousScc').show && q('previousScc').required && form.previousScc === null) e.previousScc = 'Choose yes or no.'
  }
  if (step === 3) {
    if (q('csLanguages').show && q('csLanguages').required && form.csLanguages.length === 0) e.csLanguages = 'Pick at least one language.'
    if (q('csClasses').show && q('csClasses').required && !form.csClasses.trim()) e.csClasses = 'Answer this one, even briefly.'
    if (q('experienceChildren').show && q('experienceChildren').required && !form.experienceChildren.trim()) e.experienceChildren = 'Answer this one, even briefly.'
    if (!form.courseFirst) e.courseFirst = 'Choose your first choice.'
    if (!form.courseSecond) e.courseSecond = 'Choose a second choice, different from your first.'
    else if (form.courseSecond === form.courseFirst) e.courseSecond = 'Choose a different class from your first choice.'
    if (q('otherCurricula').show && q('otherCurricula').required && !form.otherCurricula.trim()) e.otherCurricula = 'Answer this one, even briefly.'
  }
  if (step === 4) {
    if (!form.volunteerSignature.trim()) e.volunteerSignature = 'Type your full legal name to sign.'
    if (needsGuardian(form) && !form.guardianSignature.trim()) e.guardianSignature = 'Your parent or guardian types their full name here.'
  }
  if (step === 5) {
    if (opts.hasSlots && !form.interviewSlotId) e.interviewSlotId = 'Pick an interview time.'
  }
  return e
}

// The volunteer_applications row, exactly as the application has always saved it.
export function applicationRow(form: ApplyForm, userId: string | null, showPreviousScc: boolean) {
  return {
    user_id: userId,
    first_name: form.firstName,
    last_name: form.lastName,
    email: form.email,
    phone: form.phone,
    age: Number(form.age),
    grade: form.grade,
    school: form.school === 'Other' ? form.schoolOther : form.school,
    shirt_size: form.shirtSize,
    availability_week_1: form.availabilityWeek1,
    availability_week_2: form.availabilityWeek2,
    why_volunteer: form.whyVolunteer,
    previous_scc_volunteer: showPreviousScc ? form.previousScc === true : false,
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
    // Set to true by book_my_interview() once a time is actually booked.
    interview_confirmed: false,
  }
}
