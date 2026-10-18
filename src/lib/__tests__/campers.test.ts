import { describe, expect, it } from 'vitest'
import { GRADES, callTarget, gradeToAge, healthNote, realNote, telHref } from '../campers'
import { courseConstraint, gradeBlockReason } from '../courseConstraints'

describe('gradeToAge', () => {
  it('maps every grade to an age, 4th = 9 up to 9th = 14', () => {
    expect(GRADES.map(gradeToAge)).toEqual([9, 10, 11, 12, 13, 14])
  })
  it('returns null for unknown or empty grades', () => {
    expect(gradeToAge('College')).toBeNull()
    expect(gradeToAge(null)).toBeNull()
  })
})

describe('realNote', () => {
  it('treats "None"-style answers as no note', () => {
    for (const t of ['None', 'none.', 'N/A', 'na', 'no', '-', '  ', null]) expect(realNote(t)).toBeNull()
  })
  it('keeps real notes, trimmed', () => {
    expect(realNote('  Peanut allergy ')).toBe('Peanut allergy')
    expect(realNote('None of the above, but asthma')).toBe('None of the above, but asthma')
  })
})

describe('course constraints', () => {
  it('finds the Microcontrollers rule by name, case-insensitively', () => {
    expect(courseConstraint('MICROCONTROLLERS')?.allowedGrades).toEqual(['7th', '8th', '9th'])
    expect(courseConstraint('Intro to Python')).toBeNull()
  })
  it('blocks grades outside the rule, never an unknown grade', () => {
    const mc = courseConstraint('Microcontrollers')
    expect(gradeBlockReason(mc, '6th')).toBe('Open to students entering grades 7–9')
    expect(gradeBlockReason(mc, '8th')).toBeNull()
    expect(gradeBlockReason(mc, null)).toBeNull()
    expect(gradeBlockReason(null, '4th')).toBeNull()
  })
})

describe('roster helpers', () => {
  const base = { allergies: null, medical_conditions: null, medical_info: null, emergency_contact_name: null, emergency_contact_phone: null, parent_phone: null }
  it('joins allergies and medical notes, skipping "None"', () => {
    expect(healthNote({ ...base, allergies: 'Peanuts', medical_conditions: 'None', medical_info: 'Asthma' })).toBe('Allergies: Peanuts · Medical: Asthma')
    expect(healthNote({ ...base, allergies: 'n/a' })).toBeNull()
  })
  it('calls the emergency contact first, then the parent', () => {
    expect(callTarget({ ...base, emergency_contact_phone: '303-555-0101', emergency_contact_name: 'Aunt Jo', parent_phone: '303-555-0199' })).toEqual({ number: '303-555-0101', who: 'Aunt Jo' })
    expect(callTarget({ ...base, parent_phone: '303-555-0199' })).toEqual({ number: '303-555-0199', who: 'parent' })
    expect(callTarget(base)).toBeNull()
  })
  it('builds a dialable tel: link', () => {
    expect(telHref('(303) 555-0101')).toBe('tel:3035550101')
  })
})
