import { describe, expect, it } from 'vitest'
import { INITIAL_FORM, applicationRow, needsGuardian, parseAge, secondChoices, validateStep } from '../applyForm'
import type { ApplyForm } from '../applyForm'
import { resolveField } from '../formFields'

const q = (key: string) => resolveField('volunteer_application', key, {})
const opts = { hasSlots: true, weekCount: 2 }

const riya: ApplyForm = {
  ...INITIAL_FORM,
  email: 'riya.shah@example.com', password: 'robotics-club', firstName: 'Riya', lastName: 'Shah', phone: '303-555-0142',
  age: '15', grade: '10th', school: 'Other', schoolOther: 'Denver School of Science', shirtSize: 'M',
  availabilityWeek1: true, whyVolunteer: 'I like teaching.', previousScc: false, csLanguages: ['Python'],
  skillPython: 4, courseFirst: 'Web Development', courseSecond: 'Intro to Python',
  volunteerSignature: 'Riya Shah', guardianSignature: 'Asha Shah', interviewSlotId: 'slot-1',
}

describe('apply › whole-step validation', () => {
  it('reports every problem on step 1 at once, in page order', () => {
    const errs = validateStep(1, INITIAL_FORM, q, opts)
    expect(Object.keys(errs)).toEqual(['firstName', 'lastName', 'age', 'grade', 'school', 'email', 'phone', 'password'])
  })

  it('enforces the 14+ age and whole numbers', () => {
    expect(validateStep(1, { ...riya, age: '13' }, q, opts).age).toBe('Volunteers are 14 or older.')
    expect(validateStep(1, { ...riya, age: '15.5' }, q, opts).age).toMatch(/number/)
    expect(validateStep(1, { ...riya, age: '15' }, q, opts).age).toBeUndefined()
  })

  it('asks for the school name only when "Other" is chosen', () => {
    expect(validateStep(1, { ...riya, schoolOther: '' }, q, opts).schoolOther).toBeDefined()
    expect(validateStep(1, { ...riya, school: 'Grandview High School', schoolOther: '' }, q, opts).schoolOther).toBeUndefined()
  })

  it('passes a complete applicant on every step', () => {
    for (const step of [1, 2, 3, 4, 5]) expect(validateStep(step, riya, q, opts)).toEqual({})
  })

  it('never accepts the same class twice', () => {
    expect(validateStep(3, { ...riya, courseSecond: 'Web Development' }, q, opts).courseSecond).toMatch(/different/)
  })

  it('needs a guardian signature under 18 only', () => {
    expect(validateStep(4, { ...riya, guardianSignature: '' }, q, opts).guardianSignature).toBeDefined()
    expect(validateStep(4, { ...riya, age: '19', guardianSignature: '' }, q, opts).guardianSignature).toBeUndefined()
  })

  it('requires an interview time only when times are open', () => {
    expect(validateStep(5, { ...riya, interviewSlotId: '' }, q, opts).interviewSlotId).toBeDefined()
    expect(validateStep(5, { ...riya, interviewSlotId: '' }, q, { ...opts, hasSlots: false })).toEqual({})
  })

  it('follows the Form editor: a hidden question is never required', () => {
    const hidden = (key: string) => resolveField('volunteer_application', key, { csLanguages: { visible: false } })
    expect(validateStep(3, { ...riya, csLanguages: [] }, hidden, opts).csLanguages).toBeUndefined()
    expect(validateStep(3, { ...riya, csLanguages: [] }, q, opts).csLanguages).toBeDefined()
  })
})

describe('apply › helpers', () => {
  it('parses ages', () => {
    expect(parseAge(' 16 ')).toBe(16)
    expect(parseAge('sixteen')).toBeNull()
  })
  it('asks for a guardian until an adult age is entered', () => {
    expect(needsGuardian({ age: '' })).toBe(true)
    expect(needsGuardian({ age: '17' })).toBe(true)
    expect(needsGuardian({ age: '18' })).toBe(false)
  })
  it('drops the first choice from the second list', () => {
    expect(secondChoices(['A', 'B', 'C'], 'B')).toEqual(['A', 'C'])
    expect(secondChoices(['A', 'B'], '')).toEqual(['A', 'B'])
  })
})

describe('apply › the saved row is unchanged', () => {
  it('writes the same columns and values as before the redesign', () => {
    expect(applicationRow(riya, 'user-1', true)).toEqual({
      user_id: 'user-1', first_name: 'Riya', last_name: 'Shah', email: 'riya.shah@example.com', phone: '303-555-0142',
      age: 15, grade: '10th', school: 'Denver School of Science', shirt_size: 'M',
      availability_week_1: true, availability_week_2: false, why_volunteer: 'I like teaching.', previous_scc_volunteer: false,
      cs_languages: ['Python'], cs_classes: null, experience_children: null,
      skill_python: 4, skill_java: null, skill_html: null, skill_css: null, skill_javascript: null, skill_microcontrollers: null,
      course_first_choice: 'Web Development', course_second_choice: 'Intro to Python', other_curricula: null,
      volunteer_signature: 'Riya Shah', guardian_signature: 'Asha Shah', interview_confirmed: false,
    })
  })
  it('saves previous volunteering as false when the question is hidden', () => {
    expect(applicationRow({ ...riya, previousScc: true }, null, false).previous_scc_volunteer).toBe(false)
  })
})
